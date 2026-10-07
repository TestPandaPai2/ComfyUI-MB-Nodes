"""Woman's wardrobe picker: a category, a style within it (each fixed or
seeded-random) and that style's full outfit description."""

import random
import re

from comfy_api.latest import io


def weighted(text, weight):
    return text if weight == 1.0 else f"({text}:{weight:.2f})"

MAX_SEED = 0xFFFFFFFFFFFFFFFF


def _sections(block):
    """Upper-case lines start a category; "Name: description" lines fill it."""
    out = {}
    for line in block.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        if line.isupper():
            items = out[line.title()] = {}
        else:
            name, text = line.split(": ", 1)
            items[name] = text
    return out


WARDROBE = _sections("""
GOWNS

Ball Gown: She wears a grand ball gown with a fitted lace bodice, delicate cap sleeves, and a sweetheart neckline, flowing into an enormous full skirt layered with tulle that sweeps across the floor.
A-Line Gown: She wears an elegant A-line gown with a deep V-neckline and a fitted bodice, the skirt gently widening from the waist into a smooth, floor-length silhouette trimmed with delicate embellishment.
Mermaid Gown: She wears a dramatic mermaid gown with a draped sweetheart bodice, hugging her body tightly from bust to knee before bursting into a full, ruffled tail that pools on the floor.
Trumpet Gown: She wears a graceful trumpet gown fitted through the bodice and hips, with a softer flare starting at mid-thigh and delicate lace appliqué scattered across the fabric.
Sheath Gown: She wears a sleek sheath gown with a simple V-neckline, falling in a straight, narrow line from shoulder to floor with subtle draping gathered at one hip.
Empire Waist Gown: She wears a romantic empire waist gown with a jeweled V-neck bodice, a raised waistline just beneath the bust, and a long, softly flowing chiffon skirt.
Fit-and-Flare Gown: She wears a fit-and-flare gown with an off-shoulder wrapped neckline, the fabric fitted closely through her waist and hips before flaring into a full, sweeping hem.
Princess Gown: She wears a regal princess gown with a strapless sweetheart bodice and an enormous, voluminous skirt made of richly patterned brocade fabric.
Column Gown: She wears a minimalist column gown with a strapless, softly draped bodice and a narrow, perfectly straight silhouette falling all the way to the floor.
Slip Gown: She wears a silky slip gown with thin spaghetti straps, a soft cowl neckline, and a liquid satin skirt with a high thigh slit.
Off-Shoulder Gown: She wears an off-shoulder gown with a folded neckline resting below her shoulders, a fitted bodice, and a softly flowing floor-length skirt.
One-Shoulder Gown: She wears a one-shoulder gown with a single wide strap, asymmetrical draping across the bodice, and a long skirt with a high slit up one leg.
Halter Gown: She wears a sleek halter gown with a high neckline wrapping behind her neck, bare shoulders, and a fluid, floor-length skirt that moves with every step.
Strapless Gown: She wears a strapless gown with a pleated sweetheart bodice fitted at the waist and a full, flowing skirt that sweeps the floor.
High-Low Gown: She wears a high-low gown with a lace-embellished bodice and a layered skirt that is short in the front and sweeps dramatically long behind her.
Cape Gown: She wears a regal cape gown with a long, flowing cape draped from her shoulders all the way to the floor over a sleek, fitted column dress.
Tiered Gown: She wears a tiered gown with a strapless bodice and a skirt built from several stacked horizontal layers of fabric, each wider than the last.
Ruffle Gown: She wears a ruffle gown with a fitted strapless bodice and layers of cascading ruffles tumbling down the length of the skirt.
Corset Gown: She wears a corset gown with a structured, boned bodice that cinches her waist tightly, flowing into a soft, airy floor-length skirt.
Sparkle A-Line Gown: She wears a sparkling A-line gown with a jeweled V-neck bodice and a glittering, shimmering skirt scattered with sequins and crystals.

HOODIES

Oversized Hoodie: She wears an oversized hoodie with dropped shoulders, long baggy sleeves, a roomy hood, and a front kangaroo pocket, giving her a slouchy, relaxed streetwear look.
Cropped Hoodie: She wears a cropped hoodie that ends just above her waist, with a boxy fit, puffed sleeves, ribbed cuffs, and a drawstring hood.
Zip-Up Hoodie: She wears a classic zip-up hoodie with a full front zipper, a drawstring hood, ribbed cuffs, and two front pockets, perfect for easy layering.
Pullover Hoodie: She wears a soft pullover hoodie with a drawstring hood, a large front kangaroo pocket, ribbed cuffs, and no zipper for a classic casual look.
Fitted Hoodie: She wears a fitted hoodie with a slim cut that follows her silhouette, long snug sleeves, and a drawstring hood, sleek enough to wear under a blazer.
Graphic Hoodie: She wears a roomy graphic hoodie with a bold printed design across the chest, a drawstring hood, and a front pocket for a statement streetwear look.

SKIRTS

Mini Skirt: She wears a short ruched mini skirt made of stretchy fabric that hugs her hips and ends high on her thighs.
Ruffle Skirt: She wears a flirty ruffle mini skirt with two layers of tiered ruffles, a ruched waistband, and drawstring ties at the sides.
Slit Mini Skirt: She wears a sleek, fitted mini skirt in smooth fabric with a small slit cut into the hem at one side.
High Slit Maxi Skirt: She wears a long ruched maxi skirt with a crossover waistband and a dramatic high slit running up the front of one leg.
Mermaid Skirt: She wears a mermaid skirt with a ruched waistband, fitted closely through her hips and thighs before flaring out gracefully toward her ankles.
Tiered Skirt: She wears a flowing tiered midi skirt with an elastic drawstring waist and three gathered layers that bounce with every step.
Asymmetrical Skirt: She wears an asymmetrical skirt with a slanted, uneven hem, side ruching, and a sculpted, high waistband.
A-Line Skirt: She wears a classic A-line skirt fitted at the waist and flaring gently outward to knee length, simple and elegant.
Cargo Skirt: She wears a belted cargo mini skirt with large utility flap pockets on both sides and a sturdy, casual cotton fabric.

BRAS

Underwire Bra: She wears an underwire bra with sheer lace cups, delicate straps, and supportive wire shaping beneath each cup.
Bandeau Bra: She wears a strapless bandeau bra made of a smooth, stretchy band of fabric wrapped snugly around her chest.
Stick-On Bra: She wears a strapless, backless stick-on bra with adhesive cups that attach directly to the skin, invisible under open-back outfits.
Sports Bra: She wears a supportive sports bra with a racerback design, a wide elastic underband, and breathable fabric for workouts.
Full-Cup Bra: She wears a full-cup bra with complete coverage cups, sheer mesh panels, and wide supportive straps.
Longline Bra: She wears a longline bra with lace cups and an extended band reaching down toward her waist, almost like a light corset.
Molded-Cup Bra: She wears a molded-cup bra with smooth, seamless pre-shaped cups that create a clean line under fitted tops.
Built-In Bra: She wears a top with a built-in bra stitched into the lining, offering support without a separate undergarment.
Nursing Bra: She wears a soft, stretchy nursing bra with clip-down cups designed for easy access and all-day comfort.
Racerback Bra: She wears a racerback bra with straps that meet in a Y-shape between her shoulder blades for extra support.
Plunge Bra: She wears a plunge bra with a deep V-shaped center gore designed to sit hidden under low-cut necklines.
Convertible Bra: She wears a convertible bra with removable, adjustable straps that can be worn classic, halter, crisscross, or strapless.
Push-Up Bra: She wears a push-up bra with padded, angled cups that lift and shape for a fuller silhouette.
Balconette Bra: She wears a balconette bra with horizontal cup tops and wide-set straps that frame square and wide necklines.
Triangle Bra: She wears a delicate lace triangle bra with soft, unstructured triangular cups and thin straps.
Corset Bra: She wears a corset bra with a structured, boned bodice that extends down to her waist and fastens with hooks at the front.
Bralette: She wears a soft lace bralette with no underwire or padding, light and delicate enough to peek out from under tops.
Minimizer Bra: She wears a full-coverage minimizer bra designed to smooth and reduce projection for a streamlined silhouette.
T-Shirt Bra: She wears a smooth, seamless t-shirt bra with lightly molded cups that stay invisible under fitted tops.
Strapless Bra: She wears a strapless bra with a firm, grippy band and structured cups that stay secure without shoulder straps.
Wireless Bra: She wears a soft wireless bra with stretchy, supportive fabric for comfortable, everyday wear.
Demi-Cup Bra: She wears a lace demi-cup bra with half-coverage cups and straps set wide on her shoulders.
Front-Closure Bra: She wears a front-closure bra that fastens with a clasp at the center front for easy on and off.
Adhesive Bra: She wears silicone adhesive cups that stick directly to the skin for a fully strapless, backless look.
Halter Bra: She wears a halter bra with straps that wrap around and tie behind her neck.
Seamless Bra: She wears a seamless bra knitted in one piece without seams, smooth and soft against the skin.
Padded Bra: She wears a padded bra with lightly cushioned cups that add shape and smooth coverage.
Sheer Bra: She wears a sheer mesh bra with delicate lace detailing and thin straps.
Shelf Bra: She wears a camisole-style top with a built-in shelf bra offering light support.
Maternity Bra: She wears a soft, stretchy maternity bra with wide straps and an adjustable band for comfort and support.

BODYCON DRESSES

Spaghetti Strap Bodycon Dress: She wears a body-hugging spaghetti strap bodycon mini dress in stretchy fabric, with thin shoulder straps and a straight neckline that follows her curves.
One Shoulder Bodycon Dress: She wears a one shoulder bodycon dress with a single wide strap, asymmetrical draping across the body, and a wrapped, slanted hem.
Strapless Bodycon Dress: She wears a strapless bodycon dress with a ruched, gathered bust and a short, tightly fitted skirt that hugs her figure.
Square Neck Bodycon Dress: She wears a long-sleeve square neck bodycon dress with a clean, squared neckline framing her collarbones and a snug mini skirt.
Halter Neck Bodycon Dress: She wears a halter neck bodycon dress with straps tied behind her neck, a plunging V-neckline, and a fitted mini skirt.
High Neck Bodycon Dress: She wears a sleeveless high neck bodycon dress with a mock-style collar and a sleek, fitted silhouette that shows off her arms.
Turtleneck Bodycon Dress: She wears a long-sleeve turtleneck bodycon dress with a folded collar and a snug fit, cozy yet sleek for cooler weather.
Wrap Bodycon Dress: She wears a long-sleeve wrap bodycon dress with a crossover V-neck, ruched sides, and a tie knotted at her waist.
Off Shoulder Bodycon Dress: She wears a long-sleeve off shoulder bodycon dress with a straight neckline resting below her shoulders and a fitted mini skirt.
Cut-Out Bodycon Dress: She wears a cut-out bodycon dress with open panels at the waist and chest, a one-shoulder strap, and a ruched, wrapped skirt.
Mesh Panel Bodycon Dress: She wears a mesh panel bodycon dress with sheer long sleeves, a see-through chest panel, and an opaque fitted skirt.
Corset Bodycon Dress: She wears a corset bodycon dress with a structured, visibly boned bodice, thin straps, and a snug mini skirt.
Sweetheart Neck Bodycon Dress: She wears a sweetheart neck bodycon dress with a heart-shaped neckline, thin straps, and tightly ruched fabric.
Ruched Bodycon Dress: She wears a ruched bodycon dress with gathered fabric running down the front, thin straps, and a drawstring at the hem.
Criss Cross Bodycon Dress: She wears a criss cross bodycon dress with straps crossing over at the neck and a sleek, fitted silhouette.
Cowl Neck Bodycon Dress: She wears a cowl neck bodycon dress with a softly draped, falling neckline and thin straps.
Asymmetrical Bodycon Dress: She wears an asymmetrical bodycon dress with one long sleeve, one bare shoulder, and a cut-out at the waist.
Keyhole Bodycon Dress: She wears a long-sleeve keyhole bodycon dress with a high neck and a teardrop opening at the center of the neckline.
Tank Style Bodycon Dress: She wears a ribbed tank style bodycon dress with wide straps and a simple scoop neck, casual and sleek.
Long Sleeve Bodycon Dress: She wears a minimalist long sleeve bodycon dress with a round neckline and smooth, figure-hugging fabric.

CROP TOPS

Basic Crop Top: She wears a basic short-sleeve crop top in soft cotton with a round neckline, ending just above her waist.
Tank Crop Top: She wears a sleeveless tank crop top with wide straps and a scoop neckline, simple and sporty.
Cami Crop Top: She wears a cami crop top with thin spaghetti straps and a soft, straight neckline.
Halter Crop Top: She wears a halter crop top with straps tied behind her neck and bare shoulders.
One Shoulder Crop Top: She wears a one shoulder crop top with a single slanted strap and a sleek, fitted body.
Off Shoulder Crop Top: She wears an off shoulder crop top with elasticated puffed sleeves resting below her shoulders and a cinched hem.
Bardot Crop Top: She wears a bardot crop top with a wide, straight neckline that sits across her upper arms and short sleeves.
Strapless Crop Top: She wears a strapless crop top that sits snugly around her chest with no straps.
Tube Top: She wears a stretchy tube top that wraps smoothly around her chest in a simple band.
Square Neck Crop Top: She wears a square neck crop top with a straight neckline and wide straps.
V Neck Crop Top: She wears a ribbed V neck crop top with a pointed neckline and sleeveless fit.
U Neck Crop Top: She wears a U neck crop top with a deep, rounded neckline and wide straps.
Collared Crop Top: She wears a collared crop top with a pointed collar, a button front, and short sleeves.
Polo Crop Top: She wears a polo crop top with a ribbed collar, a short button placket, and short sleeves.
Button-Up Crop Top: She wears a button-up crop top with a collar and puffed short sleeves, preppy and sweet.
Tie Front Crop Top: She wears a tie front crop top knotted into a bow at the center of the bust.
Knot Front Crop Top: She wears a knot front crop top with fabric gathered into a twist at the center of the bust.
Twist Front Crop Top: She wears a twist front crop top with fabric twisted at the center and a fitted, sleeveless body.
Ruched Crop Top: She wears a ruched crop top with drawstring gathering at the center and short cap sleeves.
Scrunch Crop Top: She wears a scrunch crop top with gathered fabric at the center of the bust and wide straps.
Smocked Crop Top: She wears a smocked crop top with stretchy shirred fabric and ruffled straps.
Peplum Crop Top: She wears a peplum crop top with a fitted bodice and a short flared ruffle at the hem.
Ribbed Crop Top: She wears a ribbed crop top in textured, stretchy fabric with a V neckline.
Knit Crop Top: She wears a cozy cable knit crop top with a textured weave and wide straps.
Sleeveless Crop Top: She wears a sleeveless crop top with a high, rounded neckline and a clean athletic cut.
Capped Sleeve Crop Top: She wears a crop top with short capped sleeves that just cover the tops of her shoulders.
Long Sleeve Crop Top: She wears a fitted long sleeve crop top with a sweetheart neckline.
Bell Sleeve Crop Top: She wears a bell sleeve crop top with sleeves that flare out wide at the wrists.
Puff Sleeve Crop Top: She wears a puff sleeve crop top with full, rounded short sleeves and a sweetheart neckline.
Balloon Sleeve Crop Top: She wears a balloon sleeve crop top with voluminous sleeves gathered at the cuffs.
Cut Out Crop Top: She wears a cut out crop top with an open slit across the chest.
Backless Crop Top: She wears a backless crop top held in place by strings tied behind her neck and lower back.
Cross Back Crop Top: She wears a cross back crop top with thin straps crisscrossing over her back.
Wrap Crop Top: She wears a wrap crop top that crosses over the front and ties at the side of her waist.
Asymmetrical Hem Crop Top: She wears a crop top with a slanted, asymmetrical hem that dips lower on one side.
High Neck Crop Top: She wears a sleeveless high neck crop top with a mock collar.
Turtleneck Crop Top: She wears a long-sleeve turtleneck crop top, sleek and fitted.
Zip-Up Crop Top: She wears a zip-up crop top with a front zipper and fitted long sleeves.
Hoodie Crop Top: She wears a cropped hoodie top with a drawstring hood and long sleeves.
Sweatshirt Crop Top: She wears a cropped sweatshirt with a relaxed fit, ribbed cuffs, and a round neckline.
Graphic Crop Top: She wears a graphic crop tee with a bold printed design on the front.
Mesh Crop Top: She wears a mesh crop top with sheer long sleeves over a solid band across the chest.
Linen Crop Top: She wears a button-front linen crop top with wide straps, light and breathable.
Satin Crop Top: She wears a glossy satin crop top with a softly draped cowl neckline and thin straps.
Velvet Crop Top: She wears a plush velvet crop top with a V neckline, rich and soft.
Lace Crop Top: She wears a delicate lace crop top with scalloped edges and thin straps.
Sequin Crop Top: She wears a sparkling sequin crop top with thin straps that catches the light.
Corset Crop Top: She wears a structured corset crop top with boning and front hook closures.
Denim Crop Top: She wears a denim crop top with a sweetheart neckline and thin straps.
Leather Crop Top: She wears a sleek leather crop top with a scoop neckline and an edgy finish.
Sports Crop Top: She wears a supportive sports crop top with a scoop neck, made for workouts.
Yoga Crop Top: She wears a stretchy racerback yoga crop top in soft, breathable fabric.
Bandana Crop Top: She wears a triangle bandana crop top tied around her back.
Scarf Crop Top: She wears a patterned silk scarf tied into a cropped wrap top.

VIRGIN KILLER

Backless Sleeveless Turtleneck Sweater: She wears a sleeveless ribbed turtleneck sweater that covers her front completely but is fully open at the back down to her waist.
Backless Long-Sleeve Turtleneck Sweater: She wears a long-sleeve ribbed turtleneck sweater with a deep V-shaped opening that runs down the back to her waist.
Backless Knit Dress: She wears a sleeveless ribbed turtleneck knit dress with a fitted silhouette and a fully open back.
Open-Back Turtleneck Dress: She wears a long-sleeve ribbed turtleneck dress with a large rounded cut-out at the back, fastened by a single button at the neck.
Backless Halter Knit Top: She wears a sleeveless halter knit top with a turtleneck collar and a ribbon bow tied across her open back.
Open-Back Ribbed Knit Top: She wears a long-sleeve ribbed knit top with a keyhole cut-out at the front and an open back closed by a buckle strap.
Criss-Cross Back Sweater: She wears a long-sleeve turtleneck sweater with ribbon straps crisscrossing over the open back and tied in a bow.
Lace-Up Back Knit Top: She wears a sleeveless turtleneck knit top with corset-style lacing running up the back.
Keyhole-Back Turtleneck: She wears a long-sleeve ribbed turtleneck with a small teardrop keyhole opening at the back.
Open-Back Cropped Sweater: She wears a long-sleeve cropped turtleneck sweater with an open back closed by a buckle strap.
Off-Shoulder Backless Knit Top: She wears a long-sleeve off-shoulder knit top with a wide folded collar and an open back.
Backless Knit Bodysuit: She wears a sleeveless ribbed turtleneck bodysuit with a fully open back.

BACKLESS DRESSES

Deep Plunge Back Dress: She wears a deep plunge back dress with a dramatic V-shaped back opening that drops all the way to her waist, supported by a boned bodice in front.
Open-Back Halter Dress: She wears an open-back halter dress with straps fastened at the nape of her neck, leaving her entire back and sides bare in a sleek, summery silhouette.
Cowl Back Dress: She wears a bias-cut cowl back dress with soft folds of fabric draping in a low, cascading scoop across her open back.
Crisscross Back Dress: She wears a crisscross back dress with straps crossing in an X over her bare back, with open panels between them.
Keyhole Back Dress: She wears a keyhole back dress, fully covered except for a small teardrop cutout at the back framed by a single button at her neck.
Ladder-Back Dress: She wears a ladder-back dress with horizontal straps running across her open back like the rungs of a ladder, creating a structured grid.
Tie-Back Dress: She wears a tie-back dress with long fabric ties extending from the sides and knotted in a soft bow at the center of her open back.
Lace-Up Back Dress: She wears a lace-up back dress with eyelets lining the open back edges, threaded with cord that crisscrosses like corset lacing.
Strappy Back Dress: She wears a strappy back dress with several thin straps arranged in parallel and geometric patterns across her bare back.
Open-Back Bodycon Dress: She wears a stretchy open-back bodycon dress that hugs her figure tightly in front and opens into a wide cutout at the back.
Low Scoop Back Dress: She wears a low scoop back dress with a wide, rounded U-shaped opening sweeping well below her shoulder blades.
One-Shoulder Backless Dress: She wears a one-shoulder backless dress whose single strap leads into a diagonal, asymmetrical open cut across her back.
Racerback Cutout Dress: She wears a racerback cutout dress with straps meeting in a Y between her shoulder blades and wide open side cutouts.
Backless Wrap Dress: She wears a backless wrap dress with a crossover V-neck front tied at the waist and a low, open back.
Backless Maxi Dress: She wears a floor-length backless maxi dress with a deep back cut and a long, sweeping skirt that trails behind her.
Backless Midi Dress: She wears a backless midi dress with a mid-calf hem, a covered front, and an elegant open back.
Backless Mini Dress: She wears a short backless mini dress that ends above mid-thigh, with a structured bodice and a bare back.
Backless A-Line Dress: She wears a backless A-line dress with a fitted bodice, an open back, and a skirt that flares softly from the waist.
Backless Slip Dress: She wears a silky backless slip dress with spaghetti straps, a bias-cut drape, and a low back that catches the light.
Backless Shift Dress: She wears a straight, boxy backless shift dress at knee length in structured fabric, with a scoop opening at the back.
Backless Ball Gown: She wears a backless ball gown with a boned bodice, a dramatically open back, and a voluminous tulle skirt.
Backless Fit-and-Flare Dress: She wears a backless fit-and-flare dress fitted through the bodice and hips, with an open back and a skirt flaring at the knee.
Backless Column Gown: She wears a narrow, floor-length backless column gown with a long open back creating a clean line from neck to waist.
Backless Ruched Dress: She wears a backless ruched dress with gathered stretch fabric across the front and sides and a smooth open back.
Backless Mermaid Dress: She wears a backless mermaid dress fitted from the torso to mid-thigh before flaring into a dramatic fishtail hem, with a deeply cut back.
Backless Tiered Dress: She wears a flowing backless tiered dress with cascading layers of light chiffon and a halter-style open back.
Strapless Open-Back Dress: She wears a strapless open-back dress with a boned tube-style bodice and a low-cut back, held up entirely by its structure.
Square-Neck Open-Back Dress: She wears a square-neck open-back dress with a straight, geometric front neckline and a low or crisscross back.
V-Neck Open-Back Dress: She wears a V-neck open-back dress with a V neckline in front mirrored by a matching V-shaped back opening.
Sweetheart-Neck Open-Back Dress: She wears a sweetheart-neck open-back dress with a heart-shaped boned bodice and a romantic open back.
Off-Shoulder Open-Back Dress: She wears an off-shoulder open-back dress that bares her shoulders and collarbones while dipping low behind.
Cowl-Neck Open-Back Dress: She wears a cowl-neck open-back dress with softly draped folds at the front neckline and a bare, fluid back.
Scoop-Neck Open-Back Dress: She wears a scoop-neck open-back dress with a wide U-shaped front neckline and a low scooped back.
Plunge-Front Open-Back Dress: She wears a plunge-front open-back dress with a deep V neckline in front and a bare back for a bold statement.
Bandeau Open-Back Dress: She wears a bandeau open-back dress with a strapless, tube-style bodice and a low back below.
Boat-Neck Open-Back Dress: She wears a boat-neck open-back dress with a wide shoulder-to-shoulder neckline in front and a dramatically low back.
Silk Charmeuse Open-Back Dress: She wears a liquid silk charmeuse open-back dress that drapes in soft, glossy folds around her bare back.
Chiffon Backless Dress: She wears a floaty chiffon backless dress with sheer, airy layers that hover around her open back.
Lace Open-Back Dress: She wears a lace open-back dress with sheer patterned lace across her back, lined only up to the waist.
Velvet Open-Back Dress: She wears a rich velvet open-back dress with a plush front and a clean bare back.
Sequin Open-Back Dress: She wears a sparkling sequin open-back dress in a single color, with a bare back contrasting the shimmering fabric.
Satin Open-Back Dress: She wears a lustrous satin open-back dress with a smooth, structured drape that glows along the back edges.
Jersey Knit Open-Back Dress: She wears a stretchy jersey knit open-back dress, soft and casual, molding smoothly around the back opening.
Crepe Open-Back Dress: She wears a matte crepe open-back dress with a clean, minimalist back cut and crisp edges.
Cotton Voile Open-Back Dress: She wears a light, semi-sheer cotton voile open-back dress that is breezy and summery.
Mesh Open-Back Dress: She wears a translucent mesh open-back dress with an open-weave texture across the back for a fashion-forward look.
Bridal Backless Gown: She wears a bridal backless gown with a boned bodice and an open back trimmed with lace, illusion tulle, or a row of buttons.
Cocktail Open-Back Dress: She wears a knee-length cocktail open-back dress in structured satin or crepe with a polished back opening.
Resort Beach Backless Dress: She wears a relaxed linen resort backless dress, breezy and breathable for beach days and seaside dinners.
Black-Tie Backless Gown: She wears a floor-length black-tie backless gown in heavy satin with a fully finished, polished open back.
Date Night Backless Dress: She wears a midi date night backless dress in matte jersey with a subtle, memorable open-back detail.
Festival Backless Dress: She wears a festival backless dress with a maximalist strappy, lace-up open back in durable fabric.
Club Going-Out Backless Dress: She wears a short, shimmering club backless dress with a dramatic open back and a stretch fit made for dancing.
Prom Formal Backless Dress: She wears a prom backless dress with a full ball-gown skirt and a dramatic boned open back.
Destination Wedding Guest Backless Dress: She wears a flowing chiffon midi backless dress with a halter tie, light and elegant for a destination wedding.
Editorial Backless Dress: She wears an editorial backless dress with an architectural geometric cutout and asymmetric drape at the back.
Beaded-Back Dress: She wears a beaded-back dress with crystal beadwork framing the straps and edges of her open back like jewelry.
Embroidered Open-Back Dress: She wears an embroidered open-back dress with intricate stitched patterns along the back edges and straps.
Cut-Out Geometric Back Dress: She wears a cut-out geometric back dress with precise triangle and diamond openings across an otherwise covered back.
Crochet Open-Back Dress: She wears a crochet open-back dress with a looped, handmade pattern across her back for a boho look.
Bow-Back Dress: She wears a bow-back dress with a large, structured satin bow at the center of her open back.
Chain-Detail Open-Back Dress: She wears a chain-detail open-back dress with metal chains draped across her bare back.
Ruffle-Back Dress: She wears a ruffle-back dress with cascading chiffon ruffles framing the open back and moving with every step.
Button-Back Dress: She wears a button-back dress with a row of pearl buttons running down the center seam of the back.
Illusion-Tulle Back Dress: She wears an illusion-tulle back dress with sheer skin-tone tulle filling the back so it appears bare while staying covered.

TOPS

Halter Neck Top: She wears a silky halter neck top with a draped cowl front and thin ties fastened behind her neck, leaving her shoulders and back bare.
One Shoulder Top: She wears a one shoulder top in soft satin with a single wide strap, gathered ruching along the side, and a tie knotted at the hip.
Corset Top: She wears a structured satin corset top with visible boning, a sweetheart neckline, and a sculpted fit that cinches her waist.
Cowl Neck Top: She wears a cowl neck top in fluid satin with thin straps and a softly draped neckline that falls in graceful folds.
Off Shoulder Top: She wears a ruched off shoulder top with a folded neckline resting below her shoulders and gathered fabric hugging her torso.
Tube Top: She wears a stretchy ruched tube top that wraps snugly around her chest with no straps.
Twist Front Top: She wears a twist front top with thin straps and fabric knotted into a soft twist at the center of the bust.
Cross Halter Top: She wears a cross halter top with wide satin bands crossing over her chest and wrapping around her neck, with a small keyhole at the center.
Puff Sleeve Top: She wears a puff sleeve top with a structured, button-front corset bodice, a sweetheart neckline, and full puffed short sleeves.
Ruched Top: She wears a long-sleeve ruched top with drawstring gathering down the center front and a fitted silhouette.
Tie Front Top: She wears a tie front top with long flared sleeves and two front panels knotted into a soft bow at the bust.
Wrap Top: She wears a wrap top with fluttery short sleeves, a crossover V-neck, and a tie knotted at the side of her waist.
High Neck Top: She wears a sleeveless high neck top with a mock collar and a smooth, fitted body.
Square Neck Top: She wears a square neck top with wide straps, a straight neckline, and ruched fabric across the torso.
One Sleeve Top: She wears a one sleeve top with a single long sleeve, a bare opposite shoulder, and a thin asymmetrical strap.
Mesh Top: She wears a sheer mesh top with long see-through sleeves layered over a solid bra-style band.
Peplum Top: She wears a peplum top with a button-front bodice, wide straps, and a short flared ruffle at the hem.
Bow Detail Top: She wears a satin bow detail top with thin straps and an oversized bow tied across the front.
Button Down Top: She wears a classic fitted button down shirt with a pointed collar and long sleeves.
One Shoulder Drape Top: She wears a long-sleeve one shoulder drape top with a draped strap across one shoulder and ruched fabric down the body.
Bustier Top: She wears a structured bustier top with a sweetheart neckline, boning, and thin straps.
Velvet Top: She wears a long-sleeve velvet top with a square neckline and soft ruching, rich and plush.
Asymmetric Top: She wears an asymmetric one-shoulder top with a slanted hem that dips lower on one side.
Deep V Halter Top: She wears a deep V halter top with a plunging neckline and straps fastened around her neck.
Long Sleeve Tie Top: She wears a long sleeve tie top with full balloon sleeves and front panels knotted into a bow.
Satin Drape Top: She wears a satin drape top with thin straps and a softly falling cowl neckline.
Sheer Tie Front Top: She wears a sheer tie front top with flared chiffon sleeves knotted at the front over a solid bralette.
Knit Off Shoulder Top: She wears a knit off shoulder top with a wide folded neckline and a fitted, ribbed body.
Cut Out Halter Top: She wears a cut out halter top with a ring detail at the neck and a keyhole opening at the center.
Off Shoulder Drape Top: She wears a long-sleeve off shoulder drape top with a softly draped neckline and fitted sleeves.
Wrap Tie Front Top: She wears a wrap tie front top with long puffed sleeves and a crossover front tied at the waist.
Sheer Mesh Top: She wears a sheer mesh top with long see-through sleeves and a ruched bandeau layered underneath.
Asymmetrical Top: She wears a long-sleeve asymmetrical top with one bare shoulder and ruched fabric down the side.
Lace Up Front Top: She wears a lace up front corset-style top with eyelet lacing down the center and thin straps.
Satin Ruched Top: She wears a long-sleeve satin ruched top with gathered fabric down the front and a sweetheart neckline.
Eyelet Tie Front Top: She wears an eyelet tie front top with puffed sleeves and a soft bow at the bust.
Draped Neck Top: She wears a sleeveless draped neck top with a deep cowl neckline and wide straps.
Sheer Lace Top: She wears a long-sleeve sheer lace top with floral lace over a solid bralette.
Sweetheart Top: She wears a sweetheart top with a heart-shaped neckline, puffed short sleeves, and a fitted bodice.
Criss Cross Top: She wears a criss cross halter top with straps crossing over the chest and wrapping around the neck.
Ruffle Off Shoulder Top: She wears a ruffle off shoulder top with a wide ruffled flounce falling over her shoulders and a ruched body.
Gathered Center Top: She wears a long-sleeve gathered center top with drawstring ruching at the middle and a cropped hem.
One Shoulder Ruched Top: She wears a long-sleeve one shoulder ruched top with gathered fabric across the body.
Printed Cowl Top: She wears a printed cowl top with a marbled pattern, thin straps, and a draped neckline.
Sheer Ruched Top: She wears a long-sleeve sheer ruched top with gathered mesh fabric down the front.
Strapless Corset Top: She wears a strapless corset top with a structured, boned bodice and a straight neckline.
Sheer Striped Top: She wears a long-sleeve sheer striped top with fine vertical stripes over a solid bralette.

BLOUSES

Royal Deep V-Neck Blouse: She wears a royal velvet blouse with a deep V-neckline in front and back, short sleeves, and rich zari embroidery, tied at the back with tasseled strings.
Classic High Neck Embroidered Blouse: She wears a classic high neck blouse with short sleeves and intricate embroidery across the fabric, fastened down the back with a row of hooks.
Backless Tie-Up Designer Blouse: She wears a backless tie-up designer blouse with a V-neck front, short sleeves, floral embroidery, and an open back held by tasseled ties.
Sweetheart Neckline Silk Blouse: She wears a sweetheart neckline silk blouse with short sleeves, delicate embroidery, and corset-style lacing down the back.
Boat Neck Minimalist Blouse: She wears a boat neck minimalist silk blouse with short sleeves, a thin embroidered border, and a deep round back tied with tassels.
Halter Neck Contemporary Blouse: She wears a halter neck contemporary blouse with dense embellishment, bare shoulders, and a strand of tassels running down the open back.
Sheer Net Sleeve Glam Blouse: She wears a glam blouse with sheer net long sleeves, a sequined sweetheart bodice, and a teardrop keyhole at the back.
Peplum Style Fusion Blouse: She wears a peplum style fusion blouse with short sleeves, floral embroidery, a flared peplum hem, and an oval cut-out at the back.
Corset Fit Structured Blouse: She wears a corset fit structured blouse with thin straps, a sweetheart neckline, embroidered panels, and lacing up the back.
Off-Shoulder Luxury Blouse: She wears an off-shoulder luxury velvet blouse with a wide embroidered neckline resting below her shoulders.
Keyhole Back Elegant Blouse: She wears an elegant blouse with short sleeves, subtle embroidery, a high round neck, and a teardrop keyhole opening at the back.
Jacket Style Layered Blouse: She wears a jacket style layered blouse with long brocade sleeves worn open over a fitted inner top, with a keyhole at the back.
Sweetheart Strap Embroidered Blouse: She wears a sleeveless blouse with wide straps and a deep sweetheart neckline, covered in dense embroidery.
Cold Shoulder Embroidered Blouse: She wears a heavily embroidered blouse with a round neck and detached cuffs at the upper arms, leaving her shoulders bare.
Square Neck Embroidered Blouse: She wears a sleeveless square neck blouse with intricate embroidery, paired with a draped dupatta over one shoulder.
One Shoulder Embroidered Blouse: She wears a one shoulder blouse with a single wide strap and rich embroidery across the bodice.
Draped Saree Blouse: She wears a draped saree-style blouse with fabric wrapped across her body, a single puffed sleeve with an embroidered cuff, and a pallu falling over one shoulder.
Choker Halter Cut-Out Blouse: She wears a halter blouse with an embroidered choker collar and a large keyhole cut-out in front.
Cape Style Cut-Out Blouse: She wears a cape style blouse with a mandarin collar, sheer flowing fabric, embroidered borders, and cut-outs at the shoulders.
Halter V-Neck Embroidered Blouse: She wears a halter blouse with a deep V-neckline and dense embroidery along the straps and edges.
Cold Shoulder Tie-Front Blouse: She wears a plain cold shoulder blouse with off-shoulder sleeves and long tasseled ties at the front.

SUMMER DRESSES

Spaghetti Strap Summer Dress: She wears a light spaghetti strap summer dress with a smocked bodice and a flowing tiered midi skirt.
Puff Sleeve Summer Dress: She wears a puff sleeve summer dress with a square neckline, a fitted bodice, and a flared skirt dotted with a tiny cherry print.
Tie Shoulder Dress: She wears a tie shoulder dress with bow-tied straps, a sweetheart bodice, and a full skirt in a ditsy floral print.
Ruffle Sleeve Dress: She wears a ruffle sleeve dress with fluttery cap sleeves, a smocked bodice, and a tiered eyelet skirt.
Tie Strap Dress: She wears a tie strap dress with ribbon-tied shoulder straps and a flared skirt in a cheerful cherry print.
Toile Print Dress: She wears a toile print dress with wide straps, a sweetheart bodice, and a full skirt covered in scenic toile patterns.
Embroidered Summer Dress: She wears an embroidered summer dress with thin straps, a tie at the V-neck, a smocked waist, and a tiered skirt with floral embroidery.
Bold Floral Dress: She wears a bold floral dress with bow-tied straps, a sweetheart bodice, and a full skirt in large florals.
Off Shoulder Summer Dress: She wears a crisp off shoulder summer dress with a ruffled neckline and a full, flowing skirt.
Halter Neck Summer Dress: She wears a halter neck summer dress with a tie at the neck, a ruched bodice, and a full skirt in a floral print.
Toile Floral Dress: She wears a toile floral dress with thin straps, a smocked bodice, and a skirt in soft floral patterns.
Cherry Print Dress: She wears a cherry print dress with ribbon-tied straps, a ruched bust, and a flared skirt.
Ruched Halter Dress: She wears a ruched halter dress with a tie at the neck, a gathered bodice, and a floral skirt.
Ruched Bust Dress: She wears a ruched bust dress with thin straps, a gathered neckline, and side tie details.
Ruched Midi Dress: She wears a ruched midi dress with thin straps, a gathered bodice with a dropped waist, and a flared skirt.
Strapless Summer Dress: She wears a strapless summer dress with a smocked bodice and a full skirt in a tulip floral print.

JUMPSUITS

Blazer Jumpsuit: She wears a tailored blazer jumpsuit with a lapel collar, a wrap V-neck, short sleeves, and wide-leg trousers.
Tie-Shoulder Jumpsuit: She wears a tie-shoulder jumpsuit with bow-tied straps, a straight neckline, and wide-leg trousers.
Button-Front Jumpsuit: She wears a button-front jumpsuit with wide straps, front buttons, flap pockets, and wide-leg trousers.
One-Shoulder Jumpsuit: She wears a one-shoulder jumpsuit with a single strap and long, flowing wide-leg trousers.
Denim Bow Jumpsuit: She wears a denim bow jumpsuit with thin straps, a bow detail at the bust, and wide-leg denim trousers.
Cowl Neck Jumpsuit: She wears a cowl neck jumpsuit with thin straps, a draped neckline, and wide-leg trousers.
Linen Jumpsuit: She wears a linen jumpsuit with wide straps, a square neckline, and relaxed wide-leg trousers.
Tie-Strap Jumpsuit: She wears a tie-strap jumpsuit with bow-tied straps, a straight bodice, and wide-leg trousers.
Button-Down Jumpsuit: She wears a button-down jumpsuit with a sweetheart neckline, thin straps, front buttons, and wide-leg trousers.
Striped Button-Down Jumpsuit: She wears a striped button-down jumpsuit with thin straps and a row of buttons down the front.
Off-Shoulder Jumpsuit: She wears an off-shoulder jumpsuit with a folded neckline below her shoulders and flared trousers.
Belted Jumpsuit: She wears a belted jumpsuit with thin straps, a cinched waist belt, and wide-leg trousers.
Double-Breasted Jumpsuit: She wears a sleeveless double-breasted jumpsuit with a V-neck, metal buttons, and wide-leg trousers.
Cowl Belted Jumpsuit: She wears a belted jumpsuit with a cowl neckline, sleeveless bodice, and a matching belt.
Bow Front Jumpsuit: She wears a bow front jumpsuit with thin straps, an oversized bow at the bust, and wide-leg trousers.
Short-Sleeve Double-Breasted Jumpsuit: She wears a short-sleeve double-breasted jumpsuit with a V-neck and covered buttons.
Checkered Vest Jumpsuit: She wears a checkered jumpsuit with a buttoned vest-style bodice and wide-leg trousers.
Puff-Sleeve Jumpsuit: She wears a puff-sleeve jumpsuit with a sweetheart twist neckline and wide-leg trousers.

JERSEYS

Oversized Football Jersey: She wears an oversized football jersey with a V-neck collar, short sleeves, and a large printed number across the front.
Varsity Jersey: She wears a varsity football jersey with contrast stripes on the sleeves, a crest patch, and a big contrast number.
Classic Mesh Football Jersey: She wears a classic mesh football jersey with striped sleeves, a contrasting collar, and a bold number on the chest.
Retro Striped Sleeve Jersey: She wears a retro jersey with block numbers, contrast shoulder stripes, and a ribbed V-neck.
Two-Tone Panel Jersey: She wears a two-tone football jersey with a contrasting shoulder yoke and large numbers in a matching shade.
Script Logo Jersey: She wears a boxy jersey with a cursive script wordmark above an oversized number and striped sleeves.
Bow Embroidered Jersey: She wears a football jersey with a contrast V-neck collar, distressed numbers, and small bows embroidered down the sleeves.

KURTIS

Short Kurti: She wears a short kurti with a fitted bodice, a sweetheart neckline, short sleeves, and a flared hem with large painted floral motifs, paired with slim trousers.
A-Line Kurti: She wears a printed A-line kurti with a square neckline, short sleeves, and side slits, flaring gently from the bust to the knee over jeans.
Flared Kurti: She wears a flared kurti with a V-neck, long bell sleeves, and a large floral print, swinging loosely at the hips.
Bell Sleeve Kurti: She wears a bell sleeve kurti with a square neckline, long flared sleeves, and an all-over geometric print.
Strappy Kurti: She wears a strappy kurti with thin straps, a straight neckline, and a fitted silhouette in a fine block print.
Straight Kurti: She wears a straight kurti with a round neck, flared sleeves, and a monochrome motif print, falling straight past her hips.
Sleeveless Kurti: She wears a sleeveless kurti with a square neckline, side slits, and embroidered borders along the hem.
Tie Neck Kurti: She wears a tie neck kurti with a keyhole neckline tied with a thin string, long flared sleeves trimmed in lace, and a floral print.
Lace Trim Kurti: She wears a printed kurti with a round neck, flared long sleeves, and delicate lace trim at the cuffs and hem.
""")


