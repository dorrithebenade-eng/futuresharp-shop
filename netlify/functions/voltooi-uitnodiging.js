// PUBLIEK (geen aanmelding nodig nie) — die persoon voltooi hul eie
// inligting via 'n geldige, hangende uitnodigingskakel. Hierdie Function:
//   1. verifieer die token bestaan en nog "hangend" is (nie reeds
//      gebruik nie — voorkom dat 'n skakel twee keer 'n inskrywing skep)
//   2. skep die register-inskrywing (SONDER subrekening_kode — personeel
//      voeg dit later self by sodra hulle dit by Paystack opgestel het)
//   3. merk die uitnodiging as "voltooi", onveranderlik gekoppel aan die
//      nuutgeskepte inskrywing se ID

const { kry_store } = require("./_blob-store");

const ROL_KONFIG = {
  outeur: { store: "outeurs", idveld: "outeur_id" },
  vennoot: { store: "vennote", idveld: "vennoot_id" },
  ontwerp_admin: { store: "ontwerp-admin", idveld: "ontwerp_admin_id" },
  printing: { store: "printing", idveld: "printing_id" },
  aflewering: { store: "aflewering", idveld: "aflewering_id" },
};

const KONTAK_VELDE = [
  "epos", "selfoon", "adres",
  "bank_naam", "bank_rekeningnommer", "bank_tak_kode",
  "id_nommer", "btw_nommer", "dekkingsarea",
];

function maak_slug(teks) {
  return teks
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const token = (invoer.token || "").trim();
  const naam = (invoer.naam || "").trim();

  if (!token) {
    return { statusCode: 400, body: "Verpligte veld: token" };
  }
  if (!naam) {
    return { statusCode: 400, body: "Verpligte veld: naam" };
  }

  const uitnodigings_store = kry_store("uitnodigings");
  const uitnodiging = await uitnodigings_store.get(token, { type: "json" });

  if (!uitnodiging) {
    return { statusCode: 404, body: "Hierdie skakel is nie geldig nie" };
  }
  if (uitnodiging.status !== "hangend") {
    return { statusCode: 409, body: "Hierdie skakel is reeds voltooi en kan nie weer gebruik word nie" };
  }

  const konfig = ROL_KONFIG[uitnodiging.rol_tipe];
  if (!konfig) {
    return { statusCode: 500, body: "Ongeldige rol op uitnodiging" };
  }

  const entiteit_id = maak_slug(naam);
  if (!entiteit_id) {
    return { statusCode: 400, body: "Kon nie 'n geldige ID van die naam aflei nie" };
  }

  const register_store = kry_store(konfig.store);

  const bestaande = await register_store.get(entiteit_id, { type: "json" });
  if (bestaande) {
    return { statusCode: 409, body: `'n Inskrywing met naam "${naam}" bestaan reeds — kontak Future Sharp direk` };
  }

  const inskrywing = {
    [konfig.idveld]: entiteit_id,
    naam,
    subrekening_kode: "",
    status: "wag_vir_subrekening",
    kontak_inligting: skoon_kontak_inligting(invoer.kontak_inligting),
    geskep_op: new Date().toISOString(),
    geskep_deur: "self-diens (uitnodiging)",
  };

  await register_store.setJSON(entiteit_id, inskrywing);

  await uitnodigings_store.setJSON(token, {
    ...uitnodiging,
    status: "voltooi",
    voltooi_op: new Date().toISOString(),
    geskepte_entiteit_id: entiteit_id,
  });

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sukses: true }),
  };
};
