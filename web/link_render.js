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
const CIRCUIT = "Circuit";
const TELEPHONE = "Telephone Line";
const CLAUDE = "Claude";
const DASHED = "Dashed";
const GHOST = "Ghost Wire";

const CLAUDE_COLOR = "#D97757"; // Claude's signature terracotta
const DASH_PATTERN = [10, 6]; // dash, gap -- in canvas units, scales with zoom
const GHOST_STUB = 22; // length of the visible nub when the wire itself is hidden

const STUB = 10; // straight run off a slot before the first bend
const CORNER = 10; // corner radius for Manhattan, cut length for Mitred

const SHARP = "sharp";
const ROUND = "round";
const CHAMFER = "chamfer";

let mode = DEFAULT;
let opacity = 1; // 0-1, only applied to the custom render modes below

// Tunables for Telephone Line mode, backed by their own settings below.
const telephone = { sag: 0.18, maxDip: 160 };

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

// --- telephone line --------------------------------------------------------
//
// A fixed sag, not a simulation: the wire is a quadratic curve whose control
// point sits below the midpoint of the two slots, like a cable strung between
// poles. The dip grows with the span so short hops stay close to straight
// while long ones sag properly, capped so a very long link doesn't dangle off
// the bottom of the screen.
function telephoneControl(ax, ay, bx, by) {
    const span = Math.hypot(bx - ax, by - ay);
    const dip = Math.min(span * telephone.sag, telephone.maxDip);
    return [(ax + bx) / 2, (ay + by) / 2 + dip];
}

// --- path building -------------------------------------------------------

function tracePolyline(ctx, pts, corner) {
    ctx.moveTo(pts[0][0], pts[0][1]);

    for (let i = 1; i < pts.length - 1; i++) {
        const [px, py] = pts[i - 1];
        const [cx, cy] = pts[i];
        const [nx, ny] = pts[i + 1];

        const inLen = Math.hypot(cx - px, cy - py);
        const outLen = Math.hypot(nx - cx, ny - cy);
        // A corner is only worth softening when both of its arms can give up
        // half their length to it; short elbows stay square.
        const size = corner === SHARP ? 0 : Math.min(CORNER, inLen / 2, outLen / 2);

        if (size < 0.5) {
            ctx.lineTo(cx, cy);
            continue;
        }
        if (corner === ROUND) {
            ctx.arcTo(cx, cy, nx, ny, size);
            continue;
        }
        ctx.lineTo(cx - ((cx - px) / inLen) * size, cy - ((cy - py) / inLen) * size);
        ctx.lineTo(cx + ((nx - cx) / outLen) * size, cy + ((ny - cy) / outLen) * size);
    }

    const end = pts[pts.length - 1];
    ctx.lineTo(end[0], end[1]);
}

// Flatter than the native spline: the controls stay strictly horizontal, so a
// link always leaves and enters its slot dead level.
function bezierOffset(ax, bx) {
    return Math.min(Math.max(Math.abs(bx - ax) * 0.4, 20), 80);
}

