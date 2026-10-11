import { app } from "../../scripts/app.js";
import { getWidget, setWidgetVisible, resizeToContent } from "./common.js";
import { openDialog } from "./dialog.js";

const HIDDEN = ["min_value", "max_value", "step", "output_type"];
const GEAR_SIZE = 20; // hit box of the gear drawn in the title bar
// Big target ranges such as seeds would make a useless slider, so those keep
// the current range and only take the step.
const MAX_ADOPTED_SPAN = 1e6;

function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
}

// The value widget's own min/max/step come from the schema, so they are rewritten
// whenever the range or step changes.
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

    // An undefined value would snap to NaN, which saves as null and comes back
    // as an invalid float on the next load. Fall back to the bottom of the range.
    const current = Number(value.value);
    const base = Number.isFinite(current) ? current : low;
    const snapped = low + Math.round((base - low) / step) * step;
    value.value = Number(clamp(snapped, low, high).toFixed(precision));

    node.setDirtyCanvas(true, true);
}

// The output is a wildcard until linked; once linked it shows the type it feeds.
function applyOutputType(node) {
    const out = node.outputs?.[0];
    if (!out) return;
    out.type = out.links?.length ? getWidget(node, "output_type")?.value ?? "FLOAT" : "*";
    node.setDirtyCanvas(true, true);
}

function targetInput(node, link) {
    const target = node.graph?.getNodeById(link.target_id);
    const input = target?.inputs?.[link.target_slot];
    if (!input) return null;
    const widget = input.widget?.name ? getWidget(target, input.widget.name) : null;
    return { type: input.type, widget };
}

// A new output link: take the target's type, step and (if sensible) range.
function adoptTarget(node, link) {
    const found = targetInput(node, link);
    const typeW = getWidget(node, "output_type");
    if (!found || !typeW) return;
    typeW.value = found.type === "INT" ? "INT" : "FLOAT";

    const opts = found.widget?.options ?? {};
    let step = Number(opts.step2 ?? opts.round ?? (opts.step != null ? opts.step / 10 : NaN));
    if (!Number.isFinite(step) || step <= 0) step = typeW.value === "INT" ? 1 : 0.01;
    if (typeW.value === "INT") step = Math.max(1, Math.round(step));
    getWidget(node, "step").value = step;

    const low = Number(opts.min);
    const high = Number(opts.max);
    if (Number.isFinite(low) && Number.isFinite(high) && low < high && high - low <= MAX_ADOPTED_SPAN) {
        getWidget(node, "min_value").value = low;
        getWidget(node, "max_value").value = high;
        const current = Number(found.widget.value);
        if (Number.isFinite(current)) getWidget(node, "value").value = current;
    }
    applyRange(node);
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

function openSettings(node) {
    const minW = getWidget(node, "min_value");
    const maxW = getWidget(node, "max_value");
    const stepW = getWidget(node, "step");
    if (!minW || !maxW || !stepW) return;

    const minInput = numberField(minW.value);
    const maxInput = numberField(maxW.value);
    const stepInput = numberField(stepW.value);

    openDialog({
        title: "Slider (MB) — Settings",
        applyLabel: "Done",
        render(body) {
            body.append(settingsRow("Min", minInput), settingsRow("Max", maxInput), settingsRow("Step", stepInput));
        },
        onApply() {
            const low = Number(minInput.value);
            const high = Number(maxInput.value);
            const step = Number(stepInput.value);
            const rangeOk = Number.isFinite(low) && Number.isFinite(high) && low < high;
            const stepOk = Number.isFinite(step) && step > 0;
            minInput.classList.toggle("mb-invalid", !rangeOk);
            maxInput.classList.toggle("mb-invalid", !rangeOk);
            stepInput.classList.toggle("mb-invalid", !stepOk);
            if (!rangeOk || !stepOk) return false;

            minW.value = low;
            maxW.value = high;
            stepW.value = step;
            applyRange(node);
        },
    });
}

function gearHit(node, pos) {
    const titleHeight = window.LiteGraph?.NODE_TITLE_HEIGHT ?? 30;
    return pos[1] < 0 && pos[1] > -titleHeight && pos[0] > node.size[0] - GEAR_SIZE - 6;
}

function wireNode(node) {
    for (const name of HIDDEN) setWidgetVisible(node, name, false);

    const prevDraw = node.onDrawForeground;
    node.onDrawForeground = function (ctx) {
        prevDraw?.apply(this, arguments);
        if (this.flags?.collapsed) return;
        const titleHeight = window.LiteGraph?.NODE_TITLE_HEIGHT ?? 30;
        ctx.save();
        ctx.fillStyle = "#c9c9d1";
        ctx.font = "15px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚙", this.size[0] - GEAR_SIZE / 2 - 6, -titleHeight / 2);
        ctx.restore();
    };

    const prevMouseDown = node.onMouseDown;
    node.onMouseDown = function (e, pos) {
        if (gearHit(this, pos)) {
            openSettings(this);
            return true;
        }
        return prevMouseDown?.apply(this, arguments);
    };

    const prevConnections = node.onConnectionsChange;
    node.onConnectionsChange = function (kind, slot, connected, link) {
        const r = prevConnections?.apply(this, arguments);
        // kind 2 = output side; adopting is skipped while a workflow loads so saved ranges stay.
        if (kind === 2) {
            if (connected && link && this.__mbReady) adoptTarget(this, link);
            applyOutputType(this);
        }
        return r;
    };

    applyRange(node);
    resizeToContent(node);

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
            for (const name of HIDDEN) setWidgetVisible(node, name, false);
            applyRange(node);
            applyOutputType(node);
            resizeToContent(node);
        }, 40);
    },
});
