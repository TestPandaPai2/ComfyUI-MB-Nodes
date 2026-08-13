import { app } from "../../scripts/app.js";
import { resizeToContent } from "./common.js";
import { openDialog, radioRow } from "./dialog.js";

const MAX_LINES = 32; // must match MAX_LINES in nodes/get_lines_node.py
const POLL_MS = 3000;
const TEXT_WIDGET_NAMES = ["text", "string", "value", "prompt", "text_in"];

function splitLines(text) {
    return text
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+$/, ""))
        .filter((line) => line.trim().length > 0);
}

// Follows the "text" link back to whatever widget is feeding it, hopping through
// reroutes. Returns null when the text cannot be read without running the graph.
function upstreamText(node, depth = 0) {
    if (depth > 8) return null;

    const slot = node.inputs?.find((i) => i.name === "text") ?? node.inputs?.[0];
    const link = slot?.link != null ? app.graph.links?.[slot.link] : null;
    if (!link) return null;

    const source = app.graph.getNodeById(link.origin_id);
    if (!source) return null;

    // Reroutes and other passthroughs carry the value of their own input.
    if (source.isVirtualNode || /reroute/i.test(source.comfyClass ?? source.type ?? "")) {
        return upstreamText(source, depth + 1);
    }

    const strings = (source.widgets ?? []).filter((w) => typeof w.value === "string");
    const named = strings.find((w) => TEXT_WIDGET_NAMES.includes(w.name));
    return (named ?? strings[0])?.value ?? null;
}

function setOutputCount(node, count) {
    const wanted = Math.max(1, Math.min(MAX_LINES, count));
    if ((node.outputs?.length ?? 0) === wanted) return false;

    // Only ever trimmed from the end, so the remaining slots keep their index
    // and stay aligned with the backend's line_1..line_N outputs.
    while (node.outputs.length > wanted) node.removeOutput(node.outputs.length - 1);
    while (node.outputs.length < wanted) node.addOutput(`line_${node.outputs.length + 1}`, "STRING");

    resizeToContent(node);
    return true;
}

// Stored in node.properties so the choice is saved with the workflow.
function isFixed(node) {
    return node.properties?.mb_mode === "fixed";
}

function fixedCount(node) {
    const value = Math.round(Number(node.properties?.mb_outputs));
    return Number.isFinite(value) ? Math.max(1, Math.min(MAX_LINES, value)) : 1;
}

function refresh(node) {
    if (isFixed(node)) {
        setOutputCount(node, fixedCount(node));
        return; // the 3s recheck does nothing while the count is pinned
    }

    const text = upstreamText(node);
    if (text === null) return; // nothing readable upstream; leave the slots alone
    setOutputCount(node, splitLines(text).length);
}

function openSettings(node) {
    let auto;
    let fixed;
    let count;

    openDialog({
        title: "Get Lines (MB) — MB Settings",
        render(body) {
            count = document.createElement("input");
            count.type = "number";
            count.className = "mb-dialog-number";
            count.min = "1";
            count.max = String(MAX_LINES);
            count.value = String(fixedCount(node));
            count.disabled = !isFixed(node);

            auto = radioRow({
                group: "mb-getlines-mode",
                value: "auto",
                label: "Detect lines automatically",
                checked: !isFixed(node),
                hint: `Rechecks the incoming text every ${POLL_MS / 1000}s.`,
            });

            fixed = radioRow({
                group: "mb-getlines-mode",
                value: "fixed",
                label: "Fixed outputs",
                checked: isFixed(node),
                hint: `Keeps the count pinned, no rechecking. 1-${MAX_LINES}.`,
                control: count,
            });

            const sync = () => (count.disabled = !fixed.radio.checked);
            auto.radio.addEventListener("change", sync);
            fixed.radio.addEventListener("change", sync);

            body.append(auto.wrapper, fixed.wrapper);
        },
        onApply() {
            if (!fixed.radio.checked) {
                node.properties.mb_mode = "auto";
                refresh(node);
                return;
            }

            const value = Math.round(Number(count.value));
            if (!Number.isFinite(value) || value < 1 || value > MAX_LINES) {
                count.focus();
                return false; // keep the dialog open
            }

            node.properties.mb_mode = "fixed";
            node.properties.mb_outputs = value;
            refresh(node);
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

function wireNode(node) {
    node.properties = node.properties ?? {};
    node.properties.mb_mode = node.properties.mb_mode ?? "auto";
    node.properties.mb_outputs = node.properties.mb_outputs ?? 1;
    addSettingsMenu(node);

    const prevOnConnectionsChange = node.onConnectionsChange;
    node.onConnectionsChange = function (type, slotIndex, connected, link, ioSlot) {
        prevOnConnectionsChange?.apply(this, arguments);
        if (type === 1) refresh(this); // 1 = LiteGraph.INPUT
    };

    node.__mbLinesTimer = setInterval(() => refresh(node), POLL_MS);

    const prevRemoved = node.onRemoved;
    node.onRemoved = function () {
        clearInterval(this.__mbLinesTimer);
        return prevRemoved?.apply(this, arguments);
    };
}

app.registerExtension({
    name: "MBNodes.GetLines",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBGetLines") return;
        wireNode(node);
        // The schema declares every possible output; a fresh node shows one.
        setOutputCount(node, isFixed(node) ? fixedCount(node) : 1);
        refresh(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBGetLines") return;
        setTimeout(() => refresh(node), 100);
    },
});
