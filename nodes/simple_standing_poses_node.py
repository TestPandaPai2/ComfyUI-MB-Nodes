"""Simple standing pose picker: one dropdown (or a seeded-random pose), outputs
the full pose description."""

import random

from comfy_api.latest import io

from .common import MAX_SEED, weighted


POSES = {
    "Relaxed Front Stand": "She stands facing the viewer with her feet hip-width apart and her weight evenly balanced, one arm hanging loosely at her side and the other hand tucked lightly near her hip, shoulders relaxed and chin level as she gazes ahead with a calm, natural expression.",
    "Three-Quarter Hair Glance": "She stands angled three-quarters away from the viewer with her weight resting on her back leg and the front knee softly bent, turning her head back over her shoulder so her long, wavy hair spills across one side, giving a soft, easy glance.",
    "Side Profile Walk-Away": "She stands in clean side profile caught mid-step, one foot planted ahead of the other with the heel of the back foot slightly lifted, her arms hanging relaxed and her gaze fixed straight ahead as if about to walk out of frame.",
    "Back View Stand": "She stands facing completely away from the viewer with her feet close together and her arms resting naturally at her sides, her posture straight and her long hair falling smoothly down the center of her back.",
    "Hands-in-Pockets Front Stand": "She stands facing forward with both hands slipped casually into the front pockets of her jeans, elbows bent outward, her weight shifted slightly onto one hip as she looks at the viewer with relaxed confidence.",
    "Hand-Behind-Head Cross-Leg": "She stands with one arm lifted and bent so her hand rests behind her head, the other hand placed on her hip, one leg crossing lightly in front of the other with the toe touching the floor, her head tilted in a breezy, playful pose.",
    "Hip-Hand Knee Pop": "She stands with one hand resting on her hip and the other arm relaxed, her weight on one straight leg while the other knee bends outward and the foot lifts off the floor behind her, giving a cheerful, carefree feel.",
    "Hands-on-Hips Front Stand": "She stands squarely facing the viewer with both hands planted firmly on her hips, elbows angled out wide and feet set shoulder-width apart, her chest open and chin raised in a bold, self-assured stance.",
    "Both Hands Behind Head": "She stands facing forward with both arms raised and bent so her hands meet behind her head, elbows spread wide, her weight shifted onto one hip and one knee softly bent, looking relaxed as if stretching after a long day.",
    "Over-the-Shoulder Side Turn": "She stands turned mostly sideways with her back partly toward the viewer, both hands resting near her hips, twisting her neck to glance back over her shoulder with a soft, curious expression.",
    "Arm-Across Body Turn": "She stands three-quarters toward the viewer with one arm folded across her waist to hold the opposite elbow, the other forearm raised near her shoulder, her head tilted gently and her stance slightly closed in a thoughtful, modest pose.",
    "Hand-on-Head Back Glance": "She stands facing mostly away from the viewer with one arm lifted so her hand rests on the top of her head, her weight on one leg, turning her face back toward the camera with a relaxed, easy look.",
    "Back Three-Quarter Look Down": "She stands facing away at a three-quarter angle with her shoulders slightly rounded, her head turned to the side and her eyes lowered toward the floor, arms hanging loosely in a quiet, reflective moment.",
    "Hip-Hand Front Lean": "She stands facing forward with one hand resting on her hip and the other arm relaxed by her side, her weight shifted onto one leg so her hips tilt gently while the other knee bends inward, looking casual and approachable.",
    "Crossed-Ankle Stand": "She stands facing forward with one foot crossed neatly in front of the other at the ankle, her arms relaxed at her sides and her shoulders soft, creating a light, graceful line from head to toe.",
    "Hair-Touch Wide Stand": "She stands with her feet set apart and her weight evenly spread, one hand lifted to run through the side of her hair and the other resting on her thigh, her head tilted slightly with a relaxed, confident expression.",
    "Hand-to-Cheek Pose": "She stands angled slightly toward the viewer with one hand raised so her fingertips rest lightly against her cheek, the other arm hanging loosely, her head tipped to one side with a sweet, gentle smile.",
    "Arms-Folded Front Stand": "She stands facing forward with her arms loosely folded across her waist, one hand tucked under the opposite elbow, her weight resting on one leg and her expression calm and patient.",
    "Twisting Side Glance": "She stands angled sideways with her lower body turned away and her torso twisting back toward the viewer, one hand resting at her waist, looking over her shoulder with a bright, engaged expression.",
    "Hands Clasped at Chest": "She stands three-quarters toward the viewer with both hands gathered together near her chest, her shoulders lifted slightly and her knees close together, giving a shy, sweet, slightly bashful impression.",
    "Crossed-Leg Hip Rest": "She stands with one leg crossed in front of the other and her weight on the back foot, one hand resting on her hip and the other arm relaxed at her side, her head held high in a poised, easygoing pose.",
    "Hair-Touch Three-Quarter Turn": "She stands angled three-quarters toward the viewer with her shoulders turned slightly away, one hand lifted to the side of her head with her fingertips resting in her hair and the other arm relaxed at her side, gazing at the camera with a soft, dreamy expression.",
    "Straight-On Neutral Stand": "She stands facing the viewer directly with her feet close together and her weight evenly balanced, both arms hanging naturally at her sides, her chin level and her expression calm, direct, and composed.",
    "Laughing Side Glance": "She stands angled slightly away with one hand tucked behind her back at the waist and the other arm relaxed, turning her head to look off to the side with a wide, joyful laugh as if reacting to someone out of frame.",
    "Hand-on-Hip Head Tilt": "She stands three-quarters toward the viewer with one hand resting lightly on her hip and the other arm hanging loosely, her head tipped to one side and her eyes meeting the camera with a quiet, self-assured look.",
    "Full-Length Crossed-Step Stand": "She stands facing forward in a full-length view with one foot stepping across in front of the other, both hands resting lightly against the front of her thighs, her posture tall and balanced like a model pausing on a runway.",
    "Flamingo Knee-Lift Pose": "She stands on one straight leg while the other knee bends and lifts across in front of her, one hand resting on her raised knee and the other near her hip, tilting her head with a playful, cheeky smile.",
    "Bashful Hands-Together Stand": "She stands facing forward with her shoulders slightly raised and both hands loosely clasped in front of her, her knees drawn gently together and her head tilted with a sweet, shy smile.",
    "Over-the-Shoulder Back Turn": "She stands with her back partly turned to the viewer, her long hair falling down one shoulder, one hand resting near her hip and the other arm hanging relaxed, glancing back over her shoulder with a calm, steady gaze.",
    "Confident Hand-on-Hip Smile": "She stands facing the viewer with her weight shifted onto one hip, one hand planted firmly on her waist and the other arm relaxed at her side, beaming a bright, confident smile straight at the camera.",
    "Collar-Pop Power Stand": "She stands facing the viewer with her feet planted wide, both hands gripping and lifting the collar of her jacket up around her jaw, chin dipped slightly and eyes locked on the camera with a cool, defiant look.",
    "Sleeve-Tug Shy Stand": "She stands with her knees touching and her toes turned slightly inward, both hands tugging the ends of her sleeves down over her fingers, shoulders hunched a little as she peeks up at the viewer with a timid smile.",
    "Wind-Caught Hair Hold": "She stands three-quarters to the viewer with her weight on her back leg, one hand pressed to the top of her head to keep her hair from blowing away while loose strands whip across her face, laughing with her eyes half closed.",
    "Elbow-Up Neck Stretch": "She stands facing forward with one arm raised and bent over her head so her hand grips the opposite elbow, her torso leaning gently to one side in a long stretch, her chin lifted and eyes soft.",
    "Hands-Framing-Face Stand": "She stands facing the viewer with both hands raised and her palms resting softly along her jaw, fingers fanned around her cheeks like a frame, her elbows tucked close and her head tilted with a sweet, playful look.",
    "Tiptoe Reach Up": "She stands balanced high on her tiptoes with both arms stretched straight up overhead, fingers reaching toward the sky, her whole body drawn into one long, lifted line as she looks upward.",
    "Jacket-Over-Shoulder Stand": "She stands three-quarters to the viewer with her weight on one hip, a jacket hooked on one finger and slung back over her shoulder, the other hand tucked into her pocket, giving the camera a relaxed, knowing smirk.",
    "Heel-Pop Kiss Blow": "She stands facing the viewer with one heel kicked up behind her, leaning forward slightly as she lifts her palm to her lips and blows a kiss toward the camera with a flirtatious wink.",
    "Back-Arched Sky Gaze": "She stands with her feet together and her hands resting at the small of her back, arching gently backward with her chest lifted and her face tipped up toward the sky, eyes closed as if soaking in the sun.",
    "Arms-Wide Open Stand": "She stands facing the viewer with her arms flung wide open to either side, palms up and fingers spread, her chest open and head tipped back slightly with a joyful, free expression.",
    "Hugging-Self Stand": "She stands three-quarters to the viewer with both arms wrapped around herself, hands resting on the opposite shoulders, her head tilted down to one side and her eyes softly closed in a cozy, comforting pose.",
    "Strap-Adjust Glance": "She stands angled sideways with one hand lifting the strap of her bag on her shoulder and the other hand tucking her hair behind her ear, glancing at the viewer from the corner of her eye mid-movement.",
    "Hat-Brim Tilt": "She stands facing the viewer with one hand gripping the brim of her hat and tilting it down over one eye, the other hand resting on her hip, a sly smile playing on her lips beneath the shadow.",
    "Peeking-Through-Fingers Stand": "She stands with her feet close together, both hands raised over her face with her fingers spread just enough to peek through at the viewer, her shoulders lifted in a playful, giggling pose.",
    "Contrapposto Statue Stand": "She stands in classic contrapposto, her weight resting fully on one straight leg so her hips tilt and her shoulders slope the opposite way, one arm relaxed at her side and the other bent lightly at her waist, like a marble statue.",
    "Walking-Toward Stride Freeze": "She stands caught mid-stride walking straight toward the viewer, one foot stepping forward on its heel, arms swinging naturally in opposition, her hair bouncing and her gaze fixed confidently ahead.",
    "Finger-on-Lips Secret": "She stands three-quarters to the viewer, leaning in slightly with one finger pressed to her lips as if keeping a secret, the other hand behind her back, her eyes sparkling with mischief.",
    "Crossed-Wrists Overhead": "She stands facing the viewer with both arms raised overhead and her wrists crossed above her head, her weight shifted onto one hip and her chin lowered, giving the camera a smoldering, dramatic gaze.",
    "Shoulder-Shrug Laugh": "She stands facing the viewer with both shoulders lifted high in an exaggerated shrug, palms turned up at her sides, mouth open in a bright, unguarded laugh as if caught being silly.",
    "Cross-Body Shoulder Hold": "She stands angled sideways with one arm reaching across her chest to rest her hand on the opposite shoulder, her chin tucked down toward that hand as she gazes at the viewer from under her lashes.",
    "Ballet Fifth Position": "She stands tall in ballet fifth position with her heels and toes tucked together, her arms curved softly in a rounded oval above her head, her neck long and expression serene and poised.",
    "Hands-in-Hair Lift": "She stands facing the viewer with both hands buried in her hair, lifting it up off her neck and piling it on top of her head, her elbows high and her eyes half closed as if cooling down on a hot day.",
    "One-Shoulder Back Peek": "She stands with her back to the viewer and one shoulder dropped, the strap of her top slipping slightly, as she turns her head just enough to peek back over the bare shoulder with a coy look.",
    "Thumbs-Hooked Belt Stand": "She stands facing the viewer with her feet apart and both thumbs hooked into the front of her belt, her fingers resting on her hips and her weight settled back, looking at the camera with easy, cowgirl confidence.",
    "Mid-Spin Skirt Flare": "She stands caught mid-turn on the balls of her feet, her skirt flaring out around her legs, one arm lifted gracefully and the other trailing behind, her head turned back toward the viewer with a bright smile.",
    "Sunglasses-Down Stare": "She stands facing the viewer with her head tipped forward slightly, one finger sliding her sunglasses down her nose so her eyes peer over the top of the frames at the camera with a bold, unimpressed stare.",
    "Knee-Bent Lean Back": "She stands leaning back with her shoulders behind her hips, one knee bent and the foot turned out, both arms hanging loosely behind her, her head tipped back with a carefree, laid-back attitude.",
    "Earring Adjust Profile": "She stands in side profile with her head tilted toward one shoulder, one hand raised to adjust her earring, her eyes cast down toward her hand in a quiet, elegant getting-ready moment.",
    "Bouquet-Behind-Back Stand": "She stands facing the viewer with both hands hidden behind her back as if holding a surprise, her shoulders rolled back and one foot twisting on its toe, swaying slightly with a sweet, expectant smile.",
    "Fierce Runway Pause": "She stands at the end of an imaginary runway with her feet in a narrow, crossed step, one hand resting on her hip and the other swinging to a stop, her shoulders squared and face set in a fierce, unsmiling stare.",
}

