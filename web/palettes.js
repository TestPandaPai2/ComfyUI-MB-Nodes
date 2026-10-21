import { app } from "../../scripts/app.js";
import { hideButton, notify } from "./common.js";

// MB colour palettes, registered as native ComfyUI palettes so they show up in
// Settings -> Appearance -> Color Palette, plus a top-bar button that cycles
// through them. Each palette is built from a handful of base colours; anything
// not set here (slot type colours, etc.) is filled from the stock dark palette.

const PREFIX = "mb_";

// name, canvas, menu, title bar, node body, widget, text, border, accent
const BASES = [
    ["Graphite", "#121212", "#161616", "#1e1e1e", "#262626", "#1a1a1a", "#b8b8b8", "#333333", "#a0a0a0"],
    ["OLED", "#000000", "#000000", "#080808", "#0d0d0d", "#141414", "#c8c8c8", "#222222", "#d0d0d0"],
    ["Slate", "#10141a", "#0f1318", "#181e26", "#1f2630", "#161b22", "#b4c0cf", "#2b3542", "#7a9cc6"],
    ["Plum", "#141017", "#120e15", "#1e1823", "#271f2d", "#19141d", "#c4b5cf", "#3a2e42", "#b48ad0"],
    ["Forest", "#0f1411", "#0e1210", "#18201b", "#1f2923", "#141a16", "#b5c7ba", "#2c3a31", "#7fb08a"],
    ["Arctic", "#000000", "#000000", "#07090b", "#0b0d10", "#11151a", "#c2ccd8", "#1c2633", "#7fb2d9"],
    ["Deep Indigo", "#000000", "#000000", "#08070d", "#0c0b12", "#13121c", "#c4c2dc", "#23203a", "#8b87d6"],
    ["Glacier Mint", "#000000", "#000000", "#060a08", "#0a0f0d", "#101814", "#bcd4c8", "#183027", "#6cc7a1"],
    ["Ember", "#000000", "#000000", "#0a0807", "#100c0a", "#18120f", "#d4c4b8", "#33231a", "#d98a5c"],
    ["Ruby", "#000000", "#000000", "#0b0707", "#110a0b", "#191011", "#d6c0c2", "#3a1c20", "#d26a72"],
    ["Rose", "#000000", "#000000", "#0a0708", "#100b0d", "#181013", "#d8c2cb", "#36202a", "#d987a8"],
];

// Blend two #rrggbb colours; t = 0 gives a, 1 gives b.
function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const channel = (shift) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
    return "#" + ((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, "0");
}

// Dot grid in the border colour, tiled by the canvas as its background pattern.
function gridImage(color) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="1" fill="${color}"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildPalette([name, canvas, menu, title, body, widget, text, border, accent]) {
    const muted = mix(text, body, 0.4);
    return {
        id: PREFIX + name.toLowerCase().replace(/\s+/g, "_"),
        name: `MB ${name}`,
        colors: {
            node_slot: {},
            litegraph_base: {
                BACKGROUND_IMAGE: gridImage(border),
                CLEAR_BACKGROUND_COLOR: canvas,
                NODE_TITLE_COLOR: muted,
                NODE_SELECTED_TITLE_COLOR: text,
                NODE_TEXT_COLOR: text,
                NODE_TEXT_HIGHLIGHT_COLOR: "#ffffff",
                NODE_DEFAULT_COLOR: title,
                NODE_DEFAULT_BGCOLOR: body,
                NODE_DEFAULT_BOXCOLOR: muted,
                NODE_BOX_OUTLINE_COLOR: accent,
                DEFAULT_SHADOW_COLOR: "rgba(0,0,0,0.6)",
                WIDGET_BGCOLOR: widget,
                WIDGET_OUTLINE_COLOR: border,
                WIDGET_TEXT_COLOR: text,
                WIDGET_SECONDARY_TEXT_COLOR: muted,
                WIDGET_DISABLED_TEXT_COLOR: mix(border, text, 0.25),
                LINK_COLOR: mix(accent, body, 0.3),
                CONNECTING_LINK_COLOR: accent,
                BADGE_FG_COLOR: text,
                BADGE_BG_COLOR: title,
            },
            comfy_base: {
                "fg-color": mix(text, "#ffffff", 0.5),
                "bg-color": body,
                "comfy-menu-bg": menu,
                "comfy-menu-secondary-bg": title,
                "comfy-input-bg": widget,
                "input-text": text,
                "descrip-text": muted,
                "drag-text": text,
                "error-text": "#ff6b6b",
                "border-color": border,
                "tr-even-bg-color": widget,
                "tr-odd-bg-color": body,
                "content-bg": border,
                "content-fg": text,
                "content-hover-bg": title,
                "content-hover-fg": "#ffffff",
                "bar-shadow": "rgba(0, 0, 0, 0.6) 0 0 0.5rem",
            },
        },
    };
}

