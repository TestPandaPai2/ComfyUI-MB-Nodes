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
// widget with the settings record it belongs to (`mbRecord`) so lanes can be
// added, removed and reordered without any index-juggling.

const NODE_ID = "MBControlPanel";
const MAX_CONTROLS = 16;
const INITIAL_LANES = 2;
const ANY = "*";

const COLOR_STORAGE_KEY = "MBNodes.ControlPanel.defaultColor";
const DEFAULT_ACCENT = "#212124";
const BODY_COLOR = "#212124";

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

function findOutputIndex(node, record) {
    return node.outputs?.findIndex((o) => o.mbRecord === record) ?? -1;
}

function findWidget(node, record) {
    return node.widgets?.find((w) => w.mbRecord === record);
}

function ensureProperties(node) {
    node.properties = node.properties ?? {};
    if (!Array.isArray(node.properties.controls)) node.properties.controls = [];
}

function relabelOutputs(node) {
    node.outputs?.forEach((out, i) => {
        const record = out.mbRecord;
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
    const max = options.max ?? Number.MAX_SAFE_INTEGER;
    return Math.floor(min + Math.random() * (max - min));
}

// --- colour --------------------------------------------------------------

function loadDefaultColor() {
    try {
        return localStorage.getItem(COLOR_STORAGE_KEY) || DEFAULT_ACCENT;
    } catch {
        return DEFAULT_ACCENT;
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
    node.color = hex;
    node.bgcolor = BODY_COLOR;
}

// --- seed lane's extra randomize/reroll row --------------------------------

const SEED_BTN_H = 22;

function addSeedButtons(node, record) {
    if ((node.widgets ?? []).some((w) => w.mbSeedButtonsFor === record)) return;

    const widget = {
        type: "mb_cp_seed_buttons",
        name: "seed_buttons",
        mbSeedButtonsFor: record,
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
                ctx.fillStyle = active[i] ? accentColor() : "#2a2a2e";
                ctx.strokeStyle = ctx.fillStyle;
                ctx.beginPath();
                ctx.roundRect(x, ry, rw, rh, 8);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = "#ececee";
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

// The toggle widget's on/off label option key has gone by a couple of names
// across ComfyUI versions -- set both so whichever one the running widget
// reads picks it up.
function setBoolLabels(widget, on, off) {
    if (on) {
        widget.options.on = on;
        widget.options.label_on = on;
    }
    if (off) {
        widget.options.off = off;
        widget.options.label_off = off;
    }
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
        node.__cpFullValues.set(record, full);
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
    const built = ComfyWidgets[type](node, `ctrl_${idx}`, inputData, app);
    const widget = built?.widget;
    if (!widget) return;
    widget.mbRecord = record;

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
        if (w.mbRecord !== record && w.mbSeedButtonsFor !== record) return true;
        w.onRemove?.();
        return false;
    });
    record.widgetType = null;
    record.kind = null;
    node.__cpFullValues?.delete(record);
}

function applyLane(node, record) {
    const idx = findOutputIndex(node, record);
    if (idx < 0) return;
    const links = node.outputs[idx]?.links;
    if (!links?.length || !node.graph) return;
    const widget = findWidget(node, record);
    if (!widget) return;
    for (const linkId of links) {
        const link = node.graph.links[linkId];
        if (!link) continue;
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
            const output = node.outputs[idx];
            const hasLink = (output.links?.length ?? 0) > 0;
            const widget = findWidget(node, record);

            if (hasLink && !widget) {
                const link = node.graph?.links?.[output.links[0]];
                const targetNode = link ? node.graph.getNodeById(link.target_id) : null;
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
        const bw = (node.widgets ?? []).find((w) => w.mbSeedButtonsFor === record);
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

function addLane(node) {
    if (node.properties.controls.length >= MAX_CONTROLS) return;
    const record = newRecord();
    node.properties.controls.push(record);
    const out = node.addOutput(`value_${node.properties.controls.length}`, ANY);
    out.mbRecord = record;
    relabelOutputs(node);
}

function removeLane(node, record) {
    teardownLane(node, record);
    const idx = findOutputIndex(node, record);
    if (idx >= 0) node.removeOutput(idx);
    const ci = node.properties.controls.indexOf(record);
    if (ci >= 0) node.properties.controls.splice(ci, 1);
    relabelOutputs(node);
    relayoutWidgets(node);
    resizeToContent(node);
}

// --- workflow load / fresh-node bring-up -----------------------------------

function restoreWidgetValues(node) {
    // Primary path: value lives directly on the record (set on every widget
    // change, see buildLaneWidget), so restore is keyed by lane, not position
    // -- correct even if a lane's link target went missing and its widget
    // never got built.
    let usedRecordValues = false;
    for (const record of node.properties.controls) {
        if (record.value === undefined) continue;
        const widget = findWidget(node, record);
        if (widget) widget.value = record.value;
        usedRecordValues = true;
    }
    if (usedRecordValues) return;

    // Legacy fallback: workflows saved before per-record values existed only
    // carry a flat widgets_values array, index-matched to serializable
    // widgets. Best-effort only -- misaligns if a lane's link target is gone.
    const values = node.widgets_values;
    if (!Array.isArray(values)) return;
    const serializable = (node.widgets ?? []).filter((w) => w.options?.serialize !== false && w.serialize !== false);
    serializable.forEach((w, i) => {
        if (values[i] !== undefined) w.value = values[i];
    });
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
            out.mbRecord = record;
        }
    } else {
        // Loaded or pasted node -- outputs must match the saved lane count;
        // retag by position (that's how it was saved) and rebuild wired lanes.
        while (node.outputs.length > node.properties.controls.length) node.removeOutput(node.outputs.length - 1);
        while (node.outputs.length < node.properties.controls.length) {
            node.addOutput(`value_${node.outputs.length + 1}`, ANY);
        }
        node.properties.controls.forEach((record, i) => {
            node.outputs[i].mbRecord = record;
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
        "flex:1; min-width:0; padding:4px 8px; background:#2a2a2e; color:#ececee; border:1px solid transparent; border-radius:7px; outline:none; font-size:12px;";
    return i;
}

function numOrNull(v) {
    const n = Number(v);
    return v === "" || Number.isNaN(n) ? null : n;
}

function buildLaneRow(node, record) {
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
    kindTag.style.cssText = "font-size:11px; color:#77777e; white-space:nowrap;";
    kindTag.textContent = record.kind ?? "blank";

    const remove = document.createElement("button");
    remove.className = "mb-dialog-remove";
    remove.textContent = "×";
    remove.title = "Remove control";

    let removed = false;
    remove.onclick = () => {
        removed = true;
        removeLane(node, record);
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
            if (widget) setBoolLabels(widget, record.boolLabelOn, record.boolLabelOff);
        });
    } else if (record.kind === "dropdown") {
        const widget = findWidget(node, record);
        const full = node.__cpFullValues?.get(record) ?? widget?.options?.values ?? [];
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
            const min = widget.options?.min ?? 0;
            const max = widget.options?.max ?? 0;
            widget.value = (min + max) / 2;
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

            function renderRows() {
                list.innerHTML = "";
                rows = node.properties.controls.map((record) => buildLaneRow(node, record));
                rows.forEach((r) => list.appendChild(r.el));
            }
            renderRows();

            const addBtn = document.createElement("button");
            addBtn.className = "mb-dialog-button";
            addBtn.textContent = "+ Add control";
            addBtn.onclick = () => {
                if (node.properties.controls.length >= MAX_CONTROLS) return;
                addLane(node);
                relayoutWidgets(node);
                resizeToContent(node);
                node.setDirtyCanvas(true, true);
                renderRows();
                addBtn.disabled = node.properties.controls.length >= MAX_CONTROLS;
            };
            addBtn.disabled = node.properties.controls.length >= MAX_CONTROLS;

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

            const record = this.outputs[slot]?.mbRecord;
            if (!record) return true;

            const output = this.outputs[slot];
            if (output.links?.length) {
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
