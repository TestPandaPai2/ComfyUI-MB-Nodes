import { app } from "../../scripts/app.js";
import { accentColor, getWidget, setWidgetVisible } from "./common.js";
import { openDialog } from "./dialog.js";

// Must match nodes/upscale_latent_node.py.
const DEFAULT_MULTIPLIERS = [0.5, 1, 1.5, 2, 2.5, 3];
const MIN_MULTIPLIER = 0.05;
const MAX_MULTIPLIER = 8;
const METHODS = ["nearest-exact", "bilinear", "area", "bicubic", "bislerp"];
const METHOD_LABELS = ["nearest", "bilinear", "area", "bicubic", "bislerp"];
const MAX_ENTRIES = 24;
const LATENT_SCALE = 8; // pixels per latent cell for the usual VAEs

const COLS = 3;
const CELL_H = 22;
const GAP = 4;
const MARGIN = 14;
const READOUT_H = 16;

function label(value) {
    return `${Number(value.toFixed(4))}x`;
}

// The list is kept in node.properties so it is saved with the workflow.
function multipliers(node) {
    const stored = node.properties?.mb_multipliers;
    return Array.isArray(stored) && stored.length ? stored : DEFAULT_MULTIPLIERS;
}

function parseValue(text) {
    const value = Number(String(text).trim().replace(/x$/i, ""));
    if (!Number.isFinite(value) || value < MIN_MULTIPLIER || value > MAX_MULTIPLIER) return null;
    return Number(value.toFixed(4));
}

const sameValue = (a, b) => Math.abs(a - b) < 1e-6;

// Writes the list back and keeps the node in step with it: the grid grows or
// shrinks, and a selection that no longer exists moves to the nearest entry.
function setMultipliers(node, values) {
    node.properties.mb_multipliers = values;

    const current = Number(getWidget(node, "multiplier")?.value);
    if (values.length && !values.some((v) => sameValue(v, current))) {
        const nearest = values.reduce(
            (best, v) => (Math.abs(v - current) < Math.abs(best - current) ? v : best),
            values[0]
        );
        setValue(node, "multiplier", nearest);
    }
    refitGrid(node);
}

// Nodes 2.0 lays each widget out into its own box and only routes pointer events
// that land inside it, so a grid that grew a row stays unclickable there until
// the layout is recomputed from the widget's new height.
function refitGrid(node) {
    const grid = node.__mbMultiplierGrid;
    if (grid) grid.computedHeight = grid.computeSize()[1];
    const size = node.computeSize();
    node.setSize([Math.max(node.size[0], size[0]), size[1]]);
    grid?.triggerDraw?.();
    node.setDirtyCanvas(true, true);
}

function setValue(node, name, value) {
    const widget = getWidget(node, name);
    if (!widget) return;
    widget.value = value;
    widget.callback?.(value);
    node.__mbMultiplierGrid?.triggerDraw?.();
    node.setDirtyCanvas(true, true);
}

function promptCustom(node, event) {
    const current = Number(getWidget(node, "multiplier")?.value);
    app.canvas.prompt(`Multiplier (${MIN_MULTIPLIER}-${MAX_MULTIPLIER})`, String(current), (text) => {
        const value = parseValue(text);
        if (value !== null) setValue(node, "multiplier", value);
    }, event);
}

// Latent [width, height] coming into the node: read off the upstream node's
// width/height widgets (pixels), chained through other Upscale Latent (MB)
// nodes, else the size seen on the last run.
function inputSize(node, seen = new Set()) {
    if (seen.has(node)) return null;
    seen.add(node);
    const slot = node.inputs?.findIndex((i) => i.name === "samples") ?? -1;
    const link = slot >= 0 ? node.getInputLink(slot) : null;
    const origin = link && node.graph?.getNodeById(link.origin_id);
    if (origin?.comfyClass === "MBUpscaleLatent") {
        const size = inputSize(origin, seen);
        return size && outputSize(origin, size);
    }
    const width = Number(getWidget(origin, "width")?.value);
    const height = Number(getWidget(origin, "height")?.value);
    if (width > 0 && height > 0) return [Math.floor(width / LATENT_SCALE), Math.floor(height / LATENT_SCALE)];
    return node.__mbLastSize ?? null;
}

function outputSize(node, [width, height]) {
    const m = Number(getWidget(node, "multiplier")?.value);
    if (sameValue(m, 1)) return [width, height];
    return [Math.max(1, Math.round(width * m)), Math.max(1, Math.round(height * m))];
}

function readout(node) {
    const size = inputSize(node);
    if (!size) return "size shows after first run";
    const [w, h] = outputSize(node, size);
    return `${size[0]}×${size[1]} → ${w}×${h} · ~${w * LATENT_SCALE}×${h * LATENT_SCALE} px`;
}

