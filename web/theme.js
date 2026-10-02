import { app } from "../../scripts/app.js";

const SETTING_ID = "MBNodes.Theme";

// Soft look: one flat body colour (title included), muted control fills and
// one accent for the title dot, sockets, toggles and slider fill. The setting
// only swaps the accent.
const BODY_COLOR = "#212124";
const TITLE_COLOR = BODY_COLOR;
const FIELD_COLOR = "#2a2a2e";
const TRACK_COLOR = "#2f2f34";
const LABEL_COLOR = "#8e8e95";
const HINT_COLOR = "#77777e";
const VALUE_COLOR = "#ececee";
const PRESETS = {
    Pink: "#d4537e",
    Green: "#1fae65",
    Purple: "#9d4edd",
    Teal: "#14b8a6",
    Gold: "#d4a017",
    Blue: "#3b82f6",
    Red: "#e5484d",
    Orange: "#f97316",
    Indigo: "#6366f1",
    Slate: "#64748b",
    Orchid: "#bb00ff",
};
const DEFAULT_PRESET = "Pink";
const OLD_TITLE_COLORS = new Set([...Object.values(PRESETS), "#e0399c", "#1c1c1f"]);

const MARGIN = 15; // matches the inset LiteGraph uses for its own widgets
const FONT = "12px Arial";
const CONTROL_WIDTH = 120;

let accent = PRESETS[DEFAULT_PRESET];

// MBControlPanel picks its own title colour (per node, savable as a default),
// so it gets the widgets, sockets and dot but keeps its colours.
function ownsColor(node) {
    return node.comfyClass === "MBControlPanel";
}

function isMBNode(node) {
    const category = node?.constructor?.nodeData?.category;
    return category === "MBNodes" || /^MB[A-Z]/.test(node?.comfyClass ?? "");
}

function pill(ctx, x, y, w, h, fill, r = 7) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
}

function label(ctx, text, y, h) {
    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = "left";
    ctx.fillText(text, MARGIN + 4, y + h / 2);
}

function fitText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let shown = text;
    while (shown.length > 1 && ctx.measureText(shown + "…").width > maxWidth) shown = shown.slice(0, -1);
    return shown + "…";
}

function formatValue(w) {
    if (w.type === "number" || w.type === "slider") {
        const precision = w.options?.precision ?? (Number.isInteger(w.value) ? 0 : 2);
        return Number(w.value).toFixed(precision);
    }
    return String(w.value ?? "");
}

function controlX(width) {
    return width - MARGIN - CONTROL_WIDTH;
}

function setValue(w, node, canvas, value) {
    const old = w.value;
    if (value === old) return;
    w.value = value;
    w.callback?.(value, canvas, node);
    node.onWidgetChanged?.(w.name, value, old, w);
    node.graph?.incrementVersion?.();
    node.setDirtyCanvas(true, true);
}

function chevron(ctx, cx, cy) {
    ctx.strokeStyle = HINT_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 2);
    ctx.lineTo(cx, cy + 2);
    ctx.lineTo(cx + 4, cy - 2);
    ctx.stroke();
}

function drawCombo(ctx, node, width, y, h) {
    const x = controlX(width), cy = y + h / 2;
    label(ctx, this.label ?? this.name, y, h);
    pill(ctx, x, y + 2, CONTROL_WIDTH, h - 4, FIELD_COLOR);
    ctx.fillStyle = VALUE_COLOR;
    ctx.textAlign = "left";
    ctx.fillText(fitText(ctx, formatValue(this), CONTROL_WIDTH - 34), x + 10, cy);
    chevron(ctx, x + CONTROL_WIDTH - 14, cy);
}

