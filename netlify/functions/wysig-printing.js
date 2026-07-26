// Personeel-beskermd — wysig een bestaande inskrywing se naam en/of
// Paystack-subrekening-kode in die "printing"-store.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

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

  const printing_id = (invoer.printing_id || "").trim();
  const naam = (invoer.naam || "").trim();
  const subrekening_kode = (invoer.subrekening_kode || "").trim();

  if (!printing_id) {
    return { statusCode: 400, body: "Verpligte veld: printing_id" };
  }
  if (!naam || !subrekening_kode) {
    return { statusCode: 400, body: "Verpligte velde: naam, subrekening_kode" };
  }
  if (!subrekening_kode.startsWith("ACCT_")) {
    return { statusCode: 400, body: "Subrekening-kode moet met ACCT_ begin" };
  }

  const store = kry_store("printing");

  const bestaande = await store.get(printing_id, { type: "json" });
  if (!bestaande) {
    return { statusCode: 404, body: `Geen inskrywing met ID "${printing_id}" gevind nie` };
  }

  const bygewerk = {
    ...bestaande,
    naam,
    subrekening_kode,
    gewysig_op: new Date().toISOString(),
    gewysig_deur: gebruiker.email,
  };

  await store.setJSON(printing_id, bygewerk);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bygewerk),
  };
};
