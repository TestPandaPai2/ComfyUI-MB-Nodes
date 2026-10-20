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
const PCB = "PCB Trace";
const BEZIER = "Bezier Snap";
const CIRCUIT = "Circuit";
const TELEPHONE = "Telephone Line";
const CLAUDE = "Claude";
const DASHED = "Dashed";
const GHOST = "Ghost Wire";
const TENSION = "Tension";
const SPOTLIGHT = "Spotlight";
const FADE_MID = "Fade Mid";
const HAIRLINE = "Hairline";
const TELEPORT = "Teleport";
const BUNDLE = "Bundle";

const SPOTLIGHT_DIM = 0.15; // alpha of links away from the selected / hovered node
const FADE_MID_ALPHA = 0.08; // Fade Mid's alpha at the middle of the link
const HAIRLINE_COLOR = "rgba(150,150,150,0.75)";
const TAG_ROOM = 16; // space after a Teleport stub for its tag
const BUNDLE_SHARE = 0.6; // fraction of the way to the nearest target the shared trunk runs

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

// Tunables for Tension mode, backed by their own settings below. Unlike
// Telephone Line's sag (which grows with span), tension works backwards: a
// short link is slack and bows like loose rope, while a link stretched past
// `reach` pulls taut into a straight line -- and thins out as it does, like a
// rubber band pulled tight.
const tension = { bow: 90, reach: 260 };

// Teleport: links longer than this (canvas px) collapse to tagged stubs.
let teleportDistance = 600;
const TENSION_MIN_WIDTH = 0.6;
const TENSION_MAX_WIDTH = 1.4;

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

function pointsFor(bx, by) {
    return mode === DIAGONAL || mode === PCB ? diagonalPoints(0, 0, bx, by) : orthoPoints(0, 0, bx, by);
}

// --- link frame ------------------------------------------------------------
//
// Every route is worked out with the output at the origin, leaving along +x,
// then rotated to the slot's real direction (LiteGraph's LinkDirection:
// UP 1, DOWN 2, LEFT 3, RIGHT 4). Vertical slots and reroute exits get the
// same shapes as the usual left-to-right link.
const DIR_ANGLE = { 1: -Math.PI / 2, 2: Math.PI / 2, 3: Math.PI, 4: 0 };

function frameFor(ax, ay, startDir) {
    const angle = DIR_ANGLE[startDir] ?? 0;
    return { ax, ay, angle, cos: Math.cos(angle), sin: Math.sin(angle) };
}

function toLocal(f, x, y) {
    const dx = x - f.ax;
    const dy = y - f.ay;
    return [dx * f.cos + dy * f.sin, -dx * f.sin + dy * f.cos];
}

function toWorld(f, x, y) {
    return [f.ax + x * f.cos - y * f.sin, f.ay + x * f.sin + y * f.cos];
}

const isCurveMode = () => [BEZIER, CLAUDE, DASHED, TELEPHONE, GHOST, TENSION, SPOTLIGHT, FADE_MID, HAIRLINE, TELEPORT, BUNDLE].includes(mode);

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

// --- tension ---------------------------------------------------------------
//
// The mirror image of Telephone Line: bow shrinks as the link stretches, so a
// link between neighbours hangs loose while one spanning the graph is pulled
// straight. `t` (0 = fully slack, 1 = fully taut) drives both the bow and the
// stroke width, so a taut link reads as thinner, not just straighter.
function tensionAmount(ax, ay, bx, by) {
    const span = Math.hypot(bx - ax, by - ay);
    return Math.min(span / tension.reach, 1);
}

function tensionControl(ax, ay, bx, by) {
    const t = tensionAmount(ax, ay, bx, by);
    const bow = tension.bow * (1 - t);
    return [(ax + bx) / 2, (ay + by) / 2 + bow];
}

