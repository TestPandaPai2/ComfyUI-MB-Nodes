"""Accessories picker: one dropdown per category (none, seeded-random, or a
style), all picked pieces joined into one description, with an optional
metal finish shared by every piece."""

import random

from comfy_api.latest import io

from .common import MAX_SEED, weighted
from .wardrobe_selector_node import _sections

ACCESSORIES = _sections("""
WAIST CHAINS

Simple Chain: She wears a simple waist chain made of a single, fine cable-link chain that sits low on her hips just below the navel, finished with a tiny lobster clasp and a short adjustable extender at the side, minimal, lightweight, and elegantly understated.
Layered Chain: She wears a layered waist chain with three to four fine chains of graduated lengths joined at the sides, the top strand at her natural waist and each strand below draping a little lower toward her hips, so they fall in soft, delicate tiers.
Beaded Waist Chain: She wears a beaded waist chain at her natural waist, with small round pearls spaced evenly along a thin chain, each bead secured by tiny links so the pearls sit neatly in a row around the narrowest part of her waist, soft, bohemian, and romantic.
Heart Chain: She wears a heart waist chain that sits low on her hips, with tiny puffed heart charms dangling at regular intervals from a fine chain, the little hearts swinging gently with each step for a cute, sweet, feminine touch.
Dangle Chain: She wears a dangle waist chain at her natural waist, with small teardrop and bead charms hanging from short drop links along a fine chain, creating a fringe of tiny pendants that sway and shimmer as she moves.
Butterfly Chain: She wears a butterfly waist chain slung low on her hips, with small flat butterfly charms threaded along a delicate chain, each butterfly spaced apart so they look like they are fluttering around her hips, dreamy and Y2K-inspired.
Coin Chain: She wears a coin waist chain draped over the waistband of her skirt, lined with round stamped coin discs hanging from small jump rings along a fine chain, the engraved coins clinking softly as she walks, bohemian, vintage, and festival-ready.
Shell Chain: She wears a shell waist chain low on her bare hips, with natural cowrie shells hung from small rings along a thin chain, the smooth shells lying flat against the skin for an easy, tropical, beachy summer look.
Rhinestone Chain: She wears a rhinestone waist chain cinched over her dress at the natural waist, made of a continuous line of small crystals set in claw settings, forming a slim sparkling band that glitters and catches the light.
Waist Chain Belt: She wears a chunky waist chain belt of thick, polished curb links fastened with a hook clasp over the waistband of her clothing, with a long chain tail hanging down the front, bold and statement-making.
Body Chain: She wears a waist-style body chain with fine strands that loop around her natural waist and crisscross over her stomach in an X pattern, meeting at a small center connector with a dangling drop charm, dramatic and eye-catching.
Custom Name Chain: She wears a custom name waist chain that sits low on her hips, with small block letter charms spelling a name or word spaced evenly along a delicate chain, personal and unique.
Belly Button Drop Chain: She wears a belly button drop chain with a fine chain around her natural waist and a single long vertical strand that falls from the center down toward her navel, ending in a small pendant charm.
Star Charm Chain: She wears a star charm waist chain set high on her waist just under the bust, with tiny star-shaped charms and miniature crescent moons alternating along a thin chain, celestial, whimsical, and dainty.
Paperclip Chain: She wears a paperclip waist chain at her natural waist, made of flat, elongated rectangular links that sit smoothly against the skin, modern, sleek, and minimalist.
Satellite Bead Chain: She wears a satellite bead waist chain low on her hips, a fine chain dotted with tiny polished metal beads at small, even intervals, giving a subtle shimmer and a clean, delicate finish.
Multi-Strand Belly Chain: She wears a multi-strand belly chain with five or more thin chains bundled at the sides of her natural waist and draping in a loose cascade across her stomach, glamorous and bold.
Crystal Drop Chain: She wears a crystal drop waist chain over her dress at the natural waist, with sparkling teardrop crystals hanging from a fine chain, each crystal catching the light like a tiny droplet, glamorous and evening-ready.
Gemstone Chain: She wears a gemstone waist chain low on her hips, with small polished colored stones set in bezel frames and linked along a delicate chain, earthy, vibrant, and bohemian.
Turquoise Bead Chain: She wears a turquoise bead waist chain slung over the waistband of her jeans, strung with small turquoise beads and tiny metal spacers, carrying a free-spirited, southwestern, desert-boho feel.
Seed Bead Waist Strand: She wears a seed bead waist strand, a row of tiny glass seed beads threaded on a stretch or tie cord that sits snugly at her natural waist, colorful and handmade.
Tassel Chain: She wears a tassel waist chain low on her hips, with small fringed chain tassels hanging at the sides and front from a fine chain, swaying with movement for a playful, dance-inspired look.
Y-Drop Lariat Chain: She wears a Y-drop lariat waist chain with a chain around her natural waist and two strands meeting at a central ring, from which a longer chain falls down the front of her hips.
Snake Chain: She wears a snake waist chain set high on her waist just under the ribs, made of smooth, tightly linked flexible tubing that lies flat against the skin with a liquid, glossy shine, sleek and modern.
Figaro Chain: She wears a Figaro waist chain low on her hips, a flat chain with a repeating pattern of three short round links followed by one long oval link, classic and Italian-inspired.
Rope Twist Chain: She wears a rope twist waist chain at her natural waist, made of tightly twisted metal strands that form a slim, textured braid catching the light from every angle.
Box Chain: She wears a box waist chain low on her hips, made of small square links joined into a smooth, sturdy, four-sided chain with a clean geometric shine.
Herringbone Chain: She wears a herringbone waist chain at her natural waist, a flat band of tightly woven slanted links that lies flush against the skin with a mirror-like gleam.
Pearl Drop Chain: She wears a pearl drop waist chain low on her hips, with small teardrop pearls hanging from short links along a fine chain, swaying softly with each step, romantic and bridal.
Evil Eye Chain: She wears an evil eye waist chain at her natural waist, with small round blue enamel eye charms spaced along a fine chain, protective, colorful, and Mediterranean.
Flower Chain: She wears a flower waist chain low on her hips, with tiny enamel daisy charms linked along a delicate chain, fresh, sweet, and springlike.
Ghungroo Chain: She wears a ghungroo waist chain low on her hips, with rows of tiny metal bells hanging from a fine chain that jingle softly with every movement, traditional and dance-inspired.
Kamarbandh: She wears a kamarbandh, an ornate Indian waist belt of linked gold panels with a large jeweled centerpiece at the front, set with kundan stones and pearl drops, cinched over her saree at the natural waist, regal and bridal.
Double Pearl Strand: She wears a double pearl strand waist chain at her natural waist, two rows of small round pearls lying side by side and joined at the sides with tiny metal connectors, soft and elegant.
Moon Phase Chain: She wears a moon phase waist chain low on her hips, with small round discs showing each phase of the moon from new to full spaced evenly along a fine chain, mystical and celestial.
Chainmail Hip Drape: She wears a chainmail hip drape, a fine mesh of tiny linked rings that hangs from a chain at her hips in a shimmering V over the front of her skirt, edgy and dramatic.
Harness Waist Chain: She wears a harness waist chain with a fine chain around her natural waist joined by vertical strands to a second chain just under her bust, framing her midriff, bold and sculptural.
Leaf Charm Chain: She wears a leaf charm waist chain low on her hips, with small flat leaf charms hanging along a fine chain like a delicate garland, earthy and boho.
Cherry Charm Chain: She wears a cherry charm waist chain at her natural waist, with tiny red enamel cherry pairs dangling along a fine chain, playful, flirty, and retro.
Sequin Disc Chain: She wears a sequin disc waist chain low on her hips, with rows of tiny flat metal discs hanging close together from a fine chain, shimmering like scales as she moves, festival-ready.
Toggle Clasp Chain: She wears a toggle clasp waist chain at her natural waist, a medium-weight link chain fastened at the front with a large ring-and-bar toggle clasp, bold and on-trend.
Bar Link Chain: She wears a bar link waist chain low on her hips, made of slim polished metal bars joined end to end by tiny rings, sleek, modern, and architectural.
Pave Link Chain: She wears a pave link waist chain cinched over her dress at the natural waist, made of small oval links covered in tiny set crystals, sparkling and luxurious.
Bow Charm Chain: She wears a bow charm waist chain low on her hips, with small tied-bow charms spaced evenly along a fine chain, girly, sweet, and coquette.
Cuban Link Chain: She wears a Cuban link waist chain slung over the waistband of her jeans, made of thick, interlocking curb links that lie flat with a heavy, glossy finish, bold and streetwear-inspired.
Ball Chain: She wears a ball chain at her natural waist, a fine strand of tiny round metal beads joined edge to edge, light, playful, and minimal.
Lock Charm Chain: She wears a lock charm waist chain low on her hips, a fine chain with a small polished padlock charm hanging at the front, edgy and symbolic.
Double Hip Chain: She wears a double hip chain, two fine chains that sit one above the other low on her hips, the lower strand draping slightly longer at the front, subtle and sensual.
Circle Link Chain: She wears a circle link waist chain at her natural waist, made of open round rings joined by tiny links, airy, retro, and graphic.
Opal Bead Chain: She wears an opal bead waist chain low on her hips, with small iridescent opal beads spaced along a fine chain, glowing with soft rainbow flashes, dreamy and ethereal.

NECKLACES

Chain Necklace: She wears a chunky chain necklace made of large, polished oval links that sit just below the collarbone, bold and versatile on its own or layered with finer pieces.
Pendant Necklace: She wears a pendant necklace with a single sparkling teardrop gem hanging from a fine chain, resting delicately at the center of her chest.
Layered Necklace: She wears a layered necklace with three fine chains of graduated lengths, the shortest at her collarbone and the longest on her upper chest, each carrying a small charm or pendant, creating a dimensional, trendy tiered look.
Multi-Strand Necklace: She wears a multi-strand necklace with five or more fine chains joined at a single clasp, draping in close, parallel rows from her collarbone down across her upper chest.
Choker Necklace: She wears a choker necklace, a snug band that sits tightly around the base of her neck, finished with a small dangling charm at the center front.
Collar Necklace: She wears a collar necklace, a rigid, crescent-shaped metal piece that rests flat on her collarbones with a sculpted, modern, structured look.
Princess Necklace: She wears a princess-length necklace, a fine chain that falls just at the collarbone with a single small solitaire stone at the center, timeless for everyday wear.
Matinee Necklace: She wears a matinee-length necklace that falls to the upper chest, made of a fine chain dotted with small stones or links, ideal over tops and dresses.
Opera Necklace: She wears an opera-length necklace, a long strand of lustrous pearls falling to the bust, worn single or looped double for an elegant effect.
Rope Necklace: She wears a rope necklace with tightly twisted strands forming a thick, textured braid of metal that falls to her upper chest, long enough to wrap twice.
Bib Necklace: She wears a bib necklace, an elaborate cluster of jewels and crystals arranged in a wide fan that covers her upper chest like a decorative collar.
Y-Necklace: She wears a Y-necklace with a fine chain around the base of her neck meeting at a central point, from which a single vertical drop strand falls down the front of her chest toward her bust to form a Y shape.
Lariat Necklace: She wears a lariat necklace, a long clasp-free chain that loops through a ring or knot at the base of her throat, with the loose ends hanging down vertically over her chest.
Station Necklace: She wears a station necklace that falls just below her collarbone, with small gemstones or charms spaced evenly along a fine chain, each sparkling like a tiny stop along the strand.
Tennis Necklace: She wears a tennis necklace at her collarbone, a continuous line of identical small diamonds or crystals set side by side in a flexible row around her neck.
Pearl Necklace: She wears a classic pearl necklace with a single strand of round, lustrous pearls of equal size sitting at the collarbone, graceful and refined.
Beaded Necklace: She wears a beaded necklace falling to her upper chest, strung with polished colored stone beads and tiny metal spacers, adding color, texture, and personality.
Initial Necklace: She wears an initial necklace with a single letter pendant hanging from a fine chain, resting just below the hollow of her throat, personal, meaningful, and perfect for everyday wear.
Statement Necklace: She wears a statement necklace sitting across her collarbones, with oversized jeweled flowers and clustered crystals forming a bold, eye-catching centerpiece.
Kundan Necklace: She wears a kundan necklace resting along her collarbones and upper chest, with glass gems set in gold foil within an ornate collar design, finished with pearl drops along the edge, regal and traditional.
Temple Necklace: She wears a temple necklace in antique gold falling to her upper chest, with deity motifs, intricate carved detailing, and a large ornate center pendant at the center of her chest, rich and traditional.
Solitaire Necklace: She wears a solitaire necklace with a single brilliant diamond set on a whisper-thin chain, resting at the hollow of her throat, minimal, timeless, and elegant.
Charm Necklace: She wears a charm necklace at her collarbone, with an assortment of small charms like stars, hearts, shells, and coins hanging along a fine chain, playful and personal.
Lock Necklace: She wears a lock necklace with a polished padlock pendant hanging from a fine chain just below her collarbone, sleek, modern, and symbolic.
Torque Necklace: She wears a torque necklace, a rigid open-ended metal ring that wraps around the base of her neck with small ball-capped ends at the front.
Locket Necklace: She wears a locket necklace with a small engraved oval locket hanging from a fine chain just below her collarbone, its hinged front closed over a hidden keepsake, sentimental and vintage.
Bar Necklace: She wears a bar necklace with a slim horizontal metal bar suspended from a fine chain at each end, lying flat across the base of her throat, clean and minimal.
Cross Necklace: She wears a cross necklace with a small, delicate cross pendant hanging from a fine chain at the hollow of her throat, simple and graceful.
Heart Pendant Necklace: She wears a heart pendant necklace with a small puffed heart charm hanging from a fine chain just below her collarbone, sweet and romantic.
Evil Eye Necklace: She wears an evil eye necklace with a small round blue enamel eye charm at the center of a fine chain, resting at the base of her throat, protective and charming.
Herringbone Necklace: She wears a herringbone necklace, a flat, liquid-smooth chain of tightly woven slanted links that lies flush along her collarbones with a high, mirror-like shine.
Snake Chain Necklace: She wears a snake chain necklace, a smooth, round, flexible chain of tightly fitted links that drapes at her collarbone with a sleek, glossy sheen.
Paperclip Necklace: She wears a paperclip necklace of flat, elongated rectangular links falling just below her collarbone, modern, sleek, and effortlessly cool.
Velvet Ribbon Choker: She wears a velvet ribbon choker, a narrow band of soft black velvet tied snugly around her neck with a small metal charm at the center front, romantic and Victorian-inspired.
Lace Choker: She wears a lace choker, a delicate band of black floral lace that wraps snugly around her neck and fastens at the back, soft, gothic, and feminine.
Coin Pendant Necklace: She wears a coin pendant necklace with a round stamped medallion coin hanging from a sturdy chain on her upper chest, vintage and bold.
Birthstone Necklace: She wears a birthstone necklace with a single small colored gemstone set in a tiny bezel on a fine chain, resting just below the hollow of her throat, personal and dainty.
Nameplate Necklace: She wears a nameplate necklace with a name written in flowing cursive script cut from polished metal, attached to a fine chain at both ends and resting across her collarbone.
Cameo Necklace: She wears a cameo necklace with an oval carved shell cameo showing a woman's profile in a filigree frame, hanging from a fine chain on her upper chest, antique and romantic.
Riviera Necklace: She wears a riviera necklace, a single row of individually set gemstones that grow slightly larger toward the center, encircling her neck at the collarbone with brilliant, unbroken sparkle.
Mangalsutra: She wears a mangalsutra, a fine chain of tiny black beads with a small gold pendant at the center, falling to her upper chest, traditional and meaningful.
Rani Haar: She wears a rani haar, a long, layered Indian necklace of several gold and beaded strands falling to her waist, finished with a large ornate pendant, grand and bridal.
Polki Choker: She wears a polki choker, a wide collar of uncut diamonds set in gold that sits close around her neck, with emerald drops and pearl strings along the lower edge, royal and opulent.
Shell Necklace: She wears a shell necklace strung with small polished puka shells on a cord that sits close at the base of her neck, easy, breezy, and beachy.
Crystal Cluster Necklace: She wears a crystal cluster necklace with a gathered bunch of raw quartz points hanging from a fine chain on her upper chest, earthy, mystical, and bohemian.
Crescent Moon Necklace: She wears a crescent moon necklace with a small polished crescent pendant hanging from a fine chain just below her collarbone, celestial and dreamy.
Bow Pendant Necklace: She wears a bow pendant necklace with a small tied-bow charm hanging from a fine chain at her collarbone, girly, playful, and sweet.
Floating Pearl Necklace: She wears a floating pearl necklace with a few small pearls spaced along a nearly invisible fine chain, so they seem to float around her collarbone, light and ethereal.
Fringe Necklace: She wears a fringe necklace with a row of fine chain strands of graduated lengths hanging from a collar chain, forming a shimmering V of fringe over her upper chest.
Sautoir Necklace: She wears a sautoir necklace, a very long chain falling past her bust to her waist and ending in a silky tassel pendant, 1920s-inspired and glamorous.

BRACELETS

Tennis Bracelet: She wears a tennis bracelet on her wrist, a slim, flexible line of identical small diamonds set side by side that circles her wrist in unbroken sparkle.
Bangle Bracelet: She wears a single bangle bracelet on her wrist, a smooth, rigid round band that slides freely and catches the light, simple and classic.
Stacked Bangles: She wears a stack of five or six thin bangles on her wrist, slim rigid bands that clink softly together with every move.
Cuff Bracelet: She wears a wide cuff bracelet on her wrist, a solid band of polished metal with a small opening at the back, bold and sculptural.
Open Cuff: She wears an open cuff bracelet on her wrist, a slim rigid band with two decorative ends that meet at the top of her wrist, modern and minimal.
Hinged Bangle: She wears a hinged bangle on her wrist, a sleek oval band with a hidden hinge and clasp so it fits close around her wrist, polished and elegant.
Chain Bracelet: She wears a fine chain bracelet on her wrist, a delicate cable-link chain fastened with a tiny lobster clasp, minimal and everyday.
Cuban Link Bracelet: She wears a Cuban link bracelet on her wrist, a heavy chain of thick, interlocking curb links that lie flat with a bold, glossy finish.
Figaro Bracelet: She wears a Figaro bracelet on her wrist, a flat chain with a repeating pattern of three short round links followed by one long oval link, classic and Italian-inspired.
Paperclip Bracelet: She wears a paperclip bracelet on her wrist, a chain of flat, elongated rectangular links that drape loosely, modern and sleek.
Herringbone Bracelet: She wears a herringbone bracelet on her wrist, a flat, liquid-smooth chain of tightly woven slanted links that hugs her wrist with a mirror-like shine.
Snake Chain Bracelet: She wears a snake chain bracelet on her wrist, a smooth, round, flexible chain of tightly fitted links with a sleek, glossy sheen.
Rope Bracelet: She wears a rope bracelet on her wrist, a chain of tightly twisted strands forming a thick, textured braid of metal that catches the light from every angle.
Charm Bracelet: She wears a charm bracelet on her wrist, a link chain hung with an assortment of small dangling charms like hearts, stars, shells, and keys, playful and personal.
Heart Charm Bracelet: She wears a heart charm bracelet on her wrist, a fine chain with tiny puffed heart charms spaced along it that swing gently as she moves, sweet and feminine.
Pearl Bracelet: She wears a pearl bracelet on her wrist, a single strand of round, lustrous pearls of equal size fastened with a small clasp, graceful and refined.
Multi-Strand Pearl Bracelet: She wears a multi-strand pearl bracelet on her wrist, three or four rows of small pearls joined at an ornate clasp, forming a soft, wide band, vintage and elegant.
Beaded Bracelet: She wears a beaded bracelet on her wrist, a stretch strand of polished round gemstone beads with a single metal spacer bead, earthy and calm.
Seed Bead Bracelet: She wears a seed bead bracelet on her wrist, a thin strand of tiny colorful glass seed beads on a stretch cord, cheerful and handmade.
Friendship Bracelet: She wears a woven friendship bracelet on her wrist, a flat band of braided colorful embroidery threads in a chevron pattern tied with knotted ends, youthful and carefree.
Slider Bracelet: She wears a slider bracelet on her wrist, a fine chain with a small sliding bead that adjusts the fit, finished with a tiny gem at each end, dainty and modern.
Bar Bracelet: She wears a bar bracelet on her wrist, a slim horizontal metal bar joined to a fine chain at both ends, lying flat on top of her wrist, clean and minimal.
Initial Bracelet: She wears an initial bracelet on her wrist, a fine chain with a single small letter charm, personal and understated.
Nameplate Bracelet: She wears a nameplate bracelet on her wrist, a name in flowing cursive script cut from polished metal and joined to a fine chain at both ends.
ID Bracelet: She wears an ID bracelet on her wrist, a sturdy link chain with a flat polished rectangular plate across the top of her wrist, classic and a little tomboyish.
Station Bracelet: She wears a station bracelet on her wrist, a fine chain with small gemstones spaced evenly along it, each one sparkling like a tiny stop along the strand.
Evil Eye Bracelet: She wears an evil eye bracelet on her wrist, a fine chain with a small round blue enamel eye charm at the center, protective and charming.
Birthstone Bracelet: She wears a birthstone bracelet on her wrist, a fine chain with a few small colored gemstones in tiny bezel settings, personal and dainty.
Crystal Bracelet: She wears a crystal bracelet on her wrist, a slim band of small rhinestones in claw settings that glitters with every turn of her hand, glamorous and evening-ready.
Pave Bangle: She wears a pave bangle on her wrist, a slim rigid band covered all around in tiny closely set diamonds, so it shimmers like a ring of light.
Screw Motif Bangle: She wears a screw motif bangle on her wrist, a flat oval band with small screw-head details set evenly around it, fitted close to her wrist, sleek and iconic.
Twisted Bangle: She wears a twisted bangle on her wrist, a rigid band of metal twisted like a rope along its length, adding texture and shine.
Wrap Bracelet: She wears a wrap bracelet that loops three times around her wrist, a long strand of small beads and tiny charms fastened with a button clasp, bohemian and layered.
Leather Wrap Bracelet: She wears a leather wrap bracelet that loops twice around her wrist, thin cords of soft leather held by a small metal clasp, casual and rugged.
Layered Chain Bracelet: She wears layered chain bracelets on her wrist, three fine chains of different link styles worn together, one with a tiny charm, effortless and stylish.
Hand Chain: She wears a hand chain, a fine bracelet at her wrist joined by a delicate chain across the back of her hand to a slim ring on her middle finger, with a small charm at the center of the hand.
Upper Arm Cuff: She wears an upper arm cuff, a slim rigid open band that hugs her bicep just below the shoulder, bold and goddess-like.
Serpent Arm Bracelet: She wears a serpent arm bracelet, a coiled metal snake that wraps two or three times around her upper arm with a carved head at one end, dramatic and ancient-inspired.
Kada: She wears a kada on her wrist, a thick, heavy, rigid round band with an engraved pattern around its surface, traditional and bold.
Glass Bangles: She wears a stack of thin, colorful glass bangles on each wrist, a dozen or more glossy bands in matching shades that chime softly with every move, festive and traditional.
Kundan Bangles: She wears kundan bangles on her wrists, wide rigid bands set with glass gems in gold foil and rimmed with tiny pearls, regal and bridal.
Bridal Chooda: She wears a bridal chooda, two matching sets of red and ivory bangles stacked from wrist to mid-forearm on each arm, finished with gold-set bangles at each end, festive and bridal.
Hathphool: She wears a hathphool, an ornate bracelet at her wrist linked by decorative chains across the back of her hand to rings on her fingers, with a large jeweled medallion at the center of the hand, traditional and bridal.
Shell Bracelet: She wears a shell bracelet on her wrist, a strand of small cowrie shells on a cord with a sliding knot, easy, tropical, and beachy.
Turquoise Bracelet: She wears a turquoise bracelet on her wrist, a cuff set with polished turquoise stones in bezel frames, southwestern and boho.
Mesh Bracelet: She wears a mesh bracelet on her wrist, a flat, flexible band of finely woven metal mesh with a hidden magnetic clasp, smooth, modern, and fluid.
Toggle Bracelet: She wears a toggle bracelet on her wrist, a chunky link chain fastened at the front with a large ring-and-bar toggle clasp, bold and on-trend.
Lock Bracelet: She wears a lock bracelet on her wrist, a link chain with a small polished padlock charm at the center, sleek and symbolic.
Butterfly Bracelet: She wears a butterfly bracelet on her wrist, a fine chain with small flat butterfly charms spaced along it, dreamy and Y2K-inspired.
Star And Moon Bracelet: She wears a star and moon bracelet on her wrist, a fine chain with tiny star charms and miniature crescent moons alternating along it, celestial and whimsical.

JHUMKAS

Classic Gold Jhumka: She wears a pair of classic gold jhumkas, small domed bells hanging from round studs at her earlobes, edged with a fringe of tiny gold beads that sway with every turn of her head, timeless and graceful.
Temple Jhumka: She wears a pair of temple jhumkas in antique gold, round studs carved with tiny goddess motifs above deep bell domes etched with temple patterns, finished with a row of gold bead drops, sacred and traditional.
Kundan Jhumka: She wears a pair of kundan jhumkas, flower-shaped studs set with glass gems in gold foil above gem-studded bell domes, edged with dangling seed pearls, regal and festive.
Polki Jhumka: She wears a pair of polki jhumkas, uncut diamonds set in gold on the studs and around the bell domes, catching soft, old-world light, finished with small pearl drops, royal and bridal.
Meenakari Jhumka: She wears a pair of meenakari jhumkas, gold bell domes painted with bright red, green, and blue enamel florals, hanging from matching enamel studs with a fringe of tiny pearls, colorful and Rajasthani.
Oxidised Silver Jhumka: She wears a pair of oxidised silver jhumkas, darkened silver bells with hand-etched tribal patterns hanging from round studs, fringed with tiny silver beads, earthy and boho.
Pearl Drop Jhumka: She wears a pair of pearl drop jhumkas, small gold bell domes edged with a cascade of strung white pearls that fall below the bell and sway gently, soft and elegant.
Chandbali Jhumka: She wears a pair of chandbali jhumkas, crescent moon-shaped gold earrings with filigree and small stones, a tiny jhumka bell hanging from the center of each crescent, graceful and festive.
Peacock Jhumka: She wears a pair of peacock jhumkas, studs shaped like a peacock with its fanned tail in blue and green enamel, perched above a gold bell dome edged with pearls, vibrant and traditional.
Lakshmi Coin Jhumka: She wears a pair of Lakshmi coin jhumkas, small stamped coins with the goddess Lakshmi hanging around the rim of each gold bell dome, clinking softly as she moves, auspicious and South Indian.
Ghungroo Jhumka: She wears a pair of ghungroo jhumkas, gold bell domes ringed with tiny ghungroo bells that chime faintly with every step, playful and dance-inspired.
Jadau Jhumka: She wears a pair of jadau jhumkas, handset gemstones embedded in gold on intricate studs and bell domes, with ruby and emerald accents and pearl drops, opulent and heirloom.
Antique Matte Jhumka: She wears a pair of antique matte gold jhumkas, brushed, dull-finish gold bells with fine engraved detail and a fringe of tiny matte beads, vintage and understated.
Ruby Jhumka: She wears a pair of ruby jhumkas, gold studs set with a deep red ruby above bell domes lined with small rubies and finished with red bead drops, rich and romantic.
Emerald Jhumka: She wears a pair of emerald jhumkas, gold bell domes set with small green emeralds and edged with emerald bead drops, hanging from matching emerald studs, lush and regal.
Mini Stud Jhumka: She wears a pair of mini jhumkas, tiny gold bell domes hanging close below small studs at her earlobes, light, dainty, and perfect for everyday wear.
Sahara Jhumka: She wears a pair of sahara jhumkas, gold bells with fine beaded chains, called saharas, that sweep up from each earring and hook into her hair above the ears, framing her face, bridal and traditional.
Tiered Jhumka: She wears a pair of tiered jhumkas, two or three gold bell domes stacked one below another in shrinking sizes, each tier edged with tiny bead drops, dramatic and layered.
Oversized Jhumka: She wears a pair of oversized jhumkas, wide, heavy bell domes as big as her palm, carved and stone-set, hanging from large studs and nearly brushing her shoulders, bold and statement-making.
Kashmiri Jhumka: She wears a pair of Kashmiri jhumkas, small gold bells with long fine chains and tiny bead tassels hanging from the rim, swaying down toward her jawline, delicate and Kashmiri-inspired.
Thewa Jhumka: She wears a pair of thewa jhumkas, studs and bell domes set with colored glass under fine gold filigree sheets, glowing like stained glass, artisanal and Rajasthani.
Lotus Jhumka: She wears a pair of lotus jhumkas, studs shaped like an open lotus flower above petal-carved bell domes, with small pink stones and pearl drops, serene and sacred.
Rose Jhumka: She wears a pair of rose jhumkas, gold rose-shaped studs with layered petals above small bell domes etched with leaves, romantic and floral.
Mirror Work Jhumka: She wears a pair of mirror work jhumkas, fabric-wrapped bells studded with tiny round mirrors and edged with colorful threads, glinting in the light, Gujarati and festive.
Terracotta Jhumka: She wears a pair of terracotta jhumkas, handmade clay bells painted in warm reds, ochres, and whites, hanging from clay studs, earthy and artisanal.
Beaded Jhumka: She wears a pair of beaded jhumkas, bells woven from tiny multicolored glass beads with a beaded fringe at the rim, light, bright, and handmade.
Silk Thread Jhumka: She wears a pair of silk thread jhumkas, bell domes wrapped in shiny silk thread in bold colors and trimmed with tiny gold beads, cheerful and festive.
Guttapusalu Jhumka: She wears a pair of guttapusalu jhumkas, gold bells covered in clusters of tiny seed pearls in the Hyderabadi style, with ruby accents on the studs, refined and Nizami.
Navratna Jhumka: She wears a pair of navratna jhumkas, gold studs and bells set with nine different gemstones in a ring of rich colors, auspicious and vibrant.
American Diamond Jhumka: She wears a pair of American diamond jhumkas, silver-toned bells and studs fully set with tiny sparkling cubic zirconia stones, glittering and party-ready.
Filigree Jhumka: She wears a pair of filigree jhumkas, open, lace-like bells made of fine twisted silver wire in the Cuttack tarakasi style, airy, intricate, and handcrafted.
Kemp Stone Jhumka: She wears a pair of kemp stone jhumkas, gold bell domes and studs set with deep red and green kemp stones, finished with tiny gold bead drops, classic South Indian and bridal.
Elephant Jhumka: She wears a pair of elephant jhumkas, studs shaped like small adorned elephants with raised trunks above carved gold bells, charming and traditional.
Parrot Jhumka: She wears a pair of parrot jhumkas, two tiny enamel parrots perched on each stud above a gold bell dome edged with green beads, whimsical and folk-inspired.
Mango Motif Jhumka: She wears a pair of mango motif jhumkas, paisley mango-shaped studs set with stones above bell domes etched with mango patterns, classic and South Indian.
Moonstone Jhumka: She wears a pair of moonstone jhumkas, silver bells set with milky, glowing moonstones and hanging from moonstone studs, soft, mystical, and ethereal.
Bali Jhumka: She wears a pair of bali jhumkas, small gold hoops with a tiny jhumka bell hanging from the bottom of each hoop, light, playful, and everyday.
Ear Cuff Jhumka: She wears a pair of ear cuff jhumkas, gold cuffs that climb along the outer rim of her ears and end in small jhumka bells at the lobes, modern-traditional and striking.
Banjara Jhumka: She wears a pair of Banjara jhumkas, tribal silver bells hung with coins, cowrie shells, and colorful threads, bold, raw, and nomadic.
Maharashtrian Pearl Jhumka: She wears a pair of Maharashtrian pearl jhumkas, studs and bells fully covered in small pearls with a central red stone, graceful and Marathi-inspired.
Mughal Jhumka: She wears a pair of Mughal jhumkas, ornate domed bells with arch-shaped jaali cutwork and inlaid stones, finished with long pearl and emerald drops, royal and grand.
Bridal Statement Jhumka: She wears a pair of bridal statement jhumkas, large kundan and pearl jhumkas with layered bells, heavy stone-set studs, and pearl strings, made for her wedding day.
Diamond Cut Jhumka: She wears a pair of diamond cut jhumkas, gold bells with faceted, diamond-cut surfaces that sparkle without stones, crisp and shimmering.
Shell Jhumka: She wears a pair of shell jhumkas, small cowrie shells forming the bell and fringe around a gold stud, beachy, tribal, and fun.
Tassel Jhumka: She wears a pair of tassel jhumkas, small gold bells with long silk thread tassels falling from the rim, swinging with every move, festive and playful.
Jimikki Jhumka: She wears a pair of Kerala jimikki jhumkas, round gold studs above wide bell domes with fine engraving and a ring of tiny gold drops, classic and Malayali.
Nakshi Jhumka: She wears a pair of nakshi jhumkas, gold bells with raised, hand-hammered nakshi relief work of deities and florals, rich and handcrafted.
Sun Motif Jhumka: She wears a pair of sun motif jhumkas, radiant sunburst studs set with a center stone above bright gold bell domes, warm and auspicious.
Crescent Moon Jhumka: She wears a pair of crescent moon jhumkas, small crescent-shaped studs with tiny bell domes hanging below, dainty and celestial.
Cluster Bud Jhumka: She wears a pair of cluster bud jhumkas, three tiny jhumka bells clustered together beneath each stud like flower buds, playful and delicate.
Vintage Brass Jhumka: She wears a pair of vintage brass jhumkas, warm golden brass bells with a worn, aged finish and engraved patterns, bohemian and retro.

BODY JEWELRY

Belly Button Ring: She wears a belly button ring, a small curved barbell through her navel with a single sparkling gem resting at the top, dainty and sensual.
Dangle Belly Ring: She wears a dangle belly ring, a curved barbell through her navel with a short chain of tiny crystals dropping below it, catching the light as she moves.
Butterfly Belly Ring: She wears a butterfly belly ring, a small jeweled butterfly perched just above her navel on a curved barbell, playful and Y2K-inspired.
Back Drape Chain: She wears a back drape chain, a fine necklace whose long strand falls down the center of her bare back between her shoulder blades, ending in a small pendant, elegant and backless-dress-ready.
Layered Back Chain: She wears a layered back chain, three fine chains swagged in graduated loops across her bare upper back from shoulder to shoulder, glamorous and dramatic.
Shoulder Chain: She wears a shoulder chain, fine strands that drape over the tops of her shoulders like epaulettes and hang in shimmering loops onto her upper arms.
Shoulder Fringe Chain: She wears a shoulder fringe chain, a collar piece with rows of fine chain fringe falling over her shoulders and upper arms, swaying with every move, festival-ready.
Bra Chain: She wears a bra chain, fine strands that wrap across her bralette and around her ribcage, framing her chest in delicate lines of metal.
Crossover Chest Chain: She wears a crossover chest chain, two fine chains that run from her neck diagonally across her chest and meet at a small ring at the center, bold and sculptural.
Body Harness: She wears a body harness, a chain halter at her neck joined by vertical strands to a chain under her bust and another at her waist, framing her torso like a delicate cage.
Crystal Body Harness: She wears a crystal body harness, rows of small rhinestones linked into a halter that drapes over her chest and around her waist, glittering like a second skin.
Pearl Body Harness: She wears a pearl body harness, strands of small pearls that loop from her neck across her chest and around her ribs, soft, romantic, and bridal.
Body Drape Necklace: She wears a body drape necklace, a choker from which long fine strands fall down her chest and stomach to her waist like a shimmering curtain.
Halter Body Chain: She wears a halter body chain, fine strands that tie behind her neck and fall in a deep V over her chest, joined at a waist chain, sleek and daring.
Sternum Chain: She wears a sternum chain, a single fine strand that runs down the center of her chest from a choker to a waist chain, minimal and striking.
Underbust Chain: She wears an underbust chain, a fine chain that wraps snugly around her ribcage just under her bust with a small drop charm at the center, subtle and alluring.
Rib Cage Chain: She wears a rib cage chain, several fine parallel strands that wrap around her ribs in close rows, like delicate metallic stripes.
Thigh Chain: She wears a thigh chain, a fine strand that wraps around her upper thigh with a short drop that connects up to her waist chain, bold and sexy.
Garter Thigh Chain: She wears a garter thigh chain, a band of fine chains and small crystals wrapped around her upper thigh with dangling drops, glamorous and flirty.
Leg Harness Chain: She wears a leg harness chain, a waist chain linked by a vertical strand to a chain wrapped around her upper thigh, framing her hip and leg.
Hip Drape Chain: She wears a hip drape chain, several fine strands that swag in loose loops across one hip and fall toward her thigh, asymmetric and dramatic.
Collarbone Chain: She wears a collarbone chain, a fine strand that traces the line of her collarbones from shoulder to shoulder with a tiny gem at each end, delicate and refined.
Shoulder To Arm Chain: She wears a shoulder to arm chain, a fine strand that falls from her neck over one shoulder and wraps around her upper arm, asymmetric and elegant.
Arm Drape Chain: She wears an arm drape chain, fine chains that swag from her upper arm to her wrist in soft loops, like jeweled sleeves.
Bicep Chain: She wears a bicep chain, a band of several fine chains wrapped around her upper arm with small drops hanging below, edgy and modern.
Backless Y Chain: She wears a backless Y chain, two fine strands from her shoulders that meet at the center of her back and drop down her spine to her waist.
Spine Chain: She wears a spine chain, a long strand set with small crystals at intervals running straight down the line of her spine, sleek and eye-catching.
Lower Back Chain: She wears a lower back chain, fine strands that swag across the small of her back between her hips, catching the light just above the waistline.
Belly Cage Chain: She wears a belly cage chain, a lattice of fine chains that crisscross over her stomach between an underbust chain and a waist chain, dramatic and sculptural.
Navel Drop Chain: She wears a navel drop chain, a belly ring with fine chains that sweep from it to a slim chain around her waist, fluid and sensual.
Coin Body Chain: She wears a coin body chain, chains hung with small stamped coins that drape over her chest and hips, clinking softly as she moves, bohemian and belly-dance-inspired.
Seashell Body Chain: She wears a seashell body chain, fine chains strung with small cowrie shells that drape over her bikini top and around her hips, beachy and tropical.
Bead Body Strand: She wears a bead body strand, strands of colorful glass seed beads that crisscross her torso and tie at her waist, handmade and festival-ready.
Turquoise Body Chain: She wears a turquoise body chain, fine chains dotted with small turquoise stones that drape over her chest and hips, boho and desert-inspired.
Butterfly Body Chain: She wears a butterfly body chain, fine chains with small butterfly charms that drape over her chest and waist, as if butterflies were resting on her skin.
Star Body Chain: She wears a star body chain, fine chains with tiny stars and crescent moons that drape over her chest and stomach, celestial and whimsical.
Heart Body Chain: She wears a heart body chain, fine chains with tiny heart charms framing her torso, sweet and flirty.
Snake Body Chain: She wears a snake body chain, a coiled serpent piece that winds from her neck around her torso to her waist, ending in a jeweled head, dramatic and mythic.
Chainmail Top: She wears a chainmail top, a draped mesh of fine linked metal rings that falls over her chest like liquid metal, edgy and runway-ready.
Crystal Chest Piece: She wears a crystal chest piece, a wide collar of small rhinestones that spreads over her chest in a fan of dripping strands, glamorous and stage-ready.
Pearl Back Drape: She wears a pearl back drape, strands of small pearls that swag across her bare back in graduated loops, romantic and bridal.
Bridal Body Jewelry: She wears bridal body jewelry, a gold and kundan piece with a jeweled choker linked to strands that drape over her chest and join a kamarbandh at her waist, regal and traditional.
Ghungroo Body Chain: She wears a ghungroo body chain, fine chains with tiny bells that drape across her hips and chest, chiming softly with every move, dance-inspired.
Ankle To Toe Chain: She wears an ankle to toe chain, a fine anklet joined by a chain over the top of her foot to a ring on her second toe, delicate and barefoot-beachy.
Barefoot Sandal Chain: She wears a barefoot sandal chain, a beaded anklet linked by a lace-like strand over the top of her foot to a toe loop, bohemian and bridal.
Ear To Neck Chain: She wears an ear to neck chain, a fine strand that sweeps from her earring down along her neck to her choker, edgy and unexpected.
Face Chain: She wears a face chain, fine strands that drape from her temples across her cheeks under her eyes, studded with tiny crystals, avant-garde and editorial.
Headpiece Body Chain: She wears a headpiece body chain, a fine chain crown linked by strands that fall behind her ears to drape over her shoulders, ethereal and goddess-like.
Collar Cape Chain: She wears a collar cape chain, a wide collar with rows of fine chain that fall over her shoulders and upper back like a shimmering capelet.
Wing Back Chain: She wears a wing back chain, fine chains shaped into the outline of wings across her shoulder blades, dreamy and fantasy-inspired.

NOSE RINGS

Diamond Nose Stud: She wears a diamond nose stud, a single tiny brilliant-cut diamond set flush on the side of her nostril, catching a pinpoint of light, minimal and elegant.
Flower Nose Stud: She wears a flower nose stud, a tiny gold flower with petal-set stones and a center gem resting on the side of her nostril, dainty and feminine.
Laung: She wears a laung, a tiny clove-shaped gold nose pin with a small stone at its head set on the side of her nostril, simple, traditional, and Punjabi.
Plain Nose Hoop: She wears a plain nose hoop, a thin, smooth metal ring that hugs the edge of her nostril, clean and effortless.
Twisted Nose Hoop: She wears a twisted nose hoop, a slim ring of twisted metal wire that hugs the edge of her nostril, catching the light along its spiral.
Beaded Nose Hoop: She wears a beaded nose hoop, a thin ring lined with tiny metal beads that hugs the edge of her nostril, textured and boho.
Septum Ring: She wears a septum ring, a slim horseshoe ring through the center of her nose with small ball ends resting just above her upper lip, edgy and cool.
Crystal Septum Clicker: She wears a crystal septum clicker, a hinged ring through the center of her nose lined with a row of tiny sparkling crystals, glamorous and edgy.
Septum Pincher: She wears a septum pincher, a crescent-shaped tapered piece through the center of her nose with its pointed ends curving outward, bold and tribal.
Beaded Septum Ring: She wears a beaded septum ring, a ring through the center of her nose set with a row of tiny pearls, soft and pretty.
Bridal Nath: She wears a bridal nath, a large gold nose ring on her nostril set with kundan stones and pearls, its fine chain sweeping across her cheek and hooking into her hair behind the ear, regal and bridal.
Maharashtrian Nath: She wears a Maharashtrian nath, a cashew-shaped nose ring covered in small pearls with a pink and white stone at the center, sitting over her nostril, graceful and Marathi.
Tehri Nath: She wears a Tehri nath, a very large, wide gold nose ring from Garhwal with ornate enamel and stone work, its heavy chain looping to her ear, grand and Pahadi.
Kundan Nath: She wears a kundan nath, a medium gold nose ring set with glass gems in gold foil and edged with pearl drops, hanging from her nostril with a chain to her ear, festive and regal.
Polki Nath: She wears a polki nath, a gold nose ring set with uncut diamonds and finished with emerald and pearl beads, with a fine chain to her ear, opulent and heirloom.
Pearl Nath: She wears a pearl nath, a delicate gold hoop strung with small white pearls and a single red bead at the center, hanging from her nostril, soft and classic.
Bulaq: She wears a bulaq, a small ornate pendant hanging from the center of her nose and resting just above her upper lip, set with tiny stones and pearls, traditional and striking.
Nolok: She wears a nolok, a tiny stone-studded drop hanging from the center of her nose over her lip in the Bengali bridal style, delicate and traditional.
Mini Nathni: She wears a mini nathni, a small gold nose ring on her nostril with a single tiny dangling drop, light, pretty, and everyday.
Paisley Nath: She wears a paisley nath, a gold nose ring shaped like a curved paisley set with small stones and edged with seed pearls, hanging from her nostril, ornate and festive.
Double Mookuthi: She wears a double mookuthi, two matching gold nose studs set with small red stones, one on each nostril, traditional and South Indian.
Kemp Mookuthi: She wears a kemp mookuthi, a cluster nose stud with red and green kemp stones set in gold on the side of her nostril, classic and Tamil.
Oxidised Nose Ring: She wears an oxidised nose ring, a darkened silver hoop with an etched tribal pattern and tiny dangling beads, earthy and boho.
Banjara Nose Ring: She wears a Banjara nose ring, a large silver ring hung with tiny coins and colored beads, resting against her cheek, bold and nomadic.
Drop Nose Pin: She wears a drop nose pin, a small stone stud on the side of her nostril with a single tiny gem dangling just below it, sweet and delicate.
Ruby Nose Stud: She wears a ruby nose stud, a single small deep red ruby set on the side of her nostril, rich and romantic.
Emerald Nose Stud: She wears an emerald nose stud, a single small green emerald set on the side of her nostril, lush and regal.
Opal Nose Stud: She wears an opal nose stud, a tiny iridescent opal set on the side of her nostril, flashing soft rainbow colors, dreamy and ethereal.
Star Nose Stud: She wears a star nose stud, a tiny star-shaped stud on the side of her nostril, playful and celestial.
Heart Nose Stud: She wears a heart nose stud, a tiny heart-shaped stud on the side of her nostril, cute and flirty.
Moon Nose Stud: She wears a moon nose stud, a tiny crescent moon on the side of her nostril, dainty and mystical.
Butterfly Nose Stud: She wears a butterfly nose stud, a tiny jeweled butterfly on the side of her nostril, whimsical and Y2K-inspired.
Pearl Nose Stud: She wears a pearl nose stud, a single tiny round pearl on the side of her nostril, soft and classic.
Double Nose Hoops: She wears double nose hoops, two thin rings side by side on the same nostril, edgy and stylish.
Hoop And Stud Combo: She wears a hoop and stud combo, a thin ring on the edge of her nostril with a tiny gem stud just above it, modern and layered.
High Nostril Stud: She wears a high nostril stud, a tiny gem set high on the curve of her nostril near the bridge of her nose, subtle and unexpected.
Bridge Piercing: She wears a bridge piercing, a small horizontal barbell across the bridge of her nose between her eyes, with a tiny ball at each end, bold and alternative.
Nose To Ear Chain: She wears a nose to ear chain, a small stud on her nostril linked by a fine chain across her cheek to her earring, modern and daring.
Nose Cuff: She wears a nose cuff, a slim clip-on ring that hugs the edge of her nostril without a piercing, easy and playful.
Pave Nose Hoop: She wears a pave nose hoop, a thin ring set all around with tiny sparkling stones that hugs the edge of her nostril, glamorous.
Seamless Nose Ring: She wears a seamless nose ring, an ultra-thin ring with no visible join that circles the edge of her nostril, sleek and minimal.
Captive Bead Ring: She wears a captive bead ring on her nostril, a slim hoop holding a single small round bead at the front, classic and playful.
Charm Nose Hoop: She wears a charm nose hoop, a thin ring on her nostril with a tiny dangling charm, cute and personal.
Kundan Nose Pin: She wears a kundan nose pin, a small cluster of glass gems set in gold foil on the side of her nostril, festive and traditional.
Meenakari Nath: She wears a meenakari nath, a gold nose ring painted with bright red and green enamel florals and finished with pearl drops, colorful and Rajasthani.
Ghungroo Nath: She wears a ghungroo nath, a gold nose ring hung with tiny bells that chime faintly as she moves, playful and dance-inspired.
Peacock Nath: She wears a peacock nath, a gold nose ring shaped like a peacock with a fanned enamel tail in blue and green, hanging from her nostril, vibrant and folk-inspired.
Floral Nath: She wears a floral nath, a gold nose ring decorated with a cluster of tiny stone-set flowers and pearls, hanging from her nostril, romantic and bridal.
Crescent Nath: She wears a crescent nath, a crescent moon-shaped gold nose ring set with small stones and edged with tiny pearls, hanging from her nostril, graceful and celestial.
Petite Diamond Nath: She wears a petite diamond nath, a small, delicate hoop set with tiny diamonds and a single pearl drop on her nostril, modern bridal and understated.
Gemstone Nose Hoop: She wears a gemstone nose hoop, a thin ring on the edge of her nostril set with a single small colored gemstone at the front, bright and charming.
""")

