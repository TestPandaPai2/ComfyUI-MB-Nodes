import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, resizeToContent } from "./common.js";

// { categories: [...], table: { category: [styleName, ...] } }, fetched once.
let DATA = { categories: [], table: {} };

const READY = api
    .fetchApi("/mbnodes/krea2_styles")
    .then((response) => response.json())
    .then((data) => (DATA = data))
    .catch((e) => console.error("[MBNodes] krea2 styles fetch failed", e));

// Keep the sub_style combo showing only the styles that belong to the active
// category. Selection is preserved by index so stepping through categories
// keeps a comparable position rather than snapping back to the first style.
function applyCategory(node, category, keepValue) {
    const catWidget = getWidget(node, "category");
    const styleWidget = getWidget(node, "sub_style");
    if (!catWidget || !styleWidget) return;

    const names = DATA.table[category];
    if (!names) return;

    const prevIndex = styleWidget.options?.values?.indexOf(styleWidget.value) ?? -1;
    catWidget.value = category;
    styleWidget.options = { ...(styleWidget.options ?? {}), values: names };

    if (!(keepValue && names.includes(styleWidget.value))) {
        const index = prevIndex >= 0 ? Math.min(prevIndex, names.length - 1) : 0;
        styleWidget.value = names[Math.max(0, index)];
    }
    node.setDirtyCanvas(true, true);
}

function wireNode(node) {
    const category = getWidget(node, "category");
    if (!category) return;

    const prev = category.callback;
    category.callback = function (value, ...rest) {
        const r = prev?.apply(this, [value, ...rest]);
        applyCategory(node, value ?? this.value, false);
        return r;
    };
}

function applyTable(node) {
    if (!DATA.categories.length) return;
    applyCategory(node, getWidget(node, "category")?.value ?? DATA.categories[0], true);
    resizeToContent(node);
}

app.registerExtension({
    name: "MBNodes.Krea2Styles",

    async setup() {
        await READY;
    },

    nodeCreated(node) {
        if (node.comfyClass !== "MBNodesKrea2Styles") return;
        wireNode(node);
        READY.then(() => applyTable(node));
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBNodesKrea2Styles") return;
        await READY;
        applyTable(node);
    },
});