# Same poses framed from the chest up: only what stays in frame is described.
CLOSEUPS = {
    "Relaxed Front Stand": "Close-up shot from the chest up. She faces the viewer with her shoulders relaxed and level, chin straight, one hand resting lightly near her waist just at the edge of the frame, gazing ahead with a calm, natural expression.",
    "Three-Quarter Hair Glance": "Close-up shot from the chest up. She is angled three-quarters away from the viewer, turning her head back over her shoulder so her long, wavy hair spills across one side of her face, giving a soft, easy glance.",
    "Side Profile Walk-Away": "Close-up shot from the chest up. She is in clean side profile, shoulders relaxed and slightly forward as if mid-step, her gaze fixed straight ahead toward the edge of the frame.",
    "Back View Stand": "Close-up shot from the shoulders up, seen from behind. She faces completely away from the viewer, her posture straight and her long hair falling smoothly down the center of her back.",
    "Hands-in-Pockets Front Stand": "Close-up shot from the chest up. She faces forward with her shoulders slightly dropped and elbows angled outward as if her hands are tucked in her pockets, looking at the viewer with relaxed confidence.",
    "Hand-Behind-Head Cross-Leg": "Close-up shot from the chest up. One arm is lifted and bent so her hand rests behind her head, elbow framing her face, her head tilted in a breezy, playful pose.",
    "Hip-Hand Knee Pop": "Close-up shot from the chest up. Her shoulders tilt slightly as she shifts her weight, head tipped with a cheerful, carefree smile directed at the viewer.",
    "Hands-on-Hips Front Stand": "Close-up shot from the chest up. She faces the viewer squarely, elbows angled out wide at the edges of the frame, chest open and chin raised in a bold, self-assured look.",
    "Both Hands Behind Head": "Close-up shot from the chest up. She faces forward with both arms raised and bent so her hands meet behind her head, elbows spread wide around her face, looking relaxed as if stretching after a long day.",
    "Over-the-Shoulder Side Turn": "Close-up shot from the shoulders up. She is turned mostly sideways with her back partly toward the viewer, twisting her neck to glance back over her shoulder with a soft, curious expression.",
    "Arm-Across Body Turn": "Close-up shot from the chest up. She is three-quarters toward the viewer with one arm folded across her body and the other forearm raised near her shoulder, her head tilted gently in a thoughtful, modest pose.",
    "Hand-on-Head Back Glance": "Close-up shot from the shoulders up. She faces mostly away with one hand resting on the top of her head, turning her face back toward the camera with a relaxed, easy look.",
    "Back Three-Quarter Look Down": "Close-up shot from the shoulders up. She faces away at a three-quarter angle with her shoulders slightly rounded, her head turned to the side and her eyes lowered in a quiet, reflective moment.",
    "Hip-Hand Front Lean": "Close-up shot from the chest up. She faces forward with her shoulders tilted gently as her weight shifts to one side, her expression casual and approachable.",
    "Crossed-Ankle Stand": "Close-up shot from the chest up. She faces forward with soft, relaxed shoulders and a graceful, upright neck, her expression light and poised.",
    "Hair-Touch Wide Stand": "Close-up shot from the chest up. One hand is lifted to run through the side of her hair, her head tilted slightly with a relaxed, confident expression.",
    "Hand-to-Cheek Pose": "Close-up shot from the chest up. She is angled slightly toward the viewer with her fingertips resting lightly against her cheek, her head tipped to one side with a sweet, gentle smile.",
    "Arms-Folded Front Stand": "Close-up shot from the chest up. She faces forward with her arms loosely folded across her body, one hand tucked under the opposite elbow, her expression calm and patient.",
    "Twisting Side Glance": "Close-up shot from the chest up. Her shoulders are angled sideways as her torso twists back toward the viewer, looking over her shoulder with a bright, engaged expression.",
    "Hands Clasped at Chest": "Close-up shot from the chest up. She is three-quarters toward the viewer with both hands gathered together near her chest, shoulders lifted slightly, giving a shy, sweet, slightly bashful impression.",
    "Crossed-Leg Hip Rest": "Close-up shot from the chest up. She holds her head high with relaxed shoulders, her posture poised and easygoing as she looks at the viewer.",
    "Hair-Touch Three-Quarter Turn": "Close-up shot from the chest up. She is angled three-quarters toward the viewer with her shoulders turned slightly away, fingertips resting in her hair at the side of her head, gazing at the camera with a soft, dreamy expression.",
    "Straight-On Neutral Stand": "Close-up shot from the chest up. She faces the viewer directly with level shoulders and chin, her expression calm, direct, and composed.",
    "Laughing Side Glance": "Close-up shot from the chest up. She is angled slightly away, turning her head to look off to the side with a wide, joyful laugh as if reacting to someone out of frame.",
    "Hand-on-Hip Head Tilt": "Close-up shot from the chest up. She is three-quarters toward the viewer, her head tipped to one side and her eyes meeting the camera with a quiet, self-assured look.",
    "Full-Length Crossed-Step Stand": "Close-up shot from the chest up. She faces forward with a tall, balanced posture and squared shoulders, like a model pausing on a runway, meeting the viewer's eyes.",
    "Flamingo Knee-Lift Pose": "Close-up shot from the chest up. Her shoulders tilt playfully as she balances, head tilted with a playful, cheeky smile.",
    "Bashful Hands-Together Stand": "Close-up shot from the chest up. She faces forward with her shoulders slightly raised and drawn in, head tilted with a sweet, shy smile.",
    "Over-the-Shoulder Back Turn": "Close-up shot from the shoulders up. Her back is partly turned to the viewer, long hair falling down one shoulder, glancing back over her shoulder with a calm, steady gaze.",
    "Confident Hand-on-Hip Smile": "Close-up shot from the chest up. She faces the viewer with her shoulders tilted as her weight shifts onto one hip, beaming a bright, confident smile straight at the camera.",
    "Collar-Pop Power Stand": "Close-up shot from the chest up. Both hands grip and lift the collar of her jacket up around her jaw, chin dipped slightly and eyes locked on the camera with a cool, defiant look.",
    "Sleeve-Tug Shy Stand": "Close-up shot from the chest up. Her shoulders are hunched a little and her sleeve-covered hands are drawn up near her chin as she peeks up at the viewer with a timid smile.",
    "Wind-Caught Hair Hold": "Close-up shot from the chest up. She is three-quarters to the viewer with one hand pressed to the top of her head, loose strands of hair whipping across her face as she laughs with her eyes half closed.",
    "Elbow-Up Neck Stretch": "Close-up shot from the chest up. One arm is raised and bent over her head with her hand gripping the opposite elbow, her neck stretched long, chin lifted and eyes soft.",
    "Hands-Framing-Face Stand": "Close-up shot from the chest up. Both palms rest softly along her jaw with her fingers fanned around her cheeks like a frame, her head tilted with a sweet, playful look.",
    "Tiptoe Reach Up": "Close-up shot from the chest up. Both arms stretch straight up out of the top of the frame, her neck and shoulders lengthened as she looks upward.",
    "Jacket-Over-Shoulder Stand": "Close-up shot from the chest up. A jacket is hooked on one finger and slung back over her shoulder as she gives the camera a relaxed, knowing smirk.",
    "Heel-Pop Kiss Blow": "Close-up shot from the chest up. She leans forward slightly, lifting her palm to her lips and blowing a kiss toward the camera with a flirtatious wink.",
    "Back-Arched Sky Gaze": "Close-up shot from the chest up. Her chest is lifted and her face tipped up toward the sky, eyes closed as if soaking in the sun.",
    "Arms-Wide Open Stand": "Close-up shot from the chest up. Her arms reach wide out of frame on either side, her chest open and head tipped back slightly with a joyful, free expression.",
    "Hugging-Self Stand": "Close-up shot from the chest up. Both arms are wrapped around herself with her hands resting on the opposite shoulders, her head tilted down to one side and eyes softly closed.",
    "Strap-Adjust Glance": "Close-up shot from the chest up. One hand lifts the strap of her bag on her shoulder and the other tucks her hair behind her ear as she glances at the viewer from the corner of her eye.",
    "Hat-Brim Tilt": "Close-up shot from the chest up. One hand grips the brim of her hat and tilts it down over one eye, a sly smile on her lips beneath the shadow.",
    "Peeking-Through-Fingers Stand": "Close-up shot from the chest up. Both hands are raised over her face with her fingers spread just enough to peek through at the viewer, shoulders lifted in a giggling pose.",
    "Contrapposto Statue Stand": "Close-up shot from the chest up. Her shoulders slope gently to one side and her neck is long and relaxed, her calm expression giving her the stillness of a marble statue.",
    "Walking-Toward Stride Freeze": "Close-up shot from the chest up. She moves straight toward the viewer, her hair bouncing with her stride and her gaze fixed confidently ahead.",
    "Finger-on-Lips Secret": "Close-up shot from the chest up. She leans in slightly with one finger pressed to her lips as if keeping a secret, her eyes sparkling with mischief.",
    "Crossed-Wrists Overhead": "Close-up shot from the chest up. Her arms are raised with her wrists crossed above her head, her chin lowered as she gives the camera a smoldering, dramatic gaze.",
    "Shoulder-Shrug Laugh": "Close-up shot from the chest up. Both shoulders are lifted high in an exaggerated shrug, her mouth open in a bright, unguarded laugh.",
    "Cross-Body Shoulder Hold": "Close-up shot from the chest up. One arm reaches across her chest to rest her hand on the opposite shoulder, her chin tucked toward it as she gazes at the viewer from under her lashes.",
    "Ballet Fifth Position": "Close-up shot from the chest up. Her arms curve softly in a rounded oval above her head, her neck long and her expression serene and poised.",
    "Hands-in-Hair Lift": "Close-up shot from the chest up. Both hands are buried in her hair, lifting it off her neck and piling it on top of her head, elbows high and eyes half closed.",
    "One-Shoulder Back Peek": "Close-up shot from the shoulders up, seen from behind. One shoulder is dropped with the strap of her top slipping slightly as she peeks back over the bare shoulder with a coy look.",
    "Thumbs-Hooked Belt Stand": "Close-up shot from the chest up. Her shoulders are settled back and relaxed as she looks at the camera with easy, cowgirl confidence.",
    "Mid-Spin Skirt Flare": "Close-up shot from the chest up. She is caught mid-turn with one arm lifted gracefully and her hair swinging, her head turned back toward the viewer with a bright smile.",
    "Sunglasses-Down Stare": "Close-up shot from the chest up. One finger slides her sunglasses down her nose so her eyes peer over the frames at the camera with a bold, unimpressed stare.",
    "Knee-Bent Lean Back": "Close-up shot from the chest up. Her shoulders lean back and her head is tipped back with a carefree, laid-back attitude.",
    "Earring Adjust Profile": "Close-up shot from the chest up. She is in side profile with her head tilted toward one shoulder, one hand adjusting her earring, eyes cast down in a quiet, elegant moment.",
    "Bouquet-Behind-Back Stand": "Close-up shot from the chest up. Her shoulders are rolled back with both hands hidden behind her as she sways slightly with a sweet, expectant smile.",
    "Fierce Runway Pause": "Close-up shot from the chest up. Her shoulders are squared and her face is set in a fierce, unsmiling stare straight down the lens.",
}


class MBSimpleStandingPoses(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesSimpleStandingPoses",
            display_name="Simple Standing Poses (MB)",
            category="MBNodes",
            inputs=[
                io.Combo.Input("pose", options=list(POSES), tooltip="Pose used when randomize_pose is off."),
                io.Boolean.Input("randomize_pose", default=False, tooltip="Pick a pose using the seed instead of the pose widget."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
                io.Boolean.Input("closeup", default=False, tooltip="Describe the same pose as a chest-up close-up shot."),
            ],
            outputs=[io.String.Output("prompt"), io.String.Output("category")],
        )

    @classmethod
    def execute(cls, pose, randomize_pose, seed, weight, closeup) -> io.NodeOutput:
        if randomize_pose:
            pose = random.Random(seed).choice(list(POSES))
        text = CLOSEUPS[pose] if closeup else POSES[pose]
        return io.NodeOutput(weighted(text, weight), pose)


NODES = [MBSimpleStandingPoses]
