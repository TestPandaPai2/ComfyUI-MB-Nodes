// Load Models Combo (MB): easier picking with many model files.
// - Clicking the model / CLIP / VAE dropdowns opens a grouped menu: starred
//   files, the last few picked, "Search all…" (the stock filterable list),
//   then files grouped by subfolder.
// - Right-click the node to star or unstar the current files.
// - The Presets button saves and applies whole model + CLIP + VAE sets.
// - A file a loaded workflow points at but that isn't on disk is outlined red.
// Favorites, recents and presets live in hidden ComfyUI settings, so they
// follow the user profile and are shared by every workflow.

import { app } from "../../scripts/app.js";
import { addButton, getWidget } from "./common.js";

const NODE_ID = "MBModelCombo";
const SLOTS = { unet_name: "model", clip_name: "clip", vae_name: "vae" };
const PRESET_KEYS = ["unet_name", "weight_dtype", "clip_name", "clip_type", "clip_device", "vae_name"];
const FAVORITES_ID = "MBNodes.ModelCombo.Favorites";
const RECENTS_ID = "MBNodes.ModelCombo.Recents";
const PRESETS_ID = "MBNodes.ModelCombo.Presets";
const RECENT_COUNT = 5;
const MISSING_COLOR = "#e5484d";

const settings = () => app.extensionManager.setting;
const stored = (id) => settings().get(id) ?? {};
const basename = (path) => path.split(/[\\/]/).pop();

function setWidgetValue(node, widget, value) {
    widget.value = value;
    widget.callback?.(value, app.canvas, node);
    node.setDirtyCanvas(true, true);
}

function remember(slot, value) {
    const recents = stored(RECENTS_ID);
    recents[slot] = [value, ...(recents[slot] ?? []).filter((v) => v !== value)].slice(0, RECENT_COUNT);
    settings().set(RECENTS_ID, { ...recents });
}

function toggleFavorite(slot, value) {
    const favorites = stored(FAVORITES_ID);
    const list = favorites[slot] ?? [];
    favorites[slot] = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    settings().set(FAVORITES_ID, { ...favorites });
}

// ------------------------------------------------------------------ picker

// Paths like "flux/dev/model.safetensors" become nested folder submenus.
function fileTree(values) {
    const root = { folders: new Map(), files: [] };
    for (const value of values) {
        const parts = value.split(/[\\/]/);
        let level = root;
        for (const part of parts.slice(0, -1)) {
            if (!level.folders.has(part)) level.folders.set(part, { folders: new Map(), files: [] });
            level = level.folders.get(part);
        }
        level.files.push(value);
    }
    return root;
}

function treeItems(tree, pick) {
    const folders = [...tree.folders.keys()].sort((a, b) => a.localeCompare(b));
    return [
        ...folders.map((name) => ({
            content: `📁 ${name}`,
            has_submenu: true,
            submenu: { options: treeItems(tree.folders.get(name), pick) },
        })),
        ...tree.files.map((value) => ({ content: basename(value), callback: () => pick(value) })),
    ];
}

function openPicker(node, widget, slot, event) {
    const values = widget.options.values;
    const pick = (value) => setWidgetValue(node, widget, value);
    const scale = Math.max(1, app.canvas.ds.scale);

    const favorites = (stored(FAVORITES_ID)[slot] ?? []).filter((v) => values.includes(v));
    const recents = (stored(RECENTS_ID)[slot] ?? []).filter((v) => values.includes(v) && !favorites.includes(v));
    const items = [
        ...favorites.map((v) => ({ content: `★ ${v}`, callback: () => pick(v) })),
        ...recents.map((v) => ({ content: `🕒 ${v}`, callback: () => pick(v) })),
    ];
    if (items.length) items.push(null);
    items.push({
        content: "🔍 Search all…",
        // The stock flat list; ComfyUI adds its type-to-filter box to it.
        callback: () => new LiteGraph.ContextMenu(values, {
            event,
            scale,
            className: "dark",
            callback: (value) => pick(typeof value === "string" ? value : value?.content),
        }),
    }, null, ...treeItems(fileTree(values), pick));

    new LiteGraph.ContextMenu(items, { event, scale, className: "dark" });
}

// The arrows at either end still step through the list as usual; a click on
// the middle opens the grouped menu instead of the flat one.
function hookSlot(node, name, slot) {
    const widget = getWidget(node, name);
    if (!widget) return;

    const prevClick = widget.onClick;
    widget.onClick = function (options) {
        const x = options.e.canvasX - options.node.pos[0];
        const width = this.width || options.node.size[0];
        if (x < 40 || x > width - 40 || !Array.isArray(this.options.values)) return prevClick.call(this, options);
        openPicker(node, this, slot, options.e);
    };

    const prevCallback = widget.callback;
    widget.callback = function (value) {
        const r = prevCallback?.apply(this, arguments);
        if (typeof value === "string") remember(slot, value);
        return r;
    };
}

