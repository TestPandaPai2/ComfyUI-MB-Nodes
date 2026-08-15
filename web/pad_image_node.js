import { app } from "../../scripts/app.js";
import { getWidget, setWidgetVisible, resizeToContent } from "./common.js";

// Widgets that only matter for one mode, so the node stays readable.
const PIXEL_WIDGETS = ["top", "bottom", "left", "right"];
const RATIO_WIDGETS = ["aspect_ratio", "portrait"];

function refresh(node) {
    const ratioMode = getWidget(node, "mode")?.value === "aspect ratio";

    let changed = false;
    for (const name of PIXEL_WIDGETS) {
        changed = setWidgetVisible(node, name, !ratioMode) || changed;
    }
    for (const name of RATIO_WIDGETS) {
        changed = setWidgetVisible(node, name, ratioMode) || changed;
    }

    if (changed) resizeToContent(node);
}

function wireNode(node) {
    const mode = getWidget(node, "mode");
    if (!mode) return;

    const prev = mode.callback;
    mode.callback = function (...args) {
        const r = prev?.apply(this, args);
        refresh(node);
        return r;
    };
    refresh(node);
}

app.registerExtension({
    name: "MBNodes.PadImage",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBPadImage") return;
        wireNode(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBPadImage") return;
        setTimeout(() => refresh(node), 60);
    },
});
