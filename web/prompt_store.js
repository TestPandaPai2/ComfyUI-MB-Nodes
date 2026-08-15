// Save and load for the prompt text boxes — Prompt Pad (MB) and System Prompt
// (MB). Both talk to the routes in nodes/prompt_store.py; the only difference
// is which folder they default to.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget } from "./common.js";
import { openDialog } from "./dialog.js";

// Keys the backend knows; anything else is an absolute path the user added.
export const FOLDERS = [
    { key: "system", label: "System Prompts" },
    { key: "prompts", label: "Saved Prompts" },
];

// Folders the user pointed the loader at, kept for next time. Browser storage
// rather than the workflow: it is a habit of this machine, not of the graph.
const STORE_KEY = "mbnodes.prompt_folders";

function customFolders() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
        return Array.isArray(saved) ? saved.filter((f) => typeof f === "string") : [];
    } catch {
        return [];
    }
}

function rememberFolder(path, keep = true) {
    const folders = customFolders().filter((f) => f !== path);
    if (keep) folders.unshift(path);
    localStorage.setItem(STORE_KEY, JSON.stringify(folders.slice(0, 12)));
}

export function notify(severity, summary, detail) {
    const toast = app.extensionManager?.toast;
    if (toast) toast.add({ severity, summary, detail, life: 4000 });
    else console.log(`[MBNodes] ${summary}: ${detail ?? ""}`);
}

// Multiline widgets keep a DOM element of their own under Nodes 2.0, which does
// not follow widget.value on its own.
function setText(node, text) {
    const widget = getWidget(node, "text");
    if (!widget) return;
    widget.value = text;
    const element = widget.inputEl ?? widget.element;
    if (element && "value" in element) element.value = text;
    widget.callback?.(text);
    node.setDirtyCanvas(true, true);
}

// ------------------------------------------------------------------- saving

async function post(folder, filename, text, overwrite) {
    const response = await api.fetchApi("/mbnodes/save_prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, filename, text, overwrite }),
    });
    return { status: response.status, data: await response.json() };
}

export async function savePrompt(node, folder) {
    const text = getWidget(node, "text")?.value ?? "";
    const filename = getWidget(node, "filename")?.value ?? "";

    if (!filename.trim()) {
        notify("warn", "No filename", "Name the prompt before saving it.");
        return;
    }
    if (!text.trim()) {
        notify("warn", "Nothing to save", "The prompt is empty.");
        return;
    }

    try {
        let result = await post(folder, filename, text, false);

        // Overwriting is the user's call, so the backend refuses it by default.
        if (result.status === 409) {
            if (!confirm(`${result.data.filename} already exists.\n\nOverwrite it?`)) return;
            result = await post(folder, filename, text, true);
        }

        if (result.status >= 400) {
            notify("error", "Save failed", result.data?.error ?? `HTTP ${result.status}`);
            return;
        }
        notify("success", "Prompt saved", `${result.data.folder}/${result.data.filename}`);
    } catch (e) {
        notify("error", "Save failed", e?.message ?? String(e));
    }
}

// ------------------------------------------------------------------ loading

async function fetchFiles(folder) {
    const response = await api.fetchApi(`/mbnodes/prompt_files?folder=${encodeURIComponent(folder)}`);
    const data = await response.json();
    if (response.status >= 400) throw new Error(data?.error ?? `HTTP ${response.status}`);
    return data;
}

async function fetchText(folder, filename) {
    const query = `folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(filename)}`;
    const response = await api.fetchApi(`/mbnodes/prompt_text?${query}`);
    const data = await response.json();
    if (response.status >= 400) throw new Error(data?.error ?? `HTTP ${response.status}`);
    return data.text ?? "";
}

/** The Load dialog: pick a folder, pick a file, Load drops it in the text box.
 * `defaultFolder` is the named slot the node saves to. */
