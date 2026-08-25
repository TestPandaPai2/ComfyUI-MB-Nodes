// Load Image Mini (MB): a compact custom face for the loader. The stock file
// combo is kept (hidden) as the serialized source of truth for `image`, while a
// DOM panel draws the toolbar, an arrow/thumbnail file picker, a preview and two
// size cards. The whole resize engine lives in the gear dialog.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible, resizeToContent, notify } from "./common.js";
import { openDialog, radioRow } from "./dialog.js";
import { pasteImage } from "./clipboard_image.js";

// Keep in step with nodes/load_image_mini_node.py.
const MODES = ["none", "max megapixels", "longest side", "scale by", "fit inside", "crop to fill", "match ratio"];
const MEGAPIXELS = ["0.25", "0.5", "1.0", "1.25", "1.5", "2.0", "3.0", "4.0"];
const MATCH_RATIOS = ["1:1", "4:3", "3:2", "16:10", "16:9", "1.85:1", "2:1", "21:9", "3:4", "2:3", "10:16", "9:16", "1:1.85", "1:2", "9:21"];
const SNAP_OPTIONS = ["1", "2", "4", "8", "16", "32", "64"];
const RESAMPLES = ["lanczos", "bicubic", "bilinear", "area", "nearest-exact"];

// Accent swatches for the gear panel. "" clears the override back to the pack theme.
const SWATCHES = [
    ["Theme", ""], ["Green", "#1fae65"], ["Pink", "#e0399c"], ["Purple", "#9d4edd"],
    ["Teal", "#14b8a6"], ["Gold", "#d4a017"], ["Blue", "#3b82f6"], ["Red", "#e5484d"],
    ["Orange", "#f97316"], ["Indigo", "#6366f1"], ["Slate", "#64748b"], ["Orchid", "#bb00ff"],
];

// Gear widgets: hidden from the body, edited only through the panel.
const GEAR_WIDGETS = [
    "resize_mode", "megapixels", "longest_side", "scale_by", "fit_width", "fit_height",
    "fill_width", "fill_height", "match_ratio", "snap", "resample", "allow_upscale", "accent",
];

const STYLE_ID = "mb-mini-style";
const ANNOTATED = /^(.*?)\s*\[(\w+)\]\s*$/;

