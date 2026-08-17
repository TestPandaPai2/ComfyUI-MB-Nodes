import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible, addButton, resizeToContent } from "./common.js";
import { openDialog } from "./dialog.js";

const STYLE_ID = "mb-folder-style";
const GRID_HEIGHT = 220; // the preview area keeps a fixed height and scrolls

const CSS = `
.mb-folder-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 6px;
    padding: 6px;
    overflow-y: auto;
    background: #0d0d0d;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    box-sizing: border-box;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
.mb-folder-tile {
    position: relative;
    aspect-ratio: 1 / 1;
    border: 2px solid #2a2a2a;
    border-radius: 6px;
    overflow: hidden;
    background: #161616;
    cursor: pointer;
}
.mb-folder-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mb-folder-tile.mb-on { border-color: #e01010; }
.mb-folder-tile:not(.mb-on) img { opacity: 0.35; }
.mb-folder-tile .mb-folder-name {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 2px 4px;
    font-size: 9px;
    color: #e8e8e8;
    background: rgba(0, 0, 0, 0.65);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.mb-folder-grid.mb-locked .mb-folder-tile { cursor: default; }
.mb-folder-empty { color: #8f8f8f; font-size: 11px; padding: 10px; grid-column: 1 / -1; }
.mb-folder-browse { display: flex; flex-direction: column; gap: 8px; }
.mb-folder-path {
    padding: 6px 8px;
    background: #0d0d0d;
    border: 1px solid #3a3a3a;
    border-radius: 6px;
    font-size: 11px;
    color: #c8c8c8;
    word-break: break-all;
}
.mb-folder-list {
    height: 240px;
    overflow-y: auto;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    background: #0d0d0d;
}
.mb-folder-item {
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12px;
    border-bottom: 1px solid #1c1c1c;
}
.mb-folder-item:hover { background: #1f1f1f; }
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function thumbURL(folder, name) {
    return api.apiURL(
        `/mbnodes/folder/thumb?path=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`
    );
}

async function listImages(folder) {
    if (!folder) return [];
    try {
        const response = await api.fetchApi(`/mbnodes/folder/list?path=${encodeURIComponent(folder)}`);
        return (await response.json()).files ?? [];
    } catch (e) {
        console.error("[MBNodes] folder list failed", e);
        return [];
    }
}

async function browse(path) {
    const response = await api.fetchApi(`/mbnodes/folder/browse?path=${encodeURIComponent(path ?? "")}`);
    return response.json();
}

// --- selection state -------------------------------------------------------
// The selection lives in the "selection" widget as one file name per line, so it
// serializes with the workflow and the backend reads the same list the grid shows.

function readSelection(node) {
    const raw = getWidget(node, "selection")?.value ?? "";
    return new Set(raw.split("\n").map((s) => s.trim()).filter(Boolean));
}

function writeSelection(node, names) {
    const widget = getWidget(node, "selection");
    if (widget) widget.value = [...names].join("\n");
}

// --- preview grid ----------------------------------------------------------

function renderGrid(node) {
    const element = node.__mbFolderGrid;
    if (!element) return;

    const selectAll = getWidget(node, "select_all")?.value !== false;
    const folder = getWidget(node, "folder")?.value ?? "";
    const files = node.__mbFolderFiles ?? [];
    const selected = readSelection(node);

    element.classList.toggle("mb-locked", selectAll);
    element.replaceChildren();

    if (!files.length) {
        const empty = document.createElement("div");
        empty.className = "mb-folder-empty";
        empty.textContent = folder ? "No images in this folder." : "No folder set — use Browse.";
        element.appendChild(empty);
        return;
    }

    for (const name of files) {
        const tile = document.createElement("div");
        tile.className = "mb-folder-tile" + (selectAll || selected.has(name) ? " mb-on" : "");
        tile.title = name;

        const img = document.createElement("img");
        img.loading = "lazy";
        img.src = thumbURL(folder, name);
        img.alt = name;

        const label = document.createElement("div");
        label.className = "mb-folder-name";
        label.textContent = name;

        tile.append(img, label);

        tile.addEventListener("click", () => {
            // In "all" mode every image is loaded, so clicks would be a lie.
            if (getWidget(node, "select_all")?.value !== false) return;
            const current = readSelection(node);
            if (current.has(name)) current.delete(name);
            else current.add(name);
            // Written back in folder order, matching what the backend loads.
            writeSelection(node, files.filter((f) => current.has(f)));
            renderGrid(node);
        });

        element.appendChild(tile);
    }
}

// Reload the file list for the current folder, then repaint the grid.
async function refreshFolder(node) {
    const folder = getWidget(node, "folder")?.value ?? "";
    node.__mbFolderFiles = await listImages(folder);

    // Drop names that are no longer in the folder so the batch matches the grid.
    const present = new Set(node.__mbFolderFiles);
    const selected = [...readSelection(node)].filter((name) => present.has(name));
    writeSelection(node, selected);

    renderGrid(node);
    node.setDirtyCanvas(true, true);
}

// --- folder browser dialog -------------------------------------------------

function openBrowser(node) {
    ensureStyle();
    let current = getWidget(node, "folder")?.value ?? "";
    let chosen = current;

    openDialog({
        title: "Choose a folder",
        applyLabel: "Select",
        render(body) {
            const wrapper = document.createElement("div");
            wrapper.className = "mb-folder-browse";

            const pathLine = document.createElement("div");
            pathLine.className = "mb-folder-path";

            const list = document.createElement("div");
            list.className = "mb-folder-list";

            wrapper.append(pathLine, list);
            body.appendChild(wrapper);

            const row = (label, onClick) => {
                const item = document.createElement("div");
                item.className = "mb-folder-item";
                item.textContent = label;
                item.addEventListener("click", onClick);
                return item;
            };

            async function show(path) {
                let data;
                try {
                    data = await browse(path);
                } catch (e) {
                    console.error("[MBNodes] browse failed", e);
                    return;
                }

                chosen = data.path ?? "";
                pathLine.textContent = chosen
                    ? `${chosen}  —  ${data.images ?? 0} image(s)`
                    : "Pick a drive";
                list.replaceChildren();

                // Drives are always reachable, so a wrong turn is never a dead end.
                for (const drive of data.drives ?? []) {
                    list.appendChild(row(`💽 ${drive}`, () => show(drive)));
                }
                if (data.parent) {
                    list.appendChild(row("⬆ ..", () => show(data.parent)));
                }
                for (const dir of data.dirs ?? []) {
                    const child = chosen.replace(/[\\/]+$/, "") + "/" + dir;
                    list.appendChild(row(`📁 ${dir}`, () => show(child)));
                }
            }

            show(current);
        },
        onApply() {
            if (!chosen) return false; // nothing picked yet, keep the dialog open
            const widget = getWidget(node, "folder");
            if (widget) {
                widget.value = chosen;
                widget.callback?.(chosen);
            }
            refreshFolder(node);
            return true;
        },
    });
}

// --- wiring ----------------------------------------------------------------

function wireNode(node) {
    ensureStyle();

    // The selection is the grid's business; the raw text box would only invite
    // typos, but the widget stays present so the value serializes.
    setWidgetVisible(node, "selection", false);

    addButton(node, "Browse…", () => openBrowser(node));

    const folderWidget = getWidget(node, "folder");
    if (folderWidget) {
        const prev = folderWidget.callback;
        folderWidget.callback = function (...args) {
            const result = prev?.apply(this, args);
            refreshFolder(node);
            return result;
        };
    }

    const allWidget = getWidget(node, "select_all");
    if (allWidget) {
        const prev = allWidget.callback;
        allWidget.callback = function (...args) {
            const result = prev?.apply(this, args);
            renderGrid(node);
            return result;
        };
    }

    const element = document.createElement("div");
    element.className = "mb-folder-grid";
    element.style.height = `${GRID_HEIGHT}px`;
    node.__mbFolderGrid = element;

    node.addDOMWidget("mb_folder_preview", "mb_folder_preview", element, {
        serialize: false,
        hideOnZoom: false,
        getHeight: () => GRID_HEIGHT,
    });

    resizeToContent(node);
    refreshFolder(node);
}

app.registerExtension({
    name: "MBNodes.LoadImagesFromFolder",

    nodeCreated(node) {
        if (node.comfyClass !== "MBLoadImagesFromFolder") return;
        wireNode(node);
    },

    loadedGraphNode(node) {
        if (node.comfyClass !== "MBLoadImagesFromFolder") return;
        // Widget values arrive after nodeCreated, so the saved folder is only
        // known now.
        refreshFolder(node);
    },
});
