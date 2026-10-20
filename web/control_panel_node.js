import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { getWidgetConfig } from "../../extensions/core/widgetInputs.js";
import { notify, addButton, resizeToContent, accentColor } from "./common.js";
import { openDialog, radioRow } from "./dialog.js";

// Control Panel -- up to MAX_CONTROLS lanes, each one a miniature version of
// ComfyUI's own built-in Primitive node: blank until wired, then it adopts
// the shape of whatever widget-backed input it's plugged into (slider,
// switch, dropdown, seed, text), and reverts to blank on disconnect.
//
// The mechanism (isVirtualNode + applyToGraph writing straight into the
// target's own widget before the prompt is serialized) is Primitive's real,
// currently-shipped mechanism, pulled from
// comfyui_frontend_package/static/assets/*.js.map -> extensions/core/widgetInputs.ts.
// This file generalizes it from one output to N, tagging each output slot and
// widget with the id of the settings record it belongs to (`mbLane`) so lanes
// can be added, removed and reordered without any index-juggling. Ids, not
// object identity: node.properties is reactive, so a record read back from
// properties.controls is a proxy that never === the raw object.

const NODE_ID = "MBControlPanel";
const MAX_CONTROLS = 16;
const INITIAL_LANES = 2;
const ANY = "*";

const COLOR_STORAGE_KEY = "MBNodes.ControlPanel.defaultColor";
const DEFAULT_ACCENT = "#353535";

// --- small local helpers ---------------------------------------------------

function chainCallback(prevCallback, fn) {
    return function (...args) {
        const r = prevCallback?.apply(this, args);
        fn();
        return r;
    };
}

function newRecord() {
    return {
        id: crypto.randomUUID(),
        name: null,
        widgetType: null,
        kind: null,
        sliderMin: null,
        sliderMax: null,
        sliderStep: null,
        boolLabelOn: null,
        boolLabelOff: null,
        boolDefault: null,
        comboVisible: null,
        seedRandomize: false,
        value: undefined,
    };
}

// output.links is deprecated and LGraphNode has no public per-slot link getter.
function outputLinks(node, slot) {
    if (!node.graph) return [];
    return [...node.graph.links.values()].filter((l) => l.origin_id === node.id && l.origin_slot === slot);
}

function findOutputIndex(node, record) {
    return node.outputs?.findIndex((o) => o.mbLane === record.id) ?? -1;
}

function recordOf(node, output) {
    return node.properties.controls.find((r) => r.id === output?.mbLane);
}

function findWidget(node, record) {
    return node.widgets?.find((w) => w.mbLane === record.id);
}

function ensureProperties(node) {
    node.properties = node.properties ?? {};
    if (!Array.isArray(node.properties.controls)) node.properties.controls = [];
}

function relabelOutputs(node) {
    node.outputs?.forEach((out, i) => {
        const record = recordOf(node, out);
        if (!record) return;
        out.name = `value_${i + 1}`;
        out.label = record.name || `value_${i + 1}`;
    });
}

// Primitive's own fallback for a raw (force_input, no widget) socket: fake up
// a config from the slot's bare type instead of the usual GET_CONFIG lookup.
function widgetConfigOf(input) {
    if (input.widget) return getWidgetConfig(input);
    return [input.type, {}];
}

function resolvedType(input) {
    const cfg = widgetConfigOf(input);
    let t = cfg?.[0];
    if (Array.isArray(t)) t = "COMBO";
    return t;
}

function pushValueTo(targetNode, input, value) {
    const widgetName = input?.widget?.name;
    if (!widgetName) return;
    const targetWidget = targetNode.widgets?.find((w) => w.name === widgetName);
    if (!targetWidget) return;
    targetWidget.value = value;
    targetWidget.callback?.(targetWidget.value, app.canvas, targetNode, app.canvas?.graph_mouse ?? [0, 0], {});
}

