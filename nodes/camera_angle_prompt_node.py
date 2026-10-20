"""Camera Angle Prompt picker: one combo of camera perspectives (fixed or
seeded-random), outputs that perspective's description."""

import random

from comfy_api.latest import io

from .common import MAX_SEED, weighted


CAMERA_ANGLES = {
    "Drone View": "The image is taken from a drone hovering high above at a steep diagonal, looking down on the subject from a distance and showing them small within the surrounding space and architecture.",
    "Aerial View": "The image is taken from far overhead, looking straight down from a great height, so the subject appears tiny in the center of the scene with the surrounding layout fully visible.",
    "Top-Down View": "The image is taken from directly above the subject's head, pointing straight down and close enough to fill the frame, foreshortening the body as the subject looks up into the lens.",
    "High Angle": "The image is taken from above eye level with the camera tilted downward, looking down on the subject's full body as they gaze up toward the lens.",
    "Eye Level": "The image is taken from the same height as the subject's eyes, facing them straight on in a neutral, natural perspective.",
    "Low Angle": "The image is taken from below chest height with the camera tilted upward, making the subject appear tall, confident, and powerful against the ceiling or sky.",
    "Worm's-Eye View": "The image is taken from almost ground level looking sharply upward, exaggerating the length of the subject's legs and making them tower dramatically over the frame.",
    "Wide Full Shot": "The image is taken from a long distance, capturing the subject's full body standing small within a large, open environment that dominates the frame.",
    "Distant Walk-Up": "The image is taken from far back at eye level as the subject walks toward the camera, showing their full figure centered with plenty of environment around them.",
    "Full-Body Seated Shot": "The image is taken from a moderate distance, framing the subject's full body while seated and capturing both their posture and the setting around them.",
    "Medium Shot": "The image is taken from a mid-range distance, framing the subject from the waist up with their expression and body language clear and some background visible.",
    "Close-Up": "The image is taken from close range, framing the subject's head and shoulders tightly with the focus on their facial expression and the background softly blurred.",
    "Framed Headshot": "The image is taken from directly in front at close range, framing the subject's face and shoulders centered, with a background element forming a natural frame around their head.",
    "Extreme Close-Up": "The image is taken from very close range, filling the frame with part of the subject's face, such as the eyes, skin texture, and fine details.",
    "Front View": "The image is taken from directly in front of the subject, showing their full face and body symmetrically.",
    "Side Profile": "The image is taken from a 90-degree angle to the subject, capturing a clean side view of their face and body as they look straight ahead.",
    "Profile Walk": "The image is taken from the side as the subject walks across the frame in full profile, capturing them mid-stride.",
    "Three-Quarter Back View": "The image is taken from behind and slightly to the side of the subject, showing their back and part of their profile as they look away.",
    "Looking Over Shoulder": "The image is taken from behind the subject at a slight angle as they turn their head back over their shoulder toward the lens.",
    "Over-the-Shoulder": "The image is taken from just behind the subject's shoulder, with the back of their head and shoulder in the foreground as they look out into the scene ahead.",
    "Silhouette Profile": "The image is taken from the side with the subject in profile against a bright sky or light source, rendering their figure as a dark outline with minimal detail.",
    "Dutch Angle": "The image is taken with the camera rolled noticeably to one side, tilting the horizon and the subject diagonally across the frame for a tense, off-balance feel.",
    "Hero Shot": "The image is taken from a low position close to the subject with the camera angled sharply upward and a wide lens, making them loom large and heroic against a dramatic sky.",
    "Crane Shot": "The image is taken from a camera raised high on a crane at an oblique angle, sweeping down over the scene to show the subject within a large, layered set.",
    "Overhead Lying Shot": "The image is taken from directly above the subject as they lie on their back, framing their full body flat against the floor, bed, or grass beneath them.",
    "Hip-Level Shot": "The image is taken from waist height with the camera level, giving a grounded, slightly upward view of the subject that emphasizes their stance and hands.",
    "Cowboy Shot": "The image is taken from a medium distance, framing the subject from mid-thigh up in a classic western composition that keeps their hips and hands in view.",
    "Medium Close-Up": "The image is taken from a short distance, framing the subject from the chest up so their face dominates while their shoulders and clothing remain visible.",
    "Extreme Wide Shot": "The image is taken from very far away, establishing a vast landscape or cityscape in which the subject is only a tiny figure.",
    "Three-Quarter Front View": "The image is taken from in front and about 45 degrees to one side of the subject, showing both their face and the depth of their body in a natural, flattering angle.",
    "Rear View": "The image is taken from directly behind the subject, showing their back, hair, and silhouette as they face away into the scene.",
    "Point of View": "The image is taken from the viewer's own eye line as if seen through their eyes, with the subject looking or reaching straight toward the lens.",
    "Selfie Angle": "The image is taken from arm's length slightly above the subject's eye level, angled down toward their face in a casual, handheld perspective.",
    "Tracking Shot": "The image is taken from a camera moving alongside the subject at their pace, keeping them sharp while the background streaks with motion blur.",
    "Ground-Level Tracking": "The image is taken from just above the ground behind or beside the subject's feet as they walk, with the floor rushing toward the lens in the foreground.",
    "Telephoto Compression": "The image is taken from far away with a long telephoto lens, flattening the depth so the background looms large and close behind the subject.",
    "Fisheye Lens": "The image is taken with an ultra-wide fisheye lens, bending straight lines into curves and stretching the edges of the frame around the subject.",
    "Wide-Angle Close-Up": "The image is taken from very close with a wide lens, exaggerating whatever is nearest the camera and distorting the subject's proportions for a bold, dynamic look.",
    "Macro Detail": "The image is taken from macro range, isolating a tiny detail of the subject such as their hands, jewelry, or lips in razor-thin focus.",
    "Foreground Framing": "The image is taken through a doorway, archway, or gap between objects, with the dark foreground edges framing the subject in the middle distance.",
    "Through the Window": "The image is taken from outside looking through a window at the subject, with reflections and faint glare on the glass layered over them.",
    "Mirror Reflection": "The image is taken showing the subject through their reflection in a mirror, with the frame of the mirror and part of the real scene visible around it.",
    "Foreground Bokeh": "The image is taken past out-of-focus objects close to the lens, with soft blurred shapes in the foreground leading the eye to the sharp subject beyond.",
    "Candid Long Lens": "The image is taken from a hidden distance with a long lens, capturing the subject unaware and natural, partially obscured by passing people or objects.",
    "Symmetrical Center Frame": "The image is taken straight on with the subject placed dead center in a perfectly symmetrical composition, the surroundings mirrored evenly on both sides.",
    "Off-Center Negative Space": "The image is taken with the subject placed small near one edge of the frame, leaving a large expanse of empty sky, wall, or landscape filling the rest.",
}


class MBCameraAnglePrompt(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        angles = list(CAMERA_ANGLES)
        return io.Schema(
            node_id="MBNodesCameraAnglePrompt",
            display_name="Camera Angle Prompt (MB)",
            category="MBNodes",
            description="Pick a camera perspective/angle, or a seeded-random one; outputs its prompt.",
            search_aliases=["camera", "angle", "perspective", "shot", "framing"],
            inputs=[
                io.Combo.Input("angle", options=angles, default="Eye Level", tooltip="Camera angle used when random_angle is off."),
                io.Boolean.Input("random_angle", default=False, tooltip="Pick the camera angle from the seed instead of the angle widget."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
            ],
            outputs=[io.String.Output("prompt")],
        )

    @classmethod
    def execute(cls, angle, random_angle, seed, weight) -> io.NodeOutput:
        name = random.Random(seed).choice(list(CAMERA_ANGLES)) if random_angle else angle
        return io.NodeOutput(weighted(CAMERA_ANGLES[name], weight))


NODES = [MBCameraAnglePrompt]
