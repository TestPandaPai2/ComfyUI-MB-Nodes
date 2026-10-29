"""Woman's wardrobe picker: a category, a style within it (each fixed or
seeded-random) and that style's full outfit description, plus topwear and
bottomwear outputs where the outfit splits into them."""

import random
import re

from comfy_api.latest import io

from .common import COLORS, MAX_SEED, METALLICS, NEUTRALS, PATTERNS, weighted


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

Short Kurti: She wears a short kurti with a fitted bodice, a sweetheart neckline, short sleeves, and a flared hem with large painted floral motifs.
A-Line Kurti: She wears a printed A-line kurti with a square neckline, short sleeves, and side slits, flaring gently from the bust to the knee.
Flared Kurti: She wears a flared kurti with a V-neck, long bell sleeves, and a large floral print, swinging loosely at the hips.
Bell Sleeve Kurti: She wears a bell sleeve kurti with a square neckline, long flared sleeves, and an all-over geometric print.
Strappy Kurti: She wears a strappy kurti with thin straps, a straight neckline, and a fitted silhouette in a fine block print.
Straight Kurti: She wears a straight kurti with a round neck, flared sleeves, and a monochrome motif print, falling straight past her hips.
Sleeveless Kurti: She wears a sleeveless kurti with a square neckline, side slits, and embroidered borders along the hem.
Tie Neck Kurti: She wears a tie neck kurti with a keyhole neckline tied with a thin string, long flared sleeves trimmed in lace, and a floral print.
Lace Trim Kurti: She wears a printed kurti with a round neck, flared long sleeves, and delicate lace trim at the cuffs and hem.
Anarkali Kurti: She wears a floor-sweeping Anarkali kurti with a fitted bodice, a high round neck, full sleeves, and dozens of flared panels that swirl outward from an empire waist.
Angrakha Kurti: She wears an angrakha kurti with an overlapping wrap front tied at the side with tasseled strings, three-quarter sleeves, and a soft block-printed pattern.
Kaftan Kurti: She wears a loose kaftan kurti with wide batwing sleeves, a deep V-neck edged in gold gota lace, and a flowing, airy cut in sheer georgette.
Asymmetric Hem Kurti: She wears an asymmetric kurti with a hem that dips long on one side and rises high on the other, a mandarin collar, and sleeveless armholes.
High-Low Kurti: She wears a high-low kurti that is short at the front and falls long at the back, with a boat neck and elbow-length sleeves in solid mustard cotton.
Front Slit Kurti: She wears a long kurti with a single dramatic slit running up the center front, a sweetheart neckline, and fitted full sleeves.
Jacket Style Kurti: She wears a jacket-style kurti with a separate embroidered sleeveless short jacket layered over a plain fitted inner kurti.
Shirt Collar Kurti: She wears a straight kurti with a crisp shirt collar, a full button placket down the front, roll-up sleeves, and a curved shirttail hem.
Peplum Kurti: She wears a short peplum kurti with a fitted bodice and a ruffled flare that bursts out just below the waist, with cap sleeves and a square neck.
Tiered Kurti: She wears a tiered kurti built from three gathered layers of soft cotton, each tier trimmed with a thin contrast lace band, and puffed short sleeves.
Cold Shoulder Kurti: She wears a cold shoulder kurti with cut-outs baring her shoulders, long flared sleeves below them, and an all-over paisley print.
Off-Shoulder Kurti: She wears an off-shoulder kurti with an elasticated ruffled neckline resting across her upper arms and a relaxed, flowy body in pastel chiffon.
Halter Neck Kurti: She wears a halter neck kurti tied behind her neck, leaving her shoulders and upper back bare, with a mirror-work yoke across the chest.
Pleated Yoke Kurti: She wears a kurti with a fine pintucked pleated yoke across the bust, a round neck, and a straight, loose body in breezy linen.
Chikankari Kurti: She wears a white Lucknowi chikankari kurti covered in delicate shadow-work floral embroidery, with a round neck and three-quarter sleeves.
Bandhani Kurti: She wears a bandhani kurti in vivid red and yellow tie-dye dots, with a V-neck, short sleeves, and a straight cut.
Ikat Kurti: She wears an ikat kurti woven in blurred indigo and white geometric patterns, with a notched round neck and three-quarter sleeves.
Kalamkari Kurti: She wears a hand-painted kalamkari kurti with earthy rust and black mythological motifs, a mandarin collar, and wooden buttons.
Ajrakh Kurti: She wears an ajrakh block-printed kurti in deep indigo and madder red geometric stars, with a keyhole neck and full sleeves.
Phulkari Kurti: She wears a phulkari kurti densely embroidered with bright silk-thread geometric flowers across the yoke and sleeves.
Mirror Work Kurti: She wears a mirror work kurti with tiny round mirrors stitched in bright thread across the neckline, sleeves, and hem, catching the light.
Gota Patti Kurti: She wears a gota patti kurti trimmed with shiny gold ribbon appliqué flowers along the neckline, sleeves, and border.
Zari Embroidered Kurti: She wears a rich silk kurti with metallic zari embroidery forming a dense floral border at the neckline and cuffs.
Velvet Kurti: She wears a deep emerald velvet kurti with a high neck, full sleeves, and fine gold embroidery scattered across the bodice.
Organza Overlay Kurti: She wears a kurti with a sheer floral organza overlay floating over a solid satin inner layer, with puff sleeves and a scalloped hem.
Denim Kurti: She wears a denim kurti in washed blue chambray with a mandarin collar, a half button placket, and contrast white stitching.
Khadi Kurti: She wears a handspun khadi kurti with a slightly nubby texture, a simple round neck, side pockets, and a relaxed, earthy look.
Ruffle Sleeve Kurti: She wears a kurti with layered ruffles cascading down the sleeves, a V-neck, and a soft polka-dot print.
Puff Sleeve Kurti: She wears a fitted kurti with voluminous puff sleeves gathered at the shoulders and cuffs, a square neck, and a small floral print.
Band Collar Kurti: She wears a kurti with a wide Chinese-style band collar, frog-button fastenings down one side, and a jacquard woven pattern.
Layered Cape Kurti: She wears a kurti with an attached sheer cape falling from the shoulders over the arms, the cape edged in sequins.
Wrap Front Kurti: She wears a wrap-front kurti that crosses over the bust and ties at the waist with a fabric belt, with bishop sleeves.
Belted Kurti: She wears a straight kurti cinched at the waist with a thin embroidered belt, a round neck, and three-quarter sleeves.
Gathered Waist Kurti: She wears a kurti gathered at the waist with a smocked panel, a fitted bodice above, and a softly flared body falling below it.
Princess Cut Kurti: She wears a princess-cut kurti with vertical seams shaping the bust and waist, a deep sweetheart neck, and a gently flared knee-length body.
Kalidar Kurti: She wears a kalidar kurti cut from many triangular panels that fan out into a full, swirling hem, in rich maroon silk.
Long Jacket Overlay Kurti: She wears a sleeveless inner kurti under a sheer, open-front long jacket with full sleeves and a lace border running down both front edges.
Pakistani Straight Kurti: She wears a long, straight Pakistani-style kurti reaching below the knee, with an embroidered neckline, a buttoned placket, and a printed lawn fabric.
Short Tunic Kurti: She wears a short tunic kurti ending at the hip, with a split neck, roll-tab sleeves, and a crisp striped cotton fabric.
Sequin Party Kurti: She wears a party kurti covered in shimmering sequins over a sheer georgette base, with a deep V-neck and full sheer sleeves.
Sanganeri Print Kurti: She wears a Sanganeri hand-block printed kurti covered in fine floral buttis on a light cotton base, with a round neck and three-quarter sleeves.
Bagru Print Kurti: She wears a Bagru block-printed kurti in earthy vegetable-dyed motifs of small flowers and vines, with a notched neck and elbow sleeves.
Dabu Print Kurti: She wears a dabu mud-resist printed kurti with crackled indigo-dyed floral patterns, a mandarin collar, and full sleeves.
Leheriya Kurti: She wears a leheriya kurti dyed in bright diagonal wave stripes, with a V-neck, short sleeves, and a flowing straight cut.
Shibori Kurti: She wears a shibori tie-dye kurti with soft folded and bound indigo patterns, a round neck, and loose three-quarter sleeves.
Kantha Stitch Kurti: She wears a kantha kurti covered in rows of fine running-stitch embroidery forming birds and flowers across the yoke and hem.
Kashmiri Aari Kurti: She wears a Kashmiri aari-embroidered kurti with dense chain-stitch paisleys and chinar leaves spreading across the neckline and sleeves.
Tilla Work Kurti: She wears a Kashmiri tilla work kurti with metallic thread embroidery curling in floral vines along the neckline, cuffs, and border.
Banarasi Brocade Kurti: She wears a Banarasi brocade kurti woven with gold zari floral buttis and a heavy woven border at the hem.
Chanderi Kurti: She wears a sheer Chanderi silk-cotton kurti with a soft sheen, small woven gold buttis, and a delicate scalloped hem.
Maheshwari Kurti: She wears a Maheshwari kurti in fine silk-cotton with a woven striped border at the hem and sleeves, and a simple round neck.
Jamdani Kurti: She wears a Jamdani kurti in sheer handwoven muslin with tiny woven geometric motifs floating across the fabric.
Madhubani Print Kurti: She wears a Madhubani print kurti with bold folk-art fish, peacocks, and flowers outlined in fine black lines.
Warli Print Kurti: She wears a Warli print kurti decorated with simple white tribal figures dancing in circles across an earthy base.
Bagh Print Kurti: She wears a Bagh hand-block printed kurti with crisp red and black geometric and floral motifs on an off-white base.
Kutch Embroidery Kurti: She wears a Kutch embroidered kurti with bright interlacing stitches and tiny mirrors forming geometric patterns across the yoke.
Sindhi Tanka Kurti: She wears a Sindhi tanka kurti with colorful thread embroidery and small round mirrors framing the neckline and sleeves.
Kashida Paisley Kurti: She wears a kashida embroidered kurti with flowing paisley and floral vines stitched across the front panel.
Batik Kurti: She wears a batik kurti with wax-resist dyed floral patterns and fine crackle lines running through the fabric.
Pichwai Print Kurti: She wears a Pichwai print kurti with lotus flowers, cows, and leaves in traditional painted style across the hem and sleeves.
Hip-Length Crop Kurti: She wears a hip-length crop kurti ending just at the hip bone, with a round neck, short sleeves, and a straight cut.
Short A-Line Kurti Top: She wears a short A-line kurti top that flares gently to the hip, with a square neck and puff sleeves.
Short Straight Kurti: She wears a short straight kurti ending at the hip, with side slits, a round neck, and three-quarter sleeves, made to pair with jeans.
Short Flared Kurti: She wears a short flared kurti that swings out just above the hip, with a V-neck and flutter sleeves.
Short Kaftan Kurti: She wears a short kaftan kurti with wide batwing sleeves and a loose, airy body that ends at the hip.
Short Angrakha Top: She wears a short angrakha top with an overlapping wrap front tied at the side, ending at the hip, with elbow sleeves.
Short Tie-Up Kurti: She wears a short kurti ending at the hip, with a front tie-up knot at the hem and a keyhole neckline.
Short Peplum Kurti Top: She wears a short kurti top with a fitted bodice and a small peplum flare that ends at the hip, with cap sleeves.
Short Kurti with Tassels: She wears a short hip-length kurti with tasseled tie strings at the neckline and a playful printed body.
Short Shirt Kurti: She wears a short shirt-style kurti ending at the hip, with a collar, a full button placket, and roll-up sleeves.
Short Smocked Kurti: She wears a short kurti with a smocked bodice and a softly gathered body that ends at the hip, with puff sleeves.
Short Embroidered Yoke Kurti: She wears a short hip-length kurti with a richly embroidered yoke and a plain flowing body below it.
Short Sleeveless Kurti: She wears a short sleeveless kurti ending at the hip, with a high mandarin collar and a fitted cut.
Short Asymmetric Kurti: She wears a short kurti with an angled hem that rises from one hip to the other, with a boat neck and elbow sleeves.
Short Bell Sleeve Kurti: She wears a short hip-length kurti with dramatic bell sleeves and a square neckline.
Short Tiered Kurti: She wears a short kurti with two gathered tiers ending at the hip, trimmed with thin lace bands.
Short Wrap Kurti: She wears a short wrap kurti that crosses over the bust and ties at the side, ending at the hip.
Short Box Kurti: She wears a short boxy kurti with a relaxed square shape, dropped shoulders, and a hem that stops at the hip.
Short Pintuck Kurti: She wears a short hip-length kurti with fine pintucks down the front, a round neck, and three-quarter sleeves.
Short Front Slit Kurti: She wears a short kurti ending at the hip, with a small center slit at the hem and a sweetheart neckline.
Pathani Kurta: She wears a Pathani-style kurta with a structured shirt collar, a half button placket, a long straight body, and full sleeves with cuffs.
Afghani Kurta: She wears an Afghani kurta with a loose, flowing body, a round neck with a short slit, and wide full sleeves.
Nehru Collar Kurta: She wears a straight kurta with a short stand-up Nehru collar, a concealed button placket, and full sleeves.
Panjabi Style Kurta: She wears a Bengali panjabi-style kurta with a band collar, a side-buttoned placket, and a long, loose straight body.
Long Straight Kurta: She wears a long straight kurta reaching past her knees, with a round neck, side slits, and full sleeves.
Calf-Length Kurta: She wears a calf-length kurta with a simple slit neck, a straight cut, and deep side slits for easy movement.
Side-Button Kurta: She wears a kurta that fastens with a row of fabric-covered buttons along one shoulder, with a high neck and full sleeves.
Achkan Style Kurta: She wears an achkan-style kurta with a fitted body, a high band collar, a front button line, and a knee-length flared hem.
Kurta with Pockets: She wears a relaxed cotton kurta with patch pockets at the hips, a notched neck, and rolled sleeves.
Short Sleeve Kurta: She wears a straight kurta with crisp short sleeves, a mandarin collar, and a clean knee-length hem.
Overlap Neck Kurta: She wears a kurta with an overlapping crossover neckline, a straight body, and full sleeves.
Embroidered Placket Kurta: She wears a plain straight kurta with a richly embroidered button placket running down the front.
Kurta Dress: She wears a knee-length kurta on its own as a dress, with a flared A-line body, a round neck, and short sleeves.
Belted Kurta Dress: She wears a kurta as a dress on its own, cinched at the waist with a fabric belt, falling just above the knee.
Shirt Kurta Dress: She wears a long shirt-style kurta as a dress, with a collar, a full button placket, and a curved hem above the knee.
Tiered Kurta Dress: She wears a tiered kurta dress on its own, with gathered layers flaring from the waist to the knee.
Sleeveless Kurta Dress: She wears a sleeveless kurta as a dress, with a V-neck and a straight body ending just above the knee.
Kaftan Kurta Dress: She wears a loose kaftan kurta as a dress, with wide batwing sleeves and a flowing body to the knee.
Anarkali Kurta Dress: She wears a short Anarkali kurta as a dress on its own, with a fitted bodice and a full flared skirt to the knee.
Wrap Kurta Dress: She wears a wrap kurta as a dress, crossing over the bust and tied at the waist, with three-quarter sleeves and a knee-length hem.
Potli Button Neck Kurti: She wears a kurti with a deep slit neckline lined with tiny round potli buttons, a straight cut, and three-quarter sleeves.
Boat Neck Kurti: She wears a kurti with a wide boat neckline sitting across her collarbones, a straight body, and elbow sleeves.
Sweetheart Neck Kurti: She wears a kurti with a curved sweetheart neckline, a fitted bodice, and short puff sleeves.
Square Neck Kurti: She wears a kurti with a clean square neckline, a fitted bodice, and a softly flared body.
U-Neck Kurti: She wears a kurti with a deep U-shaped neckline edged in lace, a straight cut, and three-quarter sleeves.
Keyhole Neck Kurti: She wears a kurti with a round neck and a small keyhole opening closed with a single loop button.
Collar Neck Kurti: She wears a kurti with a soft flat Peter Pan collar, a straight body, and short sleeves.
Mandarin Collar Kurti: She wears a kurti with a short stand-up mandarin collar, a half placket, and full sleeves.
Notched Round Neck Kurti: She wears a kurti with a round neck cut with a small V-notch at the center, a straight cut, and elbow sleeves.
Angrakha Neck Kurti: She wears a kurti with an overlapping angrakha-style neckline tied with a string, a fitted bodice, and full sleeves.
Leaf Neck Kurti: She wears a kurti with a neckline cut in a pointed leaf shape and edged in piping, with three-quarter sleeves.
Scalloped Neck Kurti: She wears a kurti with a scalloped neckline edged in embroidery, a straight body, and short sleeves.
Chinese Collar Kurti: She wears a kurti with a narrow Chinese collar, a button-down front, and roll-up sleeves.
Henley Neck Kurti: She wears a kurti with a henley neckline and a short button placket, in a relaxed straight cut.
Cowl Neck Kurti: She wears a kurti with a soft draped cowl neckline falling in folds at the chest, with a fluid flared body.
High Neck Kurti: She wears a kurti with a high neck closed at the back, a fitted body, and sleeveless armholes.
Asymmetric Neck Kurti: She wears a kurti with a one-sided slanted neckline fastened with buttons at the shoulder.
Gathered Neck Kurti: She wears a kurti with a neckline gathered on a drawstring, creating soft ruffles around the neck.
Pleated Neck Kurti: She wears a kurti with fine knife pleats radiating from a round neckline, and a flowing straight body.
Deep V-Neck Kurti: She wears a kurti with a plunging V-neckline, a fitted bodice, and long flared sleeves.

