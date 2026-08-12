import { app } from "../../scripts/app.js";

// Pack-wide look: red title bar, near-black body.
const TITLE_COLOR = "#e01010";
const BODY_COLOR = "#0d0d0d";

function isMBNode(node) {
    const category = node?.constructor?.nodeData?.category;
    return category === "MBNodes" || /^MB[A-Z]/.test(node?.comfyClass ?? "");
}

// LGraphNode declares `color` and `bgcolor` as class fields, so every instance
// gets its own undefined property — setting them on the prototype is shadowed
// and has no effect. They have to be written on the instance.
function applyTheme(node) {
    node.color = TITLE_COLOR;
    node.bgcolor = BODY_COLOR;
    node.setDirtyCanvas(true, true);
}

app.registerExtension({
    name: "MBNodes.Theme",

    async nodeCreated(node) {
        if (!isMBNode(node)) return;
        applyTheme(node);
    },

    async loadedGraphNode(node) {
        // Workflows saved before the theme existed carry no colour; a node the
        // user recoloured does, and that choice is left alone.
        if (!isMBNode(node) || node.color) return;
        applyTheme(node);
    },
});
