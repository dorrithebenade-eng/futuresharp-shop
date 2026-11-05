// netlify/functions/stoor-boekmerk.js
//
// Koper-beskermd (ook personeel). Voeg 'n boekmerk by, verwyder een, of
// stel sy nota (November 2026). Net vir 'n boek wat die leser mag lees
// (_lees-toegang.js): 'n mens kan nie boekmerke hou vir 'n boek waartoe
// jy geen toegang het nie.
//
// Invoer (JSON):
//   { produk_slug, aksie: "voeg_by", bladsy, weergawe?, totaal_bladsye?, nota? }
//   { produk_slug, aksie: "verwyder", id }
//   { produk_slug, aksie: "nota", id, nota }
// Antwoord: { merke } — die volledige, bygewerkte lys.
//
// Een boekmerk per bladsy: "voeg_by" op 'n bladsy wat reeds gemerk is, gee
// die bestaande lys terug sonder om 'n tweede by te voeg.

const crypto = require("crypto");
const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { mag_lees } = require("./_lees-toegang");

const MAKS_MERKE = 300;
const MAKS_NOTA = 80;

function skoon_nota(nota) {
  return String(nota || "").replace(/\s+/g, " ").trim().slice(0, MAKS_NOTA);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ fout: "Metode nie toegelaat nie" }) };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["koper", "personeel"]);
  if (!gebruiker) {
    return { statusCode: 401, body: JSON.stringify({ fout: "Meld eers aan" }) };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ fout: "Ongeldige JSON" }) };
  }

  const { produk_slug, aksie } = invoer || {};
  if (!produk_slug || !["voeg_by", "verwyder", "nota"].includes(aksie)) {
    return { statusCode: 400, body: JSON.stringify({ fout: "Verpligte velde: produk_slug, aksie" }) };
  }

  try {
    if (!(await mag_lees(gebruiker, produk_slug))) {
      return { statusCode: 403, body: JSON.stringify({ fout: "Geen toegang tot hierdie e-boek nie" }) };
    }

    const store = kry_store("boekmerke");
    const sleutel = `${produk_slug}--${gebruiker.id}`;
    const rekord = (await store.get(sleutel, { type: "json" })) || {};
    let merke = Array.isArray(rekord.merke) ? rekord.merke : [];

    if (aksie === "voeg_by") {
      const bladsy = Number(invoer.bladsy);
      if (!Number.isInteger(bladsy) || bladsy < 1) {
        return { statusCode: 400, body: JSON.stringify({ fout: "Bladsy moet 'n positiewe heelgetal wees" }) };
      }
      const weergawe = typeof invoer.weergawe === "string" && invoer.weergawe.length <= 200 ? invoer.weergawe : null;
      const totaal = Number(invoer.totaal_bladsye);
      const totaal_bladsye = Number.isInteger(totaal) && totaal >= 1 ? totaal : null;

      const bestaan = merke.some((m) => m.bladsy === bladsy && (m.weergawe || null) === weergawe);
      if (!bestaan) {
        if (merke.length >= MAKS_MERKE) {
          return { statusCode: 400, body: JSON.stringify({ fout: `Hoogstens ${MAKS_MERKE} boekmerke per boek` }) };
        }
        merke.push({
          id: crypto.randomBytes(6).toString("hex"),
          bladsy,
          weergawe,
          totaal_bladsye,
          nota: skoon_nota(invoer.nota),
          geskep_op: new Date().toISOString(),
        });
      }
    } else {
      const id = String(invoer.id || "");
      if (!merke.some((m) => m.id === id)) {
        return { statusCode: 404, body: JSON.stringify({ fout: "Boekmerk nie gevind nie" }) };
      }
      if (aksie === "verwyder") {
        merke = merke.filter((m) => m.id !== id);
      } else {
        merke = merke.map((m) => (m.id === id ? { ...m, nota: skoon_nota(invoer.nota) } : m));
      }
    }

    merke.sort((a, b) => a.bladsy - b.bladsy);
    await store.setJSON(sleutel, { merke, bygewerk_op: new Date().toISOString() });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ merke }),
    };
  } catch (fout) {
    console.error("stoor-boekmerk fout:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie boekmerk stoor nie" }) };
  }
};
