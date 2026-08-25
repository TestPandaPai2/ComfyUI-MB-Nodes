import { app } from "../../scripts/app.js";

// Route 66 -- multi-lane reroute.
//
// Backend declares MAX_LANES optional any-type input/output pairs. This script
// keeps the node looking minimal like a native reroute: it shows only the
// lanes that are in use plus ONE trailing empty pair, and adopts the wire's
// type per lane (so each socket takes the colour of what plugs in).
//
// Lane i input  -> "value_i" (backend maps inputs by NAME, so names stay fixed)
// Lane i output -> "out_i"   (backend maps outputs by INDEX, so lanes stay
//                             contiguous from 0 -- never leave an index gap)

const NODE_ID = "MBRoute66";
const MAX_LANES = 20;
const ANY = "*";

function sourceTypeOf(node, inputIndex) {
    // Type of whatever is plugged into this input, or ANY if nothing.
    const inp = node.inputs?.[inputIndex];
    if (!inp || inp.link == null) return ANY;
    const link = node.graph?.links?.[inp.link];
    if (!link) return ANY;
    const origin = node.graph.getNodeById(link.origin_id);
    const out = origin?.outputs?.[link.origin_slot];
    return out?.type ?? ANY;
}

function laneUsed(node, i) {
    const inLinked = node.inputs?.[i]?.link != null;
    const outLinked = (node.outputs?.[i]?.links?.length ?? 0) > 0;
    return inLinked || outLinked;
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

        // Per-lane type + colour mirroring, and hide labels for the clean look.
        for (let i = 0; i < node.inputs.length; i++) {
            const t = sourceTypeOf(node, i);
            node.inputs[i].type = t;
            node.inputs[i].label = "";
            if (node.outputs[i]) {
                // Only force the output type from the input when the input drives
                // the lane; otherwise leave it ANY so the empty lane accepts anything.
                node.outputs[i].type = t;
                node.outputs[i].label = "";
            }
        }
    } finally {
        node.__r66_busy = false;
    }
}

app.registerExtension({
    name: "MBNodes.Route66",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_ID) return;

        const onCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onCreated?.apply(this, arguments);
            this.title = "Route 66";
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
    },
});
