"""Create Bounding Boxes (MB): the core Create Bounding Boxes node for the
legacy (LiteGraph) node UI. The core node's editor only renders in Nodes 2.0;
here the canvas is a DOM widget from web/bounding_boxes_node.js and the boxes
travel as JSON in two hidden string widgets. Parsing, preview and element
building are the core helpers, so the outputs match the core node."""

import json

import nodes
from comfy_api.latest import io
from comfy_extras.nodes_bounding_boxes import (
    _bg_from_image,
    boxes_from_input,
    boxes_to_regions,
    build_elements,
    fractions_to_bbox_frame,
    render_preview,
)


class MBCreateBoundingBoxes(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBCreateBoundingBoxes",
            display_name="Create Bounding Boxes (MB)",
            category="MBNodes",
            description=(
                "Draw bounding boxes in a canvas. Outputs Ideogram prompt elements, pixel-space "
                "bounding boxes, and a preview image. Works in the legacy node UI."
            ),
            search_aliases=["bounding boxes", "bbox", "regions", "ideogram elements"],
            inputs=[
                io.Image.Input(
                    "background",
                    optional=True,
                    tooltip="Optional image used as background in the canvas and preview.",
                ),
                io.MultiType.Input(
                    "bboxes",
                    [io.BoundingBox, io.Array, io.String],
                    optional=True,
                    tooltip="Bounding boxes, elements, or a JSON string to initialize the canvas. A new upstream value initializes the canvas; edits made on the canvas take priority and are kept until the upstream value changes again.",
                ),
                io.Int.Input("width", default=1024, min=64, max=16384, step=16,
                             tooltip="Width of the canvas and the pixel grid for the bounding boxes."),
                io.Int.Input("height", default=1024, min=64, max=16384, step=16,
                             tooltip="Height of the canvas and the pixel grid for the bounding boxes."),
                # JSON lists of pixel boxes, written by the canvas editor and
                # hidden from the widget list by the frontend.
                io.String.Input("editor_state", default="[]", socketless=True),
                io.String.Input("last_incoming", default="[]", socketless=True),
            ],
            outputs=[
                io.Image.Output(display_name="preview"),
                io.BoundingBox.Output(display_name="bboxes"),
                io.Array.Output(display_name="elements"),
            ],
            is_output_node=True,
        )

    @classmethod
    def execute(cls, width, height, editor_state, last_incoming, background=None, bboxes=None) -> io.NodeOutput:
        incoming = boxes_from_input(bboxes, width, height)
        applied = json.loads(last_incoming or "[]")
        upstream_changed = bool(incoming) and incoming != applied
        source = incoming if upstream_changed else json.loads(editor_state or "[]")
        regions = boxes_to_regions(source, width, height)
        preview = render_preview(regions, width, height, _bg_from_image(background))
        ui = {"dims": [width, height]}
        if incoming:
            ui["input_bboxes"] = incoming
        if background is not None and len(background) > 0:
            saved = nodes.PreviewImage().save_images(background[:1], "mb.bboxes.background")
            ui["background_images"] = saved["ui"]["images"]
        return io.NodeOutput(
            preview,
            fractions_to_bbox_frame(regions, width, height),
            build_elements(regions),
            ui=ui,
        )


NODES = [MBCreateBoundingBoxes]