function randomSeed(options = {}) {
    const min = options.min ?? 0;
    const max = Math.min(options.max ?? Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    return Math.floor(min + Math.random() * (max - min));
}

// --- colour --------------------------------------------------------------

function loadDefaultColor() {
    try {
        return localStorage.getItem(COLOR_STORAGE_KEY);
    } catch {
        return null;
    }
}

function saveDefaultColor(hex) {
    try {
        localStorage.setItem(COLOR_STORAGE_KEY, hex);
    } catch {
        // storage unavailable -- default just won't persist across sessions
    }
}

function applyColor(node, hex) {
    if (hex) node.color = hex;
}

// --- seed lane's extra randomize/reroll row --------------------------------

const SEED_BTN_H = 22;

function addSeedButtons(node, record) {
    if ((node.widgets ?? []).some((w) => w.mbSeedButtonsFor === record.id)) return;

    const widget = {
        type: "mb_cp_seed_buttons",
        name: "seed_buttons",
        mbSeedButtonsFor: record.id,
        serialize: false,
        options: { serialize: false },
        _rects: [],

        computeSize(width) {
            return [width ?? 0, SEED_BTN_H];
        },

        draw(ctx, drawNode, widgetWidth, y) {
            const w = widgetWidth || drawNode.size[0];
            const margin = 15;
            const gap = 6;
            const bw = (w - margin * 2 - gap) / 2;
            this._rects = [
                [margin, y, bw, SEED_BTN_H],
                [margin + bw + gap, y, bw, SEED_BTN_H],
            ];
            const labels = ["\u{1F3B2} Randomize", "\u{1F501} Reroll"];
            const active = [record.seedRandomize, false];

            this._rects.forEach(([x, ry, rw, rh], i) => {
                ctx.save();
                ctx.fillStyle = active[i] ? accentColor() : LiteGraph.WIDGET_BGCOLOR;
                ctx.strokeStyle = ctx.fillStyle;
                ctx.beginPath();
                ctx.roundRect(x, ry, rw, rh, 8);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.font = "11px Arial";
                ctx.fillText(labels[i], x + rw / 2, ry + rh / 2);
                ctx.restore();
            });
        },

        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            for (let i = 0; i < this._rects.length; i++) {
                const [x, ry, rw, rh] = this._rects[i];
                if (pos[0] < x || pos[0] > x + rw || pos[1] < ry || pos[1] > ry + rh) continue;

                const valueWidget = findWidget(mouseNode, record);
                if (i === 0) {
                    record.seedRandomize = !record.seedRandomize;
                } else if (valueWidget) {
                    record.seedRandomize = false;
                    valueWidget.value = randomSeed(valueWidget.options);
                    valueWidget.callback?.(valueWidget.value);
                }
                mouseNode.setDirtyCanvas(true, true);
                return true;
            }
            return false;
        },
    };

    node.widgets = node.widgets ?? [];
    node.widgets.push(widget);
}

// --- lane widget lifecycle ---------------------------------------------------

function setBoolLabels(widget, on, off) {
    if (on) widget.options.on = on;
    if (off) widget.options.off = off;
}

function applyOverrides(node, record, widget, type) {
    if (type === "INT" || type === "FLOAT") {
        if (record.sliderMin != null) widget.options.min = record.sliderMin;
        if (record.sliderMax != null) widget.options.max = record.sliderMax;
        if (record.sliderStep != null) widget.options.step = record.sliderStep;
        const { min, max } = widget.options;
        if (min != null && widget.value < min) widget.value = min;
        if (max != null && widget.value > max) widget.value = max;
    } else if (type === "BOOLEAN") {
        setBoolLabels(widget, record.boolLabelOn, record.boolLabelOff);
    } else if (type === "COMBO") {
        const full = Array.isArray(widget.options.values) ? widget.options.values.slice() : [];
        node.__cpFullValues = node.__cpFullValues ?? new Map();
        node.__cpFullValues.set(record.id, full);
        if (record.comboVisible?.length) {
            const filtered = full.filter((v) => record.comboVisible.includes(v));
            if (filtered.length) {
                widget.options.values = filtered;
                if (!filtered.includes(widget.value)) {
                    widget.value = filtered[0];
                    widget.callback?.(widget.value);
                }
            }
        }
    }
}

