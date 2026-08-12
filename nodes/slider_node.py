import math

from comfy_api.latest import io


class MBSlider(io.ComfyNode):
    """Slider with a user-defined range and step. When `live` is on the frontend
    re-queues the prompt while the slider is dragged."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBSlider",
            display_name="Slider (MB)",
            category="MBNodes",
            description="Float/int slider with adjustable range, step and live re-queue.",
            inputs=[
                io.Float.Input(
                    "value",
                    default=1.0,
                    min=1.0,
                    max=20.0,
                    step=1.0,
                    display_mode=io.NumberDisplay.slider,
                ),
                io.Float.Input(
                    "min_value",
                    display_name="min",
                    default=1.0,
                    step=0.01,
                    tooltip="Lower end of the slider.",
                ),
                io.Float.Input(
                    "max_value",
                    display_name="max",
                    default=20.0,
                    step=0.01,
                    tooltip="Upper end of the slider.",
                ),
                io.Float.Input(
                    "step",
                    default=1.0,
                    min=0.0001,
                    max=1000.0,
                    step=0.0001,
                    tooltip="Increment the value snaps to.",
                ),
                io.Boolean.Input(
                    "live",
                    default=False,
                    label_on="live",
                    label_off="manual",
                    tooltip="Re-queue the prompt while dragging the slider.",
                ),
            ],
            outputs=[
                io.Float.Output("float"),
                io.Int.Output("int"),
                io.String.Output("string"),
            ],
        )

    @classmethod
    def validate_inputs(cls, **kwargs) -> bool | str:
        low = kwargs.get("min_value")
        high = kwargs.get("max_value")
        if low is not None and high is not None and low >= high:
            return "min must be smaller than max."
        if kwargs.get("step", 1.0) <= 0:
            return "step must be greater than zero."
        return True

    @classmethod
    def execute(cls, value, min_value, max_value, step, live) -> io.NodeOutput:
        low, high = sorted((min_value, max_value))
        snapped = low + round((value - low) / step) * step if step > 0 else value
        result = max(low, min(high, snapped))

        # Kill the float noise the snap introduces (0.30000000000000004 -> 0.3).
        digits = 6 if step <= 0 else min(12, max(0, -int(math.floor(math.log10(step)))) + 2)
        result = round(result, digits)

        return io.NodeOutput(result, int(round(result)), f"{result:g}")


NODE_CLASS_MAPPINGS = {"MBSlider": MBSlider}
NODE_DISPLAY_NAME_MAPPINGS = {"MBSlider": "Slider (MB)"}
