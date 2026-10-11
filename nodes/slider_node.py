import math

from comfy_api.latest import io


class MBSlider(io.ComfyNode):
    """A single slider. Range and step are set from the gear on the node; the
    frontend matches the output type (INT or FLOAT) to whatever it feeds."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBSlider",
            display_name="Slider (MB)",
            category="MBNodes",
            description="Slider whose output takes the type, range and step of the input it is connected to.",
            inputs=[
                io.Float.Input("value", default=1.0, min=1.0, max=20.0, step=1.0, display_mode=io.NumberDisplay.slider),
                io.Float.Input("min_value", default=1.0, step=0.01),
                io.Float.Input("max_value", default=20.0, step=0.01),
                io.Float.Input("step", default=1.0, min=0.0001, max=1000.0, step=0.0001),
                io.Combo.Input("output_type", options=["FLOAT", "INT"], default="FLOAT"),
            ],
            outputs=[io.AnyType.Output("value")],
        )

    @classmethod
    def validate_inputs(cls, min_value, max_value, step, **kwargs) -> bool | str:
        if min_value >= max_value:
            return "min must be smaller than max."
        if step <= 0:
            return "step must be greater than zero."
        return True

    @classmethod
    def execute(cls, value, min_value, max_value, step, output_type) -> io.NodeOutput:
        snapped = min_value + round((value - min_value) / step) * step
        result = max(min_value, min(max_value, snapped))
        if output_type == "INT":
            return io.NodeOutput(int(round(result)))
        # Kill the float noise the snap introduces (0.30000000000000004 -> 0.3).
        return io.NodeOutput(round(result, min(12, max(0, -int(math.floor(math.log10(step)))) + 2)))


NODES = [MBSlider]
