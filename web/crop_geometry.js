// Crop box maths and painting, shared by the on-node editor of Crop Image (MB)
// and the crop dialog of Load Image with Crop (MB). Everything here works in
// fractions of the image and knows nothing about widgets or LiteGraph.

export const MIN_FRACTION = 0.02;
export const HANDLE = 8; // hit radius of a corner/edge grip, in canvas pixels

// Fixed presets, keyed the same as RATIOS in nodes/crop_image_node.py.
export const FIXED_RATIOS = {
    "1:1": 1, "4:3": 4 / 3, "3:2": 3 / 2, "16:10": 16 / 10, "16:9": 16 / 9,
    "1.85:1": 1.85, "2:1": 2, "21:9": 21 / 9,
    "3:4": 3 / 4, "2:3": 2 / 3, "10:16": 10 / 16, "9:16": 9 / 16,
    "1:1.85": 1 / 1.85, "1:2": 0.5, "9:21": 9 / 21,
};

export const HANDLES = [
    ["nw", 0, 0], ["n", 0.5, 0], ["ne", 1, 0],
    ["w", 0, 0.5], ["e", 1, 0.5],
    ["sw", 0, 1], ["s", 0.5, 1], ["se", 1, 1],
];

const FILL_OUTSIDE = "rgba(0, 0, 0, 0.55)";
const LINE = "#e01010";
const LINE_SOFT = "rgba(255, 255, 255, 0.35)";
const HANDLE_FILL = "#ffffff";
const TEXT = "#dcdcdc";

export const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Mirrors snap_axis() in nodes/crop_image_node.py, so the readout shows the size
// that actually comes out.
export function snapSpan(span, limit, multiple) {
    const rounded = Math.max(1, Math.round(span));
    if (multiple <= 1 || multiple > limit) return rounded;
    return Math.max(multiple, Math.floor(rounded / multiple) * multiple);
}

// The chosen preset as a ratio in *fraction* space: a pixel ratio has to be
// expressed against the image's own aspect before it can be applied to a rect
// measured in fractions of that image. null means unconstrained.
export function fractionRatio(choice, imageAspect) {
    if (!choice || choice === "free") return null;
    if (choice === "source") return 1; // in fraction space that is the full frame
    const ratio = FIXED_RATIOS[choice];
    return ratio === undefined ? null : ratio / (imageAspect || 1);
}

// Clamping the two sides on their own is what silently breaks a locked ratio:
// the side that hit the edge gets cut and the other one keeps its length. With
// a ratio in hand the whole box is scaled down instead, so its shape holds.
export function fitRatio(rect, ratio) {
    if (ratio === null) return rect;
    let w = Math.max(MIN_FRACTION, rect.w);
    let h = w / ratio;
    if (h > 1) {
        h = 1;
        w = h * ratio;
    }
    if (w > 1) {
        w = 1;
        h = w / ratio;
    }
    return { ...rect, w, h };
}

/** A rect fitted to the ratio, sized within limits and pushed inside the image. */
export function normalizeRect(rect, ratio = null) {
    const fitted = fitRatio(rect, ratio);
    const w = Math.min(1, Math.max(MIN_FRACTION, fitted.w));
    const h = Math.min(1, Math.max(MIN_FRACTION, fitted.h));
    return {
        x: clamp01(Math.min(fitted.x, 1 - w)),
        y: clamp01(Math.min(fitted.y, 1 - h)),
        w,
        h,
    };
}

/** Largest rect of the wanted shape that fits, centred on the current one. */
export function refitRect(rect, ratio) {
    if (ratio === null) return { ...rect };

    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;

    let w = rect.w;
    let h = w / ratio;
    if (h > 1) {
        h = 1;
        w = h * ratio;
    }
    if (w > 1) {
        w = 1;
        h = w / ratio;
    }
    return normalizeRect({ x: cx - w / 2, y: cy - h / 2, w, h }, ratio);
}

/** True when the rect no longer matches the locked ratio closely enough. */
export function offRatio(rect, ratio) {
    return ratio !== null && Math.abs(rect.w / rect.h - ratio) > ratio * 0.005;
}

// --------------------------------------------------------------- drag maths

// Every resize holds something still: the edge opposite the grip, or — for a
// grip on an edge with a locked ratio — the centre of the free axis. `at` is
// that fixed coordinate and `side` says which way the box grows from it.
function anchorOf(mode, start, axis) {
    const [low, high, pos, size] = axis === "x"
        ? ["w", "e", start.x, start.w]
        : ["n", "s", start.y, start.h];

    if (mode.includes(low)) return { side: "back", at: pos + size };   // grows left/up
    if (mode.includes(high)) return { side: "front", at: pos };        // grows right/down
    return { side: "center", at: pos + size / 2 };
}

// How far the box may run from its anchor before it leaves the image. A centred
// axis is limited by the nearer of the two edges, hence the doubling.
function room(anchor) {
    if (anchor.side === "front") return 1 - anchor.at;
    if (anchor.side === "back") return anchor.at;
    return 2 * Math.min(anchor.at, 1 - anchor.at);
}

function place(anchor, size) {
    if (anchor.side === "front") return anchor.at;
    if (anchor.side === "back") return anchor.at - size;
    return anchor.at - size / 2;
}

