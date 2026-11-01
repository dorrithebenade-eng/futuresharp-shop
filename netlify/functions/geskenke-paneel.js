// netlify/functions/geskenke-paneel.js
//
// Personeel. Die geskenke op die paneel. Sien _geskenke.js.
//
// GET                                   -> { geskenke: [...] } nuutste eerste
// POST { aksie: "herstuur", kode, epos? } -> stuur die geskenkbewys weer
//                                          (aan die koper, of aan epos)

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { lees_geskenk, stuur_geskenkbewys } = require("./_geskenke");

const JSON_KOP = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const antwoord = (status, data) => ({ statusCode: status, headers: JSON_KOP, body: JSON.stringify(data) });

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) return antwoord(403, { fout: "Geen toegang nie, personeel-rol vereis" });

  try {
    if (event.httpMethod === "GET") {
      const store = kry_store("geskenke");
      const { blobs } = await store.list();
      const geskenke = (
        await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }).catch(() => null)))
      ).filter(Boolean);
      geskenke.sort((a, b) => String(b.geskep_op || "").localeCompare(String(a.geskep_op || "")));
      return antwoord(200, { geskenke });
    }

    if (event.httpMethod !== "POST") return antwoord(405, { fout: "Metode nie toegelaat nie" });
    const invoer = JSON.parse(event.body || "{}");
    if (invoer.aksie !== "herstuur") return antwoord(400, { fout: "Onbekende aksie" });

    const rekord = await lees_geskenk(invoer.kode);
    if (!rekord) return antwoord(404, { fout: "Geen geskenk met daardie kode nie" });
    const epos = String(invoer.epos || "").trim();
    if (epos && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(epos)) return antwoord(400, { fout: "Ongeldige e-posadres" });

    const uitslag = await stuur_geskenkbewys(rekord, epos || undefined);
    if (!uitslag.ok) return antwoord(502, { fout: "Kon nie die e-pos stuur nie" });
    return antwoord(200, { ok: true });
  } catch (fout) {
    console.error("geskenke-paneel fout:", fout);
    return antwoord(500, { fout: "Kon nie die geskenke hanteer nie" });
  }
};
