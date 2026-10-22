// Group Runner (MB): one row per group that holds live output nodes, with a
// Run button (app.queuePrompt's queueNodeIds, the same partial-execution call
// Branch Runner uses) and a Fit button (canvas.animateToBounds onto the group).
// The list is rebuilt from onDrawForeground whenever a cheap signature of the
// groups and their outputs changes, so it follows the graph without polling.

import { app } from "../../scripts/app.js";
import { getWidget, notify, resizeToContent, accentColor } from "./common.js";

const NODE_ID = "MBGroupRunner";
const ROW_HEIGHT = 28;
const PADDING = 8;

// An output node belongs to a group when its centre sits inside the group's
// box -- the same "inside" test the canvas uses when a group is dragged.
function groupRows(graph) {
    const always = window.LiteGraph?.ALWAYS ?? 0;
    const outputs = (graph.nodes ?? []).filter(
        (n) => n.constructor?.nodeData?.output_node && n.mode === always
    );

    const rows = [];
    for (const group of graph.groups ?? []) {
        const [x, y, w, h] = group.boundingRect;
        const ids = outputs
            .filter((n) => {
                const cx = n.pos[0] + n.size[0] / 2;
                const cy = n.pos[1] + n.size[1] / 2;
                return cx >= x && cx <= x + w && cy >= y && cy <= y + h;
            })
            .map((n) => n.id);
        if (ids.length) rows.push({ group, ids });
    }
    return rows;
}

function signature(rows) {
    return rows.map((r) => `${r.group.title}|${r.group.color}|${r.ids.join(",")}`).join(";");
}

function button(label, title, onClick) {
    const el = document.createElement("button");
    el.textContent = label;
    el.title = title;
    el.style.cssText =
        "flex:none;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:12px;" +
        "border:1px solid var(--border-color,#4e4e4e);background:var(--comfy-input-bg,#222);color:var(--input-text,#ddd);";
    el.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
    });
    return el;
}

function runGroup(node, row) {
    const always = window.LiteGraph?.ALWAYS ?? 0;
    const graph = row.group.graph ?? app.graph;
    // Re-check at click time: an output may have been muted since the last draw.
    const ids = row.ids.filter((id) => graph.getNodeById(id)?.mode === always);
    if (!ids.length) {
        notify("warn", "Nothing to run", `"${row.group.title}" has no active output nodes.`);
        return;
    }
    // batchCount: the same "queue N times" as the batch count beside ComfyUI's Run button.
    const runs = Math.max(1, Math.round(getWidget(node, "runs")?.value ?? 1));
    app.queuePrompt(0, runs, { queueNodeIds: ids });
}

function fitGroup(row) {
    app.canvas.animateToBounds(row.group.boundingRect, { zoom: 0.9 });
}

function render(node, rows) {
    const list = node.__mbGroupList;
    list.replaceChildren();

    if (!rows.length) {
        const empty = document.createElement("div");
        empty.textContent = "No groups with output nodes";
        empty.style.cssText = "opacity:0.6;font-size:12px;padding:4px 2px;";
        list.append(empty);
    }

    rows.forEach((row, i) => {
        const line = document.createElement("div");
        line.style.cssText = `display:flex;align-items:center;gap:6px;height:${ROW_HEIGHT - 4}px;`;

        const swatch = document.createElement("span");
        swatch.style.cssText =
            `flex:none;width:12px;height:12px;border-radius:3px;background:${row.group.color || accentColor()};`;

        const label = document.createElement("span");
        label.textContent = `${row.group.title} (${row.ids.length})`;
        label.title = label.textContent;
        label.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;";

        line.append(
            swatch,
            label,
            // Looked up at click time: a reloaded workflow can swap in new group
            // objects without changing anything the signature tracks.
            button("Run", "Queue only this group's output nodes", () => runGroup(node, node.__mbGroupRows[i])),
            button("Fit", "Frame this group on the canvas", () => fitGroup(node.__mbGroupRows[i]))
        );
        list.append(line);
    });

    node.__mbGroupCount = Math.max(rows.length, 1);
    resizeToContent(node);
}

function wireNode(node) {
    node.isVirtualNode = true;

    const list = document.createElement("div");
    list.style.cssText = `display:flex;flex-direction:column;gap:4px;padding:${PADDING / 2}px 2px;`;
    node.__mbGroupList = list;
    node.__mbGroupCount = 1;
    node.__mbGroupSig = null;

    node.addDOMWidget("mb_group_list", "mb_group_list", list, {
        serialize: false,
        hideOnZoom: false,
        getHeight: () => node.__mbGroupCount * ROW_HEIGHT + PADDING,
    });

    const onDraw = node.onDrawForeground;
    node.onDrawForeground = function (...args) {
        const r = onDraw?.apply(this, args);
        if (this.graph) {
            const rows = groupRows(this.graph);
            const sig = signature(rows);
            this.__mbGroupRows = rows;
            if (sig !== this.__mbGroupSig) {
                this.__mbGroupSig = sig;
                render(this, rows);
            }
        }
        return r;
    };
}

app.registerExtension({
    name: "MBNodes.GroupRunner",

    nodeCreated(node) {
        if (node.comfyClass !== NODE_ID) return;
        wireNode(node);
    },
});
