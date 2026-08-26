// netlify/functions/skrap-joernaal.js
//
// Skrap 'n joernaalinskrywing. Rol: boekhouding.
//
// NET 'N HANDINSKRYWING KAN GESKRAP WORD, en dit gebeur vanself: 'n faktuur
// se ontvangs en 'n uitbetaling word deur kry-joernaal.js UIT DIE FAKTURE
// gelees en bestaan glad nie in hierdie store nie. Hulle het dus geen sleutel
// om hier te stuur nie.
//
// 'n TIKFOUT MOET REGGEMAAK KAN WORD. Die joernaal is 'n hulpmiddel, nie 'n
// grootboek nie; daar is geen stornering en geen ouditspoor nie. Word dit
// later 'n rekord waarop iemand steun, moet hierdie besluit heroorweeg word.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_joernaal_store } = require("./_joernaal");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const sleutel = String(invoer.sleutel || "").trim();
  if (!sleutel.startsWith("J-")) {
    return { statusCode: 400, body: "Ongeldige sleutel" };
  }

  const store = kry_joernaal_store();

  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie joernaalinskrywing ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die inskrywing laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Inskrywing nie gevind nie" };

  try {
    await store.delete(sleutel);
  } catch (fout) {
    console.error(`Kon nie joernaalinskrywing ${sleutel} skrap nie:`, fout);
    return { statusCode: 500, body: "Kon nie die inskrywing skrap nie" };
  }

  console.log(
    `Joernaalinskrywing ${sleutel} (${rekord.beskrywing || ""}) geskrap deur ` +
      `${(gebruiker && gebruiker.email) || ""}`
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sleutel, geskrap: true }),
  };
};
