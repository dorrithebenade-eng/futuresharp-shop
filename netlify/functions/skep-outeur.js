// Personeel-beskermd — voeg 'n nuwe outeur by die "outeurs"-store: naam +
// Paystack-subrekening-kode. Word EEN KEER per outeur gebruik (wanneer
// hulle aansluit) — personeel hoef daarna nooit weer die rou ACCT_-kode
// te onthou of in te tik nie; hulle kies net die outeur se naam uit 'n
// lys wanneer hulle 'n boek se verdeling opstel.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

function maak_slug(teks) {
  return teks
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // verwyder aksente, bv. "é" → "e"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

  const naam = (invoer.naam || "").trim();
  const subrekening_kode = (invoer.subrekening_kode || "").trim();

  if (!naam || !subrekening_kode) {
    return { statusCode: 400, body: "Verpligte velde: naam, subrekening_kode" };
  }
  if (!subrekening_kode.startsWith("ACCT_")) {
    return { statusCode: 400, body: "Subrekening-kode moet met ACCT_ begin" };
  }

  const outeur_id = maak_slug(naam);
  if (!outeur_id) {
    return { statusCode: 400, body: "Kon nie 'n geldige ID van die naam aflei nie" };
  }

  const store = kry_store("outeurs");

  const bestaande = await store.get(outeur_id, { type: "json" });
  if (bestaande) {
    return { statusCode: 409, body: `'n Outeur met naam "${naam}" bestaan reeds` };
  }

  const outeur = {
    outeur_id,
    naam,
    subrekening_kode,
    geskep_op: new Date().toISOString(),
    geskep_deur: gebruiker.email,
  };

  await store.setJSON(outeur_id, outeur);

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(outeur),
  };
};
