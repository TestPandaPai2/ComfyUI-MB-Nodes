import { app } from "../../scripts/app.js";

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

function getWidget(node, name) {
    return node.widgets?.find((w) => w.name === name);
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
// swapped between its real type and "hidden" instead of being removed (removal
// would lose the value on save/load).
function setPriorityVisible(node, visible) {
    const w = getWidget(node, "priority");
    if (!w) return;

    if (visible) {
        if (w.origType === undefined) return; // already visible
        w.type = w.origType;
        w.computeSize = w.origComputeSize;
        delete w.origType;
        delete w.origComputeSize;
    } else {
        if (w.origType !== undefined) return; // already hidden
        w.origType = w.type;
        w.origComputeSize = w.computeSize;
        w.type = "hidden";
        w.computeSize = () => [0, -4];
    }

    const size = node.computeSize();
    node.setSize([Math.max(node.size[0], size[0]), size[1]]);
    node.setDirtyCanvas(true, true);
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

    node.addWidget("button", "Paste (append)", null, async () => {
        const clip = await readClipboard();
        if (clip === null) return;
        if (!clip) {
            notify("warn", "Clipboard empty", "Nothing to paste.");
            return;
        }
        const current = textWidget.value ?? "";
        commit(node, textWidget, current ? current + separatorOf(node) + clip : clip);
    });

    node.addWidget("button", "Replace", null, async () => {
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
