import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { accentColor, getWidget, setWidgetVisible } from "./common.js";

// { ratios: [...], values: { ratio: w/h }, table: { ratio: [label, ...] } },
// fetched once at load.
let DATA = { ratios: [], values: {}, table: {} };

const READY = api
    .fetchApi("/mbnodes/resolutions")
    .then((response) => response.json())
    .then((data) => (DATA = data))
    .catch((e) => console.error("[MBNodes] resolution table fetch failed", e));

const VALUE_WIDGETS = ["aspect_ratio", "resolution", "portrait", "batch_size"];
const MAX_BATCH = 4096;
const ONE_MP = 1024 * 1024;
const ONE_MP_TOLERANCE = 0.12; // |ln(area / 1 MP)| that still gets the dot
const OK_DOT = "#5dcaa5";

const RES_COLS = 3;
const MARGIN = 12;
const GAP = 4;
const LABEL_H = 16;
const CELL_H = 22;
const RES_H = 32;
const PREVIEW_H = 52;

// Keep the resolution combo showing only the sizes that belong to the active
// ratio. A size the ratio doesn't offer becomes its closest one by pixel count,
// so switching ratios (or loading an older table) keeps a comparable size.
function applyRatio(node, ratio) {
    const ratioWidget = getWidget(node, "aspect_ratio");
    const resWidget = getWidget(node, "resolution");
    if (!ratioWidget || !resWidget) return;

    const labels = DATA.table[ratio];
    if (!labels) return;

    ratioWidget.value = ratio;
    // Orientation follows the ratio: the sizes listed are already oriented.
    const portrait = getWidget(node, "portrait");
    if (portrait) portrait.value = DATA.values[ratio] < 1;
    resWidget.options = { ...(resWidget.options ?? {}), values: labels };

    if (!labels.includes(resWidget.value)) {
        const area = parseSize(resWidget.value).reduce((a, b) => a * b) || ONE_MP;
        const distance = (label) => Math.abs(Math.log(parseSize(label).reduce((a, b) => a * b) / area));
        resWidget.value = labels.reduce((best, label) => (distance(label) < distance(best) ? label : best));
    }
    refit(node);
}

function setValue(node, name, value) {
    const widget = getWidget(node, name);
    if (!widget) return;
    widget.value = value;
    widget.callback?.(value);
    node.setDirtyCanvas(true, true);
}

// A widget driven by a wire ignores its own value, so the grid shows it as
// linked and stops editing it.
const isLinked = (node, name) => node.inputs?.some((i) => i.name === name && i.link != null);

const parseSize = (label) => String(label).split(" x ").map(Number);
const megapixels = (w, h) => (w * h) / 1e6;
const nearOneMP = (w, h) => Math.abs(Math.log((w * h) / ONE_MP)) <= ONE_MP_TOLERANCE;

// The same ratio turned the other way (3:4 <-> 4:3); 1:1 is its own mirror.
const mirrorRatio = (ratio) => DATA.ratios.find((name) => Math.abs(DATA.values[name] * DATA.values[ratio] - 1) < 1e-6);

// Every clickable cell plus where the labels and preview go, top to bottom:
// ratios, orientation, resolutions, preview, batch. Laid out against the width
// handed to draw() rather than node.size: under Nodes 2.0 the widget owns a
// canvas only as wide as itself.
function layout(node, width, top) {
    const usable = width - MARGIN * 2;
    const cells = [];
    const labels = [];
    const colW = (cols) => (usable - GAP * (cols - 1)) / cols;
    const grid = (items, cols, h, y, make) => {
        items.forEach((item, i) => {
            const rect = [MARGIN + (i % cols) * (colW(cols) + GAP), y + Math.floor(i / cols) * (h + GAP), colW(cols), h];
            cells.push({ ...make(item), rect });
        });
        return y + Math.ceil(items.length / cols) * (h + GAP);
    };

    let y = top;
    labels.push({ text: "Aspect ratio", y });
    y += LABEL_H;
    y = grid([null], 1, CELL_H, y, () => ({ kind: "ratio" }));
    y = grid([false, true], 2, CELL_H, y, (value) => ({ kind: "portrait", value }));

    labels.push({ text: "Resolution", y, dot: true });
    y += LABEL_H;
    const sizes = DATA.table[getWidget(node, "aspect_ratio")?.value] ?? [];
    y = grid(sizes, RES_COLS, RES_H, y, (value) => ({ kind: "resolution", value }));

    const preview = [MARGIN, y, usable, PREVIEW_H];
    y += PREVIEW_H + GAP;

    const stepW = CELL_H + 6;
    cells.push({ kind: "batch", value: -1, rect: [MARGIN, y, stepW, CELL_H] });
    cells.push({ kind: "batch", value: 0, rect: [MARGIN + stepW + GAP, y, usable - (stepW + GAP) * 2, CELL_H] });
    cells.push({ kind: "batch", value: 1, rect: [MARGIN + usable - stepW, y, stepW, CELL_H] });
    y += CELL_H + GAP;

    return { cells, labels, preview, height: y - top };
}