function buildLaneWidget(node, record, input) {
    const cfg = widgetConfigOf(input);
    let type = cfg?.[0];
    const opts = cfg?.[1] ?? {};
    if (Array.isArray(type)) type = "COMBO";

    if (!type || type === ANY || !(type in ComfyWidgets)) {
        notify("warn", "Control Panel", `Don't know how to drive a ${type ?? "unknown"} input.`);
        return;
    }

    const idx = findOutputIndex(node, record);
    if (idx < 0) return;
    node.outputs[idx].type = type;

    const inputData = [Array.isArray(cfg[0]) ? cfg[0] : type, opts];
    node.__cpWidgetSeq = (node.__cpWidgetSeq ?? 0) + 1;
    const built = ComfyWidgets[type](node, `ctrl_${node.__cpWidgetSeq}`, inputData, app);
    const widget = built?.widget;
    if (!widget) return;
    widget.mbLane = record.id;
    widget.mbDefault = opts.default;

    record.widgetType = type;
    record.kind =
        type === "BOOLEAN" ? "switch"
        : type === "COMBO" ? "dropdown"
        : type === "STRING" ? "text"
        : opts.control_after_generate ? "seed"
        : "slider";

    applyOverrides(node, record, widget, type);
    widget.callback = chainCallback(widget.callback, () => {
        record.value = widget.value;
        applyLane(node, record);
    });

    if (record.kind === "seed") addSeedButtons(node, record);
}

function teardownLane(node, record) {
    const idx = findOutputIndex(node, record);
    if (idx >= 0) {
        node.disconnectOutput(idx);
        node.outputs[idx].type = ANY;
    }
    node.widgets = (node.widgets ?? []).filter((w) => {
        if (w.mbLane !== record.id && w.mbSeedButtonsFor !== record.id) return true;
        w.onRemove?.();
        return false;
    });
    record.widgetType = null;
    record.kind = null;
    node.__cpFullValues?.delete(record.id);
}

function applyLane(node, record) {
    const idx = findOutputIndex(node, record);
    if (idx < 0) return;
    const widget = findWidget(node, record);
    if (!widget) return;
    for (const link of outputLinks(node, idx)) {
        const targetNode = node.graph.getNodeById(link.target_id);
        const input = targetNode?.inputs?.[link.target_slot];
        if (targetNode && input) pushValueTo(targetNode, input, widget.value);
    }
}

// Reconciles every lane against its actual connection state. Safe to call
// repeatedly -- a lane already in the right state is left alone.
function syncAllLanes(node) {
    if (node.__cpBusy) return;
    node.__cpBusy = true;
    try {
        for (const record of node.properties.controls) {
            const idx = findOutputIndex(node, record);
            if (idx < 0) continue;
            const link = outputLinks(node, idx)[0];
            const hasLink = !!link;
            const widget = findWidget(node, record);

            if (hasLink && !widget) {
                const targetNode = node.graph.getNodeById(link.target_id);
                const input = targetNode?.inputs?.[link.target_slot];
                if (targetNode && input) buildLaneWidget(node, record, input);
            } else if (!hasLink && widget) {
                teardownLane(node, record);
            }
        }
        relabelOutputs(node);
    } finally {
        node.__cpBusy = false;
    }
}

// --- lane count management (add / remove) ----------------------------------

function relayoutWidgets(node) {
    const ordered = [];
    for (const record of node.properties.controls) {
        const vw = findWidget(node, record);
        if (vw) ordered.push(vw);
        const bw = (node.widgets ?? []).find((w) => w.mbSeedButtonsFor === record.id);
        if (bw) ordered.push(bw);
    }
    ensureAddButton(node);
    const addBtn = (node.widgets ?? []).find((w) => w.mbAddButton);
    if (addBtn) ordered.push(addBtn);
    node.widgets = ordered;
}

function ensureAddButton(node) {
    const existing = (node.widgets ?? []).find((w) => w.mbAddButton);
    if (node.properties.controls.length >= MAX_CONTROLS) {
        if (existing) node.widgets = node.widgets.filter((w) => w !== existing);
        return;
    }
    if (existing) return;
    const btn = addButton(node, "+ Add control", () => {
        addLane(node);
        relayoutWidgets(node);
        resizeToContent(node);
    });
    btn.mbAddButton = true;
}

function addLane(node, record = newRecord()) {
    if (node.properties.controls.length >= MAX_CONTROLS) return;
    node.properties.controls.push(record);
    const out = node.addOutput(`value_${node.properties.controls.length}`, ANY);
    out.mbLane = record.id;
    relabelOutputs(node);
}

function removeLane(node, record) {
    teardownLane(node, record);
    const idx = findOutputIndex(node, record);
    if (idx >= 0) node.removeOutput(idx);
    const ci = node.properties.controls.findIndex((r) => r.id === record.id);
    if (ci >= 0) node.properties.controls.splice(ci, 1);
    relabelOutputs(node);
    relayoutWidgets(node);
    resizeToContent(node);
}