export function openLoadDialog(node, defaultFolder) {
    let folder = defaultFolder;
    let files = [];
    let picked = null;

    let list;        // <select size=...> of filenames
    let status;      // path / error line under the list
    let forget;      // only offered for a folder the user added
    let closeDialog; // openDialog's own closer, for the double click below

    function options() {
        return [
            ...FOLDERS.map((f) => [f.key, f.label]),
            ...customFolders().map((path) => [path, path]),
        ];
    }

    function fillFolders(select) {
        select.replaceChildren();
        for (const [value, label] of options()) {
            const item = document.createElement("option");
            item.value = value;
            item.textContent = label;
            select.appendChild(item);
        }
        const browse = document.createElement("option");
        browse.value = "__add__";
        browse.textContent = "Add folder...";
        select.appendChild(browse);
        select.value = folder;
    }

    async function refresh() {
        list.replaceChildren();
        picked = null;
        status.textContent = "loading...";

        try {
            const data = await fetchFiles(folder);
            files = data.files ?? [];
            status.textContent = files.length
                ? data.path
                : `No .txt or .md files in ${data.path}`;

            for (const name of files) {
                const item = document.createElement("option");
                item.value = name;
                item.textContent = name;
                list.appendChild(item);
            }
            if (files.length) {
                list.value = files[0];
                picked = files[0];
            }
        } catch (e) {
            files = [];
            status.textContent = e?.message ?? String(e);
        }

        forget.style.display = FOLDERS.some((f) => f.key === folder) ? "none" : "";
    }

    async function load() {
        if (!picked) {
            notify("warn", "Nothing picked", "Choose a file to load.");
            return false;
        }
        try {
            setText(node, await fetchText(folder, picked));
            notify("success", "Prompt loaded", picked);
            return true;
        } catch (e) {
            notify("error", "Load failed", e?.message ?? String(e));
            return false;
        }
    }

    closeDialog = openDialog({
        title: "Load prompt",
        width: 460,
        applyLabel: "Load",
        render(body) {
            const folderRow = document.createElement("div");
            folderRow.className = "mb-dialog-field";

            const folderSelect = document.createElement("select");
            folderSelect.className = "mb-dialog-select";
            folderSelect.style.flex = "1";
            fillFolders(folderSelect);

            folderSelect.addEventListener("change", () => {
                if (folderSelect.value !== "__add__") {
                    folder = folderSelect.value;
                    refresh();
                    return;
                }
                // Typed rather than picked: a browser cannot hand a page a real
                // folder path, so the loader takes one and remembers it.
                const path = prompt("Full path of the folder to load prompts from:");
                fillFolders(folderSelect);
                if (path?.trim()) {
                    folder = path.trim();
                    rememberFolder(folder);
                    fillFolders(folderSelect);
                }
                folderSelect.value = folder;
                refresh();
            });

            forget = document.createElement("button");
            forget.className = "mb-dialog-button";
            forget.textContent = "Forget";
            forget.title = "Drop this folder from the list";
            forget.style.display = "none";
            forget.addEventListener("click", () => {
                rememberFolder(folder, false);
                folder = defaultFolder;
                fillFolders(folderSelect);
                refresh();
            });

            const label = document.createElement("span");
            label.textContent = "folder";
            folderRow.append(label, folderSelect, forget);
            body.appendChild(folderRow);

            list = document.createElement("select");
            list.className = "mb-dialog-select";
            list.size = 10;
            list.style.width = "100%";
            list.addEventListener("change", () => { picked = list.value; });
            // A double click is the usual "open this one".
            list.addEventListener("dblclick", async () => {
                picked = list.value;
                if (await load()) closeDialog?.();
            });
            body.appendChild(list);

            status = document.createElement("div");
            status.className = "mb-dialog-hint";
            status.style.margin = "0";
            status.style.wordBreak = "break-all";
            body.appendChild(status);

            refresh();
        },
        onApply() {
            // Async work cannot hold the dialog open, so the load runs on its
            // own and reports through a toast.
            load();
        },
    });
}