const inside = ([x, y, w, h], pos) => pos[0] >= x && pos[0] <= x + w && pos[1] >= y && pos[1] <= y + h;

// A ratio's outline fitted into a box, centred on (cx, cy).
function shapeRect(ratio, box, cx, cy) {
    const w = ratio >= 1 ? box : box * ratio;
    const h = ratio >= 1 ? box / ratio : box;
    return [cx - w / 2, cy - h / 2, w, h];
}

function drawCell(ctx, cell, { selected, dimmed, hover }) {
    const [x, y, w, h] = cell.rect;
    const accent = accentColor();
    ctx.globalAlpha = dimmed ? 0.4 : 1;
    ctx.fillStyle = selected ? accent : LiteGraph.WIDGET_BGCOLOR;
    ctx.strokeStyle = selected ? accent : LiteGraph.WIDGET_OUTLINE_COLOR;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.fill();
    ctx.stroke();
    if (hover && !selected && !dimmed) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fill();
    }
    ctx.fillStyle = ctx.strokeStyle = selected ? "#ffffff" : LiteGraph.WIDGET_TEXT_COLOR;
}

function drawGrid(ctx, node, widget, y) {
    const { cells, labels, preview } = layout(node, widget.drawWidth, y);
    const ratio = getWidget(node, "aspect_ratio")?.value;
    const resolution = getWidget(node, "resolution")?.value;
    const portrait = DATA.values[ratio] < 1;
    const batch = Number(getWidget(node, "batch_size")?.value) || 1;
    const square = DATA.values[ratio] === 1;
    const portraitLinked = isLinked(node, "portrait");
    const batchLinked = isLinked(node, "batch_size");
    // Canvas renderer only: the pointer in node space, for hover.
    const mouse = app.canvas.node_over === node && app.canvas.graph_mouse
        ? [app.canvas.graph_mouse[0] - node.pos[0], app.canvas.graph_mouse[1] - node.pos[1]]
        : null;

    ctx.save();
    ctx.textBaseline = "middle";
    ctx.lineWidth = 1;

    for (const label of labels) {
        ctx.globalAlpha = 0.6;
        ctx.font = "11px Arial";
        ctx.textAlign = "left";
        ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
        ctx.fillText(label.text, MARGIN, label.y + LABEL_H / 2);
        if (label.dot) {
            const x = MARGIN + ctx.measureText(label.text).width + 10;
            ctx.fillStyle = OK_DOT;
            ctx.beginPath();
            ctx.arc(x, label.y + LABEL_H / 2, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
            ctx.fillText("≈1 MP", x + 6, label.y + LABEL_H / 2);
        }
    }

    for (const cell of cells) {
        const [x, cy, w, h] = cell.rect;
        const hover = mouse && inside(cell.rect, mouse);
        ctx.textAlign = "center";
        ctx.font = "11px Arial";

        if (cell.kind === "ratio") {
            drawCell(ctx, cell, { selected: false, hover });
            ctx.textAlign = "left";
            ctx.strokeRect(...shapeRect(DATA.values[ratio], 10, x + 14, cy + h / 2));
            ctx.fillText(ratio ?? "", x + 26, cy + h / 2);
            ctx.textAlign = "right";
            ctx.fillText("▾", x + w - 10, cy + h / 2);
        } else if (cell.kind === "portrait") {
            const dimmed = square || portraitLinked;
            drawCell(ctx, cell, { selected: cell.value === portrait && !dimmed, dimmed, hover });
            const text = portraitLinked ? "linked" : cell.value ? "portrait" : "landscape";
            const textW = ctx.measureText(text).width;
            const iconX = x + w / 2 - textW / 2 - 5;
            ctx.strokeRect(...shapeRect(cell.value ? 2 / 3 : 3 / 2, 11, iconX, cy + h / 2));
            ctx.fillText(text, iconX + 10 + textW / 2, cy + h / 2);
        } else if (cell.kind === "resolution") {
            drawCell(ctx, cell, { selected: cell.value === resolution, hover });
            const [fw, fh] = parseSize(cell.value);
            ctx.font = "12px Arial";
            ctx.fillText(`${fw}×${fh}`, x + w / 2, cy + h / 2 - 6);
            ctx.font = "10px Arial";
            ctx.globalAlpha *= 0.65;
            ctx.fillText(`${megapixels(fw, fh).toFixed(2)} MP`, x + w / 2, cy + h / 2 + 8);
            if (nearOneMP(fw, fh)) {
                ctx.globalAlpha = 1;
                ctx.fillStyle = OK_DOT;
                ctx.beginPath();
                ctx.arc(x + w - 7, cy + 7, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            const stepper = cell.value !== 0;
            const atLimit = (cell.value < 0 && batch <= 1) || (cell.value > 0 && batch >= MAX_BATCH);
            drawCell(ctx, cell, { selected: false, dimmed: batchLinked || (stepper && atLimit), hover: stepper && hover });
            ctx.font = "12px Arial";
            const text = cell.value < 0 ? "−" : cell.value > 0 ? "+" : batchLinked ? "batch: linked" : `batch ${batch}`;
            ctx.fillText(text, x + w / 2, cy + h / 2);
        }
    }

    // Preview: the final frame drawn to scale, then its numbers.
    const [px, py, , ph] = preview;
    const [fw, fh] = parseSize(resolution);
    ctx.globalAlpha = 1;
    if (fw && fh) {
        const box = ph - 8;
        const [rx, ry, rw, rh] = shapeRect(fw / fh, box, px + box / 2 + 4, py + ph / 2);
        ctx.strokeStyle = accentColor();
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);
        ctx.textAlign = "left";
        ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
        ctx.font = "13px Arial";
        ctx.fillText(`${fw} × ${fh}`, px + box + 16, py + ph / 2 - 8);
        ctx.font = "11px Arial";
        ctx.globalAlpha = 0.65;
        ctx.fillText(`${megapixels(fw, fh).toFixed(2)} MP · latent ${Math.floor(fw / 8)}×${Math.floor(fh / 8)}`, px + box + 16, py + ph / 2 + 9);
    }
    ctx.restore();
}

function click(node, cell, event) {
    if (cell.kind === "ratio") {
        new LiteGraph.ContextMenu(DATA.ratios, {
            event,
            callback: (value) => setValue(node, "aspect_ratio", value),
        });
    }
    else if (cell.kind === "resolution") setValue(node, "resolution", cell.value);
    else if (cell.kind === "portrait") {
        const ratio = getWidget(node, "aspect_ratio")?.value;
        if (DATA.values[ratio] !== 1 && !isLinked(node, "portrait") && cell.value !== DATA.values[ratio] < 1) {
            setValue(node, "aspect_ratio", mirrorRatio(ratio));
        }
    } else if (!isLinked(node, "batch_size")) {
        const batch = Number(getWidget(node, "batch_size")?.value) || 1;
        if (cell.value) setValue(node, "batch_size", Math.min(MAX_BATCH, Math.max(1, batch + cell.value)));
        else {
            app.canvas.prompt("Batch size", String(batch), (text) => {
                const value = Math.round(Number(text));
                if (Number.isFinite(value)) setValue(node, "batch_size", Math.min(MAX_BATCH, Math.max(1, value)));
            }, event);
        }
    }
}

function makeGridWidget(node) {
    return {
        type: "mb_resolution_grid",
        name: "resolution_grid",
        // y and drawWidth are recorded by draw() and reused by mouse() for hit tests,
        // so the two agree in either renderer. Not "width": the canvas renderer
        // draws with widget.width when set, pinning the grid at an old node width.
        y: 0,
        drawWidth: 0,
        // The serializer checks widget.serialize, not options.serialize.
        serialize: false,
        options: { serialize: false },

        computeSize() {
            return [node.size[0], layout(node, node.size[0], 0).height];
        },

        // Nodes 2.0 asks for a layout box rather than calling computeSize.
        computeLayoutSize() {
            const height = this.computeSize()[1];
            return { minHeight: height, maxHeight: height, minWidth: 280 };
        },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            this.drawWidth = widgetWidth || node.size[0];
            drawGrid(ctx, drawNode, this, y);
        },

        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            const width = this.drawWidth || mouseNode.size[0];
            // The canvas renderer gives pos relative to the node (rows start at
            // the widget's y); Nodes 2.0 hands the widget its own canvas (rows
            // start at 0). Both are tested; the widget only gets clicks that
            // landed inside its own box.
            for (const origin of [this.y, 0]) {
                const cell = layout(mouseNode, width, origin).cells.find((c) => inside(c.rect, pos));
                if (!cell) continue;
                click(mouseNode, cell, event);
                return true;
            }
            return false;
        },
    };
}

