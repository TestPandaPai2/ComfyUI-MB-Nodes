import { app } from "../../scripts/app.js";
import { accentColor, getWidget, resizeToContent } from "./common.js";

// WiFi Send (MB) / WiFi Receive (MB): Route 66 without the wire. A sender
// takes lanes under a channel name; every receiver on that channel, at the
// same graph level, outputs the same lanes. Both are frontend-only virtual
// nodes: when the prompt is built, a receiver's output i resolves through
// getInputLink(i) to whatever feeds the sender's lane i, so the server only
// ever sees direct links.

const SEND = "MBWiFiSend";
const RECEIVE = "MBWiFiReceive";
const MAX_LANES = 20; // same cap as Route 66
const ANY = "*";
const BLANK = " "; // an empty label falls back to the slot name
const BAD = "#e5484d";
// Muted title colours; a channel always maps to the same one.
const CHANNEL_COLORS = ["#3f5f8a", "#5a3f8a", "#8a3f6b", "#8a5a3f", "#5f7a3f", "#3f8a6b", "#3f7a8a", "#7a3f3f", "#8a7a3f", "#4f4f70"];

const nodesOf = (graph) => graph?.nodes ?? graph?._nodes ?? [];
const channelOf = (node) => String(getWidget(node, "channel")?.value ?? "").trim();
const sendersOn = (graph, channel) => nodesOf(graph).filter((n) => n.type === SEND && channelOf(n) === channel);
const receiversOf = (sender) => nodesOf(sender.graph).filter((n) => n.type === RECEIVE && channelOf(n) === channelOf(sender));
const laneNames = (sender) => (sender.properties.mbLaneNames ??= {});

// "ok" with the sender, or why there is no signal.
function signalOf(receiver) {
    const channel = channelOf(receiver);
    const senders = channel ? sendersOn(receiver.graph, channel) : [];
    if (senders.length > 1) return { state: "duplicate" };
    if (!senders.length) return { state: "none" };
    return { state: "ok", sender: senders[0] };
}

function channelColor(channel) {
    let hash = 0;
    for (const ch of channel) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    return CHANNEL_COLORS[Math.abs(hash) % CHANNEL_COLORS.length];
}

// Title colour follows the channel unless the user picked one by hand: the
// colour applied last is remembered, and any other colour is theirs.
function paintChannel(node) {
    if (node.color != null && node.color !== node.properties.mbChannelColor) return;
    const color = channelOf(node) ? channelColor(channelOf(node)) : undefined;
    node.color = color;
    node.properties.mbChannelColor = color;
}

function sourceType(node, slot) {
    const link = node.getInputLink(slot);
    const origin = link && node.graph.getNodeById(link.origin_id);
    return origin?.outputs?.[link.origin_slot]?.type ?? ANY;
}

// Number of lanes in use: up to the last connected input.
function laneCount(sender) {
    for (let i = (sender.inputs?.length ?? 0) - 1; i >= 0; i--) {
        if (sender.isInputConnected(i)) return i + 1;
    }
    return 0;
}

function linksFrom(node, slot) {
    return [...(node.graph?.links?.values?.() ?? [])].filter((l) => l.origin_id === node.id && l.origin_slot === slot);
}

// A receiver output whose lane changed to a type its wires can't take drops
// those wires rather than leaving invalid links to fail at queue time.
function dropInvalidLinks(node, slot, type) {
    if (type === ANY) return;
    for (const link of linksFrom(node, slot)) {
        const target = node.graph.getNodeById(link.target_id);
        const input = target?.inputs?.[link.target_slot];
        if (input && !LiteGraph.isValidConnection(type, input.type)) target.disconnectInput(link.target_slot);
    }
}

function syncSender(sender) {
    const wanted = Math.min(laneCount(sender) + 1, MAX_LANES);
    while (sender.inputs.length < wanted) sender.addInput(`lane_${sender.inputs.length}`, ANY);
    while (sender.inputs.length > wanted) sender.removeInput(sender.inputs.length - 1);
    const names = laneNames(sender);
    sender.inputs.forEach((input, i) => {
        input.type = sourceType(sender, i);
        input.label = names[i] || (sender.isInputConnected(i) && input.type !== ANY ? input.type : BLANK);
    });
    paintChannel(sender);
    resizeToContent(sender);
}