const CSS = `
.mb-mini {
    display: flex; flex-direction: column; gap: 6px;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #dcdcdc; box-sizing: border-box; width: 100%;
}
.mb-mini-bar { display: flex; gap: 6px; }
.mb-mini-btn {
    flex: 1; padding: 5px 0; text-align: center; font-size: 12px;
    background: #353535; border: 1px solid #1a1a1a; border-radius: 8px;
    color: #dcdcdc; cursor: pointer; user-select: none;
}
.mb-mini-btn:hover { background: #404040; }
.mb-mini-file { display: flex; align-items: center; gap: 4px; }
.mb-mini-arrow {
    flex: none; width: 26px; padding: 5px 0; text-align: center; font-size: 12px;
    background: #262626; border: 1px solid #3a3a3a; border-radius: 8px;
    color: #cfcfcf; cursor: pointer; user-select: none;
}
.mb-mini-arrow:hover { background: #333; }
.mb-mini-name {
    flex: 1; min-width: 0; padding: 5px 8px; font-size: 12px;
    background: #0d0d0d; border: 1px solid #3a3a3a; border-radius: 8px;
    color: #e8e8e8; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mb-mini-name:hover { border-color: #555; }
.mb-mini-preview {
    width: 100%; height: 150px; border-radius: 8px; background: #0d0d0d;
    border: 1px solid #2a2a2a; object-fit: contain; display: block;
}
.mb-mini-empty {
    width: 100%; height: 150px; border-radius: 8px; background: #0d0d0d;
    border: 1px dashed #333; display: flex; align-items: center; justify-content: center;
    color: #6a6a6a; font-size: 11px;
}
.mb-mini-cards { display: flex; gap: 6px; }
.mb-mini-card {
    flex: 1; min-width: 0; padding: 5px 8px; background: #161616;
    border: 1px solid #2a2a2a; border-radius: 8px;
}
.mb-mini-card b { display: block; font-size: 9px; color: #8f8f8f; text-transform: uppercase; letter-spacing: 0.5px; }
.mb-mini-card span { font-size: 12px; color: #e8e8e8; }
.mb-mini-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 6px; max-height: 340px; overflow-y: auto; padding: 2px;
}
.mb-mini-tile {
    position: relative; aspect-ratio: 1 / 1; border: 2px solid #2a2a2a;
    border-radius: 6px; overflow: hidden; background: #161616; cursor: pointer;
}
.mb-mini-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mb-mini-tile.mb-on { border-color: #e01010; }
.mb-mini-tile .mb-mini-cap {
    position: absolute; left: 0; right: 0; bottom: 0; padding: 2px 4px; font-size: 9px;
    color: #e8e8e8; background: rgba(0,0,0,0.65); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mb-mini-swatches { display: flex; flex-wrap: wrap; gap: 6px; }
.mb-mini-swatch {
    width: 24px; height: 24px; border-radius: 6px; cursor: pointer;
    border: 2px solid transparent; box-sizing: border-box;
}
.mb-mini-swatch.mb-on { border-color: #ffffff; }
.mb-mini-swatch.mb-theme {
    background: repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 50% / 10px 10px;
}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

// ---------------------------------------------------------------- file helpers

function viewURL(value) {
    if (!value) return null;
    const match = ANNOTATED.exec(value);
    const [name, type] = match ? [match[1], match[2]] : [value, "input"];
    return api.apiURL(`/view?${new URLSearchParams({ filename: name, subfolder: "", type })}`);
}

const sizeCache = new Map();

function measure(value) {
    if (!value) return Promise.resolve(null);
    if (sizeCache.has(value)) return Promise.resolve(sizeCache.get(value));
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const size = [img.naturalWidth, img.naturalHeight];
            sizeCache.set(value, size);
            resolve(size);
        };
        img.onerror = () => resolve(null);
        img.src = viewURL(value);
    });
}

function fileList(node) {
    return getWidget(node, "image")?.options?.values ?? [];
}

// The uploaded/pasted file is new to the picker, so it is offered before select.
function selectFile(node, filename) {
    const widget = getWidget(node, "image");
    if (!widget) return;
    const values = widget.options?.values ?? (widget.options = { ...widget.options, values: [] }).values;
    if (!values.includes(filename)) values.push(filename);
    widget.value = filename;
    widget.callback?.(filename);
    refresh(node);
}

async function uploadFile(node, file) {
    try {
        const body = new FormData();
        body.append("image", file);
        body.append("type", "input");
        body.append("overwrite", "false");
        const response = await api.fetchApi("/upload/image", { method: "POST", body });
        if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        selectFile(node, data.subfolder ? `${data.subfolder}/${data.name}` : data.name);
        notify("success", "Image uploaded", data.name);
    } catch (e) {
        notify("error", "Upload failed", e?.message ?? String(e));
    }
}

function openUpload(node) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    input.addEventListener("change", () => {
        if (input.files?.[0]) uploadFile(node, input.files[0]);
        input.remove();
    });
    document.body.appendChild(input);
    input.click();
}

function stepFile(node, dir) {
    const list = fileList(node);
    if (!list.length) return;
    const current = getWidget(node, "image")?.value;
    const index = Math.max(0, list.indexOf(current));
    const next = (index + dir + list.length) % list.length;
    selectFile(node, list[next]);
}

// ---------------------------------------------------------------- resize mirror

function snap(value, multiple) {
    const m = Math.max(1, Number(multiple) || 1);
    return Math.max(m, Math.round(value / m) * m);
}

function ratioValue(name) {
    const [w, h] = String(name).split(":").map(Number);
    return h ? w / h : 1;
}

// Output dimensions for the given input size and the node's gear settings.
// Mirrors _resize() in the Python backend (dimensions only).
function computeOut(node, w, h) {
    const g = (name) => getWidget(node, name)?.value;
    const mode = g("resize_mode") ?? "none";
    const up = g("allow_upscale") === true;
    const s = Number(g("snap")) || 8;
    if (!w || !h || mode === "none") return [w, h];

    if (mode === "max megapixels") {
        const f = Math.sqrt((parseFloat(g("megapixels")) * 1e6) / (w * h));
        if (f > 1 && !up) return [w, h];
        return [snap(w * f, s), snap(h * f, s)];
    }
    if (mode === "longest side") {
        const f = (Number(g("longest_side")) || 1024) / Math.max(w, h);
        if (f > 1 && !up) return [w, h];
        return [snap(w * f, s), snap(h * f, s)];
    }
    if (mode === "scale by") {
        const f = Number(g("scale_by")) || 1;
        return [snap(w * f, s), snap(h * f, s)];
    }
    if (mode === "fit inside") {
        const f = Math.min((Number(g("fit_width")) || 1024) / w, (Number(g("fit_height")) || 1024) / h);
        if (f > 1 && !up) return [w, h];
        return [snap(w * f, s), snap(h * f, s)];
    }
    if (mode === "crop to fill") {
        return [Number(g("fill_width")) || 1024, Number(g("fill_height")) || 1024];
    }
    if (mode === "match ratio") {
        const t = ratioValue(g("match_ratio"));
        return w / h > t ? [Math.round(h * t), h] : [w, Math.round(w / t)];
    }
    return [w, h];
}

function aspect(w, h) {
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const d = gcd(w, h) || 1;
    const [rw, rh] = [w / d, h / d];
    if (rw <= 64 && rh <= 64) return `${rw}:${rh}`;
    const r = w / h;
    return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}

// ---------------------------------------------------------------- panel refresh

async function refresh(node) {
    const panel = node.__mbMini;
    if (!panel) return;
    const value = getWidget(node, "image")?.value;
    panel.name.textContent = value || "no image";

    const size = await measure(value);
    if (!size) {
        panel.preview.style.display = "none";
        panel.empty.style.display = "flex";
        panel.inCard.textContent = "—";
        panel.outCard.textContent = "—";
        node.imgs = undefined;
        node.setDirtyCanvas(true, false);
        return;
    }

    const [w, h] = size;
    const [ow, oh] = computeOut(node, w, h);
    panel.preview.src = viewURL(value);
    panel.preview.style.display = "block";
    panel.empty.style.display = "none";
    panel.inCard.textContent = `${w} x ${h}`;
    panel.outCard.textContent = `${ow} x ${oh}  ·  ${aspect(ow, oh)}  ·  ${((ow * oh) / 1e6).toFixed(2)} MP`;

    // Give MaskEditor / Clipspace something to read.
    const img = new Image();
    img.onload = () => { node.imgs = [img]; };
    img.src = panel.preview.src;

    node.setDirtyCanvas(true, false);
}

// ---------------------------------------------------------------- accent

function applyAccent(node) {
    const accent = getWidget(node, "accent")?.value;
    if (accent) {
        node.color = accent;
        node.setDirtyCanvas(true, true);
    }
}

// ---------------------------------------------------------------- thumbnail picker

function openPicker(node) {
    ensureStyle();
    const list = fileList(node);
    let chosen = getWidget(node, "image")?.value;

    openDialog({
        title: "Pick an image",
        applyLabel: "Select",
        width: 520,
        render(body) {
            const grid = document.createElement("div");
            grid.className = "mb-mini-grid";
            if (!list.length) {
                const empty = document.createElement("div");
                empty.textContent = "No images in the input folder yet.";
                empty.style.cssText = "color:#8f8f8f;font-size:12px;padding:10px;";
                body.appendChild(empty);
                return;
            }
            for (const name of list) {
                const tile = document.createElement("div");
                tile.className = "mb-mini-tile" + (name === chosen ? " mb-on" : "");
                tile.title = name;
                const img = document.createElement("img");
                img.loading = "lazy";
                img.src = viewURL(name);
                const cap = document.createElement("div");
                cap.className = "mb-mini-cap";
                cap.textContent = name;
                tile.append(img, cap);
                tile.addEventListener("click", () => {
                    chosen = name;
                    for (const t of grid.children) t.classList.toggle("mb-on", t.title === name);
                });
                tile.addEventListener("dblclick", () => { chosen = name; body.__apply?.(); });
                grid.appendChild(tile);
            }
            body.appendChild(grid);
        },
        onApply() {
            if (chosen) selectFile(node, chosen);
        },
    });
}

// ---------------------------------------------------------------- gear panel

function selectEl(options, value, onChange) {
    const el = document.createElement("select");
    el.className = "mb-dialog-select";
    for (const opt of options) {
        const o = document.createElement("option");
        o.value = o.textContent = opt;
        el.appendChild(o);
    }
    el.value = value;
    if (onChange) el.addEventListener("change", () => onChange(el.value));
    return el;
}

function numberEl(value, step) {
    const el = document.createElement("input");
    el.type = "number";
    el.className = "mb-dialog-number";
    if (step) el.step = String(step);
    el.value = String(value);
    return el;
}

function twoNumbers(w, h) {
    const wrap = document.createElement("span");
    wrap.style.cssText = "margin-left:auto;display:flex;gap:4px;align-items:center;";
    const wi = numberEl(w);
    const hi = numberEl(h);
    wi.style.width = hi.style.width = "58px";
    const x = document.createElement("span");
    x.textContent = "x";
    x.style.color = "#8f8f8f";
    wrap.append(wi, x, hi);
    return { wrap, wi, hi };
}

function openSettings(node) {
    ensureStyle();
    const g = (name) => getWidget(node, name)?.value;

    let mode = g("resize_mode") ?? "none";
    const controls = {};       // per-mode trailing controls, read on Apply
    let accent = g("accent") ?? "";

    openDialog({
        title: "Load Image Mini — settings",
        applyLabel: "Apply",
        width: 380,
        render(body) {
            // --- resize modes ---------------------------------------------
            const megaSel = selectEl(MEGAPIXELS, g("megapixels") ?? "1.0");
            const longNum = numberEl(g("longest_side") ?? 1024);
            const scaleNum = numberEl(g("scale_by") ?? 1.0, 0.05);
            const fit = twoNumbers(g("fit_width") ?? 1024, g("fit_height") ?? 1024);
            const fill = twoNumbers(g("fill_width") ?? 1024, g("fill_height") ?? 1024);
            const ratioSel = selectEl(MATCH_RATIOS, g("match_ratio") ?? "1:1");
            controls.mega = megaSel;
            controls.long = longNum;
            controls.scale = scaleNum;
            controls.fit = fit;
            controls.fill = fill;
            controls.ratio = ratioSel;

            const rows = {
                "none": null,
                "max megapixels": megaSel,
                "longest side": longNum,
                "scale by": scaleNum,
                "fit inside": fit.wrap,
                "crop to fill": fill.wrap,
                "match ratio": ratioSel,
            };
            const hints = {
                "max megapixels": "Scale to a target pixel count, aspect kept.",
                "longest side": "Set the longest dimension in pixels.",
                "scale by": "Multiply both sides by this factor.",
                "fit inside": "Scale to fit inside the box; no crop.",
                "crop to fill": "Cover the box, then centre-crop to it.",
                "match ratio": "Centre-crop to this aspect ratio.",
            };

            for (const name of MODES) {
                const { wrapper, radio } = radioRow({
                    group: "mb-mini-mode",
                    value: name,
                    label: name,
                    checked: name === mode,
                    hint: hints[name],
                    control: rows[name] ?? undefined,
                });
                radio.addEventListener("change", () => { if (radio.checked) mode = name; });
                body.appendChild(wrapper);
            }

            // --- shared options -------------------------------------------
            const opts = document.createElement("div");
            opts.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-top:4px;padding-top:10px;border-top:1px solid #2a2a2a;";

            const snapSel = selectEl(SNAP_OPTIONS, String(g("snap") ?? "8"));
            const resSel = selectEl(RESAMPLES, g("resample") ?? "lanczos");
            controls.snap = snapSel;
            controls.res = resSel;

            const field = (label, control) => {
                const row = document.createElement("div");
                row.className = "mb-dialog-field";
                row.style.justifyContent = "space-between";
                const span = document.createElement("span");
                span.textContent = label;
                row.append(span, control);
                return row;
            };
            opts.append(field("snap to multiple", snapSel), field("resample", resSel));

            const upWrap = document.createElement("label");
            upWrap.className = "mb-dialog-field";
            upWrap.style.cursor = "pointer";
            const up = document.createElement("input");
            up.type = "checkbox";
            up.checked = g("allow_upscale") === true;
            up.style.accentColor = "#e01010";
            controls.up = up;
            const upText = document.createElement("span");
            upText.textContent = "allow upscaling (enlarge past the source)";
            upWrap.append(up, upText);
            opts.appendChild(upWrap);
            body.appendChild(opts);

            // --- accent ---------------------------------------------------
            const acc = document.createElement("div");
            acc.style.cssText = "margin-top:4px;padding-top:10px;border-top:1px solid #2a2a2a;";
            const accLabel = document.createElement("div");
            accLabel.className = "mb-dialog-field";
            accLabel.textContent = "accent colour";
            acc.appendChild(accLabel);
            const swatches = document.createElement("div");
            swatches.className = "mb-mini-swatches";
            swatches.style.marginTop = "6px";
            for (const [title, hex] of SWATCHES) {
                const sw = document.createElement("div");
                sw.className = "mb-mini-swatch" + (hex === accent ? " mb-on" : "") + (hex ? "" : " mb-theme");
                sw.title = title;
                if (hex) sw.style.background = hex;
                sw.addEventListener("click", () => {
                    accent = hex;
                    for (const s of swatches.children) s.classList.remove("mb-on");
                    sw.classList.add("mb-on");
                });
                swatches.appendChild(sw);
            }
            acc.appendChild(swatches);
            body.appendChild(acc);
        },
        onApply() {
            const set = (name, value) => { const w = getWidget(node, name); if (w) w.value = value; };
            set("resize_mode", mode);
            set("megapixels", controls.mega.value);
            set("longest_side", Number(controls.long.value) || 0);
            set("scale_by", Number(controls.scale.value) || 1);
            set("fit_width", Number(controls.fit.wi.value) || 0);
            set("fit_height", Number(controls.fit.hi.value) || 0);
            set("fill_width", Number(controls.fill.wi.value) || 0);
            set("fill_height", Number(controls.fill.hi.value) || 0);
            set("match_ratio", controls.ratio.value);
            set("snap", controls.snap.value);
            set("resample", controls.res.value);
            set("allow_upscale", controls.up.checked);
            set("accent", accent);
            applyAccent(node);
            refresh(node);
        },
    });
}

// ---------------------------------------------------------------- MaskEditor / Clipspace

function clipspaceApp() {
    return app?.constructor; // ComfyApp class carries the static clipspace helpers
}

function copyClipspace(node) {
    try { clipspaceApp()?.copyToClipspace?.(node); notify("success", "Copied", "Image sent to Clipspace."); }
    catch (e) { notify("error", "Copy failed", e?.message ?? String(e)); }
}

function pasteClipspace(node) {
    try { clipspaceApp()?.pasteFromClipspace?.(node); refresh(node); }
    catch (e) { notify("error", "Paste failed", e?.message ?? String(e)); }
}

function openMaskEditor(node) {
    if (!node.imgs?.length) {
        notify("warn", "No image", "Pick an image before opening the mask editor.");
        return;
    }
    const App = clipspaceApp();
    try {
        App?.copyToClipspace?.(node);
        if (App) App.clipspace_return_node = node;
        if (App?.open_maskeditor) { App.open_maskeditor(); return; }
        // Newer frontends expose it as a command instead of a static.
        const ran = app.extensionManager?.command?.execute?.("Comfy.MaskEditor.OpenMaskEditor");
        if (ran === undefined && !App?.open_maskeditor) {
            notify("warn", "MaskEditor", "This ComfyUI build did not expose the mask editor here.");
        }
    } catch (e) {
        notify("error", "MaskEditor failed", e?.message ?? String(e));
    }
}

// ---------------------------------------------------------------- panel build

function buildPanel(node) {
    ensureStyle();

    const root = document.createElement("div");
    root.className = "mb-mini";

    // toolbar
    const bar = document.createElement("div");
    bar.className = "mb-mini-bar";
    const btn = (label, onClick) => {
        const b = document.createElement("div");
        b.className = "mb-mini-btn";
        b.textContent = label;
        b.addEventListener("click", onClick);
        return b;
    };
    bar.append(
        btn("⬆ Upload", () => openUpload(node)),
        btn("📋 Paste", () => pasteImage(node).then?.(() => refresh(node)) ?? refresh(node)),
        btn("⚙ Settings", () => openSettings(node)),
    );
    root.appendChild(bar);

    // file row: ◀ name ▶
    const fileRow = document.createElement("div");
    fileRow.className = "mb-mini-file";
    const prev = document.createElement("div");
    prev.className = "mb-mini-arrow";
    prev.textContent = "◀";
    prev.addEventListener("click", () => stepFile(node, -1));
    const name = document.createElement("div");
    name.className = "mb-mini-name";
    name.textContent = "no image";
    name.title = "Click to pick from thumbnails";
    name.addEventListener("click", () => openPicker(node));
    const next = document.createElement("div");
    next.className = "mb-mini-arrow";
    next.textContent = "▶";
    next.addEventListener("click", () => stepFile(node, 1));
    fileRow.append(prev, name, next);
    root.appendChild(fileRow);

    // preview
    const preview = document.createElement("img");
    preview.className = "mb-mini-preview";
    preview.style.display = "none";
    const empty = document.createElement("div");
    empty.className = "mb-mini-empty";
    empty.textContent = "drop an image here, or upload / paste / pick";
    root.append(preview, empty);

    // size cards
    const cards = document.createElement("div");
    cards.className = "mb-mini-cards";
    const makeCard = (title) => {
        const c = document.createElement("div");
        c.className = "mb-mini-card";
        const b = document.createElement("b");
        b.textContent = title;
        const s = document.createElement("span");
        s.textContent = "—";
        c.append(b, s);
        return { card: c, value: s };
    };
    const inCard = makeCard("input");
    const outCard = makeCard("output");
    cards.append(inCard.card, outCard.card);
    root.appendChild(cards);

    // drag & drop onto the panel
    root.addEventListener("dragover", (e) => { e.preventDefault(); root.style.opacity = "0.7"; });
    root.addEventListener("dragleave", () => { root.style.opacity = "1"; });
    root.addEventListener("drop", (e) => {
        e.preventDefault();
        root.style.opacity = "1";
        const file = e.dataTransfer?.files?.[0];
        if (file && file.type.startsWith("image/")) uploadFile(node, file);
    });

    node.__mbMini = { root, name, preview, empty, inCard: inCard.value, outCard: outCard.value };
    return root;
}

// ---------------------------------------------------------------- wiring

function wireNode(node) {
    for (const name of GEAR_WIDGETS) setWidgetVisible(node, name, false);

    const element = buildPanel(node);
    node.addDOMWidget("mb_mini_panel", "mb_mini_panel", element, {
        serialize: false,
        hideOnZoom: false,
        getHeight: () => 320,
    });

    // Keep the (hidden) stock combo as the source of truth; mirror its changes.
    const image = getWidget(node, "image");
    if (image) {
        setWidgetVisible(node, "image", false);
        const prev = image.callback;
        image.callback = function (...args) {
            const r = prev?.apply(this, args);
            refresh(node);
            return r;
        };
    }

    // Right-click extras, the way stock Load Image offers them.
    const prevMenu = node.getExtraMenuOptions;
    node.getExtraMenuOptions = function (canvas, options) {
        options.unshift(
            { content: "Open in MaskEditor", callback: () => openMaskEditor(node) },
            { content: "Copy (Clipspace)", callback: () => copyClipspace(node) },
            { content: "Paste (Clipspace)", callback: () => pasteClipspace(node) },
            null,
        );
        return prevMenu?.apply(this, arguments);
    };

    resizeToContent(node);
    applyAccent(node);
    refresh(node);
}

// PageUp / PageDown step the file on the selected Mini node.
let keysBound = false;
function bindKeys() {
    if (keysBound) return;
    keysBound = true;
    window.addEventListener("keydown", (e) => {
        if (e.key !== "PageUp" && e.key !== "PageDown") return;
        const target = e.target;
        if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
        const node = Object.values(app.canvas?.selected_nodes ?? {})
            .find((n) => n.comfyClass === "MBLoadImageMini");
        if (!node) return;
        e.preventDefault();
        stepFile(node, e.key === "PageUp" ? -1 : 1);
    });
}

app.registerExtension({
    name: "MBNodes.LoadImageMini",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBLoadImageMini") return;
        wireNode(node);
        bindKeys();
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBLoadImageMini") return;
        applyAccent(node);
        setTimeout(() => refresh(node), 120);
    },
});
