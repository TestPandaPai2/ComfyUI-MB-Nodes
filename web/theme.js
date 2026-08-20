import { app } from "../../scripts/app.js";

const SETTING_ID = "MBNodes.Theme";

// Five dark presets, one accent colour apiece. The body stays the same
// near-black across all of them -- only the title bar changes.
const BODY_COLOR = "#0d0d0d";
const PRESETS = {
    Green: "#1fae65",
    Pink: "#e0399c",
    Purple: "#9d4edd",
    Teal: "#14b8a6",
    Gold: "#d4a017",
};
const DEFAULT_PRESET = "Green";

let titleColor = PRESETS[DEFAULT_PRESET];

function isMBNode(node) {
    const category = node?.constructor?.nodeData?.category;
    return category === "MBNodes" || /^MB[A-Z]/.test(node?.comfyClass ?? "");
}

// LGraphNode declares `color` and `bgcolor` as class fields, so every instance
// gets its own undefined property — setting them on the prototype is shadowed
// and has no effect. They have to be written on the instance.
function applyTheme(node) {
    node.color = titleColor;
    node.bgcolor = BODY_COLOR;
    node.setDirtyCanvas(true, true);
}

// Re-colours every MB node already on the canvas, so switching presets is
// visible immediately instead of only affecting nodes added afterwards.
function retheme() {
    for (const node of app.graph?._nodes ?? []) {
        if (isMBNode(node)) applyTheme(node);
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
            tooltip: "Title bar colour for every MB node. All five presets share the same dark body.",
            type: "combo",
            options: Object.keys(PRESETS),
            defaultValue: DEFAULT_PRESET,
            onChange: (value) => {
                titleColor = PRESETS[value] ?? PRESETS[DEFAULT_PRESET];
                retheme();
            },
        },
    ],

    async setup() {
        const value = app.extensionManager?.setting?.get(SETTING_ID) ?? DEFAULT_PRESET;
        titleColor = PRESETS[value] ?? PRESETS[DEFAULT_PRESET];
        retheme();
    },

    async nodeCreated(node) {
        if (!isMBNode(node)) return;
        applyTheme(node);
    },

    async loadedGraphNode(node) {
        // Workflows saved before the theme existed carry no colour; a node the
        // user recoloured does, and that choice is left alone.
        if (!isMBNode(node) || node.color) return;
        applyTheme(node);
    },
});
