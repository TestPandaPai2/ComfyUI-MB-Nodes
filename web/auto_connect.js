import { app } from "../../scripts/app.js";

// Right-click a slot dot: link it to matching slots on other nodes in the current graph.
const MAX_ITEMS = 15;

function types(type) {
    return String(type ?? "").split(",").map((t) => t.trim()).filter((t) => t && t !== "*");
}

function matches(a, b) {
    const tb = types(b);
    return types(a).some((t) => tb.includes(t));
}

function distance(a, b) {
    return Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]);
}

// Every [node, index, slot] on other nodes whose `side` slot matches `type`, nearest first.
function candidates(node, side, type) {
    const found = [];
    for (const other of app.canvas.graph?._nodes ?? []) {
        if (other === node) continue;
        (other[side] ?? []).forEach((slot, index) => {
            if (matches(slot.type, type)) found.push([other, index, slot]);
        });
    }
    return found.sort((a, b) => distance(node, a[0]) - distance(node, b[0]));
}

function batch(fn) {
    const graph = app.canvas.graph;
    graph.beforeChange();
    try {
        fn();
    } finally {
        graph.afterChange();
        graph.setDirtyCanvas(true, true);
    }
}

function openList(items, event, menu) {
    new LiteGraph.ContextMenu(items, { event, parentMenu: menu });
}

function inputItems(node, index, input) {
    const found = candidates(node, "outputs", input.type);
    const label = types(input.type).join(", ");
    if (!found.length) return [{ content: `Connect to ${label} (none)`, disabled: true }];
    const linkedFrom = input.link != null ? app.canvas.graph.links[input.link] : null;
    const items = found.slice(0, MAX_ITEMS).map(([src, out, slot]) => ({
        content: `${src.title} → ${slot.label || slot.name}${linkedFrom?.origin_id === src.id && linkedFrom.origin_slot === out ? " ✓" : ""}`,
        callback: () => batch(() => src.connect(out, node, index)),
    }));
    const [src, out] = found[0];
    return [
        { content: `Connect to nearest ${label} ← ${src.title}`, callback: () => batch(() => src.connect(out, node, index)) },
        { content: `Connect to ${label}`, has_submenu: true, callback: (v, o, event, menu) => openList(items, event, menu) },
    ];
}

function outputItems(node, index, output) {
    // "*" never matches, so Reroutes and "any" inputs aren't wired by accident.
    const found = candidates(node, "inputs", output.type);
    const label = types(output.type).join(", ");
    if (!found.length) return [{ content: `Connect to ${label} inputs (none)`, disabled: true }];
    const empty = found.filter(([, , slot]) => slot.link == null);
    const items = found.slice(0, MAX_ITEMS).map(([dst, inp, slot]) => ({
        content: `${dst.title} → ${slot.label || slot.name}${slot.link != null ? " (linked)" : ""}`,
        callback: () => batch(() => node.connect(index, dst, inp)),
    }));
    return [
        {
            content: `Connect to all empty ${label} inputs (${empty.length})`,
            disabled: !empty.length,
            callback: () => batch(() => empty.forEach(([dst, inp]) => node.connect(index, dst, inp))),
        },
        { content: `Connect to`, has_submenu: true, callback: (v, o, event, menu) => openList(items, event, menu) },
    ];
}

app.registerExtension({
    name: "MBNodes.AutoConnect",

    async beforeRegisterNodeDef(nodeType) {
        const prev = nodeType.prototype.getExtraSlotMenuOptions;
        nodeType.prototype.getExtraSlotMenuOptions = function (slot) {
            const options = prev?.apply(this, arguments) ?? [];
            if (slot.input && types(slot.input.type).length) options.push(null, ...inputItems(this, slot.slot, slot.input));
            else if (slot.output && types(slot.output.type).length) options.push(null, ...outputItems(this, slot.slot, slot.output));
            return options;
        };
    },
});
