from comfy_api.latest import io

# Saving and loading live in prompt_store, shared with System Prompt (MB).
from . import prompt_store  # noqa: F401  (imported for its routes)


class MBPromptPad(io.ComfyNode):
    """A prompt scratchpad. Type a prompt, name it, and save it to the pack's
    SavedPrompts folder with the Save button, or pull one back with Load."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBPromptPad",
            display_name="Prompt Pad (MB)",
            category="MBNodes",
            description="Write prompts, keep them, and save them to SavedPrompts as .txt files.",
            search_aliases=["prompt pad", "save prompt", "prompt notes"],
            inputs=[
                io.String.Input("text", multiline=True, default=""),
                io.String.Input(
                    "filename",
                    default="prompt",
                    socketless=True,
                    tooltip="Name the Save button writes to, inside the pack's SavedPrompts folder.",
                ),
                io.String.Input(
                    "text_in",
                    optional=True,
                    force_input=True,
                    tooltip="When connected, this replaces the typed text on the output.",
                ),
            ],
            outputs=[io.String.Output("text")],
        )

    @classmethod
    def execute(cls, text, filename, text_in=None) -> io.NodeOutput:
        incoming = text_in if isinstance(text_in, str) else ("" if text_in is None else str(text_in))
        return io.NodeOutput(incoming if incoming.strip() else (text or ""))


NODES = [MBPromptPad]