// The resolution count changes with the ratio, so the grid's height does too.
function refit(node) {
    const grid = node.__mbResolutionGrid;
    if (grid) grid.computedHeight = grid.computeSize()[1];
    const size = node.computeSize();
    node.setSize([Math.max(node.size[0], size[0], 280), size[1]]);
    grid?.triggerDraw?.();
    node.setDirtyCanvas(true, true);
}

// Must run synchronously from nodeCreated: a workflow restores widget values by
// position, so the grid has to already sit at index 0 by the time that happens.
function wireNode(node) {
    const ratio = getWidget(node, "aspect_ratio");
    if (!ratio) return;

    const prev = ratio.callback;
    ratio.callback = function (value, ...rest) {
        const r = prev?.apply(this, [value, ...rest]);
        applyRatio(node, value ?? this.value);
        return r;
    };

    VALUE_WIDGETS.forEach((name) => setWidgetVisible(node, name, false)); // the grid is the control

    const grid = makeGridWidget(node);
    node.__mbResolutionGrid = grid;
    node.addCustomWidget(grid);
    // addCustomWidget appends; move the grid to the top of the node.
    node.widgets.splice(node.widgets.indexOf(grid), 1);
    node.widgets.unshift(grid);

    // Hover is drawn from the pointer position, so redraw as it moves.
    const prevMouseMove = node.onMouseMove;
    node.onMouseMove = function () {
        prevMouseMove?.apply(this, arguments);
        this.setDirtyCanvas(true, false);
    };
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
    if (!ratio || DATA.table[ratio.value]) return;

    // Workflows saved before the labels grew their descriptions hold a bare
    // "16:9"; match on the part before the parenthesis so they still restore.
    const bare = String(ratio.value ?? "").trim();
    const match = DATA.ratios.find((name) => name.split(" (")[0] === bare);
    ratio.value = match ?? DATA.ratios[0];
}

// Everything that needs the ratio table, run once it has arrived.
function applyTable(node) {
    if (!DATA.ratios.length) return;
    repairValues(node);
    VALUE_WIDGETS.forEach((name) => setWidgetVisible(node, name, false));
    const ratio = getWidget(node, "aspect_ratio")?.value ?? DATA.ratios[0];
    // Older workflows flipped a landscape ratio with portrait on (16:9 + portrait);
    // load those as the mirror ratio, whose sizes are the same ones turned.
    const flipped = DATA.values[ratio] !== 1 && !!getWidget(node, "portrait")?.value !== DATA.values[ratio] < 1;
    applyRatio(node, flipped ? mirrorRatio(ratio) : ratio);
}

app.registerExtension({
    name: "MBNodes.Resolution",

    async setup() {
        await READY;
    },

    nodeCreated(node) {
        if (node.comfyClass !== "MBResolution") return;
        wireNode(node);
        READY.then(() => applyTable(node));
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBResolution") return;
        await READY;
        applyTable(node);
    },
});
