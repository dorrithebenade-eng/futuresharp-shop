// Personeel-beskermd — wysig velde van 'n bestaande produk, of deaktiveer
// dit (aktief = false laat dit uit die katalogus verdwyn sonder om die
// rekord te verwyder — bestellingsgeskiedenis bly intak).

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

// Selfde validasie as skep-produk.js — hou dit in lyn sodat 'n wysiging
// nie 'n ongeldige verdeling kan invoer wat skep-produk sou verwerp nie.
function kry_geldige_verdelings(verdelings) {
  if (!Array.isArray(verdelings)) return [];

  return verdelings
    .map((v) => {
      if (!v || !v.outeur_id) return null;
      if (!["persentasie", "vaste_bedrag"].includes(v.tipe)) return null;
      const waarde = Number(v.waarde);
      if (!Number.isFinite(waarde) || waarde <= 0) return null;
      if (v.tipe === "persentasie" && waarde > 100) return null;

      return { outeur_id: v.outeur_id, tipe: v.tipe, waarde };
    })
    .filter(Boolean);
}

function kry_geldige_datum(waarde) {
  if (!waarde) return null;
  const datum = new Date(waarde);
  if (Number.isNaN(datum.getTime())) return null;
  return waarde;
}

// Selfde reël as skep-produk.js: Future Sharp se hoofrekening moet ALTYD
// ten minste 3% behou (dek Paystack se transaksiekoste, en Paystack self
// weier sonder dit uitdruklik).
function oorskry_hoofrekening_minimum(verdelings, prys_sent) {
  if (!verdelings.length || !prys_sent) return false;
  const totaal_persentasie = verdelings.reduce((som, v) => {
    const persentasie = v.tipe === "vaste_bedrag" ? (v.waarde / prys_sent) * 100 : v.waarde;
    return som + persentasie;
  }, 0);
  return totaal_persentasie > 97;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
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
          verdelings: kry_geldige_verdelings(wysigings.formate[formaat_naam].verdelings),
          vrystelling_datum: kry_geldige_datum(wysigings.formate[formaat_naam].vrystelling_datum),
        };
      }
    }
  }

  for (const [formaat_naam, etiket] of [
    ["eboek", "e-boek"],
    ["harde_kopie", "harde-kopie"],
  ]) {
    const f = nuwe_formate[formaat_naam];
    if (f && f.beskikbaar && oorskry_hoofrekening_minimum(f.verdelings || [], f.prys_sent || 0)) {
      return {
        statusCode: 400,
        body: `Die ${etiket} se verdeling(s) los minder as 3% oor vir Future Sharp se hoofrekening — verminder die persentasie/bedrag sodat ten minste 3% oorbly.`,
      };
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
