// FutureSharp Talks — vind die spreker-inskrywing van die aangemelde gebruiker.
//
// Dieselfde koppeling as kry-my-outeur.js, en om dieselfde rede: 'n spreker
// het geen eie Identity-rol nie, en die e-pos is die enigste gemeenskaplike
// gegewe tot die verband een keer opgeskryf is.
//
//   1. 'n Inskrywing met identity_id == die gebruiker s'n: gebruik dit.
//   2. Andersins, op e-pos, maar net inskrywings wat nog aan niemand anders
//      gekoppel is nie. Presies een: skryf identity_id daarop.
//   3. Meer as een: skryf niks nie (409); 'n mens moet dit uitsorteer.
//
// Gee { spreker } of { status, boodskap } terug.

const { kry_store } = require("./_blob-store");

function normaliseer_epos(epos) {
  return String(epos || "").trim().toLowerCase();
}

async function kry_my_spreker(gebruiker) {
  const store = kry_store("sprekers");
  const { blobs } = await store.list();
  const almal = (await Promise.all((blobs || []).map((b) => store.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);

  const gekoppel = almal.find((s) => s.identity_id && s.identity_id === gebruiker.id);
  if (gekoppel) return { spreker: gekoppel };

  const my_epos = normaliseer_epos(gebruiker.email);
  const passend = almal.filter((s) => {
    if (s.identity_id && s.identity_id !== gebruiker.id) return false;
    return my_epos && normaliseer_epos(s.kontak_inligting && s.kontak_inligting.epos) === my_epos;
  });
  if (!passend.length) return { status: 404, boodskap: "Geen spreker-inskrywing vir hierdie rekening nie" };
  if (passend.length > 1) {
    console.warn(`Meer as een spreker met e-pos ${my_epos}: ${passend.map((s) => s.spreker_id).join(", ")}`);
    return { status: 409, boodskap: "Meer as een spreker is by hierdie e-posadres geregistreer; kontak Future Sharp" };
  }

  const spreker = { ...passend[0], identity_id: gebruiker.id, identity_gekoppel_op: new Date().toISOString() };
  try {
    await store.setJSON(spreker.spreker_id, spreker);
  } catch (fout) {
    console.error(`Kon nie identity_id op spreker ${spreker.spreker_id} skryf nie:`, fout);
  }
  return { spreker };
}

module.exports = { kry_my_spreker };
