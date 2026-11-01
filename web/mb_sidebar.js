import { app } from "../../scripts/app.js";

// "MB Nodes" sidebar tab, pinned to the top of the sidebar: lists only this
// pack's nodes by category. Drag an item onto the canvas or click to add it.

const TAB_ID = "mb-nodes";
const DRAG_TYPE = "application/x-mbnodes-type";

function packNodes() {
    return Object.values(LiteGraph.registered_node_types)
        .filter((t) => t.nodeData?.python_module?.includes("ComfyUI-MBNodes"))
        .map((t) => ({ type: t.type, title: t.title || t.nodeData.display_name || t.type, category: t.nodeData.category || "MB", description: t.nodeData.description || "" }))
        .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
}

function addNode(type, pos) {
    const node = LiteGraph.createNode(type);
    if (!node) return;
    const canvas = app.canvas;
    node.pos = pos ?? [canvas.ds.offset[0] * -1 + canvas.canvas.width / 2 / canvas.ds.scale, canvas.ds.offset[1] * -1 + canvas.canvas.height / 2 / canvas.ds.scale];
    app.graph.add(node);
    canvas.selectNode(node);
    app.graph.setDirtyCanvas(true, true);
}

function render(el) {
    el.innerHTML = "";
    el.style.cssText = "display:flex;flex-direction:column;height:100%;padding:8px;gap:6px;box-sizing:border-box";

    const search = document.createElement("input");
    search.placeholder = "Search MB nodes...";
    search.style.cssText = "padding:6px 8px;border-radius:6px;border:1px solid var(--border-color);background:var(--comfy-input-bg);color:var(--input-text)";
    const list = document.createElement("div");
    list.style.cssText = "overflow-y:auto;flex:1";
    el.append(search, list);

    const nodes = packNodes();
    const draw = () => {
        const q = search.value.trim().toLowerCase();
        list.innerHTML = "";
        let category = null;
        for (const n of nodes) {
            if (q && !n.title.toLowerCase().includes(q) && !n.category.toLowerCase().includes(q)) continue;
            if (n.category !== category) {
                category = n.category;
                const head = document.createElement("div");
                head.textContent = category;
                head.style.cssText = "font-size:11px;text-transform:uppercase;opacity:.6;margin:10px 4px 4px";
                list.appendChild(head);
            }
            const item = document.createElement("div");
            item.textContent = n.title;
            item.title = n.description;
            item.draggable = true;
            item.style.cssText = "padding:5px 8px;border-radius:5px;cursor:grab;font-size:13px;color:var(--input-text)";
            item.onmouseenter = () => (item.style.background = "var(--comfy-input-bg)");
            item.onmouseleave = () => (item.style.background = "");
            item.ondragstart = (e) => {
                e.dataTransfer.setData(DRAG_TYPE, n.type);
                e.dataTransfer.effectAllowed = "copy";
            };
            item.onclick = () => addNode(n.type);
            list.appendChild(item);
        }
    };
    search.oninput = draw;
    draw();
}

function pinToTop() {
    const button = document.querySelector(`.${TAB_ID}-tab-button`);
    const bar = button?.parentElement;
    if (bar && bar.firstElementChild !== button) bar.prepend(button);
}

app.registerExtension({
    name: "MBNodes.Sidebar",
    setup() {
        app.extensionManager.registerSidebarTab({
            id: TAB_ID,
            icon: "pi pi-box",
            title: "MB Nodes",
            tooltip: "MB Nodes",
            type: "custom",
            render,
        });

        const canvasEl = app.canvas.canvas;
        canvasEl.addEventListener("dragover", (e) => {
            if (e.dataTransfer.types.includes(DRAG_TYPE)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
            }
        });
        canvasEl.addEventListener("drop", (e) => {
            const type = e.dataTransfer.getData(DRAG_TYPE);
            if (!type) return;
            e.preventDefault();
            e.stopPropagation();
            addNode(type, app.canvas.convertEventToCanvasOffset(e));
        }, true);

        new MutationObserver(pinToTop).observe(document.body, { childList: true, subtree: true });
        pinToTop();
    },
});
