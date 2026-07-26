// Personeel-beskermd — stel die winkel-wye bannier se teks en aan/af-status.
// Slegs EEN bannier op 'n slag: hierdie Function oorskryf eenvoudig die
// enkele gestoorde rekord elke keer.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const KENNISGEWING_SLEUTEL = "winkel-kennisgewing";
const MAKS_LENGTE = 140;

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ fout: "Metode nie toegelaat nie" }) };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: JSON.stringify({ fout: "Geen toegang nie — personeel-rol vereis" }) };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ fout: "Ongeldige JSON" }) };
  }

  const teks = typeof invoer.teks === "string" ? invoer.teks.trim() : "";
  const aktief = Boolean(invoer.aktief);

  if (teks.length > MAKS_LENGTE) {
    return {
      statusCode: 400,
      body: JSON.stringify({ fout: `Teks te lank — maksimum ${MAKS_LENGTE} karakters` }),
    };
  }

  try {
    const store = kry_store("instellings");
    await store.setJSON(KENNISGEWING_SLEUTEL, {
      teks,
      aktief,
      bygewerk_deur: gebruiker.email,
      bygewerk_op: new Date().toISOString(),
    });

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
  } catch (fout) {
    console.error("stoor-kennisgewing fout:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie bannier stoor nie, probeer later weer" }) };
  }
};
