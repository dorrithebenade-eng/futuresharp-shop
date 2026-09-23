// Personeel-beskermd — registreer 'n bestaande outeur ook as spreker.
// FutureSharp Talks.
//
// Die sprekersrekord word uit die outeursrekord SAAMGESTEL, nie gekopieer
// nie. Wat oorkom: naam, Paystack-subrekening (dieselfde persoon, dieselfde
// bankrekening), die kontak- en bankvelde, en identity_id sodat die
// Sprekerspaneel later dieselfde aanmelding herken.
//
// WAT NIE OORKOM NIE, EN HOEKOM:
//
//   dokumente  — die outeur se ID-afskrif en getekende ooreenkoms leef in
//                `uitnodiging-leers`, en die rekord dra net die verwysing.
//                skrap-spreker.js verwyder ELKE lêer waarna 'n sprekersrekord
//                verwys. Het die spreker dieselfde verwysings gedra, sou 'n
//                mens wat net die spreker skrap, die outeur se dokumente
//                saam uitvee.
//   ooreenkoms — die outeursooreenkoms dek boeke, nie talks nie. Die spreker
//                teken sy eie wanneer die sprekersooreenkoms bestaan.
//
// Die spreker_id is die outeur_id, sodat dieselfde persoon op albei plekke
// dieselfde sleutel dra. bron_outeur_id hou die skakel vas ook as die
// naam later aan een van die twee kante verander.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

// Dieselfde wit-lys as skep-spreker.js en wysig-spreker.js.
const KONTAK_VELDE = [
  "epos", "selfoon", "adres",
  "bank_rekeninghouer", "bank_naam", "bank_rekeningnommer",
  "bank_tak_kode", "bank_tipe",
  "id_nommer", "btw_nommer", "dekkingsarea",
];

function kies_kontak_inligting(kontak_inligting) {
  if (!kontak_inligting || typeof kontak_inligting !== "object") return {};
  const gekies = {};
  for (const veld of KONTAK_VELDE) {
    if (kontak_inligting[veld]) {
      gekies[veld] = String(kontak_inligting[veld]).trim().slice(0, 200);
    }
  }
  return gekies;
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

  const outeur_id = (invoer.outeur_id || "").trim();
  if (!outeur_id) {
    return { statusCode: 400, body: "Verpligte veld: outeur_id" };
  }

  const outeur = await kry_store("outeurs").get(outeur_id, { type: "json" });
  if (!outeur) {
    return { statusCode: 404, body: `Geen outeur met ID "${outeur_id}" gevind nie` };
  }

  const sprekers = kry_store("sprekers");

  // Twee kontroles: op die sleutel, en op die skakel. Die tweede vang 'n
  // spreker wat vroeër uit hierdie outeur geskep is en wie se sleutel nie
  // meer dieselfde is nie.
  if (await sprekers.get(outeur_id, { type: "json" })) {
    return { statusCode: 409, body: `"${outeur.naam}" is reeds as spreker geregistreer` };
  }
  const { blobs } = await sprekers.list();
  const bestaande = await Promise.all(blobs.map((b) => sprekers.get(b.key, { type: "json" })));
  if (bestaande.some((s) => s && s.bron_outeur_id === outeur_id)) {
    return { statusCode: 409, body: `"${outeur.naam}" is reeds as spreker geregistreer` };
  }

  const subrekening_kode = (outeur.subrekening_kode || "").trim();

  const inskrywing = {
    spreker_id: outeur_id,
    naam: outeur.naam,
    subrekening_kode,
    status: subrekening_kode ? "aktief" : "wag_vir_subrekening",
    kontak_inligting: kies_kontak_inligting(outeur.kontak_inligting),
    bron_outeur_id: outeur_id,
    geskep_op: new Date().toISOString(),
    geskep_deur: gebruiker.email,
  };
  if (outeur.identity_id) inskrywing.identity_id = outeur.identity_id;

  await sprekers.setJSON(outeur_id, inskrywing);

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(inskrywing),
  };
};
