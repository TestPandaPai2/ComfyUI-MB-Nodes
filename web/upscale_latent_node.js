import { app } from "../../scripts/app.js";
import { getWidget, setWidgetVisible } from "./common.js";
import { openDialog } from "./dialog.js";

// Must match nodes/upscale_latent_node.py.
const DEFAULT_MULTIPLIERS = [0.5, 1, 1.5, 2, 2.5, 3];
const MIN_MULTIPLIER = 0.05;
const MAX_MULTIPLIER = 8;
const MAX_ENTRIES = 24;

const COLS = 3;
const CELL_H = 22;
const GAP = 4;
const MARGIN = 14;

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

// Writes the list back and keeps the node in step with it: the grid grows or
// shrinks, and a selection that no longer exists moves to the nearest entry.
function setMultipliers(node, values) {
    node.properties.mb_multipliers = values;

    const current = Number(getWidget(node, "multiplier")?.value);
    if (values.length && !values.some((v) => Math.abs(v - current) < 1e-6)) {
        const nearest = values.reduce(
            (best, v) => (Math.abs(v - current) < Math.abs(best - current) ? v : best),
            values[0]
        );
        selectMultiplier(node, nearest);
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

function selectMultiplier(node, value) {
    const widget = getWidget(node, "multiplier");
    if (!widget) return;
    widget.value = value;
    widget.callback?.(value);
    node.__mbMultiplierGrid?.triggerDraw?.();
    node.setDirtyCanvas(true, true);
}

function gridRows(node) {
    return Math.ceil(multipliers(node).length / COLS);
}

// Laid out against the width handed to draw() rather than node.size: under
// Nodes 2.0 the widget owns a canvas only as wide as itself, so node width would
// overshoot it and the cells would miss the pointer.
function cellRect(width, index, widgetY) {
    const usable = width - MARGIN * 2;
    const cellW = (usable - GAP * (COLS - 1)) / COLS;
    return [
        MARGIN + (index % COLS) * (cellW + GAP),
        widgetY + Math.floor(index / COLS) * (CELL_H + GAP),
        cellW,
        CELL_H,
    ];
}

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
            const rows = Math.max(1, gridRows(node));
            return [node.size[0], rows * CELL_H + (rows - 1) * GAP + GAP];
        },

        // Nodes 2.0 asks for a layout box rather than calling computeSize; without
        // this the box keeps the height it had when the node was created and the
        // rows added later never receive clicks.
        computeLayoutSize() {
            const height = this.computeSize()[1];
            return { minHeight: height, maxHeight: height, minWidth: 180 };
        },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            this.width = widgetWidth || node.size[0];
            const active = Number(getWidget(drawNode, "multiplier")?.value);

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "12px Arial";

            multipliers(drawNode).forEach((value, index) => {
                const [x, cy, w, h] = cellRect(this.width, index, y);
                const selected = Math.abs(value - active) < 1e-6;

                ctx.fillStyle = selected ? "#3f7cc6" : "#353535";
                ctx.strokeStyle = selected ? "#8ab4e8" : "#1a1a1a";
                ctx.beginPath();
                ctx.roundRect(x, cy, w, h, 5);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = selected ? "#ffffff" : "#c8c8c8";
                ctx.fillText(label(value), x + w / 2, cy + h / 2);
            });

            ctx.restore();
        },

        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            const values = multipliers(mouseNode);
            const width = this.width || mouseNode.size[0];

            // The two renderers measure pos differently: the canvas one gives it
            // relative to the node, so the rows start at the widget's y, while
            // Nodes 2.0 hands the widget its own canvas and starts at 0. Both
            // origins are tested, which is safe because the widget only ever
            // receives clicks that landed inside its own box.
            for (const origin of [this.y, 0]) {
                for (let index = 0; index < values.length; index++) {
                    const [x, cy, w, h] = cellRect(width, index, origin);
                    if (pos[0] >= x && pos[0] <= x + w && pos[1] >= cy && pos[1] <= cy + h) {
                        selectMultiplier(mouseNode, values[index]);
                        return true;
                    }
                }
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

// Must run synchronously from nodeCreated: a workflow restores widget values by
// position, so the grid has to already sit at index 0 by the time that happens.
function wireNode(node) {
    node.properties = node.properties ?? {};
    addSettingsMenu(node);
    setWidgetVisible(node, "multiplier", false); // the grid is the control

    const grid = makeGridWidget(node);
    node.__mbMultiplierGrid = grid;
    node.addCustomWidget(grid);
    // addCustomWidget appends; move the grid to the top of the node.
    node.widgets.splice(node.widgets.indexOf(grid), 1);
    node.widgets.unshift(grid);
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
            setWidgetVisible(node, "multiplier", false);
            refitGrid(node);
        }, 60);
    },
});
