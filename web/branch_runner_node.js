// Run Branch for Branch Runner (MB). Queues this node through ComfyUI's own
// partial execution (app.queuePrompt's queueNodeIds, the same thing "Queue
// Selected Output Nodes" uses), which runs it plus everything that feeds it
// and nothing else. Hovering the button outlines that set; the label counts
// it. `runs` queues the branch that many times. Alt+Enter runs the selected
// Branch Runners.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { accentColor, addButton, getWidget, notify } from "./common.js";

const NODE_ID = "MBBranchRunner";
const COMMAND_ID = "MBNodes.RunBranch";
const RUNS_DEFAULT_ID = "MBNodes.Defaults.BranchRunnerRuns";

// Branch Runners whose queued runs haven't drained yet.
const running = new Set();
let hovered = null;

// This node and every node upstream of it -- what partial execution runs.
function branchOf(node) {
    const graph = node.graph;
    const seen = new Set([node.id]);
    const stack = [node];
    while (stack.length) {
        for (const input of stack.pop().inputs ?? []) {
            const link = graph.getLink(input.link);
            if (!link || seen.has(link.origin_id)) continue;
            const origin = graph.getNodeById(link.origin_id);
            if (!origin) continue;
            seen.add(origin.id);
            stack.push(origin);
        }
    }
    return seen;
}

function buttonLabel(node) {
    if (running.has(node)) return "Running…";
    if (node.inputs?.[0]?.link == null) return "Run Branch";
    return `Run Branch (${branchOf(node).size} nodes)`;
}

function refreshButton(node) {
    const button = node.__mbRunButton;
    if (!button) return;
    const label = buttonLabel(node);
    const busy = running.has(node);
    if (button.label === label && button.disabled === busy) return;
    button.label = label;
    button.disabled = busy;
    node.setDirtyCanvas(true, true);
}

async function runBranch(node) {
    if (!node.graph || running.has(node)) return;
    if (node.inputs?.[0]?.link == null) {
        notify("warn", "Nothing to run", "Connect an input to Branch Runner first.");
        return;
    }
    if (node.mode !== LiteGraph.ALWAYS) {
        notify("warn", "Nothing to run", "This Branch Runner is muted or bypassed.");
        return;
    }
    running.add(node);
    refreshButton(node);
    const runs = node.properties.mbRuns ?? 1;
    await app.queuePrompt(0, runs, { queueNodeIds: [node.id] });
    // A rejected prompt (validation error) never reaches the queue, so no
    // status update would clear the button.
    const queue = await api.getQueue();
    if (!queue.Running.length && !queue.Pending.length) {
        running.delete(node);
        refreshButton(node);
    }
}

// The queue reports how many prompts are left; once it is empty every
// Branch Runner's runs are done.
function onStatus({ detail }) {
    if (detail?.exec_info?.queue_remaining || !running.size) return;
    const done = [...running];
    running.clear();
    done.forEach(refreshButton);
}

function overButton(node, pos) {
    const button = node.__mbRunButton;
    if (button?.y == null) return false;
    const height = button.computedHeight ?? LiteGraph.NODE_WIDGET_HEIGHT;
    return pos[1] >= button.y && pos[1] <= button.y + height && pos[0] >= 0 && pos[0] <= node.size[0];
}

function setHovered(node) {
    if (hovered === node) return;
    hovered = node;
    app.canvas.setDirty(true, true);
}

// Canvas foreground is drawn in graph space, so node rects can be stroked as is.
function drawBranchOutline(ctx) {
    if (!hovered?.graph || hovered.graph !== app.canvas.graph || hovered.inputs?.[0]?.link == null) return;
    const titleHeight = LiteGraph.NODE_TITLE_HEIGHT;
    ctx.save();
    ctx.strokeStyle = accentColor();
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    for (const id of branchOf(hovered)) {
        const node = hovered.graph.getNodeById(id);
        if (!node) continue;
        const [x, y] = node.pos;
        const [w, h] = node.flags?.collapsed ? [node._collapsed_width ?? node.size[0], 0] : node.size;
        ctx.beginPath();
        ctx.roundRect(x - 4, y - titleHeight - 4, w + 8, h + titleHeight + 8, 10);
        ctx.stroke();
    }
    ctx.restore();
}

function addRunsWidget(node) {
    // A loaded workflow overwrites this with the saved value during configure.
    node.properties.mbRuns ??= app.extensionManager?.setting?.get(RUNS_DEFAULT_ID) ?? 1;
    const widget = node.addWidget("number", "runs", node.properties.mbRuns, (value) => {
        node.properties.mbRuns = Math.max(1, Math.min(100, Math.round(value)));
    }, { min: 1, max: 100, step: 10, precision: 0 });
    // Kept in node.properties: never sent to Python, never shifts widget values.
    widget.serialize = false;
    widget.options.serialize = false;
    return widget;
}

app.registerExtension({
    name: "MBNodes.BranchRunner",

    settings: [
        {
            id: RUNS_DEFAULT_ID,
            category: ["MB", "Node defaults", "Branch Runner runs"],
            name: "Branch Runner: runs",
            tooltip: "runs value on newly added Branch Runner (MB) nodes.",
            type: "number",
            attrs: { min: 1, max: 100, step: 1 },
            defaultValue: 1,
        },
    ],

    commands: [
        {
            id: COMMAND_ID,
            label: "Run selected Branch Runner",
            function: () => {
                const selected = Object.values(app.canvas.selected_nodes ?? {})
                    .filter((node) => node.comfyClass === NODE_ID);
                selected.forEach(runBranch);
            },
        },
    ],
    keybindings: [{ combo: { alt: true, key: "Enter" }, commandId: COMMAND_ID }],

    async setup() {
        api.addEventListener("status", onStatus);
        const prevDraw = app.canvas.onDrawForeground;
        app.canvas.onDrawForeground = function (ctx, area) {
            prevDraw?.apply(this, arguments);
            drawBranchOutline(ctx);
        };
    },

    async nodeCreated(node) {
        if (node.comfyClass !== NODE_ID) return;
        node.__mbRunButton = addButton(node, "Run Branch", () => runBranch(node));
        const runs = addRunsWidget(node);

        const prevConfigure = node.onConfigure;
        node.onConfigure = function () {
            const r = prevConfigure?.apply(this, arguments);
            runs.value = node.properties.mbRuns ?? 1;
            return r;
        };

        // Upstream edits elsewhere in the graph don't notify this node, so the
        // count is refreshed as it draws.
        const prevDraw = node.onDrawForeground;
        node.onDrawForeground = function () {
            const r = prevDraw?.apply(this, arguments);
            refreshButton(node);
            return r;
        };

        const prevMove = node.onMouseMove;
        node.onMouseMove = function (event, pos) {
            const r = prevMove?.apply(this, arguments);
            setHovered(overButton(node, pos) ? node : null);
            return r;
        };
        const prevLeave = node.onMouseLeave;
        node.onMouseLeave = function () {
            const r = prevLeave?.apply(this, arguments);
            if (hovered === node) setHovered(null);
            return r;
        };

        const prevRemoved = node.onRemoved;
        node.onRemoved = function () {
            running.delete(node);
            if (hovered === node) setHovered(null);
            return prevRemoved?.apply(this, arguments);
        };
    },
});
