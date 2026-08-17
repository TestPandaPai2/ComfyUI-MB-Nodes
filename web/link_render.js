// Circuit-board link routing for the MBNodes pack.
//
// LiteGraph hard-codes its three link modes (LINK_RENDER_MODES = Straight,
// Linear, Spline) and offers no registration point for more, so the custom
// modes are drawn by wrapping LGraphCanvas.prototype.renderLink. The native
// links_render_mode is left untouched -- reroute control-point maths still
// reads it -- and "Default" simply defers to the original implementation.

import { app } from "../../scripts/app.js";

const SETTING_ID = "MBNodes.LinkRenderMode";

const DEFAULT = "Default";
const MANHATTAN = "Manhattan";
const MITRED = "Mitred";
const DIAGONAL = "Diagonal Bus";
const BEZIER = "Bezier Snap";

const STUB = 10; // straight run off a slot before the first bend
const CHAMFER = 10; // corner cut length for the mitred mode

let mode = DEFAULT;

// --- routing -------------------------------------------------------------

// Right angles only: out of the output, across a shared mid-line, into the
// input. A link that runs backwards has no room for a vertical mid-column, so
// it detours through a horizontal mid-row instead.
function orthoPoints(ax, ay, bx, by) {
    if (bx - STUB > ax + STUB) {
        const mx = (ax + STUB + bx - STUB) / 2;
        return [[ax, ay], [ax + STUB, ay], [mx, ay], [mx, by], [bx - STUB, by], [bx, by]];
    }
    const my = (ay + by) / 2;
    return [[ax, ay], [ax + STUB, ay], [ax + STUB, my], [bx - STUB, my], [bx - STUB, by], [bx, by]];
}

// Horizontal runs joined by a true 45-degree diagonal. The diagonal needs as
// much horizontal room as it covers vertically, so it is clipped to whatever
// gap is actually available.
function diagonalPoints(ax, ay, bx, by) {
    if (bx - STUB > ax + STUB) {
        const mx = (ax + STUB + bx - STUB) / 2;
        const half = Math.min(Math.abs(by - ay) / 2, (bx - STUB - ax - STUB) / 2);
        return [[ax, ay], [ax + STUB, ay], [mx - half, ay], [mx + half, by], [bx - STUB, by], [bx, by]];
    }
    const my = (ay + by) / 2;
    return [
        [ax, ay], [ax + STUB, ay], [ax + STUB + Math.abs(my - ay), my],
        [bx - STUB - Math.abs(by - my), my], [bx - STUB, by], [bx, by],
    ];
}

function pointsFor(ax, ay, bx, by) {
    return mode === DIAGONAL ? diagonalPoints(ax, ay, bx, by) : orthoPoints(ax, ay, bx, by);
}

// --- path building -------------------------------------------------------

function tracePolyline(ctx, pts, chamfer) {
    ctx.moveTo(pts[0][0], pts[0][1]);

    for (let i = 1; i < pts.length - 1; i++) {
        const [px, py] = pts[i - 1];
        const [cx, cy] = pts[i];
        const [nx, ny] = pts[i + 1];

        const inLen = Math.hypot(cx - px, cy - py);
        const outLen = Math.hypot(nx - cx, ny - cy);
        const cut = chamfer ? Math.min(CHAMFER, inLen / 2, outLen / 2) : 0;

        if (cut < 0.5) {
            ctx.lineTo(cx, cy);
            continue;
        }
        ctx.lineTo(cx - ((cx - px) / inLen) * cut, cy - ((cy - py) / inLen) * cut);
        ctx.lineTo(cx + ((nx - cx) / outLen) * cut, cy + ((ny - cy) / outLen) * cut);
    }

    const end = pts[pts.length - 1];
    ctx.lineTo(end[0], end[1]);
}

// Flatter than the native spline: the controls stay strictly horizontal, so a
// link always leaves and enters its slot dead level.
function bezierOffset(ax, bx) {
    return Math.min(Math.max(Math.abs(bx - ax) * 0.4, 20), 80);
}

function tracePath(ctx, ax, ay, bx, by) {
    if (mode === BEZIER) {
        const d = bezierOffset(ax, bx);
        ctx.moveTo(ax, ay);
        ctx.bezierCurveTo(ax + d, ay, bx - d, by, bx, by);
        return;
    }
    tracePolyline(ctx, pointsFor(ax, ay, bx, by), mode === MITRED);
}