DUPATTAS

Chiffon One-Shoulder: She wears a sheer chiffon dupatta pinned at her left shoulder, the length falling in soft folds down her back and the front edge floating by her arm.
Georgette Both Shoulders: She wears a light georgette dupatta laid across both shoulders, the two ends hanging evenly down her front to her knees.
Banarasi Over Head: She wears a Banarasi silk dupatta with a heavy woven zari border draped over her head, framing her face and falling over both shoulders.
Organza U-Drape: She wears a crisp organza dupatta draped in a U across her neck, both ends tossed back over her shoulders to fall behind her.
Net Cape Drape: She wears an embroidered net dupatta draped like a cape, pinned at both shoulders and flowing down her back to the floor.
Phulkari Over One Shoulder: She wears a vibrant Phulkari dupatta densely embroidered with geometric silk-thread flowers, thrown over one shoulder with the end hanging to her hip.
Bandhani Head Veil: She wears a tie-dyed Bandhani dupatta dotted with tiny resist-dye circles, pulled loosely over her head with the edge resting on her forehead.
Leheriya Crossed Chest: She wears a Leheriya dupatta with diagonal wave stripes, crossed over her chest with each end thrown back over the opposite shoulder.
Chikankari Elbow Drape: She wears a soft Chikankari dupatta with delicate shadow-work thread embroidery, resting low behind her back and looped over both elbows.
Kalamkari Side Drape: She wears a hand-painted Kalamkari dupatta with mythological motifs, draped from one shoulder diagonally across her body to the opposite hip.
Ajrak Neck Wrap: She wears a block-printed Ajrak dupatta with intricate geometric patterns, wrapped once around her neck with both ends hanging down her back.
Gota Patti Bridal Veil: She wears a gota patti dupatta edged with shimmering ribbon-work borders, draped over her head as a bridal veil and pinned to her hair.
Mirror Work Waist Tuck: She wears a mirror-work dupatta studded with small round mirrors, draped over one shoulder with the other end tucked into her waist.
Velvet Shawl Drape: She wears a plush velvet dupatta with an embroidered border, draped around both shoulders like a shawl and held closed at her chest.
Pashmina Wrap: She wears a fine Pashmina dupatta with paisley sozni embroidery, wrapped snugly around her shoulders with one end flung over her shoulder.
Tissue Over Arms: She wears a shimmering tissue dupatta draped loosely across her back and over both forearms, catching the light as it falls.
Crushed Cotton Casual: She wears a crinkled crushed-cotton dupatta casually tossed around her neck, the ends hanging unevenly down her front.
Kota Doria Single Pleat: She wears a translucent Kota Doria dupatta with a checked weave, pleated narrowly and pinned at one shoulder, falling straight down her back.
Sequin Party Drape: She wears an all-over sequin dupatta that glitters as she moves, draped over one arm and trailing behind her.
Zardozi Heavy Border: She wears a dupatta with a wide hand-embroidered zardozi border of metallic thread and beads, draped over one shoulder and spread wide behind her.
Kantha Stitch Shoulder Throw: She wears a Kantha-stitch dupatta covered in rows of running-stitch embroidery, thrown over both shoulders with the ends falling to her waist.
Ikat Neck Loop: She wears an Ikat-woven dupatta with blurred geometric patterns, looped once around her neck like a scarf with the ends hanging in front.
Patola Formal Drape: She wears a double-ikat Patola silk dupatta with crisp diamond motifs, pleated and pinned at her shoulder in a formal drape.
Kanjeevaram Pallu Drape: She wears a Kanjeevaram silk dupatta with a contrast temple border, draped like a saree pallu from her waist over her shoulder.
Bagh Print Cowl: She wears a Bagh hand-block-printed dupatta draped in a loose cowl around her neck and shoulders.
Chanderi Butti Drape: She wears a sheer Chanderi dupatta scattered with small woven buttis, draped across both shoulders with one end longer than the other.
Paithani Peacock Border: She wears a Paithani silk dupatta with woven peacock motifs on its border, draped over her left shoulder and spread across her back.
Tussar Silk Side Pin: She wears a textured Tussar silk dupatta pinned at one shoulder, its raw-silk sheen falling down her side to her knee.
Kashida Embroidered Head Cover: She wears a Kashmiri Kashida-embroidered dupatta draped over the back of her head, leaving her hairline visible.
Lace-Edged Net Shoulders: She wears a sheer net dupatta finished with scalloped lace edges, draped evenly around both shoulders.
Pom-Pom Trim Throw: She wears a playful dupatta trimmed with tassels and pom-poms along its edges, thrown over one shoulder so the trim swings at her hip.
Tassel-End Belted: She wears a dupatta with beaded tassel ends, draped over one shoulder and cinched to her waist with a slim belt.
Ruffle Edge Drape: She wears a georgette dupatta with ruffled frill edges, draped across her chest in a single sweep over one shoulder.
Shibori Twist Wrap: She wears a Shibori-dyed dupatta with irregular resist-dye patterns, twisted loosely and wrapped around her neck.
Mukaish Sparkle Veil: She wears a Mukaish-work dupatta dotted with tiny metal-wire sparkles, worn as a light veil over her head and shoulders.
Pleated Waterfall: She wears a chiffon dupatta pleated finely at one shoulder so it falls in a cascading waterfall down her front.
Double Dupatta Bridal: She wears two dupattas at once, one draped over her head as a veil and a second across her shoulders and arms.
Cape-Style Pinned Back: She wears a sheer dupatta pinned at the back of both shoulders so it falls like a flowing cape behind her.
Half-Saree Drape: She wears a dupatta draped half-saree style, tucked at the waist, wrapped across the torso and thrown over one shoulder.
Gujarati Seedha Pallu Drape: She wears a dupatta draped Gujarati style, brought from behind over her right shoulder and spread across her front.
Bengali Over-the-Head Pallu: She wears a dupatta draped Bengali style with a thick border, brought over her head and draped around her shoulders.
Hijab-Style Head Wrap: She wears a soft dupatta wrapped around her head and neck hijab-style, framing her face neatly.
Turban-Knot Head Drape: She wears a dupatta tied around her head with a twisted knot at the front, the tails falling over one shoulder.
Necklace-Display Drape: She wears a dupatta draped wide off both shoulders and pinned at the upper arms, leaving her neckline and collarbones fully open.
Arm-Draped Trailing: She wears a long dupatta held only over her bent forearms, the fabric trailing on the floor behind her.
Knotted Front Drape: She wears a dupatta laid over both shoulders with the two ends knotted loosely at the center of her chest.
Sling Across Body: She wears a dupatta slung diagonally across her body from one shoulder, the ends tied at her opposite hip.
Wind-Blown Flutter: She wears a light chiffon dupatta caught by the wind, fluttering out behind her from one shoulder.
Belted Waist Drape: She wears a dupatta draped over both shoulders and cinched at the waist with an embellished belt, the ends falling in front.
Scarf-Style Necktie: She wears a narrow folded dupatta knotted at her throat like a scarf, the short ends falling down her chest.

