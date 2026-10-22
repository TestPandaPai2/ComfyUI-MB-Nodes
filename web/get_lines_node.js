import { app } from "../../scripts/app.js";
import { getWidget, resizeToContent } from "./common.js";

// Get Lines (MB): one output per line of the incoming text. In auto mode the
// count follows the text widget feeding the node (refreshed as it is edited)
// or, when the text only exists at run time, the count Python reports after a
// run. Right-click -> Lines pins a fixed count instead.

const MAX_LINES = 32; // must match MAX_LINES in nodes/get_lines_node.py
const TEXT_WIDGET_NAMES = ["text", "string", "value", "prompt", "text_in"];

function splitLines(text, keepBlank) {
    const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+$/, ""));
    // Python's splitlines() drops the empty piece after a trailing newline.
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    return keepBlank ? lines : lines.filter((line) => line.trim().length > 0);
}

// Follows the "text" link back to the widget feeding it, hopping through
// reroutes. Returns null when the text cannot be read without running the graph.
function upstreamWidget(node, depth = 0) {
    if (depth > 8 || !node.graph) return null;

    const slot = node.inputs?.find((i) => i.name === "text") ?? node.inputs?.[0];
    const link = node.graph.getLink(slot?.link);
    if (!link) return null;

    const source = node.graph.getNodeById(link.origin_id);
    if (!source) return null;

    // Reroutes and other passthroughs carry the value of their own input.
    if (source.isVirtualNode || /reroute/i.test(source.comfyClass ?? source.type ?? "")) {
        return upstreamWidget(source, depth + 1);
    }

    const strings = (source.widgets ?? []).filter((w) => typeof w.value === "string");
    return strings.find((w) => TEXT_WIDGET_NAMES.includes(w.name)) ?? strings[0] ?? null;
}

// A source widget can feed several Get Lines nodes, so each widget keeps the
// set of nodes watching it and is hooked only once: through its callback and,
// for textarea widgets, the element's input event (fired on every keystroke).
function hookWidget(widget) {
    if (widget.__mbLineWatchers) return;
    widget.__mbLineWatchers = new Set();
    const notify = () => widget.__mbLineWatchers.forEach(refresh);
    const prev = widget.callback;
    widget.callback = function () {
        const r = prev?.apply(this, arguments);
        notify();
        return r;
    };
    (widget.inputEl ?? widget.element)?.addEventListener?.("input", notify);
}

function watch(node, widget) {
    if (node.__mbWatched === widget) return;
    node.__mbWatched?.__mbLineWatchers?.delete(node);
    node.__mbWatched = widget;
    if (!widget) return;
    hookWidget(widget);
    widget.__mbLineWatchers.add(node);
}

// The highest output index that still has a wire; those slots are never trimmed.
function lastConnected(node) {
    for (let i = (node.outputs?.length ?? 0) - 1; i >= 0; i--) {
        if (node.isOutputConnected(i)) return i;
    }
    return -1;
}

function setOutputCount(node, count) {
    const wanted = Math.max(1, Math.min(MAX_LINES, count), lastConnected(node) + 1);
    if ((node.outputs?.length ?? 0) === wanted) return;

    // Only ever trimmed from the end, so the remaining slots keep their index
    // and stay aligned with the backend's line_1..line_N outputs.
    while (node.outputs.length > wanted) node.removeOutput(node.outputs.length - 1);
    while (node.outputs.length < wanted) node.addOutput(`line_${node.outputs.length + 1}`, "STRING");

    resizeToContent(node);
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
    if (!node.graph) return;
    const widget = upstreamWidget(node);
    watch(node, widget);

    if (isFixed(node)) {
        node.__mbLineCount = fixedCount(node);
    } else if (widget) {
        node.__mbLineCount = splitLines(widget.value, !!getWidget(node, "keep_blank_lines")?.value).length;
    } else if (node.__mbRunCount == null) {
        return; // nothing readable upstream and no run yet; leave the slots alone
    } else {
        node.__mbLineCount = node.__mbRunCount;
    }
    setOutputCount(node, node.__mbLineCount);
    node.setDirtyCanvas(true, true);
}

