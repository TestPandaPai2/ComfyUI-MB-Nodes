import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget } from "./common.js";

// Must match nodes/compare_image_node.py.
const LEFT_TO_RIGHT = "Left to Right";
const RIGHT_TO_LEFT = "Right to Left";
const UP_TO_DOWN = "Up to Down";

const MARGIN = 10;
const MIN_HEIGHT = 120;
const DEFAULT_ASPECT = 1; // used until the first pair has loaded
const LINE = "#f0f0f0";
const HANDLE_RADIUS = 7;
const EMPTY_TEXT = "#8a8a8a";

function viewUrl(result) {
    const query = new URLSearchParams({
        filename: result.filename,
        subfolder: result.subfolder ?? "",
        type: result.type ?? "temp",
        rand: String(Math.random()), // a temp name can be reused across runs
    });
    return api.apiURL(`/view?${query}`);
}

function loadImage(result) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = viewUrl(result);
    });
}

function state(node) {
    if (!node.__mbCompare) node.__mbCompare = { a: null, b: null, split: 0.5 };
    return node.__mbCompare;
}

function direction(node) {
    return getWidget(node, "direction")?.value ?? LEFT_TO_RIGHT;
}

// The drawn image box: the pair is fitted into the widget and letterboxed, so a
// portrait pair is not stretched across a wide node.
function imageRect(node, widgetWidth, y, height) {
    const s = state(node);
    const source = s.a ?? s.b;
    const aspect = source ? source.naturalWidth / source.naturalHeight : DEFAULT_ASPECT;

    const boxW = Math.max(1, widgetWidth - MARGIN * 2);
    const boxH = Math.max(1, height);
    const drawH = Math.min(boxH, boxW / aspect);
    const drawW = drawH * aspect;

    return [MARGIN + (boxW - drawW) / 2, y + (boxH - drawH) / 2, drawW, drawH];
}

function drawWidget(ctx, node, widgetWidth, y, height) {
    const s = state(node);
    const [x, iy, w, h] = imageRect(node, widgetWidth, y, height);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(MARGIN, y, Math.max(1, widgetWidth - MARGIN * 2), Math.max(1, height), 6);
    ctx.fillStyle = "#1e1e1e";
    ctx.fill();
    ctx.clip();

    if (!s.a && !s.b) {
        ctx.fillStyle = EMPTY_TEXT;
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            "Run to compare A and B",
            MARGIN + (widgetWidth - MARGIN * 2) / 2,
            y + height / 2
        );
        ctx.restore();
        return;
    }

    const mode = direction(node);
    const vertical = mode === UP_TO_DOWN;
    // Right to Left reveals B on the left of the split rather than the right, so
    // one fraction drives both horizontal modes.
    const flipped = mode === RIGHT_TO_LEFT;
    const fraction = Math.min(1, Math.max(0, s.split));

    const base = flipped ? s.b : s.a;
    const over = flipped ? s.a : s.b;

    if (base) ctx.drawImage(base, x, iy, w, h);

    if (over) {
        ctx.save();
        ctx.beginPath();
        if (vertical) ctx.rect(x, iy + h * fraction, w, h * (1 - fraction));
        else ctx.rect(x + w * fraction, iy, w * (1 - fraction), h);
        ctx.clip();
        ctx.drawImage(over, x, iy, w, h);
        ctx.restore();
    }

    // Divider and handle, so the split stays visible once the cursor leaves.
    const lineX = x + w * fraction;
    const lineY = iy + h * fraction;

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (vertical) {
        ctx.moveTo(x, lineY);
        ctx.lineTo(x + w, lineY);
    } else {
        ctx.moveTo(lineX, iy);
        ctx.lineTo(lineX, iy + h);
    }
    ctx.stroke();

    ctx.fillStyle = LINE;
    ctx.beginPath();
    ctx.arc(
        vertical ? x + w / 2 : lineX,
        vertical ? lineY : iy + h / 2,
        HANDLE_RADIUS,
        0,
        Math.PI * 2
    );
    ctx.fill();

    // A and B labels, one on each side of the split.
    ctx.font = "11px Arial";
    ctx.fillStyle = LINE;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(flipped ? "B" : "A", x + 6, iy + 6);
    ctx.textAlign = "right";
    ctx.fillText(flipped ? "A" : "B", x + w - 6, iy + h - 18);

    ctx.restore();
}

