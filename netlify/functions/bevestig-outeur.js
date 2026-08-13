// netlify/functions/bevestig-outeur.js
//
// Future Sharp se kant van die ooreenkoms.
//
// KLOUSULE 14: die outeur onderteken elektronies wanneer hy registreer;
// Future Sharp aanvaar wanneer die registrasie BEVESTIG word. Hierdie
// Function is daardie oomblik. Sonder dit dra die rekord net een
// handtekening en is die ooreenkoms eensydig.
//
// DIT IS NIE 'n MERKBLOKKIE NIE. Die naam van die persoon wat bevestig,
// gaan op die rekord, saam met die datum. Wie later vra wie namens Future
// Sharp geteken het, kry 'n antwoord.
//
// WAT DIT NIE DOEN NIE: dit skep geen Paystack-subrekening nie en stuur
// geen e-pos nie. Die subrekening word met die hand opgestel en die kode
// in die register ingevoer; hierdie knoppie sê net dat dit gedoen is en
// dat Future Sharp die ooreenkoms aanvaar. Twee dinge in een knoppie sou
// beteken 'n mens kan later nie sê watter een gebeur het nie.
//
// EEN KEER. 'n Tweede bevestiging word geweier — 'n datum wat oorgeskryf
// kan word, is nie 'n rekord nie.
//
// Versoek: POST { outeur_id }
// ROL: personeel

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Slegs POST" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige versoek" };
  }

  const outeur_id = String(invoer.outeur_id || "").trim();
  if (!/^[a-z0-9-]{1,120}$/.test(outeur_id)) {
    return { statusCode: 400, body: "Ongeldige outeur" };
  }

  const store = kry_store("outeurs");

  let outeur;
  try {
    outeur = await store.get(outeur_id, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die outeur lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die bevestiging stoor nie" };
  }

  if (!outeur) {
    return { statusCode: 404, body: "Hierdie outeur bestaan nie" };
  }

  // Daar moet iets wees om te bevestig. 'n Outeur wat met die hand
  // bygevoeg is, het nooit geteken nie, en Future Sharp kan nie 'n
  // ooreenkoms aanvaar wat nie bestaan nie.
  if (!outeur.ooreenkoms || !outeur.ooreenkoms.aanvaar_op) {
    return {
      statusCode: 409,
      body: "Hierdie outeur het nie 'n ondertekende ooreenkoms nie",
    };
  }

  if (outeur.ooreenkoms.bevestig_op) {
    return { statusCode: 409, body: "Hierdie registrasie is reeds bevestig" };
  }

  const nou = new Date().toISOString();
  const bevestig_deur = gebruiker.email || "";

  const bygewerk = {
    ...outeur,
    ooreenkoms: {
      ...outeur.ooreenkoms,
      bevestig_op: nou,
      bevestig_deur,
    },
    gewysig_op: nou,
    gewysig_deur: bevestig_deur,
  };

  try {
    await store.setJSON(outeur_id, bygewerk);
  } catch (fout) {
    console.error("Kon nie die bevestiging stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die bevestiging stoor nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, bevestig_op: nou, bevestig_deur }),
  };
};
