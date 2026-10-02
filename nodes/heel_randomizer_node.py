"""Heel prompt picker: a coverage group with its heel style (fixed or
seeded-random from that group) as its full description, plus a seeded sample
of the group's detail fragments and an optional seeded color."""

import random

from comfy_api.latest import io

from .bodycon_randomizer_node import COLORS, MAX_SEED, weighted


def _lines(block):
    return [line.strip() for line in block.strip().splitlines() if line.strip()]


HEELS = {
    "Open / Minimal Coverage": {
        "Mule Heels": "She wears mule heels, backless slip-on heels with a wide band across the toes, effortless to step into and polished with any outfit.",
        "Block Heel Mules": "She wears block heel mules with a single broad strap over the toes and a sturdy, stacked heel, chic and comfortable for all-day wear.",
        "Denim Mule Heels": "She wears denim mule heels with a casual blue denim strap and a chunky block heel, giving a relaxed, street-style edge.",
        "Pointed Mules": "She wears pointed mules with a sleek closed toe, an open back, and a small kitten heel finished with a delicate bow.",
        "Bow Mule Heels": "She wears bow mule heels with a knotted satin bow across the toes and a low block heel, sweet and feminine.",
        "Strappy Slide Heels": "She wears strappy slide heels with two thin metallic bands across the foot and a cylindrical heel, minimal and modern.",
    },
    "Open Toe with Ankle Strap": {
        "Ankle Strap Heels": "She wears ankle strap heels with a thin band across the toes and a buckled strap circling her ankle on a slim, tall heel.",
        "Strappy Stiletto": "She wears strappy stilettos with multiple thin straps crisscrossing her foot and ankle on a needle-thin heel.",
        "Classic Block Heels": "She wears classic block heels with a simple toe strap, a buckled ankle strap, and a sturdy square heel, comfortable and timeless.",
        "Square Toe Block Heels": "She wears square toe block heels with a clean squared-off toe strap and an ankle buckle, sleek and modern.",
        "Strappy Block Heels": "She wears strappy block heels with several slim bands wrapping her foot and ankle above a chunky heel.",
        "Glitter Block Heels": "She wears glitter block heels with a sparkling, shimmering heel and toe strap that catch the light with every step.",
        "Embellished Block Heels": "She wears embellished block heels with pearl or crystal detailing along the toe strap and a buckled ankle strap.",
        "Mid Heel Sandals": "She wears mid heel sandals with soft pastel straps and a moderate heel, easy and elegant for daytime outings.",
        "Platform Sandals": "She wears platform sandals with a thick raised sole beneath the toes, a chunky heel, and a buckled ankle strap.",
        "Chunky Platform Heels": "She wears chunky platform heels with a lug-soled platform, a wide heel, and a bold ankle strap for a retro look.",
        "Platform Stiletto": "She wears platform stilettos with a raised front sole, an open toe strap, and a dramatically tall, slender heel.",
        "T-Strap Platform Heels": "She wears T-strap platform heels with a vertical strap running up her foot to meet the ankle strap above a raised sole.",
        "Clear Platform Heels": "She wears clear platform heels with transparent straps, sole, and heel, creating a sleek, barely-there effect.",
        "Chunky Heels": "She wears chunky heels with a metallic platform sole, wide straps, and a thick, sturdy heel for a bold statement.",
        "Peep Toe Pumps": "She wears peep toe pumps with a small opening at the toe and an ankle strap, revealing just a hint of her toes.",
        "Party Heels": "She wears sparkling party heels with jeweled straps across her foot and ankle, ready for a night of dancing.",
        "Diamond Heels": "She wears diamond heels with crystal-studded straps glittering across her foot and ankle on a slim heel.",
        "Rhinestone Heels": "She wears rhinestone heels with thin straps lined with sparkling stones that shimmer under the lights.",
        "Metallic Heels": "She wears metallic heels with gleaming gold or silver straps and a sleek stiletto heel.",
        "Shimmer Heels": "She wears shimmer heels with softly glowing silver straps and a delicate stiletto heel.",
        "Satin Heels": "She wears satin heels with a glossy satin toe strap finished with a soft bow and a slim heel.",
        "Pearl Detail Heels": "She wears pearl detail heels with strands of pearls running along the straps and a block heel.",
        "Bow Detail Heels": "She wears bow detail heels with an oversized satin bow across the toes and a slender heel.",
        "Wedding Heels": "She wears ivory wedding heels decorated with crystal embellishments and delicate straps, perfect for the big day.",
        "Black Tie Heels": "She wears black tie heels with a minimal ankle strap and a jeweled toe band, refined and formal.",
        "Knotted Strap Heels": "She wears knotted strap heels with a soft twisted knot across the toes and a buckled ankle strap.",
        "Butterfly Embellished Heels": "She wears butterfly embellished heels with crystal butterflies perched across the toe strap and ribbon ties at her ankle.",
        "Flower Vine Heels": "She wears flower vine heels with delicate floral straps that coil up around her ankle like a blooming vine.",
        "Wedge Heels": "She wears wedge heels with a solid sole that rises continuously from toe to heel, steady and comfortable.",
        "Espadrille Wedges": "She wears espadrille wedges with a woven jute-wrapped sole, canvas straps, and an ankle tie, perfect for summer.",
        "Peep Toe Wedges": "She wears peep toe wedges with a small toe opening and a cork or espadrille sole.",
        "Strappy Wedges": "She wears strappy wedges with braided straps wrapping her foot above a tall woven sole.",
        "Fabric Wedges": "She wears fabric wedges with a floral-printed fabric-covered heel and simple straps.",
        "Cork Wedges": "She wears cork wedges with a natural cork sole and smooth leather straps, casual and earthy.",
        "Glitter Wedges": "She wears glitter wedges with sparkly straps over a woven platform sole.",
        "Platform Wedges": "She wears platform wedges with a raised front sole and a dramatically tall wedge, bold and stable.",
        "Espadrille Heels": "She wears espadrille heels with a jute-wrapped block heel and platform, combining summer charm with height.",
        "Cork Heels": "She wears cork heels with a cork-textured block heel and platform and a leather ankle strap.",
    },
    "Closed Foot Coverage": {
        "Classic Stiletto": "She wears classic stilettos with a sleek pointed toe, a smooth closed upper, and a needle-thin high heel.",
        "Patent Stiletto": "She wears patent stilettos with a glossy, mirror-shine finish and a sharp pointed toe.",
        "Nude Stiletto": "She wears nude stilettos in a soft skin-tone shade that visually lengthens her legs.",
        "Glitter Stiletto": "She wears glitter stilettos covered in sparkling sequins from toe to heel.",
        "Clear Stiletto": "She wears clear stilettos with a transparent PVC upper that makes her foot look like it's floating.",
        "Pump": "She wears classic pumps with a rounded closed toe, a low-cut vamp, and a smooth high heel.",
        "Platform Pumps": "She wears platform pumps with a thick sole under the toes that adds height while easing the arch.",
        "Mid Heel Pumps": "She wears mid heel pumps with a moderate heel and pointed toe, polished enough for the office.",
        "Pointed Toe Heels": "She wears pointed toe heels with an elongated sharp toe that lengthens her silhouette.",
        "Square Toe Heels": "She wears square toe heels with a squared, slightly open front and a slim heel for a modern look.",
        "Scalloped Heels": "She wears scalloped heels with a softly wavy, scalloped edge along the topline.",
        "Sculpted Heels": "She wears sculpted heels with an artfully curved, sculptural heel that turns the shoe into a statement piece.",
        "Flared Heels": "She wears flared heels with a heel that widens at the bottom like an upside-down cone.",
        "Cone Heels": "She wears cone heels with a heel that tapers from wide at the top to narrow at the base.",
        "Velvet Heels": "She wears velvet heels in a rich, plush fabric with a block heel, luxurious for evening wear.",
        "D'Orsay Heels": "She wears D'Orsay heels with a closed toe and heel but cut-away open sides that reveal her arch.",
    },
    "Closed with Straps": {
        "Ankle Strap Stiletto": "She wears ankle strap stilettos with a pointed closed toe and a thin strap buckled around her ankle.",
        "Ankle Strap Pump": "She wears ankle strap pumps with a full closed front and a secure buckled strap at the ankle.",
        "Kitten Heels": "She wears kitten heels with a short, slim heel and a pointed toe, elegant and easy to walk in.",
        "Slingback Kitten Heels": "She wears slingback kitten heels with a strap curving behind her heel and a low, delicate heel.",
        "Slingback Heels": "She wears slingback heels with a closed toe and a single strap wrapping around the back of her heel.",
        "Bow Slingback Heels": "She wears bow slingback heels with a large bow over the pointed toe and a block heel.",
        "T-Strap Heels": "She wears T-strap heels with a vertical strap running from toe to ankle, forming a T shape.",
        "Mary Jane Heels": "She wears Mary Jane heels with a single strap across the top of her foot and a sturdy heel.",
        "Loafer Heels": "She wears loafer heels with a classic loafer upper, a gold hardware detail, and a block heel.",
    },
    "Ankle Coverage": {
        "Sock Heels": "She wears sock heels with a stretchy knit upper that hugs her ankle like a sock above a slim heel.",
        "Boot Heels": "She wears boot heels, sleek ankle boots with a pointed toe and a tall heel.",
        "Ankle Bootie": "She wears ankle booties that end just above the ankle, laced or zipped, on a stacked heel.",
        "Wedge Bootie": "She wears wedge booties with an ankle-high upper and a solid wedge sole.",
        "Cut-Out Heels": "She wears cut-out heels, ankle booties with open laser-cut patterns that let her skin peek through.",
        "Peep Toe Booties": "She wears peep toe booties that cover her ankle but leave a small opening at the toes.",
        "Studded Lace-Up Booties": "She wears studded lace-up booties with gold pyramid studs lining the front laces.",
        "Embellished Cut-Out Booties": "She wears embellished cut-out booties decorated with jewels and lattice openings.",
        "Caged Booties": "She wears caged booties with a structured web of straps forming an open cage around her ankle.",
        "Lace-Up Peep Toe Booties": "She wears lace-up peep toe booties with corset-style laces up the front.",
        "Cut-Out Sculpted Booties": "She wears cut-out sculpted booties with geometric openings and a tie at the ankle.",
    },
    "Leg Wrap Coverage": {
        "Lace-Up Heels": "She wears lace-up heels with long laces crisscrossing over her foot and tying around her ankle.",
        "Gladiator Heels": "She wears gladiator heels with multiple straps climbing up her ankle and lower calf.",
        "Ribbon Tie Heels": "She wears ribbon tie heels with soft satin ribbons wrapped around her ankles and tied in bows.",
        "Wrap-Around Snake Heels": "She wears wrap-around snake heels with a coiled, crystal-studded strap spiraling up her ankle.",
        "Ankle Wrap Espadrilles": "She wears ankle wrap espadrilles with long ribbon ties wound around her ankles above a woven wedge.",
        "Cage Lace-Up Heels": "She wears cage lace-up heels with geometric cut-outs and laces running up her calf.",
    },
    "Knee & Thigh Coverage": {
        "Knee High Boots": "She wears knee high boots that rise to just below her knee on a tall heel.",
        "Thigh High Boots": "She wears thigh high lace-up boots that extend past her knee with laces running up the back.",
        "Knee-High Gladiator Heels": "She wears knee-high gladiator heels with dozens of straps climbing up to her knee.",
        "Thigh-High Lace-Up Heels": "She wears thigh-high lace-up heels with thin suede cords wrapped repeatedly up her legs above an open-toe stiletto.",
    },
}