function makeWidget(node) {
    return {
        type: "mb_image_compare",
        name: "compare",
        // Recorded by draw() and reused by mouse(), so both renderers agree.
        y: 0,
        width: 0,
        height: 0,
        serialize: false,
        options: { serialize: false },

        computeSize() {
            const s = state(node);
            const source = s.a ?? s.b;
            const aspect = source ? source.naturalWidth / source.naturalHeight : DEFAULT_ASPECT;
            const width = node.size[0];
            return [width, Math.max(MIN_HEIGHT, (width - MARGIN * 2) / aspect)];
        },

        // Nodes 2.0 asks for a layout box instead of calling computeSize; without
        // it the box keeps the height it had before the images loaded.
        computeLayoutSize() {
            const height = this.computeSize()[1];
            return { minHeight: height, maxHeight: height, minWidth: 180 };
        },

        draw(ctx, drawNode, widgetWidth, y, height) {
            this.y = y;
            this.width = widgetWidth || node.size[0];
            this.height = height || this.computeSize()[1];
            drawWidget(ctx, drawNode, this.width, y, this.height);
        },

        // The split follows the pointer while it is over the widget, so hovering
        // wipes between the two images with no click needed.
        mouse(event, pos, mouseNode) {
            const tracked = ["pointermove", "mousemove", "pointerdown", "mousedown"];
            if (!tracked.includes(event.type)) return false;

            // The canvas renderer measures pos from the node's origin, Nodes 2.0
            // from the widget's own box. The widget only receives events that
            // landed inside it, so subtracting its y only when pos is past it
            // lands on the same local coordinate in both.
            const localY = pos[1] > this.y ? pos[1] - this.y : pos[1];
            const [x, iy, w, h] = imageRect(mouseNode, this.width, 0, this.height);
            const fraction =
                direction(mouseNode) === UP_TO_DOWN
                    ? (localY - iy) / Math.max(1, h)
                    : (pos[0] - x) / Math.max(1, w);

            state(mouseNode).split = Math.min(1, Math.max(0, fraction));
            mouseNode.setDirtyCanvas(true, true);
            return true;
        },
    };
}

function refit(node) {
    const widget = node.__mbCompareWidget;
    if (widget) widget.computedHeight = widget.computeSize()[1];
    const size = node.computeSize();
    node.setSize([Math.max(node.size[0], size[0]), Math.max(node.size[1], size[1])]);
    node.setDirtyCanvas(true, true);
}

async function applyResult(node, result) {
    if (!result) return;
    const [a, b] = await Promise.all([
        result.a?.[0] ? loadImage(result.a[0]) : null,
        result.b?.[0] ? loadImage(result.b[0]) : null,
    ]);
    const s = state(node);
    s.a = a;
    s.b = b;
    refit(node);
}

app.registerExtension({
    name: "MBNodes.ImageCompare",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBImageCompare") return;

        const widget = makeWidget(node);
        node.__mbCompareWidget = node.addCustomWidget
            ? node.addCustomWidget(widget)
            : (node.widgets.push(widget), widget);

        const w = getWidget(node, "direction");
        if (w) {
            const previous = w.callback;
            w.callback = function (...args) {
                const result = previous?.apply(this, args);
                node.setDirtyCanvas(true, true);
                return result;
            };
        }

        const onExecuted = node.onExecuted;
        node.onExecuted = function (message) {
            onExecuted?.apply(this, arguments);
            applyResult(this, message?.mb_compare?.[0]);
        };

        refit(node);
    },
});
