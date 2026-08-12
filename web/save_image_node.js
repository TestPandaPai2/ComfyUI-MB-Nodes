import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// Widgets that only matter for one format, so the node stays readable.
const FORMAT_WIDGETS = {
    png: ["png_compress_level"],
    jpg: ["quality"],
    webp: ["quality", "webp_lossless"],
};
const OPTIONAL = ["quality", "png_compress_level", "webp_lossless"];

function getWidget(node, name) {
    return node.widgets?.find((w) => w.name === name);
}

// Swapped to type "hidden" rather than removed, so the value survives save/load.
function setVisible(node, name, visible) {
    const w = getWidget(node, name);
    if (!w) return;

    if (visible) {
        if (w.origType === undefined) return;
        w.type = w.origType;
        w.computeSize = w.origComputeSize;
        delete w.origType;
        delete w.origComputeSize;
    } else {
        if (w.origType !== undefined) return;
        w.origType = w.type;
        w.origComputeSize = w.computeSize;
        w.type = "hidden";
        w.computeSize = () => [0, -4];
    }
}

function refresh(node) {
    const format = getWidget(node, "format")?.value ?? "png";
    const mode = getWidget(node, "mode")?.value ?? "save";
    const shown = new Set(FORMAT_WIDGETS[format] ?? []);

    for (const name of OPTIONAL) setVisible(node, name, shown.has(name));
    // Nothing is written to the save folder in preview mode.
    for (const name of ["filename_prefix", "output_folder"]) {
        setVisible(node, name, mode !== "preview");
    }

    const size = node.computeSize();
    node.setSize([Math.max(node.size[0], size[0]), size[1]]);
    node.setDirtyCanvas(true, true);
}

// After a restart there is no execution history, so the node asks the backend
// for the half-size copy it cached in output/MBNodesCache the last time it ran.
async function restorePreview(node) {
    if (node.imgs?.length) return;

    const workflowId = app.graph?.id ?? app.graph?.extra?.id ?? "default";
    const query = `workflow_id=${encodeURIComponent(workflowId)}&node_id=${encodeURIComponent(node.id)}`;

    try {
        const response = await api.fetchApi(`/mbnodes/preview_cache?${query}`);
        const data = await response.json();
        if (!data.images?.length || node.imgs?.length) return;

        node.images = data.images;
        if (app.nodeOutputs) app.nodeOutputs[node.id] = { images: data.images };
        node.setDirtyCanvas(true, true);
    } catch (e) {
        console.error("[MBNodes] preview cache fetch failed", e);
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
