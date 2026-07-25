// Personeel-beskermd — laai 'n omslagbeeld op na die "omslae"-Blobs-store.
// Word deur die paneelbord se "Voeg produk by"/"Wysig"-vorm aangeroep
// wanneer personeel 'n beeldlêer kies (i.p.v. self 'n pad in te tik).
//
// Die kliënt stuur die beeld as base64-teks (via FileReader.readAsDataURL,
// met die "data:image/...;base64," voorvoegsel afgehaal). Ons stoor dit
// as rou binêre data in Blobs, met die inhoud-tipe as metadata, sodat
// kry-omslag.js dit later korrek kan terugstuur.
//
// Grootte-beperking: 4MB (ná base64-dekodering) — ruim genoeg vir 'n
// boekomslag, en binne Netlify Functions se versoek-grootte-beperking.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const MAKS_GROOTTE_GREPE = 4 * 1024 * 1024; // 4MB
const TOEGELATE_TIPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function kry_uitbreiding(inhoud_tipe) {
  const kaart = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return kaart[inhoud_tipe] || "jpg";
}

function veilige_sleutel_gedeelte(teks) {
  return (teks || "omslag")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "omslag";
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

  const { slug, inhoud_tipe, data_base64 } = invoer;

  if (!inhoud_tipe || !data_base64) {
    return { statusCode: 400, body: "Verpligte velde: inhoud_tipe, data_base64" };
  }

  if (!TOEGELATE_TIPES.includes(inhoud_tipe)) {
    return { statusCode: 400, body: "Slegs JPEG, PNG, WEBP of GIF-beelde word toegelaat" };
  }

  let buffer;
  try {
    buffer = Buffer.from(data_base64, "base64");
  } catch {
    return { statusCode: 400, body: "Ongeldige base64-data" };
  }

  if (buffer.length > MAKS_GROOTTE_GREPE) {
    return { statusCode: 413, body: "Beeld is te groot — maksimum 4MB" };
  }

  const sleutel = `${veilige_sleutel_gedeelte(slug)}-${Date.now()}.${kry_uitbreiding(inhoud_tipe)}`;

  try {
    const store = kry_store("omslae");
    await store.set(sleutel, buffer, { metadata: { inhoud_tipe } });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pad: `/.netlify/functions/kry-omslag?bestand=${encodeURIComponent(sleutel)}`,
      }),
    };
  } catch (fout) {
    console.error("Kon nie omslag oplaai nie:", fout);
    return { statusCode: 500, body: "Kon nie beeld stoor nie" };
  }
};
