"""Pose picker: category dropdown with its pose dropdown (or a seeded-random pose
from that category), outputs the full pose description."""

import random

from comfy_api.latest import io


def weighted(text, weight):
    return text if weight == 1.0 else f"({text}:{weight:.2f})"

MAX_SEED = 0xFFFFFFFFFFFFFFFF

POSES = {
    "Standing": {
        "Stepping Hands-Behind-Head Pose": "She stands mid-step with both hands lifted behind her head, one leg crossing forward as she walks with a relaxed, confident sway, her chin tilted slightly upward.",
        "Back-View Hand-on-Hip Stand": "She stands facing away with her weight shifted onto one leg, one hand resting on her hip and the other touching the back of her head, as if surveying the view ahead.",
        "Wide-Stance Back View": "She stands facing away with her feet planted wide apart, arms relaxed at her sides, her posture strong and grounded as she looks off into the distance.",
        "Back-View Forward Lean": "She stands facing away and leans forward from the hips, one hand braced on her thigh, glancing back over her shoulder with a curious expression.",
        "Hands-on-Knees Bend": "She bends forward at the waist with both hands pressed on her knees, catching her breath as if she just finished a long run.",
        "Thigh-Rest Lean": "She stands leaning slightly to one side, a hand resting on her thigh and her head tilted, looking down at something with mild interest.",
        "Shy Standing Pose": "She stands with her knees turned slightly inward, one hand raised to her hair and the other held near her chest, her expression shy and hesitant.",
        "Hip-Hand Leg Kick": "She stands with one hand on her hip and one leg kicked up behind her, smiling playfully as if posing for a cheerful photo.",
        "Power Stance Hands Behind Head": "She stands tall with her feet apart and both hands lifted behind her head, chest open and shoulders back, looking bold and self-assured.",
        "Open-Arms Stand": "She stands upright with her arms held slightly away from her body, palms turned outward, as if welcoming someone or presenting herself.",
        "Side-Bend Stretch": "She stands and leans her body to one side, one arm arching over her head, stretching her side in a long, graceful curve.",
        "Forward Reach": "She stands with both arms extended straight out in front of her, leaning slightly forward, as if reaching to catch something or someone.",
        "Balancing Arms Out": "She stands with her arms flung wide to either side, one foot lifted slightly, as if balancing along a narrow ledge.",
        "Back-View Wave": "She stands facing away with one arm raised in a cheerful wave, her weight on one leg as she turns to say goodbye.",
        "Hand-to-Chest Stand": "She stands sideways with a hand pressed gently to her chest, her head bowed slightly, looking touched or deep in thought.",
        "Raised-Knee Stand": "She stands on one leg with the other knee lifted high, arms bent for balance, as if stepping up onto a stair or mid-dance.",
        "Side Profile Stand": "She stands in clean side profile, arms relaxed and posture straight, gazing calmly ahead.",
        "Turning Look-Back": "She stands with her back partly turned, twisting at the waist to look behind her, one hand raised near her shoulder in surprise.",
        "Slim Relaxed Stand": "She stands with her feet close together and arms loose at her sides, her posture light and simple, as if waiting patiently.",
        "Leaning Reach": "She stands leaning forward with one arm extended outward, as if reaching for a door handle or offering a hand to someone.",
        "Thoughtful Bend": "She stands with her shoulders slightly hunched and head lowered, one hand near her face, lost in quiet contemplation.",
        "Shading-Eyes Lookout": "She stands with one hand raised to shade her eyes, the other arm extended, peering far into the distance.",
        "Dance Pose": "She stands mid-dance with her hands raised near her face, hips swaying and knees softly bent, moving to an upbeat rhythm.",
        "Flexing Stand": "She stands tall with her arms bent and fists raised, flexing playfully like she's showing off her strength.",
        "Walking Step": "She walks forward in mid-stride, arms swinging naturally at her sides, moving with easy purpose.",
        "Casual Hip Rest": "She stands with one hand resting loosely on her hip and her weight shifted to one leg, relaxed and casually confident.",
        "Classic Hand-on-Hip Stand": "She stands tall in high-waisted wide-leg trousers with her weight shifted onto one leg, one hand resting on her hip and her chin lifted as she gazes off to the side with effortless confidence.",
        "Hands-in-Pockets Profile Turn": "She stands in a sleek three-quarter turn with both hands slipped into her pockets, her head turned in profile and posture long and elegant like a model between shots.",
        "Hand-in-Hair Crossed Leg": "She stands with one leg crossed lightly in front of the other, a hand running through her hair and her loose shirt slipping casually as she gives the viewer a relaxed, cool look.",
        "Blazer Pockets Power Pose": "She stands squarely with her feet apart and both hands tucked into her pockets beneath an open blazer, her chin raised in a polished, self-assured stance.",
        "Profile Stride with Tote": "She walks in side profile with a long flowing skirt swishing around her legs, a tote bag swinging from one hand as she moves with graceful purpose.",
        "Runway Walk": "She walks straight toward the viewer in a confident runway stride, arms swinging naturally and hair blowing back as if a breeze follows her.",
        "Mid-Stride Look Back": "She takes a long stride forward with one hand in her pocket, turning her head to glance back over her shoulder with a cool, composed expression.",
        "Profile Walk in Blazer": "She walks in side profile with a long purposeful step, one hand tucked in her pocket and her blazer hanging loosely, her ponytail swinging behind her.",
        "Back-View Hands on Hips": "She stands facing away with both hands resting on her hips and her feet planted apart, her head turned slightly to the side as she surveys the scene.",
        "Back-View Over-Shoulder Glance": "She stands facing away with her hands on her hips and weight on one leg, tilting her head to glance back over her shoulder with quiet curiosity.",
        "Back-View Arm Raised": "She stands facing away with one arm lifted to rest on her head and the other hand at her hip, her body forming a graceful S-curve.",
        "Slipping Shirt Look Back": "She stands facing away with an oversized shirt slipping off one shoulder, holding it loosely as she turns her head to look softly back.",
        "Back-View Clasped Hands": "She stands facing away with her hands clasped loosely behind her back and her feet together, her posture calm, poised, and patient.",
        "Wide-Stance Pocket Pose": "She stands with her feet planted wide and her hands tucked into her pockets, leaning back slightly with a casual, laid-back confidence.",
        "Relaxed Contrapposto": "She stands with her weight shifted onto one hip and her arms hanging loosely, one knee softly bent in a natural, easygoing posture.",
        "Sassy Hand on Hip": "She stands with one hand planted firmly on her hip and her other arm relaxed, her stance slightly wide and her head held high with attitude.",
        "Back-View Hands Behind Head": "She stands facing away with both hands lifted behind her head, her weight shifted onto one leg as she stretches her shoulders.",
        "Hand-on-Hip Upward Gaze": "She stands with one hand resting on her hip and her head tipped upward, looking toward the sky as if watching something pass overhead.",
        "Front-Facing Hip Rest": "She stands facing forward with one hand on her hip and the other arm relaxed by her side, her expression calm and friendly.",
        "Forward Walk": "She walks directly toward the viewer with one foot stepping in front of the other, her arms swinging gently and her gaze fixed ahead with quiet focus.",
        "Tool-Over-Shoulder Stance": "She stands tall in heels with one hand on her hip and the other holding a long tool raised beside her shoulder, looking ready for adventure.",
        "Thoughtful Chin Touch": "She stands with one hand resting on her hip and the other raised to touch her chin, her head tilted as she considers something carefully.",
        "Hand Behind Head Front Pose": "She stands with one hand lifted behind her head and the other resting on her hip, her legs close together in a relaxed, confident pose.",
        "Hand Behind Head Back Pose": "She stands facing away with one hand behind her head and the other on her hip, mirroring the front pose with a graceful, balanced stance.",
        "Upward Glance Hip Rest": "She stands with one hand on her hip and the other relaxed, turning her face upward and to the side with a dreamy, distant look.",
        "Overhead Arms Clasp": "She stands with both arms raised high above her head and her hands clasped together, stretching tall with her body lengthened and relaxed.",
        "Casual Waist-Up Hip Rest": "She stands with one hand resting loosely on her hip and her other arm relaxed, her shoulders tilted slightly in a calm, easy pose.",
        "Confident Arms-Down Stand": "She stands with her arms hanging relaxed at her sides and her fingers slightly curled, meeting the viewer's eyes with a cool, self-assured stare.",
        "Hand-Behind-Head Waist Rest": "She stands with one hand lifted behind her head and the other resting at her waist, her hips angled in a relaxed, casual pose.",
        "Shy Shirt Tug": "She stands with her knees turned slightly inward, gripping the hem of her oversized T-shirt with both hands, her cheeks blushing and lips pouting in shy embarrassment.",
        "Reaching to Viewer": "She stands with one arm stretched toward the viewer, fingers spread as if inviting them closer, her head tilted with a soft, warm expression.",
    },
    "Sitting": {
        "Wide V-Sit": "She sits on the floor with her legs stretched wide in a V, palms planted on the floor between them for balance, leaning slightly forward with a playful, energetic look like a dancer warming up.",
        "Casual Raised-Knee Sit": "She sits on the floor with one knee raised and the other leg tucked comfortably in, a hand resting behind her head and the other on her knee, looking carefree and easygoing.",
        "Mermaid Side-Sit Peace Sign": "She side-sits in a mermaid pose with her legs curled gracefully to one side, leaning her body the other way and flashing a cheeky peace sign with a wink.",
        "Seated Back-View Stretch": "She sits facing away with her legs folded beneath her, reaching both arms straight up toward the ceiling with fingers interlaced, her back lengthening in a long, satisfying stretch.",
        "Slouched Wide-Knee Sit": "She sits with her knees apart and feet planted flat, arms resting loosely between her legs and shoulders slumped, looking casual, tired, and completely unbothered.",
        "Supported Side-Sit": "She side-sits with her legs folded neatly to one side, leaning her weight onto one straight arm, her head tilted gently as she gazes off with a soft, elegant expression.",
        "Reclined Crossed-Knee Sit": "She sits reclined on the floor, propped back on one hand with her knees bent and crossed in front of her, her free hand resting on her leg as she smiles contentedly.",
        "Lazy Knees-Up Lean": "She sits with her knees drawn up and legs crossed at the ankles, leaning lazily to one side with one arm draped over her knee, as though daydreaming on a quiet afternoon.",
        "Bashful Side-Sit": "She side-sits with her legs tucked beneath her, lifting a hand to cover her mouth, cheeks flushed and eyes darting away in bashful embarrassment.",
        "Knees-Up Back-View Glance": "She sits on the floor with her knees drawn up and arms around them, facing away from the viewer, and turns to look back over her shoulder with a curious glance.",
        "Relaxed Lean-Back Sit": "She leans back on one hand with one leg extended and the other bent, her free arm resting loosely on her raised knee, perfectly at ease as if chatting with a friend.",
        "Knee Hug": "She hugs her knees tightly to her chest and rests her head on her folded arms, curled up small and quiet, as if lost in deep thought or feeling a little lonely.",
        "Sunbathing Lean-Back": "She leans back on both hands with one knee raised and the other leg stretched out, tilting her face upward with eyes half-closed, as if soaking in warm sunlight on the grass.",
        "Cross-Legged Knee Hug": "She sits cross-legged on the floor, wrapping her arms around one raised knee, viewed from above as she leans forward in a cozy, curled posture.",
        "Knee-Up Floor Sit": "She sits facing forward with one knee raised and the other leg folded beside her, hands resting near her feet, looking calm and grounded.",
        "Reclined Knee-Up Sit": "She sits leaning back on one hand with one knee drawn up and her other leg stretched out, relaxed as if lounging on a picnic blanket.",
        "Low-Angle Seated Lean": "She sits on the floor viewed from a dramatic low angle, one leg extended toward the viewer and a hand raised to her head, leaning back casually.",
        "Back-View Side-Sit": "She sits with her legs folded to one side, seen from behind, her back gently curved as she looks down at something in her lap.",
        "Elbow-Lean Knees-Up Sit": "She sits reclined on one elbow with her knees bent up, her free hand resting on her leg as she gazes upward lazily.",
        "Leaning Seated Lounge": "She sits leaning back on one arm with her legs stretched out to the side, her body forming a long, relaxed line.",
        "Reaching Up Seated": "She sits on the floor with her knees bent, leaning back and stretching one arm high overhead as if reaching for something on a shelf.",
        "Kneeling Hand-to-Face": "She kneels with one leg folded beneath her and one knee up, a hand pressed to her cheek in a soft, thoughtful pose.",
    },
    "Kneeling": {
        "Kneeling Overhead Stretch": "She kneels upright on a soft floor with her back long and straight, both arms raised and bent behind her head, elbows pointing skyward as she stretches her shoulders like someone shaking off the last bit of sleep on a lazy morning.",
        "Praying Seiza": "She sits back on her heels in a neat seiza, knees pressed together, hands clasped tightly beneath her chin, eyes lifted upward in a hopeful, pleading expression as if making a heartfelt wish.",
        "Raised-Knee Peekaboo Kneel": "She kneels with one knee drawn up toward her chest and the other folded beneath her, both hands raised playfully to her face, fingers spread as she peeks out with a teasing, mischievous smile.",
        "Peace Sign Kneel": "She kneels with her knees together and one hand tucked between them, the other raised in a cheerful peace sign beside her face, her head tilted with a bright, friendly grin.",
        "Confident Half-Kneel": "She half-kneels with one foot planted forward and the other knee resting on the ground, a hand set firmly on her hip and her chin raised, looking ahead with quiet confidence.",
        "Formal Seiza": "She kneels formally in seiza with her back perfectly upright and her shoulders relaxed, hands folded neatly on her lap, her expression calm and composed like someone at a tea ceremony.",
        "Leaning Forward Kneel": "She kneels and leans her upper body forward, arms folded in front of her as if resting on a low table, her head tilted slightly as she listens with a thoughtful, relaxed expression.",
        "Upright Neutral Kneel": "She kneels upright with her knees slightly apart, arms hanging loosely at her sides and shoulders at ease, gazing straight ahead with quiet, patient attention.",
        "Eager W-Sit Lean": "She sits in a W-sit with her legs folded out to either side, leaning forward with her palms pressed flat to the floor between her knees, looking up eagerly as if waiting for good news.",
        "Over-the-Shoulder Heel Sit": "She sits on her heels facing away from the viewer, her back gently curved and hair falling over one shoulder, turning her head to glance softly back with a gentle, wistful look.",
        "Shy W-Sit": "She kneels in a W-sit with her hands tucked between her knees, head lowered and shoulders drawn inward, her eyes cast down in a shy, slightly nervous manner.",
        "Low Lunge Glance Back": "She kneels in a low lunge seen from behind, one leg stretched long behind her and the other bent forward, twisting her torso to glance back toward the viewer over her shoulder.",
    },
    "Crouching / Kneeling": {
        "Folded Forward Crouch": "She crouches low with her body folded forward over her knees, arms tucked in close, as if resting or hiding from the cold.",
        "Overhead-View Crouch": "She crouches low to the ground, seen from above, hugging her knees close with her head bowed.",
        "Bent-Over Crouch": "She crouches with her back rounded and arms dangling toward the floor, as if picking something up.",
        "Kneeling Upward Reach": "She kneels low with one knee down, reaching both arms upward and outward as if trying to catch something falling.",
        "Tucked Crouch": "She crouches compactly with her knees drawn tight to her chest, arms wrapped around her legs, small and guarded.",
        "Back-View Crouch": "She crouches facing away, balanced on the balls of her feet, one hand touching the ground for support.",
        "Squat with Hand on Head": "She squats low with her knees apart and one hand resting on top of her head, looking up with a puzzled expression.",
    },
    "Lying": {
        "Propped Side Recline": "She lies on her side with her legs gently bent, propped up on one elbow with her head resting in her hand, relaxed but attentive as if listening to a story.",
        "Dreamy Arched Side-Lie": "She lies on her side with her back gently arched and legs softly bent, both hands resting near her face, her expression dreamy and far away.",
        "Chin-in-Hands Prone": "She lies on her stomach with her chin cupped in her hands, feet kicked up and crossed behind her, swinging them lightly as she listens with playful interest.",
        "Prone Elbow Rest, Back View": "She lies on her stomach propped on her elbows, seen from behind, her lower legs lifted and swaying lazily in the air as she reads or relaxes.",
        "Exhausted Sprawl": "She lies sprawled on the floor with her head tilted down and legs bent loosely, arms flopped carelessly beside her as though she just collapsed after a long, tiring day.",
        "Stretched-Out Recline": "She reclines on her side propped on one elbow, her body stretched out long and comfortable, one arm draped along her hip in a calm, graceful pose.",
        "Sleeping Fetal Curl": "She curls up on her side in a fetal position, knees tucked close to her chest and her head resting on her arm, breathing softly as she sleeps peacefully.",
        "Supine Stretch": "She lies flat on her back with her body stretched out long, one arm bent above her head, relaxing completely.",
        "Prone Leg Extend": "She lies on her stomach with her legs extended behind her, arms folded beneath her chin, resting quietly.",
        "Side-Lying Head Rest": "She lies on her side with her head resting on her bent arm, legs slightly bent, drifting toward sleep.",
        "Back-Lying Knees Up": "She lies on her back with her knees drawn up toward her chest and her feet lifted, arms resting beside her in a playful, carefree pose.",
        "Legs-Up Back Lie": "She lies on her back with one leg raised straight into the air, her arm reaching up toward it as if stretching after a workout.",
        "Leg-Raised Recline": "She lies back propped on her elbows with one leg lifted high and the other bent, stretching lazily on the floor.",
        "Propped Side Recline 2": "She reclines on her side, propped on one elbow, with her legs stretched long behind her and a calm, pleasant expression.",
        "Side-Lying Arm Pillow": "She lies on her side with her legs stretched long and slightly bent, her head resting on one folded arm and the other arm draped along her body, drifting peacefully toward sleep.",
        "Side Recline Arm Stretch": "She lies on her side with her upper body lifted slightly, one arm extended along the floor and her legs bent softly at the knees, relaxing comfortably while gazing ahead.",
        "Prone Head-Down Leg Kick": "She lies on her stomach with her cheek resting near the floor and one arm stretched forward, her lower legs bent and lifted lazily behind her as she unwinds after a long day.",
        "Elbow Recline Knee Hold": "She reclines on one elbow with her knees bent and drawn up together, her free hand resting on her raised knee, looking toward the viewer with a calm, easy expression.",
        "Semi-Reclined Side Lounge": "She lounges half-reclined with her legs folded softly to one side, one hand resting lightly on her chest, her body angled in a relaxed, graceful curve.",
        "Propped Knees-Up Recline": "She leans back on one forearm with both knees bent and raised high, her other hand resting loosely on the floor, lounging casually as if stretching out on a sunny lawn.",
        "Chin-Up Prone Chat": "She lies on her stomach propped on her elbows, her lower legs kicked up behind her, hands raised expressively in front of her as if chatting animatedly with a friend.",
        "Back-Lying Knee Raise": "She lies on her back with one knee bent upward and the other leg relaxed, one arm stretched above her head along the floor, resting with her eyes closed.",
        "Seated Knee Hug Lean": "She sits low on the floor with one knee drawn up, wrapping her arms loosely around it and leaning forward slightly, her gaze turned thoughtfully downward.",
        "Hand-Propped Recline": "She reclines with her upper body propped up on one straight arm, her legs extended and slightly bent to the side, her head lifted proudly as she looks into the distance.",
        "Curled Side Sleep": "She lies curled on her side with her knees bent and her head resting on her folded arms, her body gently rounded in a cozy, sleepy pose.",
        "Prone Forward Stretch": "She lies stretched out on her stomach with one arm reaching far forward along the floor and her legs extended behind her, her face resting against her shoulder.",
        "Front-View Forward Fold": "She kneels and folds forward until her head rests on the floor, arms stretched out on either side, viewed from the front as she sinks into a deep, restful stretch.",
        "Chin-in-Hand Prone": "She lies on her stomach with her chin resting in one hand, her feet lifted and crossed behind her, looking up with a sweet, daydreaming expression.",
        "Prone Arms-Forward Rest": "She lies on her stomach with her arms folded forward on the floor, her chin resting just above them and her lower legs raised behind her, quietly watching something in front of her.",
        "Head-on-Arms Kneeling Stretch": "She kneels with her hips raised and her chest lowered to the floor, resting her head on her folded arms, her eyes closed in a long, lazy stretch.",
        "Hair-Tossing Side Recline": "She reclines on her side propped on one straight arm, her other hand lifted to sweep her long hair back, her legs stretched long and elegant behind her.",
        "Elegant Side Recline": "She reclines on her side supported by one straight arm, her free hand resting on her hip and legs extended gracefully, turning her head to face the viewer with poise.",
    },
    "All Fours": {
        "Searching Tabletop": "She crouches on all fours with her head lowered close to the ground, scanning the floor carefully as if searching for an earring she dropped.",
        "Curious Crawl": "She crawls forward on her hands and knees, lifting her head to look up with wide, curious eyes, as though she just spotted something interesting.",
        "Cat Stretch": "She stretches like a cat, chest pressed low to the ground and arms reaching far forward along the floor, enjoying a long, lazy, full-body stretch.",
    },
    "Dynamic / Action": {
        "Mid-Air Leap": "She leaps through the air with her legs split and arms flung outward, caught at the peak of a joyful jump.",
        "Knee-Tuck Jump": "She jumps mid-air with one knee tucked up high and her arms pulled in, full of bouncy energy.",
    },
}


class MBPoseSelector(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesPoseSelector",
            display_name="Pose Selector (MB)",
            category="MBNodes",
            inputs=[
                io.DynamicCombo.Input("category", options=[
                    io.DynamicCombo.Option(name, [io.Combo.Input("pose", options=list(poses), tooltip="Pose used when randomize_pose is off.")])
                    for name, poses in POSES.items()
                ]),
                io.Boolean.Input("randomize_pose", default=False, tooltip="Pick a pose from the selected category using the seed instead of the pose widget."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
            ],
            outputs=[
                io.String.Output("prompt"),
            ],
        )

    @classmethod
    def execute(cls, category, randomize_pose, seed, weight) -> io.NodeOutput:
        poses = POSES[category["category"]]
        pose = random.Random(seed).choice(list(poses)) if randomize_pose else category["pose"]
        return io.NodeOutput(weighted(poses[pose], weight))


NODES = [MBPoseSelector]
