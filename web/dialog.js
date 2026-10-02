// Small themed modal used by the MB Settings menus. Styles are injected once and
// scoped to .mb-dialog-* so they cannot leak into the rest of the UI.

const STYLE_ID = "mb-dialog-style";

const CSS = `
.mb-dialog-overlay {
    --mb-a: var(--mb-accent, #d4537e);
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
.mb-dialog {
    width: 340px;
    max-width: calc(100vw - 32px);
    background: #212124;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
    color: #ececee;
    font-size: 12.5px;
}
.mb-dialog-header { display: flex; align-items: center; gap: 8px; padding: 14px 16px 4px; }
.mb-dialog-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--mb-a); flex: none; }
.mb-dialog-title { font-weight: 500; font-size: 13.5px; flex: 1; min-width: 0; }
.mb-dialog-close {
    border: none;
    background: none;
    color: #77777e;
    font-size: 18px;
    line-height: 1;
    padding: 0 2px;
    cursor: pointer;
}
.mb-dialog-close:hover { color: #ececee; }
.mb-dialog-body { padding: 10px 16px 14px; display: flex; flex-direction: column; gap: 10px; }
.mb-dialog-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border-radius: 8px;
    background: #2a2a2e;
    cursor: pointer;
}
.mb-dialog-row:hover { background: #303034; }
.mb-dialog-row.mb-selected { background: color-mix(in srgb, var(--mb-a) 22%, #212124); }
.mb-dialog-row input[type="radio"] { accent-color: var(--mb-a); margin: 0; }
.mb-dialog-hint { color: #77777e; font-size: 11px; margin: 3px 0 0 30px; }
.mb-dialog-number,
.mb-dialog-select,
.mb-dialog-item input {
    padding: 4px 10px;
    background: #2a2a2e;
    color: #ececee;
    border: 1px solid transparent;
    border-radius: 7px;
    font-size: 12.5px;
    outline: none;
}
.mb-dialog-number:focus,
.mb-dialog-select:focus,
.mb-dialog-item input:focus { border-color: var(--mb-a); }
.mb-dialog-number { width: 72px; margin-left: auto; }
.mb-dialog-row .mb-dialog-number { background: #212124; }
.mb-dialog-number:disabled { opacity: 0.4; }
.mb-dialog-list { display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow-y: auto; }
.mb-dialog-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 8px;
    background: #2a2a2e;
}
.mb-dialog-item input { flex: 1; min-width: 0; background: #212124; }
.mb-dialog-item input.mb-invalid { border-color: #e5484d; }
.mb-dialog-remove {
    flex: none;
    width: 22px;
    height: 22px;
    line-height: 1;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #77777e;
    font-size: 14px;
    cursor: pointer;
}
.mb-dialog-remove:hover { background: #3a3a3f; color: #ececee; }
.mb-dialog-field { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #8e8e95; }
.mb-dialog-canvas {
    display: block;
    width: 100%;
    border-radius: 10px;
    background: #18181a;
    touch-action: none;
    cursor: crosshair;
}
.mb-dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 16px;
    background: #1d1d20;
}
.mb-dialog-button {
    padding: 6px 14px;
    border-radius: 7px;
    border: none;
    background: #2a2a2e;
    color: #ececee;
    font-size: 12.5px;
    cursor: pointer;
}
.mb-dialog-button:hover { background: #333338; }
.mb-dialog-button.mb-primary { background: var(--mb-a); color: #ffffff; }
.mb-dialog-button.mb-primary:hover { filter: brightness(1.1); }
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

/**
 * Opens a modal. `render` fills the body element; `onApply` runs on Apply and
 * can return false to keep the dialog open (failed validation); `onClose` runs
 * however the dialog goes away — Apply, Cancel, Escape or a click outside.
 * `width` overrides the default narrow body, for dialogs that hold a canvas.
 */
export function openDialog({ title, render, onApply, onClose, applyLabel = "Apply", width }) {
    ensureStyle();

    const overlay = document.createElement("div");
    overlay.className = "mb-dialog-overlay";

    const dialog = document.createElement("div");
    dialog.className = "mb-dialog";
    if (width) dialog.style.width = `${width}px`;
    dialog.innerHTML = `<div class="mb-dialog-header"><span class="mb-dialog-dot"></span><span class="mb-dialog-title"></span><button class="mb-dialog-close" aria-label="Close">×</button></div><div class="mb-dialog-body"></div>`;
    dialog.querySelector(".mb-dialog-title").textContent = title;

    const body = dialog.querySelector(".mb-dialog-body");
    render(body);

    const footer = document.createElement("div");
    footer.className = "mb-dialog-footer";

    const cancel = document.createElement("button");
    cancel.className = "mb-dialog-button";
    cancel.textContent = "Cancel";

    const apply = document.createElement("button");
    apply.className = "mb-dialog-button mb-primary";
    apply.textContent = applyLabel;

    footer.append(cancel, apply);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    function close() {
        document.removeEventListener("keydown", onKeyDown, true);
        overlay.remove();
        onClose?.();
    }

    function submit() {
        if (onApply?.() === false) return;
        close();
    }

    function onKeyDown(event) {
        if (event.key === "Escape") {
            event.stopPropagation(); // keep the canvas from acting on it too
            close();
        } else if (event.key === "Enter") {
            event.stopPropagation();
            submit();
        }
    }

    cancel.addEventListener("click", close);
    dialog.querySelector(".mb-dialog-close").addEventListener("click", close);
    apply.addEventListener("click", submit);
    overlay.addEventListener("mousedown", (event) => {
        if (event.target === overlay) close();
    });
    document.addEventListener("keydown", onKeyDown, true);

    body.querySelector("input, select, button")?.focus();
    return close;
}

/** A radio row with an optional trailing control and a hint line underneath. */
export function radioRow({ group, value, label, checked, hint, control }) {
    const wrapper = document.createElement("div");

    // A div rather than a label: a label would also swallow clicks meant for the
    // trailing control (a number input, say) and flip the radio.
    const row = document.createElement("div");
    row.className = "mb-dialog-row" + (checked ? " mb-selected" : "");

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = group;
    radio.value = value;
    radio.checked = !!checked;

    const text = document.createElement("span");
    text.textContent = label;

    row.append(radio, text);
    if (control) row.appendChild(control);
    wrapper.appendChild(row);

    if (hint) {
        const note = document.createElement("div");
        note.className = "mb-dialog-hint";
        note.textContent = hint;
        wrapper.appendChild(note);
    }

    row.addEventListener("click", (event) => {
        if (control?.contains(event.target)) return; // let the control have the click
        if (radio.checked) return;
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Keep the highlight in sync across every row in the group.
    radio.addEventListener("change", () => {
        for (const other of document.getElementsByName(group)) {
            other.closest(".mb-dialog-row")?.classList.toggle("mb-selected", other.checked);
        }
    });

    return { wrapper, radio };
}
