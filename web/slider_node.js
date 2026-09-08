import { app } from "../../scripts/app.js";
import { getWidget, setWidgetVisible, resizeToContent } from "./common.js";
import { openDialog } from "./dialog.js";

const LIVE_DEBOUNCE = 250; // ms of quiet after a drag before the prompt re-queues

function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
}

// The value widget's own min/max/step come from the schema, so they are rewritten
// whenever the min/max/step widgets change.
function applyRange(node) {
    const value = getWidget(node, "value");
    const minW = getWidget(node, "min_value");
    const maxW = getWidget(node, "max_value");
    const stepW = getWidget(node, "step");
    if (!value || !minW || !maxW || !stepW) return;

    let low = Number(minW.value);
    let high = Number(maxW.value);
    if (!Number.isFinite(low)) low = 0;
    if (!Number.isFinite(high)) high = 1;
    if (low > high) [low, high] = [high, low];
    if (low === high) high = low + 1;

    let step = Number(stepW.value);
    if (!Number.isFinite(step) || step <= 0) step = 0.01;

    const precision = step >= 1 ? 0 : Math.min(12, Math.max(0, -Math.floor(Math.log10(step))) + 2);

    // Replaced rather than mutated: the options object can be the one shared
    // with the node definition, and writing through it leaks this node's range
    // onto every other slider.
    value.options = {
        ...(value.options ?? {}),
        min: low,
        max: high,
        // LiteGraph number widgets treat options.step as 10x the real increment.
        step: step * 10,
        step2: step,
        round: step,
        precision,
    };

    // A widget value that is undefined (or already broken) would snap to NaN,
    // and NaN serialises into the workflow as null, which comes back as an
    // invalid float on the next load. Fall back to the bottom of the range.
    const current = Number(value.value);
    const base = Number.isFinite(current) ? current : low;

    const snapped = low + Math.round((base - low) / step) * step;
    value.value = Number(clamp(snapped, low, high).toFixed(precision));

    node.setDirtyCanvas(true, true);
}

function numberField(value) {
    const input = document.createElement("input");
    input.className = "mb-dialog-number";
    input.style.width = "72px";
    input.type = "number";
    input.value = value;
    return input;
}

function settingsRow(label, input) {
    const row = document.createElement("div");
    row.className = "mb-dialog-field";
    const span = document.createElement("span");
    span.textContent = label;
    span.style.width = "36px";
    row.append(span, input);
    return row;
}

// Range/step live in the min_value/max_value/step widgets so they still
// serialise with the workflow; the dialog is just a friendlier editor for them.
function openSettings(node) {
    const minW = getWidget(node, "min_value");
    const maxW = getWidget(node, "max_value");
    const stepW = getWidget(node, "step");
    if (!minW || !maxW || !stepW) return;

    const minInput = numberField(minW.value);
    const maxInput = numberField(maxW.value);
    const stepInput = numberField(stepW.value);

    openDialog({
        title: "Slider (MB) — MB Settings",
        applyLabel: "Done",
        render(body) {
            body.append(
                settingsRow("Min", minInput),
                settingsRow("Max", maxInput),
                settingsRow("Step", stepInput),
            );
        },
        onApply() {
            const low = Number(minInput.value);
            const high = Number(maxInput.value);
            const step = Number(stepInput.value);
            if (!Number.isFinite(low) || !Number.isFinite(high) || low >= high) {
                minInput.classList.toggle("mb-invalid", true);
                maxInput.classList.toggle("mb-invalid", low < high);
                return false;
            }
            minInput.classList.remove("mb-invalid");
            maxInput.classList.remove("mb-invalid");
            if (!Number.isFinite(step) || step <= 0) {
                stepInput.classList.add("mb-invalid");
                return false;
            }
            stepInput.classList.remove("mb-invalid");

            minW.value = low;
            minW.callback?.(low);
            maxW.value = high;
            maxW.callback?.(high);
            stepW.value = step;
            stepW.callback?.(step);
            applyRange(node);
        },
    });
}

function addSettingsMenu(node) {
    const prevMenuOptions = node.getExtraMenuOptions;
    node.getExtraMenuOptions = function (canvas, options) {
        prevMenuOptions?.apply(this, arguments);
        options.unshift({ content: "MB Settings", callback: () => openSettings(this) });
    };
}

function liveEnabled(node) {
    return getWidget(node, "live")?.value === true;
}

// One timer per node so dragging a slider fires a single queue at the end.
function scheduleQueue(node) {
    clearTimeout(node.__mbLiveTimer);
    node.__mbLiveTimer = setTimeout(() => {
        if (!liveEnabled(node) || !node.__mbReady) return;
        // Skip while something is already running to avoid stacking a queue per drag.
        if (app.ui?.lastQueueSize) return;
        app.queuePrompt(0, 1).catch((e) => console.error("[MBNodes] live queue failed", e));
    }, LIVE_DEBOUNCE);
}

function wireNode(node) {
    const value = getWidget(node, "value");
    if (!value) return;

    addSettingsMenu(node);
    for (const name of ["min_value", "max_value", "step"]) setWidgetVisible(node, name, false);
    resizeToContent(node);

    for (const name of ["min_value", "max_value", "step"]) {
        const w = getWidget(node, name);
        if (!w) continue;
        const prev = w.callback;
        w.callback = function (...args) {
            const r = prev?.apply(this, args);
            applyRange(node);
            return r;
        };
    }

    const prevValueCallback = value.callback;
    value.callback = function (...args) {
        const r = prevValueCallback?.apply(this, args);
        if (liveEnabled(node)) scheduleQueue(node);
        return r;
    };

    const prevRemoved = node.onRemoved;
    node.onRemoved = function () {
        clearTimeout(this.__mbLiveTimer);
        return prevRemoved?.apply(this, arguments);
    };

    applyRange(node);

    // Values are written into the widgets while a workflow loads. Live mode only
    // starts listening once that has settled, so opening a saved graph with live
    // on does not fire a run by itself.
    node.__mbReady = false;
    setTimeout(() => {
        node.__mbReady = true;
    }, 1000);
}

app.registerExtension({
    name: "MBNodes.Slider",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBSlider") return;
        wireNode(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBSlider") return;
        setTimeout(() => {
            for (const name of ["min_value", "max_value", "step"]) setWidgetVisible(node, name, false);
            applyRange(node);
            resizeToContent(node);
        }, 40);
    },
});