function tensionWidthMul(ax, ay, bx, by) {
    const t = tensionAmount(ax, ay, bx, by);
    return TENSION_MAX_WIDTH - (TENSION_MAX_WIDTH - TENSION_MIN_WIDTH) * t;
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
// link always leaves and enters its slot dead level. A link running backwards
// gets longer controls so it loops out of the output and into the input
// instead of cutting straight back across both nodes.
function bezierOffset(bx) {
    return bx >= 0 ? Math.min(Math.max(bx * 0.4, 20), 80) : Math.min(Math.max(-bx * 0.5, 40), 160);
}

// The curve modes in the local frame (output at the origin), for a shape
// `g` = { bx, by, pts, trunk }. Telephone, Ghost and Tension sag as a
// quadratic; running backwards they have nothing to hang between, so they
// loop like Bezier Snap instead. Bundle runs a straight shared trunk first and
// only curves off it towards its own target.
function curveFor(g) {
    const { bx, by, trunk } = g;
    if (bx >= 0 && (mode === TELEPHONE || mode === GHOST)) return { from: 0, quad: telephoneControl(0, 0, bx, by) };
    if (bx >= 0 && mode === TENSION) return { from: 0, quad: tensionControl(0, 0, bx, by) };
    const from = trunk && bx > trunk ? trunk : 0;
    const d = bezierOffset(bx - from);
    return { from, cubic: [from + d, 0, bx - d, by] };
}

function tracePath(ctx, g) {
    if (!g.pts) {
        const c = curveFor(g);
        ctx.moveTo(0, 0);
        if (c.from) ctx.lineTo(c.from, 0);
        if (c.quad) ctx.quadraticCurveTo(c.quad[0], c.quad[1], g.bx, g.by);
        else ctx.bezierCurveTo(c.cubic[0], c.cubic[1], c.cubic[2], c.cubic[3], g.bx, g.by);
        return;
    }
    // Circuit shares Manhattan's right-angle routing but keeps its corners
    // square, like the plain rectilinear wires in a schematic diagram.
    const corner = mode === MANHATTAN ? ROUND : mode === MITRED ? CHAMFER : SHARP;
    tracePolyline(ctx, g.pts, corner);
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

function pathDist(mx, my, g) {
    const { bx, by, pts } = g;
    if (g.stubs) {
        // A collapsed Teleport link: only its two stubs and their tags.
        const reach = GHOST_STUB + TAG_ROOM;
        return Math.min(distToSegment(mx, my, 0, 0, reach, 0), distToSegment(mx, my, bx, by, bx - reach, by));
    }
    if (pts) return polylineDist(mx, my, pts);
    const c = curveFor(g);
    if (c.quad) return sampledCurveDist(mx, my, (t) => quadPoint(t, 0, 0, c.quad[0], c.quad[1], bx, by));
    const curve = sampledCurveDist(mx, my, (t) => cubicPoint(t, c.from, 0, c.cubic[0], c.cubic[1], c.cubic[2], c.cubic[3], bx, by));
    return c.from ? Math.min(curve, distToSegment(mx, my, 0, 0, c.from, 0)) : curve;
}

// Geometry of every link drawn so far, by link id, so the mouse can be tested
// against them between frames: the background only redraws when the hovered
// link actually changes, not on every mouse move.
const hitTests = new Map();
let hoveredId = null;
let nodeOverId = null;

function linkExists(canvas, id) {
    const links = canvas.graph?.links;
    return !!(links?.get?.(id) ?? links?.[id]);
}

function findHovered(canvas) {
    const mouse = canvas.graph_mouse;
    if (!mouse) return null;
    const reach = HOVER_PX / Math.max(canvas.ds?.scale ?? 1, 0.05);
    for (const [id, hit] of hitTests) {
        if (!linkExists(canvas, id)) {
            hitTests.delete(id);
            continue;
        }
        const [mx, my] = toLocal(hit.f, mouse[0], mouse[1]);
        if (pathDist(mx, my, hit.g) <= reach) return id;
    }
    return null;
}

function centreOf(g) {
    const { bx, by } = g;
    if (g.pts) return polylineCentre(g.pts);
    const c = curveFor(g);
    // A bezier at t = 0.5 reduces to these weighted averages.
    if (c.quad) return [(2 * c.quad[0] + bx) / 4, (2 * c.quad[1] + by) / 4];
    return [(c.from + 3 * c.cubic[0] + 3 * c.cubic[2] + bx) / 8, (3 * c.cubic[1] + 3 * c.cubic[3] + by) / 8];
}

// --- clean modes -----------------------------------------------------------

// Spotlight / Teleport focus: a link is "in focus" while a node at either end
// is selected or under the mouse.
function inFocus(canvas, link) {
    if (!link) return true;
    const over = canvas.node_over?.id;
    return over != null && (over === link.origin_id || over === link.target_id)
        || nodeSelected(canvas, link.origin_id) || nodeSelected(canvas, link.target_id);
}

// Fade Mid needs the stroke colour at a chosen alpha; link colours are hex.
function withAlpha(colour, alpha) {
    const hex = /^#([0-9a-f]{3,8})$/i.exec(colour)?.[1];
    if (!hex) return colour;
    const full = hex.length < 6 ? [...hex.slice(0, 3)].map((c) => c + c).join("") : hex.slice(0, 6);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    return `rgba(${r},${g},${b},${alpha})`;
}

// Teleport tags: A..Z, then AA, AB... from the link id, so both ends match
// and the tag stays the same across redraws.
function tagFor(id) {
    let n = Number(id);
    let tag = "";
    do {
        tag = String.fromCharCode(65 + (n % 26)) + tag;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return tag;
}

// Bundle: every link off one output shares a straight trunk that runs to just
// short of the nearest target, so N links leave the slot as one wire.
function bundleTrunk(canvas, link, f) {
    const output = canvas.graph?.getNodeById?.(link?.origin_id)?.outputs?.[link.origin_slot];
    if (!output?.links || output.links.length < 2) return 0;
    let nearest = Infinity;
    for (const id of output.links) {
        const sibling = canvas.graph.links?.get?.(id) ?? canvas.graph.links?.[id];
        const target = sibling && canvas.graph.getNodeById(sibling.target_id);
        const pos = target?.getInputPos?.(sibling.target_slot) ?? target?.getConnectionPos?.(true, sibling.target_slot);
        if (!pos) continue;
        const [x] = toLocal(f, pos[0], pos[1]);
        if (x > 0) nearest = Math.min(nearest, x);
    }
    return Number.isFinite(nearest) ? Math.max(STUB, nearest * BUNDLE_SHARE) : 0;
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

// PCB Trace decoration: a filled dot at each diagonal bend (the two inner
// corners of the diagonal path -- the stub corners right off the slots are
// skipped, they'd sit too close to the endpoint rings to read) and a hollow
// ring at each end, like the pads/vias in a circuit-board trace.
function drawPcbDots(ctx, pts, stroke, width) {
    ctx.save();
    ctx.globalAlpha *= opacity;
    ctx.fillStyle = stroke;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, width * 0.35);

    const dotR = width * 0.9;
    for (let i = 2; i <= pts.length - 3; i++) {
        ctx.beginPath();
        ctx.arc(pts[i][0], pts[i][1], dotR, 0, Math.PI * 2);
        ctx.fill();
    }

    const ringR = width * 1.1;
    for (const [ex, ey] of [pts[0], pts[pts.length - 1]]) {
        ctx.beginPath();
        ctx.arc(ex, ey, ringR, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
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

    // LiteGraph only marks the canvas dirty when the link-centre dot is entered
    // or left, so the hover glow asks for a redraw itself -- but only when the
    // hovered link changes, tested against the cached geometry.
    if (proto.processMouseMove && !proto._mbLinkHoverPatched) {
        const originalMouseMove = proto.processMouseMove;
        proto._mbLinkHoverPatched = true;
        proto.processMouseMove = function (e) {
            const result = originalMouseMove.apply(this, arguments);
            if (mode !== DEFAULT) {
                const id = findHovered(this);
                // Spotlight and Teleport also follow the node under the mouse.
                const over = this.node_over?.id ?? null;
                if (id !== hoveredId || over !== nodeOverId) {
                    hoveredId = id;
                    nodeOverId = over;
                    this.dirty_bgcanvas = true;
                }
            }
            return result;
        };
    }

    // LiteGraph opens the link menu from a click on link._pos. Parking it under
    // the cursor when a glowing wire is clicked makes the whole wire clickable,
    // not just its centre dot; the next draw puts it back.
    if (proto.processMouseDown && !proto._mbLinkClickPatched) {
        const originalMouseDown = proto.processMouseDown;
        proto._mbLinkClickPatched = true;
        proto.processMouseDown = function (e) {
            const hit = mode !== DEFAULT && hoveredId != null ? hitTests.get(hoveredId) : null;
            const mouse = this.graph_mouse;
            if (hit && mouse && !this.graph?.getNodeOnPos?.(mouse[0], mouse[1])) {
                hit.link._pos ??= new Float32Array(2);
                hit.link._pos[0] = mouse[0];
                hit.link._pos[1] = mouse[1];
            }
            return originalMouseDown.apply(this, arguments);
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

        const f = frameFor(a[0], a[1], startDir);
        const [bx, by] = toLocal(f, b[0], b[1]);
        const typed = resolveColour(this, link, colour);
        // Claude mode is solid brand colour throughout -- no per-type tinting --
        // so it reads as one consistent identity regardless of what a link carries.
        // Hairline is one muted grey; its type colour shows only in the end dots.
        const stroke = mode === CLAUDE ? CLAUDE_COLOR : mode === HAIRLINE ? colour || HAIRLINE_COLOR : typed;
        const base = mode === HAIRLINE ? 1 : this.connections_width || 3;
        const width = mode === TENSION ? base * tensionWidthMul(0, 0, bx, by) : base;
        const hover = !skipBorder && link?.id != null && link.id === hoveredId;

        ctx.save();
        ctx.translate(f.ax, f.ay);
        ctx.rotate(f.angle);

        // Ghost Wire: the full telephone-sag curve only appears while one of
        // its two nodes is selected. Otherwise just a short nub pokes out of
        // each slot, enough to show a connection exists without cluttering
        // the graph with every wire at once. A link still being dragged has no
        // nodes yet and is always drawn in full.
        const ghosted = mode === GHOST && link && !nodeSelected(this, link.origin_id) && !nodeSelected(this, link.target_id);
        // Teleport: a long link collapses to tagged stubs unless it is hovered
        // or one of its nodes is selected or under the mouse.
        const teleported = mode === TELEPORT && link && !hover && !inFocus(this, link)
            && Math.hypot(bx, by) > teleportDistance;

        if (ghosted || teleported) {
            ctx.globalAlpha *= opacity * (ghosted ? 0.6 : 1);
            ctx.strokeStyle = stroke;
            ctx.lineWidth = width;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(GHOST_STUB, 0);
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - GHOST_STUB, by);
            ctx.stroke();
            ctx.restore();

            if (teleported && this.ds.scale >= 0.4) {
                // Drawn unrotated so the tag reads upright on any slot direction.
                const tag = tagFor(link.id);
                ctx.save();
                ctx.globalAlpha *= opacity;
                ctx.font = "bold 10px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.lineWidth = 3;
                ctx.strokeStyle = "rgba(0,0,0,0.7)";
                ctx.fillStyle = stroke;
                for (const [x, y] of [toWorld(f, GHOST_STUB + TAG_ROOM / 2, 0), toWorld(f, bx - GHOST_STUB - TAG_ROOM / 2, by)]) {
                    ctx.strokeText(tag, x, y);
                    ctx.fillText(tag, x, y);
                }
                ctx.restore();
            }

            // A ghosted wire has no click target or hover; a teleported one
            // is hovered through its stubs, which brings the full wire back.
            if (teleported) hitTests.set(link.id, { link, f, g: { bx, by, stubs: true } });
            else hitTests.delete(link.id);
            link._pos ??= new Float32Array(2);
            link._pos[0] = NaN;
            link._pos[1] = NaN;
            return;
        }

        const g = {
            bx, by,
            pts: isCurveMode() ? null : pointsFor(bx, by),
            trunk: mode === BUNDLE ? bundleTrunk(this, link, f) : 0,
        };
        const focus = mode === SPOTLIGHT && inFocus(this, link);
        const alpha = opacity * (mode === SPOTLIGHT && !focus && !hover ? SPOTLIGHT_DIM : 1);
        const fading = mode === FADE_MID && !hover;

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha *= alpha;
        // Dash pattern lives inside this save/restore scope so it never leaks
        // into unrelated drawing (node borders, other links) once we're done.
        if (mode === DASHED) ctx.setLineDash(DASH_PATTERN);

        if (this.render_connections_border && this.ds.scale > 0.6 && !skipBorder && mode !== HAIRLINE && !fading) {
            ctx.strokeStyle = "rgba(0,0,0,0.6)";
            ctx.lineWidth = width + 4;
            ctx.beginPath();
            tracePath(ctx, g);
            ctx.stroke();
        }

        if (fading) {
            const gradient = ctx.createLinearGradient(0, 0, bx, by);
            gradient.addColorStop(0, stroke);
            gradient.addColorStop(0.5, withAlpha(stroke, FADE_MID_ALPHA));
            gradient.addColorStop(1, stroke);
            ctx.strokeStyle = gradient;
        } else {
            ctx.strokeStyle = stroke;
        }
        ctx.lineWidth = hover || focus ? width + 1 : width;
        if (flow) ctx.globalAlpha *= flow;
        ctx.beginPath();
        tracePath(ctx, g);
        ctx.stroke();
        ctx.restore();

        if (mode === PCB && this.ds.scale >= 0.6 && !skipBorder) {
            drawPcbDots(ctx, g.pts, stroke, width);
        }

        if (mode === HAIRLINE && this.ds.scale >= 0.6) {
            ctx.save();
            ctx.globalAlpha *= alpha;
            ctx.fillStyle = typed;
            for (const [x, y] of [[0, 0], [bx, by]]) {
                ctx.beginPath();
                ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // Hairline and Fade Mid stay bare: no dot in the middle of the wire.
        const [lcx, lcy] = centreOf(g);
        const marker = mode !== HAIRLINE && !fading;
        if (marker && link && this.ds.scale >= 0.6 && this.linkMarkerShape !== 0 && !skipBorder) {
            ctx.globalAlpha *= alpha;
            ctx.fillStyle = stroke;
            if (mode === CLAUDE) {
                drawAsterisk(ctx, lcx, lcy, width * 2.2);
            } else {
                ctx.beginPath();
                ctx.arc(lcx, lcy, width * 0.9, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();

        if (!link) return;

        const [cx, cy] = toWorld(f, lcx, lcy);
        link._pos ??= new Float32Array(2);
        link._pos[0] = cx;
        link._pos[1] = cy;
        link._centreAngle = f.angle; // every custom route is level at its midpoint, in its own frame
        if (link.id != null) hitTests.set(link.id, { link, f, g });
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
            options: [DEFAULT, MANHATTAN, MITRED, DIAGONAL, PCB, BEZIER, CIRCUIT, TELEPHONE, CLAUDE, DASHED, GHOST, TENSION, SPOTLIGHT, FADE_MID, HAIRLINE, TELEPORT, BUNDLE],
            defaultValue: DEFAULT,
            onChange: (value) => {
                mode = value ?? DEFAULT;
                hitTests.clear();
                hoveredId = null;
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
                app.canvas?.setDirty(true, true);
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
                app.canvas?.setDirty(true, true);
            },
        },
        {
            id: "MBNodes.Tension.Bow",
            category: ["MB", "Links", "Tension: bow"],
            name: "Tension: bow",
            tooltip: "How far a fully slack Tension link bows, in pixels. A link stretched past the reach distance below straightens out regardless.",
            type: "slider",
            attrs: { min: 0, max: 300, step: 10 },
            defaultValue: tension.bow,
            onChange: (value) => {
                tension.bow = value ?? tension.bow;
                app.canvas?.setDirty(true, true);
            },
        },
        {
            id: "MBNodes.Tension.Reach",
            category: ["MB", "Links", "Tension: reach"],
            name: "Tension: reach",
            tooltip: "Distance, in pixels, at which a Tension link goes fully taut -- straight and thin. Shorter links stay slack and bowed.",
            type: "slider",
            attrs: { min: 40, max: 800, step: 20 },
            defaultValue: tension.reach,
            onChange: (value) => {
                tension.reach = value ?? tension.reach;
                app.canvas?.setDirty(true, true);
            },
        },
        {
            id: "MBNodes.Teleport.Distance",
            category: ["MB", "Links", "Teleport: distance"],
            name: "Teleport: distance",
            tooltip: "Teleport links longer than this, in pixels, collapse to tagged stubs. Hover a stub or select a node to see the full link.",
            type: "slider",
            attrs: { min: 100, max: 3000, step: 50 },
            defaultValue: teleportDistance,
            onChange: (value) => {
                teleportDistance = value ?? teleportDistance;
                app.canvas?.setDirty(true, true);
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
        tension.bow = setting?.get("MBNodes.Tension.Bow") ?? tension.bow;
        tension.reach = setting?.get("MBNodes.Tension.Reach") ?? tension.reach;
        teleportDistance = setting?.get("MBNodes.Teleport.Distance") ?? teleportDistance;
    },
});
