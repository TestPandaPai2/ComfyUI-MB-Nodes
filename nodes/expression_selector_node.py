"""Expression picker: category dropdown with its expression dropdown (or a
seeded-random expression from that category), outputs the full description."""

import random

from comfy_api.latest import io

from .bodycon_randomizer_node import MAX_SEED, weighted

EXPRESSIONS = {
    "Playful / Quirky": {
        "Scrunched Snarl": "She scrunches her nose and bares her teeth in an exaggerated, playful snarl, eyes narrowed in mock annoyance.",
        "Tongue Out": "She sticks her tongue out at the camera with a cheeky grin, head tilted slightly.",
        "Fish Lips": "She sucks in her cheeks into a goofy fish face, eyes wide and staring straight at the camera.",
        "Wink and Tongue": "She winks with her tongue poking out between a big smile, one hand raised beside her ear.",
        "Peace Sign Over Eye": "She holds a sideways peace sign over one eye with her arm raised high, lips pursed in a playful pout.",
        "Tongue Peek Grin": "She smiles widely with the tip of her tongue peeking out between her teeth, eyes squeezed half shut.",
        "Strap Tug Pout": "She grips her top's neckline with both fists, glancing sideways with puffed, pouty lips.",
    },
    "Flirty": {
        "Blowing a Kiss": "She closes her eyes and blows a kiss toward the camera, palm held up flat beneath her pursed lips.",
        "Fingertip Kiss": "She presses her fingertips to her pursed lips with eyes softly closed, as if sending a kiss.",
        "Playful Wink": "She winks at the camera with a small, knowing smile, one hand tucked behind her neck.",
        "Lip Bite": "She gently bites her lower lip with a teasing gaze directed straight at the camera.",
        "Finger to Lips": "She rests one fingertip against her lower lip, looking at the camera with a coy, curious expression.",
        "Sunglasses Peek": "She lowers her small dark sunglasses down her nose, peering over them with a sultry pout.",
        "Hand-Over-Mouth Pout": "She covers her pursed lips with her fingers while wearing sunglasses, eyes looking up mischievously.",
        "Over-the-Shoulder Glance": "She turns her back slightly and glances over her bare shoulder with a soft, alluring look.",
    },
    "Happy / Joyful": {
        "Big Bright Smile": "She beams a wide, toothy smile straight at the camera, head tilted with genuine happiness.",
        "Laughing Look Away": "She laughs openly while looking off to the side, eyes crinkled with delight.",
        "Eyes-Closed Smile": "She smiles warmly with her eyes closed, both arms raised behind her head in a relaxed stretch.",
        "Wink and Grin": "She winks with a big, cheerful grin, shoulders raised playfully.",
        "Hands-on-Hips Smile": "She stands with both hands on her hips, smiling confidently at the camera.",
    },
    "Dreamy / Soft": {
        "Hand Pillow": "She rests her cheek against her folded hands as if sleeping on a pillow, gazing softly at the camera.",
        "Sleepy Head Rest": "She rests her head on her hand with her eyes closed and a gentle, contented smile.",
        "Neck Caress Gaze Up": "She tilts her chin upward with eyes half closed, fingertips lightly touching her neck.",
        "Arms Behind Head Dreamy": "She raises both arms behind her head, smiling softly as she looks off into the distance.",
        "Tilted Head Softness": "She tilts her head to one side with relaxed lips and a calm, gentle gaze.",
    },
    "Thoughtful / Pensive": {
        "Chin on Fist": "She rests her chin on her loosely curled fist, looking directly at the camera with quiet thoughtfulness.",
        "Chin on Hand Tilt": "She props her chin on her hand and tilts her head, gazing at the camera with a calm, contemplative look.",
        "Looking Off to the Side": "She turns her face in profile and gazes off to the side, hand resting lightly on her collarbone.",
        "Upward Glance": "She rolls her eyes upward toward the corner of the frame, lips parted, both hands in her hair.",
        "Hand on Collarbone": "She touches her collarbone with her fingertips, looking at the camera with a serene, steady gaze.",
    },
    "Shy / Coy": {
        "Hands on Cheeks": "She cups both cheeks with her hands, looking at the camera with a sweet, bashful expression.",
        "Self Hug": "She wraps her arms across her body in a gentle self-hug, gazing shyly at the camera.",
        "Arm Cross Shy Look": "She crosses one arm over her chest to hold her shoulder, glancing sideways shyly.",
        "Shoulder Tuck Smile": "She tucks her chin toward her raised shoulder with a small, shy smile.",
        "Finger Bite Smile": "She bites lightly on her fingertip with a sheepish smile, looking at the camera.",
    },
    "Surprised": {
        "Shocked Gasp": "She opens her mouth wide and widens her eyes in exaggerated surprise.",
        "Open-Mouth Wow": "She drops her jaw slightly with raised eyebrows, staring at the camera in disbelief.",
    },
    "Pouty / Sulky": {
        "Duck Lips Pout": "She pushes her lips forward into an exaggerated pout, eyes looking straight at the camera.",
        "Side-Eye Pout": "She pouts with her lips while glancing sideways out of the corner of her eye.",
        "Bored Cheek Lean": "She leans her cheek into her hand with a flat, unimpressed look.",
    },
    "Confident / Fierce": {
        "Hands in Hair Stare": "She runs both hands through her hair with her elbows up, staring intensely at the camera.",
        "Arms Overhead Stretch": "She raises both arms high above her head, chin lifted with a cool, confident look.",
        "Hand Reach to Camera": "She reaches one hand toward the lens with fingers curled, giving the camera a bold, intense gaze.",
        "Hand on Head Pose": "She places one hand on top of her head with her elbow raised high, looking straight ahead with poise.",
        "Hair Toss": "She tosses her head to the side, hair swinging, with a fierce, playful expression.",
    },
    "Cool / Edgy": {
        "Sunglasses Stare": "She wears small dark sunglasses low on her face, staring forward with a flat, cool expression.",
        "Head Tilt Smirk": "She tilts her head back with a slight smirk, eyes half lidded with confidence.",
        "Crossed Arms Glance": "She crosses her arms over her chest and glances sideways with a detached, cool look.",
    },
}


class MBExpressionSelector(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesExpressionSelector",
            display_name="Expression Selector (MB)",
            category="MBNodes",
            description="Pick a facial expression by category, or a seeded-random one from that category; outputs its prompt.",
            search_aliases=["expression", "face", "emotion", "mood"],
            inputs=[
                io.DynamicCombo.Input("category", options=[
                    io.DynamicCombo.Option(name, [io.Combo.Input("expression", options=list(expressions), tooltip="Expression used when randomize is off.")])
                    for name, expressions in EXPRESSIONS.items()
                ]),
                io.Boolean.Input("randomize", default=False, tooltip="Pick an expression from the selected category using the seed instead of the expression widget."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
            ],
            outputs=[io.String.Output("prompt")],
        )

    @classmethod
    def execute(cls, category, randomize, seed, weight) -> io.NodeOutput:
        expressions = EXPRESSIONS[category["category"]]
        name = random.Random(seed).choice(list(expressions)) if randomize else category["expression"]
        return io.NodeOutput(weighted(expressions[name], weight))


NODES = [MBExpressionSelector]