// Outputs mirror the sender's lanes. With no signal the outputs stay (so
// their wires survive a channel being renamed back) but turn grey "*".
function syncReceiver(receiver) {
    const combo = getWidget(receiver, "channel");
    if (combo) {
        const channels = [...new Set(nodesOf(receiver.graph).filter((n) => n.type === SEND).map(channelOf).filter(Boolean))].sort();
        combo.options.values = channels;
        // A fresh receiver tunes in to the first channel there is.
        if (!combo.value && channels.length) combo.value = channels[0];
    }
    const { state, sender } = signalOf(receiver);
    receiver.mbSignal = state;
    if (state === "ok") {
        const count = laneCount(sender);
        while (receiver.outputs.length < count) receiver.addOutput(`lane_${receiver.outputs.length}`, ANY);
        while (receiver.outputs.length > count) receiver.removeOutput(receiver.outputs.length - 1);
        const names = laneNames(sender);
        receiver.outputs.forEach((output, i) => {
            output.type = sender.inputs[i]?.type ?? ANY;
            output.label = names[i] || (output.type !== ANY ? output.type : BLANK);
            dropInvalidLinks(receiver, i, output.type);
        });
    } else {
        receiver.outputs.forEach((output) => {
            output.type = ANY;
            output.label = output.label || BLANK;
        });
    }
    paintChannel(receiver);
    resizeToContent(receiver);
}

function syncGraph(graph) {
    if (!graph || graph.mbWifiSyncing) return;
    graph.mbWifiSyncing = true;
    try {
        nodesOf(graph).filter((n) => n.type === SEND).forEach(syncSender);
        nodesOf(graph).filter((n) => n.type === RECEIVE).forEach(syncReceiver);
    } finally {
        graph.mbWifiSyncing = false;
    }
    app.canvas?.setDirty(true, true);
}

function drawStatus(node, ctx, text, color) {
    if (node.flags?.collapsed) return;
    ctx.save();
    ctx.font = "11px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.globalAlpha = color === BAD ? 1 : 0.65;
    ctx.fillText(text, node.size[0] - 10, -LiteGraph.NODE_TITLE_HEIGHT / 2);
    ctx.restore();
}

function goTo(node) {
    app.canvas.centerOnNode(node);
    app.canvas.selectNode(node);
}

const label = (node) => `#${node.id} ${node.title}`;

// While a sender or receiver is selected, faint dashed lines join the sender
// to each of its receivers. Canvas foreground is drawn in graph space.
function drawGhostWires(ctx) {
    const graph = app.canvas.graph;
    const selected = Object.values(app.canvas.selected_nodes ?? {}).filter((n) => n.graph === graph);
    const senders = new Set();
    for (const node of selected) {
        if (node.type === SEND) senders.add(node);
        if (node.type === RECEIVE) {
            const { sender } = signalOf(node);
            if (sender) senders.add(sender);
        }
    }
    if (!senders.size) return;
    ctx.save();
    ctx.strokeStyle = accentColor();
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    for (const sender of senders) {
        const from = [sender.pos[0] + sender.size[0], sender.pos[1] + sender.size[1] / 2];
        for (const receiver of receiversOf(sender)) {
            ctx.beginPath();
            ctx.moveTo(...from);
            ctx.lineTo(receiver.pos[0], receiver.pos[1] + receiver.size[1] / 2);
            ctx.stroke();
        }
    }
    ctx.restore();
}

