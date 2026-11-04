// Replace Text Advanced (MB): find/replace pairs as side-by-side text boxes.
// Native widgets always stack, so these boxes write to hidden string widgets.

import { app } from "../../scripts/app.js";
import { getWidget, resizeToContent, setWidgetVisible } from "./common.js";

const NODE_CLASS = "MBReplaceTextAdvanced";
const PAIRS = 4; // must match SLOTS in nodes/replace_text_advanced_node.py
const MIN_WIDTH = 460;
const MIN_HEIGHT = 280;

const FIELDS = [];
for (let n = 1; n <= PAIRS; n++) {
    FIELDS.push([`find_${n}`, `Text To Replace ${n}`], [`replace_${n}`, `Replaced Text ${n}`]);
}

function wireNode(node) {
    const hideAll = () => FIELDS.forEach(([name]) => setWidgetVisible(node, name, false));
    hideAll();

    const root = document.createElement("div");
    root.style.cssText = "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));"
        + `grid-template-rows:repeat(${PAIRS},minmax(0,1fr));gap:6px;width:100%;height:100%;box-sizing:border-box`;

    const boxes = FIELDS.map(([name, label]) => {
        const box = document.createElement("textarea");
        box.placeholder = label;
        box.title = label;
        box.spellcheck = false;
        box.style.cssText = "box-sizing:border-box;width:100%;height:100%;resize:none;padding:4px 6px;"
            + "font-size:12px;border-radius:4px;border:1px solid var(--border-color,#555);"
            + "background:var(--comfy-input-bg,#222);color:var(--input-text,#ddd)";
        box.addEventListener("input", () => {
            const widget = getWidget(node, name);
            if (widget) widget.value = box.value;
        });
        root.appendChild(box);
        return [name, box];
    });

    const refresh = () => {
        for (const [name, box] of boxes) box.value = getWidget(node, name)?.value ?? "";
    };

    node.addDOMWidget("mb_replace_pairs", "mb_replace_pairs", root, {
        serialize: false,
        hideOnZoom: false,
        getMinHeight: () => MIN_HEIGHT,
    });

    const onConfigure = node.onConfigure;
    node.onConfigure = function (...args) {
        const result = onConfigure?.apply(this, args);
        hideAll();
        refresh();
        return result;
    };

    refresh();
    resizeToContent(node);
    node.setSize([Math.max(node.size[0], MIN_WIDTH), node.size[1]]);
}

app.registerExtension({
    name: "MBNodes.ReplaceTextAdvanced",

    async nodeCreated(node) {
        if (node.comfyClass === NODE_CLASS) wireNode(node);
    },
});
