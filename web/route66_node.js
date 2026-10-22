import { app } from "../../scripts/app.js";
import { resizeToContent } from "./common.js";

// Route 66 -- multi-lane reroute.
//
// Backend declares MAX_LANES optional any-type input/output pairs. This script
// keeps the node looking minimal like a native reroute: it shows only the
// lanes that are in use plus ONE trailing empty pair, and adopts the wire's
// type per lane (so each socket takes the colour of what plugs in). Each lane
// is labelled on its output side with its name (double-click the output to
// set one) or the type it carries.
//
// Lane i input  -> "value_i" (backend maps inputs by NAME, so names stay fixed)
// Lane i output -> "out_i"   (backend maps outputs by INDEX, so lanes stay
//                             contiguous from 0 -- never leave an index gap)

const NODE_ID = "MBRoute66";
const MAX_LANES = 20;
const ANY = "*";
const BLANK = " "; // an empty label falls back to the slot name

function laneNames(node) {
    node.properties ??= {};
    return (node.properties.r66Names ??= {});
}

// Links leaving output `slot`. graph.links is a Map keyed by link id.
function linksFrom(node, slot) {
    const out = [];
    for (const link of node.graph?.links?.values?.() ?? []) {
        if (link.origin_id === node.id && link.origin_slot === slot) out.push(link);
    }
    return out;
}

function sourceTypeOf(node, inputIndex) {
    // Type of whatever is plugged into this input, or ANY if nothing.
    const link = node.graph?.getLink(node.inputs?.[inputIndex]?.link);
    if (!link) return ANY;
    const origin = node.graph.getNodeById(link.origin_id);
    return origin?.outputs?.[link.origin_slot]?.type ?? ANY;
}

function laneUsed(node, i) {
    return node.inputs?.[i]?.link != null || node.isOutputConnected(i);
}

function usedCount(node) {
    let n = 0;
    for (let i = 0; i < (node.inputs?.length ?? 0); i++) if (laneUsed(node, i)) n++;
    return n;
}

// Wires hanging off an output whose lane now carries a type they can't take
// (output was wired first, then a different type came in) are dropped rather
// than left as invalid links that fail at queue time.
function dropInvalidLinks(node, slot, type) {
    if (type === ANY) return;
    for (const link of linksFrom(node, slot)) {
        const target = node.graph.getNodeById(link.target_id);
        const input = target?.inputs?.[link.target_slot];
        if (input && !LiteGraph.isValidConnection(type, input.type)) target.disconnectInput(link.target_slot);
    }
}

function syncLanes(node) {
    if (node.__r66_busy) return;
    node.__r66_busy = true;
    try {
        // Highest lane index that has any connection.
        let maxUsed = -1;
        const count = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0);
        for (let i = 0; i < count; i++) {
            if (laneUsed(node, i)) maxUsed = i;
        }

        // Want: used lanes + one trailing empty. At least 1, at most MAX_LANES.
        const desired = Math.min(Math.max(maxUsed + 2, 1), MAX_LANES);

        // Grow.
        while ((node.inputs?.length ?? 0) < desired) {
            const i = node.inputs.length;
            node.addInput(`value_${i}`, ANY);
        }
        while ((node.outputs?.length ?? 0) < desired) {
            const i = node.outputs.length;
            node.addOutput(`out_${i}`, ANY);
        }

        // Shrink -- only ever drop empty trailing lanes, keeping indices contiguous.
        while ((node.inputs?.length ?? 0) > desired) {
            node.removeInput(node.inputs.length - 1);
        }
        while ((node.outputs?.length ?? 0) > desired) {
            node.removeOutput(node.outputs.length - 1);
        }

        // Per-lane type + colour mirroring; the label sits on the output side.
        const names = laneNames(node);
        for (let i = 0; i < node.inputs.length; i++) {
            const t = sourceTypeOf(node, i);
            node.inputs[i].type = t;
            node.inputs[i].label = BLANK;
            if (node.outputs[i]) {
                node.outputs[i].type = t;
                dropInvalidLinks(node, i, t);
                node.outputs[i].label = names[i] || (laneUsed(node, i) && t !== ANY ? t : BLANK);
            }
        }
        resizeToContent(node);
    } finally {
        node.__r66_busy = false;
    }
}