function setMode(node, choice) {
    if (choice === "auto") {
        node.properties.mb_mode = "auto";
    } else {
        node.properties.mb_mode = "fixed";
        node.properties.mb_outputs = choice;
    }
    refresh(node);
}

function linesMenu(node) {
    const fixed = isFixed(node) ? fixedCount(node) : null;
    const options = [{ content: `${fixed === null ? "✓ " : ""}Auto (follow text)`, callback: () => setMode(node, "auto") }];
    for (let n = 1; n <= MAX_LINES; n++) {
        options.push({ content: `${fixed === n ? "✓ " : ""}Fixed: ${n}`, callback: () => setMode(node, n) });
    }
    return { content: "Lines", has_submenu: true, submenu: { options } };
}

const MODE_DEFAULT_ID = "MBNodes.Defaults.GetLinesMode";
const AUTO = "Auto";
const MODE_OPTIONS = [AUTO, ...Array.from({ length: MAX_LINES }, (_, i) => `Fixed: ${i + 1}`)];

function wireNode(node) {
    node.properties = node.properties ?? {};
    // New nodes start in the mode picked in MB settings; a loaded workflow
    // overwrites these with its saved values during configure.
    const start = app.extensionManager?.setting?.get(MODE_DEFAULT_ID) ?? AUTO;
    const fixed = start === AUTO ? null : parseInt(start.slice("Fixed: ".length));
    node.properties.mb_mode ??= fixed ? "fixed" : "auto";
    node.properties.mb_outputs ??= fixed ?? 1;

    const prevMenuOptions = node.getExtraMenuOptions;
    node.getExtraMenuOptions = function (canvas, options) {
        prevMenuOptions?.apply(this, arguments);
        options.unshift(linesMenu(this));
    };

    const keepBlank = getWidget(node, "keep_blank_lines");
    if (keepBlank) {
        const prev = keepBlank.callback;
        keepBlank.callback = function () {
            const r = prev?.apply(this, arguments);
            refresh(node);
            return r;
        };
    }

    const prevOnConnectionsChange = node.onConnectionsChange;
    node.onConnectionsChange = function (type) {
        prevOnConnectionsChange?.apply(this, arguments);
        if (type === LiteGraph.INPUT) refresh(this);
    };

    // The real count from Python, for text no widget holds before the run.
    const prevExecuted = node.onExecuted;
    node.onExecuted = function (output) {
        prevExecuted?.apply(this, arguments);
        const count = output?.line_count?.[0];
        if (typeof count !== "number") return;
        node.__mbRunCount = count;
        if (!isFixed(node) && !node.__mbWatched) refresh(node);
    };

    const prevDraw = node.onDrawForeground;
    node.onDrawForeground = function (ctx) {
        const r = prevDraw?.apply(this, arguments);
        if (this.flags?.collapsed || node.__mbLineCount == null) return r;
        const label = isFixed(node) ? `fixed · ${node.__mbLineCount}` : `${node.__mbLineCount} lines`;
        ctx.save();
        ctx.font = "11px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = LiteGraph.NODE_TEXT_COLOR;
        ctx.globalAlpha = 0.6;
        ctx.fillText(label, this.size[0] - 10, -LiteGraph.NODE_TITLE_HEIGHT / 2);
        ctx.restore();
        return r;
    };

    const prevRemoved = node.onRemoved;
    node.onRemoved = function () {
        watch(this, null);
        return prevRemoved?.apply(this, arguments);
    };
}

app.registerExtension({
    name: "MBNodes.GetLines",

    settings: [
        {
            id: MODE_DEFAULT_ID,
            category: ["MB", "Node defaults", "Get Lines mode"],
            name: "Get Lines: start mode",
            tooltip: "Line mode of newly added Get Lines (MB) nodes.",
            type: "combo",
            options: MODE_OPTIONS,
            defaultValue: AUTO,
        },
    ],

    async nodeCreated(node) {
        if (node.comfyClass !== "MBGetLines") return;
        wireNode(node);
        // The schema declares every possible output; a fresh node shows one.
        setOutputCount(node, isFixed(node) ? fixedCount(node) : 1);
        refresh(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBGetLines") return;
        // Links and properties are only in place once the graph is configured.
        setTimeout(() => refresh(node), 100);
    },
});
