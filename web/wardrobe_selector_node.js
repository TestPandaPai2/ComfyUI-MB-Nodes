// Shows the Wardrobe Selector's randomizer booleans as a grid of toggle
// buttons. The boolean widgets stay (hidden) and hold the values, so saved
// workflows load unchanged.

import { app } from "../../scripts/app.js";
import { getWidget, setWidgetVisible, resizeToContent } from "./common.js";

const TOGGLES = [
    ["random_category", "Category"],
    ["random_style", "Style"],
    ["mix_outfit", "Mix outfit"],
    ["random_color", "Color"],
    ["random_metallic", "Metallic"],
    ["random_pattern", "Pattern"],
];
const HEIGHT = 92;

const STYLE_ID = "mb-toggle-grid-style";
const STYLE = `
.mb-toggle-grid { display: flex; flex-direction: column; gap: 5px; padding: 2px 0; box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.mb-toggle-grid-title { font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--descrip-text); padding-left: 4px; }
.mb-toggle-grid-cells { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
.mb-toggle {
    height: 26px; border: 1px solid var(--border-color); border-radius: 8px; padding: 0 6px;
    background: var(--comfy-input-bg); color: var(--descrip-text); font-size: 12px; cursor: pointer;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mb-toggle:hover { border-color: var(--mb-accent, #d4537e); color: var(--input-text); }
.mb-toggle.mb-on { background: var(--mb-accent, #d4537e); border-color: var(--mb-accent, #d4537e); color: #ffffff; }
`;

function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
}

app.registerExtension({
    name: "MBNodes.WardrobeSelector",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBNodesWardrobeSelector") return;
        injectStyle();

        const root = document.createElement("div");
        root.className = "mb-toggle-grid";
        const title = document.createElement("div");
        title.className = "mb-toggle-grid-title";
        title.textContent = "Randomize";
        const cells = document.createElement("div");
        cells.className = "mb-toggle-grid-cells";
        root.append(title, cells);

        const buttons = [];
        for (const [name, label] of TOGGLES) {
            const widget = getWidget(node, name);
            if (!widget) continue;
            widget.mbAlwaysHidden = true; // mini mode must not bring it back
            setWidgetVisible(node, name, false);
            const button = document.createElement("button");
            button.className = "mb-toggle";
            button.textContent = label;
            button.title = widget.options?.tooltip ?? name;
            button.addEventListener("click", () => {
                widget.value = !widget.value;
                widget.callback?.(widget.value);
                sync();
                node.setDirtyCanvas(true, true);
            });
            buttons.push([button, widget]);
            cells.appendChild(button);
        }
        const sync = () => {
            for (const [button, widget] of buttons) button.classList.toggle("mb-on", !!widget.value);
        };

        const grid = node.addDOMWidget("randomize", "toggle_grid", root, { serialize: false, hideOnZoom: false });
        grid.computeSize = (width) => [width, HEIGHT];
        // Sit where the booleans were, not after seed and weight.
        node.widgets.splice(node.widgets.indexOf(grid), 1);
        const first = node.widgets.findIndex((w) => w.name === TOGGLES[0][0]);
        node.widgets.splice(first < 0 ? node.widgets.length : first, 0, grid);

        const onConfigure = node.onConfigure;
        node.onConfigure = function (...args) {
            const result = onConfigure?.apply(this, args);
            sync();
            return result;
        };
        sync();
        resizeToContent(node);
    },
});
