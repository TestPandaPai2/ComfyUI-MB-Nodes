// Replace Text Advanced: one "Text To Replace" / "Replaced Text" widget row per
// pair, each widget with its own socket (find_N / replace_N). Filling or
// linking the last row adds a fresh empty one; trailing rows that are empty
// and unlinked collapse back to a single empty row. The rows hold no saved
// value of their own: typed pairs live as JSON in the hidden `pairs` widget,
// linked values reach the backend as the find_N / replace_N inputs.

import { app } from "../../scripts/app.js";
import { getWidget, setWidgetVisible } from "./common.js";

const NODE_CLASS = "MBReplaceTextAdvanced";
const ROW_KEYS = [["find", "Text To Replace"], ["replace", "Replaced Text"]];
const ROW_INPUT = /^(find|replace)_(\d+)$/;

function readPairs(node) {
    try {
        const data = JSON.parse(getWidget(node, "pairs")?.value || "[]");
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

const isEmpty = (pair) => !pair.find && !pair.replace;

const isRowLinked = (node, index) =>
    (node.inputs ?? []).some((input) => input.link != null && input.name.match(ROW_INPUT)?.[2] === String(index + 1));

// Rows reach every linked socket; trailing rows that are empty and unlinked
// collapse to exactly one, so there is always one free row.
function withFreeRow(node, pairs) {
    const rows = pairs.map((p) => ({ find: p?.find ?? "", replace: p?.replace ?? "" }));
    for (const input of node.inputs ?? []) {
        const match = input.link != null && input.name.match(ROW_INPUT);
        if (!match) continue;
        while (rows.length < Number(match[2])) rows.push({ find: "", replace: "" });
    }
    while (rows.length && isEmpty(rows[rows.length - 1]) && !isRowLinked(node, rows.length - 1)) rows.pop();
    rows.push({ find: "", replace: "" });
    return rows;
}

function rowsFromWidgets(node) {
    const rows = [];
    for (const w of node.widgets ?? []) {
        if (w.__mbPair === undefined) continue;
        rows[w.__mbPair.index] ??= { find: "", replace: "" };
        rows[w.__mbPair.index][w.__mbPair.key] = w.value ?? "";
    }
    return rows;
}

function save(node, rows) {
    const pairs = getWidget(node, "pairs");
    if (!pairs) return;
    // Rows keep their positions so they line up with find_N / replace_N; only
    // the trailing empty rows are UI only.
    const kept = rows.slice();
    while (kept.length && isEmpty(kept[kept.length - 1])) kept.pop();
    pairs.value = JSON.stringify(kept);
}

function refresh(node) {
    const rows = rowsFromWidgets(node);
    save(node, rows);
    const next = withFreeRow(node, rows);
    if (next.length !== rows.length) build(node, next);
    else node.setDirtyCanvas(true, true);
}

function build(node, rows) {
    const old = (node.widgets ?? []).filter((w) => w.__mbPair !== undefined);
    for (const w of old) w.onRemove?.();
    node.widgets = (node.widgets ?? []).filter((w) => w.__mbPair === undefined);

    node.inputs ??= [];
    rows.forEach((pair, index) => {
        for (const [key, label] of ROW_KEYS) {
            const name = `${key}_${index + 1}`;
            const w = node.addWidget("text", name, pair[key], () => refresh(node));
            w.label = `${label} ${index + 1}`;
            w.__mbPair = { index, key };
            // Saved through `pairs`: kept out of the workflow and the prompt.
            w.serialize = false;
            w.options = { ...w.options, serialize: false };

            // Reuse the socket restored on load so its link survives.
            const input = node.inputs.find((i) => i.name === name) ?? node.addInput(name, "STRING");
            input.widget = { name };
            input.label = w.label;
        }
    });

    // Sockets of removed rows; withFreeRow never removes a linked row.
    for (let i = node.inputs.length - 1; i >= 0; i--) {
        const match = node.inputs[i].name.match(ROW_INPUT);
        if (match && Number(match[2]) > rows.length && node.inputs[i].link == null) node.removeInput(i);
    }

    // Fit the height to the rows; keep a width the user widened by hand.
    const size = node.computeSize();
    node.setSize([Math.max(node.size[0], size[0]), size[1]]);
    node.setDirtyCanvas(true, true);
}

app.registerExtension({
    name: "MBNodes.ReplaceTextAdvanced",

    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_CLASS) return;

        // Saved widget values and row sockets land after nodeCreated, on load
        // and on paste alike.
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = onConfigure?.apply(this, arguments);
            build(this, withFreeRow(this, readPairs(this)));
            return r;
        };

        // Linking a row counts as filling it; unlinking may collapse it.
        const onConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (type, slotIndex) {
            const r = onConnectionsChange?.apply(this, arguments);
            if (type === LiteGraph.INPUT && ROW_INPUT.test(this.inputs?.[slotIndex]?.name ?? "")) {
                // Deferred: the link is not fully attached or detached yet.
                requestAnimationFrame(() => refresh(this));
            }
            return r;
        };
    },

    nodeCreated(node) {
        if (node.comfyClass !== NODE_CLASS) return;
        setWidgetVisible(node, "pairs", false);
        build(node, withFreeRow(node, readPairs(node)));
    },
});
