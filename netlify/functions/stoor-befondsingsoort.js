// netlify/functions/stoor-befondsingsoort.js
//
// Boekhouding-beskermd -- skep of wysig een befondsingsoort.
//
// Die id kom uit die naam en verander nooit; 'n toekenning sal daarheen wys.
// Die twee lyste word in hul geheel vervang deur wat die vorm stuur, met die
// bestaande items se id's behou. Aktief kom nie van die vorm nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_soorte_store, saai, skoon_items, maak_slug } = require("./_befondsingsoorte");

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

  const naam = String(invoer.naam || "").trim().slice(0, 120);
  if (!naam) return { statusCode: 400, body: "Verpligte veld: naam" };
  const id = String(invoer.id || "").trim() || maak_slug(naam);
  if (!id || id.startsWith("_")) return { statusCode: 400, body: "Ongeldige naam" };

  const store = kry_soorte_store();
  let bestaande;
  try {
    await saai(store);
    bestaande = await store.get(id, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die befondsingsoorte voorberei nie:", fout);
    return { statusCode: 500, body: "Kon nie die befondsingsoorte laai nie" };
  }
  if (!invoer.id && bestaande) {
    return { statusCode: 409, body: `'n Befondsingsoort met die naam "${naam}" bestaan reeds` };
  }
  if (invoer.id && !bestaande) {
    return { statusCode: 404, body: "Befondsingsoort nie gevind nie" };
  }

  const nou = new Date().toISOString();
  const rekord = {
    ...(bestaande || {
      id,
      aktief: true,
      voorgelaai: false,
      geskep_op: nou,
      geskep_deur: gebruiker.email || "",
    }),
    id,
    naam,
    vereis_18a: invoer.vereis_18a === true,
    uitreik: skoon_items(invoer.uitreik, false),
    rekords: skoon_items(invoer.rekords, true),
    nota: String(invoer.nota || "").trim().slice(0, 500),
    bygewerk_op: nou,
  };
  rekord.aktief = bestaande ? bestaande.aktief !== false : true;

  try {
    await store.setJSON(id, rekord);
  } catch (fout) {
    console.error(`Kon nie befondsingsoort "${id}" stoor nie:`, fout);
    return { statusCode: 500, body: "Kon nie die befondsingsoort stoor nie" };
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ soort: rekord }),
  };
};
