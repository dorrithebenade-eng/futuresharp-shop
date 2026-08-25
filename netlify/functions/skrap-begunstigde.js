// netlify/functions/skrap-begunstigde.js
//
// Skrap 'n begunstigde uit die register. Rol: boekhouding.
//
// DIESELFDE VORM AS skrap-klient.js, en om dieselfde rede: dit is 'n
// opruiming, nie 'n gewone handeling nie. Wie geld ontvang het, bly staan.
//
// ─────────────────────────────────────────────────────────────────────────
// 'N BEGUNSTIGDE WAT IN ENIGE FAKTUUR VOORKOM, GAAN NOOIT WEG NIE.
//
// Sy ID is 'n slug van sy naam wat NOOIT verander nie — juis omdat elke
// uitgereikte faktuur se gevriesde verdeling daarna verwys. Verdwyn hy,
// verwys daardie verdelings na niks, en dan kan niemand ooit weer sê wie
// daardie R7 000 gekry het nie.
//
// Drie plekke word nagegaan, want 'n begunstigde kan op drie maniere aan 'n
// faktuur hang:
//
//   verdeling_gevries.rye[].begunstigde_id — die uitgereikte faktuur
//   verdeling[].ontvanger                  — die lewende verdeling op 'n konsep
//   koste[].ontvanger                      — 'n koste-ry wat aan hom uitbetaal word
//
// Die derde is die maklikste om te vergeet en die duurste om te mis: iemand
// wat net sy reiskoste terugkry, staan nie in die verdeling nie.
// ─────────────────────────────────────────────────────────────────────────
//
// KAN ONS DIE FAKTURE NIE LEES NIE, WEIER ONS. Dieselfde keuse as
// skrap-klient.js en los-duplikaat.js: 'n stukkende Blob-oproep mag nooit
// soos "geen fakture" lyk nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const {
  kry_fakture_store,
  is_konsep_sleutel,
  sleutel_na_nommer,
} = require("./_fakture");

// Gee terug WAAR hy voorkom, nie net of hy voorkom nie. "Hy staan op
// FS/01961" stuur 'n mens na die regte plek; "hy word gebruik" laat 'n mens
// self gaan soek.
async function fakture_met(id) {
  const store = kry_fakture_store();
  const lys = await store.list();
  const uitgereik = [];
  let konsepte = 0;

  for (const b of lys.blobs || []) {
    const f = await store.get(b.key, { type: "json" });
    if (!f) continue;

    const gevries = (f.verdeling_gevries && f.verdeling_gevries.rye) || [];
    const raak =
      gevries.some((r) => r && r.begunstigde_id === id) ||
      (f.verdeling || []).some((r) => r && r.ontvanger === id) ||
      (f.koste || []).some((r) => r && r.ontvanger === id);

    if (!raak) continue;
    if (is_konsep_sleutel(b.key)) konsepte += 1;
    else uitgereik.push(f.nommer || sleutel_na_nommer(b.key) || b.key);
  }
  return { uitgereik, konsepte };
}

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

  const id = String(invoer.begunstigde_id || "").trim();
  if (!id) return { statusCode: 400, body: "Geen begunstigde-ID nie" };

  const store = kry_store("begunstigdes");

  let begunstigde;
  try {
    begunstigde = await store.get(id, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie begunstigde ${id} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die begunstigde laai nie" };
  }
  if (!begunstigde) return { statusCode: 404, body: "Begunstigde nie gevind nie" };

  let gevind;
  try {
    gevind = await fakture_met(id);
  } catch (fout) {
    console.error("Kon nie die fakture nagaan nie:", fout);
    return {
      statusCode: 503,
      body:
        "Kon nie die fakture nagaan nie. Probeer weer — die begunstigde is nie geskrap nie.",
    };
  }

  if (gevind.uitgereik.length) {
    return {
      statusCode: 409,
      body:
        `Hierdie begunstigde staan op ${gevind.uitgereik.join(", ")}. ` +
        "Iemand wat op 'n uitgereikte faktuur staan, kan nie geskrap word nie.",
    };
  }

  if (gevind.konsepte) {
    return {
      statusCode: 409,
      body:
        gevind.konsepte === 1
          ? "Hierdie begunstigde staan op 'n konsep. Haal hom eers daar uit."
          : `Hierdie begunstigde staan op ${gevind.konsepte} konsepte. Haal hom eers daar uit.`,
    };
  }

  try {
    await store.delete(id);
  } catch (fout) {
    console.error(`Kon nie begunstigde ${id} skrap nie:`, fout);
    return { statusCode: 500, body: "Kon nie die begunstigde skrap nie" };
  }

  console.log(
    `Begunstigde ${id} (${begunstigde.naam || ""}) geskrap deur ` +
      `${(gebruiker && gebruiker.email) || ""}`
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ begunstigde_id: id, geskrap: true }),
  };
};
