import { app } from "../../scripts/app.js";

// Small floating badge, bottom-right of the canvas, showing live node count.
// Pure DOM overlay -- never touches menus/sidebar/canvas draw loop.
let badge = null;

function ensureBadge() {
    if (badge) return badge;

    badge = document.createElement("div");
    badge.id = "mbnodes-node-count-badge";
    Object.assign(badge.style, {
        position: "fixed",
        bottom: "8px",
        right: "8px",
        padding: "2px 8px",
        borderRadius: "10px",
        background: "#000",
        color: "#dcdcdc",
        font: "11px Arial, sans-serif",
        opacity: "0.35",
        pointerEvents: "none",
        zIndex: 1000,
        userSelect: "none",
        transition: "opacity 0.15s",
    });
    document.body.appendChild(badge);
    return badge;
}

function updateBadge() {
    const count = app.graph?._nodes?.length ?? 0;
    ensureBadge().textContent = `${count} node${count === 1 ? "" : "s"}`;
}

function showBadge(on) {
    ensureBadge().style.display = on === false ? "none" : "";
}

app.registerExtension({
    name: "MBNodes.NodeCountBadge",

    settings: [
        {
            id: "MBNodes.Feature.NodeCount",
            category: ["MB", "Features", "Node count badge"],
            name: "Node count badge",
            tooltip: "Live node count in the bottom-right corner of the canvas.",
            type: "boolean",
            defaultValue: true,
            onChange: showBadge,
        },
    ],

    async setup() {
        showBadge(app.extensionManager?.setting?.get("MBNodes.Feature.NodeCount"));
        updateBadge();

        const graph = app.graph;
        const origAdd = graph.onNodeAdded;
        graph.onNodeAdded = function (node) {
            origAdd?.call(this, node);
            updateBadge();
        };

        const origRemove = graph.onNodeRemoved;
        graph.onNodeRemoved = function (node) {
            origRemove?.call(this, node);
            updateBadge();
        };

        const origConfigure = graph.onConfigure;
        graph.onConfigure = function (...args) {
            origConfigure?.apply(this, args);
            updateBadge();
        };
    },
});
