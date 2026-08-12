import { app } from "../../scripts/app.js";
import { resizeToContent } from "./common.js";

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

function refresh(node) {
    const text = upstreamText(node);
    if (text === null) return; // nothing readable upstream; leave the slots alone
    setOutputCount(node, splitLines(text).length);
}

function wireNode(node) {
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
        setOutputCount(node, 1);
        refresh(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBGetLines") return;
        setTimeout(() => refresh(node), 100);
    },
});
