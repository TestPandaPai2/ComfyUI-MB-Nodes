"""Prompt Combiner: joins picker outputs in slot order between a prefix and a
suffix, optionally tidying each part into a clean sentence."""

import re

from comfy_api.latest import io, ui

SEPARATORS = {
    "space": " ",
    "comma": ", ",
    "newline": "\n",
    "blank line": "\n\n",
}

MAX_INPUTS = 32
WEIGHTED = re.compile(r"^\(.*:\d+(\.\d+)?\)$", re.S)


def tidy_part(text):
    """Collapse spacing, fix stray dots, capitalize and end with a period.
    Weighted parts like (text:1.20) are left as-is."""
    text = re.sub(r"\s+", " ", text).strip()
    if WEIGHTED.match(text):
        return text
    text = re.sub(r"\s+([.,])", r"\1", text)
    text = re.sub(r"\.(\s*\.)+", ".", text).lstrip(" .,")
    if not text:
        return text
    text = text[0].upper() + text[1:]
    if text[-1].isalnum():
        text += "."
    return text


class MBPromptCombiner(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBPromptCombiner",
            display_name="Prompt Combiner (MB)",
            category="MBNodes",
            description="Join prompt parts in slot order between a prefix and suffix, with optional tidying and a preview.",
            search_aliases=["prompt combiner", "build prompt", "join prompt", "combine prompt"],
            inputs=[
                io.Autogrow.Input("parts", template=io.Autogrow.TemplatePrefix(
                    input=io.String.Input("part", force_input=True), prefix="part_", min=0, max=MAX_INPUTS),
                    tooltip="Prompt parts, joined in slot order. Empty parts are skipped."),
                io.String.Input("prefix", default="", tooltip="Text placed before the parts, as typed."),
                io.String.Input("suffix", default="", tooltip="Text placed after the parts, as typed."),
                io.Combo.Input("separator", options=list(SEPARATORS), default="space", tooltip="What is placed between the pieces."),
                io.Boolean.Input("tidy", default=True, tooltip="Fix spacing and stray dots, capitalize each part and end it with a period."),
            ],
            outputs=[io.String.Output("prompt")],
            is_output_node=True,
        )

    @classmethod
    def execute(cls, parts: io.Autogrow.Type, prefix, suffix, separator, tidy) -> io.NodeOutput:
        texts = [str(v) for v in parts.values() if v is not None and str(v).strip()]
        if tidy:
            texts = [tidy_part(t) for t in texts]
        prompt = SEPARATORS[separator].join(t.strip() for t in [prefix, *texts, suffix] if t.strip())
        return io.NodeOutput(prompt, ui=ui.PreviewText(prompt))


NODES = [MBPromptCombiner]
