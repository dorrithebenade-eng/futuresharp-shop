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

const GELDIGE_ROL_TIPES = ["outeur", "vennoot", "ontwerp_admin", "printing", "aflewering"];

// Future Sharp se hoofrekening moet ALTYD ten minste 3% + Hosting% van 'n
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

  return verdelings_persentasie + hosting_persentasie > 97;
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
  const { slug, titel, outeur, formate } = invoer;
  if (!slug || !titel || !outeur || !formate || !formate.eboek) {
    return {
      statusCode: 400,
      body: "Verpligte velde ontbreek: slug, titel, outeur, formate.eboek",
    };
  }

  const eboek_verdelings = kry_geldige_verdelings(formate.eboek.verdelings);
  const eboek_hosting = kry_geldige_hosting(formate.eboek.hosting);
  if (oorskry_hoofrekening_minimum(eboek_verdelings, eboek_hosting, formate.eboek.prys_sent || 0)) {
    return {
      statusCode: 400,
      body: "Die e-boek se verdeling(s) plus Hosting los minder as 3% oor vir Future Sharp se hoofrekening — verminder die persentasie/bedrae sodat ten minste 3% oorbly.",
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
      body: "Die harde-kopie se verdeling(s) plus Hosting los minder as 3% oor vir Future Sharp se hoofrekening — verminder die persentasie/bedrae sodat ten minste 3% oorbly.",
    };
  }

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
    outeur,
    oorsig: invoer.oorsig || "",
    vol_beskrywing: invoer.vol_beskrywing || "",
    omslag: invoer.omslag || "",
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
