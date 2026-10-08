"""Women's hairstyle prompt picker: a length category with its style (fixed or
seeded-random from that category) as its full description, plus an optional
hair color picked from the dropdown or from the seed."""

import random

from comfy_api.latest import io

from .bodycon_randomizer_node import MAX_SEED, weighted

HAIRSTYLES = {
    "Short": {
        "Blunt Bob": "She has a short blunt bob cut sharply at chin length, with sleek, straight ends that frame her jaw cleanly.",
        "Short Bob with Bangs": "She has a short bob with full straight bangs and a thin headband, the ends curving softly inward at her chin.",
        "Short Wavy Bob": "She has a short wavy bob with tousled, piece-y waves that end just below her jaw for an effortless, beachy look.",
        "Short Curly Bob": "She has a short curly bob with springy, defined curls that bounce around her face at chin length.",
        "Short Side-Swept Bob": "She has a short side-swept bob with a deep side part, one side tucked behind her ear and the other falling across her cheek.",
        "Short Fluffy Shag": "She has a short fluffy shag with choppy, feathered layers and wispy bangs, full of airy, messy volume.",
        "Short Messy Pixie-Shag": "She has a short messy shag with spiky, textured layers on top and a small tail at the nape of her neck.",
        "Short Sleek Undercut Wave": "She has short hair swept dramatically to one side in a glossy, sculpted wave over her crown.",
        "French Bob": "She has a chic French bob cut just above her jawline, with soft, slightly undone texture and wispy bangs grazing her brows.",
        "Italian Bob": "She has a full, voluminous Italian bob at jaw length, with bouncy, rounded ends and a glossy, expensive-looking finish.",
        "Micro Bob": "She has a sharp micro bob cut well above her jaw, with a precise blunt line and short baby bangs.",
        "Box Bob": "She has a box bob with squared-off, blunt ends at chin length and a dense, geometric shape.",
        "Bixie Cut": "She has a bixie cut blending a pixie and a bob, with choppy layers on top and soft, longer pieces around her ears.",
        "Classic Pixie": "She has a classic pixie cut, cropped short at the back and sides with soft, feathered pieces swept across her forehead.",
        "Long Pixie with Side Fringe": "She has a long pixie with a sweeping side fringe that falls past one eye and tapered, textured sides.",
        "Textured Crop": "She has a short textured crop with piece-y, tousled layers on top and a soft, rounded outline.",
        "Buzz Cut": "She has a sleek, even buzz cut close to her scalp, showing off the clean shape of her head.",
        "Curly Pixie": "She has a short curly pixie with tight, defined curls piled on top and closely tapered sides.",
        "Finger Waves Bob": "She has a short bob styled in glossy, sculpted 1920s finger waves pressed close to her head.",
        "Asymmetrical Bob": "She has an asymmetrical bob, longer on one side at her chin and cropped shorter on the other.",
        "Inverted Bob": "She has an inverted bob, stacked short at the nape and angling down to longer points at the front.",
        "Wet-Look Short Hair": "She has short hair slicked into a glossy wet look, combed back with fine comb lines visible.",
        "Baby Bangs Bob": "She has a chin-length bob with very short, blunt baby bangs high on her forehead.",
        "Short Mullet": "She has a short modern mullet with choppy layers on top and slightly longer, wispy pieces at the nape.",
        "Short Afro": "She has a short, rounded afro with soft, dense coils shaped evenly around her head.",
        "Tapered Natural Curls": "She has short natural curls with a tapered cut, fuller coils on top and closely trimmed sides.",
        "Short Ruffled Bob": "She has a short ruffled bob with airy, lifted volume at the crown and flicked-out, messy ends.",
        "Short Bob with Hair Clips": "She has a short sleek bob with one side pinned back by a row of small, colorful hair clips.",
    },
    "Medium": {
        "Shoulder-Length Wolf Cut": "She has a medium-length wolf cut with shaggy, textured layers, curtain bangs, and flipped ends brushing her shoulders.",
        "Medium Butterfly Cut": "She has a medium-length butterfly cut with face-framing layers that flare outward around her cheeks and collarbones.",
        "Medium Hush Cut": "She has a medium-length hush cut with soft, airy layers and feathered ends that blend seamlessly around her face.",
        "Medium Layered Cut with Curtain Bangs": "She has medium-length layered hair with curtain bangs parted in the center, sweeping gently to either side of her face.",
        "Medium Straight Cut (No Bangs)": "She has medium-length straight hair with a center part and no bangs, falling neatly just past her shoulders.",
        "Medium Hair with Full Bangs": "She has medium-length straight hair with thick, blunt full bangs covering her forehead.",
        "Medium Hair with Side Bangs": "She has medium-length hair with long side-swept bangs angled across her forehead.",
        "Medium Hair with See-Through Bangs": "She has medium-length hair with wispy, see-through bangs that let her forehead peek through.",
        "Medium Hair with Asymmetrical Part": "She has medium-length hair with a deep asymmetrical side part and long, sweeping side bangs.",
        "Medium Hime-Style Bangs": "She has medium-length hair with short twin-tail-style face-framing strands and straight bangs in a modern hime style.",
        "Medium Slick-Back": "She has medium-length hair slicked back neatly from her forehead, smooth and polished.",
        "Medium Inward-Curled Layers": "She has medium-length layered hair with ends that curl gently inward toward her neck.",
        "Medium Outward-Flipped Layers": "She has medium-length layered hair with ends that flip playfully outward at her shoulders.",
        "Medium C-Curl Perm": "She has a medium-length C-curl perm with ends curved softly inward in a smooth C shape.",
        "Medium S-Curl Perm": "She has a medium-length S-curl perm with gentle, S-shaped waves running from mid-length to the ends.",
        "Medium Shoulder Waves": "She has medium-length wavy hair with loose, tousled waves that settle around her shoulders.",
        "Medium Curly Hair with Bangs": "She has medium-length curly hair with springy curls and curly bangs framing her face.",
        "Medium Curly Hair with Headscarf": "She has medium-length tight curly hair with a wide headscarf tied over the top, curly tendrils escaping at the front.",
        "Medium Low Twin Tails with Ribbons": "She has medium-length wavy hair gathered into two low pigtails tied with small ribbons.",
        "Medium Space Buns": "She has medium-length hair twisted into two small space buns on top of her head, with loose strands falling around her face.",
        "Medium Messy Top Knot with Bangs": "She has medium-length hair pulled into a messy top knot, with full bangs and loose wisps framing her face.",
        "Medium High Twin Tails": "She has medium-length hair tied into two high pigtails on either side of her head, with straight bangs.",
        "Medium Side Ponytail": "She has medium-length wavy hair swept into a loose side ponytail resting over one shoulder.",
        "Medium Low Twisted Bun": "She has medium-length hair twisted into a low, elegant bun at the nape of her neck.",
        "Medium Fluffy Layers with Low Tail": "She has medium-length fluffy, choppy layers with a thin low ponytail tucked at the back.",
        "Octopus Cut": "She has a medium-length octopus cut with short, choppy layers at the crown and longer, wispy tentacle-like ends around her shoulders.",
        "Jellyfish Cut": "She has a medium-length jellyfish cut with a blunt, bob-length top layer over longer, straight strands underneath.",
        "Long Bob (Lob)": "She has a long bob that grazes her collarbones, with sleek, straight ends and a soft center part.",
        "Textured Lob": "She has a textured lob with loose, bent waves and piece-y ends just above her shoulders.",
        "Shaggy Mixie": "She has a shaggy mixie cut with choppy layers, a mullet-inspired shape, and fluffy, feathered bangs.",
        "Medium Curtain Bang Shag": "She has a medium shag with heavy, choppy layers and long curtain bangs that sweep around her cheekbones.",
        "Medium Bubble Ponytail": "She has medium-length hair pulled into a bubble ponytail, sectioned with small elastics into rounded puffs.",
        "Medium Claw-Clip Twist": "She has medium-length hair twisted up and held at the back with a large claw clip, the ends fanning out on top.",
        "Medium Scarf Ponytail": "She has medium-length hair in a low ponytail tied with a silk scarf, its ends trailing down her back.",
        "Medium Half-Up Bun": "She has medium-length hair with the top section twisted into a small half-up bun and the rest left loose.",
        "Medium Bouncy Blowout": "She has a medium-length bouncy blowout with lifted roots and smooth, rounded ends curling under.",
        "Medium Glass Hair": "She has medium-length glass hair, ultra-sleek and mirror-shiny, falling perfectly straight past her shoulders.",
        "Medium Bubble Braid": "She has medium-length hair in a single bubble braid, sectioned into puffed segments down her back.",
        "Medium Dutch Braids": "She has medium-length hair in two tight Dutch braids raised along her scalp and ending at her shoulders.",
        "Medium Shag with Bottleneck Bangs": "She has medium-length shaggy layers with bottleneck bangs that are narrow at the center and widen around her eyes.",
        "Medium Wet-Look Waves": "She has medium-length hair in glossy wet-look waves, swept back from her face and falling in defined ripples.",
        "Medium Bantu Knots": "She has medium-length natural hair twisted into neat rows of small bantu knots across her head.",
        "Medium Twist-Out": "She has a medium-length twist-out with defined, springy coils and lots of soft, fluffy volume.",
        "Medium Box Braids": "She has medium-length box braids reaching just past her shoulders, gathered loosely to one side.",
        "Medium Pinned Side Sweep": "She has medium-length hair swept to one side and pinned behind her ear with a pearl barrette.",
    },
    "Long": {
        "Long Straight Hair": "She has long, sleek straight hair falling smoothly past her chest with a center part.",
        "Long Straight Hair with Side Clip": "She has long, straight hair with a side part and a small decorative clip holding one side back.",
        "Long Hime Cut": "She has a long hime cut with blunt full bangs, cheek-length side locks, and straight hair flowing down her back.",
        "Long Beach Waves": "She has long hair styled in loose, tousled beach waves cascading past her shoulders.",
        "Long Voluminous Curls": "She has long, glamorous hair in big, bouncy curls with lots of volume, like a fresh blowout.",
        "Long Tight Curls": "She has long, tight corkscrew curls forming a full, voluminous mane around her face.",
        "Long Water Wave Perm": "She has a long water wave perm with soft, rippling waves running evenly from root to tip.",
        "Long Hippie Perm": "She has a long hippie perm with small, tight crimped curls and a messy fringe for a boho look.",
        "Long Wave Perm with Hand-Curled Ends": "She has long hair in a wave perm, with smooth roots and soft, hand-curled waves at the ends.",
        "Long Side-Swept Waves": "She has long wavy hair swept dramatically over one shoulder with a deep side part.",
        "Long Waves with Headband": "She has long, flowing waves held back by a wide padded headband.",
        "Long Half-Up Half-Down": "She has long wavy hair with the top section pulled back into a half-up style, the rest flowing freely.",
        "Long Half-Up with Hair Sticks": "She has long hair partially twisted into a side bun secured with decorative hair sticks, with the rest flowing down.",
        "Long Wavy Ponytail": "She has long hair gathered into a loose, wavy low ponytail draped over one shoulder.",
        "Long Ponytail with Scarf": "She has long, curly hair pulled into a low ponytail tied with a polka-dot scarf.",
        "Long High Ponytail with Waves": "She has long wavy hair pulled into a voluminous high ponytail with a few strands left loose at the front.",
        "Long Twin Braids": "She has long hair woven into two neat braids hanging down over her shoulders.",
        "Long Twin Braids with Loose Waves": "She has long wavy hair with two loose braids at the front and soft waves falling behind them.",
        "Long Side Braid": "She has long hair swept to one side and plaited into a single loose braid resting over her shoulder.",
        "Long Fishtail Braid": "She has long hair woven into a single intricate fishtail braid running down her back.",
        "Long Loose Messy Braid": "She has long hair in a relaxed, textured braid with face-framing strands pulled loose.",
        "Long Crown Braid": "She has long hair braided and wrapped around her head like a crown, with the rest falling softly.",
        "Long Braided Headband": "She has long hair with a thin braid running across the top of her head like a headband.",
        "Long Milkmaid Braids": "She has long hair braided and pinned over the top of her head in a milkmaid style.",
        "Long Braided Half-Up with Beads": "She has long, wavy hair with small braids and beaded clips woven into a half-up style.",
        "Long Braided Twin Tails with Bobbles": "She has long hair styled into twin braided tails tied with bobbles and a ribbon collar.",
        "Long Low Chignon": "She has long hair gathered into a smooth, rolled chignon at the nape of her neck.",
        "Long Braided Low Bun": "She has long hair braided and wound into an elegant low bun at the back of her head.",
        "Long Side-Swept Bun": "She has long hair twisted into a soft, side-swept low bun with loose wisps at the front.",
        "Long Traditional Floral Bun": "She has long hair pinned up in a traditional high bun decorated with flowers, hairpins, and dangling tassels.",
        "Long Traditional Swept Updo": "She has long hair swept up into a sculpted traditional updo with ornate hair sticks and blossoms, a few strands left loose.",
        "Long Fan-Crowned Updo": "She has long hair styled into an elaborate rolled updo with a decorative fan ornament fanning out behind her head.",
        "Long Floral Hime Style": "She has long, straight hair with blunt bangs, adorned on one side with a cascade of large flowers.",
        "Long Flowing Hair with Floral Pin": "She has long, straight hair flowing down her back, with the side gathered and pinned with flowers and tassels.",
        "Long Floral Half-Updo": "She has long wavy hair partially swept up and pinned with flowers, soft strands falling around her face.",
        "Long Messy Floral Bun": "She has long hair gathered into a loose, voluminous bun accented with blossoms and a hairpin, with wispy tendrils falling free.",
        "Long Mermaid Waves": "She has very long hair in soft, uniform mermaid waves flowing down to her waist.",
        "Long Butterfly Layers": "She has long hair with butterfly layers, short face-framing pieces flaring outward over long, bouncy lengths.",
        "Long Curtain Bangs Blowout": "She has long, voluminous blown-out hair with thick curtain bangs and ends curled away from her face.",
        "Long Knotless Braids": "She has long, waist-length knotless braids falling smoothly over her shoulders and down her back.",
        "Long Goddess Braids": "She has long goddess braids with curly, loose strands woven through and spilling out along their length.",
        "Long Bubble Ponytail": "She has long hair in a high bubble ponytail, sectioned with elastics into puffed segments down her back.",
        "Long Sleek High Ponytail": "She has long hair pulled into a sleek, snatched high ponytail with a smooth, glossy finish and long straight length.",
        "Long Snatched Low Bun": "She has long hair slicked back into a tight, glossy low bun with a sharp middle part.",
        "Long Messy Bun": "She has long hair twisted into a big, messy bun on top of her head, with loose wisps around her face.",
        "Long Ballerina Bun": "She has long hair wound into a neat, high ballerina bun, smooth and tight with no flyaways.",
        "Long Waterfall Braid": "She has long, loose waves with a waterfall braid running across the back of her head.",
        "Long Dutch Fishtail Braids": "She has long hair in two Dutch fishtail braids raised along her scalp and hanging down past her shoulders.",
        "Long Bow Half-Up": "She has long hair with the top half gathered back and tied with a large satin bow.",
        "Long Pearl-Pinned Waves": "She has long, soft waves with small pearl pins scattered through one side of her hair.",
        "Long Wet-Look Slick Back": "She has long hair slicked back from her forehead in a glossy wet look, falling straight down her back.",
        "Long Ribbon-Wrapped Ponytail": "She has long hair in a low ponytail with a thin ribbon wrapped and crisscrossed down its length.",
        "Long Face-Framing Layers": "She has long, straight hair with soft face-framing layers that start at her cheekbones and blend into the length.",
        "Long Old Hollywood Waves": "She has long hair in glossy, sculpted Old Hollywood waves swept over one side with a deep side part.",
        "Long Natural Coils": "She has long, voluminous natural coils with defined spirals cascading past her shoulders.",
        "Long Pull-Through Braid": "She has long hair in a voluminous pull-through braid, its looped sections widened into a full, airy shape.",
    },
}

