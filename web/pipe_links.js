import { app } from "../../scripts/app.js";
import { accentColor, notify } from "./common.js";

// Pipe em!: drag a box over links to bundle them into a thin string with a knot.
// Purely visual: wires are untouched, pipes are saved in graph.extra. Native reroutes can't do this, as
// links from different outputs through one reroute lose their first segment.
const MIN_LENGTH = 80;
const STRING_WIDTH = 2.5;
const STRING_BEND = 0.12; // sideways curve, as a share of the string's length
const KNOT_RADIUS = 7;
const KNOT_HIT = 12;
const SAMPLES = 24;

let armed = false;
let box = null; // [x0, y0, x1, y1] while dragging out the selection
let moving = null; // { pipe, last } while dragging a tie
let swallowMenu = false;

const pipesOf = (graph) => graph?.extra?.mbPipes ?? [];
const middle = (pipe) => [(pipe.a[0] + pipe.b[0]) / 2, (pipe.a[1] + pipe.b[1]) / 2];

function allLinks(graph) {
    return [...(graph.links?.values?.() ?? Object.values(graph.links ?? {}))];
}

function linkEnds(graph, link) {
    const from = graph.getNodeById(link.origin_id);
    const to = graph.getNodeById(link.target_id);
    if (!from || !to) return null;
    return [from.getOutputPos(link.origin_slot), to.getInputPos(link.target_slot)];
}

// This link's pipes in travel order, from the output to the input.
function routeOf(graph, link, start, end) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const along = (pipe) => {
        const [x, y] = middle(pipe);
        return (x - start[0]) * dx + (y - start[1]) * dy;
    };
    return pipesOf(graph)
        .filter((pipe) => pipe.links.includes(link.id))
        .sort((p, q) => along(p) - along(q));
}

function curvePoints(a, b) {
    const pull = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.25;
    const points = [];
    for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES;
        const u = 1 - t;
        points.push([
            u * u * u * a[0] + 3 * u * u * t * (a[0] + pull) + 3 * u * t * t * (b[0] - pull) + t * t * t * b[0],
            u * u * u * a[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * b[1],
        ]);
    }
    return points;
}

// Points of the link inside the box, following any pipes it already runs through.
function pointsInBox(graph, link, [x0, y0, x1, y1]) {
    const ends = linkEnds(graph, link);
    if (!ends) return [];

    const [start, end] = ends;
    const legs = [];
    let from = start;
    for (const pipe of routeOf(graph, link, start, end)) {
        legs.push([from, pipe.a]);
        from = pipe.b;
    }
    legs.push([from, end]);

    const inside = ([x, y]) => x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && y >= Math.min(y0, y1) && y <= Math.max(y0, y1);
    return legs.flatMap(([a, b]) => curvePoints(a, b)).filter(inside);
}

function makePipe(graph, rect) {
    const picked = allLinks(graph)
        .filter((link) => link.parentId == null)
        .map((link) => ({ link, hits: pointsInBox(graph, link, rect) }))
        .filter(({ hits }) => hits.length);

    if (picked.length < 2) {
        notify("warn", "Nothing to pipe", "Drag over at least two links without reroutes.");
        return;
    }

    let cx = 0, cy = 0, dx = 0, dy = 0, span = 0;
    for (const { link, hits } of picked) {
        cx += hits.reduce((sum, p) => sum + p[0], 0) / hits.length;
        cy += hits.reduce((sum, p) => sum + p[1], 0) / hits.length;
        const [start, end] = linkEnds(graph, link);
        dx += end[0] - start[0];
        dy += end[1] - start[1];
        span += Math.hypot(end[0] - start[0], end[1] - start[1]);
    }
    const count = picked.length;
    cx /= count;
    cy /= count;

    const size = Math.hypot(dx, dy) || 1;
    const half = Math.max(MIN_LENGTH, (span / count) * 0.4) / 2;
    const ux = (dx / size) * half;
    const uy = (dy / size) * half;

    graph.extra ??= {};
    graph.extra.mbPipes = [...pipesOf(graph), {
        links: picked.map(({ link }) => link.id),
        a: [cx - ux, cy - uy],
        b: [cx + ux, cy + uy],
    }];
}

function livePipes(graph) {
    return pipesOf(graph).filter((pipe) => pipe.links.some((id) => graph.getLink?.(id)));
}

function tieAt(graph, x, y) {
    return livePipes(graph).find((pipe) => {
        const [mx, my] = middle(pipe);
        return Math.hypot(x - mx, y - my) <= KNOT_HIT;
    });
}

