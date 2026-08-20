// Run Branch for Branch Runner (MB). ComfyUI's own partial-execution support
// (app.queuePrompt's queueNodeIds option, same thing "Queue Selected Output
// Nodes" uses) only ever runs the OUTPUT_NODE-flagged nodes it's given plus
// whatever feeds them -- it has no notion of "everything wired to this node".
// So the button first walks the graph to find that set for itself, then hands
// the output nodes it finds in it to the native queuing call.

import { app } from "../../scripts/app.js";
import { addButton, notify } from "./common.js";

// Tracks whichever output node was most recently selected on the canvas, so
// an unwired Branch Runner has something to fall back to. Patched onto the
// shared LGraphNode prototype rather than per-node, so it also catches output
// nodes selected before any Branch Runner existed in the graph.
let lastSelectedOutputNode = null;

function installSelectionTracking() {
    const proto = window.LiteGraph?.LGraphNode?.prototype;
    if (!proto || proto._mbTracksSelection) return;
    proto._mbTracksSelection = true;

    const original = proto.onSelected;
    proto.onSelected = function (...args) {
        if (this?.constructor?.nodeData?.output_node) lastSelectedOutputNode = this;
        return original?.apply(this, args);
    };
}

// Undirected: an ancestor and a descendant of this node are both part of
// "its branch", since either could be the thing that actually needs running.
function connectedComponent(node) {
    const graph = node.graph;
    const visited = new Set([node.id]);
    const stack = [node];

    while (stack.length) {
        const current = stack.pop();
        const neighbours = [];

        for (const input of current.inputs ?? []) {
            const link = input.link != null ? graph.links[input.link] : null;
            if (link) neighbours.push(link.origin_id);
        }
        for (const output of current.outputs ?? []) {
            for (const linkId of output.links ?? []) {
                const link = graph.links[linkId];
                if (link) neighbours.push(link.target_id);
            }
        }

        for (const id of neighbours) {
            if (visited.has(id)) continue;
            const next = graph.getNodeById(id);
            if (!next) continue;
            visited.add(id);
            stack.push(next);
        }
    }

    return visited;
}

function runBranch(node) {
    if (!node.graph) return;

    // An unwired input means there's nothing to trace a branch from at this
    // node, so the button falls back to whatever output node was last
    // selected on the canvas instead.
    const connected = node.inputs?.[0]?.link != null;
    let startNode = node;

    if (!connected) {
        if (!lastSelectedOutputNode?.graph) {
            notify("warn", "Nothing to run", "Connect an input, or select an output node on the canvas first.");
            return;
        }
        startNode = lastSelectedOutputNode;
    }

    const always = window.LiteGraph?.ALWAYS ?? 0;
    const outputIds = [];
    for (const id of connectedComponent(startNode)) {
        const branchNode = startNode.graph.getNodeById(id);
        // Same filter the native "Queue Selected Output Nodes" command uses:
        // only live output nodes are valid execution roots.
        if (branchNode?.constructor?.nodeData?.output_node && branchNode.mode === always) {
            outputIds.push(id);
        }
    }

    if (!outputIds.length) {
        notify(
            "warn",
            "Nothing to run",
            connected ? "This node is muted or bypassed." : "The selected output node is muted or bypassed."
        );
        return;
    }

    app.queuePrompt(0, 1, { queueNodeIds: outputIds });
}

app.registerExtension({
    name: "MBNodes.BranchRunner",

    async setup() {
        installSelectionTracking();
    },

    async nodeCreated(node) {
        if (node.comfyClass !== "MBBranchRunner") return;
        addButton(node, "Run Branch", () => runBranch(node));
    },
});