function drawNumber(ctx, node, width, y, h) {
    const x = controlX(width), cy = y + h / 2;
    label(ctx, this.label ?? this.name, y, h);
    pill(ctx, x, y + 2, CONTROL_WIDTH, h - 4, FIELD_COLOR);
    ctx.fillStyle = HINT_COLOR;
    ctx.textAlign = "center";
    ctx.fillText("−", x + 12, cy);
    ctx.fillText("+", x + CONTROL_WIDTH - 12, cy);
    ctx.fillStyle = VALUE_COLOR;
    ctx.fillText(fitText(ctx, formatValue(this), CONTROL_WIDTH - 48), x + CONTROL_WIDTH / 2, cy);
}

function drawText(ctx, node, width, y, h) {
    const x = controlX(width);
    label(ctx, this.label ?? this.name, y, h);
    pill(ctx, x, y + 2, CONTROL_WIDTH, h - 4, FIELD_COLOR);
    ctx.fillStyle = VALUE_COLOR;
    ctx.textAlign = "left";
    ctx.fillText(fitText(ctx, formatValue(this), CONTROL_WIDTH - 20), x + 10, y + h / 2);
}

function drawToggle(ctx, node, width, y, h) {
    label(ctx, this.label ?? this.name, y, h);
    const tw = 28, th = 16, x = width - MARGIN - tw, ty = y + (h - th) / 2;
    pill(ctx, x, ty, tw, th, this.value ? accent : "#3a3a3f", th / 2);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(this.value ? x + tw - th / 2 : x + th / 2, ty + th / 2, th / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawSlider(ctx, node, width, y, h) {
    const x = controlX(width), cy = y + h / 2;
    const text = this.label ?? this.name;
    label(ctx, text, y, h);
    ctx.fillStyle = VALUE_COLOR;
    ctx.fillText(formatValue(this), MARGIN + 10 + ctx.measureText(text).width, cy);
    const min = this.options?.min ?? 0, max = this.options?.max ?? 1;
    const t = max > min ? Math.min(Math.max((this.value - min) / (max - min), 0), 1) : 0;
    pill(ctx, x, cy - 1.5, CONTROL_WIDTH, 3, TRACK_COLOR, 2);
    if (t > 0) pill(ctx, x, cy - 1.5, CONTROL_WIDTH * t, 3, accent, 2);
    ctx.fillStyle = VALUE_COLOR;
    ctx.beginPath();
    ctx.arc(x + CONTROL_WIDTH * t, cy, 5.5, 0, Math.PI * 2);
    ctx.fill();
}

// The controls sit in a fixed-width column on the right, so LiteGraph's own
// edge hit zones don't line up with them -- those clicks are handled here.
function onNumberDown(pointer, node, canvas) {
    const x = canvas.graph_mouse[0] - node.pos[0] - controlX(node.size[0]);
    const dir = x >= 0 && x < 24 ? -1 : x > CONTROL_WIDTH - 24 && x <= CONTROL_WIDTH ? 1 : 0;
    if (!dir) return false;
    const { min = -Infinity, max = Infinity, step2, step = 10, precision } = this.options ?? {};
    const v = Math.min(Math.max(this.value + dir * (step2 ?? step / 10), min), max);
    setValue(this, node, canvas, precision == null ? v : Number(v.toFixed(precision)));
    return true;
}

function onComboDown(pointer, node, canvas) {
    let values = this.options?.values ?? [];
    if (typeof values === "function") values = values(this, node);
    new LiteGraph.ContextMenu(values, {
        event: pointer.eDown,
        scale: Math.max(1, canvas.ds.scale),
        callback: (value) => setValue(this, node, canvas, value),
    });
    return true;
}

function onSliderDown(pointer, node, canvas) {
    const update = (canvasX) => {
        const t = Math.min(Math.max((canvasX - node.pos[0] - controlX(node.size[0])) / CONTROL_WIDTH, 0), 1);
        const { min = 0, max = 1, step2, precision } = this.options ?? {};
        let v = min + t * (max - min);
        if (step2) v = Math.round(v / step2) * step2;
        setValue(this, node, canvas, precision == null ? v : Number(v.toFixed(precision)));
    };
    update(canvas.graph_mouse[0]);
    pointer.onDrag = (e) => update(e.canvasX);
    return true;
}

const DRAWERS = { number: drawNumber, combo: drawCombo, text: drawText, toggle: drawToggle, slider: drawSlider };
const POINTER_HANDLERS = { number: onNumberDown, combo: onComboDown, slider: onSliderDown };

function wrapDraw(fn) {
    return function (ctx, node, width, y, h) {
        ctx.save();
        ctx.font = FONT;
        ctx.textBaseline = "middle";
        if (this.disabled) ctx.globalAlpha *= 0.5;
        fn.call(this, ctx, node, width, y, h);
        ctx.restore();
    };
}

// Widgets that already paint themselves (MB buttons, crop previews) keep
// their own draw.
function styleWidgets(node) {
    for (const w of node.widgets ?? []) {
        if (w.draw || w.element) continue;
        const fn = DRAWERS[w.type];
        if (!fn) continue;
        w.draw = wrapDraw(fn);
        if (POINTER_HANDLERS[w.type]) w.onPointerDown = POINTER_HANDLERS[w.type];
    }
}

function paintSlots(node) {
    for (const slot of [...(node.inputs ?? []), ...(node.outputs ?? [])]) {
        slot.color_on = accent;
        slot.color_off = accent;
    }
}

// LGraphNode declares `color` and `bgcolor` as class fields, so every instance
// gets its own undefined property — setting them on the prototype is shadowed
// and has no effect. They have to be written on the instance.
function applyTheme(node) {
    if (!ownsColor(node)) {
        node.color = TITLE_COLOR;
        node.bgcolor = BODY_COLOR;
    }
    node.shape = "round";
    styleWidgets(node);
    paintSlots(node);
    node.setDirtyCanvas(true, true);
}

function installHooks(node) {
    node.onDrawTitleBox = function (ctx, titleHeight) {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(titleHeight * 0.5, -titleHeight * 0.5, 4, 0, Math.PI * 2);
        ctx.fill();
    };
    // Widgets and sockets added later (dynamic inputs, rebuilt combos) pick
    // the theme up on the next frame.
    const onDrawForeground = node.onDrawForeground;
    node.onDrawForeground = function () {
        styleWidgets(this);
        paintSlots(this);
        return onDrawForeground?.apply(this, arguments);
    };
}

function retheme() {
    document.documentElement.style.setProperty("--mb-accent", accent);
    for (const node of app.graph?._nodes ?? []) {
        if (isMBNode(node)) paintSlots(node);
    }
    app.canvas?.setDirty(true, true);
}

app.registerExtension({
    name: "MBNodes.Theme",

    settings: [
        {
            id: SETTING_ID,
            category: ["MB", "Theme", "Accent colour"],
            name: "Accent colour",
            tooltip: "Accent for the title dot, sockets, toggles and sliders on every MB node.",
            type: "combo",
            options: Object.keys(PRESETS),
            defaultValue: DEFAULT_PRESET,
            onChange: (value) => {
                accent = PRESETS[value] ?? PRESETS[DEFAULT_PRESET];
                retheme();
            },
        },
    ],

    async setup() {
        const value = app.extensionManager?.setting?.get(SETTING_ID) ?? DEFAULT_PRESET;
        accent = PRESETS[value] ?? PRESETS[DEFAULT_PRESET];
        retheme();
    },

    async nodeCreated(node) {
        if (!isMBNode(node)) return;
        installHooks(node);
        applyTheme(node);
    },

    async loadedGraphNode(node) {
        // Old workflows saved the previous title-bar preset; those get the new
        // look. A colour the user picked by hand is left alone.
        if (!isMBNode(node)) return;
        if (ownsColor(node) || !node.color || OLD_TITLE_COLORS.has(node.color)) applyTheme(node);
    },
});
