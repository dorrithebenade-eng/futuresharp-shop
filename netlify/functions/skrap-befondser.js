// netlify/functions/skrap-befondser.js
//
// Vee een befondser of skenker uit, of deaktiveer hom. Rol: boekhouding.
//
//   TOETS voor die naam, of niks verwys daarna nie  -> uitgevee
//   'n toekenning of skenking verwys daarna         -> gedeaktiveer
//
// Toekennings en skenkings bestaan eers vanaf fase B; die tel lees die store
// reeds, sodat die reel geld die dag wat hulle bestaan.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const { kry_befondsers_store, is_toets_naam } = require("./_befondsers");

async function tel_verwysings(nommer) {
  let tel = 0;
  for (const naam of ["toekennings", "joernaal"]) {
    const store = kry_store(naam);
    const { blobs } = await store.list();
    const items = (
      await Promise.all((blobs || []).map((b) => store.get(b.key, { type: "json" })))
    ).filter(Boolean);
    tel += items.filter((r) => r.befondser === nommer || r.skenker === nommer).length;
  }
  return tel;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }
  const nommer = String(invoer.nommer || "").trim();
  if (!nommer) return { statusCode: 400, body: "Geen nommer nie" };

  const store = kry_befondsers_store();
  let rekord;
  try {
    rekord = await store.get(nommer, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie ${nommer} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die befondser laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Befondser nie gevind nie" };

  let verwysings;
  try {
    verwysings = await tel_verwysings(nommer);
  } catch (fout) {
    console.error(`Kon nie die verwysings na ${nommer} tel nie:`, fout);
    return { statusCode: 500, body: "Kon nie nagaan of dit gebruik word nie. Niks is uitgevee nie." };
  }

  if (!is_toets_naam(rekord.naam) && verwysings > 0) {
    try {
      await store.setJSON(nommer, { ...rekord, aktief: false, bygewerk_op: new Date().toISOString() });
    } catch (fout) {
      console.error(`Kon nie ${nommer} deaktiveer nie:`, fout);
      return { statusCode: 500, body: "Kon nie deaktiveer nie" };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nommer, uitgevee: false, gedeaktiveer: true, verwysings }),
    };
  }

  try {
    await store.delete(nommer);
  } catch (fout) {
    console.error(`Kon nie ${nommer} uitvee nie:`, fout);
    return { statusCode: 500, body: "Kon nie uitvee nie" };
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nommer, uitgevee: true, gedeaktiveer: false, verwysings }),
  };
};