GYMWEAR

Sports Bra & Leggings: She wears a matching sports bra and high-waisted leggings in a soft ribbed fabric, a sleek coordinated set for everyday workouts.
Tank Top & Shorts: She wears a fitted racerback tank top with loose, lightweight running shorts, breathable and easy to move in.
T-Shirt & Leggings: She wears a classic short-sleeve athletic t-shirt tucked loosely over full-length black leggings, simple and comfortable.
Long Sleeve & Leggings: She wears a fitted long-sleeve workout top with thumbholes and matching full-length leggings, ideal for cooler gym sessions.
Long-Sleeve Crop Top & Leggings: She wears a snug long-sleeve crop top that ends above her waist, paired with high-waisted leggings for a sleek, sculpted look.
Hoodie & Joggers: She wears a soft pullover hoodie with a drawstring hood and matching tapered joggers with cuffed ankles, cozy for warm-ups.
Sports Bra & Biker Shorts: She wears a scoop-neck sports bra with high-waisted biker shorts that end mid-thigh, a sporty staple for training.
Crop Top & Joggers: She wears a fitted sleeveless crop top with relaxed drawstring joggers, mixing sporty and casual.
Muscle Tee & Shorts: She wears a loose muscle tee with deep armholes over fitted bike shorts, airy and relaxed for lifting.
Sports Bra & Workout Pants: She wears a supportive sports bra with loose, wide-leg drawstring workout pants for a laid-back look.
Track Jacket & Leggings: She wears a fitted full-zip track jacket with a high collar over full-length leggings, sleek and streamlined.
Strappy Bra & Leggings: She wears a strappy sports bra with crisscross straps across the back and high-waisted leggings.
Loose Tank & Leggings: She wears a flowy, relaxed-fit tank top with a dropped armhole over fitted leggings, light and breezy.
Sleeveless Hoodie & Joggers: She wears a sleeveless hoodie with a drawstring hood and matching jogger sweatpants, sporty and casual.
Seamless Set: She wears a seamless knit tank and leggings set in a single color, smooth and body-contouring with no visible seams.
Mesh Tank & Leggings: She wears a sheer mesh tank layered over a sports bra with full-length leggings, breathable and modern.
Printed Leggings & Sports Bra: She wears a solid sports bra with boldly patterned leggings in a camo or abstract print.
Half-Zip Top & Leggings: She wears a fitted long-sleeve half-zip pullover with a stand collar and full-length leggings.
Sports Bra & Sweat Shorts: She wears a simple sports bra with soft, loose drawstring sweat shorts, comfortable and casual.
Crop Hoodie & Biker Shorts: She wears a cropped pullover hoodie ending above her waist with fitted biker shorts.
Racerback Tank & Leggings: She wears a racerback tank top that crosses into a Y at the back, paired with full-length leggings.
Matching Gym Set: She wears a perfectly coordinated sports bra and leggings in the same rich color, polished and put-together.
Oversized T-Shirt & Biker Shorts: She wears a baggy oversized t-shirt hanging over short biker shorts, relaxed and effortless.
Graphic Tee & Biker Shorts: She wears an oversized graphic t-shirt with a bold printed design over fitted biker shorts, paired with high-top sneakers.
Gym Bodysuit: She wears a one-piece scoop-neck athletic bodysuit with full-length legs, sleek and supportive.
Gym Jumpsuit: She wears a sleeveless racerback athletic jumpsuit that flows from bodice to ankle in one smooth piece.
Tennis Skirt Outfit: She wears a fitted sports bra with a pleated athletic tennis skirt and built-in shorts, sporty and feminine.
Flared Leggings Outfit: She wears a short-sleeve crop top with high-waisted flared leggings that widen at the ankle.
Sweatpants & Sports Bra: She wears a sports bra with loose, high-waisted sweatpants and an open cardigan draped over her shoulders.
Hoodie & Leggings: She wears a cropped pullover hoodie with full-length leggings for an easy warm-up look.
Oversized Jacket Layered Set: She wears a fluffy oversized jacket slipping off her shoulders over a sports bra and fitted leggings.
Crop Tee & Joggers: She wears a boxy cropped t-shirt with loose cuffed joggers and canvas high-top sneakers.
Sports Bra & Running Shorts: She wears a sports bra with loose running shorts trimmed with contrast piping.
All-Black Gym Outfit: She wears a sleek all-black sports bra and leggings set, minimalist and bold.
All-White Gym Outfit: She wears a clean all-white sports bra and leggings set, crisp and fresh.
Neutral Taupe Gym Outfit: She wears a muted neutral set with a blush sports bra and taupe-brown leggings, soft and earthy.
Pastel Gym Outfit: She wears a matching pastel periwinkle sports bra and leggings, light and cheerful.

PANTS

Skinny Jeans: She wears skinny jeans with a mid-to-high rise and a tight, stretchy fit that hugs her legs from hip to ankle.
Straight-Leg Jeans: She wears straight-leg jeans with a mid-rise waist and an even, straight leg that falls cleanly from hip to ankle.
Wide-Leg Jeans: She wears wide-leg jeans with a high waist and a loose, flowing leg that widens from the hip down to the hem.
Mom Jeans: She wears mom jeans with a high waist, a relaxed fit through the hips, and a slightly tapered leg ending at the ankle.
Boyfriend Jeans: She wears boyfriend jeans with a relaxed, slouchy fit, a slightly dropped waist, and casually rolled cuffs at the hem.
Flare Jeans: She wears flare jeans fitted through the hips and thighs that flare out dramatically from the knee to the hem.
Bootcut Jeans: She wears bootcut jeans fitted through the thigh with a subtle flare below the knee, designed to sit over boots.
Barrel-Leg Jeans: She wears barrel-leg jeans with a high waist and a curved, rounded leg that balloons at the knee and tapers at the ankle.
Baggy Jeans: She wears baggy jeans with a loose, oversized fit, a low-slung waist, and extra fabric pooling around the ankles.
Jeggings: She wears jeggings that look like skinny jeans with a stretchy legging-like fabric and an elastic or faux-button waistband.
Cargo Pants: She wears cargo pants with a relaxed straight leg and large flap pockets stitched on the sides of the thighs.
Carpenter Pants: She wears carpenter pants with a loose, straight leg, a hammer loop, and extra utility pockets on the side.
Parachute Pants: She wears parachute pants in lightweight nylon with a drawstring waist, cargo pockets, and gathered, toggled cuffs at the ankle.
Joggers: She wears joggers in soft fleece with an elastic drawstring waist and a tapered leg ending in ribbed ankle cuffs.
Sweatpants: She wears sweatpants in cozy brushed cotton with an elastic waist, side pockets, and cuffed ankles.
Track Pants: She wears track pants with a drawstring waist, a straight leg, and contrasting stripes running down the sides.
Lounge Pants: She wears lounge pants in soft, drapey fabric with a drawstring waist and a wide, relaxed leg.
Palazzo Pants: She wears palazzo pants with a high waist and extremely wide, flowing legs that sway like a long skirt.
Culottes: She wears culottes with a high waist, soft pleats, and a wide, cropped leg ending at mid-calf.
Paperbag Pants: She wears paperbag pants with a gathered, ruffled high waist cinched by a tie belt and a relaxed tapered leg.
Linen Pants: She wears linen pants in breathable, lightly textured linen with a drawstring waist and a loose, straight leg.
Drawstring Pants: She wears drawstring pants with a soft elastic waist, a tie cord, and a relaxed, straight leg.
Harem Pants: She wears harem pants with a low, baggy drop crotch, full billowy legs, and fitted gathered cuffs at the ankles.
Dhoti Pants: She wears dhoti pants with draped, cowled fabric at the front and legs that gather into fitted cuffs at the ankles.
Tailored Trousers: She wears tailored trousers with a structured waistband, a pressed center crease, and a clean, straight leg.
Cigarette Pants: She wears cigarette pants with a slim, straight leg that ends just above the ankle, sleek and polished.
Dress Pants: She wears dress pants with a flat front, a sharp crease, and a smooth straight leg, formal and office-ready.
Pleated Trousers: She wears pleated trousers with front pleats at the waist that add volume through the hips and a tapered leg.
Wide-Leg Trousers: She wears wide-leg trousers with a high waist, front pleats, and a full leg that falls straight to the floor.
Ankle-Length Trousers: She wears ankle-length trousers with a tailored waist and a straight leg cropped neatly at the ankle bone.
Leggings: She wears leggings in smooth, stretchy fabric with a high elastic waistband and a skin-tight fit to the ankle.
Flared Leggings: She wears flared leggings fitted through the hips and thighs that flare out gently from the knee.
Yoga Pants: She wears yoga pants with a wide, high waistband and a soft, slightly flared leg made for stretching.
Running Tights: She wears running tights in compressive, moisture-wicking fabric with a high waist and a full-length fit.
Compression Leggings: She wears compression leggings in thick, supportive fabric that firmly hugs and shapes the legs.
Gym Pants: She wears gym pants with an elastic drawstring waist and a relaxed jogger fit gathered at the ankle.
Cycling Leggings: She wears cycling leggings with a high waistband and a snug fit ending just above the knee.
Leather Pants: She wears leather pants with a high waist and a sleek, straight leg with a smooth, polished finish.
Faux Leather Pants: She wears faux leather pants with a high waist, a straight leg, and a soft, supple vegan-leather sheen.
Corduroy Pants: She wears corduroy pants in soft ribbed cord with front pleats and a relaxed straight leg.
Velvet Pants: She wears velvet pants in plush, luxurious velvet with a high waist and a wide, flowing leg.
Satin Pants: She wears satin pants in a glossy, fluid fabric with a smooth waistband and a relaxed wide leg.
Sequin Pants: She wears sequin pants covered in sparkling sequins with a high waist and a straight leg, made for parties.
Printed Pants: She wears printed pants with an all-over floral pattern, a high waist, and a relaxed straight leg.
Plaid Pants: She wears plaid pants with a bold checkered pattern, a tailored waist, and a straight, cropped leg.
Camouflage Pants: She wears camouflage pants with an all-over camo print, cargo pockets, and a relaxed straight leg.
Chinos: She wears chinos in smooth cotton twill with slant pockets and a slim, straight, tapered leg.
Capri Pants: She wears capri pants with a fitted, slim leg that ends at mid-calf.
Tailored Flare Pants: She wears tailored flare pants fitted through the hips and thighs before flaring out from the knee to the floor.
Linen Drawstring Pants: She wears airy linen drawstring pants with a relaxed straight leg and soft natural creases.
Paperbag Waist Pants: She wears paperbag waist pants with a gathered high waistband tied with a matching belt and tapered legs.

