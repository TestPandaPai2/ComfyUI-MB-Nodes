// Mini mode for the randomizer and selector nodes: a `mini` switch that hides
// everything except the category dropdown (always the node's first widget),
// the DynamicCombo widgets it spawns ("category.style" and the like) and the
// switch itself. Those children are rebuilt whenever the category changes, so
// they are matched by name prefix rather than tracked, and a rebuilt one is
// born visible. The switch is frontend-only: its value lives in
// properties.mbMini, never in the prompt.

import { app } from "../../scripts/app.js";
import { setWidgetVisible, resizeToContent } from "./common.js";

const MINI_NODES = new Set([
    "MBNodesBackgroundRandomizer",
    "MBNodesBodyconRandomizer",
    "MBNodesDressRandomizer",
    "MBNodesHairstyleRandomizer",
    "MBNodesHeelRandomizer",
    "MBNodesHighHeelsRandomizer",
    "MBNodesSareeRandomizer",
    "MBNodesEthnicitySelector",
    "MBNodesExpressionSelector",
    "MBNodesPoseSelector",
    "MBNodesWardrobeSelector",
]);

const SWITCH = "mini";

function applyMini(node) {
    const root = node.widgets?.[0]?.name;
    if (!root) return;
    const mini = !!node.properties.mbMini;
    let changed = false;
    for (const w of node.widgets) {
        const keep = w.name === root || w.name.startsWith(`${root}.`) || w.name === SWITCH;
        changed = setWidgetVisible(node, w.name, keep || !mini) || changed;
    }
    if (changed) resizeToContent(node);
}

app.registerExtension({
    name: "MBNodes.MiniMode",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (!MINI_NODES.has(nodeData.name)) return;

        // Saved properties land after nodeCreated; wait for the DynamicCombo
        // to rebuild its children from the restored category first.
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = onConfigure?.apply(this, arguments);
            const toggle = this.widgets?.find((w) => w.name === SWITCH);
            if (toggle) toggle.value = !!this.properties.mbMini;
            setTimeout(() => applyMini(this), 0);
            return r;
        };
    },

    nodeCreated(node) {
        if (!MINI_NODES.has(node.comfyClass)) return;
        const toggle = node.addWidget("toggle", SWITCH, !!node.properties.mbMini, (value) => {
            node.properties.mbMini = !!value;
            applyMini(node);
        });
        toggle.serialize = false; // kept in properties so it never reaches the backend
        resizeToContent(node);
    },
});
