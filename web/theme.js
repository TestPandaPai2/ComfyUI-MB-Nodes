import { app } from "../../scripts/app.js";

// Pack-wide look: red title bar, near-black body.
const TITLE_COLOR = "#e01010";
const BODY_COLOR = "#0d0d0d";

function isMBNode(nodeData) {
    return nodeData?.category === "MBNodes" || /^MB[A-Z]/.test(nodeData?.name ?? "");
}

app.registerExtension({
    name: "MBNodes.Theme",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (!isMBNode(nodeData)) return;
        // Set on the prototype so every instance inherits it; a user recolouring a
        // node writes an own property that shadows this and survives save/load.
        nodeType.prototype.color = TITLE_COLOR;
        nodeType.prototype.bgcolor = BODY_COLOR;
    },
});
