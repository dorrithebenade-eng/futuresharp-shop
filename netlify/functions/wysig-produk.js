// Personeel-beskermd — wysig velde van 'n bestaande produk, of deaktiveer
// dit (aktief = false laat dit uit die katalogus verdwyn sonder om die
// rekord te verwyder — bestellingsgeskiedenis bly intak).
//
// VERDELING-ARGITEKTUUR (uitgebrei) — sien skep-produk.js vir volledige
// opmerkings. Elke verdeling-ry: { rol_tipe, entiteit_id, tipe, waarde }.
// Hosting is 'n aparte dokumentasie-veld ({ tipe, waarde }, geen
// entiteit_id nie) — die bedrag bly by die hoofrekening.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_maks_verdeling_persentasie, beskryf_minimum } = require("./_paystack-koste.js");
const { kontroleer_leen_prys } = require("./_leen-prys-kontrole");

const GELDIGE_ROL_TIPES = ["outeur", "vennoot", "ontwerp_admin", "printing", "aflewering"];

// Selfde helper as skep-produk.js — sien dié lêer vir volledige opmerking.
async function kry_outeur_naam_string(outeur_ids) {
  if (!Array.isArray(outeur_ids) || !outeur_ids.length) return "";

  const store = kry_store("outeurs");
  const outeure = await Promise.all(outeur_ids.map((id) => store.get(id, { type: "json" })));
  const name_lys = outeure.filter(Boolean).map((o) => o.naam);

  if (!name_lys.length) return "";
  if (name_lys.length === 1) return name_lys[0];
  if (name_lys.length === 2) return `${name_lys[0]} en ${name_lys[1]}`;
  return `${name_lys.slice(0, -1).join(", ")} en ${name_lys[name_lys.length - 1]}`;
}

// Selfde validasie as skep-produk.js — hou dit in lyn sodat 'n wysiging
// nie 'n ongeldige verdeling kan invoer wat skep-produk sou verwerp nie.
function kry_geldige_verdelings(verdelings) {
  if (!Array.isArray(verdelings)) return [];

  return verdelings
    .map((v) => {
      if (!v || !v.entiteit_id) return null;
      if (!GELDIGE_ROL_TIPES.includes(v.rol_tipe)) return null;
      if (!["persentasie", "vaste_bedrag"].includes(v.tipe)) return null;
      const waarde = Number(v.waarde);
      if (!Number.isFinite(waarde) || waarde <= 0) return null;
      if (v.tipe === "persentasie" && waarde > 100) return null;

      return { rol_tipe: v.rol_tipe, entiteit_id: v.entiteit_id, tipe: v.tipe, waarde };
    })
    .filter(Boolean);
}

function kry_geldige_hosting(hosting) {
  if (!hosting) return null;
  if (!["persentasie", "vaste_bedrag"].includes(hosting.tipe)) return null;
  const waarde = Number(hosting.waarde);
  if (!Number.isFinite(waarde) || waarde <= 0) return null;
  if (hosting.tipe === "persentasie" && waarde > 100) return null;
  return { tipe: hosting.tipe, waarde };
}

const GELDIGE_ETIKET_KLEURE = ["amber", "koraal", "teal", "swart"];

function kry_geldige_etiket(etiket) {
  if (!etiket) return null;
  const teks_af = String(etiket.teks_af || "").trim().slice(0, 30);
  const teks_en = String(etiket.teks_en || "").trim().slice(0, 30);
  if (!teks_af && !teks_en) return null;
  const kleur = GELDIGE_ETIKET_KLEURE.includes(etiket.kleur) ? etiket.kleur : "amber";
  return {
    teks_af: teks_af || teks_en,
    teks_en: teks_en || teks_af,
    kleur,
  };
}

function kry_geldige_datum(waarde) {
  if (!waarde) return null;
  const datum = new Date(waarde);
  if (Number.isNaN(datum.getTime())) return null;
  return waarde;
}

// Selfde validasie as skep-produk.js — sien dié lêer vir die volledige
// opmerking. BELANGRIK: hierdie handler gebruik `...wysigings`, dus sou 'n
// rou isbn-veld andersins ONGEVALIDEER deurgaan.
function kry_geldige_isbn(isbn) {
  if (!isbn) return null;
  const eboek = String(isbn.eboek || "").trim().slice(0, 20);
  const harde_kopie = String(isbn.harde_kopie || "").trim().slice(0, 20);
  if (!eboek && !harde_kopie) return null;
  return { eboek, harde_kopie };
}