// --- workflow load / fresh-node bring-up -----------------------------------

// Values live on the record (set on every widget change, see buildLaneWidget),
// so restore is keyed by lane, not position.
function restoreWidgetValues(node) {
    for (const record of node.properties.controls) {
        if (record.value === undefined) continue;
        const widget = findWidget(node, record);
        if (widget) widget.value = record.value;
    }
}

function finalizeNode(node) {
    ensureProperties(node);

    if (node.properties.controls.length === 0) {
        // Brand new node -- schema pre-declares MAX_CONTROLS placeholder
        // outputs; trim down to the starting lane count and tag each with a
        // fresh settings record.
        while (node.outputs.length > INITIAL_LANES) node.removeOutput(node.outputs.length - 1);
        for (const out of node.outputs) {
            const record = newRecord();
            node.properties.controls.push(record);
            out.mbLane = record.id;
        }
    } else {
        // Loaded or pasted node -- outputs must match the saved lane count;
        // retag by position (that's how it was saved) and rebuild wired lanes.
        while (node.outputs.length > node.properties.controls.length) node.removeOutput(node.outputs.length - 1);
        while (node.outputs.length < node.properties.controls.length) {
            node.addOutput(`value_${node.outputs.length + 1}`, ANY);
        }
        node.properties.controls.forEach((record, i) => {
            record.id ??= crypto.randomUUID(); // saved before lanes had ids
            node.outputs[i].mbLane = record.id;
        });
    }

    relabelOutputs(node);
    syncAllLanes(node);
    relayoutWidgets(node);
    restoreWidgetValues(node);
    resizeToContent(node);
}

// --- settings dialog ---------------------------------------------------

function labelSpan(text) {
    const s = document.createElement("span");
    s.textContent = text;
    return s;
}

function numberField(placeholder, value) {
    const i = document.createElement("input");
    i.className = "mb-dialog-number";
    i.style.width = "56px";
    i.type = "number";
    i.placeholder = placeholder;
    if (value != null) i.value = value;
    return i;
}

function textField(placeholder, value) {
    const i = document.createElement("input");
    i.type = "text";
    i.placeholder = placeholder;
    i.value = value ?? "";
    i.style.cssText =
        "flex:1; min-width:0; padding:4px 8px; background:var(--comfy-input-bg); color:var(--input-text); border:1px solid transparent; border-radius:7px; outline:none; font-size:12px;";
    return i;
}

function numOrNull(v) {
    const n = Number(v);
    return v === "" || Number.isNaN(n) ? null : n;
}