function drawPipes(ctx, graph) {
    for (const pipe of livePipes(graph)) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineWidth = STRING_WIDTH;
        ctx.strokeStyle = "#a0a0a6";
        const dx = pipe.b[0] - pipe.a[0];
        const dy = pipe.b[1] - pipe.a[1];
        // An S bend, so the string still passes through the knot at its middle.
        const bendX = -dy * STRING_BEND;
        const bendY = dx * STRING_BEND;
        ctx.beginPath();
        ctx.moveTo(...pipe.a);
        ctx.bezierCurveTo(
            pipe.a[0] + dx / 3 + bendX, pipe.a[1] + dy / 3 + bendY,
            pipe.b[0] - dx / 3 - bendX, pipe.b[1] - dy / 3 - bendY,
            ...pipe.b,
        );
        ctx.stroke();

        ctx.fillStyle = accentColor();
        ctx.beginPath();
        ctx.arc(...middle(pipe), KNOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function wrapRenderer(canvas) {
    const proto = canvas.constructor.prototype;
    const renderLink = proto.renderLink;
    proto.renderLink = function (ctx, start, end, link, skipBorder, flow, color, startDir, endDir, options) {
        const route = link?.id != null && link.parentId == null && !options?.reroute
            ? routeOf(this.graph, link, start, end)
            : [];
        if (!route.length) return renderLink.apply(this, arguments);

        let from = start;
        let fromDir = startDir;
        for (const pipe of route) {
            renderLink.call(this, ctx, from, pipe.a, link, skipBorder, flow, color, fromDir, LiteGraph.LEFT, options);
            from = pipe.b;
            fromDir = LiteGraph.RIGHT;
        }
        return renderLink.call(this, ctx, from, end, link, skipBorder, flow, color, fromDir, endDir, options);
    };

    const onBackground = canvas.onDrawBackground;
    canvas.onDrawBackground = function (ctx, area) {
        onBackground?.call(this, ctx, area);
        drawPipes(ctx, this.graph);
    };

    const onForeground = canvas.onDrawForeground;
    canvas.onDrawForeground = function (ctx, area) {
        onForeground?.call(this, ctx, area);
        if (!box) return;
        ctx.save();
        ctx.strokeStyle = accentColor();
        ctx.lineWidth = 1 / this.ds.scale;
        ctx.setLineDash([6 / this.ds.scale, 4 / this.ds.scale]);
        ctx.strokeRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
        ctx.restore();
    };
}

function setArmed(on) {
    armed = on;
    app.canvas.canvas.style.cursor = on ? "crosshair" : "";
}

function swallow(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
}

function onPointerDown(event) {
    const canvas = app.canvas;
    if (event.target !== canvas.canvas) return;
    const [x, y] = canvas.convertEventToCanvasOffset(event);

    if (armed) {
        swallow(event);
        if (event.button === 0) box = [x, y, x, y];
        else {
            setArmed(false);
            swallowMenu = true;
        }
        return;
    }

    const graph = canvas.graph;
    if (graph?.getNodeOnPos(x, y)) return;
    const pipe = tieAt(graph, x, y);
    if (!pipe) return;

    swallow(event);
    if (event.button === 0) moving = { pipe, last: [x, y] };
    else if (event.button === 2) {
        graph.extra.mbPipes = pipesOf(graph).filter((other) => other !== pipe);
        swallowMenu = true;
        canvas.setDirty(true, true);
    }
}

function onPointerMove(event) {
    if (!box && !moving) return;
    swallow(event);
    const canvas = app.canvas;
    const [x, y] = canvas.convertEventToCanvasOffset(event);

    if (box) {
        box[2] = x;
        box[3] = y;
    } else {
        const dx = x - moving.last[0];
        const dy = y - moving.last[1];
        for (const end of [moving.pipe.a, moving.pipe.b]) {
            end[0] += dx;
            end[1] += dy;
        }
        moving.last = [x, y];
    }
    canvas.setDirty(true, true);
}

function onPointerUp(event) {
    if (!box && !moving) return;
    swallow(event);
    if (box) {
        makePipe(app.canvas.graph, box);
        box = null;
        setArmed(false);
    }
    moving = null;
    app.canvas.setDirty(true, true);
}

function onKeyDown(event) {
    if (event.key !== "Escape" || !armed) return;
    swallow(event);
    box = null;
    setArmed(false);
    app.canvas.setDirty(true, true);
}

function onContextMenu(event) {
    if (!swallowMenu) return;
    swallowMenu = false;
    swallow(event);
}

app.registerExtension({
    name: "MBNodes.PipeLinks",

    setup() {
        wrapRenderer(app.canvas);
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("pointermove", onPointerMove, true);
        document.addEventListener("pointerup", onPointerUp, true);
        document.addEventListener("keydown", onKeyDown, true);
        document.addEventListener("contextmenu", onContextMenu, true);
    },

    getCanvasMenuItems() {
        return [null, { content: "Pipe em!", callback: () => setArmed(true) }];
    },
});
