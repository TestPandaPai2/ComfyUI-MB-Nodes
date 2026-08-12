import { app } from "../../scripts/app.js";
import { addButton, getWidget, setWidgetVisible, resizeToContent } from "./common.js";

const SEPARATORS = { newline: "\n", comma: ", ", space: " ", none: "" };

function notify(severity, summary, detail) {
    const toast = app.extensionManager?.toast;
    if (toast) toast.add({ severity, summary, detail, life: 4000 });
    else console.log(`[MBNodes] ${summary}: ${detail ?? ""}`);
}

async function readClipboard() {
    if (!navigator.clipboard?.readText) {
        notify("error", "Clipboard unavailable",
            "This browser blocks clipboard reads. Use Chrome/Edge over localhost or https.");
        return null;
    }
    try {
        return await navigator.clipboard.readText();
    } catch (e) {
        notify("error", "Clipboard read failed", e?.message ?? String(e));
        return null;
    }
}

function commit(node, widget, value) {
    widget.value = value;
    // Keep the DOM textarea in sync — its input event is what normally writes .value
    if (widget.inputEl && widget.inputEl.value !== value) widget.inputEl.value = value;
    node.setDirtyCanvas(true, true);
}

function separatorOf(node) {
    const w = getWidget(node, "separator");
    return SEPARATORS[w?.value] ?? "\n";
}

// The priority widget only makes sense while text_in is connected, so it is
// hidden rather than removed (removal would lose the value on save/load).
function setPriorityVisible(node, visible) {
    if (setWidgetVisible(node, "priority", visible)) resizeToContent(node);
}

function textInConnected(node) {
    const slot = node.inputs?.find((i) => i.name === "text_in");
    return !!slot && slot.link !== null && slot.link !== undefined;
}

function refresh(node) {
    setPriorityVisible(node, textInConnected(node));
}

function wireNode(node) {
    const prevOnConnectionsChange = node.onConnectionsChange;
    node.onConnectionsChange = function (type, slotIndex, connected, link, ioSlot) {
        prevOnConnectionsChange?.apply(this, arguments);
        if (type === 1) refresh(this); // 1 = LiteGraph.INPUT
    };

    const textWidget = getWidget(node, "text");
    if (!textWidget) return;

    addButton(node, "Paste (append)", async () => {
        const clip = await readClipboard();
        if (clip === null) return;
        if (!clip) {
            notify("warn", "Clipboard empty", "Nothing to paste.");
            return;
        }
        const current = textWidget.value ?? "";
        commit(node, textWidget, current ? current + separatorOf(node) + clip : clip);
    });

    addButton(node, "Replace", async () => {
        const clip = await readClipboard();
        if (clip === null) return;
        commit(node, textWidget, clip);
    });
}

app.registerExtension({
    name: "MBNodes.Text",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBText") return;
        wireNode(node);
        setTimeout(() => refresh(node), 40);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBText") return;
        setTimeout(() => refresh(node), 40);
    },
});
