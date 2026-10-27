import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible, addButton, resizeToContent } from "./common.js";
import { openDialog } from "./dialog.js";

const STYLE_ID = "mb-folder-style";
const MIN_PREVIEW_HEIGHT = 220; // the preview grows with the node, never below this

const CSS = `
.mb-folder-preview {
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-sizing: border-box;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
.mb-folder-bar { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--descrip-text); }
.mb-folder-count { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mb-folder-bar button {
    padding: 2px 8px;
    border: 1px solid var(--border-color);
    border-radius: 5px;
    background: var(--comfy-input-bg);
    color: var(--input-text);
    font-size: 11px;
    cursor: pointer;
}
.mb-folder-bar button:hover { background: var(--border-color); }
.mb-folder-grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    grid-auto-rows: min-content;
    gap: 6px;
    padding: 6px;
    overflow-y: auto;
    background: var(--comfy-input-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-sizing: border-box;
}
.mb-folder-tile {
    position: relative;
    aspect-ratio: 1 / 1;
    border: 2px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
    background: var(--comfy-menu-secondary-bg);
    cursor: pointer;
    user-select: none;
}
.mb-folder-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mb-folder-tile.mb-on { border-color: var(--mb-accent, #d4537e); }
.mb-folder-tile:not(.mb-on) img { opacity: 0.35; }
.mb-folder-tile .mb-folder-name {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 2px 4px;
    font-size: 10px;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.65);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.mb-folder-empty { color: var(--descrip-text); font-size: 11px; padding: 10px; grid-column: 1 / -1; }
.mb-folder-browse { display: flex; flex-direction: column; gap: 8px; }
.mb-folder-path {
    padding: 6px 8px;
    background: var(--comfy-input-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 11px;
    color: var(--input-text);
    outline: none;
}
.mb-folder-path:focus { border-color: var(--mb-accent, #d4537e); }
.mb-folder-info { font-size: 11px; color: var(--descrip-text); }
.mb-folder-info.mb-error { color: #e5484d; }
.mb-folder-list {
    height: 240px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--comfy-input-bg);
}
.mb-folder-item {
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12px;
    border-bottom: 1px solid var(--border-color);
}
.mb-folder-item:hover { background: var(--comfy-menu-bg); }
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

// Grow to fit a newly shown widget without undoing a height the user dragged.
function growToContent(node) {
    const size = node.computeSize();
    node.setSize([Math.max(node.size[0], size[0]), Math.max(node.size[1], size[1])]);
    node.setDirtyCanvas(true, true);
}

// --- selection state -------------------------------------------------------
// The selection lives in the "selection" widget as one file name per line, so it
// serializes with the workflow and the backend reads the same list the grid shows.

function isSelectAll(node) {
    return getWidget(node, "select_all")?.value !== false;
}

function readSelection(node) {
    const raw = getWidget(node, "selection")?.value ?? "";
    return new Set(raw.split("\n").map((s) => s.trim()).filter(Boolean));
}

// Written back in folder order, matching what the backend loads.
function writeSelection(node, names) {
    const widget = getWidget(node, "selection");
    const files = node.__mbFolderFiles ?? [];
    if (widget) widget.value = files.filter((f) => names.has(f)).join("\n");
}

function setSelectAll(node, value) {
    const widget = getWidget(node, "select_all");
    if (!widget || widget.value === value) return;
    widget.value = value;
    widget.callback?.(value);
}

// Every selection change goes through here: leaving "all" first means the
// clicked state starts from what the grid showed, i.e. everything on.
function editSelection(node, edit) {
    const files = node.__mbFolderFiles ?? [];
    const current = isSelectAll(node) ? new Set(files) : readSelection(node);
    setSelectAll(node, false);
    edit(current, files);
    writeSelection(node, current);
    updateTiles(node);
    node.setDirtyCanvas(true, true);
}

// --- preview grid ----------------------------------------------------------

// Toggles classes on the existing tiles, so a click never re-requests thumbnails.
function updateTiles(node) {
    const tiles = node.__mbFolderTiles ?? new Map();
    const files = node.__mbFolderFiles ?? [];
    const selectAll = isSelectAll(node);
    const selected = readSelection(node);

    for (const [name, tile] of tiles) {
        tile.classList.toggle("mb-on", selectAll || selected.has(name));
    }

    const count = selectAll ? files.length : files.filter((f) => selected.has(f)).length;
    const mode = getWidget(node, "resize_mode")?.value ?? "list";
    const label = node.__mbFolderCount;
    if (label) {
        label.textContent = files.length
            ? `${count} / ${files.length} selected${selectAll ? " (all)" : ""} · ${mode}`
            : "";
    }
}

function renderGrid(node) {
    const element = node.__mbFolderGrid;
    if (!element) return;

    const folder = getWidget(node, "folder")?.value ?? "";
    const files = node.__mbFolderFiles ?? [];
    const tiles = new Map();
    node.__mbFolderTiles = tiles;
    element.replaceChildren();

    if (!files.length) {
        const empty = document.createElement("div");
        empty.className = "mb-folder-empty";
        empty.textContent = folder ? "No images in this folder." : "No folder set — use Browse.";
        element.appendChild(empty);
        updateTiles(node);
        return;
    }

    files.forEach((name, index) => {
        const tile = document.createElement("div");
        tile.className = "mb-folder-tile";
        tile.title = name;

        const img = document.createElement("img");
        img.loading = "lazy";
        img.src = thumbURL(folder, name);
        img.alt = name;

        const label = document.createElement("div");
        label.className = "mb-folder-name";
        label.textContent = name;

        tile.append(img, label);

        tile.addEventListener("click", (event) => {
            const anchor = node.__mbFolderAnchor;
            editSelection(node, (current) => {
                // Shift-click sets the whole run since the last click to the
                // state the clicked tile flips to.
                const on = !current.has(name);
                const from = event.shiftKey && anchor != null ? Math.min(anchor, index) : index;
                const to = event.shiftKey && anchor != null ? Math.max(anchor, index) : index;
                for (let i = from; i <= to; i++) {
                    if (on) current.add(files[i]);
                    else current.delete(files[i]);
                }
            });
            node.__mbFolderAnchor = index;
        });

        tiles.set(name, tile);
        element.appendChild(tile);
    });

    updateTiles(node);
}

// Reload the file list for the current folder, then rebuild the grid.
async function refreshFolder(node) {
    const folder = getWidget(node, "folder")?.value ?? "";
    node.__mbFolderFiles = await listImages(folder);
    node.__mbFolderAnchor = null;

    // Drop names that are no longer in the folder so the batch matches the grid.
    writeSelection(node, readSelection(node));

    renderGrid(node);
    node.setDirtyCanvas(true, true);
}

// --- folder browser dialog -------------------------------------------------

function openBrowser(node) {
    ensureStyle();
    let chosen = getWidget(node, "folder")?.value ?? "";
    let pathInput;
    let show;

    openDialog({
        title: "Choose a folder",
        applyLabel: "Select",
        width: 420,
        render(body) {
            const wrapper = document.createElement("div");
            wrapper.className = "mb-folder-browse";

            pathInput = document.createElement("input");
            pathInput.className = "mb-folder-path";
            pathInput.placeholder = "Type or paste a folder path, then Enter";
            pathInput.spellcheck = false;

            const info = document.createElement("div");
            info.className = "mb-folder-info";

            const list = document.createElement("div");
            list.className = "mb-folder-list";

            wrapper.append(pathInput, info, list);
            body.appendChild(wrapper);

            const row = (label, onClick) => {
                const item = document.createElement("div");
                item.className = "mb-folder-item";
                item.textContent = label;
                item.addEventListener("click", onClick);
                return item;
            };

            const showError = (message) => {
                info.textContent = message;
                info.classList.add("mb-error");
            };

            show = async (path) => {
                let data;
                try {
                    data = await browse(path);
                } catch (e) {
                    showError("Could not reach the server.");
                    return;
                }

                // A bad path leaves the last good folder listed and chosen.
                if (data.error) {
                    showError(`Not a folder: ${data.path ?? path}`);
                    return;
                }

                chosen = data.path ?? "";
                pathInput.value = chosen;
                info.classList.remove("mb-error");
                info.textContent = chosen ? `${data.images ?? 0} image(s) here` : "Pick a drive";
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
            };

            show(chosen);
        },
        onApply() {
            // Enter in the path box lands here too: an edited path is opened
            // first, and only an opened folder can be selected.
            const typed = pathInput.value.trim();
            if (typed && typed !== chosen) {
                show(typed);
                return false;
            }
            if (!chosen) return false;
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

function wrapCallback(node, name, after) {
    const widget = getWidget(node, name);
    if (!widget) return;
    const prev = widget.callback;
    widget.callback = function (...args) {
        const result = prev?.apply(this, args);
        after();
        return result;
    };
}

function showPadColor(node) {
    const pad = getWidget(node, "resize_mode")?.value === "pad";
    if (setWidgetVisible(node, "pad_color", pad)) growToContent(node);
}

function barButton(label, title, onClick) {
    const button = document.createElement("button");
    button.textContent = label;
    button.title = title;
    button.addEventListener("click", onClick);
    return button;
}

function wireNode(node) {
    ensureStyle();

    // The selection is the grid's business; the raw text box would only invite
    // typos, but the widget stays present so the value serializes.
    setWidgetVisible(node, "selection", false);
    setWidgetVisible(node, "pad_color", false);

    addButton(node, "Browse…", () => openBrowser(node));

    wrapCallback(node, "folder", () => refreshFolder(node));
    wrapCallback(node, "select_all", () => updateTiles(node));
    wrapCallback(node, "resize_mode", () => {
        showPadColor(node);
        updateTiles(node);
    });

    const element = document.createElement("div");
    element.className = "mb-folder-preview";

    const bar = document.createElement("div");
    bar.className = "mb-folder-bar";
    const count = document.createElement("span");
    count.className = "mb-folder-count";
    bar.append(
        count,
        barButton("All", "Select every image", () => editSelection(node, (current, files) => {
            for (const f of files) current.add(f);
        })),
        barButton("None", "Clear the selection", () => editSelection(node, (current) => current.clear())),
        barButton("Invert", "Swap selected and unselected", () => editSelection(node, (current, files) => {
            for (const f of files) {
                if (current.has(f)) current.delete(f);
                else current.add(f);
            }
        })),
        barButton("⟳", "Reload the folder", () => refreshFolder(node)),
    );

    const grid = document.createElement("div");
    grid.className = "mb-folder-grid";
    element.append(bar, grid);

    node.__mbFolderGrid = grid;
    node.__mbFolderCount = count;

    // No fixed height: the preview takes whatever room the node has left.
    node.addDOMWidget("mb_folder_preview", "mb_folder_preview", element, {
        serialize: false,
        hideOnZoom: false,
        getMinHeight: () => MIN_PREVIEW_HEIGHT,
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
        // Widget values arrive after nodeCreated, so the saved folder and mode
        // are only known now.
        showPadColor(node);
        refreshFolder(node);
    },
});
