// Personeel-beskermd — voeg 'n nuwe Vennoot-inskrywing by die "vennote"-store.
//
// subrekening_kode is nou OPSIONEEL by skepping — 'n nuwe persoon wat via
// 'n uitnodigings-skakel self aansluit het nog geen Paystack-subrekening
// nie; personeel voeg dit later by (sien wysig-vennoot.js) sodra hulle
// dit self by Paystack opgestel het. Status word outomaties afgelei:
// "wag_vir_subrekening" (geen kode nie) of "aktief" (kode teenwoordig).
//
// kontak_inligting dra die rol-spesifieke inligting wat via die
// uitnodigings-vorm ingesamel word (e-pos, selfoon, bankbesonderhede,
// ens.) — sien KONTAK_VELDE hieronder vir die volledige wit-lys.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

function maak_slug(teks) {
  return teks
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Wit-lys van kontak-/bankvelde wat ons vaslê — voorkom dat willekeurige
// ekstra velde ongesanitiseerd gestoor word. Nie elke rol gebruik elke
// veld nie (bv. net Outeurs gebruik id_nommer) — onbetrokke velde bly
// eenvoudig leeg/afwesig.
// bank_rekeninghouer en bank_tipe: Paystack vereis dat die rekeninghouer se
// naam met die bankrekening klop, en daardie naam is nie noodwendig die
// persoon se eie naam nie. Hierdie lys filter VELD VIR VELD — 'n veld wat
// nie hier staan nie, val stil weg by die stoor.
const KONTAK_VELDE = [
  "epos", "selfoon", "adres",
  "bank_rekeninghouer", "bank_naam", "bank_rekeningnommer",
  "bank_tak_kode", "bank_tipe",
  "id_nommer", "btw_nommer", "dekkingsarea",
];

function skoon_kontak_inligting(kontak_inligting) {
  if (!kontak_inligting || typeof kontak_inligting !== "object") return {};
  const skoon = {};
  for (const veld of KONTAK_VELDE) {
    if (kontak_inligting[veld]) {
      skoon[veld] = String(kontak_inligting[veld]).trim().slice(0, 200);
    }
  }
  return skoon;
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

  const naam = (invoer.naam || "").trim();
  const subrekening_kode = (invoer.subrekening_kode || "").trim();

  if (!naam) {
    return { statusCode: 400, body: "Verpligte veld: naam" };
  }
  if (subrekening_kode && !subrekening_kode.startsWith("ACCT_")) {
    return { statusCode: 400, body: "Subrekening-kode moet met ACCT_ begin" };
  }

  const vennoot_id = maak_slug(naam);
  if (!vennoot_id) {
    return { statusCode: 400, body: "Kon nie 'n geldige ID van die naam aflei nie" };
  }

  const store = kry_store("vennote");

  const bestaande = await store.get(vennoot_id, { type: "json" });
  if (bestaande) {
    return { statusCode: 409, body: `'n Inskrywing met naam "${naam}" bestaan reeds` };
  }

  const inskrywing = {
    vennoot_id,
    naam,
    subrekening_kode,
    status: subrekening_kode ? "aktief" : "wag_vir_subrekening",
    kontak_inligting: skoon_kontak_inligting(invoer.kontak_inligting),
    geskep_op: new Date().toISOString(),
    geskep_deur: gebruiker.email,
  };

  await store.setJSON(vennoot_id, inskrywing);

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(inskrywing),
  };
};
