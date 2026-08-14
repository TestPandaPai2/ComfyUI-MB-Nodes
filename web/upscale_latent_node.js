import { app } from "../../scripts/app.js";
import { getWidget, setWidgetVisible, resizeToContent } from "./common.js";
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

function parseList(text) {
    const seen = new Set();
    for (const part of text.split(/[\s,;]+/)) {
        if (!part) continue;
        const value = Number(part.replace(/x$/i, ""));
        if (!Number.isFinite(value) || value < MIN_MULTIPLIER || value > MAX_MULTIPLIER) return null;
        seen.add(Number(value.toFixed(4)));
    }
    if (!seen.size || seen.size > MAX_ENTRIES) return null;
    return [...seen].sort((a, b) => a - b);
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
            const rows = gridRows(node);
            return [node.size[0], rows * CELL_H + (rows - 1) * GAP + GAP];
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
            for (let index = 0; index < values.length; index++) {
                const [x, cy, w, h] = cellRect(this.width || mouseNode.size[0], index, this.y);
                if (pos[0] >= x && pos[0] <= x + w && pos[1] >= cy && pos[1] <= cy + h) {
                    selectMultiplier(mouseNode, values[index]);
                    return true;
                }
            }
            return false;
        },
    };
}

function openSettings(node) {
    let input;
    let error;

    openDialog({
        title: "Upscale Latent (MB) — MB Settings",
        render(body) {
            const hint = document.createElement("div");
            hint.className = "mb-dialog-hint";
            hint.style.margin = "0";
            hint.textContent = `Multipliers shown as buttons, separated by commas. ${MIN_MULTIPLIER}-${MAX_MULTIPLIER}, up to ${MAX_ENTRIES} of them.`;

            input = document.createElement("input");
            input.type = "text";
            input.className = "mb-dialog-number";
            input.style.width = "100%";
            input.style.marginLeft = "0";
            input.value = multipliers(node).map((v) => Number(v.toFixed(4))).join(", ");

            error = document.createElement("div");
            error.className = "mb-dialog-hint";
            error.style.margin = "0";
            error.style.color = "#e01010";

            const reset = document.createElement("button");
            reset.className = "mb-dialog-button";
            reset.textContent = "Reset to defaults";
            reset.addEventListener("click", () => {
                input.value = DEFAULT_MULTIPLIERS.join(", ");
                error.textContent = "";
            });

            body.append(hint, input, error, reset);
        },
        onApply() {
            const values = parseList(input.value);
            if (!values) {
                error.textContent = "Enter numbers only, each between " +
                    `${MIN_MULTIPLIER} and ${MAX_MULTIPLIER}.`;
                input.focus();
                return false; // keep the dialog open
            }

            node.properties.mb_multipliers = values;
            // A removed multiplier must not stay selected behind the grid.
            const current = Number(getWidget(node, "multiplier")?.value);
            if (!values.some((v) => Math.abs(v - current) < 1e-6)) {
                selectMultiplier(node, values.reduce(
                    (best, v) => (Math.abs(v - current) < Math.abs(best - current) ? v : best),
                    values[0]
                ));
            }
            resizeToContent(node);
        },
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
        resizeToContent(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBUpscaleLatent") return;
        setTimeout(() => {
            setWidgetVisible(node, "multiplier", false);
            resizeToContent(node);
        }, 60);
    },
});
