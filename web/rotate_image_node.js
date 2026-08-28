// The three rotation toggles on MBRotateImage act like radio buttons: turning
// one on clears the other two, so the node never carries a contradictory pair.
// (Python resolves a contradiction too, for API calls that skip the frontend.)

import { app } from "../../scripts/app.js";
import { getWidget } from "./common.js";

const ROTATIONS = ["rotate_90", "rotate_180", "rotate_270"];

function makeExclusive(node, name) {
    const widget = getWidget(node, name);
    if (!widget) return;

    const onCallback = widget.callback;
    widget.callback = function (value) {
        const result = onCallback?.apply(this, arguments);
        if (value) {
            for (const other of ROTATIONS) {
                if (other === name) continue;
                const w = getWidget(node, other);
                if (w) w.value = false;
            }
            node.setDirtyCanvas(true, true);
        }
        return result;
    };
}

app.registerExtension({
    name: "MBNodes.RotateImage",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBRotateImage") return;
        for (const name of ROTATIONS) makeExclusive(node, name);
    },
});
