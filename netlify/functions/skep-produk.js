// Personeel-beskermd — skep 'n nuwe produk-rekord in die "katalogus"-store.
// Word deur die "Voeg produk by"-vorm op die interne paneelbord aangeroep.
//
// VERDELING-ARGITEKTUUR (uitgebrei): elke verdeling-inskrywing verwys nou
// na 'n rol_tipe (outeur / vennoot / ontwerp_admin / printing /
// aflewering) plus 'n entiteit_id (na die relevante register — outeurs,
// vennote, ontwerp-admin, printing, of aflewering). Hosting is NIE 'n
// verdeling-ry nie — dit's 'n aparte dokumentasie-veld op elke formaat;
// die bedrag/persentasie bly heeltemal by Future Sharp se hoofrekening,
// net apart aangeteken vir rekordhouding.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_maks_verdeling_persentasie, beskryf_minimum } = require("./_paystack-koste.js");

const GELDIGE_ROL_TIPES = ["outeur", "vennoot", "ontwerp_admin", "printing", "aflewering"];

// Skep 'n leesbare "Outeur A, Outeur B en Outeur C"-string vanuit 'n lys
// outeur_id's — gestoor as 'n aparte `outeur`-veld sodat bestaande
// vertoon-kode (katalogus-kaart, produk-bladsy) heeltemal ongeraak bly;
// `outeur_ids` bly die "bron van waarheid" vir toekomstige wysigings.
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

// Future Sharp se hoofrekening moet ALTYD genoeg behou om Paystack se
// transaksiekoste te dek, plus die ooreengekome hosting-aandeel. Die
// vereiste is NIE 'n plat 3% nie — Paystack hef 2,9% PLUS R1 (plus BTW),
// dus is die minimum by 'n lae prys heelwat hoër. Sien _paystack-koste.js.
// (Oorspronklike nota: ten minste 3% + Hosting% van 'n
// formaat se prys behou — dit dek Paystack se eie transaksiekoste plus
// die ooreengekome hosting-aandeel. Paystack self weier ook enige
// verdeling waar die handelaar se aandeel nul of minder is, so ons keer
// dit hier reeds af by stoor-tyd.
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

// Valideer 'n opsionele lys verdelings — gee 'n LEË lys terug (geen
// verdeling nie, alles gaan na Future Sharp se hoofrekening) as die invoer
// nie 'n lys is nie. Elke individuele verdeling wat nie korrek gevorm is
// nie (ontbrekende rol_tipe/entiteit_id, ongeldige tipe/waarde) word
// stilweg uitgesif — dit voorkom dat 'n misvormde vorm-invoer 'n
// halwe/ongeldige verdeling stoor wat later betaling-verwarring
// veroorsaak. Ons verwys na 'n entiteit_id (na die relevante register),
// nie na die rou ACCT_-subrekening-kode nie — dié word eers by
// betaal-tyd opgesoek, sodat 'n boek se verdeling-instelling outomaties
// bly werk selfs al verander 'n entiteit later hul subrekening-kode.
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

// Valideer die opsionele Hosting-dokumentasie-veld — geen entiteit_id nie,
// net 'n tipe + waarde. null as niks (of ongeldig) ingevoer is nie.
function kry_geldige_hosting(hosting) {
  if (!hosting) return null;
  if (!["persentasie", "vaste_bedrag"].includes(hosting.tipe)) return null;
  const waarde = Number(hosting.waarde);
  if (!Number.isFinite(waarde) || waarde <= 0) return null;
  if (hosting.tipe === "persentasie" && waarde > 100) return null;
  return { tipe: hosting.tipe, waarde };
}

// Valideer die opsionele boek-etiket (enkele ster op die katalogus-kaart,
// bv. "Nuut!" of "Topverkoper") — 'n vrye teks + een van 4 vaste kleure.
// null as niks (of ongeldige) teks ingevoer is nie.
const GELDIGE_ETIKET_KLEURE = ["amber", "koraal", "teal", "swart"];