SHORTS

Denim Shorts: She wears classic light-wash denim shorts with a mid-rise waist, five-pocket styling, a button and zip fly, and a softly frayed raw hem.
Tailored Shorts: She wears black tailored shorts with front pleats, a structured high waistband, a button closure, and a crisp, wide leg ending mid-thigh.
Athletic Shorts: She wears black athletic shorts with an elastic drawstring waist, curved side splits, and contrasting white piping along the hem.
Biker Shorts: She wears black biker shorts in stretchy, smooth fabric with a high waistband and a snug fit ending mid-thigh.
Paperbag Shorts: She wears black paperbag shorts with a gathered, ruffled high waist cinched by a tie belt knotted in a bow, and a loose, flowy leg.
Cargo Shorts: She wears olive cargo shorts with a mid-rise waist, button fly, and large flap pockets stitched on both sides.
Chino Shorts: She wears khaki chino shorts in smooth cotton twill with slant front pockets and neatly rolled cuffs at the hem.
Running Shorts: She wears black running shorts with an elastic waistband, lightweight fabric, and curved split sides for easy movement.
Loose Fit Shorts: She wears heather grey loose fit shorts in soft jersey with an elastic waist and a relaxed, roomy leg.
High-Waist Shorts: She wears black high-waist shorts with a tall waistband fastened by three stacked buttons and a fitted, sculpted cut.
Hot Pants: She wears black hot pants with a mid-rise denim waist, five-pocket styling, and a very short hem with neat cuffed edges.
Boxer Shorts: She wears pink-and-white striped boxer shorts with an elastic drawstring waist and a loose, airy cotton leg.
Culotte Shorts: She wears black culotte shorts with a smooth high waistband, soft pleats, and a wide, flared leg that falls to just above the knee.
Utility Shorts: She wears black utility shorts in sturdy denim with a high waist, belt loops, and large flap cargo pockets on each side.
Denim Cut-Offs: She wears distressed denim cut-offs with ripped front panels, a high waist, and a heavily frayed, uneven raw hem.
Board Shorts: She wears black board shorts with a drawstring tie waist, side stripes, and a quick-dry, mid-length cut for the beach.
Cotton Hot Pants: She wears white cotton hot pants with a high waist, five-pocket styling, and a clean, short hem, crisp and summery.
Leather Hot Pants: She wears black faux leather hot pants with a high waist, front pockets, and a glossy, sleek finish.
Colored Hot Pants: She wears pastel pink denim hot pants with a high waist, five-pocket styling, and a lightly frayed hem.
Ripped Hot Pants: She wears ripped denim hot pants with large distressed shredded patches across the front and a frayed hem.
Plaid Hot Pants: She wears black-and-white plaid hot pants with a high waist, front pleats, and a slightly flared A-line leg.
Denim Cutoff Shorts: She wears high-waisted denim cutoff shorts with frayed raw hems and a slightly distressed wash.
Linen Shorts: She wears breezy linen shorts with an elastic drawstring waist and a relaxed, wide fit.
Leather Shorts: She wears high-waisted faux leather shorts with a short hem and a smooth, glossy finish.
Micro Shorts: She wears tiny micro shorts with a low-rise waist and a very short hem that bares most of her thighs.

CARDIGANS

Classic Cardigan: She wears a classic beige knit cardigan with a V-neckline, a simple button-up front, ribbed cuffs and hem, and a relaxed, timeless fit.
V-Neck Cardigan: She wears a soft lavender V-neck cardigan with a deep V-shaped neckline, small buttons down the front, and a fitted, flattering silhouette.
Round Neck Cardigan: She wears a sage green round neck cardigan with a crew neckline, a neat button front, and a soft, casual knit.
Long Cardigan: She wears a dusty pink long cardigan that falls to the knee, with an open front, patch pockets, and a cozy, layered feel.
Short Cardigan: She wears a black short cardigan that ends at the waist, with a round neckline, small buttons, and a sleek, fitted cut.
Oversized Cardigan: She wears a cream oversized cardigan with dropped shoulders, chunky buttons, a deep V-neck, and a roomy, slouchy fit.
Button-Up Cardigan: She wears a navy button-up cardigan with contrasting white stripe trim along the neckline, placket, and pocket edges, preppy and polished.
Open Front Cardigan: She wears a light grey open front cardigan with no buttons or zipper, its soft knit panels draping loosely down the front.
Chunky Knit Cardigan: She wears a cream chunky knit cardigan made of thick, textured yarn with a V-neck and large buttons, warm and cozy.
Lightweight Cardigan: She wears a pale blue lightweight cardigan in a thin, fine-gauge knit with a V-neck and small buttons, perfect for mild weather.
Turtleneck Cardigan: She wears a charcoal turtleneck cardigan with a folded high collar, a button front, and a warm, structured knit.
Cropped Cardigan: She wears a black-and-white striped cropped cardigan with a round neck, small buttons, and a short hem ending above the waist.
Hooded Cardigan: She wears a heather grey hooded cardigan with a knit hood, button front, and patch pockets, casual and sporty.
Belted Cardigan: She wears a rose-colored belted cardigan with a wrap front, wide shawl lapels, and a tie belt that cinches the waist.
Crochet Cardigan: She wears a cream crochet cardigan with open floral crochet patterns, a V-neck, and a light, airy, boho feel.
Jacquard Cardigan: She wears a navy jacquard cardigan with a woven white snowflake and Fair Isle pattern, a crew neck, and a festive button front.
Ribbed Cardigan: She wears a mauve ribbed cardigan made of vertical ribbed knit with a V-neck and buttons, snug and figure-fitting.
Cable Knit Cardigan: She wears a cream cable knit cardigan with twisted cable patterns running down the front, a V-neck, and classic buttons.
Printed Cardigan: She wears a cream printed cardigan dotted with small pink floral motifs, a round neck, and a sweet button front.
Shawl Collar Cardigan: She wears an olive shawl collar cardigan with a wide folded collar that wraps around the neckline, buttons, and a relaxed, elegant fit.
Fuzzy Cardigan: She wears a soft pink fuzzy cardigan made of fluffy mohair-style yarn with a V-neck and buttons, dreamy and plush.
Lace Cardigan: She wears an ivory lace cardigan in delicate open lace fabric with a round neck and small buttons, feminine and elegant.
Denim Cardigan: She wears a blue denim cardigan with a collarless V-neck, metal buttons, and patch pockets, a stylish mix of knit shape and denim fabric.
Asymmetrical Cardigan: She wears a black asymmetrical cardigan with an off-center button closure and an uneven, angled hem for a modern look.

JACKETS

Denim Jacket: She wears a classic light-wash denim jacket with a pointed collar, metal button front, chest flap pockets, and button cuffs, cut to hip length for a casual, timeless look.
Leather Jacket: She wears a sleek black leather jacket with notched lapels, a hidden zip front, and slim tailored sleeves, polished and effortlessly cool.
Biker Jacket: She wears a black leather biker jacket with an asymmetrical zip front, wide snap-down lapels, zippered pockets, and a belted hem for an edgy, rebellious look.
Bomber Jacket: She wears an olive green bomber jacket with a full zip front, ribbed knit collar, cuffs, and hem, and a relaxed, slightly puffed body.
Varsity Jacket: She wears a varsity jacket with a black wool body, cream leather sleeves, striped ribbed collar and cuffs, snap buttons, and a chenille letter patch on the chest.
Puffer Jacket: She wears a cream puffer jacket with thick horizontal quilted channels, a high stand-up collar, and a zip front, warm and voluminous.
Quilted Jacket: She wears an olive quilted jacket with diamond-stitched padding, a collarless neckline, snap front, and patch pockets, light and practical.
Hooded Jacket: She wears a soft pink hooded jacket with a drawstring hood, full zip front, and relaxed fit, casual and cozy.
Windbreaker Jacket: She wears a lightweight lilac windbreaker with a drawstring hood, zip front, and elastic cuffs, made of thin wind-resistant nylon.
Trench Coat: She wears a camel trench coat with a double-breasted front, wide notched lapels, shoulder epaulettes, and a tied waist belt, falling to the knee.
Blazer: She wears a tailored black blazer with sharp notched lapels, a single-button front, and structured shoulders, polished and professional.
Overcoat: She wears a long camel wool overcoat with wide lapels, a single-breasted front, and a straight, knee-length cut, refined and warm.
Peacoat: She wears a navy wool peacoat with a double-breasted button front, wide lapels, and a hip-length structured cut, classic and nautical.
Duffle Coat: She wears a cream wool duffle coat with a roomy hood and toggle fastenings made of wooden pegs and rope loops down the front.
Cape Jacket: She wears a deep red cape jacket that drapes loosely from the shoulders over the arms, with an open front and an elegant, flowing silhouette.
Poncho Jacket: She wears a plaid poncho jacket made of a wide wrap of soft wool that drapes over the shoulders, finished with fringed edges.
Parka Jacket: She wears an olive parka with a hood trimmed in faux fur, a drawstring waist, multiple utility pockets, and a long, insulated cut.
Faux Fur Jacket: She wears a plush blush faux fur jacket with a shaggy, fluffy texture, oversized collar, and a cozy, relaxed fit.
Shacket: She wears a plaid shacket, a thick flannel shirt-jacket with a pointed collar, button front, and chest flap pockets, worn open or closed.
Utility Jacket: She wears an olive utility jacket with a collar, button front, multiple flap pockets, and a drawstring waist, practical and military-inspired.
Safari Jacket: She wears a khaki safari jacket with four bellows pockets, a pointed collar, shoulder epaulettes, and a self-tie belt at the waist.
Cropped Jacket: She wears a pink cropped jacket with a collar, button front, and chest pockets, ending just above her waist.
Longline Jacket: She wears a black longline jacket with slim lapels and an extended length falling to mid-thigh, sleek and elongating.
Waterproof Jacket: She wears a sky-blue waterproof jacket with a hood, zip front, sealed seams, and a smooth weatherproof finish.
Fleece Jacket: She wears a soft cream fleece jacket with a high stand collar, full zip, and a plush, fuzzy texture for warmth.
Corduroy Jacket: She wears a brown corduroy jacket with a ribbed velvety texture, pointed collar, button front, and chest pockets.
Shearling Jacket: She wears a brown leather shearling jacket lined with cream fleece, with a wide fluffy collar and cuffs and an asymmetrical zip.
Kimono Jacket: She wears a light floral kimono jacket with wide open sleeves and a loose, flowing open front, airy and bohemian.
Bolero Jacket: She wears a short black bolero jacket that ends just below the bust, with long sleeves and an open front, perfect over dresses.
Shrug Jacket: She wears a soft pink shrug jacket that drapes over the shoulders and arms, with cascading open front panels.
Capelet Jacket: She wears a cream capelet jacket, a short cape that covers the shoulders and upper arms, with a neat collar and button closure.
Denim Vest: She wears a sleeveless denim vest with a pointed collar, button front, and chest flap pockets, casual and layered.
Padded Jacket: She wears a dusty pink padded jacket with soft quilted panels, a stand collar, and a zip front, warm yet lightweight.
Belted Jacket: She wears a black leather belted jacket with wide lapels, a zip front, and a buckled waist belt that cinches her silhouette.
Asymmetrical Jacket: She wears a grey asymmetrical jacket with an off-center zip, a wide draped lapel, and a sharp, modern cut.
Waterfall Jacket: She wears a dusty rose waterfall jacket with soft draped front panels that cascade down in flowing folds.
Military Jacket: She wears an olive military jacket with double rows of gold buttons, shoulder epaulettes, a stand collar, and flap pockets.
Anorak Jacket: She wears a lilac anorak with a drawstring hood, a half-zip pullover front, a cinched waist, and a large front pocket.
Raincoat: She wears a bright yellow raincoat with a hood, snap button front, and a glossy waterproof finish.
Sports Jacket: She wears a black sports track jacket with a zip front, a stand collar, and white stripes running down the sleeves.
Harrington Jacket: She wears a beige Harrington jacket with a short collar, zip front, ribbed cuffs and hem, and a lightweight cotton finish.
Flight Jacket: She wears an olive flight jacket with an orange lining, a ribbed collar and cuffs, a full zip, and a utility sleeve pocket.
Reversible Jacket: She wears a reversible jacket with a black side and a beige side, a simple collar, and a zip front, so it can be worn either way.
Sleeveless Long Jacket: She wears a camel sleeveless long jacket with notched lapels and a tailored cut falling to mid-thigh, layered over a top.
Denim Shirt Jacket: She wears a dark-wash denim shirt jacket with a pointed collar, snap button front, chest pockets, and a slightly longer, relaxed fit.

