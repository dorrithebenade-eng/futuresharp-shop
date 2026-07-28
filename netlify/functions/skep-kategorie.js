// Personeel-beskermd — voeg 'n nuwe kategorie by die "kategoriee"-store.
// Baie eenvoudiger as die 5 rol-registers — net 'n naam, geen
// subrekening-kode of kontak-inligting nie, aangesien 'n kategorie nie 'n
// persoon/maatskappy is nie.

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
  if (!naam) {
    return { statusCode: 400, body: "Verpligte veld: naam" };
  }

  const kategorie_id = maak_slug(naam);
  if (!kategorie_id) {
    return { statusCode: 400, body: "Kon nie 'n geldige ID van die naam aflei nie" };
  }

  const store = kry_store("kategoriee");

  const bestaande = await store.get(kategorie_id, { type: "json" });
  if (bestaande) {
    return { statusCode: 409, body: `'n Kategorie met naam "${naam}" bestaan reeds` };
  }

  const kategorie = {
    kategorie_id,
    naam,
    geskep_op: new Date().toISOString(),
    geskep_deur: gebruiker.email,
  };

  await store.setJSON(kategorie_id, kategorie);

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(kategorie),
  };
};