function kry_geldige_etiket(etiket) {
  if (!etiket) return null;
  const teks_af = String(etiket.teks_af || "").trim().slice(0, 30);
  const teks_en = String(etiket.teks_en || "").trim().slice(0, 30);
  if (!teks_af && !teks_en) return null;
  const kleur = GELDIGE_ETIKET_KLEURE.includes(etiket.kleur) ? etiket.kleur : "amber";
  // As net een taal ingevul is, val die ander een op dieselfde teks terug —
  // beter as 'n leë sticker in daardie taal.
  return {
    teks_af: teks_af || teks_en,
    teks_en: teks_en || teks_af,
    kleur,
  };
}

// Valideer die opsionele ISBN's. Future Shop reik NIE ISBN's uit nie — dis
// die outeur se eie nommer, en ons wys dit net. 'n Gedrukte en 'n
// elektroniese uitgawe het elk sy eie nommer, dus twee velde. Ons stoor
// die nommer presies soos die outeur dit verskaf het (met of sonder
// koppeltekens), net met spasies aan die kante afgesny en tot 20 karakters
// beperk. Geen kontrolesyfer-toets nie — 'n verkeerde nommer moet nie 'n
// produk keer om te stoor nie. null as albei leeg is, sodat 'n boek sonder
// ISBN presies lyk soos voorheen.
function kry_geldige_isbn(isbn) {
  if (!isbn) return null;
  const eboek = String(isbn.eboek || "").trim().slice(0, 20);
  const harde_kopie = String(isbn.harde_kopie || "").trim().slice(0, 20);
  if (!eboek && !harde_kopie) return null;
  return { eboek, harde_kopie };
}

