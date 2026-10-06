// Personeel-beskermd — wysig 'n dokument in die "Dokumente"-afdeling: die
// naam, die beskrywing, en opsioneel die lêer self.
//
// VERVANG LÊER: die nuwe inhoud word onder DIESELFDE sleutel gestoor, sodat
// 'n aflaaiskakel wat reeds per e-pos of WhatsApp gestuur is, voortaan die
// nuwe weergawe gee. kry-dokument.js laat die blaaier 'n uur lank kas, dus
// kan 'n ou skakel tot 'n uur lank nog die vorige weergawe wys.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

// Dieselfde lys en perk as laai-dokument-op.js.
const MAKS_GROOTTE_GREPE = 4 * 1024 * 1024;
const TOEGELATE_TIPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
];

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

  const id = String(invoer.id || "").trim();
  const naam = String(invoer.naam || "").trim().slice(0, 200);
  const beskrywing = String(invoer.beskrywing || "").trim().slice(0, 500);

  if (!id) return { statusCode: 400, body: "Verpligte veld: id" };
  if (!naam) return { statusCode: 400, body: "Die naam mag nie leeg wees nie" };

  try {
    const store = kry_store("dokumente");
    const rekord = await store.get(id, { type: "json" });
    if (!rekord) return { statusCode: 404, body: "Hierdie dokument bestaan nie" };

    // Die lêer eerste: misluk dit, bly die rekord soos hy was.
    if (invoer.data_base64) {
      const inhoud_tipe = String(invoer.inhoud_tipe || "");
      if (!TOEGELATE_TIPES.includes(inhoud_tipe)) {
        return { statusCode: 400, body: "Slegs Word-, PDF-, Excel- of PowerPoint-lêers word toegelaat" };
      }
      const buffer = Buffer.from(String(invoer.data_base64), "base64");
      if (!buffer.length) return { statusCode: 400, body: "Die lêer is leeg" };
      if (buffer.length > MAKS_GROOTTE_GREPE) {
        return { statusCode: 413, body: "Lêer is te groot — maksimum 4MB" };
      }
      await kry_store("dokument-lêers").set(rekord.bestand_sleutel, buffer, { metadata: { inhoud_tipe } });
      rekord.inhoud_tipe = inhoud_tipe;
      rekord.grootte_grepe = buffer.length;
      rekord.lêernaam = String(invoer.lêernaam || rekord.lêernaam).slice(0, 200);
      rekord.lêer_vervang_op = new Date().toISOString();
    }

    rekord.naam = naam;
    rekord.beskrywing = beskrywing;
    rekord.gewysig_op = new Date().toISOString();
    rekord.gewysig_deur = gebruiker.epos || gebruiker.email || gebruiker.id || "";

    await store.setJSON(id, rekord);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dokument: rekord }),
    };
  } catch (fout) {
    console.error("Kon nie dokument wysig nie:", fout);
    return { statusCode: 500, body: "Kon nie die dokument wysig nie" };
  }
};