function tracePath(ctx, ax, ay, bx, by, pts) {
    if (mode === BEZIER || mode === CLAUDE || mode === DASHED) {
        const d = bezierOffset(ax, bx);
        ctx.moveTo(ax, ay);
        ctx.bezierCurveTo(ax + d, ay, bx - d, by, bx, by);
        return;
    }
    if (mode === TELEPHONE || mode === GHOST) {
        const [mx, my] = telephoneControl(ax, ay, bx, by);
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(mx, my, bx, by);
        return;
    }
    // Circuit shares Manhattan's right-angle routing but keeps its corners
    // square, like the plain rectilinear wires in a schematic diagram.
    const corner = mode === MANHATTAN ? ROUND : mode === MITRED ? CHAMFER : SHARP;
    tracePolyline(ctx, pts, corner);
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

// --- hover hit-testing -----------------------------------------------------
//
// LiteGraph only tracks hover for the little centre dot (over_link_center),
// not the wire itself. The custom routes get their own along-the-path hit
// test so the whole link can light up under the cursor.

const HOVER_PX = 6; // hit radius, in screen pixels, converted per-frame by scale

function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq)) : 0;
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function polylineDist(mx, my, pts) {
    let min = Infinity;
    for (let i = 1; i < pts.length; i++) {
        min = Math.min(min, distToSegment(mx, my, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
    }
    return min;
}

function quadPoint(t, ax, ay, cx, cy, bx, by) {
    const mt = 1 - t;
    return [mt * mt * ax + 2 * mt * t * cx + t * t * bx, mt * mt * ay + 2 * mt * t * cy + t * t * by];
}

function cubicPoint(t, ax, ay, c1x, c1y, c2x, c2y, bx, by) {
    const mt = 1 - t;
    return [
        mt * mt * mt * ax + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * bx,
        mt * mt * mt * ay + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * by,
    ];
}

function sampledCurveDist(mx, my, pointAt, steps = 20) {
    let min = Infinity;
    let prev = pointAt(0);
    for (let i = 1; i <= steps; i++) {
        const cur = pointAt(i / steps);
        min = Math.min(min, distToSegment(mx, my, prev[0], prev[1], cur[0], cur[1]));
        prev = cur;
    }
    return min;
}

function pathDist(mx, my, ax, ay, bx, by, pts) {
    if (mode === BEZIER || mode === CLAUDE || mode === DASHED) {
        const d = bezierOffset(ax, bx);
        return sampledCurveDist(mx, my, (t) => cubicPoint(t, ax, ay, ax + d, ay, bx - d, by, bx, by));
    }
    if (mode === TELEPHONE || mode === GHOST) {
        const [cx, cy] = telephoneControl(ax, ay, bx, by);
        return sampledCurveDist(mx, my, (t) => quadPoint(t, ax, ay, cx, cy, bx, by));
    }
    return polylineDist(mx, my, pts);
}

function isHovered(canvas, ax, ay, bx, by, pts) {
    const mouse = canvas.graph_mouse;
    if (!mouse) return false;
    const scale = Math.max(canvas.ds?.scale ?? 1, 0.05);
    return pathDist(mouse[0], mouse[1], ax, ay, bx, by, pts) <= HOVER_PX / scale;
}

function centreOf(ax, ay, bx, by, pts) {
    if (mode === BEZIER || mode === CLAUDE || mode === DASHED) {
        const d = bezierOffset(ax, bx);
        // A cubic bezier at t = 0.5 reduces to this weighted average.
        return [(ax + 3 * (ax + d) + 3 * (bx - d) + bx) / 8, (ay + 3 * ay + 3 * by + by) / 8];
    }
    if (mode === TELEPHONE || mode === GHOST) {
        const [mx, my] = telephoneControl(ax, ay, bx, by);
        // A quadratic bezier at t = 0.5 reduces to this weighted average.
        return [(ax + 2 * mx + bx) / 4, (ay + 2 * my + by) / 4];
    }
    return polylineCentre(pts);
}

// Claude's link-centre marker: a six-spoke asterisk (the shape of Claude's own
// logo mark) instead of a plain dot, drawn as tapered triangles so it stays
// crisp at small sizes rather than thinning to invisible hairlines.
function drawAsterisk(ctx, cx, cy, r) {
    const spokeWidth = r * 0.16;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const tipX = cx + Math.cos(a) * r;
        const tipY = cy + Math.sin(a) * r;
        const perp = a + Math.PI / 2;
        const baseX = cx + Math.cos(perp) * spokeWidth;
        const baseY = cy + Math.sin(perp) * spokeWidth;
        const base2X = cx - Math.cos(perp) * spokeWidth;
        const base2Y = cy - Math.sin(perp) * spokeWidth;
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(base2X, base2Y);
    }
    ctx.fill();
}

// --- canvas patch --------------------------------------------------------

// LLink carries its own type, but a link restored from an older workflow can
// come back without one — the input slot it lands on always knows.
// Ghost Wire visibility: a link is "live" while either end is selected.
// node.selected is the plain per-node flag LiteGraph already maintains for
// box-select and click-select alike, so this needs no bookkeeping of its own.
function nodeSelected(canvas, id) {
    return !!canvas.graph?.getNodeById?.(id)?.selected;
}

function linkType(canvas, link) {
    if (link?.type != null && link.type !== -1 && link.type !== "*") return link.type;
    const node = canvas.graph?.getNodeById?.(link?.target_id);
    return node?.inputs?.[link?.target_slot]?.type ?? null;
}

// The caller's colour wins because that is how the highlight and the white
// flow pulse are drawn. Otherwise the input's data type decides, so a link is
// coloured by what it carries rather than by whatever colour it was saved
// with, and a stored link colour is only used for types with no colour of
// their own.
function resolveColour(canvas, link, colour) {
    if (colour) return colour;

    const type = linkType(canvas, link);
    const typed = type != null && canvas.constructor.link_type_colors?.[type];
    if (typed) return typed;

    return link?.color || canvas.default_link_color || "#9A9";
}

function install() {
    const proto = window.LGraphCanvas?.prototype;
    if (!proto?.renderLink) return false;
    if (proto._mbLinkRenderPatched) return true;

    const original = proto.renderLink;
    proto._mbLinkRenderPatched = true;

    // The hover glow needs a fresh redraw every frame the mouse moves --
    // LiteGraph itself only marks the canvas dirty when the link-centre dot
    // is entered or left, not while crossing the body of a wire.
    if (proto.processMouseMove && !proto._mbLinkHoverPatched) {
        const originalMouseMove = proto.processMouseMove;
        proto._mbLinkHoverPatched = true;
        proto.processMouseMove = function (e) {
            const result = originalMouseMove.apply(this, arguments);
            if (mode !== DEFAULT) this.dirty_bgcanvas = true;
            return result;
        };
    }

    proto.renderLink = function (ctx, a, b, link, skipBorder, flow, colour, startDir, endDir, options) {
        // Reroute segments are drawn with the same a/b points as any other
        // segment, so the custom routing applies to them too -- otherwise a
        // link would switch back to the native spline the moment it touched
        // a reroute dot.
        if (mode === DEFAULT) {
            return original.apply(this, arguments);
        }

        const [ax, ay] = a;
        const [bx, by] = b;
        // Claude mode is solid brand colour throughout -- no per-type tinting --
        // so it reads as one consistent identity regardless of what a link carries.
        const stroke = mode === CLAUDE ? CLAUDE_COLOR : resolveColour(this, link, colour);
        const width = this.connections_width || 3;

        // Ghost Wire: the full telephone-sag curve only appears while one of
        // its two nodes is selected. Otherwise just a short nub pokes out of
        // each slot, enough to show a connection exists without cluttering
        // the graph with every wire at once.
        if (mode === GHOST && !nodeSelected(this, link?.origin_id) && !nodeSelected(this, link?.target_id)) {
            ctx.save();
            ctx.globalAlpha *= opacity * 0.6;
            ctx.strokeStyle = stroke;
            ctx.lineWidth = width;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax + GHOST_STUB, ay);
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - GHOST_STUB, by);
            ctx.stroke();
            ctx.restore();

            if (link) {
                const [cx, cy] = telephoneControl(ax, ay, bx, by);
                link._pos ??= new Float32Array(2);
                link._pos[0] = (ax + 2 * cx + bx) / 4;
                link._pos[1] = (ay + 2 * cy + by) / 4;
                link._centreAngle = 0;
            }
            return;
        }

        // Bezier, Telephone, Claude and Dashed are drawn as a single curve
        // command, so they don't need a discrete point list the way the
        // polyline modes do.
        const pts = mode === BEZIER || mode === TELEPHONE || mode === CLAUDE || mode === DASHED ? null : pointsFor(ax, ay, bx, by);

        const hover = !skipBorder && !!link && isHovered(this, ax, ay, bx, by, pts);

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha *= opacity;
        // Dash pattern lives inside this save/restore scope so it never leaks
        // into unrelated drawing (node borders, other links) once we're done.
        if (mode === DASHED) ctx.setLineDash(DASH_PATTERN);

        if (this.render_connections_border && this.ds.scale > 0.6 && !skipBorder) {
            ctx.strokeStyle = "rgba(0,0,0,0.6)";
            ctx.lineWidth = width + 4;
            ctx.beginPath();
            tracePath(ctx, ax, ay, bx, by, pts);
            ctx.stroke();
        }

        if (hover) {
            ctx.strokeStyle = "#fff";
            ctx.globalAlpha = Math.min(1, ctx.globalAlpha + 0.35);
            ctx.lineWidth = width + 6;
            ctx.beginPath();
            tracePath(ctx, ax, ay, bx, by, pts);
            ctx.stroke();
        }

        ctx.strokeStyle = stroke;
        ctx.lineWidth = hover ? width + 2 : width;
        if (flow) ctx.globalAlpha *= flow;
        ctx.beginPath();
        tracePath(ctx, ax, ay, bx, by, pts);
        ctx.stroke();
        ctx.restore();

        if (!link) return;

        const [cx, cy] = centreOf(ax, ay, bx, by, pts);
        link._pos ??= new Float32Array(2);
        link._pos[0] = cx;
        link._pos[1] = cy;
        link._centreAngle = 0; // every custom route is level at its midpoint

        if (this.ds.scale >= 0.6 && this.linkMarkerShape !== 0 && !skipBorder) {
            ctx.save();
            ctx.globalAlpha *= opacity;
            ctx.fillStyle = stroke;
            if (mode === CLAUDE) {
                drawAsterisk(ctx, cx, cy, width * 2.2);
            } else {
                ctx.beginPath();
                ctx.arc(cx, cy, width * 0.9, 0, Math.PI * 2);
                ctx.fill();
            }
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
            options: [DEFAULT, MANHATTAN, MITRED, DIAGONAL, BEZIER, CIRCUIT, TELEPHONE, CLAUDE, DASHED, GHOST],
            defaultValue: DEFAULT,
            onChange: (value) => {
                mode = value ?? DEFAULT;
                if (mode !== DEFAULT) install();
                app.canvas?.setDirty(true, true);
            },
        },
        {
            id: "MBNodes.LinkOpacity",
            category: ["MB", "Links", "Link opacity"],
            name: "Link opacity",
            tooltip: "Opacity of links drawn by the render mode above, as a percentage. Has no effect on Default. Applies live.",
            type: "slider",
            attrs: { min: 0, max: 100, step: 1 },
            defaultValue: 100,
            onChange: (value) => {
                opacity = (value ?? 100) / 100;
                app.canvas?.setDirty(true, true);
            },
        },
        {
            id: "MBNodes.Telephone.Sag",
            category: ["MB", "Links", "Telephone: sag"],
            name: "Telephone: sag",
            tooltip: "How much a Telephone Line link droops, as a fraction of the distance between its slots. Higher sags more.",
            type: "slider",
            attrs: { min: 0, max: 0.6, step: 0.01 },
            defaultValue: telephone.sag,
            onChange: (value) => {
                telephone.sag = value ?? telephone.sag;
            },
        },
        {
            id: "MBNodes.Telephone.MaxDip",
            category: ["MB", "Links", "Telephone: max dip"],
            name: "Telephone: max dip",
            tooltip: "Caps how far a Telephone Line link can droop, in pixels, so very long links don't sag off screen.",
            type: "slider",
            attrs: { min: 20, max: 400, step: 10 },
            defaultValue: telephone.maxDip,
            onChange: (value) => {
                telephone.maxDip = value ?? telephone.maxDip;
            },
        },
    ],

    async setup() {
        // onChange fires before the canvas class is loaded on a cold start, so
        // the patch is attempted once more when there is something to patch.
        mode = app.extensionManager?.setting?.get(SETTING_ID) ?? DEFAULT;
        if (mode !== DEFAULT) install();

        const setting = app.extensionManager?.setting;
        opacity = (setting?.get("MBNodes.LinkOpacity") ?? 100) / 100;
        telephone.sag = setting?.get("MBNodes.Telephone.Sag") ?? telephone.sag;
        telephone.maxDip = setting?.get("MBNodes.Telephone.MaxDip") ?? telephone.maxDip;
    },
});