# Input name for each category's slot.
SLOTS = {"Waist Chains": "waist_chain", "Necklaces": "necklace", "Bracelets": "bracelet", "Jhumkas": "jhumka", "Body Jewelry": "body_jewelry", "Nose Rings": "nose_ring"}
NONE, RANDOM = "none", "random"
METALS = ["gold", "silver", "rose gold"]
METAL_OPTIONS = ["as written", *METALS, RANDOM]


class MBAccessoriesSelector(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesAccessoriesSelector",
            display_name="Accessories Selector (MB)",
            category="MBNodes",
            description="Output an accessory description from a chosen or random category and style.",
            search_aliases=["accessories", "jewelry", "waist chain", "belly chain", "body chain", "necklace", "bracelet", "bangle", "jhumka", "earrings", "nose ring", "nath", "random prompt"],
            inputs=[
                *(
                    io.Combo.Input(SLOTS[name], options=[NONE, RANDOM, *items], default=NONE,
                                   tooltip=f"{name} style, a seeded-random one, or none.")
                    for name, items in ACCESSORIES.items()
                ),
                io.Combo.Input("metal", options=METAL_OPTIONS, default="as written", tooltip="Add one metal finish for every accessory, or keep them as written."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
                io.Boolean.Input("remove_prefix", default=False, tooltip="Drop the leading \"She wears\" from every piece, e.g. \"A simple waist chain...\"."),
            ],
            outputs=[
                io.String.Output("prompt"),
                *(io.String.Output(slot, tooltip=f"The {name.lower()} text on its own. Empty when none.") for name, slot in SLOTS.items()),
                io.String.Output("styles", tooltip="The picked styles, e.g. \"Waist Chains: Heart Chain / Necklaces: Pearl Necklace\"."),
            ],
        )

    @classmethod
    def execute(cls, metal, seed, weight, remove_prefix=False, **picks) -> io.NodeOutput:
        rng = random.Random(seed)
        texts, styles = [], []
        for name, items in ACCESSORIES.items():
            style = picks[SLOTS[name]]
            if style == RANDOM:
                style = rng.choice(list(items))
            text = items.get(style, "")
            if remove_prefix and text:
                text = text.removeprefix("She wears ")
                text = text[0].upper() + text[1:]
            texts.append(text)
            if style != NONE:
                styles.append(f"{name}: {style}")

        prompt = " ".join(t for t in texts if t)
        if prompt and metal != "as written":
            prompt += f" The metalwork is polished {rng.choice(METALS) if metal == RANDOM else metal}."
        return io.NodeOutput(
            weighted(prompt, weight),
            *(weighted(t, weight) for t in texts),
            " / ".join(styles),
        )


NODES = [MBAccessoriesSelector]
