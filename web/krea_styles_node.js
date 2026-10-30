import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, resizeToContent } from "./common.js";

const FAVORITES = "★ Favorites";

// { categories: [...], table: { category: [styleName, ...] }, favorites: [...] }, fetched once.
let DATA = { categories: [], table: {}, favorites: [] };

const READY = api
    .fetchApi("/mbnodes/krea2_styles")
    .then((response) => response.json())
    .then((data) => {
        DATA = data;
        DATA.table[FAVORITES] = data.favorites;
    })
    .catch((e) => console.error("[MBNodes] krea2 styles fetch failed", e));

// Keep the sub_style combo showing only the styles that belong to the active
// category. Selection is preserved by index so stepping through categories
// keeps a comparable position rather than snapping back to the first style.
function applyCategory(node, category, keepValue) {
    const catWidget = getWidget(node, "category");
    const styleWidget = getWidget(node, "sub_style");
    if (!catWidget || !styleWidget) return;

    const names = DATA.table[category];
    if (!names?.length) return;

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

async function toggleFavorite(name) {
    const response = await api.fetchApi("/mbnodes/krea2_styles/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    if (!response.ok) return;
    DATA.table[FAVORITES] = (await response.json()).favorites;
    for (const node of app.graph._nodes) {
        if (node.comfyClass === "MBNodesKrea2Styles" && getWidget(node, "category")?.value === FAVORITES) {
            applyCategory(node, FAVORITES, true);
        }
    }
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

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "MBNodesKrea2Styles") return;
        const prev = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
            prev?.apply(this, arguments);
            const name = getWidget(this, "sub_style")?.value;
            if (!name) return;
            const starred = DATA.table[FAVORITES]?.includes(name);
            options.push(null, {
                content: starred ? `☆ Remove "${name}" from favorites` : `★ Add "${name}" to favorites`,
                callback: () => toggleFavorite(name),
            });
        };
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