JEANS

Skinny Jeans: She wears high-waisted skinny jeans in a dark indigo wash that hug her legs all the way to the ankle.
Mom Jeans: She wears light-wash mom jeans with a high waist, a relaxed tapered leg, and rolled cuffs.
Wide-Leg Jeans: She wears wide-leg jeans with a high rise and full-length hems that skim the floor.
Bootcut Jeans: She wears mid-rise bootcut jeans fitted through the thigh with a gentle flare below the knee.
Ripped Boyfriend Jeans: She wears loose boyfriend jeans with ripped knees, a faded wash, and cuffed hems.
Flare Jeans: She wears high-waisted flare jeans that fit closely through the hips before flaring dramatically from the knee.
Straight-Leg Jeans: She wears classic straight-leg jeans in a mid-blue wash with a high waist and clean hems.
Low-Rise Jeans: She wears low-rise jeans sitting on her hips with a relaxed straight leg, a nod to early-2000s style.

BURQA

Hijab: She wears a classic hijab, a soft square scarf wrapped neatly around her head and neck, framing her face fully while covering her hair, ears, and throat, with the fabric draped in gentle folds over her chest and shoulders.
Dupatta: She wears a long, lightweight dupatta draped loosely over the top of her head, the flowing fabric falling down both sides of her face and over her shoulders to her waist, leaving her face and front hairline softly visible.
Shayla: She wears a shayla, a long rectangular scarf wrapped once around her head and face, then tucked or pinned at the shoulders, with the long end draped loosely across her chest and over one shoulder.
Tuding: She wears a tuding, a snug fitted inner cap covering her hairline beneath a wide scarf that wraps around her head and neck, the fabric gathered in soft layered folds around her face and draping over her shoulders.
Doa Gaun: She wears a doa gaun, a long loose head covering that falls over her head and shoulders like a cape, with a face panel covering her nose and mouth so only her eyes remain visible through a narrow opening.
Bandari Burqa: She wears a bandari-style head covering, a fitted scarf framing her face and tied beneath her chin, with a short structured cape of fabric flaring outward over her shoulders and upper arms.
Niqab: She wears a niqab, a veil covering her face below the eyes and secured behind her head, worn together with a headscarf that covers her hair and neck, leaving only a narrow opening for her eyes.
Al-Amira: She wears an al-amira, a two-piece hijab made of a close-fitting inner cap and a tube-shaped scarf pulled over it, the outer layer framing her face snugly and falling in a smooth cape over her shoulders and chest.
Esarp: She wears an esarp, a large silky scarf wrapped smoothly around her head and pinned beneath her chin, framing her face neatly, with the long ends falling straight down over her chest.
Chador: She wears a chador, a full-length cloak-like garment draped over her head and wrapped around her body from head to toe, held closed at the front by her hands, with her face left uncovered.
Khimar: She wears a khimar, a long cape-like veil that covers her head, hair, neck, and shoulders, falling loosely in a wide drape down to her waist, with her face fully visible.
Burqa: She wears a burqa, a full-body covering that drapes from the top of her head to her ankles, with a mesh or panel opening over the eyes so her entire face and body are concealed.

SHALWARS

Straight Shalwar: She wears a classic straight shalwar in soft sage-green cotton lawn, gathered at the waist with a comfortable elastic or drawstring band, the relaxed, even-width legs falling cleanly from hip to ankle without any taper or flare. The plain, untrimmed hem rests just above her embellished flats, and the simple silhouette pairs effortlessly under a printed kurta for a timeless, breathable everyday look.
Cigarette Shalwar: She wears a slim cigarette shalwar in crisp ivory cotton satin, cut close to the legs and tapering neatly toward the ankle for a sharp, streamlined line. The cropped hem sits just above the ankle bone, finished with a short side slit and a delicate strand of tiny pearl beads along the edge, giving a polished, modern look that peeks out neatly beneath a short embroidered kurti.
Tulip Shalwar: She wears a tulip shalwar in soft dusty-pink silk, full and gathered at the waist so the fabric falls in soft folds before crossing over at the front of each leg. The overlapping panels curve into a rounded, petal-shaped hem that opens slightly as she walks, edged with a neat row of small pearl buttons, creating a fluid, elegant drape that feels both trendy and graceful.
Patiala Shalwar: She wears a voluminous Patiala shalwar in creamy white cotton, made from a generous length of fabric folded into deep, heavy pleats that cascade from a wide waistband down to the knees. The pleats gather tightly into snug, fitted cuffs at the ankles, creating a rich, billowing balloon shape full of movement, perfect for a traditional, festive, royal Punjabi look.
Shalwar with Lace: She wears a straight, slightly cropped shalwar in soft baby-pink cotton, with a relaxed fit through the legs and a clean, simple waistband. A wide band of delicate scalloped crochet lace runs around the hem of each leg, its intricate pattern and wavy edge adding a soft, feminine, dainty detail that catches the eye with every step.
Gher Shalwar: She wears a wide gher shalwar in light ivory chiffon or georgette, cut with extra panels so the legs flare generously from the hip into a full, skirt-like volume. The broad hem is finished with a gold-and-blush embroidered border, and the airy fabric swishes and sways gracefully as she moves, giving the illusion of a flowing skirt with the ease of trousers.
Box Pleated Shalwar: She wears a box pleated shalwar in sage-green cotton, with structured box pleats folded at the waistband that release into a relaxed, roomy leg. Above the ankle, the hem is detailed with several neat horizontal pintuck pleats stitched in parallel lines, giving the shalwar a tailored, architectural finish that feels modern, crisp, and classy.
Dhoti Shalwar: She wears a dhoti shalwar in soft off-white crepe, cut with extra fabric at the front that drapes low and cowls in deep folds between the legs. The draping tapers down into fitted, gathered cuffs at the ankles, creating a relaxed, sculpted silhouette that is comfortable, airy, and chic, especially when worn with a short kurti or a fitted top.
Churidar Shalwar: She wears a churidar shalwar in stretchy white cotton jersey, fitted closely along her thighs and calves and cut much longer than her legs. The extra length bunches into soft, ruched horizontal gathers from mid-calf down to the ankle, forming the signature bangle-like folds, and the snug fit creates a slim, elegant, traditional look beneath a long kurta.
Trouser Style Shalwar: She wears a trouser style shalwar in powder-blue cotton twill, tailored with a flat front waistband, a straight leg, and a clean pressed crease for a structured shape. The hem is cut slightly cropped above the ankle with a neat finished edge, giving a smart, sophisticated, Western-inspired look that pairs beautifully with a printed kurta for work or casual outings.

UNDERWEAR