// ----------------------------------------------------------------- presets

function currentValues(node) {
    const values = {};
    for (const key of PRESET_KEYS) {
        const widget = getWidget(node, key);
        if (widget) values[key] = widget.value;
    }
    return values;
}

function applyPreset(node, preset) {
    for (const key of PRESET_KEYS) {
        const widget = getWidget(node, key);
        if (widget && preset[key] !== undefined) setWidgetValue(node, widget, preset[key]);
    }
}

function savePreset(node, event) {
    app.canvas.prompt("Preset name", "", (value) => {
        const name = String(value ?? "").trim();
        if (!name) return;
        settings().set(PRESETS_ID, { ...stored(PRESETS_ID), [name]: currentValues(node) });
    }, event);
}

function deletePreset(name) {
    const presets = { ...stored(PRESETS_ID) };
    delete presets[name];
    settings().set(PRESETS_ID, presets);
}

function openPresets(node, event) {
    const presets = stored(PRESETS_ID);
    const names = Object.keys(presets).sort((a, b) => a.localeCompare(b));
    const items = names.map((name) => ({ content: name, callback: () => applyPreset(node, presets[name]) }));
    if (items.length) items.push(null);
    items.push({ content: "💾 Save current as…", callback: () => savePreset(node, event) });
    if (names.length) {
        items.push({
            content: "🗑 Delete",
            has_submenu: true,
            submenu: { options: names.map((name) => ({ content: name, callback: () => deletePreset(name) })) },
        });
    }
    new LiteGraph.ContextMenu(items, { event, scale: Math.max(1, app.canvas.ds.scale), className: "dark" });
}

// ----------------------------------------------------------------- missing

const isMissing = (widget) => Array.isArray(widget?.options?.values) && !widget.options.values.includes(widget.value);

function drawMissing(node, ctx) {
    let any = false;
    ctx.save();
    ctx.strokeStyle = MISSING_COLOR;
    ctx.lineWidth = 1.5;
    for (const name of Object.keys(SLOTS)) {
        const widget = getWidget(node, name);
        if (!isMissing(widget) || widget.y == null || widget.hidden) continue;
        any = true;
        ctx.beginPath();
        ctx.roundRect(15, widget.y, node.size[0] - 30, LiteGraph.NODE_WIDGET_HEIGHT, LiteGraph.NODE_WIDGET_HEIGHT / 2);
        ctx.stroke();
    }
    if (any && !node.flags?.collapsed) {
        ctx.font = "11px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = MISSING_COLOR;
        ctx.fillText("missing file", node.size[0] - 10, -LiteGraph.NODE_TITLE_HEIGHT / 2);
    }
    ctx.restore();
}

// ------------------------------------------------------------------ wiring

function wireNode(node) {
    for (const [name, slot] of Object.entries(SLOTS)) hookSlot(node, name, slot);

    // Appended last and never serialized, so saved widget values keep their positions.
    addButton(node, "Presets", (widget, canvas, n, pos, event) => openPresets(node, event));

    const prevMenu = node.getExtraMenuOptions;
    node.getExtraMenuOptions = function (canvas, options) {
        prevMenu?.apply(this, arguments);
        const favorites = stored(FAVORITES_ID);
        const items = [];
        for (const [name, slot] of Object.entries(SLOTS)) {
            const value = getWidget(node, name)?.value;
            if (typeof value !== "string" || !value) continue;
            const starred = (favorites[slot] ?? []).includes(value);
            items.push({
                content: `${starred ? "☆ Unstar" : "★ Star"} ${slot}: ${basename(value)}`,
                callback: () => toggleFavorite(slot, value),
            });
        }
        options.unshift(...items, null);
    };

    const prevDraw = node.onDrawForeground;
    node.onDrawForeground = function (ctx) {
        const r = prevDraw?.apply(this, arguments);
        drawMissing(node, ctx);
        return r;
    };
}

app.registerExtension({
    name: "MBNodes.ModelCombo",

    settings: [
        { id: FAVORITES_ID, name: "Model combo favorites", type: "hidden", defaultValue: {} },
        { id: RECENTS_ID, name: "Model combo recents", type: "hidden", defaultValue: {} },
        { id: PRESETS_ID, name: "Model combo presets", type: "hidden", defaultValue: {} },
    ],

    async nodeCreated(node) {
        if (node.comfyClass !== NODE_ID) return;
        wireNode(node);
    },
});
