import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// { ratios: [...], table: { ratio: [label, ...] } }, fetched once at load.
let DATA = { ratios: [], table: {} };

const READY = api
    .fetchApi("/mbnodes/resolutions")
    .then((response) => response.json())
    .then((data) => (DATA = data))
    .catch((e) => console.error("[MBNodes] resolution table fetch failed", e));

const COLS = 3;
const CELL_H = 22;
const GAP = 4;
const MARGIN = 14;

function getWidget(node, name) {
    return node.widgets?.find((w) => w.name === name);
}

function hideWidget(node, name) {
    const w = getWidget(node, name);
    if (!w || w.origType !== undefined) return;
    w.origType = w.type;
    w.origComputeSize = w.computeSize;
    w.type = "hidden";
    w.computeSize = () => [0, -4];
}

// Keep the resolution combo showing only the sizes that belong to the active
// ratio. Selection is preserved by index so stepping through ratios keeps a
// comparable size rather than snapping back to the smallest.
function applyRatio(node, ratio, keepValue) {
    const ratioWidget = getWidget(node, "aspect_ratio");
    const resWidget = getWidget(node, "resolution");
    if (!ratioWidget || !resWidget) return;

    const labels = DATA.table[ratio];
    if (!labels) return;

    const prevIndex = resWidget.options?.values?.indexOf(resWidget.value) ?? -1;
    ratioWidget.value = ratio;
    resWidget.options = { ...(resWidget.options ?? {}), values: labels };

    if (!(keepValue && labels.includes(resWidget.value))) {
        const index = prevIndex >= 0 ? Math.min(prevIndex, labels.length - 1) : 3;
        resWidget.value = labels[Math.min(index, labels.length - 1)];
    }
    node.setDirtyCanvas(true, true);
}

function gridRows() {
    return Math.ceil(DATA.ratios.length / COLS);
}

function cellRect(node, index, widgetY) {
    const usable = node.size[0] - MARGIN * 2;
    const cellW = (usable - GAP * (COLS - 1)) / COLS;
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    return [
        MARGIN + col * (cellW + GAP),
        widgetY + row * (CELL_H + GAP),
        cellW,
        CELL_H,
    ];
}

function makeGridWidget(node) {
    return {
        type: "mb_ratio_grid",
        name: "ratio_grid",
        // y is set by LiteGraph before draw() and reused by mouse() for hit tests.
        y: 0,
        options: { serialize: false },

        computeSize() {
            const rows = gridRows();
            return [node.size[0], rows * CELL_H + (rows - 1) * GAP + GAP];
        },

        draw(ctx, drawNode, widgetWidth, y, height) {
            this.y = y;
            const active = getWidget(drawNode, "aspect_ratio")?.value;

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "12px Arial";

            DATA.ratios.forEach((ratio, index) => {
                const [x, cy, w, h] = cellRect(drawNode, index, y);
                const selected = ratio === active;

                ctx.fillStyle = selected ? "#3f7cc6" : "#353535";
                ctx.strokeStyle = selected ? "#8ab4e8" : "#1a1a1a";
                ctx.beginPath();
                ctx.roundRect(x, cy, w, h, 5);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = selected ? "#ffffff" : "#c8c8c8";
                ctx.fillText(ratio, x + w / 2, cy + h / 2);
            });

            ctx.restore();
        },

        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            for (let index = 0; index < DATA.ratios.length; index++) {
                const [x, cy, w, h] = cellRect(mouseNode, index, this.y);
                if (pos[0] >= x && pos[0] <= x + w && pos[1] >= cy && pos[1] <= cy + h) {
                    applyRatio(mouseNode, DATA.ratios[index], false);
                    return true;
                }
            }
            return false;
        },
    };
}

function wireNode(node) {
    if (!DATA.ratios.length) return;

    hideWidget(node, "aspect_ratio");

    const grid = makeGridWidget(node);
    node.addCustomWidget(grid);
    // addCustomWidget appends; move the grid above the resolution combo.
    node.widgets.splice(node.widgets.indexOf(grid), 1);
    node.widgets.unshift(grid);

    const ratio = getWidget(node, "aspect_ratio")?.value ?? DATA.ratios[0];
    applyRatio(node, ratio, true);

    const size = node.computeSize();
    node.setSize([Math.max(node.size[0], size[0]), Math.max(node.size[1], size[1])]);
}

app.registerExtension({
    name: "MBNodes.Resolution",

    async setup() {
        await READY;
    },

    async nodeCreated(node) {
        if (node.comfyClass !== "MBResolution") return;
        await READY;
        wireNode(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBResolution") return;
        await READY;
        const ratio = getWidget(node, "aspect_ratio")?.value;
        if (ratio) applyRatio(node, ratio, true);
    },
});
