"""Body Modification Prompt picker: one combo of body types, outputs that type's edit prompt."""

from comfy_api.latest import io

BODY_TYPES = {
    "Hourglass": "Modify the subject's body to a classic hourglass shape, with shoulders and hips of nearly equal width, a clearly narrowed waist about 25-30% smaller than the hips, smooth curves from bust to waist to hips, and proportionate, naturally toned limbs.",
    "Exaggerated hourglass": "Modify the subject's body to a pronounced hourglass shape, with a very small, cinched waist, noticeably wide hips, and rounded shoulders and bust, creating a dramatic contrast between the waist and the upper and lower body while keeping the proportions realistic.",
    "Top hourglass": "Modify the subject's body to a top-heavy hourglass shape, with a fuller bust and rounded shoulders, a clearly defined narrow waist, and hips slightly narrower than the upper body, with slim, balanced legs.",
    "Bottom hourglass": "Modify the subject's body to a bottom-heavy hourglass shape, with a smaller, delicate upper body, a defined narrow waist, and fuller, rounded hips and thighs that are slightly wider than the shoulders.",
    "Pear (triangle)": "Modify the subject's body to a pear shape, with narrow, sloping shoulders, a small bust, a slim defined waist, and hips and thighs that are noticeably wider than the upper body, tapering to slender calves.",
    "Inverted triangle": "Modify the subject's body to an inverted triangle shape, with broad, squared shoulders, a fuller upper back and chest, a straight narrow torso, and slim hips and long, slender legs.",
    "Rectangle (straight)": "Modify the subject's body to a rectangle shape, with shoulders, waist, and hips of similar width, a straight and balanced torso with subtle waist definition, and evenly proportioned arms and legs.",
    "Apple (round)": "Modify the subject's body to an apple shape, with a fuller, rounded midsection and bust, softly rounded shoulders, a less defined waist, and comparatively slim hips and shapely, slender legs.",
    "Spoon": "Modify the subject's body to a spoon shape, with a defined waist and hips that curve outward into a pronounced shelf-like fullness, a smaller bust, and thighs that continue the wide lower silhouette.",
    "Diamond": "Modify the subject's body to a diamond shape, with narrow shoulders, a fuller midsection and hips as the widest points, a modest bust, and slim legs tapering toward the knees.",
    "Oval": "Modify the subject's body to an oval shape, with a soft, rounded torso as the widest area, gentle curves along the hips and bust, softly rounded arms, and a smooth, continuous silhouette.",
    "Athletic": "Modify the subject's body to an athletic build, with toned shoulders and arms, a firm flat core with subtle abdominal definition, strong defined legs, and an upright, confident posture.",
    "Petite": "Modify the subject's body to a petite build, with a short, small frame, delicate shoulders and wrists, a compact torso, slim limbs, and balanced miniature proportions overall.",
    "Tall and lean": "Modify the subject's body to a tall, lean build, with an elongated frame, long slender arms and legs, narrow shoulders and hips, a slim torso, and a graceful, willowy silhouette.",
    "Curvy": "Modify the subject's body to a curvy build, with soft, pronounced curves through the bust and hips, a defined waist, and smoothly rounded thighs and arms in a balanced, feminine silhouette.",
    "Voluptuous": "Modify the subject's body to a voluptuous build, with a full bust, full rounded hips and thighs, a softly defined waist, and generous but harmonious proportions with smooth, natural contours.",
    "Busty": "Modify the subject's body to have a noticeably fuller bust, balanced by proportionate shoulders, a defined waist, and moderate hips, so the overall silhouette stays natural and harmonious.",
    "Full-figured": "Modify the subject's body to a full-figured build, with generous, softly rounded proportions throughout, including a fuller bust, midsection, hips, and thighs, with curves distributed evenly and a gentle, natural look.",
    "Banana": "Modify the subject's body to a banana shape, with a long, straight, even silhouette, shoulders and hips of matching width, minimal waist definition, a small to moderate bust, and slim, streamlined limbs.",
    "Muscular": "Modify the subject's body to a muscular build, with visibly developed shoulders, defined biceps and triceps, a strong back, a firm core, and powerful, sculpted quads and calves, while keeping a feminine silhouette.",
    "Slim-thick": "Modify the subject's body to a slim-thick build, with a slim torso, narrow waist, and slender arms, contrasted by fuller, rounded hips and thicker, shapely thighs.",
    "Long-torso, short-leg build": "Modify the subject's body to have a visibly longer torso and a higher waistline, with proportionally shorter legs, while keeping the shoulders, hips, and overall frame balanced.",
    "Short-torso, long-leg build": "Modify the subject's body to have a shorter torso and a lower waistline, with proportionally long, elongated legs, while keeping the shoulders, hips, and overall frame balanced.",
    "Column": "Modify the subject's body to a column shape, with a straight, streamlined, vertical silhouette, narrow shoulders and hips of similar width, minimal waist definition, and long, slim lines from shoulders to ankles.",
    "Petite hourglass": "Modify the subject's body to a petite hourglass, with a short, small frame, a delicate bust and hips of matching width, and a clearly defined, narrow waist on a compact torso.",
    "Petite pear": "Modify the subject's body to a petite pear shape, with a small frame, narrow, delicate shoulders, a slim waist, and slightly wider hips and thighs on short, slender legs.",
    "Tall hourglass": "Modify the subject's body to a tall hourglass, with an elongated frame, long legs, balanced shoulders and hips, and a defined narrow waist with smooth, flowing curves.",
    "Tall pear": "Modify the subject's body to a tall pear shape, with a slender, narrow upper body, a defined waist, wider hips and thighs, and long, elegant legs.",
    "Lean athletic": "Modify the subject's body to a lean athletic build, with low body fat, light but visible muscle definition in the shoulders, arms, and legs, a flat toned stomach, and a streamlined, agile frame.",
    "Swimmer's build": "Modify the subject's body to a swimmer's build, with broad shoulders, a strong, wide back, defined arms, a long, lean torso, narrow hips, and long, toned legs.",
    "Dancer's build": "Modify the subject's body to a dancer's build, with a long, toned frame, a lengthened neck, gently defined shoulders, a slim waist, strong lean legs, and elegant, upright posture.",
    "Soft curvy": "Modify the subject's body to a soft, curvy build, with gentle, rounded curves at the bust, waist, and hips, softly padded arms and thighs, and a smooth, flowing silhouette.",
    "Pear with narrow shoulders": "Modify the subject's body to a pear shape, with noticeably narrow, sloping shoulders, a slim upper body, a defined waist, and wide hips and full thighs that dominate the lower silhouette.",
    "Full-bust rectangle": "Modify the subject's body to a rectangle shape, with a fuller bust, a straight, minimally defined waist, and hips of similar width to the shoulders, with a balanced, streamlined lower body.",
    "Full-bust pear": "Modify the subject's body to a pear shape, with a fuller bust, a defined waist, and wider hips and thighs, so the upper and lower body feel proportionate and curvy.",
    "Small-bust hourglass": "Modify the subject's body to an hourglass shape, with a smaller, delicate bust, a clearly defined narrow waist, and fuller, rounded hips and thighs.",
    "Broad-shouldered": "Modify the subject's body to have broad, prominent shoulders and a strong collarbone line, with a proportionate waist and hips, and balanced arms and legs.",
    "Narrow-framed": "Modify the subject's body to a narrow frame, with slim shoulders, a slim ribcage and torso, narrow hips, and slender arms and legs, creating a lightweight, delicate silhouette.",
    "Heart-shaped": "Modify the subject's body to a heart shape, with a fuller bust and wider shoulders, a defined waist, and hips that taper narrower, with slender legs below.",
    "Straight-curvy hybrid": "Modify the subject's body to a hybrid build, with a mostly straight, moderately defined torso and soft, rounded curves through the hips and thighs, and a balanced, natural overall look.",
}


class MBBodyModPrompt(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesBodyModPrompt",
            display_name="Body Modification Prompt (MB)",
            category="MBNodes",
            description="Pick a body type; outputs its body modification prompt.",
            search_aliases=["body", "body type", "body shape", "body modification"],
            inputs=[
                io.Combo.Input("types", options=list(BODY_TYPES), default="Hourglass"),
            ],
            outputs=[
                io.String.Output("prompt"),
            ],
        )

    @classmethod
    def execute(cls, types) -> io.NodeOutput:
        return io.NodeOutput(BODY_TYPES[types])


NODES = [MBBodyModPrompt]
