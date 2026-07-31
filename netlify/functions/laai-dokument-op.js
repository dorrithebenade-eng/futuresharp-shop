// Personeel-beskermd — laai 'n dokument (Word, PDF, Excel, PowerPoint) op
// na die paneelbord se "Dokumente"-afdeling. Mirror van laai-omslag-op.js
// se patroon: die binêre lêer word apart gestoor ("dokument-lêers"), met
// 'n JSON-metadata-rekord ("dokumente") wat daarna verwys — sodat die lys
// vinnig gelaai kan word sonder om elke lêer se volle inhoud te haal.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const MAKS_GROOTTE_GREPE = 4 * 1024 * 1024; // 4MB — dieselfde perk as omslae

const TOEGELATE_TIPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint": "ppt",
};

function veilige_sleutel_gedeelte(teks) {
  return (teks || "dokument")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "dokument";
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

  const { naam, beskrywing, lêernaam, inhoud_tipe, data_base64 } = invoer;

  if (!naam || !inhoud_tipe || !data_base64) {
    return { statusCode: 400, body: "Verpligte velde: naam, inhoud_tipe, data_base64" };
  }

  if (!TOEGELATE_TIPES[inhoud_tipe]) {
    return { statusCode: 400, body: "Slegs Word-, PDF-, Excel- of PowerPoint-lêers word toegelaat" };
  }

  let buffer;
  try {
    buffer = Buffer.from(data_base64, "base64");
  } catch {
    return { statusCode: 400, body: "Ongeldige base64-data" };
  }

  if (buffer.length > MAKS_GROOTTE_GREPE) {
    return { statusCode: 413, body: "Lêer is te groot — maksimum 4MB" };
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const bestand_sleutel = `${veilige_sleutel_gedeelte(naam)}-${id}.${TOEGELATE_TIPES[inhoud_tipe]}`;
  const nou = new Date().toISOString();

  try {
    const lêer_store = kry_store("dokument-lêers");
    await lêer_store.set(bestand_sleutel, buffer, { metadata: { inhoud_tipe } });

    const rekord = {
      id,
      naam,
      beskrywing: beskrywing || "",
      lêernaam: lêernaam || bestand_sleutel,
      inhoud_tipe,
      grootte_grepe: buffer.length,
      bestand_sleutel,
      opgelaai_op: nou,
      opgelaai_deur: gebruiker.epos || gebruiker.id || "",
    };

    const dokumente_store = kry_store("dokumente");
    await dokumente_store.setJSON(id, rekord);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dokument: rekord }),
    };
  } catch (fout) {
    console.error("Kon nie dokument oplaai nie:", fout);
    return { statusCode: 500, body: "Kon nie dokument stoor nie" };
  }
};