// Rewires every used lane into one contiguous block, ordered top to bottom by
// where its wire comes from, so no lane is left empty in the middle and wires
// cross as little as possible. Names travel with their lanes.
function tidyLanes(node) {
    const graph = node.graph;
    const names = laneNames(node);
    const lanes = [];
    for (let i = 0; i < node.inputs.length; i++) {
        if (!laneUsed(node, i)) continue;
        const inLink = graph.getLink(node.inputs[i].link);
        const origin = inLink ? graph.getNodeById(inLink.origin_id) : null;
        const targets = linksFrom(node, i).map((l) => [graph.getNodeById(l.target_id), l.target_slot]);
        const y = origin
            ? origin.getConnectionPos(false, inLink.origin_slot)[1]
            : Math.min(...targets.map(([t, s]) => t.getConnectionPos(true, s)[1]));
        lanes.push({ origin, originSlot: inLink?.origin_slot, targets, name: names[i], y });
    }
    lanes.sort((a, b) => a.y - b.y);

    graph.beforeChange?.();
    node.__r66_busy = true;
    try {
        for (let i = 0; i < node.inputs.length; i++) {
            node.disconnectInput(i);
            node.disconnectOutput(i);
            // Typed slots would refuse a different wire while lanes are reshuffled.
            node.inputs[i].type = ANY;
            node.outputs[i].type = ANY;
        }
        const moved = {};
        lanes.forEach((lane, k) => {
            lane.origin?.connect(lane.originSlot, node, k);
            for (const [target, slot] of lane.targets) node.connect(k, target, slot);
            if (lane.name) moved[k] = lane.name;
        });
        node.properties.r66Names = moved;
    } finally {
        node.__r66_busy = false;
    }
    syncLanes(node);
    graph.afterChange?.();
    node.setDirtyCanvas(true, true);
}

function renameLane(node, slot, event) {
    const names = laneNames(node);
    app.canvas.prompt("Lane name", names[slot] ?? "", (value) => {
        const name = String(value ?? "").trim();
        if (name) names[slot] = name;
        else delete names[slot];
        syncLanes(node);
        node.setDirtyCanvas(true, true);
    }, event);
}

app.registerExtension({
    name: "MBNodes.Route66",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_ID) return;

        const onCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onCreated?.apply(this, arguments);
            this.title = "Route 66";
            // Compact hides the title bar so the node reads like a reroute.
            Object.defineProperty(this, "title_mode", {
                get: () => (this.properties?.r66Compact ? LiteGraph.NO_TITLE : LiteGraph.NORMAL_TITLE),
                configurable: true,
            });
            // Defer past configure() so a loaded workflow has its links restored
            // before we trim -- otherwise we'd remove slots the links point at.
            setTimeout(() => syncLanes(this), 0);
            return r;
        };

        const onConn = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function () {
            const r = onConn?.apply(this, arguments);
            if (!this.__r66_busy) syncLanes(this);
            return r;
        };

        // A wire dropped on the node body goes to the first free lane instead of
        // replacing a lane that already carries the same type.
        nodeType.prototype.findInputByType = function () {
            const index = this.inputs.findIndex((input) => input.link == null);
            return index === -1 ? undefined : { index, slot: this.inputs[index] };
        };

        const onOutDbl = nodeType.prototype.onOutputDblClick;
        nodeType.prototype.onOutputDblClick = function (slot, event) {
            const r = onOutDbl?.apply(this, arguments);
            renameLane(this, slot, event);
            return r;
        };

        // Lane count in the title bar.
        const onFg = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            const r = onFg?.apply(this, arguments);
            if (this.properties?.r66Compact || this.flags?.collapsed) return r;
            ctx.save();
            ctx.font = "11px Arial";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillStyle = LiteGraph.NODE_TEXT_COLOR;
            ctx.globalAlpha = 0.6;
            ctx.fillText(`${usedCount(this)} lanes`, this.size[0] - 10, -LiteGraph.NODE_TITLE_HEIGHT / 2);
            ctx.restore();
            return r;
        };

        const getMenu = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
            const r = getMenu?.apply(this, arguments);
            options.push(
                null,
                { content: "Tidy lanes", callback: () => tidyLanes(this) },
                {
                    content: this.properties?.r66Compact ? "Show title bar" : "Compact (hide title bar)",
                    callback: () => {
                        this.properties.r66Compact = !this.properties.r66Compact;
                        this.setDirtyCanvas(true, true);
                    },
                },
            );
            return r;
        };
    },
});
