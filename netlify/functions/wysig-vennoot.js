// Personeel-beskermd — wysig 'n bestaande inskrywing se naam,
// Paystack-subrekening-kode (opsioneel — kan later bygevoeg word sodra
// personeel dit self by Paystack opstel), en/of kontak-inligting in die
// "vennote"-store.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const KONTAK_VELDE = [
  "epos", "selfoon", "adres",
  "bank_naam", "bank_rekeningnommer", "bank_tak_kode",
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

  const vennoot_id = (invoer.vennoot_id || "").trim();
  const naam = (invoer.naam || "").trim();
  const subrekening_kode = (invoer.subrekening_kode || "").trim();

  if (!vennoot_id) {
    return { statusCode: 400, body: "Verpligte veld: vennoot_id" };
  }
  if (!naam) {
    return { statusCode: 400, body: "Verpligte veld: naam" };
  }
  if (subrekening_kode && !subrekening_kode.startsWith("ACCT_")) {
    return { statusCode: 400, body: "Subrekening-kode moet met ACCT_ begin" };
  }

  const store = kry_store("vennote");

  const bestaande = await store.get(vennoot_id, { type: "json" });
  if (!bestaande) {
    return { statusCode: 404, body: `Geen inskrywing met ID "${vennoot_id}" gevind nie` };
  }

  const bygewerk = {
    ...bestaande,
    naam,
    subrekening_kode,
    status: subrekening_kode ? "aktief" : "wag_vir_subrekening",
    kontak_inligting: {
      ...bestaande.kontak_inligting,
      ...skoon_kontak_inligting(invoer.kontak_inligting),
    },
    gewysig_op: new Date().toISOString(),
    gewysig_deur: gebruiker.email,
  };

  await store.setJSON(vennoot_id, bygewerk);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bygewerk),
  };
};
