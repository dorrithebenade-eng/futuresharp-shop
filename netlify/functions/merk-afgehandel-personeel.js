// netlify/functions/merk-afgehandel-personeel.js
//
// STAP 2 VAN "BESTELLINGS AFHANDEL" (November 2026). Personeel merk 'n
// harde-kopie-bestelling as afgehandel, of maak dit weer oop.
//
// DIESELFDE REKORD AS DIE OUTEUR. merk-bestelling-gestuur.js skryf
// bestelling.versending wanneer 'n outeur pos. Hierdie funksie skryf DIESELFDE
// veld, sodat die outeurspaneel, My Boeke en die paneelbord een waarheid lees.
// Twee velde vir een feit sou beteken dat hulle uiteenloop.
//
//   wyse: "personeel"   onderskei hierdie merk van die outeur s'n
//   afgehaal: true      by afhaal; geen spoornommer nie
//   nota                vrye teks vir personeel, bv. "afgehaal by Talana Laan"
//   laas_gewysig_deur   "personeel:<e-pos>", nie 'n outeur_id nie
//
// GESKIEDENIS BLY BEHOUE, soos by die outeur: elke merk en elke heropening word
// by versending.geskiedenis gevoeg.
//
// WEER OOPMAAK is personeel se reg (besluit 22 Nov 2026). Die outeur se eie
// "Trek terug" word in 'n latere stap verwyder.
//
// DIE KOPER. By 'n koerierbestelling wat NUUT as gestuur gemerk word, kry die
// koper dieselfde pos as wanneer die outeur dit doen (_kennisgewing-versending.js).
// By afhaal gaan niks uit nie: die afhaal is reeds per e-pos gereël. Die pos
// gaan NA die skryf, en 'n mislukking maak die merk nooit ongedaan nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { stuur_versending_kennisgewing } = require("./_kennisgewing-versending");

// JJJJ-MM-DD, nie in die toekoms nie (een dag speling vir tydsones). Dieselfde
// reël as merk-bestelling-gestuur.js.
function geldige_datum(waarde) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(waarde || ""))) return null;
  const datum = new Date(`${waarde}T00:00:00Z`);
  if (Number.isNaN(datum.getTime())) return null;
  const more = new Date();
  more.setUTCDate(more.getUTCDate() + 1);
  if (datum > more) return null;
  return waarde;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const bestelnommer = String(invoer.bestelnommer || "").trim();
  if (!bestelnommer) {
    return { statusCode: 400, body: "Verpligte veld: bestelnommer" };
  }
  const afgehandel = invoer.afgehandel !== false;

  const store = kry_store("bestellings");
  const bestelling = await store.get(bestelnommer, { type: "json" });
  if (!bestelling) {
    return { statusCode: 404, body: "Geen bestelling met daardie nommer nie" };
  }
  if (!bestelling.bevat_harde_kopie) {
    return { statusCode: 400, body: "Hierdie bestelling bevat geen harde kopie nie" };
  }
  if (bestelling.status !== "Nuut") {
    return { statusCode: 400, body: "Net 'n betaalde bestelling kan afgehandel word" };
  }

  const afhaal = Boolean(bestelling.aflewering && bestelling.aflewering.metode === "afhaal");

  let datum = null;
  if (afgehandel) {
    datum = geldige_datum(invoer.datum);
    if (!datum) {
      return { statusCode: 400, body: "Ongeldige datum — verwag JJJJ-MM-DD, nie in die toekoms nie" };
    }
  }

  const nou = new Date().toISOString();
  const deur = `personeel:${String(gebruiker.email || "").trim().toLowerCase()}`;
  const spoornommer = afgehandel && !afhaal ? String(invoer.spoornommer || "").trim().slice(0, 100) : "";
  const nota = afgehandel ? String(invoer.nota || "").trim().slice(0, 300) : "";

  const vorige = bestelling.versending || {};

  const inskrywing = {
    op: nou,
    deur,
    gestuur: afgehandel,
    gestuur_op: datum,
    wyse: afgehandel ? "personeel" : null,
    afgehaal: afgehandel && afhaal,
    spoornommer,
    nota,
  };

  const bygewerk = {
    ...bestelling,
    versending: {
      gestuur: afgehandel,
      gestuur_op: datum,
      wyse: afgehandel ? "personeel" : null,
      verskaffer: "",
      verskaffer_verwysing: "",
      spoornommer,
      afgehaal: afgehandel && afhaal,
      nota,
      laas_gewysig_op: nou,
      laas_gewysig_deur: deur,
      geskiedenis: [...(vorige.geskiedenis || []), inskrywing],
    },
    bygewerk_op: nou,
  };

  await store.setJSON(bestelnommer, bygewerk);

  // NA DIE SKRYF. Slegs by 'n nuwe merk van 'n koerierbestelling.
  if (afgehandel && !afhaal && vorige.gestuur !== true) {
    try {
      await stuur_versending_kennisgewing(bygewerk);
    } catch (fout) {
      console.error(`Kon nie die versending-kennisgewing stuur nie vir ${bestelnommer}:`, fout);
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bygewerk),
  };
};
