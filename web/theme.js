import { app } from "../../scripts/app.js";

const SETTING_ID = "MBNodes.Theme";

// MB nodes use Comfy's stock node look. The setting only picks the accent for
// MB-specific controls (active buttons, selections, tag highlights), published
// as --mb-accent.
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

// Title/body colours the old flat theme saved into workflows. Nodes still
// carrying them go back to stock; a colour the user picked by hand is kept.
const OLD_THEME_COLORS = new Set([...Object.values(PRESETS), "#e0399c", "#1c1c1f", "#212124"]);

function isMBNode(node) {
    const category = node?.constructor?.nodeData?.category;
    return category === "MBNodes" || /^MB[A-Z]/.test(node?.comfyClass ?? "");
}

const CUSTOM = "Custom";
const CUSTOM_ID = "MBNodes.Theme.CustomAccent";
const TINT_ID = "MBNodes.AccentTint";
const POLISH_ID = "MBNodes.StylePolish";

let accent = PRESETS[DEFAULT_PRESET];
let tint = false;

function setAccent(value) {
    // The colour setting stores hex without the leading #.
    const custom = app.extensionManager?.setting?.get(CUSTOM_ID);
    accent = value === CUSTOM && custom ? `#${custom.replace(/^#/, "")}` : PRESETS[value] ?? PRESETS[DEFAULT_PRESET];
    document.documentElement.style.setProperty("--mb-accent", accent);
    app.canvas?.setDirty(true, true);
}

function styleTag(id, css) {
    let tag = document.getElementById(id);
    if (!tag) {
        tag = document.createElement("style");
        tag.id = id;
        document.head.appendChild(tag);
    }
    tag.textContent = css;
}

// Canvas colours the accent takes over when tinting. Loading a colour palette
// writes these LiteGraph globals, so they are wrapped: the palette's value is
// kept and handed back whenever tinting is off.
const TINT_KEYS = ["NODE_BOX_OUTLINE_COLOR", "CONNECTING_LINK_COLOR"];

function wrapTintKeys() {
    for (const key of TINT_KEYS) {
        let stored = LiteGraph[key];
        Object.defineProperty(LiteGraph, key, {
            get: () => (tint ? accent : stored),
            set: (value) => { stored = value; },
            configurable: true,
        });
    }
}

function setTint(on) {
    tint = !!on;
    // The frontend defines these on both :root and .dark-theme.
    styleTag("mb-accent-tint", tint
        ? ":root, .dark-theme { --primary-background: var(--mb-accent) !important; --node-stroke-selected: var(--mb-accent) !important; }"
        : "");
    app.canvas?.setDirty(true, true);
}

const POLISH_CSS = `
* { scrollbar-width: thin; }
.litegraph.litecontextmenu, .p-contextmenu, .p-menu, .p-tieredmenu, .p-dialog, .graphdialog, .comfy-modal { border-radius: 10px !important; }
.litegraph.litecontextmenu .litemenu-entry { border-radius: 6px; margin: 1px 4px; }
`;

function setPolish(on) {
    styleTag("mb-style-polish", on ? POLISH_CSS : "");
    LiteGraph.ROUND_RADIUS = on ? 12 : 8;
    app.canvas?.setDirty(true, true);
}

app.registerExtension({
    name: "MBNodes.Theme",

    settings: [
        {
            id: SETTING_ID,
            category: ["MB", "Theme", "Accent colour"],
            name: "Accent colour",
            tooltip: "Accent for active buttons, selections and highlights on MB nodes.",
            type: "combo",
            options: [...Object.keys(PRESETS), CUSTOM],
            defaultValue: DEFAULT_PRESET,
            onChange: setAccent,
        },
        {
            id: CUSTOM_ID,
            category: ["MB", "Theme", "Custom accent"],
            name: "Custom accent colour",
            tooltip: "Used when Accent colour is set to Custom.",
            type: "color",
            defaultValue: PRESETS[DEFAULT_PRESET].slice(1),
            onChange: () => {
                const preset = app.extensionManager?.setting?.get(SETTING_ID);
                if (preset === CUSTOM) setAccent(CUSTOM);
            },
        },
        {
            id: TINT_ID,
            category: ["MB", "Theme", "Accent tints UI"],
            name: "Accent tints whole UI",
            tooltip: "Use the accent colour for node selection outlines, the wire being dragged and the UI's primary highlight, over any colour palette.",
            type: "boolean",
            defaultValue: false,
            onChange: setTint,
        },
        {
            id: POLISH_ID,
            category: ["MB", "Theme", "Style polish"],
            name: "Style polish",
            tooltip: "Rounder node corners, rounded menus and dialogs, thin scrollbars.",
            type: "boolean",
            defaultValue: false,
            onChange: setPolish,
        },
    ],

    async init() {
        wrapTintKeys();
    },

    async setup() {
        const settings = app.extensionManager?.setting;
        setAccent(settings?.get(SETTING_ID) ?? DEFAULT_PRESET);
        setTint(settings?.get(TINT_ID));
        setPolish(settings?.get(POLISH_ID));
    },

    async loadedGraphNode(node) {
        if (!isMBNode(node) || node.comfyClass === "MBControlPanel") return;
        if (OLD_THEME_COLORS.has(node.color)) delete node.color;
        if (OLD_THEME_COLORS.has(node.bgcolor)) delete node.bgcolor;
    },
});
