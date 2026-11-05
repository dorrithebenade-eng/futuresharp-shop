// netlify/functions/kry-admin-leeskamer.js
//
// Personeel-beskermd (November 2026). Die paneelbord se My Leeskamer: elke
// e-boek in die katalogus wat 'n PDF het, ook een wat nie op die rak is
// nie, met die admin se eie leesplek.
//
// "Op die rak" beteken: die produk is aktief, die e-boekformaat is
// beskikbaar en die vrystellingsdatum (indien enige) is bereik. Die stand
// word hier bepaal sodat die paneel net hoef te wys, nie te reken nie.
//
// Lees die boek self gaan deur die gewone leser: kry-leser-token.js en
// kry-eboek-inhoud.js laat die personeel-rol reeds deur (_eie-toegang.js).
// Hierdie Function gee geen toegang nie; dit lys net.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ fout: "Metode nie toegelaat nie" }) };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: JSON.stringify({ fout: "Geen toegang nie: personeel-rol vereis" }) };
  }

  try {
    const katalogus = kry_store("katalogus");
    const vordering_store = kry_store("lees-vordering");
    const { blobs } = await katalogus.list();
    const produkte = await Promise.all(
      (blobs || []).map((b) => katalogus.get(b.key, { type: "json" }).catch(() => null))
    );

    // Suid-Afrikaanse datum (UTC+2), soos kry-my-boeke.js.
    const vandag = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const boeke = await Promise.all(
      produkte
        .filter((p) => p && p.slug && p.formate && p.formate.eboek && p.formate.eboek.eboek_sleutel)
        .map(async (p) => {
          const eboek = p.formate.eboek;
          const vrystelling = eboek.vrystelling_datum || null;
          const aktief = p.aktief !== false;
          const beskikbaar = eboek.beskikbaar !== false;

          let stand = "op_rak";
          if (!aktief || !beskikbaar) stand = "nie_op_rak";
          else if (vrystelling && vrystelling > vandag) stand = "vrystelling";

          let vordering = null;
          try {
            const r = await vordering_store.get(`${p.slug}--${gebruiker.id}`, { type: "json" });
            if (r && r.bladsy > 1) vordering = { bladsy: r.bladsy, totaal: r.totaal_bladsye || null };
          } catch { /* geen vordering nie */ }

          return {
            slug: p.slug,
            titel: p.titel || p.slug,
            outeur: p.outeur || "",
            omslag: p.omslag || "",
            stand, // "op_rak" | "nie_op_rak" | "vrystelling"
            vrystelling_datum: vrystelling,
            lees_bladsy: vordering ? vordering.bladsy : null,
            lees_totaal: vordering ? vordering.totaal : null,
          };
        })
    );

    boeke.sort((a, b) => String(a.titel).localeCompare(String(b.titel), "af"));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ boeke }),
    };
  } catch (fout) {
    console.error("kry-admin-leeskamer fout:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie die boeke laai nie" }) };
  }
};
