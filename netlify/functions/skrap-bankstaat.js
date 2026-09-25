// netlify/functions/skrap-bankstaat.js
//
// Vee een ingevoerde staat uit, saam met die joernaalinskrywings wat uit sy
// reels geskep is. Rol: boekhouding.
//
// Vir 'n staat wat verkeerd ingevoer is. Die pas (vereffenings, bestaande
// handinskrywings) word vanself losgemaak, want dit leef net op die staat.
// Die bediener vra die getikte woorde weer, soos by die toetse.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_joernaal_store } = require("./_joernaal");
const B = require("./_bankstate");

const WOORDE = "SKRAP STAAT";

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }
  if (String(invoer.woorde || "").trim() !== WOORDE) {
    return { statusCode: 400, body: `Tik ${WOORDE} om te bevestig` };
  }
  const store = B.kry_bankstate_store();
  const sleutel = String(invoer.sleutel || "");
  let staat;
  try {
    staat = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie die staat laai nie" };
  }
  if (!staat) return { statusCode: 404, body: "Staat nie gevind nie" };

  const jstore = kry_joernaal_store();
  let weg = 0;
  try {
    for (const r of staat.reels || []) {
      if (r.stand === "toegewys" && r.joernaal_sleutel) {
        await jstore.delete(r.joernaal_sleutel);
        weg += 1;
      }
    }
    await store.delete(sleutel);
  } catch (fout) {
    console.error("Kon nie die staat uitvee nie:", fout);
    return { statusCode: 500, body: "Kon nie die staat volledig uitvee nie. Herlaai en probeer weer." };
  }
  console.log(`Bankstaat ${sleutel} geskrap deur ${gebruiker.email || ""}; ${weg} joernaalinskrywings weg`);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sleutel, inskrywings: weg }),
  };
};
