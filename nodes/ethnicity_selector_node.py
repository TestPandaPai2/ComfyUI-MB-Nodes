"""Ethnicity picker: one combo of ethnicities (fixed or seeded-random), outputs
"Name: appearance description"."""

import random

from comfy_api.latest import io

from .common import MAX_SEED, weighted


ETHNICITIES = {
    "Han Chinese": "Light beige to light tan skin with warm or neutral undertones. Straight, thick black or dark brown hair. Dark brown, almond-shaped eyes, often with a monolid or low crease. A rounded to oval face with a moderately flat nasal bridge and medium cheekbones.",
    "Hindustani / Indo-Aryan": "Light brown to deep brown skin with warm undertones. Thick black or dark brown hair, straight to wavy. Large, dark brown, deep-set eyes with strong brows. A medium-bridged, straight nose and an oval or long face.",
    "Bengali": "Medium to dark brown skin with golden or olive undertones. Black, often wavy hair. Large, dark, expressive eyes with long lashes. A softly rounded face, a small to medium nose, and a slight build.",
    "Punjabi": "Light wheat to medium brown skin. Black or dark brown hair, straight to wavy, with thick beards common in men. Dark brown eyes, sometimes hazel. A tall, broad frame, a long face, a prominent straight nose, and strong brows.",
    "Pashtun": "Fair to olive skin, sometimes sun-weathered. Dark brown or black hair, with light brown and occasionally blond or red variants. Brown, hazel, green, or grey eyes. A long, angular face, a high-bridged nose, a strong jaw, and a tall, lean build.",
    "Sindhi": "Medium olive-brown to dark brown skin. Black wavy hair and dark brown, deep-set eyes. Defined cheekbones, a medium-prominent nose, and a lean to medium build.",
    "Baloch": "Olive to tan, sun-weathered skin. Straight or wavy black hair and dark eyes under heavy brows. A narrow face, a prominent aquiline nose, a strong jaw, and a lean, wiry build.",
    "Tamil": "Medium to deep brown skin. Thick black hair, straight to wavy. Large, dark, rounded eyes with defined brows. A broad to oval face, a medium nose, and full lips.",
    "Arab": "Light olive to medium tan skin (varying widely by region). Thick dark brown or black hair, straight to wavy. Dark brown eyes under strong brows, with sometimes hazel or green. A medium to high-bridged nose and an oval face.",
    "Persian": "Light olive to fair skin. Dark brown or black wavy to curly hair. Large, dark almond-shaped eyes, thick brows, and long lashes. A defined, often aquiline nose and a long oval face.",
    "Turkish": "Fair to light olive skin. Dark brown, chestnut, or black hair, with some lighter shades. Brown, hazel, or green eyes. A medium-bridged nose and an oval to square face, often with a strong brow line.",
    "Kurdish": "Fair to olive skin. Dark brown or black hair, with some lighter shades. Brown, hazel, green, or blue eyes. An angular face, a straight to aquiline nose, high cheekbones, and a sturdy build.",
    "Yoruba": "Medium-deep to deep brown skin with warm undertones. Tightly coiled black hair. Dark brown eyes, a broad nose with a wider base, full lips, and a rounded to oval face.",
    "Igbo": "Medium-brown to deep brown skin. Tightly coiled black hair, dark brown eyes, a medium-broad nose, full lips, and prominent cheekbones on an oval face.",
    "Hausa": "Medium brown to dark brown skin. Black coiled hair, dark eyes, a medium nose, a slender to medium build, and a long oval face, often with defined cheekbones.",
    "Amhara": "Light to medium brown skin with golden undertones. Black curly to wavy hair. Large, dark, almond-shaped eyes, a narrow, high-bridged nose, thin to medium lips, and high cheekbones on a slender face.",
    "Oromo": "Medium to dark brown skin. Black curly hair, dark eyes, a straight to slightly broad nose, a tall, lean build, and an oval face.",
    "Zulu": "Medium to deep brown skin. Tightly coiled black hair, dark brown eyes, a broad nose, full lips, a strong brow, and a muscular, broad-shouldered build.",
    "Somali": "Medium to dark brown skin. Black curly to wavy hair, large dark eyes, a narrow, high-bridged nose, thin to medium lips, and a tall, slender build with an elongated face.",
    "Berber (Amazigh)": "Olive to tan skin, sometimes fairer in mountain regions. Dark brown or black wavy hair, brown eyes with some hazel or green, a straight or aquiline nose, high cheekbones, and a lean build.",
    "Japanese": "Fair to light olive skin with neutral to yellow undertones. Straight black or dark brown hair, dark almond-shaped eyes with monolid or double eyelid, a softly oval face, a low to medium nose bridge, and a smaller build.",
    "Korean": "Fair to light skin with cool to neutral undertones. Straight black hair, dark almond-shaped eyes (monolid common), a flatter facial profile, prominent cheekbones, and a squarer jaw.",
    "Vietnamese (Kinh)": "Light to golden tan skin. Straight black hair, dark almond-shaped eyes, a rounded face, a low nasal bridge, a small nose, and a slight build.",
    "Thai": "Golden tan to medium brown skin. Straight black hair, dark eyes, a rounded face, a low to medium nose bridge, soft features, and a slender build.",
    "Javanese": "Warm medium brown skin. Straight or slightly wavy black hair, dark brown eyes, a rounded or oval face, a small, low-bridged nose, and a slight build.",
    "Filipino (Tagalog)": "Light to medium brown skin with warm undertones. Straight to wavy black hair, dark brown round eyes, a rounded face, a low nasal bridge, a broader nose tip, and a small to medium build.",
    "Mongol": "Tan to ruddy skin, weathered by climate. Straight black hair, narrow dark eyes with an epicanthic fold, a broad, flat face, very high cheekbones, and a sturdy build.",
    "Russian": "Fair skin that often flushes. Light brown, dark blond, or brown hair, with some darker or lighter. Blue, grey, or green eyes, a broad face with wide cheekbones, and a straight to snub nose.",
    "German": "Fair skin. Blond to medium brown hair, blue, grey, or green eyes, a strong jaw, a straight, medium nose, and a tall, solid build.",
    "French": "Fair to light olive skin. Brown or chestnut hair, brown, hazel, or blue eyes, a long oval face, a straight, refined nose, and balanced proportions.",
    "Italian": "Light olive skin that tans easily. Dark brown or black wavy hair, brown or hazel eyes, strong brows, a defined, often prominent nose, and an expressive face.",
    "English": "Fair, sometimes pale skin. Light brown, sandy, blond, or reddish hair, blue, grey, or green eyes, a narrow to oval face, and a straight, narrower nose.",
    "Irish": "Very fair, often freckled skin. Auburn, red, light brown, or dark hair, blue, green, or grey eyes, a soft jawline, and a rounded to oval face.",
    "Polish": "Fair skin. Light brown, ash blond, or dark blond hair, blue, grey, or green eyes, high, broad cheekbones, a wide forehead, and a straight to slightly upturned nose.",
    "Greek": "Light olive to olive skin. Dark brown or black wavy hair, dark brown eyes, a straight, strong nose with a high bridge, a strong brow line, and an oval face.",
    "Mestizo (Latin America)": "Light tan to medium brown skin, with wide variation. Dark brown or black, straight to wavy hair, dark brown eyes, and features blending Indigenous (broader cheekbones, rounder face) and European (narrower nose) ancestry.",
    "Quechua": "Tan to reddish-brown skin, weathered by altitude and sun. Straight black hair, dark eyes, a broad face, high cheekbones, an aquiline to medium nose, a barrel chest, and a stocky build.",
    "Navajo (Diné)": "Warm medium to reddish-brown skin. Straight black hair, dark brown eyes, high cheekbones, a strong jaw, a broad forehead, and an oval to broad face.",
    "Māori": "Light to medium brown skin. Dark wavy to curly hair, dark brown eyes, a broad nose, a strong brow, full lips, and a muscular, broad build.",
    "Inuit": "Light to medium brown skin, often with ruddy cheeks. Straight black hair, dark eyes with an epicanthic fold, a round, broad face, full cheeks, a small, low-bridged nose, and a compact, stocky build.",
}

