"""Body type picker: short-name dropdown, outputs the full body type description."""

import random

from comfy_api.latest import io

from .common import FAVORITES, pick_favorite, weighted


BODY_TYPES = {
    "Rectangle": "She has a straight, rectangular figure with shoulders, waist, and hips about the same width. Her waist is barely curved, her chest is small to medium, and her build is lean and even.",
    "Inverted Triangle": "She has an inverted triangle figure with broad shoulders and a full chest above narrow hips. Her upper back is strong like a swimmer's, her hips are slim, and her legs are long and lean.",
    "Triangle": "She has a pear-shaped figure with narrow shoulders and a small chest above wide hips and full thighs. Her waist is clearly defined and most of her curves sit below it.",
    "Spoon": "She has a spoon-shaped figure with a small waist and wide hips that flare out sharply just below it. Her bottom is full and round, and her shoulders and chest are slim.",
    "Hourglass": "She has an hourglass figure with a full chest and full, rounded hips of equal width, joined by a narrow, clearly nipped-in waist. Her curves are smooth and balanced top to bottom.",
    "Bottom Hourglass": "She has a curvy hourglass figure with a narrow waist and hips and thighs slightly fuller than her chest. Her curves are balanced but heavier on the lower body.",
    "Exaggerated Hourglass": "She has an extreme hourglass figure with a very large chest and very wide, round hips around a tiny, tightly cinched waist. The contrast between her waist and her curves is dramatic.",
    "Oval": "She has an apple-shaped figure with a round, full stomach as the widest part of her body. Her chest is full, her waist is soft and undefined, and her arms and legs are slim.",
    "Busty": "She has a busty figure with a large, full chest that stands out as her main feature. Her waist is defined, her hips are average, and her upper body draws the eye.",
    "Small Bust": "She has a small-chested figure with a flat to petite chest and a slim, streamlined upper body. Her shoulders are narrow and her waist and hips are softly shaped.",
    "Apple Bottom": "She has a curvy figure with a big, round, lifted bottom as her main feature. Her waist is small, her hips are wide, and her thighs are full and toned.",
    "Petite": "She has a petite figure, short and small-boned with a delicate frame. Her shoulders, waist, and hips are small and proportional, and her arms and legs are slender.",
    "Tall & Slender": "She has a tall, slender figure with long arms and very long legs. Her shoulders and hips are narrow, her waist is lightly shaped, and her whole frame looks long and lean.",
    "Skinny": "She has a very thin, skinny figure with narrow shoulders, a tiny waist, and slim hips. Her chest is small, her arms and legs are thin, and her body has almost no curves.",
    "Athletic": "She has a toned, athletic figure with firm muscles and a flat, tight stomach. Her shoulders are strong, and her arms and legs are lean with visible definition.",
    "Muscular": "She has a muscular, fitness-model figure with big, clearly defined muscles. Her shoulders and back are broad, her abs are visible, and her arms and thighs are powerful.",
    "Curvy": "She has a curvy figure with a full chest and full, rounded hips around a soft but visible waist. Her thighs and bottom are generous and her curves flow smoothly.",
    "Thick": "She has a thick figure with wide hips, strong full thighs, and a round bottom below a defined waist. Her lower body is solid and shapely with plenty of volume.",
    "Slim-Thick": "She has a slim-thick figure with a slim upper body, tiny waist, and flat stomach above wide hips, full thighs, and a round bottom. Lean on top, curvy below.",
    "Plus-Size": "She has a plus-size figure, full and soft all over. Her chest, stomach, hips, and thighs are full, her arms are rounded, and her body looks big and confident.",
    "Voluptuous": "She has a voluptuous figure with a very large chest, wide round hips, a full bottom, and thick thighs. Her body is soft and generously curvy everywhere.",
    "Chubby": "She has a chubby figure, softly rounded and a little plump. Her cheeks, arms, stomach, and thighs are soft, and her waist is only lightly shaped.",
    "Long Torso": "She has a long torso and comparatively short legs. Her waist sits low on her body and her upper body takes up most of her height.",
    "Long Legs": "She has a short torso and very long legs. Her waist sits high on her body and her legs take up most of her height.",
}


class MBBodyType(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesBodyType",
            display_name="Body Type (MB)",
            category="MBNodes",
            inputs=[
                io.Combo.Input("body_type", options=[*BODY_TYPES, FAVORITES], default="Hourglass"),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
                io.Boolean.Input("randomize", default=False, tooltip="Pick from the seed instead of the dropdown."),
                io.Int.Input("seed", default=0, min=0, max=0xFFFFFFFFFFFFFFFF, control_after_generate=True),
                io.Boolean.Input("fit_hint", default=False, tooltip="Add a line asking for a full-body view with close-fitting clothes so the figure stays visible."),
            ],
            outputs=[io.String.Output("prompt"), io.String.Output("category")],
        )

    @classmethod
    def execute(cls, body_type, weight, randomize, seed, fit_hint=False) -> io.NodeOutput:
        body_type = pick_favorite("MBNodesBodyType", body_type, BODY_TYPES, seed)
        if randomize:
            body_type = random.Random(seed).choice(list(BODY_TYPES))
        text = BODY_TYPES[body_type]
        if fit_hint:
            text += " Her figure is clearly visible in a full-body view, her clothes fitted closely to her shape."
        return io.NodeOutput(weighted(text, weight), body_type)


NODES = [MBBodyType]