app.registerExtension({
    name: "MBNodes.WiFiRoute66",

    registerCustomNodes() {
        class WiFiSend extends LGraphNode {
            static title = "WiFi Send (MB)";
            static category = "MBNodes";
            serialize_widgets = true;

            constructor(title) {
                super(title);
                this.isVirtualNode = true; // never part of the prompt
                this.properties ??= {};
                this.addWidget("text", "channel", "channel_1", () => syncGraph(this.graph));
                this.addInput("lane_0", ANY);
            }

            onConnectionsChange() {
                if (!app.configuringGraph) syncGraph(this.graph);
            }

            onConfigure() {
                setTimeout(() => syncGraph(this.graph), 0);
            }

            onAdded() {
                setTimeout(() => syncGraph(this.graph), 0);
            }

            onRemoved() {
                // The node leaves its graph right after this, so hold on to it.
                const graph = this.graph;
                setTimeout(() => syncGraph(graph), 0);
            }

            onInputDblClick(slot, event) {
                const names = laneNames(this);
                app.canvas.prompt("Lane name", names[slot] ?? "", (value) => {
                    const name = String(value ?? "").trim();
                    if (name) names[slot] = name;
                    else delete names[slot];
                    syncGraph(this.graph);
                }, event);
            }

            applyToGraph() {
                const channel = channelOf(this);
                if (sendersOn(this.graph, channel).length > 1) {
                    throw new Error(`WiFi channel "${channel}" has more than one WiFi Send (MB). Rename one of them.`);
                }
            }

            onDrawForeground(ctx) {
                if (sendersOn(this.graph, channelOf(this)).length > 1) {
                    drawStatus(this, ctx, "duplicate channel", BAD);
                } else {
                    const n = receiversOf(this).length;
                    drawStatus(this, ctx, `→ ${n} receiver${n === 1 ? "" : "s"}`, LiteGraph.NODE_TEXT_COLOR);
                }
            }

            getExtraMenuOptions(canvas, options) {
                const receivers = receiversOf(this);
                if (!receivers.length) return;
                options.unshift({
                    content: "Go to receiver",
                    has_submenu: true,
                    submenu: { options: receivers.map((r) => ({ content: label(r), callback: () => goTo(r) })) },
                }, null);
            }
        }

        class WiFiReceive extends LGraphNode {
            static title = "WiFi Receive (MB)";
            static category = "MBNodes";
            serialize_widgets = true;

            constructor(title) {
                super(title);
                this.isVirtualNode = true; // never part of the prompt
                this.properties ??= {};
                this.addWidget("combo", "channel", "", () => syncGraph(this.graph), { values: [] });
            }

            // Output i of this node is lane i of the sender: hand back the link
            // feeding that lane and the prompt builder follows it upstream.
            getInputLink(slot) {
                const { sender } = signalOf(this);
                return sender ? sender.getInputLink(slot) : null;
            }

            applyToGraph() {
                const { state } = signalOf(this);
                const used = this.outputs.some((_, i) => this.isOutputConnected(i));
                if (state === "duplicate") {
                    throw new Error(`WiFi channel "${channelOf(this)}" has more than one WiFi Send (MB). Rename one of them.`);
                }
                if (state === "none" && used) {
                    throw new Error(`WiFi Receive (MB) #${this.id}: no WiFi Send (MB) on channel "${channelOf(this)}" at this level.`);
                }
            }

            onConfigure() {
                setTimeout(() => syncGraph(this.graph), 0);
            }

            onAdded() {
                setTimeout(() => syncGraph(this.graph), 0);
            }

            onDrawForeground(ctx) {
                if (this.mbSignal === "duplicate") drawStatus(this, ctx, "duplicate channel", BAD);
                else if (this.mbSignal === "none") drawStatus(this, ctx, "no signal", BAD);
            }

            getExtraMenuOptions(canvas, options) {
                const { sender } = signalOf(this);
                if (sender) options.unshift({ content: "Go to sender", callback: () => goTo(sender) }, null);
            }
        }

        LiteGraph.registerNodeType(SEND, WiFiSend);
        LiteGraph.registerNodeType(RECEIVE, WiFiReceive);
    },

    async setup() {
        const prevDraw = app.canvas.onDrawForeground;
        app.canvas.onDrawForeground = function (ctx) {
            prevDraw?.apply(this, arguments);
            drawGhostWires(ctx);
        };
    },
});
