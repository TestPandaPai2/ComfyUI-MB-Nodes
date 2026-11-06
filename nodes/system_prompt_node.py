from comfy_api.latest import io

# Saving and loading live in prompt_store, shared with MB Prompt Pad.
from . import prompt_store  # noqa: F401  (imported for its routes)


class MBSystemPrompt(io.ComfyNode):
    """A system prompt box with a dropdown of saved prompts and a Save button,
    both working on the pack's SystemPrompts folder."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBSystemPrompt",
            display_name="MB System Prompt",
            category="MBNodes",
            description="Keep, save and load LLM system prompts as .txt files.",
            search_aliases=["system prompt", "load prompt", "prompt library"],
            inputs=[
                io.String.Input("text", multiline=True, default=""),
                io.String.Input(
                    "filename",
                    default="system",
                    socketless=True,
                    tooltip="Name the Save button writes to, inside the pack's SystemPrompts folder.",
                ),
            ],
            outputs=[io.String.Output("system_prompt")],
        )

    @classmethod
    def execute(cls, text, filename) -> io.NodeOutput:
        return io.NodeOutput(text or "")


NODES = [MBSystemPrompt]