function buildLaneRow(node, record, onRemove) {
    const item = document.createElement("div");
    item.className = "mb-dialog-item";
    item.style.cssText = "flex-direction:column; align-items:stretch; gap:6px;";

    const top = document.createElement("div");
    top.style.cssText = "display:flex; gap:8px; align-items:center;";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = record.widgetType ? `value_${1 + findOutputIndex(node, record)}` : "unwired";
    nameInput.value = record.name ?? "";

    const kindTag = document.createElement("span");
    kindTag.style.cssText = "font-size:11px; color:var(--descrip-text); white-space:nowrap;";
    kindTag.textContent = record.kind ?? "blank";

    const remove = document.createElement("button");
    remove.className = "mb-dialog-remove";
    remove.textContent = "×";
    remove.title = "Remove control";

    let removed = false;
    remove.onclick = () => {
        removed = true;
        onRemove(record);
        item.remove();
    };

    top.append(nameInput, kindTag, remove);
    item.appendChild(top);

    const extras = [];

    if (record.kind === "slider") {
        const row = document.createElement("div");
        row.className = "mb-dialog-field";
        const min = numberField("min", record.sliderMin);
        const max = numberField("max", record.sliderMax);
        const step = numberField("step", record.sliderStep);
        row.append(labelSpan("min"), min, labelSpan("max"), max, labelSpan("step"), step);
        item.appendChild(row);
        extras.push(() => {
            record.sliderMin = numOrNull(min.value);
            record.sliderMax = numOrNull(max.value);
            record.sliderStep = numOrNull(step.value);
            const widget = findWidget(node, record);
            if (widget) applyOverrides(node, record, widget, "FLOAT");
        });
    } else if (record.kind === "switch") {
        const row = document.createElement("div");
        row.className = "mb-dialog-field";
        const onField = textField("label on", record.boolLabelOn ?? "true");
        const offField = textField("label off", record.boolLabelOff ?? "false");
        row.append(labelSpan("on"), onField, labelSpan("off"), offField);
        item.appendChild(row);

        const group = `mb-cp-${Math.random().toString(36).slice(2)}`;
        const currentValue = findWidget(node, record)?.value === true;
        const startTrue = radioRow({ group, value: "on", label: "starts on", checked: currentValue });
        const startFalse = radioRow({ group, value: "off", label: "starts off", checked: !currentValue });
        item.append(startTrue.wrapper, startFalse.wrapper);

        extras.push(() => {
            record.boolLabelOn = onField.value || null;
            record.boolLabelOff = offField.value || null;
            record.boolDefault = startTrue.radio.checked;
            const widget = findWidget(node, record);
            if (widget) {
                setBoolLabels(widget, record.boolLabelOn, record.boolLabelOff);
                widget.value = record.boolDefault;
                widget.callback?.(widget.value);
            }
        });
    } else if (record.kind === "dropdown") {
        const widget = findWidget(node, record);
        const full = node.__cpFullValues?.get(record.id) ?? widget?.options?.values ?? [];
        const visible = new Set(record.comboVisible?.length ? record.comboVisible : full);
        const list = document.createElement("div");
        list.className = "mb-dialog-list";
        list.style.maxHeight = "140px";
        const checks = full.map((value) => {
            const row = document.createElement("label");
            row.style.cssText = "display:flex; gap:6px; align-items:center; font-size:12px;";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = visible.has(value);
            row.append(cb, labelSpan(String(value)));
            list.appendChild(row);
            return { value, cb };
        });
        item.appendChild(list);
        extras.push(() => {
            const chosen = checks.filter((c) => c.cb.checked).map((c) => c.value);
            record.comboVisible = chosen.length && chosen.length < full.length ? chosen : null;
            const liveWidget = findWidget(node, record);
            if (liveWidget) {
                liveWidget.options.values = record.comboVisible?.length ? full.filter((v) => record.comboVisible.includes(v)) : full;
                if (!liveWidget.options.values.includes(liveWidget.value)) {
                    liveWidget.value = liveWidget.options.values[0];
                    liveWidget.callback?.(liveWidget.value);
                }
            }
        });
    } else if (!record.kind) {
        const hint = document.createElement("div");
        hint.className = "mb-dialog-hint";
        hint.style.margin = "0";
        hint.textContent = "Not wired yet -- connect its output to see its options here.";
        item.appendChild(hint);
    }

    return {
        el: item,
        commit() {
            if (removed) return;
            record.name = nameInput.value.trim() || null;
            extras.forEach((fn) => fn());
        },
    };
}

function resetValues(node) {
    for (const record of node.properties.controls) {
        const widget = findWidget(node, record);
        if (!widget) continue;
        if (record.kind === "slider") {
            const { min, max } = widget.options ?? {};
            let value = widget.mbDefault ?? min ?? 0;
            if (min != null && value < min) value = min;
            if (max != null && value > max) value = max;
            widget.value = value;
        } else if (record.kind === "switch") {
            widget.value = record.boolDefault === true;
        } else if (record.kind === "dropdown") {
            widget.value = widget.options?.values?.[0] ?? widget.value;
        } else {
            continue;
        }
        widget.callback?.(widget.value);
    }
    node.setDirtyCanvas(true, true);
}