// Fit a wanted width/height around its anchors. Without a ratio each axis is
// capped on its own; with one, both are scaled by the same factor, so the box
// stops at the edge of the image with its shape intact instead of flattening
// into a free crop.
function fitToBounds(w, h, ax, ay, ratio) {
    const maxW = Math.max(MIN_FRACTION, room(ax));
    const maxH = Math.max(MIN_FRACTION, room(ay));

    if (ratio === null) {
        w = Math.min(w, maxW);
        h = Math.min(h, maxH);
    } else {
        const scale = Math.min(1, maxW / w, maxH / h);
        w *= scale;
        h *= scale;
    }

    w = Math.max(MIN_FRACTION, w);
    h = Math.max(MIN_FRACTION, h);
    return { x: place(ax, w), y: place(ay, h), w, h };
}

// Resize driven by one grip. `ratio` is in fraction space; a locked ratio grows
// the box to cover the pointer on whichever axis moved furthest.
export function resizeRect(mode, start, dx, dy, ratio) {
    const ax = anchorOf(mode, start, "x");
    const ay = anchorOf(mode, start, "y");

    let w = start.w;
    let h = start.h;
    if (mode.includes("w")) w = start.w - dx;
    else if (mode.includes("e")) w = start.w + dx;
    if (mode.includes("n")) h = start.h - dy;
    else if (mode.includes("s")) h = start.h + dy;

    w = Math.max(MIN_FRACTION, w);
    h = Math.max(MIN_FRACTION, h);

    if (ratio !== null) {
        // A corner follows the axis the pointer pushed harder; an edge grip
        // only has the one axis to go on.
        if (mode.length === 2) w = Math.max(w, h * ratio);
        else if (mode === "n" || mode === "s") w = h * ratio;
        h = w / ratio;
    }

    return fitToBounds(w, h, ax, ay, ratio);
}

// A drag started outside the box draws a fresh one from the press point, which
// is the corner that stays put.
export function newRect(anchor, px, py, ratio) {
    const ax = { side: px < anchor[0] ? "back" : "front", at: anchor[0] };
    const ay = { side: py < anchor[1] ? "back" : "front", at: anchor[1] };

    let w = Math.abs(px - anchor[0]);
    let h = Math.abs(py - anchor[1]);
    if (ratio !== null) {
        w = Math.max(w, h * ratio);
        h = w / ratio;
    }

    return fitToBounds(w, h, ax, ay, ratio);
}

// ------------------------------------------------------------------ drawing

/** The image letterboxed inside a box, so the rect the user drags is the image
 * and nothing else. */
export function frameOf(boxX, boxY, boxW, boxH, aspect) {
    boxW = Math.max(1, boxW);
    boxH = Math.max(1, boxH);
    aspect = aspect || boxW / boxH;

    let w = boxW;
    let h = w / aspect;
    if (h > boxH) {
        h = boxH;
        w = h * aspect;
    }
    return { x: boxX + (boxW - w) / 2, y: boxY + (boxH - h) / 2, w, h };
}

export function hitTest(frame, rect, px, py) {
    const rx = frame.x + rect.x * frame.w;
    const ry = frame.y + rect.y * frame.h;
    const rw = rect.w * frame.w;
    const rh = rect.h * frame.h;

    for (const [name, fx, fy] of HANDLES) {
        const hx = rx + fx * rw;
        const hy = ry + fy * rh;
        if (Math.abs(px - hx) <= HANDLE && Math.abs(py - hy) <= HANDLE) return name;
    }
    if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) return "move";
    return "new";
}

/** The image, the dimmed surround, the box with its thirds and grips, and the
 * output size in the corner. */
export function drawCrop(ctx, frame, image, rect, label) {
    ctx.save();
    ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h);

    const rx = frame.x + rect.x * frame.w;
    const ry = frame.y + rect.y * frame.h;
    const rw = rect.w * frame.w;
    const rh = rect.h * frame.h;

    // Everything outside the crop is dimmed, drawn as four bands so no
    // compositing mode is needed.
    ctx.fillStyle = FILL_OUTSIDE;
    ctx.fillRect(frame.x, frame.y, frame.w, ry - frame.y);
    ctx.fillRect(frame.x, ry + rh, frame.w, frame.y + frame.h - (ry + rh));
    ctx.fillRect(frame.x, ry, rx - frame.x, rh);
    ctx.fillRect(rx + rw, ry, frame.x + frame.w - (rx + rw), rh);

    ctx.strokeStyle = LINE_SOFT;
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(rx + (rw * i) / 3, ry);
        ctx.lineTo(rx + (rw * i) / 3, ry + rh);
        ctx.moveTo(rx, ry + (rh * i) / 3);
        ctx.lineTo(rx + rw, ry + (rh * i) / 3);
        ctx.stroke();
    }

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.fillStyle = HANDLE_FILL;
    for (const [, fx, fy] of HANDLES) {
        ctx.fillRect(rx + fx * rw - 3, ry + fy * rh - 3, 6, 6);
    }

    if (label) {
        ctx.font = "11px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const textW = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(frame.x + 4, frame.y + 4, textW + 8, 16);
        ctx.fillStyle = TEXT;
        ctx.fillText(label, frame.x + 8, frame.y + 6);
    }

    ctx.restore();
}