HAIR_COLORS = [
    "jet black", "soft black", "dark brown", "chestnut brown", "light brown",
    "auburn", "copper red", "strawberry blonde", "honey blonde", "golden blonde",
    "ash blonde", "platinum blonde", "silver gray", "pastel pink", "lavender",
]


class MBHairstyleRandomizer(io.ComfyNode):
    """One seed drives every random pick: the style inside the chosen length
    category (when randomized) and the color (when set to random)."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesHairstyleRandomizer",
            display_name="Hairstyle Randomizer (MB)",
            category="MBNodes",
            description="Build a women's hairstyle prompt from a chosen or random style in a length category, with an optional hair color.",
            search_aliases=["hair", "hairstyle", "haircut", "random prompt"],
            inputs=[
                io.DynamicCombo.Input("category", options=[
                    io.DynamicCombo.Option(name, [io.Combo.Input("style", options=list(styles), tooltip="Hairstyle used when random_style is off.")])
                    for name, styles in HAIRSTYLES.items()
                ]),
                io.Boolean.Input("random_style", default=False, tooltip="Pick the style from the selected category using the seed instead of the style widget."),
                io.Combo.Input("color", options=["none", "random", *HAIR_COLORS], default="none", tooltip="Hair color added to the prompt. \"random\" picks one from the seed."),
                io.Boolean.Input("skip_prefix", default=False, tooltip="Drop the leading \"She has\" from the description."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
            ],
            outputs=[io.String.Output("prompt")],
        )

    @classmethod
    def execute(cls, category, random_style, color, skip_prefix, seed, weight) -> io.NodeOutput:
        rng = random.Random(seed)
        styles = HAIRSTYLES[category["category"]]
        text = styles[rng.choice(list(styles)) if random_style else category["style"]]
        if skip_prefix:
            text = text.removeprefix("She has ")
            text = text[0].upper() + text[1:]
        if color == "random":
            color = rng.choice(HAIR_COLORS)
        if color != "none":
            text += f" Her hair is {color}."
        return io.NodeOutput(weighted(text, weight))


NODES = [MBHairstyleRandomizer]
