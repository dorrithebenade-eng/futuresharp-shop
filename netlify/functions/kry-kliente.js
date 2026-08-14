// netlify/functions/kry-kliente.js
//
// Lys die kliënte, met die duplikaat-pare wat nog nagegaan moet word.
// Rol: boekhouding.
//
// DIE PARE WORD HIER BEREKEN, nie gestoor nie — dieselfde beginsel as
// _outeur-aandeel.js. 'n Gestoorde lys duplikate en 'n herberekende lys dryf
// uiteindelik uiteen, en dan wys die skerm 'n paar wat nie meer bestaan nie.
//
// Wat WEL gestoor word, is watter pare reeds nagegaan is. Dit is 'n besluit
// wat 'n mens geneem het, nie 'n afleiding uit die data nie.
//
// LET WEL: hierdie antwoord word VELD VIR VELD gebou. 'n Nuwe veld op die
// rekord kom NIE vanself deur nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_kliente_store,
  is_onvolledig,
  kry_duplikaat_pare,
} = require("./_kliente");

const NAGEGAAN_SLEUTEL = "_nagegaan";

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  const store = kry_kliente_store();

  let sleutels = [];
  try {
    const lys = await store.list({ prefix: "K" });
    sleutels = (lys.blobs || []).map((b) => b.key);
  } catch (fout) {
    console.error("Kon nie die kliënte lys nie:", fout);
    return { statusCode: 500, body: "Kon nie die kliënte laai nie" };
  }

  const rekords = [];
  for (const sleutel of sleutels) {
    try {
      const r = await store.get(sleutel, { type: "json" });
      if (r) rekords.push(r);
    } catch (fout) {
      console.error(`Kon nie kliënt ${sleutel} lees nie:`, fout);
    }
  }

  let nagegaan = [];
  try {
    const g = await store.get(NAGEGAAN_SLEUTEL, { type: "json" });
    if (g && Array.isArray(g.pare)) nagegaan = g.pare;
  } catch (fout) {
    // Bestaan nog nie — dan is niks nagegaan nie.
  }

  const kliente = rekords.map((r) => ({
    nommer: r.nommer,
    soort: r.soort || "instansie",
    naam: r.naam || "",
    kontak: r.kontak || "",
    epos: r.epos || "",
    selfoon: r.selfoon || "",
    bron: r.bron || "paneel",
    gesien: r.gesien !== false,
    geskep_op: r.geskep_op || null,
    onvolledig: is_onvolledig(r),
    // Hoeveel fakture aan hom hang, kom later by — die faktuurregister
    // bestaan nog nie. Die veld staan hier sodat die skerm hom van die begin
    // af ken en nie later 'n vorm moet verander nie.
    fakture: 0,
  }));

  kliente.sort((a, b) => (a.naam || "").localeCompare(b.naam || "", "af-ZA"));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kliente,
      duplikate: kry_duplikaat_pare(rekords, nagegaan),
    }),
  };
};