// Every clickable cell, top to bottom: the multiplier buttons, a full-width
// Custom row, then the method row. Laid out against the width handed to draw()
// rather than node.size: under Nodes 2.0 the widget owns a canvas only as wide
// as itself, so node width would overshoot it and the cells would miss the
// pointer.
function layout(node, width, top) {
    const usable = width - MARGIN * 2;
    const cellW = (usable - GAP * (COLS - 1)) / COLS;
    const values = multipliers(node);
    const cells = values.map((value, i) => ({
        kind: "multiplier",
        value,
        rect: [MARGIN + (i % COLS) * (cellW + GAP), top + Math.floor(i / COLS) * (CELL_H + GAP), cellW, CELL_H],
    }));
    let y = top + Math.ceil(values.length / COLS) * (CELL_H + GAP);
    cells.push({ kind: "custom", rect: [MARGIN, y, usable, CELL_H] });
    y += CELL_H + GAP;
    const methodW = (usable - GAP * (METHODS.length - 1)) / METHODS.length;
    METHODS.forEach((value, i) => {
        cells.push({ kind: "method", value, label: METHOD_LABELS[i], rect: [MARGIN + i * (methodW + GAP), y, methodW, CELL_H] });
    });
    return { cells, readoutY: y + CELL_H + GAP };
}

const inside = ([x, y, w, h], pos) => pos[0] >= x && pos[0] <= x + w && pos[1] >= y && pos[1] <= y + h;

function makeGridWidget(node) {
    return {
        type: "mb_multiplier_grid",
        name: "multiplier_grid",
        // y and width are recorded by draw() and reused by mouse() for hit tests,
        // so the two agree in either renderer.
        y: 0,
        width: 0,
        // The serializer checks widget.serialize, not options.serialize.
        serialize: false,
        options: { serialize: false },

        computeSize() {
            const rows = Math.ceil(multipliers(node).length / COLS) + 2;
            return [node.size[0], rows * (CELL_H + GAP) + READOUT_H + GAP];
        },

        // Nodes 2.0 asks for a layout box rather than calling computeSize; without
        // this the box keeps the height it had when the node was created and the
        // rows added later never receive clicks.
        computeLayoutSize() {
            const height = this.computeSize()[1];
            return { minHeight: height, maxHeight: height, minWidth: 220 };
        },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            this.width = widgetWidth || node.size[0];
            const multiplier = Number(getWidget(drawNode, "multiplier")?.value);
            const method = getWidget(drawNode, "upscale_method")?.value;
            const custom = !multipliers(drawNode).some((v) => sameValue(v, multiplier));
            const accent = accentColor();
            // Canvas renderer only: the pointer in node space, for hover.
            const mouse = app.canvas.node_over === drawNode && app.canvas.graph_mouse
                ? [app.canvas.graph_mouse[0] - drawNode.pos[0], app.canvas.graph_mouse[1] - drawNode.pos[1]]
                : null;
            const { cells, readoutY } = layout(drawNode, this.width, y);

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            for (const cell of cells) {
                const [x, cy, w, h] = cell.rect;
                const selected = cell.kind === "multiplier" ? sameValue(cell.value, multiplier)
                    : cell.kind === "custom" ? custom
                    : cell.value === method;
                const text = cell.kind === "multiplier" ? label(cell.value)
                    : cell.kind === "custom" ? (custom ? `Custom ${label(multiplier)}` : "Custom…")
                    : cell.label;

                ctx.fillStyle = selected ? accent : LiteGraph.WIDGET_BGCOLOR;
                ctx.strokeStyle = selected ? accent : LiteGraph.WIDGET_OUTLINE_COLOR;
                ctx.setLineDash(cell.kind === "custom" && !selected ? [4, 3] : []);
                ctx.beginPath();
                ctx.roundRect(x, cy, w, h, 5);
                ctx.fill();
                ctx.stroke();
                if (!selected && mouse && inside(cell.rect, mouse)) {
                    ctx.fillStyle = "rgba(255,255,255,0.08)";
                    ctx.fill();
                }

                ctx.font = cell.kind === "method" ? "11px Arial" : "12px Arial";
                ctx.fillStyle = selected ? "#ffffff" : LiteGraph.WIDGET_TEXT_COLOR;
                ctx.fillText(text, x + w / 2, cy + h / 2);
            }

            ctx.setLineDash([]);
            ctx.font = "11px Arial";
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
            ctx.fillText(readout(drawNode), this.width / 2, readoutY + READOUT_H / 2);
            ctx.restore();
        },

        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            const width = this.width || mouseNode.size[0];

            // The two renderers measure pos differently: the canvas one gives it
            // relative to the node, so the rows start at the widget's y, while
            // Nodes 2.0 hands the widget its own canvas and starts at 0. Both
            // origins are tested, which is safe because the widget only ever
            // receives clicks that landed inside its own box.
            for (const origin of [this.y, 0]) {
                const cell = layout(mouseNode, width, origin).cells.find((c) => inside(c.rect, pos));
                if (!cell) continue;
                if (cell.kind === "multiplier") setValue(mouseNode, "multiplier", cell.value);
                else if (cell.kind === "method") setValue(mouseNode, "upscale_method", cell.value);
                else promptCustom(mouseNode, event);
                return true;
            }
            return false;
        },
    };
}

