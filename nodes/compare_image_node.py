"""Side-by-side image compare with a slider that follows the cursor.

Both images are written to the temp folder as ordinary previews, but they are
handed to the frontend under `mb_compare` rather than `images`: under the usual
key ComfyUI would stack them as two previews under the node, and the point here
is one image drawn over the other.
"""

from comfy_api.latest import io
from comfy_api.latest._ui import ImageSaveHelper

DIRECTIONS = ["Left to Right", "Right to Left", "Up to Down"]

PREVIEW_PREFIX = "MBCompare_temp"


def _preview(image, cls):
    """First frame of a batch, saved into the temp folder for /view."""
    return ImageSaveHelper.save_images(
        image[:1],
        filename_prefix=PREVIEW_PREFIX,
        folder_type=io.FolderType.temp,
        cls=cls,
        compress_level=1,
    )


class MBImageCompare(io.ComfyNode):
    """Draw image B over image A behind a slider that tracks the cursor."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBImageCompare",
            display_name="Image Compare (MB)",
            category="MBNodes",
            description="Compare two images with a slider that follows the cursor across the preview.",
            search_aliases=["image compare", "compare images", "a b compare", "before after"],
            is_output_node=True,
            inputs=[
                io.Image.Input("image_a", tooltip="Image A — the one the slider wipes away."),
                io.Image.Input("image_b", tooltip="Image B — the one the slider reveals."),
                io.Combo.Input(
                    "direction",
                    options=DIRECTIONS,
                    default=DIRECTIONS[0],
                    tooltip="Which way the slider wipes: A gives way to B along this direction.",
                ),
            ],
            outputs=[],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, image_a, image_b, direction) -> io.NodeOutput:
        return io.NodeOutput(
            ui={
                "mb_compare": [
                    {
                        "a": _preview(image_a, cls),
                        "b": _preview(image_b, cls),
                        "direction": direction,
                    }
                ]
            }
        )


NODES = [MBImageCompare]
