// netlify/functions/skrap-indiening.js
//
// Vee een boekindiening heeltemal uit: die rekord, sy lêers in
// `indienings-leers`, en (as hy reeds goedgekeur is) die afskrifte wat
// keur-goed.js na `eboeke` en `omslae` gemaak het. Rol: personeel.
//
// WAARVOOR DIT IS: toetsindienings en indienings wat nooit iets geword het
// nie. Dit is nie die pad om 'n boek van die rak af te haal nie.
//
// WAT GEWEIER WORD
//
//   'n Indiening wat op die rak is (`op_rak`, `wysiging`) of 'n produk_id
//   dra. Daar is 'n boek in die winkel wat na sy lêers wys; dit word eers
//   uit die katalogus verwyder.
//
//   'n Goedgekeurde indiening waarvan die e-boek of omslag deur enige
//   produk in die katalogus gebruik word. Dan is die produk geskep maar
//   nooit as opgestel gemerk nie, en die lêers is nie meer net syne nie.
//
// DIE BEVESTIGING: die vormnommer moet getik word, en die bediener toets
// dit weer. 'n Knoppie alleen is te maklik vir iets wat nie terug kan nie.
//
// VOLGORDE: eers word alles gelees en besluit, dan uitgevee, met die rekord
// heel laaste. Misluk 'n lêer halfpad, staan die rekord nog en kan die
// handeling herhaal word.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_indienings_store } = require("./_indienings");

const LEERS_STORE = "indienings-leers";

function nommer_is_geldig(nommer) {
  return /^BV-\d{4}-\d{4}$/.test(String(nommer || ""));
}

// keur-goed.js stoor die omslag as 'n pad met ?bestand=<sleutel>.
function omslag_sleutel(pad) {
  if (!pad) return null;
  const pas = String(pad).match(/[?&]bestand=([^&]+)/);
  return pas ? decodeURIComponent(pas[1]) : null;
}

async function lys_sleutels(store, prefix) {
  const lys = await store.list({ prefix });
  return (lys.blobs || []).map((b) => b.key);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Slegs POST" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie, personeel-rol vereis" };
  }

  let versoek;
  try {
    versoek = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige versoek" };
  }

  const nommer = String(versoek.nommer || "").trim();
  if (!nommer_is_geldig(nommer)) {
    return { statusCode: 400, body: "Ongeldige vormnommer" };
  }
  if (String(versoek.bevestig || "").trim().toUpperCase() !== nommer) {
    return { statusCode: 400, body: "Die getikte vormnommer stem nie ooreen nie" };
  }

  const indienings = kry_indienings_store();

  // --- Lees en besluit ---

  let rekord;
  try {
    rekord = await indienings.get(nommer, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die indiening lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die indiening lees nie" };
  }
  if (!rekord) {
    return { statusCode: 404, body: "Hierdie vorm bestaan nie" };
  }

  if (rekord.stand === "op_rak" || rekord.stand === "wysiging" || rekord.produk_id) {
    return {
      statusCode: 409,
      body: "Hierdie boek is op die rak. Verwyder eers die produk uit die katalogus.",
    };
  }

  const eboek = rekord.eboek_sleutel || null;
  const omslag = omslag_sleutel(rekord.omslag);

  if (eboek || omslag) {
    try {
      const katalogus = kry_store("katalogus");
      const slugs = await lys_sleutels(katalogus, "");
      for (const slug of slugs) {
        const produk = await katalogus.get(slug, { type: "json" });
        const teks = JSON.stringify(produk || {});
        if ((eboek && teks.includes(eboek)) || (omslag && teks.includes(omslag))) {
          return {
            statusCode: 409,
            body: `Die produk "${slug}" gebruik hierdie indiening se lêers. Verwyder eers die produk.`,
          };
        }
      }
    } catch (fout) {
      console.error("Kon nie die katalogus nagaan nie:", fout);
      return { statusCode: 500, body: "Kon nie die katalogus nagaan nie" };
    }
  }

  const leers = kry_store(LEERS_STORE);
  let leer_sleutels;
  try {
    leer_sleutels = [
      ...(await lys_sleutels(leers, `${nommer}/`)),
      ...(await lys_sleutels(leers, `_tydelik/${nommer}/`)),
    ];
  } catch (fout) {
    console.error("Kon nie die lêers lys nie:", fout);
    return { statusCode: 500, body: "Kon nie die indiening se lêers lys nie" };
  }

  // --- Vee uit, die rekord laaste ---

  try {
    for (const sleutel of leer_sleutels) await leers.delete(sleutel);
    if (eboek) await kry_store("eboeke").delete(eboek);
    if (omslag) await kry_store("omslae").delete(omslag);
    await indienings.delete(nommer);
  } catch (fout) {
    console.error(`Uitvee van ${nommer} het halfpad misluk:`, fout);
    return { statusCode: 500, body: "Die uitvee het halfpad misluk. Probeer weer." };
  }

  console.log(`Indiening ${nommer} uitgevee deur ${gebruiker.email || "?"}`);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nommer,
      geskrap: true,
      leers: leer_sleutels.length + (eboek ? 1 : 0) + (omslag ? 1 : 0),
    }),
  };
};
