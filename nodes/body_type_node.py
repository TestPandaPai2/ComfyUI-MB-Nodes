"""Body type picker: short-name dropdown, outputs the full body type description."""

from comfy_api.latest import io


def weighted(text, weight):
    return text if weight == 1.0 else f"({text}:{weight:.2f})"

BODY_TYPES = {
    "Rectangle": "Body type: rectangle body type, where the shoulders, waist, and hips measure nearly the same width, forming a straight, column-like silhouette. The waist is only slightly defined, the bust is modest to medium, and her body tends to be athletic or lean, with weight distributed evenly rather than concentrated in one area.",
    "Inverted Triangle": "Body type: inverted triangle body type, where the shoulders and bust are noticeably broader than the hips, creating a top-heavy silhouette. Her waist is moderately defined or straight, the hips and buttocks are narrow and flat to slightly rounded, and the legs are often slim and long relative to the upper body.",
    "Triangle": "Body type: triangle body type, where the hips and thighs are wider than the shoulders and bust, creating a bottom-heavy silhouette. Her shoulders and upper body are narrow and delicate, the waist is clearly defined, and weight tends to collect in the hips, buttocks, and thighs.",
    "Spoon": "Body type: spoon body type, where the hips are wider than the shoulders and bust, with a well-defined waist and a distinct shelf-like shape at the high hip. Her buttocks are full and curved outward, and the upper body is proportionally smaller, so the silhouette resembles the curved bowl of a spoon in profile.",
    "Hourglass": "Body type: hourglass body type, where the shoulders and hips are nearly equal in width, connected by a clearly defined, narrow waist. Her bust and buttocks are full and balanced, and the curves are symmetrical, creating a smooth, evenly proportioned figure-eight silhouette.",
    "Bottom Hourglass": "Body type: bottom hourglass body type, where the hips and thighs are slightly fuller than the bust and shoulders, with a sharply defined waist. Her silhouette is curvy and balanced but carries more volume in the lower body, giving a gently pear-leaning hourglass shape.",
    "Top Hourglass": "Body type: top hourglass body type, where the bust and shoulders are slightly fuller than the hips, with a sharply defined waist. Her silhouette is curvy and balanced but carries more volume in the upper body, giving a gently inverted-triangle-leaning hourglass shape.",
    "Diamond": "Body type: diamond body type, where the hips are the widest part of the body, while the shoulders and bust are narrower and the waist is broad and undefined. Her weight is carried mostly around the midsection and hips, with slim arms and legs and a rounded, diamond-shaped outline.",
    "Oval": "Body type: oval body type, where the midsection is the widest part of the body, with a rounded torso and soft waist definition. Her shoulders and hips are narrower than the middle, the bust is often full, and her legs and arms are comparatively slim, creating an overall rounded, egg-like silhouette.",
    "Exaggerated Hourglass": "Body type: exaggerated hourglass body type, where the shoulders and hips are nearly equal in width but the bust and hips are very full and dramatic, connected by an unusually narrow, sharply cinched waist. Her curves are pronounced and symmetrical, creating a strongly accentuated figure-eight silhouette with a high contrast between the waist and the fuller upper and lower body.",
    "Busty": "Body type: busty body type, where the bust is the most prominent feature and noticeably fuller than the rest of her frame. Her shoulders are proportionate to the bust, the waist is moderately to clearly defined, and the hips can range from narrow to average, giving the upper body visual emphasis.",
    "Apple Bottom": "Body type: apple bottom body type, where the buttocks are full, round, and lifted, standing out as the most prominent feature of her lower body. Her waist is typically defined, the hips are wide and curved, and the thighs are toned or full, creating a curvy silhouette with strong emphasis on the rear.",
    "Petite": "Body type: petite body type, with a short stature and a small, delicate bone structure. Her shoulders, waist, and hips are compact and proportionate, her limbs are slender, and her overall frame looks dainty and finely built.",
    "Tall & Slender": "Body type: tall and slender body type, with a long, willowy frame and elongated limbs. Her shoulders and hips are narrow, the waist is lightly defined, and her lean proportions give a graceful, statuesque silhouette.",
    "Ectomorph": "Body type: ectomorph body type, with a naturally thin, narrow frame and low body fat. Her shoulders and hips are slight, the limbs are long and lean, muscle definition is minimal, and the overall figure looks light and delicate.",
    "Mesomorph": "Body type: mesomorph body type, with a medium, naturally muscular frame. Her shoulders are moderately broad, the waist is firm and defined, the hips are balanced, and her body looks strong, compact, and evenly toned.",
    "Endomorph": "Body type: endomorph body type, with a soft, rounded frame that carries weight easily. Her shoulders and hips are wide, the waist is soft, the bust, hips, and thighs are full, and the overall figure looks curvy and cushioned.",
    "Athletic": "Body type: athletic body type, with a toned, firm frame and visible muscle definition. Her shoulders are strong, the abdomen is flat and tight, the arms and legs are lean and sculpted, and the silhouette looks fit and energetic.",
    "Muscular": "Body type: muscular body type, with pronounced, sculpted muscles throughout the frame. Her shoulders and back are broad and defined, the abs are visible, the arms and thighs are powerful, and the silhouette looks strong like a fitness model.",
    "Skinny": "Body type: skinny body type, with a very lean, slim frame and little curvature. Her shoulders, waist, and hips are narrow, the bust is small, the limbs are thin, and the overall silhouette looks light and straight.",
    "Curvy": "Body type: curvy body type, with a full bust and full, rounded hips joined by a soft yet noticeable waist. Her thighs and buttocks are generous, and the figure has smooth, flowing curves throughout.",
    "Thick": "Body type: thick body type, with full, strong thighs, wide hips, and round buttocks paired with a defined waist. Her lower body carries noticeable volume and the overall figure looks solid, shapely, and curvaceous.",
    "Plus-Size": "Body type: plus-size body type, with a full, generously proportioned figure overall. Her bust, waist, hips, and thighs are all full and soft, the arms are rounded, and the silhouette looks confident and ample.",
    "Voluptuous": "Body type: voluptuous body type, with very full, soft, and abundant curves. Her bust is large, the hips and thighs are wide and rounded, the buttocks are full, and the figure looks lush and generously curvy.",
    "Chubby": "Body type: chubby body type, with a gently rounded, mildly plump frame. Her cheeks, arms, belly, and thighs are soft, the waist is lightly defined, and the overall figure looks cuddly and softly padded.",
    "Slim-Thick": "Body type: slim-thick body type, with a slim upper body, narrow waist, and flat stomach contrasted by wide hips, full thighs, and round buttocks. The silhouette looks lean on top and thick and curvy below.",
    "Lollipop": "Body type: lollipop body type, with a large, full bust and broad upper body on top of slim hips and thin legs. The top-heavy proportions resemble a lollipop, with the upper body clearly the focal point.",
    "Column": "Body type: column body type, with a tall, narrow, straight frame where the shoulders, waist, and hips are nearly equal and slim. The waist is barely defined, the limbs are long, and the silhouette looks elongated like a ruler.",
    "Round": "Body type: round body type, with a full bust and a fuller midsection that form the widest part of the frame. Her shoulders are rounded, the waist is soft and undefined, and the legs are comparatively slim, giving an O-shaped silhouette.",
    "Triangle Hourglass": "Body type: triangle hourglass body type, blending pear and hourglass traits. Her waist is clearly defined, the bust is moderate, and the hips and thighs are noticeably wider and fuller, giving a curvy, bottom-weighted figure-eight silhouette.",
    "Skittle": "Body type: skittle body type, with a slim, narrow upper body and waist above very full, rounded thighs and hips. The fullest point sits at the upper thighs, giving a silhouette shaped like a skittle pin.",
    "Cello": "Body type: cello body type, an hourglass with extra curvature in the lower body. Her waist is narrow, the bust is full, and the hips, buttocks, and thighs flare generously, giving a rounded shape like the body of a cello.",
    "Long Torso": "Body type: long torso body type, with a lengthy upper body and comparatively short legs. Her waist sits low, the midsection is elongated, and the legs appear shorter, giving a low-waisted proportion.",
    "Long Legs": "Body type: long legs body type, with a short torso and notably long legs. Her waist sits high, the upper body is compact, and the legs make up most of her height, giving a leggy, elongated lower half.",
    "Broad-Shouldered": "Body type: broad-shouldered body type, with wide, strong shoulders and a well-developed upper back like a swimmer's build. Her torso tapers to a narrower waist and hips, and the arms are toned, giving a V-shaped silhouette.",
    "Wide Hips": "Body type: wide hips body type, with notably broad, rounded hips that are the defining feature of the frame. Her waist is defined, the thighs are full, and the pelvis flares outward, giving a strong, curvy lower silhouette.",
    "Small Bust": "Body type: small bust body type, with a flat to petite chest and a lean, streamlined upper body. Her shoulders are narrow to average, the waist and hips may be defined, and the silhouette looks sleek and minimal on top.",
}


class MBBodyType(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesBodyType",
            display_name="Body Type (MB)",
            category="MBNodes",
            inputs=[
                io.Combo.Input("body_type", options=list(BODY_TYPES), default="Hourglass"),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
            ],
            outputs=[
                io.String.Output("prompt"),
            ],
        )

    @classmethod
    def execute(cls, body_type, weight) -> io.NodeOutput:
        return io.NodeOutput(weighted(BODY_TYPES[body_type], weight))


NODES = [MBBodyType]