// The dialog edits a working copy; every edit is pushed to the node right away,
// so the grid is already correct by the time the dialog goes away.
function openSettings(node) {
    let draft = [...multipliers(node)];

    const commit = () => {
        const values = [...new Set(draft.filter((v) => v !== null))].sort((a, b) => a - b);
        setMultipliers(node, values.length ? values : [...DEFAULT_MULTIPLIERS]);
    };

    openDialog({
        title: "Upscale Latent (MB) — MB Settings",
        applyLabel: "Done",
        render(body) {
            const hint = document.createElement("div");
            hint.className = "mb-dialog-hint";
            hint.style.margin = "0";
            hint.textContent = `Buttons shown on the node. ${MIN_MULTIPLIER}-${MAX_MULTIPLIER}, up to ${MAX_ENTRIES} of them.`;

            const list = document.createElement("div");
            list.className = "mb-dialog-list";

            const add = document.createElement("button");
            add.className = "mb-dialog-button";
            add.textContent = "Add New";

            const reset = document.createElement("button");
            reset.className = "mb-dialog-button";
            reset.textContent = "Reset to defaults";

            function render(focusIndex) {
                list.replaceChildren();
                draft.forEach((value, index) => {
                    const row = document.createElement("div");
                    row.className = "mb-dialog-item";

                    const input = document.createElement("input");
                    input.type = "text";
                    input.value = value === null ? "" : String(value);
                    input.placeholder = "e.g. 1.75";
                    input.addEventListener("input", () => {
                        const parsed = parseValue(input.value);
                        input.classList.toggle("mb-invalid", parsed === null);
                        draft[index] = parsed;
                        commit();
                    });

                    const remove = document.createElement("button");
                    remove.className = "mb-dialog-remove";
                    remove.textContent = "×";
                    remove.title = "Remove";
                    remove.addEventListener("click", () => {
                        draft.splice(index, 1);
                        commit();
                        render();
                    });

                    row.append(input, remove);
                    list.appendChild(row);
                    if (index === focusIndex) setTimeout(() => input.focus(), 0);
                });
                add.disabled = draft.length >= MAX_ENTRIES;
            }

            add.addEventListener("click", () => {
                if (draft.length >= MAX_ENTRIES) return;
                draft.push(null); // an empty row; it counts once a valid number is typed
                render(draft.length - 1);
            });

            reset.addEventListener("click", () => {
                draft = [...DEFAULT_MULTIPLIERS];
                commit();
                render();
            });

            render();
            body.append(hint, list, add, reset);
        },
        onClose: commit,
    });
}

function addSettingsMenu(node) {
    const prevMenuOptions = node.getExtraMenuOptions;
    node.getExtraMenuOptions = function (canvas, options) {
        prevMenuOptions?.apply(this, arguments);
        options.unshift({ content: "MB Settings", callback: () => openSettings(this) });
    };
}

// The grid is the control for both values.
function hideValueWidgets(node) {
    setWidgetVisible(node, "multiplier", false);
    setWidgetVisible(node, "upscale_method", false);
}

// Must run synchronously from nodeCreated: a workflow restores widget values by
// position, so the grid has to already sit at index 0 by the time that happens.
function wireNode(node) {
    node.properties = node.properties ?? {};
    addSettingsMenu(node);
    hideValueWidgets(node);

    const grid = makeGridWidget(node);
    node.__mbMultiplierGrid = grid;
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

    const prevExecuted = node.onExecuted;
    node.onExecuted = function (message) {
        prevExecuted?.apply(this, arguments);
        if (message?.mb_size) this.__mbLastSize = message.mb_size;
        this.setDirtyCanvas(true, false);
    };
}

app.registerExtension({
    name: "MBNodes.UpscaleLatent",

    nodeCreated(node) {
        if (node.comfyClass !== "MBUpscaleLatent") return;
        wireNode(node);
        refitGrid(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBUpscaleLatent") return;
        setTimeout(() => {
            hideValueWidgets(node);
            refitGrid(node);
        }, 60);
    },
});
