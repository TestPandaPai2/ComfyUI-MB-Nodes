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

function setAccent(value) {
    document.documentElement.style.setProperty("--mb-accent", PRESETS[value] ?? PRESETS[DEFAULT_PRESET]);
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
            options: Object.keys(PRESETS),
            defaultValue: DEFAULT_PRESET,
            onChange: setAccent,
        },
    ],

    async setup() {
        setAccent(app.extensionManager?.setting?.get(SETTING_ID) ?? DEFAULT_PRESET);
    },

    async loadedGraphNode(node) {
        if (!isMBNode(node) || node.comfyClass === "MBControlPanel") return;
        if (OLD_THEME_COLORS.has(node.color)) delete node.color;
        if (OLD_THEME_COLORS.has(node.bgcolor)) delete node.bgcolor;
    },
});
