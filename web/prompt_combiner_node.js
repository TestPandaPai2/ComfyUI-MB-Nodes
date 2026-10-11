// Live preview for MBPromptCombiner: whenever the graph changes, queue only
// the combiner and the nodes feeding it, so the preview follows upstream
// widget edits and new connections without running the whole workflow.
// Queued straight through api.queuePrompt so seed widgets are not bumped.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const LIVE_DEBOUNCE = 400; // ms of quiet after a change before the preview re-runs

let timer = null;
let ready = false;

// The combiner plus everything it reads from, walked through link inputs.
function upstream(output, id) {
    const keep = {};
    const stack = [String(id)];
    while (stack.length) {
        const key = stack.pop();
        if (keep[key] || !output[key]) continue;
        keep[key] = output[key];
        for (const value of Object.values(output[key].inputs ?? {})) {
            if (Array.isArray(value) && value.length === 2) stack.push(String(value[0]));
        }
    }
    return keep;
}

async function refresh() {
    const combiners = app.graph?._nodes?.filter((n) => n.comfyClass === "MBPromptCombiner" && n.mode === 0) ?? [];
    if (!combiners.length) return;

    const { output, workflow } = await app.graphToPrompt();
    for (const node of combiners) {
        const partial = upstream(output, node.id);
        if (!partial[node.id]) continue;
        const key = JSON.stringify(partial);
        if (key === node.__mbLiveKey) continue;
        node.__mbLiveKey = key;
        api.queuePrompt(0, { output: partial, workflow }).catch((e) => console.error("[MBNodes] combiner preview failed", e));
    }
}

function schedule() {
    if (!ready) return;
    clearTimeout(timer);
    timer = setTimeout(() => refresh().catch((e) => console.error("[MBNodes] combiner preview failed", e)), LIVE_DEBOUNCE);
}

app.registerExtension({
    name: "MBNodes.PromptCombiner",

    async setup() {
        api.addEventListener("graphChanged", schedule);
        // Opening a saved workflow fires a burst of changes; start listening
        // once it has settled so loading a graph does not queue anything.
        setTimeout(() => (ready = true), 1500);
    },

    async nodeCreated(node) {
        if (node.comfyClass !== "MBPromptCombiner") return;
        const prev = node.onConnectionsChange;
        node.onConnectionsChange = function () {
            const r = prev?.apply(this, arguments);
            schedule();
            return r;
        };
    },
});