String Panties: She wears string panties with a small lace front panel, thin elastic string sides, and a narrow back strap, offering minimal coverage in a delicate design.
G-String: She wears a lace G-string with minimal coverage and a thin back.
Tanga: She wears a tanga with narrow sides and a cheeky back.
Cheeky Panties: She wears cheeky panties in smooth fabric with a low-rise waistband and a moderate cut at the back that offers partial coverage.
Hipster: She wears a floral print hipster with lace trim that sits on the hips with moderate coverage.
Boyshorts: She wears boyshorts with a short-like leg and extra coverage.
Boxer Briefs: She wears loose-fitting boxer-style briefs in soft cotton with a relaxed shorts silhouette and an elastic waistband.
Bikini Briefs: She wears classic bikini briefs with a mid-low rise and moderate front and back coverage, a simple everyday staple.
Midi Briefs: She wears midi briefs that sit comfortably at the mid-waist with full coverage front and back in a smooth fabric.
Maxi Briefs: She wears high-rise maxi briefs that reach up to the waist and provide maximum coverage, soft and comfortable.
Full Briefs: She wears full briefs with a high waist and full coverage front and back, a classic, supportive cut.
High-Cut Briefs: She wears high-cut briefs with legholes cut high on the hips, creating a longer, leg-lengthening silhouette.
High-Waist Briefs: She wears high-waist briefs that rise above the navel, offering full coverage and a smooth line under high-waisted clothes.
Control Briefs: She wears shaping control briefs in firm, supportive fabric that gently smooths and shapes the stomach and waist.
Seamless Panties: She wears seamless panties knit without visible seams so they stay invisible under fitted clothing.
Laser-Cut Panties: She wears laser-cut panties with raw-cut, unstitched edges that lie flat for a smooth, invisible look.
Thong: She wears a thong with a full front and minimal back coverage for a seamless look.
C-String: She wears a C-string, a backless, strapless piece held in place by a flexible curved frame.
Vinyl Panties: She wears glossy vinyl panties with a shiny, wet-look finish and a full brief cut.
Lace Panties: She wears lace panties made entirely of floral lace with scalloped edges for a delicate, romantic look.
Mesh Panties: She wears sheer mesh panties in a light, breathable, airy fabric with a smooth fit.
Cut-Out Panties: She wears cut-out panties with strappy open details at the front, back, or sides for a modern design.
Bandeau Panties: She wears bandeau-style panties with minimal coverage and adjustable side ties.
Brazilian Panties: She wears lace Brazilian panties with less back coverage than a bikini but more than a thong.
Triangle Panties: She wears triangle panties with triangular fabric panels and lace-up ties at the sides.
Side-Tie Panties: She wears side-tie panties with soft ribbon bows at each hip that make the fit adjustable.
Sport Panties: She wears sport panties in moisture-wicking, stretchy fabric that offer support and freedom of movement.
Period Panties: She wears period panties with a built-in absorbent, leak-proof layer for comfortable protection during menstruation.
Maternity Panties: She wears maternity panties with a soft, stretchy high front panel designed to support a growing belly.
Postpartum Panties: She wears postpartum panties with extra soft, high-waisted coverage and support for recovery after birth.
Tummy Control Panties: She wears hold-in tummy control panties with a firm high-waist panel that smooths and supports the stomach.
No-Show Panties: She wears invisible no-show panties with a low rise and seamless edges so they disappear under clothing.
Adhesive Panties: She wears adhesive panties, a self-adhering fabric piece with no bands, designed for open-back or open-side dresses.
Nipple Covers: She wears soft silicone nipple covers that discreetly cover the nipples, worn with or without a bra.
Open-Crotch Panties: She wears open-crotch lace panties with a sheer floral lace body, a scalloped waistband, and an open gusset design, a lingerie-style piece with a delicate, decorative finish.
Pearl String Panties: She wears pearl string panties with a thin elastic waistband and a single strand of smooth faux pearls running down the center in place of a fabric panel, a decorative, jewelry-inspired lingerie piece.
String: She wears string panties with a small front panel and very thin string sides and back for no visible lines.
Brazilian Brief: She wears a Brazilian brief with a low rise and a cheeky back.
T-String: She wears a T-string with a minimal front and a thin T-shaped back.
Slip Brief: She wears a slip brief with full coverage, made for everyday comfort.
Bikini Brief: She wears a bikini brief with a classic moderate-coverage cut, lace trim, and a small bow.
Sport Brief: She wears a sport brief with a wide elastic logo waistband and supportive fabric for active days.
Retro Brief: She wears a retro brief with a high waist, full coverage, and a vintage look.
Sport High-Waist Brief: She wears a high-waisted sport brief with a striped elastic waistband for support.
Pants: She wears short-style underwear pants with lace trim at the legs for extra comfort and coverage.
Cheeky Panty: She wears a lace cheeky panty with less back coverage and a playful, scalloped trim.
Hiphugger: She wears a lace hiphugger that sits low on the hips with a snug fit.
High-Leg Brief: She wears a leopard print high-leg brief with a higher cut for a longer leg look.
Seamless Brief: She wears a seamless brief with no visible lines under clothing.
Sleep Shorts: She wears loose heart-print sleep shorts with an elastic waist and bow detail, comfy for bedtime.

LINGERIE SETS

Lace Set: She wears a lace lingerie set with an underwire floral lace bra, thin straps, and a matching lace brief with double strap sides and small satin bows at the hips.
Wild Card Set: She wears an animal print lingerie set with a padded underwire bra trimmed in black lace and a matching print brief edged with lace.
Balconette Set: She wears a balconette lingerie set with wide-set underwire lace cups, a center bow, and a matching brief with double strappy sides and a bow at the front.
Push-Up Set: She wears a push-up lingerie set with padded, lace-trimmed underwire cups and a matching lace and satin brief with a small bow.
Ruffle Set: She wears a ruffle lingerie set in satin with ruffled cup edges, small bows at the straps and center, and a matching brief trimmed with ruffles and bows.
Bralette Set: She wears a bralette set with an unlined lace triangle bralette, scalloped edges, and matching lace tap shorts with a small bow at the waist.
Strappy Plunge Set: She wears a strappy plunge set with an embroidered half-cup bra featuring double straps and bows, and a matching tulle-and-lace thong with strappy sides.
Satin Half-Cup Set: She wears a satin half-cup bra edged with eyelash lace and adjustable straps, paired with high-waisted satin briefs with a smooth, vintage finish.
Leopard Mesh Set: She wears a sheer leopard-print mesh underwire bra with scalloped trim and a matching sheer brief with lace edging.
Red Lace Set: She wears an unlined red floral lace underwire bra with thin straps and a matching lace thong with double strings at the hips.
Bridal Lace Set: She wears an ivory unlined lace underwire bra with delicate bows on the straps and a matching ivory lace thong, soft and bridal.
Rose Embroidered Brief: She wears a rose-embroidered mesh brief with a sheer floral pattern and a mid-rise cut.
Classic Satin & Lace Set: She wears a black satin bra with lace upper cups and adjustable straps, paired with a matching satin brief with lace side panels and a center bow.
Garter Set: She wears a garter set with a lace garter belt, four adjustable suspender straps, and a matching lace thong.
Garter Belt & Stockings Set: She wears a full set with a satin and lace underwire bra, a matching brief, a lace garter belt with suspenders, and sheer thigh-high stockings with lace tops.
Thigh-High Stockings: She wears sheer thigh-high stockings with wide scalloped lace bands at the top, made to clip to garter suspenders.
Lace Bralette & Skirt Set: She wears a cage-strap lace bralette with crisscross straps across the chest, paired with a lace brief layered under a short flared sheer mesh skirt; the brief has an open-crotch design.
Long Bralette Set: She wears a longline lace bralette with scalloped edges and strappy crisscross detail, paired with a matching lace bottom.

BODYSUITS & CORSETRY

Teddy: She wears a lace teddy, a one-piece bodysuit with a plunging V-neck, thin straps, and a high-cut lace bottom.
Strappy Lace Bodysuit: She wears a black lace bodysuit with underwire cups, sheer dotted mesh panels, and strappy cage detailing across the waist.
Corset Bustier with Garters: She wears a corset bustier with molded underwire cups, sheer boned panels down the torso, lace accents, and detachable garter straps at the hem.
Body Stocking: She wears a full-body fishnet body stocking with long sleeves and full-length legs, featuring a lattice pattern over the torso.

SLEEPWEAR & NIGHTWEAR

Satin Slip: She wears a satin slip with a lace-trimmed V-neck, thin straps, a small bow at the bust, a side slit with bow detail, and a scalloped lace hem.
Plain Satin Slip: She wears a simple satin slip with a V-neckline, thin straps, and a smooth, bias-cut drape to mid-thigh.
Lace Chemise: She wears a lace chemise with a lace bodice, an empire waist, and a sheer flowing skirt finished with a lace hem.
Negligee: She wears a negligee with lace cups, thin straps, and a gathered, flowing chiffon skirt falling to mid-thigh.
Babydoll: She wears a babydoll with a lace bra-style bodice, a bow at the center, and a loose, flowy sheer skirt from just under the bust.
Sheer Babydoll: She wears a sheer babydoll with underwire lace cups, double straps, and a flowing sheer chiffon skirt with a split front.
Slip Dress: She wears a simple slip dress with thin straps, a straight neckline, and a smooth, body-skimming fit.
Sheer Nightie: She wears a sheer nightie with lace cups, thin straps, and a gathered sheer skirt.
Camisole Set: She wears a camisole set with a satin lace-trimmed cami top and matching satin drawstring shorts.
Cut-Out Dress: She wears a fitted halter mini dress with keyhole cut-outs at the chest, sleek and bodycon.
Robe: She wears a satin robe with wide sleeves, a shawl collar, and a tie belt at the waist.
Wrap Gown: She wears a wrap gown, a knee-length robe in soft fabric with long sleeves and a tie waist.
Lace Robe: She wears a sheer lace robe with scalloped lace trim along the edges and cuffs, wide sleeves, and a satin tie belt.
Lace-Trim Kimono Robe: She wears a short satin kimono robe with lace trim along the collar and cuffs and a matching tie belt.

LOUNGE SHORTS & BRIEFS

Cotton Bikini: She wears a soft cotton bikini brief with a smooth low-rise cut.
Foldover Shorts: She wears foldover shorts with a wide fold-down waistband and a short, relaxed leg.
Drawstring Lounge Shorts: She wears drawstring lounge shorts with a tie waist and curved contrast-trim hems.
Ribbed Briefs: She wears ribbed briefs in stretchy ribbed cotton with a V-shaped front waistband.
Dolphin Sleep Shorts: She wears dolphin sleep shorts with curved side splits and contrasting piping.
Cotton Boyshorts: She wears cotton boyshorts with a smooth waistband and a short, snug leg.
Soft Jersey Shorts: She wears soft jersey shorts with an elastic waist and a loose, relaxed fit.
V-Cut Briefs: She wears V-cut briefs with a V-shaped front waistband and a smooth fit.
Ruched Lounge Shorts: She wears ruched lounge shorts with adjustable drawstring ruching at the sides.
Lace-Trim Briefs: She wears full-coverage briefs trimmed with scalloped lace along the waist and legs.
Foldover Mini Shorts: She wears foldover mini shorts with a wide contrast fold-down waistband and very short legs.
Sleep Bloomers: She wears sleep bloomers with an elastic waist, a bow, and puffy legs gathered into ruffled cuffs.

BIKINIS