// --- centre point --------------------------------------------------------

// LiteGraph puts the link's dot, tooltip and click target at link._pos, so the
// custom routes have to report a centre that actually sits on the drawn path.
function polylineCentre(pts) {
    const lengths = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
        const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        lengths.push(len);
        total += len;
    }

    let travelled = 0;
    for (let i = 0; i < lengths.length; i++) {
        if (travelled + lengths[i] >= total / 2) {
            const t = lengths[i] < 1e-6 ? 0 : (total / 2 - travelled) / lengths[i];
            return [
                pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
                pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t,
            ];
        }
        travelled += lengths[i];
    }
    return pts[pts.length - 1];
}

function centreOf(ax, ay, bx, by) {
    if (mode === BEZIER) {
        const d = bezierOffset(ax, bx);
        // A cubic bezier at t = 0.5 reduces to this weighted average.
        return [(ax + 3 * (ax + d) + 3 * (bx - d) + bx) / 8, (ay + 3 * ay + 3 * by + by) / 8];
    }
    return polylineCentre(pointsFor(ax, ay, bx, by));
}

// --- canvas patch --------------------------------------------------------

function resolveColour(canvas, link, colour) {
    if (colour) return colour;
    if (link?.color) return link.color;
    const typed = link?.type != null && canvas.constructor.link_type_colors?.[link.type];
    return typed || canvas.default_link_color || "#9A9";
}

function install() {
    const proto = window.LGraphCanvas?.prototype;
    if (!proto?.renderLink) return false;
    if (proto._mbLinkRenderPatched) return true;

    const original = proto.renderLink;
    proto._mbLinkRenderPatched = true;

    proto.renderLink = function (ctx, a, b, link, skipBorder, flow, colour, startDir, endDir, options) {
        // A reroute point carries its own control points and its own segment
        // maths; bending those by hand would detach the link from the dot the
        // user drags, so they keep the stock renderer.
        if (mode === DEFAULT || options?.reroute) {
            return original.apply(this, arguments);
        }

        const [ax, ay] = a;
        const [bx, by] = b;
        const stroke = resolveColour(this, link, colour);
        const width = this.connections_width || 3;

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (this.render_connections_border && this.ds.scale > 0.6 && !skipBorder) {
            ctx.strokeStyle = "rgba(0,0,0,0.6)";
            ctx.lineWidth = width + 4;
            ctx.beginPath();
            tracePath(ctx, ax, ay, bx, by);
            ctx.stroke();
        }

        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        if (flow) ctx.globalAlpha *= flow;
        ctx.beginPath();
        tracePath(ctx, ax, ay, bx, by);
        ctx.stroke();
        ctx.restore();

        if (!link) return;

        const [cx, cy] = centreOf(ax, ay, bx, by);
        link._pos ??= new Float32Array(2);
        link._pos[0] = cx;
        link._pos[1] = cy;
        link._centreAngle = 0; // every custom route is level at its midpoint

        if (this.ds.scale >= 0.6 && this.linkMarkerShape !== 0 && !skipBorder) {
            ctx.save();
            ctx.fillStyle = stroke;
            ctx.beginPath();
            ctx.arc(cx, cy, width * 0.9, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    };

    return true;
}

app.registerExtension({
    name: "MBNodes.LinkRender",

    settings: [
        {
            id: SETTING_ID,
            category: ["MB", "Links", "Link render mode"],
            name: "Link render mode",
            tooltip: "Circuit-board routing for links. Default hands back to ComfyUI's own link style.",
            type: "combo",
            options: [DEFAULT, MANHATTAN, MITRED, DIAGONAL, BEZIER],
            defaultValue: DEFAULT,
            onChange: (value) => {
                mode = value ?? DEFAULT;
                if (mode !== DEFAULT) install();
                app.canvas?.setDirty(true, true);
            },
        },
    ],

    async setup() {
        // onChange fires before the canvas class is loaded on a cold start, so
        // the patch is attempted once more when there is something to patch.
        mode = app.extensionManager?.setting?.get(SETTING_ID) ?? DEFAULT;
        if (mode !== DEFAULT) install();
    },
});
