import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, resizeToContent } from "./common.js";

const NODE_CLASS = "MBNodesCivitaiInfo";

// { folders: [...], table: { folder: [fileName, ...] } }. Unlike the styles
// table this changes while ComfyUI runs — models get downloaded — so the fetch
// is redone whenever ComfyUI refreshes its combos.
let DATA = { folders: [], table: {} };

function fetchTable() {
    return api
        .fetchApi("/mbnodes/model_files")
        .then((response) => response.json())
        .then((data) => (DATA = data))
        .catch((e) => console.error("[MBNodes] model file list fetch failed", e));
}

let READY = fetchTable();

// Narrow the `model` combo to the files in the active folder. An empty folder
// still gets a placeholder so the widget never renders a blank dropdown.
function applyFolder(node, folder, keepValue) {
    const folderWidget = getWidget(node, "folder");
    const modelWidget = getWidget(node, "model");
    if (!folderWidget || !modelWidget) return;

    const names = DATA.table[folder];
    if (!names) return;

    folderWidget.value = folder;
    const values = names.length ? names : [""];
    modelWidget.options = { ...(modelWidget.options ?? {}), values };

    if (!(keepValue && values.includes(modelWidget.value))) {
        modelWidget.value = values[0];
    }
    node.setDirtyCanvas(true, true);
}

function wireNode(node) {
    const folder = getWidget(node, "folder");
    if (!folder) return;

    const prev = folder.callback;
    folder.callback = function (value, ...rest) {
        const r = prev?.apply(this, [value, ...rest]);
        applyFolder(node, value ?? this.value, false);
        return r;
    };
}

function applyTable(node) {
    if (!DATA.folders?.length) return;
    applyFolder(node, getWidget(node, "folder")?.value ?? DATA.folders[0], true);
    resizeToContent(node);
}

function nodesOfClass() {
    return app.graph?._nodes?.filter((n) => n.comfyClass === NODE_CLASS) ?? [];
}

app.registerExtension({
    name: "MBNodes.CivitaiInfo",

    async setup() {
        await READY;
    },

    nodeCreated(node) {
        if (node.comfyClass !== NODE_CLASS) return;
        wireNode(node);
        READY.then(() => applyTable(node));
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== NODE_CLASS) return;
        await READY;
        applyTable(node);
    },

    // ComfyUI's own "refresh node definitions" pass — pick up models added to
    // disk since the page loaded.
    async refreshComboInNodes() {
        READY = fetchTable();
        await READY;
        for (const node of nodesOfClass()) applyTable(node);
    },
});
