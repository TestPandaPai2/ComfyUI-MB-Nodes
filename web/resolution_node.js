import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible } from "./common.js";

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

function hideWidget(node, name) {
    setWidgetVisible(node, name, false);
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
    node.__mbRatioGrid?.triggerDraw?.();
    node.setDirtyCanvas(true, true);
}

function gridRows() {
    return Math.ceil(DATA.ratios.length / COLS);
}

// Laid out against the width handed to draw(), not node.size: under Nodes 2.0
// each custom widget is drawn onto its own canvas that is only as wide as the
// widget, so node width would overshoot it and the cells would miss the pointer.
function cellRect(width, index, widgetY) {
    const usable = width - MARGIN * 2;
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
        // y and width are recorded by draw() and reused by mouse() for hit tests,
        // so the two agree in either renderer.
        y: 0,
        width: 0,
        // The serializer checks widget.serialize, not options.serialize.
        serialize: false,
        options: { serialize: false },

        computeSize() {
            const rows = gridRows();
            return [node.size[0], rows * CELL_H + (rows - 1) * GAP + GAP];
        },

        draw(ctx, drawNode, widgetWidth, y, height) {
            this.y = y;
            this.width = widgetWidth || node.size[0];
            const active = getWidget(drawNode, "aspect_ratio")?.value;

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "12px Arial";

            DATA.ratios.forEach((ratio, index) => {
                const [x, cy, w, h] = cellRect(this.width, index, y);
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
                const [x, cy, w, h] = cellRect(this.width || mouseNode.size[0], index, this.y);
                if (pos[0] >= x && pos[0] <= x + w && pos[1] >= cy && pos[1] <= cy + h) {
                    applyRatio(mouseNode, DATA.ratios[index], false);
                    // Under Nodes 2.0 the widget owns its own canvas and only
                    // repaints when asked; setDirtyCanvas alone is not enough.
                    this.triggerDraw?.();
                    return true;
                }
            }
            return false;
        },
    };
}

// Must run synchronously from nodeCreated. A workflow restores widget values by
// position, so the grid has to already sit at index 0 when that happens — if it
// were added later (after the ratio table arrives) every saved value would land
// one widget too early and batch_size would be left undefined.
function wireNode(node) {
    hideWidget(node, "aspect_ratio");

    const grid = makeGridWidget(node);
    node.__mbRatioGrid = grid;
    node.addCustomWidget(grid);
    // addCustomWidget appends; move the grid above the resolution combo.
    node.widgets.splice(node.widgets.indexOf(grid), 1);
    node.widgets.unshift(grid);
}

// Widget values a previous version of this node scrambled on load: portrait held
// a resolution label, batch_size held a boolean or nothing at all.
function repairValues(node) {
    const portrait = getWidget(node, "portrait");
    if (portrait && typeof portrait.value !== "boolean") {
        portrait.value = portrait.value === "true" || portrait.value === 1;
    }

    const batch = getWidget(node, "batch_size");
    if (batch) {
        const value = Math.round(Number(batch.value));
        if (!Number.isFinite(value) || value < 1) batch.value = 1;
        else batch.value = value;
    }

    const ratio = getWidget(node, "aspect_ratio");
    if (ratio && !DATA.table[ratio.value]) ratio.value = DATA.ratios[0];
}

function fitNode(node) {
    const size = node.computeSize();
    node.setSize([Math.max(node.size[0], size[0]), Math.max(node.size[1], size[1])]);
    node.setDirtyCanvas(true, true);
}

// Everything that needs the ratio table, run once it has arrived.
function applyTable(node) {
    if (!DATA.ratios.length) return;
    repairValues(node);
    applyRatio(node, getWidget(node, "aspect_ratio")?.value ?? DATA.ratios[0], true);
    fitNode(node);
}

app.registerExtension({
    name: "MBNodes.Resolution",

    async setup() {
        await READY;
    },

    nodeCreated(node) {
        if (node.comfyClass !== "MBResolution") return;
        wireNode(node); // synchronous: keeps the widget indices stable
        READY.then(() => applyTable(node));
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBResolution") return;
        await READY;
        applyTable(node);
    },
});
