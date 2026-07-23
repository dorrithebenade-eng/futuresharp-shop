// Personeel-beskermd — wysig velde van 'n bestaande produk, of deaktiveer
// dit (aktief = false laat dit uit die katalogus verdwyn sonder om die
// rekord te verwyder — bestellingsgeskiedenis bly intak).

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

// Selfde validasie as skep-produk.js — hou dit in lyn sodat 'n wysiging
// nie 'n ongeldige verdeling kan invoer wat skep-produk sou verwerp nie.
function kry_geldige_verdeling(verdeling) {
  if (!verdeling || !verdeling.subrekening_kode) return null;
  if (!["persentasie", "vaste_bedrag"].includes(verdeling.tipe)) return null;
  const waarde = Number(verdeling.waarde);
  if (!Number.isFinite(waarde) || waarde <= 0) return null;
  if (verdeling.tipe === "persentasie" && waarde > 100) return null;

  return {
    subrekening_kode: verdeling.subrekening_kode,
    tipe: verdeling.tipe,
    waarde,
  };
}

function kry_geldige_datum(waarde) {
  if (!waarde) return null;
  const datum = new Date(waarde);
  if (Number.isNaN(datum.getTime())) return null;
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

  const { slug, wysigings } = invoer;
  if (!slug || !wysigings) {
    return { statusCode: 400, body: "Verpligte velde: slug, wysigings" };
  }

  const store = kry_store("katalogus");
  const bestaande = await store.get(slug, { type: "json" });
  if (!bestaande) {
    return { statusCode: 404, body: `Geen produk met slug "${slug}" nie` };
  }

  // Vlak-samesmelting — laat gedeeltelike wysigings toe (bv. net prys)
  let nuwe_formate = bestaande.formate;
  if (wysigings.formate) {
    nuwe_formate = { ...bestaande.formate, ...wysigings.formate };
    for (const formaat_naam of ["eboek", "harde_kopie"]) {
      if (wysigings.formate[formaat_naam]) {
        nuwe_formate[formaat_naam] = {
          ...wysigings.formate[formaat_naam],
          verdeling: kry_geldige_verdeling(wysigings.formate[formaat_naam].verdeling),
          vrystelling_datum: kry_geldige_datum(wysigings.formate[formaat_naam].vrystelling_datum),
        };
      }
    }
  }

  const bygewerk = {
    ...bestaande,
    ...wysigings,
    formate: nuwe_formate,
    bygewerk_op: new Date().toISOString(),
    bygewerk_deur: gebruiker.email,
  };

  await store.setJSON(slug, bygewerk);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bygewerk),
  };
};