// Valideer 'n opsionele vrystellingsdatum vir voorbestellings — 'n geldige
// ISO-datumstring, of null (geen voorbestelling nie, produk is dadelik
// beskikbaar).
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

  // Basiese validering — verplig velde volgens die katalogus-skema
  const { slug, titel, outeur_ids, formate } = invoer;
  const geldige_outeur_ids = Array.isArray(outeur_ids) ? outeur_ids.filter(Boolean) : [];
  if (!slug || !titel || !geldige_outeur_ids.length || !formate || !formate.eboek) {
    return {
      statusCode: 400,
      body: "Verpligte velde ontbreek: slug, titel, ten minste een outeur, formate.eboek",
    };
  }

  const eboek_verdelings = kry_geldige_verdelings(formate.eboek.verdelings);
  const eboek_hosting = kry_geldige_hosting(formate.eboek.hosting);
  if (oorskry_hoofrekening_minimum(eboek_verdelings, eboek_hosting, formate.eboek.prys_sent || 0)) {
    return {
      statusCode: 400,
      body: "Die e-boek se verdeling(s) plus Hosting los te min oor vir Future Sharp se hoofrekening — Paystack se fooi (2,9% + R1 + BTW) moet gedek word. Verminder die persentasie/bedrae sodat " + beskryf_minimum(formate.eboek.prys_sent || 0) + " oorbly.",
    };
  }
  const hardekopie_verdelings = kry_geldige_verdelings(formate.harde_kopie && formate.harde_kopie.verdelings);
  const hardekopie_hosting = kry_geldige_hosting(formate.harde_kopie && formate.harde_kopie.hosting);
  if (
    formate.harde_kopie &&
    formate.harde_kopie.beskikbaar &&
    oorskry_hoofrekening_minimum(hardekopie_verdelings, hardekopie_hosting, formate.harde_kopie.prys_sent || 0)
  ) {
    return {
      statusCode: 400,
      body: "Die harde-kopie se verdeling(s) plus Hosting los te min oor vir Future Sharp se hoofrekening — Paystack se fooi (2,9% + R1 + BTW) moet gedek word. Verminder die persentasie/bedrae sodat " + beskryf_minimum(formate.harde_kopie.prys_sent || 0) + " oorbly.",
    };
  }

  // "Leen" gebruik DIESELFDE onderliggende PDF as die e-boek (geen aparte
  // oplaai nie) — dit kan dus net aangeskakel word as die e-boek self 'n
  // opgelaaide PDF het.
  const leen_verdelings = kry_geldige_verdelings(formate.leen && formate.leen.verdelings);
  const leen_hosting = kry_geldige_hosting(formate.leen && formate.leen.hosting);
  if (formate.leen && formate.leen.beskikbaar) {
    if (!formate.eboek.eboek_sleutel && !invoer.eboek_sleutel) {
      return {
        statusCode: 400,
        body: "'n Leen-opsie vereis 'n opgelaaide e-boek-PDF (dieselfde lêer word gebruik) — laai eers die e-boek-PDF op.",
      };
    }
    if (oorskry_hoofrekening_minimum(leen_verdelings, leen_hosting, formate.leen.prys_sent || 0)) {
      return {
        statusCode: 400,
        body: "Die leen-verdeling(s) plus Hosting los te min oor vir Future Sharp se hoofrekening — Paystack se fooi (2,9% + R1 + BTW) moet gedek word. Verminder die persentasie/bedrae sodat " + beskryf_minimum(formate.leen.prys_sent || 0) + " oorbly.",
      };
    }
  }
  const leen_tydperk_dae = Number(formate.leen && formate.leen.tydperk_dae) > 0
    ? Math.round(Number(formate.leen.tydperk_dae))
    : 30; // verstek — 1 maand

  const store = kry_store("katalogus");

  // Verhoed oorskryf van 'n bestaande slug per ongeluk
  const bestaande = await store.get(slug, { type: "json" });
  if (bestaande) {
    return {
      statusCode: 409,
      body: `Slug "${slug}" bestaan reeds — gebruik wysig-produk om dit te verander`,
    };
  }

  const produk = {
    slug,
    titel,
    outeur: await kry_outeur_naam_string(geldige_outeur_ids),
    outeur_ids: geldige_outeur_ids,
    kategorie_ids: Array.isArray(invoer.kategorie_ids) ? invoer.kategorie_ids.filter(Boolean) : [],
    oorsig: invoer.oorsig || "",
    vol_beskrywing: invoer.vol_beskrywing || "",
    omslag: invoer.omslag || "",
    isbn: kry_geldige_isbn(invoer.isbn),
    etiket: kry_geldige_etiket(invoer.etiket),
    formate: {
      eboek: {
        beskikbaar: !!formate.eboek.beskikbaar,
        prys_sent: formate.eboek.prys_sent || 0,
        geleidelik_ontsluit: true,
        verdelings: eboek_verdelings,
        hosting: eboek_hosting,
        vrystelling_datum: kry_geldige_datum(formate.eboek.vrystelling_datum),
        // Blobs-sleutel na die werklike PDF (gestoor via laai-eboek-op.js,
        // in die private "eboeke"-store — NOOIT publiek bedien nie, in
        // teenstelling met omslae). null totdat personeel die PDF oplaai.
        eboek_sleutel: invoer.eboek_sleutel || null,
      },
      harde_kopie: formate.harde_kopie && formate.harde_kopie.beskikbaar
        ? {
            beskikbaar: true,
            prys_sent: formate.harde_kopie.prys_sent || 0,
            voorraad_status: formate.harde_kopie.voorraad_status || "beskikbaar",
            verdelings: hardekopie_verdelings,
            hosting: hardekopie_hosting,
            vrystelling_datum: kry_geldige_datum(formate.harde_kopie.vrystelling_datum),
          }
        : { beskikbaar: false },
      leen: formate.leen && formate.leen.beskikbaar
        ? {
            beskikbaar: true,
            prys_sent: formate.leen.prys_sent || 0,
            tydperk_dae: leen_tydperk_dae,
            verdelings: leen_verdelings,
            hosting: leen_hosting,
          }
        : { beskikbaar: false },
    },
    eboek_konfig_pad: invoer.eboek_konfig_pad || `config/boek-dele/${slug}.json`,
    reeks: invoer.reeks || { reeks_slug: null, volgorde_in_reeks: null },
    aktief: true,
    geskep_op: new Date().toISOString(),
    geskep_deur: gebruiker.email,
  };

  await store.setJSON(slug, produk);

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(produk),
  };
};
