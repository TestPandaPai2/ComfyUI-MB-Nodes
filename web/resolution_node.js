import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, resizeToContent } from "./common.js";

// { ratios: [...], table: { ratio: [label, ...] } }, fetched once at load.
let DATA = { ratios: [], table: {} };

const READY = api
    .fetchApi("/mbnodes/resolutions")
    .then((response) => response.json())
    .then((data) => (DATA = data))
    .catch((e) => console.error("[MBNodes] resolution table fetch failed", e));

// Keep the resolution combo showing only the sizes that belong to the active
// ratio. Selection is preserved by index so stepping through ratios keeps a
// comparable size rather than snapping back to the smallest.
function applyRatio(node, ratio, keepValue) {
    const ratioWidget = getWidget(node, "aspect_ratio");
    const resWidget = getWidget(node, "resolution");
    if (!ratioWidget || !resWidget) return;

    const labels = DATA.table[ratio];
    if (!labels) return;

    const prevIndex = resWidget.options?.values?.indexOf(resWidget.value) ?? -1;
    ratioWidget.value = ratio;
    resWidget.options = { ...(resWidget.options ?? {}), values: labels };

    if (!(keepValue && labels.includes(resWidget.value))) {
        const index = prevIndex >= 0 ? Math.min(prevIndex, labels.length - 1) : 3;
        resWidget.value = labels[Math.min(index, labels.length - 1)];
    }
    node.setDirtyCanvas(true, true);
}

function wireNode(node) {
    const ratio = getWidget(node, "aspect_ratio");
    if (!ratio) return;

    const prev = ratio.callback;
    ratio.callback = function (value, ...rest) {
        const r = prev?.apply(this, [value, ...rest]);
        applyRatio(node, value ?? this.value, false);
        return r;
    };
}

// Widget values a previous version of this node scrambled on load: portrait held
// a resolution label, batch_size held a boolean or nothing at all.
function repairValues(node) {
    const portrait = getWidget(node, "portrait");
    if (portrait && typeof portrait.value !== "boolean") {
        portrait.value = portrait.value === "true" || portrait.value === 1;
    }

    const batch = getWidget(node, "batch_size");
    if (batch) {
        const value = Math.round(Number(batch.value));
        if (!Number.isFinite(value) || value < 1) batch.value = 1;
        else batch.value = value;
    }

    const ratio = getWidget(node, "aspect_ratio");
    if (ratio && !DATA.table[ratio.value]) ratio.value = DATA.ratios[0];
}

// Everything that needs the ratio table, run once it has arrived.
function applyTable(node) {
    if (!DATA.ratios.length) return;
    repairValues(node);
    applyRatio(node, getWidget(node, "aspect_ratio")?.value ?? DATA.ratios[0], true);
    resizeToContent(node);
}

app.registerExtension({
    name: "MBNodes.Resolution",

    async setup() {
        await READY;
    },

    nodeCreated(node) {
        if (node.comfyClass !== "MBResolution") return;
        wireNode(node);
        READY.then(() => applyTable(node));
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBResolution") return;
        await READY;
        applyTable(node);
    },
});