function openControlPanelSettings(node) {
    let commit = () => {};

    openDialog({
        title: "Control Panel (MB) — Settings",
        width: 400,
        render(body) {
            const list = document.createElement("div");
            list.style.cssText = "display:flex; flex-direction:column; gap:8px; max-height:320px; overflow-y:auto;";
            let rows = [];
            // Adds and removes stay in this list until Apply, so Cancel drops them.
            const pending = node.properties.controls.slice();

            function renderRows() {
                list.innerHTML = "";
                rows = pending.map((record) =>
                    buildLaneRow(node, record, (gone) => {
                        pending.splice(pending.indexOf(gone), 1);
                        addBtn.disabled = false;
                    }),
                );
                rows.forEach((r) => list.appendChild(r.el));
            }

            const addBtn = document.createElement("button");
            addBtn.className = "mb-dialog-button";
            addBtn.textContent = "+ Add control";
            addBtn.onclick = () => {
                if (pending.length >= MAX_CONTROLS) return;
                pending.push(newRecord());
                renderRows();
                addBtn.disabled = pending.length >= MAX_CONTROLS;
            };
            addBtn.disabled = pending.length >= MAX_CONTROLS;
            renderRows();

            const resetBtn = document.createElement("button");
            resetBtn.className = "mb-dialog-button";
            resetBtn.textContent = "Reset values";
            resetBtn.onclick = () => resetValues(node);

            const actionsRow = document.createElement("div");
            actionsRow.style.cssText = "display:flex; gap:8px; flex-wrap:wrap;";
            actionsRow.append(addBtn, resetBtn);

            const colorRow = document.createElement("div");
            colorRow.className = "mb-dialog-field";
            const colorInput = document.createElement("input");
            colorInput.type = "color";
            colorInput.value = /^#[0-9a-f]{6}$/i.test(node.color ?? "") ? node.color : DEFAULT_ACCENT;
            const saveDefaultBtn = document.createElement("button");
            saveDefaultBtn.className = "mb-dialog-button";
            saveDefaultBtn.textContent = "Save as default";
            saveDefaultBtn.onclick = () => saveDefaultColor(colorInput.value);
            colorRow.append(labelSpan("Node colour"), colorInput, saveDefaultBtn);

            body.append(list, actionsRow, colorRow);

            commit = () => {
                for (const record of node.properties.controls.slice()) {
                    if (!pending.some((p) => p.id === record.id)) removeLane(node, record);
                }
                for (const record of pending) {
                    if (!node.properties.controls.some((c) => c.id === record.id)) addLane(node, record);
                }
                relayoutWidgets(node);
                resizeToContent(node);
                rows.forEach((r) => r.commit());
                applyColor(node, colorInput.value);
                relabelOutputs(node);
                node.setDirtyCanvas(true, true);
            };
        },
        onApply: () => commit(),
    });
}

// --- extension registration ---------------------------------------------------

app.registerExtension({
    name: "MBNodes.ControlPanel",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_ID) return;

        const onCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onCreated?.apply(this, arguments);
            this.isVirtualNode = true;
            this.title = "Control Panel";
            ensureProperties(this);
            applyColor(this, this.color || loadDefaultColor());
            // Defer past configure() so a loaded workflow has its properties
            // and links restored before we reconcile lane count against them.
            setTimeout(() => finalizeNode(this), 0);
            return r;
        };

        const onConn = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function () {
            const r = onConn?.apply(this, arguments);
            if (!this.__cpBusy) {
                syncAllLanes(this);
                relayoutWidgets(this);
                resizeToContent(this);
            }
            return r;
        };

        nodeType.prototype.onConnectOutput = function (slot, _type, input, targetNode, _targetSlot) {
            if (!input.widget && !(input.type in ComfyWidgets)) {
                notify("warn", "Control Panel", `Can't drive a ${input.type} input.`);
                return false;
            }

            const record = recordOf(this, this.outputs[slot]);
            if (!record) return true;

            if (this.isOutputConnected(slot)) {
                const wantType = resolvedType(input);
                if (record.widgetType && wantType !== ANY && record.widgetType !== wantType) {
                    notify(
                        "warn",
                        "Control Panel",
                        `This control is wired as ${record.widgetType}; can't also drive a ${wantType} input.`,
                    );
                    return false;
                }
                // Fan-out to an additional same-type target: push the current
                // value immediately rather than waiting for the next queue.
                const widget = findWidget(this, record);
                if (widget) pushValueTo(targetNode, input, widget.value);
            }

            return true;
        };

        nodeType.prototype.applyToGraph = function () {
            for (const record of this.properties?.controls ?? []) {
                if (record.kind === "seed" && record.seedRandomize) {
                    const widget = findWidget(this, record);
                    if (widget) {
                        widget.value = randomSeed(widget.options);
                        widget.callback?.(widget.value);
                    }
                }
                applyLane(this, record);
            }
        };

        const onExtraMenu = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
            onExtraMenu?.apply(this, arguments);
            options.unshift({ content: "MB Settings", callback: () => openControlPanelSettings(this) });
        };
    },
});
