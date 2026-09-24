// netlify/functions/skrap-projek.js
//
// Vee een projek uit, of deaktiveer dit. Rol: boekhouding.
//
// DIESELFDE TWEE UITKOMSTE AS skrap-fin-kategorie.js:
//
//   geen verwysing, of die toetsstempel  -> uitgevee
//   verwysings buite die toetsfase       -> gedeaktiveer
//
// Gedeaktiveer beteken `aktief: false`: die rekord bly, elke inskrywing wat
// daarheen wys bly geldig, en die naam verdwyn uit die keuselyste.
//
// WAT "GEBRUIK" BETEKEN: 'n joernaalinskrywing met hierdie `projek_id`. Die
// joernaal dra die veld nog nie; die tel staan reeds hier sodat die reel geld
// die dag wat dit wel so is, sonder dat hierdie leer onthou moet word.
//
// 'N LEESFOUT KEER DIE SKRAP. Misluk die tel en gaan ons voort, vee ons
// moontlik 'n projek uit waarna 'n inskrywing wys.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const { kry_projekte_store, is_toetsfase } = require("./_projekte");

const ROLLE = ["boekhouding"];

async function tel_verwysings(id) {
  const jn_store = kry_store("joernaal");
  const { blobs } = await jn_store.list();
  const items = (
    await Promise.all((blobs || []).map((b) => jn_store.get(b.key, { type: "json" })))
  ).filter(Boolean);
  return items.filter((r) => r && r.projek_id === id).length;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const id = String(invoer.id || "").trim();
  if (!id) return { statusCode: 400, body: "Verpligte veld: id" };

  const store = kry_projekte_store();

  let projek = null;
  try {
    projek = await store.get(id, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie projek "${id}" lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die projek laai nie" };
  }
  if (!projek) return { statusCode: 404, body: "Projek nie gevind nie" };

  let verwysings;
  try {
    verwysings = await tel_verwysings(id);
  } catch (fout) {
    console.error(`Kon nie die verwysings na "${id}" tel nie:`, fout);
    return {
      statusCode: 500,
      body: "Kon nie nagaan of die projek gebruik word nie. Niks is uitgevee nie.",
    };
  }

  const dra_stempel = projek.toets === true && is_toetsfase();
  if (!dra_stempel && verwysings > 0) {
    try {
      await store.setJSON(id, {
        ...projek,
        aktief: false,
        bygewerk_op: new Date().toISOString(),
      });
    } catch (fout) {
      console.error(`Kon nie projek "${id}" deaktiveer nie:`, fout);
      return { statusCode: 500, body: "Kon nie die projek deaktiveer nie" };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, uitgevee: false, gedeaktiveer: true, verwysings }),
    };
  }

  try {
    await store.delete(id);
  } catch (fout) {
    console.error(`Kon nie projek "${id}" uitvee nie:`, fout);
    return { statusCode: 500, body: "Kon nie die projek uitvee nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, uitgevee: true, gedeaktiveer: false, verwysings }),
  };
};