DETAILS = {
    "Open / Minimal Coverage": _lines("""
        smooth leather upper
        suede finish
        padded footbed
        squared toe line
        almond toe line
        gold hardware accent
        quilted strap
        woven strap
        transparent PVC strap
        low heel height
        mid heel height
        high heel height
    """),
    "Open Toe with Ankle Strap": _lines("""
        gold buckle at the ankle
        silver buckle at the ankle
        adjustable ankle strap
        padded insole
        suede straps
        patent leather straps
        thin barely-there straps
        crystal-trimmed buckle
        stacked heel
        lacquered heel
        sculpted heel
        open toe showing pedicured toes
    """),
    "Closed Foot Coverage": _lines("""
        smooth leather upper
        patent leather finish
        suede upper
        satin upper
        red lacquered sole
        almond toe
        pointed toe
        low-cut topline
        cushioned insole
        metal heel cap
        crystal heel
        snakeskin texture
    """),
    "Closed with Straps": _lines("""
        gold buckle
        silver buckle
        patent leather finish
        suede upper
        satin upper
        pointed toe
        almond toe
        elastic strap insert
        stacked heel
        crystal buckle
        metal heel cap
        quilted upper
    """),
    "Ankle Coverage": _lines("""
        side zip
        suede upper
        smooth leather upper
        patent leather finish
        stretch fabric upper
        pointed toe
        almond toe
        stiletto heel
        block heel
        metal toe cap
        pull tab at the back
        lug sole
    """),
    "Leg Wrap Coverage": _lines("""
        suede laces
        satin ribbon ties
        leather straps
        metallic straps
        stiletto heel
        block heel
        open toe
        pointed toe
        bow tied at the back
        gold aglets on the laces
        crystal-studded straps
        straps wrapped high on the calf
    """),
    "Knee & Thigh Coverage": _lines("""
        stretch suede upper
        smooth leather upper
        patent leather finish
        stiletto heel
        block heel
        platform sole
        pointed toe
        almond toe
        full-length side zip
        slouchy fit
        second-skin fit
        laces running up the front
    """),
}


