// Shows the traced SVG inside MBImageToSVG after a run. The backend sends the
// SVG text as message.svg and, when saving, each file's path as message.saved.
// With a batch, clicking the preview steps through it.

import { app } from "../../scripts/app.js";

function render(state) {
    const { svgs, saved, index, img, label } = state;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgs[index])}`;
    const parts = [];
    if (svgs.length > 1) parts.push(`${index + 1} / ${svgs.length}  (click for next)`);
    if (saved[index]) parts.push(saved[index]);
    label.textContent = parts.join("  ·  ");
}

function ensurePreview(node) {
    if (node.mbSvgPreview) return node.mbSvgPreview;

    const root = document.createElement("div");
    root.style.cssText = "display:flex;flex-direction:column;width:100%;height:100%;min-height:120px;";
    const frame = document.createElement("div");
    frame.style.cssText =
        "flex:1;min-height:0;display:flex;align-items:center;justify-content:center;cursor:pointer;" +
        "background:repeating-conic-gradient(#8884 0% 25%, transparent 0% 50%) 50% / 16px 16px;";
    const img = document.createElement("img");
    img.style.cssText = "max-width:100%;max-height:100%;object-fit:contain;";
    const label = document.createElement("div");
    label.style.cssText = "font-size:11px;opacity:0.7;text-align:center;";
    frame.appendChild(img);
    root.append(frame, label);

    const state = { svgs: [], saved: [], index: 0, img, label };
    frame.addEventListener("click", () => {
        if (state.svgs.length < 2) return;
        state.index = (state.index + 1) % state.svgs.length;
        render(state);
    });

    const widget = node.addDOMWidget("svg_preview", "preview", root, { serialize: false, hideOnZoom: false });
    widget.computeSize = (width) => [width, 220];
    node.mbSvgPreview = state;
    return state;
}

app.registerExtension({
    name: "MBNodes.ImageToSVG",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "MBImageToSVG") return;

        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            onExecuted?.apply(this, arguments);
            const svgs = message?.svg;
            if (!svgs?.length) return;

            const state = ensurePreview(this);
            state.svgs = svgs;
            state.saved = message.saved ?? [];
            state.index = 0;
            render(state);
            this.setSize([this.size[0], Math.max(this.size[1], this.computeSize()[1])]);
            this.setDirtyCanvas(true, true);
        };
    },
});