COLORS = [
    "black", "white", "ivory", "champagne", "nude", "blush pink", "baby pink", "hot pink",
    "red", "crimson", "burgundy", "wine", "coral", "peach", "orange", "mustard yellow",
    "lemon yellow", "sage green", "emerald green", "olive green", "mint green", "teal",
    "turquoise", "sky blue", "royal blue", "navy blue", "lavender", "lilac", "purple",
    "plum", "gold", "silver", "beige", "camel", "chocolate brown", "charcoal grey", "heather grey",
]


def _colored(text, color):
    """Slot the color in after "She wears", fixing the a/an article."""
    def sub(m):
        if not m.group(1):
            return f"She wears {color} "
        return f"She wears {'an' if color[0] in 'aeiou' else 'a'} {color} "
    return re.sub(r"^She wears (an? )?", sub, text, count=1)


class MBWardrobeSelector(io.ComfyNode):
    """One seed drives both random picks: the category (when randomized) and
    the style inside it (when randomized or when the category was)."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesWardrobeSelector",
            display_name="Woman's Wardrobe Selector (MB)",
            category="MBNodes",
            description="Output a woman's outfit description from a chosen or random category and style.",
            search_aliases=["wardrobe", "outfit", "clothing", "dress", "gown", "random prompt"],
            inputs=[
                io.DynamicCombo.Input("category", options=[
                    io.DynamicCombo.Option(name, [
                        io.Combo.Input("style", options=list(items), tooltip="Style used when random_style is off."),
                    ])
                    for name, items in WARDROBE.items()
                ], tooltip="Wardrobe category used when random_category is off."),
                io.Boolean.Input("random_category", default=False, tooltip="Pick the category from the seed. Also randomizes the style."),
                io.Boolean.Input("random_style", default=False, tooltip="Pick the style within the category from the seed."),
                io.Boolean.Input("random_color", default=False, tooltip="Put a seeded-random color before the outfit."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
            ],
            outputs=[io.String.Output("prompt")],
        )

    @classmethod
    def execute(cls, category, random_category, random_style, random_color, seed, weight) -> io.NodeOutput:
        rng = random.Random(seed)
        name = rng.choice(list(WARDROBE)) if random_category else category["category"]
        items = WARDROBE[name]
        style = rng.choice(list(items)) if random_category or random_style else category["style"]
        text = _colored(items[style], rng.choice(COLORS)) if random_color else items[style]
        return io.NodeOutput(weighted(text, weight))


NODES = [MBWardrobeSelector]