const PALETTES = BASES.map(buildPalette);

// The frontend reads its custom palettes from this setting right after the
// extensions' setup(), so writing ours there is what makes them selectable.
// Only written when something changed; renamed or removed MB palettes go.
async function registerPalettes(settings) {
    const custom = { ...(settings.get("Comfy.CustomColorPalettes") ?? {}) };
    const before = JSON.stringify(custom);
    for (const id of Object.keys(custom)) {
        if (id.startsWith(PREFIX)) delete custom[id];
    }
    for (const palette of PALETTES) custom[palette.id] = palette;
    if (JSON.stringify(custom) !== before) await settings.set("Comfy.CustomColorPalettes", custom);
}

const CYCLE_ID = "MBNodes.PaletteCycle";
const SWITCHER_ID = "MBNodes.Feature.PaletteSwitcher";

// The palettes the top-bar button steps through; an empty pick means all.
function cyclePalettes() {
    const ids = app.extensionManager.setting.get(CYCLE_ID);
    const picked = PALETTES.filter((p) => ids?.includes(p.id));
    return picked.length ? picked : PALETTES;
}

async function nextPalette() {
    const settings = app.extensionManager.setting;
    const cycle = cyclePalettes();
    const index = cycle.findIndex((p) => p.id === settings.get("Comfy.ColorPalette"));
    const next = cycle[(index + 1) % cycle.length];
    await settings.set("Comfy.ColorPalette", next.id);
    notify("info", next.name);
}

// One checkbox per MB palette; the setting holds the ids that are ticked.
function renderCycle(name, setValue, value) {
    const list = document.createElement("div");
    list.style.cssText = "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 16px;font-size:13px";
    const picked = new Set(value ?? PALETTES.map((p) => p.id));
    for (const palette of PALETTES) {
        const label = document.createElement("label");
        label.style.cssText = "display:flex;align-items:center;gap:6px;cursor:pointer";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = picked.has(palette.id);
        box.addEventListener("change", () => {
            if (box.checked) picked.add(palette.id);
            else picked.delete(palette.id);
            setValue(PALETTES.map((p) => p.id).filter((id) => picked.has(id)));
        });
        label.append(box, palette.name);
        list.appendChild(label);
    }
    return list;
}

app.registerExtension({
    name: "MBNodes.Palettes",

    settings: [
        {
            id: SWITCHER_ID,
            category: ["MB", "Features", "Palette switcher"],
            name: "Palette switcher",
            tooltip: "Palette button in the top bar that steps through the MB colour palettes.",
            type: "boolean",
            defaultValue: true,
            onChange: (on) => hideButton("mb-palette-button", on === false),
        },
        {
            id: CYCLE_ID,
            category: ["MB", "Theme", "Palette switcher cycle"],
            name: "Palette switcher cycle",
            tooltip: "Palettes the top-bar palette button steps through. None ticked means all of them.",
            type: renderCycle,
            defaultValue: PALETTES.map((p) => p.id),
        },
    ],

    actionBarButtons: [
        { class: "mb-palette-button", icon: "pi pi-palette", tooltip: "Next MB palette", onClick: nextPalette },
    ],

    async setup() {
        hideButton("mb-palette-button", app.extensionManager.setting.get(SWITCHER_ID) === false);
        await registerPalettes(app.extensionManager.setting);
    },
});