// Selfde reël as skep-produk.js: Future Sharp se hoofrekening moet ALTYD
// ten minste 3% + Hosting% behou (dek Paystack se transaksiekoste plus
// die ooreengekome hosting-aandeel).
function oorskry_hoofrekening_minimum(verdelings, hosting, prys_sent) {
  if (!prys_sent) return false;

  const verdelings_persentasie = verdelings.reduce((som, v) => {
    const persentasie = v.tipe === "vaste_bedrag" ? (v.waarde / prys_sent) * 100 : v.waarde;
    return som + persentasie;
  }, 0);

  const hosting_persentasie = hosting
    ? hosting.tipe === "vaste_bedrag"
      ? (hosting.waarde / prys_sent) * 100
      : hosting.waarde
    : 0;

  return verdelings_persentasie + hosting_persentasie > kry_maks_verdeling_persentasie(prys_sent);
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
          verdelings: kry_geldige_verdelings(wysigings.formate[formaat_naam].verdelings),
          hosting: kry_geldige_hosting(wysigings.formate[formaat_naam].hosting),
          vrystelling_datum: kry_geldige_datum(wysigings.formate[formaat_naam].vrystelling_datum),
        };
      }
    }
    // "Leen" is soortgelyk, maar het 'n tydperk_dae i.p.v. 'n
    // vrystelling_datum, en vereis dat die e-boek se PDF reeds bestaan
    // (dieselfde onderliggende lêer word gebruik, geen aparte oplaai nie).
    if (wysigings.formate.leen) {
      const leen_wysiging = wysigings.formate.leen;
      if (leen_wysiging.beskikbaar && !(nuwe_formate.eboek && nuwe_formate.eboek.eboek_sleutel)) {
        return {
          statusCode: 400,
          body: "'n Leen-opsie vereis 'n opgelaaide e-boek-PDF (dieselfde lêer word gebruik) — laai eers die e-boek-PDF op.",
        };
      }
      nuwe_formate.leen = {
        beskikbaar: !!leen_wysiging.beskikbaar,
        prys_sent: leen_wysiging.prys_sent || 0,
        tydperk_dae: Number(leen_wysiging.tydperk_dae) > 0 ? Math.round(Number(leen_wysiging.tydperk_dae)) : 30,
        verdelings: kry_geldige_verdelings(leen_wysiging.verdelings),
        hosting: kry_geldige_hosting(leen_wysiging.hosting),
      };
    }
  }

  for (const [formaat_naam, etiket] of [
    ["eboek", "e-boek"],
    ["harde_kopie", "harde-kopie"],
    ["leen", "leen"],
  ]) {
    const f = nuwe_formate[formaat_naam];
    if (f && f.beskikbaar && oorskry_hoofrekening_minimum(f.verdelings || [], f.hosting, f.prys_sent || 0)) {
      return {
        statusCode: 400,
        body: `Die ${etiket} se verdeling(s) plus Hosting los te min oor vir Future Sharp se hoofrekening — Paystack se fooi (2,9% + R1 + BTW) moet gedek word. Verminder die persentasie/bedrae sodat ${beskryf_minimum(f.prys_sent || 0)} oorbly.`,
      };
    }
  }

  const leen_prys_kontrole = kontroleer_leen_prys(nuwe_formate);
  if (!leen_prys_kontrole.ok) {
    return { statusCode: 400, body: leen_prys_kontrole.fout };
  }

  const nuwe_outeur_ids = Array.isArray(wysigings.outeur_ids)
    ? wysigings.outeur_ids.filter(Boolean)
    : bestaande.outeur_ids;
  const nuwe_outeur_naam = Array.isArray(wysigings.outeur_ids)
    ? await kry_outeur_naam_string(nuwe_outeur_ids)
    : bestaande.outeur;

  const bygewerk = {
    ...bestaande,
    ...wysigings,
    outeur_ids: nuwe_outeur_ids,
    kategorie_ids: Array.isArray(wysigings.kategorie_ids)
      ? wysigings.kategorie_ids.filter(Boolean)
      : bestaande.kategorie_ids || [],
    outeur: nuwe_outeur_naam,
    formate: nuwe_formate,
    etiket: "etiket" in wysigings ? kry_geldige_etiket(wysigings.etiket) : bestaande.etiket,
    isbn: "isbn" in wysigings ? kry_geldige_isbn(wysigings.isbn) : bestaande.isbn || null,
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