Triangle Bikini: She wears a striped triangle bikini with a halter tie and side-tie bottom.
Halter Neck Bikini: She wears a halter neck bikini with straps that tie behind her neck, supportive triangle cups, and a tie-side bottom.
Underwire Bikini: She wears an underwire bikini with structured, wired cups for lift and support, adjustable shoulder straps, and a classic bottom.
Bandeau Bikini: She wears a strapless bandeau bikini with a straight band of fabric across the chest and a sleek, moderate-coverage bottom.
Push-Up Bikini: She wears a push-up bikini with lightly padded, angled cups that lift and shape, paired with a tie-side bottom.
Strapless Bikini: She wears a strapless bikini with a twisted front band, a firm grip edge to stay in place, and a simple scoop bottom.
Cross-Front Bikini: She wears a cross-front bikini with fabric panels crossing over at the bust and a mid-rise bottom.
High-Neck Bikini: She wears a high-neck bikini with a crop-top style top that reaches up to the collarbone, sporty and supportive.
Scoop Neck Bikini: She wears a scoop neck bikini with a rounded, sporty neckline, wide straps, and a full-coverage bottom.
Square Neck Bikini: She wears a square neck bikini with a straight horizontal neckline, wide straps, and a modern, structured look.
V-Neck Bikini: She wears a V-neck bikini with a deep V-shaped neckline and a tie-side bottom, lengthening and flattering.
One-Shoulder Bikini: She wears a one-shoulder bikini with a single asymmetrical strap and a matching bottom with ring hardware at the hips.
Double-Strap One-Shoulder Bikini: She wears a one-shoulder bikini with two parallel straps over a single shoulder and a sleek high-cut bottom.
Cut-Out Bikini: She wears a cut-out bikini with open geometric gaps in the top and bottom that add a modern, strappy look.
Keyhole Bikini: She wears a keyhole bikini with a small teardrop opening at the center of the top and halter straps.
Ring Detail Bikini: She wears a ring detail bikini with metal O-rings joining the top at the center and the bottom at the hips.
Bandeau Metal Ring Bikini: She wears a bandeau bikini with a decorative metal ring at the center front and a tie-side bottom.
O-Ring Cheeky Bikini: She wears a textured bikini with O-ring connectors on the top and a cheeky tie-side bottom.
O-Ring Lace-Up Bikini: She wears a strapless bikini with a central O-ring and lace-up detail, paired with a smooth high-cut bottom.
Tie-Side Bikini: She wears a tie-side bikini with bow ties at each hip that adjust the fit of the bottom.
String Bikini: She wears a string bikini with small triangle cups on thin string ties and a minimal string bottom.
Micro Bikini: She wears a micro bikini with very small cups and minimal bottoms on thin strings.
Brazilian Bikini: She wears a Brazilian bikini with a scrunched or narrow-cut back and a triangle halter top.
Cheeky Bikini: She wears a cheeky bikini with a moderate-coverage back cut between a full bottom and a thong.
Thong Bikini: She wears a thong bikini with a narrow back and a matching top, made for minimal tan lines.
Starfish Thong Bikini: She wears an underwire bikini decorated with a small starfish charm at the center, paired with a high-cut thong bottom.
Ruched Bikini: She wears a ruched bikini with gathered fabric along the top and bottom that creates soft, flattering texture.
Ruffle Bikini: She wears a ruffle bikini with frilled ruffle trim along the top and bottom edges, sweet and playful.
Frill Bikini: She wears a frill bikini with ruffled frill trim.
Lace Ruffles Bikini: She wears a striped triangle bikini trimmed with lace ruffles and tiny bows along the edges.
Ruffle Halter Bandeau Bikini: She wears a ruched bandeau top with ruffled edges and a halter tie, paired with a ruffle-trimmed bottom.
Off-Shoulder Bikini: She wears an off-shoulder ruffle bikini with a flounce top below the shoulders.
Belted Bikini: She wears a belted bikini with a buckle belt across the top or high-waisted bottom for a structured, retro look.
Sporty Bikini: She wears a sporty bikini with a scoop crop top, contrast stripe band, and a full bottom, made for activity.
Sports Bra Bikini: She wears a sports bra bikini with a supportive racer-style crop top and a matching full-coverage bottom.
Racerback Bikini: She wears a racerback bikini with straps meeting between the shoulder blades and a sporty full bottom.
Crossback Bikini: She wears a crossback bikini with straps crossing in an X across the back and a classic bottom.
Longline Bikini: She wears a longline bikini with a top that extends down toward the ribs and a mid-rise bottom.
High-Waisted Bikini: She wears a high-waisted bikini with a bottom rising to the navel, often trimmed with buttons, and a supportive top.
Low-Waisted Bikini: She wears a low-waisted bikini with a bottom sitting low on the hips and a simple triangle top.
Skirted Bikini: She wears a skirted bikini with a flared swim skirt attached to the bottom and a supportive top.
Halter Tie Bikini: She wears a halter tie bikini with a printed triangle top tied behind the neck and a tie-side bottom.
Bow Halter Bikini: She wears a floral bow halter bikini with bows on the halter ties and contrast-color trim and side ties.
Reversible Bikini: She wears a reversible bikini with a different color or print on each side, wearable either way.
Panel Bikini: She wears a panel bikini with contrasting color panels stitched into the top and bottom.
Color Block Bikini: She wears a color block bikini with bold contrasting color sections and contrasting tie strings.
Contrast Trim Bikini: She wears a triangle bikini with contrasting colored binding along the edges and ties.
Neon Bikini: She wears a neon bikini in a vivid, bright, glowing shade with a triangle top and tie-side bottom.
Metallic Bikini: She wears a metallic bikini in a shiny, foil-like fabric that catches the light.
Crochet Bikini: She wears a crochet bikini handmade from knitted yarn with an open-weave pattern, boho and beachy.
Crochet Bow Bikini: She wears a crochet triangle bikini with small contrast bows at the center and tie-side bottom.
Crochet-Trim Bikini: She wears a solid bikini edged with colorful hand-crocheted trim along the top and bottom edges.
Fishnet Shell Bikini: She wears a fishnet-textured halter bikini with small seashell charms dangling from the ties.
Printed Bikini: She wears a printed bikini covered in an all-over pattern such as florals, tiles, or abstract prints.
Paisley Bikini: She wears a paisley print bikini with intricate swirling patterns and tie-side details.
Tassel Bikini: She wears a triangle bikini with beaded tassels hanging from the halter ties and side ties.
Animal Print Bikini: She wears an animal print bikini in a leopard or zebra pattern with halter straps and tie-side bottoms.
Striped Bikini: She wears a striped retro bikini.
Mesh Bikini: She wears a mesh bikini with sheer mesh layered over lined panels for a modern, airy look.
Portrait Neckline Bikini: She wears a portrait neckline bikini with a wide off-shoulder ruffled band and a matching ruffled bottom.
Knotted Bikini: She wears a knotted bikini with a twist-knot detail at the center of the top and a simple bottom.
Bralette Bikini: She wears a bralette bikini with a soft, unstructured top and a high-waisted bottom.
Wrap Bikini: She wears a wrap bikini with long ties that wrap around the torso and a tie-side bottom.
Crop Bikini: She wears a crop bikini with a longline tank-like top and a full-coverage bottom.
Tie-Front Bikini: She wears a tie-front bikini with a bow or knot tied at the center of the top and a classic bottom.
Contoured Bikini: She wears a contoured bikini with molded, shaped cups and a smocked waistband bottom.
Crinkle Bikini: She wears a crinkle bikini in textured, crinkled fabric with a V-neck top and a high-cut bottom.
Balconette Bikini: She wears a balconette bikini with horizontal underwire cups and wide-set straps, paired with a high-waisted bottom.
Cross Strap Bikini: She wears a cross strap bikini with straps that wrap and crisscross around the torso and waist.
Strappy Side Bikini: She wears a bikini with a crisscross triangle top and a bottom with multiple lace-up strings at the hips.
Chain-Trim Bikini: She wears a bandeau bikini with decorative metal chain trim and side ties on the bottom.
Starfish Wide Strap Bikini: She wears a textured bikini with wide straps, a small starfish ring at the center, and a high-cut bottom.
V-Wired Bikini: She wears a V-wired bikini with V-shaped underwire cups, contrast binding, and a tie-side bottom.
3D Rose Bikini: She wears a bikini decorated with sculpted 3D fabric roses on the straps and bottom.
Ruched Lace Bandeau Bikini: She wears a ruched bandeau bikini in a soft floral lace print with a high-cut bottom.
Bow Bandeau Bikini: She wears a bow bandeau bikini with fabric knotted into a large bow at the center front.
Mesh Halter Bikini: She wears a mesh halter bikini with a sheer mesh crossover top, an O-ring halter neck, contrast piping, and a high-waisted bottom with contrast panel lines.
Ruffle Bandeau Bikini: She wears a bandeau bikini with layered ruffles across the top and a tie-side bottom.
Halter Bikini: She wears a halter bikini with neck ties and a matching bottom.
Cross Bikini: She wears a cross bikini with straps crossing around the torso.

TANKINIS

Tankini: She wears a tankini with a tank-style top and a separate bottom.
Floral Tankini: She wears a floral tankini with a printed tank top and matching bottom.

ONE-PIECE SWIMSUITS

Classic One-Piece: She wears a classic scoop-neck one-piece swimsuit.
Monokini: She wears a monokini with deep cut-outs joining the top and bottom.
Halter One-Piece: She wears a halter one-piece with neck ties.
High-Cut One-Piece: She wears a high-cut one-piece with high leg openings.
Sporty One-Piece: She wears a sporty one-piece with contrast stripes.
Retro One-Piece: She wears a polka-dot retro one-piece with a belt.
Mesh One-Piece: She wears a one-piece with sheer mesh panels.
Backless One-Piece: She wears a backless one-piece with an open back.
Zipper One-Piece: She wears a one-piece with a front zip.
Plunge One-Piece: She wears a plunge one-piece with a deep V-neckline and ruched front panels.
Asymmetric Cut-Out One-Piece: She wears a one-shoulder one-piece with double straps and a dramatic cut-out across the waist.
Cross-Back One-Piece: She wears a one-piece with thin straps that cross over the back and a smooth front.
Square Neck One-Piece: She wears a square neck one-piece with thin straps and a simple, minimal cut.
Tank One-Piece: She wears a tank one-piece with wide straps, a scoop neck, and a classic athletic shape.
Ruched One-Piece: She wears a ruched one-piece with gathered fabric down the front and a halter or bandeau neckline.
Textured One-Piece: She wears a textured one-piece in wavy ribbed fabric with a V-neckline.
Halter Keyhole One-Piece: She wears a halter one-piece with a keyhole opening at the chest and a plunging neckline.
Lace-Up One-Piece: She wears a lace-up one-piece with a keyhole front crossed by laces.
Cut-Out Swimsuit: She wears a cut-out swimsuit with a halter neck and open side panels connected by a center ring.
Twist Underwire One-Piece: She wears a one-piece with structured underwire cups and a twisted cut-out at the waist.
Chain Monokini: She wears a monokini with chain details.
Swim Dress: She wears a swim dress with a ruched bodice and an attached flared skirt over built-in swim shorts.
Long-Sleeve Swimsuit: She wears a long-sleeve printed swimsuit with full sleeves and a one-piece body.
White One-Piece: She wears a clean white one-piece with side ties.

RETRO & CLASSIC

Vintage Two-Piece: She wears a polka-dot vintage two-piece with high-waisted bottoms.
Pin-Up One-Piece: She wears a pin-up one-piece with a sweetheart neckline.
Polka Dot One-Piece: She wears a polka-dot one-piece with a retro fit.
Sailor One-Piece: She wears a sailor one-piece with a nautical collar and bow.
Striped Retro Bikini: She wears a striped retro bikini with high-waisted bottoms and a supportive top.
Belted One-Piece: She wears a one-piece with a buckle belt.

SPORTY & ACTIVITY

Rash Guard (Long Sleeve): She wears a long-sleeve zip-up rash guard.
Rash Guard (Short Sleeve): She wears a short-sleeve rash guard.
Rash Guard Set: She wears a rash guard set with a zip-up long-sleeve top and drawstring swim shorts.
Full Wetsuit: She wears a full neoprene wetsuit covering arms and legs, sleek and athletic for surfing and diving.
Shorty Wetsuit: She wears a shorty wetsuit with short sleeves and short legs in thick neoprene.
Fitness Swimwear: She wears a supportive racerback fitness swimsuit.
Tank and Swim Shorts: She wears a sporty swim tank top with matching swim shorts, relaxed and active.
Zip-Up Swim Jacket: She wears a zip-up swim jacket over a swimsuit.
Swim Pants: She wears full-length striped swim pants.
Wetsuit: She wears a full neoprene wetsuit.
Short Wetsuit: She wears a shorty wetsuit with short sleeves and legs.
Tank and Shorts: She wears a swim tank top and swim shorts.

RESORT & COVER-UPS

Wrap Dress Cover-Up: She wears a light wrap dress cover-up.
Sheer Cover-Up: She wears a sheer cover-up shirt.
Romper Cover-Up: She wears a romper cover-up.
Sarong: She wears a sarong wrapped around her hips.
Long Cover-Up: She wears a long cardigan cover-up.

JAPANESE / KIMONO SWIMWEAR

