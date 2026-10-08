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
        "Japandi Living Room": "A calm Japandi living room with a low oak platform sofa, linen cushions, a paper floor lamp, a round jute rug, a bonsai on a low table, and soft daylight through rice-paper screens.",
        "Mid-Century Den": "A mid-century den with a walnut-paneled wall, a cognac leather lounge chair, a teak sideboard with a record player, a sunburst wall clock, and an orange shag rug.",
        "Cozy Attic Bedroom": "A cozy attic bedroom with sloped white wood ceilings, a skylight above a low bed with knit throws, string lights along the beams, and a small reading chair.",
        "Dark Academia Library": "A dark academia library room with floor-to-ceiling bookshelves, a rolling ladder, a green banker's lamp on a leather-topped desk, and a worn Persian rug.",
        "Sunlit Plant Studio Apartment": "A sunlit studio apartment packed with hanging plants and potted monsteras, a cane daybed, white walls, and big industrial steel-framed windows.",
        "Moody Velvet Lounge": "A moody lounge with deep navy walls, a curved emerald velvet sofa, a brass floor lamp, a gold-framed abstract painting, and a marble coffee table.",
        "Coastal Bedroom": "A breezy coastal bedroom with whitewashed shiplap walls, linen bedding in sand tones, a rattan headboard, a woven pendant, and sheer curtains open to a sea view.",
        "Parisian Apartment": "A Parisian apartment room with herringbone parquet floors, ornate white wall moldings, a marble fireplace, a gilded mirror, and tall French windows.",
        "Industrial Loft": "An industrial loft with exposed red brick walls, black steel beams, polished concrete floors, a worn leather sofa, and Edison bulb pendant lights.",
        "Cottagecore Kitchen": "A cottagecore kitchen with sage cabinets, open wooden shelves of stoneware, a farmhouse sink, dried flowers hanging from a beam, and a gingham tablecloth.",
    },
    "Plain Walls & Minimal Sets": {
        "Height Chart Wall": "A plain studio wall marked with horizontal height lines and centimeter numbers from 100 to 200, like a lineup backdrop.",
        "Fairy Light Wall": "A blank beige wall with a single hanging planter of trailing greenery and a strand of tiny fairy lights draped down one side.",
        "Plant Shelf Wall": "A clean white wall beside a wooden pillar, with a hanging macramé planter, a large potted plant on the floor, and a floating wooden shelf holding small plants and stacked books.",
        "Balcony Corner": "A minimalist pale blue balcony corner with a black-framed sliding glass door, sheer white curtains behind it, small metal wall rungs, and a smooth tiled floor.",
        "Limewash Wall": "A soft taupe limewash wall with cloudy, mottled texture and a plain light oak floor.",
        "Concrete Wall": "A raw gray concrete wall with faint formwork lines and small tie holes above a smooth concrete floor.",
        "White Brick Wall": "A painted white brick wall with slightly uneven mortar lines and a pale wood floor.",
        "Arched Doorway Wall": "A warm cream plaster wall with an empty arched doorway leading into soft shadow.",
        "Window Shadow Wall": "A plain beige wall with sharp diagonal window-pane shadows cast across it by late afternoon sun.",
        "Palm Shadow Wall": "A white wall with soft palm-leaf shadows falling across it from an unseen window.",
        "Wood Slat Wall": "A wall of vertical oak slats with thin dark gaps between them above a matching wood floor.",
        "Pastel Color Block Wall": "A wall painted in two pastel blocks, peach on the bottom and lilac on top, split by a clean horizontal line.",
        "Tiled White Wall": "A wall of small glossy white square tiles with thin gray grout lines.",
        "Single Neon Sign Wall": "A dark charcoal wall with a single glowing pink neon sign in looping script.",
    },
    "Studio Sets": {
        "White Wavy Mirror Studio": "A minimalist all-white studio corner with arched wall panels, a tall black wavy-framed floor mirror, a light wood cane-back armchair, and a black adjustable bar stool on a smooth white floor.",
        "Terracotta Boho Studio": "A seamless warm terracotta studio backdrop with drooping palm fronds on one side, a woven seagrass vase of dried pampas grass resting on a rolled woven mat, and a round woven rug on the floor.",
        "Red Director's Chair Set": "A deep red seamless studio backdrop with a lone white folding director's chair standing in the center.",
        "Seamless Gray Backdrop": "A seamless mid-gray paper studio backdrop curving smoothly from wall to floor with soft, even lighting.",
        "Pastel Pink Backdrop": "A seamless pastel pink studio backdrop with a soft gradient falling off toward the edges.",
        "Cyclorama White Studio": "A bright white infinity cyclorama studio with no visible corners or horizon line.",
        "Black Void Studio": "A pure black studio backdrop with no visible edges, fading completely into darkness.",
        "Mottled Canvas Backdrop": "A hand-painted mottled canvas backdrop in muted blue-gray tones, like a classic portrait studio.",
        "Gradient Sunset Backdrop": "A seamless studio backdrop with a smooth gradient from warm orange at the bottom to soft pink at the top.",
        "Cube Prop Studio": "A minimal studio set with a few white geometric cube and cylinder props of different heights on a white floor.",
        "Arch Prop Studio": "A beige studio set with a tall freestanding pink arch prop and a round plinth beside it.",
        "Draped Fabric Studio": "A studio backdrop of loosely draped and pooled ivory silk fabric with soft, sculpted folds.",
        "Blue Chroma Studio": "A clean studio with a seamless saturated cobalt blue backdrop and matching blue floor.",
    },
    "Conceptual & Artistic": {
        "Newspaper Room": "A surreal box-shaped room with every surface, including the walls, floor, and ceiling, fully covered in black-and-white newspaper pages and photographs.",
        "Newspaper Corner": "A room corner plastered floor to ceiling with taped-up newspaper sheets, some pages peeling and curling at the bottom, with torn scraps and tape pieces scattered across the floor.",
        "Mirror Maze Room": "A surreal room lined with angled mirrors on every wall, repeating reflections into an endless corridor.",
        "Cloud Room": "A dreamlike white room filled with soft, fluffy clouds floating at floor and ceiling level.",
        "Balloon Room": "A room packed with hundreds of pastel balloons covering the floor and drifting against the ceiling.",
        "Flower Wall Room": "A room where every wall is covered in dense blooms of pink and white roses and peonies.",
        "Neon Tube Room": "A dark room crisscrossed by glowing neon light tubes in pink, blue, and violet.",
        "Paper Cutout Set": "A layered paper cutout set with oversized paper flowers, clouds, and hills in bright flat colors.",
        "Upside-Down Room": "A surreal room with furniture, lamps, and a rug fixed to the ceiling as if gravity were flipped.",
        "Infinity Light Room": "A dark mirrored room filled with hundreds of tiny suspended lights reflected into infinity.",
        "Hanging Fabric Strips": "A room filled with long hanging strips of translucent colored fabric swaying in soft light.",
        "Giant Book Pages Set": "A surreal set with oversized open book pages curling up from the floor like walls.",
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
        "Black Matte Stealth Van": "A sleek stealth van interior with matte black cabinets, a black quartz counter, warm LED strip lighting, a charcoal bench, and a rear bed with gray linen.",
        "Desert Boho Van": "A sand-toned van interior with cream cabinets, terracotta cushions, a macram\u00e9 wall hanging, dried pampas in a jar, and a woven kilim rug.",
        "Navy Nautical Van": "A van interior with navy blue lower cabinets, white upper cabinets, brass hardware, a striped bench cushion, rope accents, and a round porthole-style mirror.",
        "Teal Retro Camper": "A 1960s-style camper with teal laminate cabinets, chrome trim, a checkerboard floor, a red vinyl dinette, and lace curtains.",
        "Cozy Winter Van": "A cozy van interior with a small wood-burning stove, plaid wool blankets, sheepskin throws, warm lantern light, and frosted windows.",
        "Plant-Filled Jungle Van": "A van interior overflowing with hanging and potted plants, light wood walls, a green bench cushion, and a leafy canopy above the bed.",
        "Gray Modern Van": "A modern van interior with soft gray cabinets, a white solid-surface counter, a slim fold-down table, a gray bench, and a bed with crisp white sheets.",
        "Lavender Dream Van": "A pastel van interior with lavender cabinets, a white counter, fluffy white pillows, a lilac rug, and fairy lights along the ceiling.",
        "Surf Van": "A surf-style van interior with a surfboard racked overhead, whitewashed wood walls, a blue striped bench, beach towels, and an open sliding door.",
        "Vintage Wood Bus": "A converted school bus interior with long rows of warm wood paneling, a small kitchen, a dining nook, a wood stove, and a bed at the back.",
    },
    "Abandoned & Gritty": {
        "Abandoned Shower Hall": "A long, derelict institutional shower room with cracked green subway tiles, rows of curved green pipes and rusted showerheads, old radiators, a black-and-white hexagonal tiled floor littered with debris, frosted windows, and a lone red wooden chair.",
        "Abandoned Warehouse": "A vast abandoned warehouse with broken skylights, rusted steel columns, puddles on the cracked concrete floor, and graffiti on the walls.",
        "Derelict Hospital Ward": "A derelict hospital ward with peeling mint-green paint, a rusted metal bed frame, a toppled IV stand, and debris scattered across the floor.",
        "Ruined Ballroom": "A ruined ballroom with a fallen crystal chandelier, crumbling gilded moldings, faded wallpaper, and dust-covered parquet.",
        "Graffiti Underpass": "A concrete underpass covered in layered colorful graffiti, with a cracked floor and a single flickering fluorescent tube.",
        "Overgrown Greenhouse": "An abandoned greenhouse with shattered glass panes, rusted iron frames, and wild vines and weeds overtaking the interior.",
        "Empty Swimming Pool": "A drained, abandoned indoor swimming pool with cracked blue tiles, rusted ladders, and peeling paint on the walls.",
        "Rusted Factory Floor": "A rusted factory floor with abandoned heavy machinery, chains hanging from the ceiling, and oily stains on the concrete.",
        "Decaying Theater": "A decaying theater with torn red velvet seats, a tattered stage curtain, and light streaming through holes in the roof.",
        "Boarded-Up Diner": "An abandoned diner with cracked vinyl booths, a dusty counter, broken stools, and light leaking through boarded-up windows.",
        "Dim Parking Garage": "A dim, empty underground parking garage with stained concrete pillars, faded lane lines, and buzzing overhead lights.",
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
        "Red Neon Bar": "A moody bar bathed in red neon light, with a glossy black counter, red leather stools, and backlit shelves of bottles.",
        "Red Lacquer Dining Room": "A glamorous dining room with glossy red lacquered walls, a black table, red velvet chairs, and a brass chandelier.",
        "Red Velvet Theater Box": "A private theater box with red velvet walls and drapes, gilded trim, and a pair of red velvet chairs.",
        "Red Tiled Shower": "A sleek shower with glossy red zellige tiles, a brass rain showerhead, and a frosted glass door.",
        "Red Darkroom": "A photo darkroom lit only by a red safelight, with drying prints clipped on a line and trays on a counter.",
        "Red Curtain Stage": "A small stage backed by heavy draped red velvet curtains and a polished black floor.",
        "Cherry Red Diner": "A retro diner with cherry red booths, a checkerboard floor, chrome stools, and a red neon clock.",
        "Red Brick Alley Wall": "A narrow alley wall of deep red brick with a black fire escape and a single wall lamp.",
        "Red Lantern Room": "A room hung with dozens of glowing red paper lanterns over dark lacquered wooden furniture.",
        "Red Phone Booth Interior": "The inside of a classic red phone booth with small paned windows and an old black phone.",
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
        "Pink Neon Diner": "A retro diner with pink vinyl booths, pink neon signs, a mint-green counter, and a black-and-white checkered floor.",
        "Pink Marble Bathroom": "A luxurious bathroom with pink marble walls and floor, a freestanding white tub, and brass fixtures.",
        "Pink Ball Pit Room": "A playful room with pastel pink walls and a floor filled with pink and white plastic balls.",
        "Pink Tiled Pool": "An indoor pool lined with pale pink tiles, pink loungers, and pink-painted walls.",
        "Pink Boutique": "A boutique shop with blush walls, gold clothing rails, a velvet pink sofa, and a large round mirror.",
        "Pink Cafe": "A dreamy cafe with pink walls, a pink flower wall, pastel pink chairs, and marble tables with cakes.",
        "Pink Beauty Salon": "A beauty salon with pink salon chairs, round Hollywood-bulb mirrors, and shelves of pastel products.",
        "Pink Tulle Studio": "A studio draped in layers of soft pink tulle hanging from the ceiling and pooling on the floor.",
        "Pink Vanity Corner": "A vanity corner with a white desk, a lighted round mirror, pink makeup organizers, and a fluffy pink chair.",
        "Pink Sky Window Room": "A plain pastel pink room with a large window showing a cotton-candy pink sunset sky.",
    },
    "Elevator / Lift": {
        "Brushed Steel Service Lift": "A cramped elevator interior with brushed stainless steel walls, two vertical light strips framing the control panel, a small digital floor display, rows of round metal buttons, a mirrored side wall with a polished steel handrail, and a diamond-plate aluminum floor.",
        "Worn Steel Office Lift": "An everyday office elevator with scuffed stainless steel walls and sliding doors, a tall control panel with round metal buttons and a digital floor display, small yellow notice signs, a wall-mounted air freshener, a twin-bar steel handrail, and a dark reflective floor.",
        "Bronze Luxury Lift": "An upscale elevator with warm bronze-gold metal doors, textured champagne wood-grain side panels with tall inset mirrors, a slim bronze control panel with numbered buttons from 1 to 20 and a floor display, a recessed tray ceiling, and a polished beige-gray marble floor with dark inlaid border strips.",
        "Polished Steel Lobby Lift": "A clean, modern elevator with mirror-polished stainless steel walls and doors, a slatted steel light-grid ceiling, a slim side control panel with square buttons and a blue display screen, and a floor of dark brown marble bordering cream and beige marble tiles.",
        "Mirrored Steel Lift": "A compact elevator with brushed stainless steel walls, a full-width rear mirror above a horizontal steel handrail, a control panel with round buttons and a small red floor display, a dark mirrored ceiling with round recessed spotlights, and large dark gray square floor tiles.",
        "Glass Panoramic Lift": "A glass-walled panoramic elevator with a polished steel frame, looking out over a city skyline.",
        "Vintage Cage Lift": "An old-fashioned elevator with an ornate brass scissor gate, wood-paneled walls, and a dial floor indicator.",
        "Mirrored Gold Lift": "A glamorous elevator with fully mirrored walls and ceiling trimmed in gold, and a black marble floor.",
        "Neon-Lit Lift": "A modern elevator with brushed black walls and pink and blue neon strips along the edges.",
        "Freight Elevator": "A large freight elevator with dented steel walls, quilted moving pads, a pull-down gate, and a scuffed floor.",
        "Hotel Velvet Lift": "A boutique hotel elevator with tufted emerald velvet wall panels, brass handrails, and a patterned carpet.",
        "Wood-Paneled Lift": "A classic elevator with warm walnut-paneled walls, brass buttons, and a soft ceiling light.",
        "Hospital Lift": "A wide hospital elevator with white walls, steel handrails, a bright overhead light, and a gray vinyl floor.",
        "Graffiti Lift": "A worn elevator with scratched steel walls tagged in graffiti and a flickering overhead light.",
        "Futuristic White Lift": "A sleek futuristic elevator with seamless glossy white walls, a glowing ceiling panel, and a touchscreen display.",
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
