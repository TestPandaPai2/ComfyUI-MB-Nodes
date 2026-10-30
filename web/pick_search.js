import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// Search box + favorites for the pack's picker nodes. Frontend only: search
// narrows the pick combos to matching values and favorites are sorted to the
// top, so every value the backend sees is still one it declared.
// Pick combos per node class; null means every combo on the node except `skip`.
const TARGETS = {
    MBNodesBackgroundRandomizer: ["background"],
    MBNodesBodyconRandomizer: ["category"],
    MBNodesDressRandomizer: ["category"],
    MBNodesHairstyleRandomizer: ["style"],
    MBNodesHeelRandomizer: ["heel"],
    MBNodesHighHeelsRandomizer: ["category"],
    MBNodesSareeRandomizer: ["category"],
    MBNodesAccessoriesSelector: null,
    MBNodesEthnicitySelector: ["ethnicity"],
    MBNodesExpressionSelector: ["expression"],
    MBNodesPoseSelector: ["pose"],
    MBNodesWardrobeSelector: ["style"],
    MBNodesWildcardSelect: ["wildcard"],
    MBNodesBodyType: ["body_type"],
    MBNodesBodyModPrompt: ["types"],
    MBNodesCameraAnglePrompt: ["angle"],
    MBNodesLightingEnhancePrompt: ["types"],
    MBNodesMakeupModPrompt: ["types"],
    MBNodesSimpleStandingPoses: ["pose"],
    MBNodesStyleModifier: ["style"],
};
const SKIP = new Set(["metal"]);

const FAV_FILE = "mbnodes_favorites.json";

// { nodeClass: [value, ...] }, kept in the ComfyUI user folder.
let FAVS = {};

const READY = api
    .getUserData(FAV_FILE)
    .then((response) => (response.ok ? response.json() : {}))
    .then((data) => (FAVS = data))
    .catch((e) => console.error("[MBNodes] favorites load failed", e));

// DynamicCombo children are named after their parent, so match the tail.
function isTarget(node, widget) {
    if (widget.type !== "combo" || !Array.isArray(widget.options?.values)) return false;
    const names = TARGETS[node.comfyClass];
    if (names === null) return !SKIP.has(widget.name);
    return names.some((n) => widget.name === n || widget.name.endsWith("." + n));
}

function targets(node) {
    return (node.widgets ?? []).filter((w) => isTarget(node, w));
}

// The full option list is cached on the widget itself; a DynamicCombo swaps in
// fresh child widgets on category change, which drops the cache with them.
function refresh(node) {
    const query = (node.widgets?.find((w) => w.name === "search")?.value ?? "").trim().toLowerCase();
    const favs = FAVS[node.comfyClass] ?? [];
    for (const widget of targets(node)) {
        widget._mbAll ??= [...widget.options.values];
        let values = widget._mbAll.filter((v) => String(v).toLowerCase().includes(query));
        if (!values.length) continue;
        values = [...values.filter((v) => favs.includes(v)), ...values.filter((v) => !favs.includes(v))];
        widget.options = { ...widget.options, values };
        if (query && !values.includes(widget.value)) widget.value = values[0];
    }
    node.setDirtyCanvas(true, true);
}

async function toggleFavorite(nodeClass, value) {
    const favs = FAVS[nodeClass] ?? [];
    FAVS[nodeClass] = favs.includes(value) ? favs.filter((v) => v !== value) : [...favs, value];
    await api.storeUserData(FAV_FILE, FAVS);
    for (const node of app.graph._nodes) {
        if (node.comfyClass === nodeClass) refresh(node);
    }
}

app.registerExtension({
    name: "MBNodes.PickSearch",

    async setup() {
        await READY;
    },

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (!(nodeData.name in TARGETS)) return;

        const prevMenu = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
            prevMenu?.apply(this, arguments);
            const favs = FAVS[this.comfyClass] ?? [];
            const entries = targets(this).map((w) => ({
                content: favs.includes(w.value) ? `☆ Remove "${w.value}" from favorites` : `★ Add "${w.value}" to favorites`,
                callback: () => toggleFavorite(this.comfyClass, w.value),
            }));
            if (entries.length) options.push(null, ...entries);
        };

        // Category changes on DynamicCombo nodes rebuild the child combo, so
        // re-run the filter after the frontend has swapped it in.
        const prevChanged = nodeType.prototype.onWidgetChanged;
        nodeType.prototype.onWidgetChanged = function (name, ...rest) {
            const r = prevChanged?.apply(this, [name, ...rest]);
            if (name === "category" && TARGETS[this.comfyClass]?.includes("category") === false) {
                requestAnimationFrame(() => refresh(this));
            }
            return r;
        };
    },

    nodeCreated(node) {
        if (!(node.comfyClass in TARGETS)) return;
        const search = node.addWidget("text", "search", "", () => refresh(node));
        search.serialize = false;
        READY.then(() => refresh(node));
    },

    async loadedGraphNode(node) {
        if (!(node.comfyClass in TARGETS)) return;
        await READY;
        refresh(node);
    },
});
