// netlify/functions/stel-inskrywing-projek.js
// Weergawe 1 (17 Oktober 2026).
//
// Stel die PROJEK van een joernaalinskrywing: een wat met die hand ingevoer is,
// of een wat uit 'n bankreel geskep is. Rol: boekhouding.
//
// Invoer: { sleutel, projek_id }   (leeg projek_id maak dit los)
//
// DIE JOERNAAL IS DIE BRON. By 'n bankinskrywing word die projek na die
// bankreel gespieel, sodat die Bankstate-pil dit kan wys sonder om die joernaal
// te lees -- dieselfde patroon as die bewyse (_bewysstukke.js). Misluk die
// spieel, is die joernaal steeds reg.
//
// 'n Faktuur se ontvangs en uitbetalings kry hul projek van die faktuur self
// (stel-faktuur-projek.js), nie hier nie: hulle het geen eie rekord nie.
//
// 'N NUWE KEUSE MOET 'N AKTIEWE PROJEK WEES. 'n Gedeaktiveerde projek wat
// reeds gekies was, mag bly.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const { kry_joernaal_store } = require("./_joernaal");
const { kry_bankstate_store } = require("./_bankstate");

async function spieel_na_bankreel(rekord) {
  if (!rekord || rekord.bron !== "bank" || !rekord.bankreel) return;
  const [sleutel, nr] = String(rekord.bankreel).split("#");
  try {
    const store = kry_bankstate_store();
    const staat = await store.get(sleutel, { type: "json" });
    if (!staat) return;
    const r = (staat.reels || []).find((x) => x.nr === Number(nr));
    if (!r || r.joernaal_sleutel !== rekord.sleutel) return;
    r.projek_id = rekord.projek_id || "";
    await store.setJSON(sleutel, staat);
  } catch (fout) {
    console.error(`Kon nie die projek na bankreel ${rekord.bankreel} spieel nie:`, fout);
  }
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };

  let invoer;
  try { invoer = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Ongeldige JSON" }; }
  const sleutel = String(invoer.sleutel || "").trim();
  const projek_id = String(invoer.projek_id || "").trim().slice(0, 120);
  if (!sleutel) return { statusCode: 400, body: "Onvolledige versoek" };

  const store = kry_joernaal_store();
  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die inskrywing lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die inskrywing lees nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Inskrywing nie gevind nie" };

  if ((rekord.projek_id || "") !== projek_id && projek_id) {
    let p = null;
    try {
      p = await kry_store("projekte").get(projek_id, { type: "json" });
    } catch (fout) {
      console.error("Kon nie die projek lees nie:", fout);
      return { statusCode: 503, body: "Kon nie die projek nagaan nie" };
    }
    if (!p) return { statusCode: 400, body: "Die projek bestaan nie." };
    if (p.aktief === false) return { statusCode: 409, body: "Die projek is gedeaktiveer." };
  }

  rekord.projek_id = projek_id;
  rekord.bygewerk_op = new Date().toISOString();
  try {
    await store.setJSON(sleutel, rekord);
  } catch (fout) {
    console.error("Kon nie die inskrywing stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die inskrywing stoor nie" };
  }
  await spieel_na_bankreel(rekord);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sleutel, projek_id }),
  };
};