# skin_tone slider steps 1..10, pale to very dark. 0 keeps the ethnicity's own
# skin sentence; otherwise this replaces it.
SKIN_TONES = [
    "Pale, porcelain skin.",
    "Fair skin.",
    "Light skin.",
    "Light olive skin.",
    "Olive skin.",
    "Tan skin.",
    "Medium brown skin.",
    "Brown skin.",
    "Dark brown skin.",
    "Very dark, deep ebony skin.",
]


def with_skin_tone(description, tone):
    """Swap the leading skin sentence of a description for the slider's tone."""
    if not tone:
        return description
    return f"{SKIN_TONES[tone - 1]} {description.split('. ', 1)[1]}"


class MBEthnicitySelector(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesEthnicitySelector",
            display_name="Ethnicity Selector (MB)",
            category="MBNodes",
            description="Pick an ethnicity, or a seeded-random one; outputs \"Name: appearance description\".",
            search_aliases=["ethnicity", "ethnic", "appearance", "heritage", "skin tone"],
            inputs=[
                io.Combo.Input("ethnicity", options=list(ETHNICITIES), tooltip="Ethnicity used when randomize is off."),
                io.Boolean.Input("randomize", default=False, tooltip="Pick the ethnicity from the seed instead of the ethnicity widget."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
                io.Int.Input("age", default=25, min=18, max=90, display_mode=io.NumberDisplay.slider, tooltip="Age added to the start of the prompt."),
                io.Int.Input("skin_tone", default=0, min=0, max=len(SKIN_TONES), display_mode=io.NumberDisplay.slider, tooltip="0 keeps the ethnicity's own skin tone. 1 pale, 2 fair, 3 light, 4 light olive, 5 olive, 6 tan, 7 medium brown, 8 brown, 9 dark brown, 10 very dark."),
            ],
            outputs=[io.String.Output("prompt"), io.String.Output("category")],
        )

    @classmethod
    def execute(cls, ethnicity, randomize, seed, weight, age, skin_tone) -> io.NodeOutput:
        name = random.Random(seed).choice(list(ETHNICITIES)) if randomize else ethnicity
        return io.NodeOutput(weighted(f"{age}-year-old {name}: {with_skin_tone(ETHNICITIES[name], skin_tone)}", weight), name)


NODES = [MBEthnicitySelector]
