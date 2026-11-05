// Keeps MB Load Models Combo dropdowns in step with the model folders.
// nodes/model_watch.py pushes the lists when a folder changes; MB LoRA Stack
// listens for the same event in its own file.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget } from "./common.js";

const NODE_ID = "MBModelCombo";
const COMBO_WIDGETS = ["unet_name", "clip_name", "vae_name"];

let lists = null;

function updateNode(node) {
    if (!lists || node.comfyClass !== NODE_ID) return;
    for (const name of COMBO_WIDGETS) {
        const widget = getWidget(node, name);
        if (!widget || !lists[name]) continue;
        widget.options.values = lists[name];
        // An empty folder left nothing to pick; the first file to arrive fills it in.
        if (widget.value == null && lists[name].length) widget.value = lists[name][0];
    }
    node.setDirtyCanvas(true, false);
}

function apply(next) {
    lists = next;
    const graphs = [app.graph, ...(app.graph?.subgraphs?.values?.() ?? [])];
    for (const graph of graphs) (graph?.nodes ?? []).forEach(updateNode);
}

async function fetchLists() {
    try {
        apply(await (await api.fetchApi("/mbnodes/model_lists")).json());
    } catch (e) {
        console.warn("[MBNodes] model lists not loaded", e);
    }
}

app.registerExtension({
    name: "MBNodes.ModelWatch",

    async setup() {
        api.addEventListener("mbnodes.model_lists", ({ detail }) => apply(detail));
        // Catches anything added while the page was closed or the server was down.
        api.addEventListener("reconnected", fetchLists);
        await fetchLists();
    },

    // Node definitions are read once at page load, so new nodes start with old lists.
    async nodeCreated(node) {
        updateNode(node);
    },
});
