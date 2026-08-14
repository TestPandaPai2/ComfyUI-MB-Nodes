// Small themed modal used by the MB Settings menus. Styles are injected once and
// scoped to .mb-dialog-* so they cannot leak into the rest of the UI.

const STYLE_ID = "mb-dialog-style";

const CSS = `
.mb-dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
.mb-dialog {
    width: 320px;
    max-width: calc(100vw - 32px);
    background: #141414;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
    color: #dcdcdc;
    font-size: 13px;
}
.mb-dialog-title {
    background: #e01010;
    color: #ffffff;
    font-weight: 600;
    padding: 10px 14px;
}
.mb-dialog-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.mb-dialog-row {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 10px;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    background: #1b1b1b;
    cursor: pointer;
}
.mb-dialog-row:hover { border-color: #3a3a3a; }
.mb-dialog-row.mb-selected { border-color: #e01010; background: #241416; }
.mb-dialog-row input[type="radio"] { accent-color: #e01010; margin: 0; }
.mb-dialog-hint { color: #8f8f8f; font-size: 11px; margin: 2px 0 0 29px; }
.mb-dialog-number {
    width: 72px;
    margin-left: auto;
    padding: 4px 8px;
    background: #0d0d0d;
    color: #dcdcdc;
    border: 1px solid #3a3a3a;
    border-radius: 6px;
    font-size: 13px;
}
.mb-dialog-number:disabled { opacity: 0.4; }
.mb-dialog-list { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
.mb-dialog-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    background: #1b1b1b;
}
.mb-dialog-item input {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    background: #0d0d0d;
    color: #dcdcdc;
    border: 1px solid #3a3a3a;
    border-radius: 6px;
    font-size: 13px;
}
.mb-dialog-item input.mb-invalid { border-color: #e01010; }
.mb-dialog-remove {
    flex: none;
    width: 22px;
    height: 22px;
    line-height: 1;
    border-radius: 6px;
    border: 1px solid #3a3a3a;
    background: #262626;
    color: #b0b0b0;
    font-size: 14px;
    cursor: pointer;
}
.mb-dialog-remove:hover { background: #3a1a1c; border-color: #e01010; color: #ffffff; }
.mb-dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 14px 14px;
}
.mb-dialog-button {
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid #3a3a3a;
    background: #262626;
    color: #dcdcdc;
    font-size: 13px;
    cursor: pointer;
}
.mb-dialog-button:hover { background: #303030; }
.mb-dialog-button.mb-primary { background: #e01010; border-color: #e01010; color: #ffffff; }
.mb-dialog-button.mb-primary:hover { background: #f01c1c; }
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
 */
export function openDialog({ title, render, onApply, onClose, applyLabel = "Apply" }) {
    ensureStyle();

    const overlay = document.createElement("div");
    overlay.className = "mb-dialog-overlay";

    const dialog = document.createElement("div");
    dialog.className = "mb-dialog";
    dialog.innerHTML = `<div class="mb-dialog-title"></div><div class="mb-dialog-body"></div>`;
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
