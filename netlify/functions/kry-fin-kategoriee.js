// netlify/functions/kry-fin-kategoriee.js
//
// Boekhouding-beskermd — lys die finansiele kategoriee as 'n GESORTEERDE BOOM.
//
// DIE BOOM WORD HIER GEBOU, NIE OP DIE SKERM NIE.
//
// Die register, die staat en die uitvoer wys almal dieselfde boom. Sou elkeen
// hom self bou, is daar drie plekke waar 'n weeskind anders hanteer kan word
// en drie plekke om reg te maak wanneer die sortering verander.
//
// ELKE KATEGORIE DRA HAAR `vlak` EN HAAR `pad`.
//
// `vlak` is die diepte as 'n GETAL — 1 vir 'n hoofkategorie. Die uitvoer is 'n
// CSV, en 'n CSV kan nie inkeping of vetdruk dra nie. Die boekhouer sorteer en
// filter op 'n getal; op spasies kan hy nie.
//
// `pad` is "Terugbetaalde koste / Reiskoste / Petrol", vir waar 'n mens een
// reel sonder haar boom sien — 'n keuselys by 'n joernaalinskrywing, of 'n
// enkele reel in 'n soekresultaat.
//
// DIE VASTE KATEGORIEE WORD BYGEVOEG AS HULLE ONTBREEK.
//
// Diensinkomste en Paystack se transaksiefooi word deur die stelsel self
// geskryf, en die staat verwys direk na hul id's. Kom hulle nie in die store
// voor nie — 'n vars installasie, of iemand het die store leeggemaak — verskyn
// hulle STEEDS in die antwoord, en dan is die staat nie stil stukkend nie.
// Hulle word nie hier gestoor nie: 'n lees mag nie skryf nie.
//
// Die rekord gaan VOLLEDIG deur, nie veld vir veld nie. Anders is 'n nuwe veld
// op die rekord onsigbaar vir die skerm en lyk dit of die stoor misluk het —
// dieselfde les as kry-my-outeur.js.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_fin_kategoriee_store,
  VAS,
  nuwe_kategorie,
  vlak_van,
  pad_van,
  sorteer_boom,
} = require("./_fin-kategoriee");

const ROLLE = ["boekhouding"];

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  let almal = [];
  try {
    const store = kry_fin_kategoriee_store();
    const { blobs } = await store.list();
    almal = (
      await Promise.all((blobs || []).map((b) => store.get(b.key, { type: "json" })))
    ).filter(Boolean);
  } catch (fout) {
    console.error("Kon nie die finansiele kategoriee lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die kategoriee laai nie" };
  }

  // Die vaste twee, as hulle ontbreek.
  const bestaande = new Set(almal.map((k) => k.id));
  Object.keys(VAS).forEach((id) => {
    if (bestaande.has(id)) return;
    almal.push({
      ...nuwe_kategorie(),
      id,
      naam: VAS[id].naam,
      rigting: VAS[id].rigting,
      vas: true,
      nota: "Deur die stelsel geskryf.",
    });
  });

  const boom = sorteer_boom(almal).map((k) => ({
    ...k,
    vlak: vlak_van(k, almal),
    pad: pad_van(k, almal),
  }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kategoriee: boom }),
  };
};
