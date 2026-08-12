import { app } from "../../scripts/app.js";
import { getWidget, setWidgetVisible, resizeToContent } from "./common.js";

function audioConnected(node) {
    const slot = node.inputs?.find((i) => i.name === "audio");
    return !!slot && slot.link !== null && slot.link !== undefined;
}

function refresh(node) {
    const preview = getWidget(node, "preview_only")?.value === true;

    let changed = false;
    // Preview encodes to the temp folder, so the save target is meaningless.
    for (const name of ["filename_prefix", "output_folder"]) {
        changed = setWidgetVisible(node, name, !preview) || changed;
    }
    changed = setWidgetVisible(node, "trim_to_audio", audioConnected(node)) || changed;

    if (changed) resizeToContent(node);
}

function wireNode(node) {
    const prevOnConnectionsChange = node.onConnectionsChange;
    node.onConnectionsChange = function (type, slotIndex, connected, link, ioSlot) {
        prevOnConnectionsChange?.apply(this, arguments);
        if (type === 1) refresh(this); // 1 = LiteGraph.INPUT
    };

    const w = getWidget(node, "preview_only");
    if (w) {
        const prev = w.callback;
        w.callback = function (...args) {
            const r = prev?.apply(this, args);
            refresh(node);
            return r;
        };
    }

    refresh(node);
}

app.registerExtension({
    name: "MBNodes.SaveMP4",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBSaveMP4") return;
        wireNode(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBSaveMP4") return;
        setTimeout(() => refresh(node), 40);
    },
});
