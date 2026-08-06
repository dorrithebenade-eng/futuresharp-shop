// netlify/functions/_my-outeur.js
//
// Gee die outeur-inskrywing terug wat aan die aangemelde gebruiker behoort.
// LEES ALLEEN — hierdie helper skryf niks.
//
// WAAROM 'N APARTE LÊER: kry-my-outeur.js doen dieselfde soektog én skryf
// 'n identity_id op die inskrywing wanneer hy dit die eerste keer op e-pos
// vind. Daardie skryfwerk moet op EEN plek bly. Elke ander outeur-Function
// het net die opsoek nodig, en kry dit hier.
//
// Die volgorde is dieselfde as daar:
//   1. identity_id == die gebruiker s'n. Dit is die pad ná die eerste
//      aanmelding, en dit oorleef 'n e-posverandering.
//   2. Andersins op e-pos, en dan slegs inskrywings wat nie reeds aan
//      iemand anders behoort nie.
//   3. Meer as een tref: gee niks terug nie. Twee outeurs met dieselfde
//      e-pos is 'n saak vir 'n mens, nie vir 'n raaiskoot nie.
//
// Die antwoord is die RUWE inskrywing, nie die front-end-weergawe nie.
// 'n Bediener-Function het die outeur_id nodig; wat na die blaaier gaan,
// besluit die Function wat hierdie een aanroep.

const { kry_store } = require("./_blob-store");

function normaliseer_epos(epos) {
  return String(epos || "").trim().toLowerCase();
}

async function kry_my_outeur(gebruiker) {
  if (!gebruiker || !gebruiker.id) return null;

  const store = kry_store("outeurs");

  let sleutels;
  try {
    const lys = await store.list();
    sleutels = (lys.blobs || []).map((b) => b.key);
  } catch (fout) {
    console.error("Kon nie die outeurs-register lees nie:", fout);
    return null;
  }

  const inskrywings = (
    await Promise.all(
      sleutels.map((sleutel) => store.get(sleutel, { type: "json" }).catch(() => null))
    )
  ).filter(Boolean);

  const gekoppel = inskrywings.find((i) => i.identity_id && i.identity_id === gebruiker.id);
  if (gekoppel) return gekoppel;

  const my_epos = normaliseer_epos(gebruiker.email);
  if (!my_epos) return null;

  const passend = inskrywings.filter((i) => {
    if (i.identity_id && i.identity_id !== gebruiker.id) return false;
    const epos = i.kontak_inligting && i.kontak_inligting.epos;
    return normaliseer_epos(epos) === my_epos;
  });

  if (passend.length !== 1) {
    if (passend.length > 1) {
      console.warn("Meer as een outeur-inskrywing op dieselfde e-pos — geen keuse gemaak nie");
    }
    return null;
  }

  return passend[0];
}

module.exports = { kry_my_outeur, normaliseer_epos };
