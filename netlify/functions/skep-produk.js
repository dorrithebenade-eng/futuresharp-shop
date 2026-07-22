// Personeel-beskermd — skep 'n nuwe produk-rekord in die "katalogus"-store.
// Word deur die "Voeg produk by"-vorm op die interne paneelbord aangeroep
// (Fase 4).

const { getStore } = require("@netlify/blobs");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

// Valideer 'n opsionele outeur-verdeling — gee null terug (geen verdeling
// nie, alles gaan na Future Sharp se hoofrekening) tensy dit korrek
// gevorm is. Dit voorkom dat 'n missvormde vorm-invoer stilweg 'n
// halwe/ongeldige verdeling stoor wat later betaling-verwarring veroorsaak.
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

  // Basiese validering — verplig velde volgens die katalogus-skema
  const { slug, titel, outeur, formate } = invoer;
  if (!slug || !titel || !outeur || !formate || !formate.eboek) {
    return {
      statusCode: 400,
      body: "Verpligte velde ontbreek: slug, titel, outeur, formate.eboek",
    };
  }

  const store = getStore("katalogus");

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
        verdeling: kry_geldige_verdeling(formate.eboek.verdeling),
        vrystelling_datum: kry_geldige_datum(formate.eboek.vrystelling_datum),
      },
      harde_kopie: formate.harde_kopie && formate.harde_kopie.beskikbaar
        ? {
            beskikbaar: true,
            prys_sent: formate.harde_kopie.prys_sent || 0,
            voorraad_status: formate.harde_kopie.voorraad_status || "beskikbaar",
            verdeling: kry_geldige_verdeling(formate.harde_kopie.verdeling),
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