Yukata Swimsuit: She wears a yukata-inspired swimsuit with an obi sash.
Modern Kimono Swimsuit: She wears a short wrapped kimono swimsuit with florals.
Samurai-Inspired Swimsuit: She wears a samurai-inspired swimsuit with armor-like panels.
Shrine Maiden Swimsuit: She wears a shrine maiden swimsuit with wide sleeves and a pleated skirt.
Floral Kimono Swimsuit: She wears a floral kimono swimsuit.
Casual Kimono Swimsuit: She wears an open light kimono over a bikini.

SCI-FI / FANTASY SWIMWEAR

Water Element Swimsuit: She wears a swimsuit with flowing wave patterns.
LED Swimsuit: She wears a swimsuit with glowing LED strips.
Armor Swimsuit: She wears a swimsuit with metallic armor plates.
Tactical Swimsuit: She wears a swimsuit with straps, buckles, and pouches.
Space Swimsuit: She wears a sleek futuristic space swimsuit.
Dragon Armor Swimsuit: She wears a swimsuit with scale textures and horn ornaments.

LAYERED OUTFITS

Lace Bra & Printed Sarong: She wears a padded lace-trimmed underwire bra with a printed sarong skirt wrapped and knotted at the hip, falling in an asymmetrical draped hem.
Underwire Top & Sheer Sarong: She wears a white underwire balconette top with a sheer chiffon sarong wrapped and knotted at the hip over a matching bottom, with a high side slit.
Saree with Tie-Front Bra Top: She wears a draped silk saree with a gold border and woven motifs, the pallu draped over one shoulder, paired with a tie-front padded bra top in place of a blouse.
Textured Bikini Three-Piece Set: She wears a textured triangle halter bikini with a matching ruched mini sarong skirt and a sheer open-knit long-sleeve cover-up with ruffled edges.
Blazer, Lace Bustier & Ruffle Skort: She wears an open tailored blazer over a lace longline bustier, paired with a ruched mini skort with a cascading front ruffle.
Sheer Shirt & Leather Mini Skirt: She wears a sheer button-up shirt left open over a lace bra, paired with a faux leather wrap mini skirt.
""")


# Where each category is worn. "set" categories are two-piece outfits whose
# pieces are listed in GYM_SETS; one-piece "full" outfits only fill prompt.
SLOTS = {
    "Gowns": "full", "Hoodies": "top", "Skirts": "bottom", "Bras": "top",
    "Bodycon Dresses": "full", "Crop Tops": "top", "Virgin Killer": "top",
    "Backless Dresses": "full", "Tops": "top", "Blouses": "top",
    "Summer Dresses": "full", "Jumpsuits": "full", "Jerseys": "top", "Kurtis": "top", "Dupattas": "top",
    "Gymwear": "set", "Pants": "bottom", "Shorts": "bottom", "Cardigans": "top", "Jackets": "top", "Jeans": "bottom",
    "Burqa": "full", "Shalwars": "bottom", "Underwear": "bottom",
    "Lingerie Sets": "full", "Bodysuits & Corsetry": "full", "Sleepwear & Nightwear": "full", "Lounge Shorts & Briefs": "bottom",
    "Layered Outfits": "full",
    "Bikinis": "full", "Tankinis": "full", "One-Piece Swimsuits": "full", "Retro & Classic": "full",
    "Sporty & Activity": "full", "Resort & Cover-Ups": "full", "Japanese / Kimono Swimwear": "full",
    "Sci-Fi / Fantasy Swimwear": "full",
}
TOP_CATEGORIES = [name for name, slot in SLOTS.items() if slot == "top"]
BOTTOM_CATEGORIES = [name for name, slot in SLOTS.items() if slot == "bottom"]

GYM_SETS = {
    "Sports Bra & Leggings": ("She wears a sports bra in a soft ribbed fabric.", "She wears matching high-waisted ribbed leggings."),
    "Tank Top & Shorts": ("She wears a fitted racerback tank top.", "She wears loose, lightweight running shorts."),
    "T-Shirt & Leggings": ("She wears a classic short-sleeve athletic t-shirt.", "She wears full-length black leggings."),
    "Long Sleeve & Leggings": ("She wears a fitted long-sleeve workout top with thumbholes.", "She wears matching full-length leggings."),
    "Long-Sleeve Crop Top & Leggings": ("She wears a snug long-sleeve crop top that ends above her waist.", "She wears high-waisted leggings."),
    "Hoodie & Joggers": ("She wears a soft pullover hoodie with a drawstring hood.", "She wears tapered joggers with cuffed ankles."),
    "Sports Bra & Biker Shorts": ("She wears a scoop-neck sports bra.", "She wears high-waisted biker shorts that end mid-thigh."),
    "Crop Top & Joggers": ("She wears a fitted sleeveless crop top.", "She wears relaxed drawstring joggers."),
    "Muscle Tee & Shorts": ("She wears a loose muscle tee with deep armholes.", "She wears fitted bike shorts."),
    "Sports Bra & Workout Pants": ("She wears a supportive sports bra.", "She wears loose, wide-leg drawstring workout pants."),
    "Track Jacket & Leggings": ("She wears a fitted full-zip track jacket with a high collar.", "She wears full-length leggings."),
    "Strappy Bra & Leggings": ("She wears a strappy sports bra with crisscross straps across the back.", "She wears high-waisted leggings."),
    "Loose Tank & Leggings": ("She wears a flowy, relaxed-fit tank top with a dropped armhole.", "She wears fitted leggings."),
    "Sleeveless Hoodie & Joggers": ("She wears a sleeveless hoodie with a drawstring hood.", "She wears jogger sweatpants."),
    "Seamless Set": ("She wears a seamless knit tank.", "She wears seamless knit leggings."),
    "Mesh Tank & Leggings": ("She wears a sheer mesh tank layered over a sports bra.", "She wears full-length leggings."),
    "Printed Leggings & Sports Bra": ("She wears a solid sports bra.", "She wears boldly patterned leggings in a camo or abstract print."),
    "Half-Zip Top & Leggings": ("She wears a fitted long-sleeve half-zip pullover with a stand collar.", "She wears full-length leggings."),
    "Sports Bra & Sweat Shorts": ("She wears a simple sports bra.", "She wears soft, loose drawstring sweat shorts."),
    "Crop Hoodie & Biker Shorts": ("She wears a cropped pullover hoodie ending above her waist.", "She wears fitted biker shorts."),
    "Racerback Tank & Leggings": ("She wears a racerback tank top that crosses into a Y at the back.", "She wears full-length leggings."),
    "Matching Gym Set": ("She wears a sports bra.", "She wears leggings in the same color."),
    "Oversized T-Shirt & Biker Shorts": ("She wears a baggy oversized t-shirt.", "She wears short biker shorts."),
    "Graphic Tee & Biker Shorts": ("She wears an oversized graphic t-shirt with a bold printed design.", "She wears fitted biker shorts."),
    "Tennis Skirt Outfit": ("She wears a fitted sports bra.", "She wears a pleated athletic tennis skirt with built-in shorts."),
    "Flared Leggings Outfit": ("She wears a short-sleeve crop top.", "She wears high-waisted flared leggings that widen at the ankle."),
    "Sweatpants & Sports Bra": ("She wears a sports bra under an open cardigan draped over her shoulders.", "She wears loose, high-waisted sweatpants."),
    "Hoodie & Leggings": ("She wears a cropped pullover hoodie.", "She wears full-length leggings."),
    "Oversized Jacket Layered Set": ("She wears a fluffy oversized jacket slipping off her shoulders over a sports bra.", "She wears fitted leggings."),
    "Crop Tee & Joggers": ("She wears a boxy cropped t-shirt.", "She wears loose cuffed joggers."),
    "Sports Bra & Running Shorts": ("She wears a sports bra.", "She wears loose running shorts trimmed with contrast piping."),
    "All-Black Gym Outfit": ("She wears a sleek black sports bra.", "She wears black leggings."),
    "All-White Gym Outfit": ("She wears a clean white sports bra.", "She wears white leggings."),
    "Neutral Taupe Gym Outfit": ("She wears a blush sports bra.", "She wears taupe-brown leggings."),
    "Pastel Gym Outfit": ("She wears a pastel periwinkle sports bra.", "She wears matching periwinkle leggings."),
}


def _pieces(category, style):
    slot = SLOTS[category]
    if slot == "set":
        return GYM_SETS.get(style, ("", ""))
    text = WARDROBE[category][style]
    return (text if slot == "top" else "", text if slot == "bottom" else "")


def _colored(text, color):
    """Slot the color (and/or pattern) in after "She wears", fixing the a/an article."""
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
                io.Boolean.Input("random_metallic", default=False, tooltip="Use a seeded-random metallic (gold, silver, ...) in place of the color."),
                io.Boolean.Input("random_pattern", default=False, tooltip="Put a seeded-random pattern (polka dot, plaid, ...) before the outfit, after any color."),
                io.Boolean.Input("mix_outfit", default=False, tooltip="Ignore the category and pair a seeded-random top with a seeded-random bottom. With a color, one piece gets a neutral and the pattern goes on the other."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
            ],
            outputs=[
                io.String.Output("prompt"),
                io.String.Output("category"),
                io.String.Output("style"),
                io.String.Output("topwear", tooltip="Top half of the outfit. Empty for one-piece outfits and bottoms."),
                io.String.Output("bottomwear", tooltip="Bottom half of the outfit. Empty for one-piece outfits and tops."),
            ],
        )

    @classmethod
    def execute(cls, category, random_category, random_style, random_color, random_metallic, random_pattern, mix_outfit, seed, weight) -> io.NodeOutput:
        rng = random.Random(seed)

        def descriptor():
            color = rng.choice(METALLICS) if random_metallic else rng.choice(COLORS) if random_color else ""
            return " ".join(filter(None, [color, rng.choice(PATTERNS) if random_pattern else ""]))

        if mix_outfit:
            top_name = rng.choice(TOP_CATEGORIES)
            top_style = rng.choice(list(WARDROBE[top_name]))
            bottom_name = rng.choice(BOTTOM_CATEGORIES)
            bottom_style = rng.choice(list(WARDROBE[bottom_name]))
            top, bottom = WARDROBE[top_name][top_style], WARDROBE[bottom_name][bottom_style]
            # Neutral + accent: one piece gets a plain neutral, the other the color and pattern.
            accent = descriptor()
            plain = rng.choice(NEUTRALS) if random_color or random_metallic else ""
            if rng.random() < 0.5:
                accent, plain = plain, accent
            if accent:
                top = _colored(top, accent)
            if plain:
                bottom = _colored(bottom, plain)
            return io.NodeOutput(weighted(f"{top} {bottom}", weight), f"{top_name} / {bottom_name}", f"{top_style} / {bottom_style}", weighted(top, weight), weighted(bottom, weight))

        name = rng.choice(list(WARDROBE)) if random_category else category["category"]
        items = WARDROBE[name]
        style = rng.choice(list(items)) if random_category or random_style else category["style"]
        text, (top, bottom) = items[style], _pieces(name, style)
        color = descriptor()
        if color:
            text, top, bottom = (_colored(t, color) if t else "" for t in (text, top, bottom))
        return io.NodeOutput(weighted(text, weight), name, style, weighted(top, weight), weighted(bottom, weight))


NODES = [MBWardrobeSelector]
