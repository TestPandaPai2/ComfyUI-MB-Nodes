"""Background prompt picker: a category with its background (fixed or
seeded-random from that category) as its full description."""

import random

from comfy_api.latest import io

from .bodycon_randomizer_node import MAX_SEED, weighted

BACKGROUNDS = {
    "Indoor Rooms": {
        "Sheer Curtain Living Room": "A cozy living room with floor-length sheer cream curtains, a small framed botanical print on the wall, a tall potted bird-of-paradise plant, a leafy plant beside a tan leather sofa, a soft beige rug, and warm wooden floors.",
        "Loft Bed Study Room": "A modern bedroom with a black metal loft bed above a wooden desk with drawers, a laptop, a desk lamp, a gray office chair, built-in bookshelves, a metal ladder, a tall window, and a soft gray rug.",
        "Sheer Drapes Bedroom": "A bedroom with tall, flowing terracotta sheer curtains framing a large paned window, plant shadows patterned across the fabric, and the edge of an unmade bed in the foreground.",
        "Corner Curtain Room": "An empty room corner with heavy chocolate-brown blackout curtains meeting long sheer ivory drapes along a wide window, above light wood-plank flooring.",
        "Vintage Green Parlor": "A vintage room with a mottled green and ochre textured wall hung with framed floral paintings, a dark carved wooden armchair holding pink roses, a wooden sideboard topped with flowers and candle holders, and a faded red patterned rug.",
    },
    "Plain Walls & Minimal Sets": {
        "Height Chart Wall": "A plain studio wall marked with horizontal height lines and centimeter numbers from 100 to 200, like a lineup backdrop.",
        "Fairy Light Wall": "A blank beige wall with a single hanging planter of trailing greenery and a strand of tiny fairy lights draped down one side.",
        "Plant Shelf Wall": "A clean white wall beside a wooden pillar, with a hanging macramé planter, a large potted plant on the floor, and a floating wooden shelf holding small plants and stacked books.",
        "Balcony Corner": "A minimalist pale blue balcony corner with a black-framed sliding glass door, sheer white curtains behind it, small metal wall rungs, and a smooth tiled floor.",
    },
    "Studio Sets": {
        "White Wavy Mirror Studio": "A minimalist all-white studio corner with arched wall panels, a tall black wavy-framed floor mirror, a light wood cane-back armchair, and a black adjustable bar stool on a smooth white floor.",
        "Terracotta Boho Studio": "A seamless warm terracotta studio backdrop with drooping palm fronds on one side, a woven seagrass vase of dried pampas grass resting on a rolled woven mat, and a round woven rug on the floor.",
        "Red Director's Chair Set": "A deep red seamless studio backdrop with a lone white folding director's chair standing in the center.",
    },
    "Conceptual & Artistic": {
        "Newspaper Room": "A surreal box-shaped room with every surface, including the walls, floor, and ceiling, fully covered in black-and-white newspaper pages and photographs.",
        "Newspaper Corner": "A room corner plastered floor to ceiling with taped-up newspaper sheets, some pages peeling and curling at the bottom, with torn scraps and tape pieces scattered across the floor.",
    },
    "Camper Van Interiors": {
        "Boho Color Van": "A bright camper van interior with an orange wooden ceiling, a hot-pink cushioned L-shaped bench over orange storage drawers, piles of patterned boho pillows, a teal knit pouf, a fringed woven rug, a lofted bed with a chevron pillow, and trailing plants.",
        "Fluffy Pink Van": "A plush pink van interior with a fuzzy carpeted ceiling, rainbow string lights along the edges, fluffy pink and white bench seats, oversized heart pillows, a purple bean bag chair, and soft cream carpet.",
        "Retro Pink Camper": "A vintage-style camper with a pink felt ceiling decorated with stars and string beads, a floral bench with knit cushions, pastel pink and yellow storage boxes, a high shelf of books and pottery, and a patterned pink rug.",
        "Rose Disco Camper": "A sleek camper interior in dusty rose, with pink cabinets and gold handles, a cream countertop and sink, velvet tufted booth seating around a white table, hanging mirror disco balls, and a rose-colored bed at the far end.",
        "Sunny Yellow Van": "A warm wooden van interior with a mustard-yellow bed under a back window, a blush tufted bench beside a wooden table, a yellow mini fridge and toaster, potted plants everywhere, and light wood floors.",
        "Scandinavian Wood Van": "A modern wooden camper van with a black countertop kitchen, spice racks, open overhead cabinets, a gray U-shaped dinette around a fold-out table, a cozy bed with linen pillows, and a view through the front cab windshield.",
        "All-Wood Cabin Van": "A fully wood-paneled van interior with a butcher-block kitchen and gas stove, a glass-walled tiled shower, a gray bench dinette, and a cozy white bed beneath the rear doors.",
        "Bright Minimalist Camper": "A cream and light oak camper interior with rounded cabinetry, a compact gas stove and sink, a cushioned dinette with a white table, a large ceiling skylight, and a bedroom visible down the hallway.",
        "Luxury Lofted Van": "A high-end van conversion with white cabinets and a wood ceiling, a kitchen with spice shelves, a glass shower and compact toilet, a jute runner rug, a dinette near the front seats, a lofted bed overhead, and a \"good things await\" doormat.",
        "Panoramic Skylight Van": "A modern van interior with two large panoramic roof windows, gray and wood cabinetry, a sleek kitchen with induction cooktop, a cushioned dinette with a wood table, a mounted TV, and a rear bed.",
        "Sage Green Cottage Van": "A cottage-style van with a curved pine ceiling, sage green cabinets with butcher-block counters, a white bed with a fringed throw and patterned pillows, potted ferns, wall shelves with plants, and patterned green and woven rugs.",
    },
    "Abandoned & Gritty": {
        "Abandoned Shower Hall": "A long, derelict institutional shower room with cracked green subway tiles, rows of curved green pipes and rusted showerheads, old radiators, a black-and-white hexagonal tiled floor littered with debris, frosted windows, and a lone red wooden chair.",
    },
    "Red": {
        "Burgundy Kitchen": "A moody kitchen with distressed burgundy-magenta cabinets and a matching textured range hood, gold bar handles, a charcoal-black backsplash and stone countertops, a stainless steel range with red knobs, a vase of crimson berry branches, and pale gray wood floors.",
        "Maroon Paneled Corner": "An elegant room corner with deep maroon walls covered in arched molded panels and fluted pilasters, a sculptural maroon leather armchair, a small mauve side table with a vase and book, a tall white-framed window, and a soft ivory carpet.",
        "Red and Green Bathroom": "A bold bathroom with glossy cherry-red tiled walls on one side and emerald green square tiles behind the vanity, a moss-textured green wall, a floating glossy red vanity with a dark green stone sink, a square mirror, a gold pendant lamp, folded red towels, a red bath mat, potted plants, a curved glass shower, and cream stone floors.",
        "Red Pole Suite": "A red-toned hotel suite with warm terracotta-red paneled walls and ceiling, a large upholstered bed with white bedding, a chrome pole in the center of the room, a large decorative X on the wall, dark curtains, and a bubbling jacuzzi tub in the foreground.",
        "Red Arch Lounge": "A modern lounge framed by thick tomato-red arches, with a glossy red floor, a round ribbed red rug, a curved red velvet sofa, a black-and-white marble side table, a marble-patterned bench, a large red-and-white wall painting, globe pendant lamps, potted olive trees in red planters, and white walls.",
        "Monochrome Red Living Room": "An all-red living room with deep crimson walls, a round red wall disc, a red sofa piled with square and round ruffled red pillows, a soft red throw draped on the floor, a red carpet, a cylindrical red side table, and a glass vase holding a rubber plant.",
        "Cozy Maroon Bedroom": "A cozy small bedroom with a maroon accent wall, floating wooden shelves with trailing plants and books, framed botanical prints, a wooden bed with burgundy bedding and cream pillows and throw, a tall maroon wardrobe, a wooden desk with a computer and a red office chair, a woven pendant lamp, fairy lights on sheer white curtains, a wood-slat ceiling, a fluffy beige rug, and patterned terracotta floor tiles.",
        "Red Molded Wall": "A plain studio wall in rich scarlet red with classic rectangular molded panels, carved rosette corner details, and a matching baseboard.",
        "Crimson Velvet Heart Lounge": "A romantic lounge with distressed crimson plaster walls, a large textured red heart mounted on the wall, a framed red heart painting, ornate candle wall sconces, a red crystal chandelier, a low L-shaped tufted red velvet sectional piled with red pillows, a round red floor pouf, and a deep red shag rug.",
    },
    "Pink": {
        "Fluffy Pink Reading Nook": "A cozy corner with bubblegum-pink wood-paneled walls and ceiling, an oversized shaggy pink faux-fur armchair, a round pink shag rug, a round mirror framed in pink feathers, a small pink wall shelf with trinkets, a pink-framed window with a sill of potted pink carnations, a pink radiator, and white painted floorboards.",
        "Pink Gallery Wall Corner": "A soft blush bedroom corner with a cream wall covered in pink framed prints of bows, hearts, flowers, stripes, and a crescent moon, a tall wavy full-length mirror, white floating shelves with candles, a mushroom lamp, and trailing pothos, a white dresser with pink hydrangeas, a small gold side table with a vase of pink flowers, a velvet pink pouf, and a pink flower-shaped rug on wooden floors.",
        "Black and Magenta Kitchen": "A sleek modern kitchen with matte black cabinets and slim black handles, a distressed hot-magenta backsplash, a smooth magenta countertop, smoky magenta glass globe pendant lamps, a magenta utensil holder, a bowl of citrus fruit, fresh bread on a wooden board, and dark gray wood floors.",
        "Lavender and Pink Hallway": "A playful hallway with lavender walls, bright hot-pink door frames and baseboards, a door covered in a colorful striped floral pattern, a mustard-yellow pendant lamp, a round yellow pedestal side table stacked with colorful books and a small floral vase, framed colorful floral art, and a pink and turquoise geometric patterned rug.",
        "Pink Floor Lounge Nook": "A dreamy floor lounge with peach-pink walls, a thick pink floor mattress piled with ribbed, fluffy, and textured pink pillows, round paper lanterns, hanging strands of beaded decorations, cascading pink flower vines across the ceiling, two large framed floral photographs, a sheer pink curtain, and a faded pink-and-cream patterned rug.",
        "Pink Princess Bedroom": "A sweet pink bedroom with blush walls, a tray ceiling with a fluffy pink pom-pom chandelier, a neon heart sign, floating shelves with plants, a bed with pink and cream bedding, a fluffy heart pillow and teddy bear, a white nightstand, a round pink bean bag with a cat cushion, a white desk with a pink office chair and shelves of pink decor, pink curtains with sheer panels, a potted palm, a fluffy pink rug, and a round pink floor cushion on glossy cream tiles.",
        "Glossy Pink Kitchen": "A U-shaped kitchen with high-gloss baby-pink cabinets trimmed in rose-gold, a pale pink countertop and backsplash, glass-front display cabinets with plates and trailing plants, a stainless steel range hood and oven, copper pots, potted green plants by the window, a vase of pink flowers, and glossy white floor tiles.",
        "Floral Pink Bedroom": "A cozy bedroom with soft pink walls, a gallery of small pink floral prints, white floating bookshelves with plants and an Eiffel tower figurine, a white desk with a table lamp and a white chair, a bed with pink floral bedding, a chunky pink knit throw, a big pink teddy bear and heart pillows, vine-draped floral curtains, a dreamcatcher, and a fluffy pink rug on glossy white tiles.",
        "Minimal Pink Arch Room": "A surreal, minimalist room entirely in soft rose pink, with smooth plaster walls and ceiling, tall arched windows with white sheer curtains, a large arched alcove, a rounded pink wall panel, a low modular pink sofa with plump bolster cushions, a square floor pouf, a fluffy pink feather plant in a white pot, and a plush pink carpet.",
    },
    "Elevator / Lift": {
        "Brushed Steel Service Lift": "A cramped elevator interior with brushed stainless steel walls, two vertical light strips framing the control panel, a small digital floor display, rows of round metal buttons, a mirrored side wall with a polished steel handrail, and a diamond-plate aluminum floor.",
        "Worn Steel Office Lift": "An everyday office elevator with scuffed stainless steel walls and sliding doors, a tall control panel with round metal buttons and a digital floor display, small yellow notice signs, a wall-mounted air freshener, a twin-bar steel handrail, and a dark reflective floor.",
        "Bronze Luxury Lift": "An upscale elevator with warm bronze-gold metal doors, textured champagne wood-grain side panels with tall inset mirrors, a slim bronze control panel with numbered buttons from 1 to 20 and a floor display, a recessed tray ceiling, and a polished beige-gray marble floor with dark inlaid border strips.",
        "Polished Steel Lobby Lift": "A clean, modern elevator with mirror-polished stainless steel walls and doors, a slatted steel light-grid ceiling, a slim side control panel with square buttons and a blue display screen, and a floor of dark brown marble bordering cream and beige marble tiles.",
        "Mirrored Steel Lift": "A compact elevator with brushed stainless steel walls, a full-width rear mirror above a horizontal steel handrail, a control panel with round buttons and a small red floor display, a dark mirrored ceiling with round recessed spotlights, and large dark gray square floor tiles.",
    },
}


class MBBackgroundRandomizer(io.ComfyNode):
    """The seed picks the background inside the chosen category when
    random_background is on; the category itself is never randomized."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesBackgroundRandomizer",
            display_name="Background Randomizer (MB)",
            category="MBNodes",
            description="Build a background prompt from a chosen or random background in a category.",
            search_aliases=["background", "backdrop", "scene", "setting", "random prompt"],
            inputs=[
                io.DynamicCombo.Input("category", options=[
                    io.DynamicCombo.Option(name, [io.Combo.Input("background", options=list(backgrounds), tooltip="Background used when random_background is off.")])
                    for name, backgrounds in BACKGROUNDS.items()
                ]),
                io.Boolean.Input("random_background", default=False, tooltip="Pick the background from the selected category using the seed instead of the background widget."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
            ],
            outputs=[io.String.Output("prompt")],
        )

    @classmethod
    def execute(cls, category, random_background, seed, weight) -> io.NodeOutput:
        backgrounds = BACKGROUNDS[category["category"]]
        name = random.Random(seed).choice(list(backgrounds)) if random_background else category["background"]
        return io.NodeOutput(weighted(backgrounds[name], weight))


NODES = [MBBackgroundRandomizer]