class MBHeelRandomizer(io.ComfyNode):
    """One seed drives every pick: the heel (when randomized), the color and
    which of the group's detail fragments land in the prompt."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesHeelRandomizer",
            display_name="Heel Randomizer (MB)",
            category="MBNodes",
            description="Build a heel prompt from a chosen or random heel style's description with random extra details and an optional random color.",
            search_aliases=["heels", "shoes", "footwear", "outfit", "random prompt"],
            inputs=[
                io.DynamicCombo.Input("category", options=[
                    io.DynamicCombo.Option(name, [io.Combo.Input("heel", options=list(heels), tooltip="Heel style used when random_heel is off.")])
                    for name, heels in HEELS.items()
                ]),
                io.Boolean.Input("random_heel", default=False, tooltip="Pick a heel from the selected category using the seed instead of the heel widget."),
                io.Boolean.Input("color", default=False, tooltip="Add a seeded-random color for the heels."),
                io.Boolean.Input("skip_prefix", default=False, tooltip="Drop the leading \"She wears\" from the description."),
                io.Int.Input("details", default=3, min=0, max=12, tooltip="How many random detail fragments to add after the description."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
            ],
            outputs=[io.String.Output("prompt")],
        )

    @classmethod
    def execute(cls, category, random_heel, color, details, seed, weight, skip_prefix) -> io.NodeOutput:
        rng = random.Random(seed)
        group = category["category"]
        heels = HEELS[group]
        text = heels[rng.choice(list(heels)) if random_heel else category["heel"]]
        if skip_prefix:
            text = text.removeprefix("She wears ")
            text = text[0].upper() + text[1:]
        if color:
            text += f" The heels are {rng.choice(COLORS)}."
        fragments = DETAILS[group]
        picks = rng.sample(fragments, min(details, len(fragments)))
        if picks:
            text += f" They feature {', '.join(picks)}."
        return io.NodeOutput(weighted(text, weight))


NODES = [MBHeelRandomizer]
