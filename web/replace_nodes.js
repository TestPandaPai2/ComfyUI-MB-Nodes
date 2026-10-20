// "Replace Node(s)..." in the node right-click menu: swaps every selected node
// for a picked type, keeping position, links and matching widget values.

import { app } from "../../scripts/app.js";
import { openDialog } from "./dialog.js";
import { getWidget, notify } from "./common.js";

const MAX_RESULTS = 100;

function nodeLabel(type) {
    const ctor = LiteGraph.registered_node_types[type];
    return ctor.nodeData?.display_name || ctor.title || type;
}

// Slot on the new node for an old one: same name, then same index, then the
// first free slot of a compatible type.
function matchSlot(slots, oldSlot, index, type, used, isInput) {
    const fits = (s, i) => !used.has(i) && (isInput ? LiteGraph.isValidConnection(type, s.type) : LiteGraph.isValidConnection(s.type, type));
    let i = slots.findIndex((s, j) => s.name === oldSlot.name && fits(s, j));
    if (i < 0 && slots[index] && fits(slots[index], index)) i = index;
    if (i < 0) i = slots.findIndex(fits);
    if (i >= 0) used.add(i);
    return i;
}

function replaceNode(old, type) {
    const graph = old.graph;

    // Read every link up front; connecting the new node rewires the old one.
    // output.links / input.link are deprecated; go through the link store.
    const allLinks = [...graph.links.values()];
    const inLinks = (old.inputs ?? []).map((input, i) => ({ input, i, link: old.getInputLink(i) })).filter((x) => x.link);
    const outLinks = (old.outputs ?? []).map((output, i) => ({ output, i, links: allLinks.filter((l) => l.origin_id === old.id && l.origin_slot === i) })).filter((x) => x.links.length);

    const node = LiteGraph.createNode(type);
    node.pos = [old.pos[0], old.pos[1]];
    graph.add(node);

    for (const w of old.widgets ?? []) {
        const target = getWidget(node, w.name);
        if (!target || target.type !== w.type) continue;
        if (target.type === "combo" && !target.options?.values?.includes?.(w.value)) continue;
        target.value = w.value;
    }

    if (old.title !== old.constructor.title) node.title = old.title;
    if (old.color) node.color = old.color;
    if (old.bgcolor) node.bgcolor = old.bgcolor;
    node.mode = old.mode;
    node.setSize([Math.max(node.size[0], old.size[0]), node.computeSize()[1]]);

    let dropped = 0;

    const usedIn = new Set();
    for (const { input, i, link } of inLinks) {
        const slot = matchSlot(node.inputs ?? [], input, i, link.type, usedIn, true);
        const source = graph.getNodeById(link.origin_id);
        if (slot < 0 || !source?.connect(link.origin_slot, node, slot)) dropped++;
    }

    const usedOut = new Set();
    for (const { output, i, links } of outLinks) {
        const slot = matchSlot(node.outputs ?? [], output, i, output.type, usedOut, false);
        for (const link of links) {
            const target = graph.getNodeById(link.target_id);
            if (slot < 0 || !target || !node.connect(slot, target, link.target_slot)) dropped++;
        }
    }

    graph.remove(old);
    return dropped;
}

function replaceSelected(nodes, type) {
    const canvas = app.canvas;
    canvas.emitBeforeChange();
    let dropped = 0;
    for (const old of nodes) dropped += replaceNode(old, type);
    canvas.emitAfterChange();
    canvas.setDirty(true, true);

    const summary = `Replaced ${nodes.length} node${nodes.length === 1 ? "" : "s"}`;
    if (dropped) notify("warn", summary, `${dropped} link${dropped === 1 ? "" : "s"} had no matching slot and were dropped.`);
    else notify("success", summary, `with ${nodeLabel(type)}.`);
}

function openPicker(nodes) {
    const types = Object.keys(LiteGraph.registered_node_types)
        .map((type) => ({ type, label: nodeLabel(type), category: LiteGraph.registered_node_types[type].category ?? "" }))
        .sort((a, b) => a.label.localeCompare(b.label));
    let picked = null;

    openDialog({
        title: `Replace ${nodes.length} node${nodes.length === 1 ? "" : "s"} with...`,
        applyLabel: "Replace",
        width: 420,
        render(body) {
            const search = document.createElement("input");
            search.className = "mb-dialog-select";
            search.placeholder = "Search nodes";
            const list = document.createElement("div");
            list.className = "mb-dialog-list";
            body.append(search, list);

            function refresh() {
                const q = search.value.trim().toLowerCase();
                const hits = types.filter((t) => !q || t.label.toLowerCase().includes(q) || t.type.toLowerCase().includes(q)).slice(0, MAX_RESULTS);
                picked = hits[0]?.type ?? null;
                list.replaceChildren(...hits.map((t, i) => {
                    const row = document.createElement("div");
                    row.className = "mb-dialog-row" + (i === 0 ? " mb-selected" : "");
                    row.title = t.type;
                    row.textContent = t.label;
                    const cat = document.createElement("span");
                    cat.className = "mb-dialog-hint";
                    cat.style.margin = "0 0 0 auto";
                    cat.textContent = t.category;
                    row.appendChild(cat);
                    row.addEventListener("click", () => {
                        picked = t.type;
                        for (const r of list.children) r.classList.toggle("mb-selected", r === row);
                    });
                    row.addEventListener("dblclick", () => {
                        picked = t.type;
                        search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
                    });
                    return row;
                }));
            }

            search.addEventListener("input", refresh);
            refresh();
            setTimeout(() => search.focus());
        },
        onApply() {
            if (!picked) return false;
            replaceSelected(nodes, picked);
        },
    });
}

app.registerExtension({
    name: "MBNodes.ReplaceNodes",

    getNodeMenuItems(node) {
        const selected = Object.values(app.canvas.selected_nodes ?? {});
        const nodes = selected.includes(node) ? selected : [node];
        return [
            null,
            {
                content: nodes.length > 1 ? `Replace ${nodes.length} Nodes...` : "Replace Node...",
                callback: () => openPicker(nodes),
            },
        ];
    },
});
