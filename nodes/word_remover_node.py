"""Word Remover (MB): strip a list of words or phrases out of a text. Matches are
whole-word and case-insensitive, and the leftover double spaces and empty comma
slots are tidied so a prompt reads cleanly afterwards."""

import re

from comfy_api.latest import io


def remove_words(text, words):
    terms = [w.strip() for w in re.split(r"[,\n]", words) if w.strip()]
    if not terms:
        return text

    # Longest first, so a phrase goes before a single word inside it.
    terms.sort(key=len, reverse=True)
    pattern = re.compile(
        r"(?<!\w)(?:" + "|".join(re.escape(t) for t in terms) + r")(?!\w)", re.IGNORECASE
    )
    text = pattern.sub("", text)

    lines = []
    for line in text.split("\n"):
        line = re.sub(r"[ \t]{2,}", " ", line)
        line = re.sub(r",(?:[ \t]*,)+", ",", line)
        line = re.sub(r"[ \t]+([,.;:!?])", r"\1", line)
        lines.append(line.strip(" \t,"))
    return "\n".join(lines)


class MBWordRemover(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBWordRemover",
            display_name="Word Remover (MB)",
            category="MBNodes",
            description="Remove words or phrases (comma or newline separated) from a text, whole-word and ignoring case.",
            search_aliases=["remove words", "word remover", "strip words", "delete words"],
            inputs=[
                io.String.Input("text", force_input=True, tooltip="The text to clean."),
                io.String.Input(
                    "words",
                    multiline=True,
                    default="",
                    tooltip="Words or phrases to remove, separated by commas or new lines.",
                ),
                io.Boolean.Input("bypass", default=False, tooltip="Pass the text through unchanged."),
            ],
            outputs=[io.String.Output("text")],
        )

    @classmethod
    def execute(cls, text, words, bypass) -> io.NodeOutput:
        if bypass:
            return io.NodeOutput(text)
        return io.NodeOutput(remove_words(text, words))


NODES = [MBWordRemover]
