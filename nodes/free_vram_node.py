"""MB Free VRAM: frees GPU memory at this point in the graph and passes its input
through, so it can sit between two steps."""

import comfy.model_management
from comfy_api.latest import io

MODES = ["All", "Models", "Cache"]


class MBFreeVRAM(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBFreeVRAM",
            display_name="MB Free VRAM",
            category="MBNodes",
            description="Frees VRAM when the graph reaches this node, then passes its input through.",
            search_aliases=["free vram", "clear vram", "unload models", "empty cache", "free memory"],
            inputs=[
                io.AnyType.Input("value", optional=True, tooltip="Anything. The node runs once this is ready, and passes it on."),
                io.Combo.Input(
                    "free",
                    options=MODES,
                    default="All",
                    tooltip="Models: unload every loaded model. Cache: empty the GPU cache and keep models loaded. All: both.",
                ),
            ],
            outputs=[io.AnyType.Output("value")],
            is_output_node=True,
        )

    @classmethod
    def fingerprint_inputs(cls, free, value=None):
        return float("NaN")  # memory is full again by the next run, so never skip

    @classmethod
    def execute(cls, free, value=None) -> io.NodeOutput:
        if free in ("All", "Models"):
            comfy.model_management.unload_all_models()
        if free in ("All", "Cache"):
            comfy.model_management.soft_empty_cache(True)
        return io.NodeOutput(value)


NODES = [MBFreeVRAM]
