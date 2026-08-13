import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible, resizeToContent } from "./common.js";

// Widgets that only matter for one format, so the node stays readable.
const FORMAT_WIDGETS = {
    png: ["png_compress_level"],
    jpg: ["quality"],
    webp: ["quality", "webp_lossless"],
};
const OPTIONAL = ["quality", "png_compress_level", "webp_lossless"];

function refresh(node) {
    const format = getWidget(node, "format")?.value ?? "png";
    const mode = getWidget(node, "mode")?.value ?? "save";
    const shown = new Set(FORMAT_WIDGETS[format] ?? []);

    let changed = false;
    for (const name of OPTIONAL) {
        changed = setWidgetVisible(node, name, shown.has(name)) || changed;
    }
    // Nothing is written to the save folder in preview mode.
    for (const name of ["filename_prefix", "output_folder"]) {
        changed = setWidgetVisible(node, name, mode !== "preview") || changed;
    }

    if (changed) resizeToContent(node);
}

// The node output store keeps two copies of every result: app.nodeOutputs, which
// the canvas renderer reads, and a reactive one that Nodes 2.0 renders from.
// Writing app.nodeOutputs directly only fills the first, so the images are fed
// in through the same "executed" event the backend uses, which fills both.
function publishOutputs(node, images) {
    const id = String(node.id);
    api.dispatchEvent(
        new CustomEvent("executed", {
            detail: { node: id, display_node: id, output: { images } },
        })
    );
}

// After a restart there is no execution history, so the node asks the backend
// for the half-size copy it cached in output/MBNodesCache the last time it ran.
async function restorePreview(node) {
    if (node.imgs?.length) return;

    const workflowId = app.graph?.id ?? "default";
    const query = `workflow_id=${encodeURIComponent(workflowId)}&node_id=${encodeURIComponent(node.id)}`;

    try {
        const response = await api.fetchApi(`/mbnodes/preview_cache?${query}`);
        const data = await response.json();
        if (!data.images?.length || node.imgs?.length) return;

        publishOutputs(node, data.images);
        node.setDirtyCanvas(true, true);
    } catch (e) {
        console.error("[MBNodes] preview cache restore failed", e);
    }
}

function wireNode(node) {
    for (const name of ["format", "mode"]) {
        const w = getWidget(node, name);
        if (!w) continue;
        const prev = w.callback;
        w.callback = function (...args) {
            const r = prev?.apply(this, args);
            refresh(node);
            return r;
        };
    }
    refresh(node);
}

app.registerExtension({
    name: "MBNodes.SaveImage",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBSaveImage") return;
        wireNode(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBSaveImage") return;
        setTimeout(() => {
            refresh(node);
            restorePreview(node);
        }, 60);
    },
});
