// netlify/functions/stoor-projek.js
//
// Boekhouding-beskermd -- skep of wysig een projek.
//
// DIE ID KOM UIT DIE NAAM EN VERANDER NOOIT. 'n Joernaalinskrywing sal na die
// id wys; 'n hernoeming mag daardie verwysing nie breek nie.
//
// ELKE BEFONDSER MOET 'N BESTAANDE KLIENT WEES. Die kontrole staan hier en
// nie net op die skerm nie: die skerm is nie die poort nie.
//
// AKTIEF BLY WAT DIT WAS. Die vorm stuur die veld nie. Heraktivering gebeur
// net deur aktiveer-projek.js, dieselfde rede as by die kategoriee.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_kliente_store } = require("./_kliente");
const {
  kry_projekte_store,
  nuwe_projek,
  skoon_befondsers,
  maak_slug,
} = require("./_projekte");

const ROLLE = ["boekhouding"];

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

  const naam = String(invoer.naam || "").trim().slice(0, 120);
  if (!naam) return { statusCode: 400, body: "Verpligte veld: naam" };

  const id = String(invoer.id || "").trim() || maak_slug(naam);
  if (!id) {
    return { statusCode: 400, body: "Kon nie 'n geldige ID van die naam aflei nie" };
  }

  const befondsers = skoon_befondsers(invoer.befondsers);
  const nota = String(invoer.nota || "").trim().slice(0, 500);

  const store = kry_projekte_store();

  let bestaande = null;
  try {
    bestaande = await store.get(id, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie projek "${id}" lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die projek laai nie" };
  }

  if (!invoer.id && bestaande) {
    return { statusCode: 409, body: `'n Projek met die naam "${naam}" bestaan reeds` };
  }
  if (invoer.id && !bestaande) {
    return { statusCode: 404, body: "Projek nie gevind nie" };
  }

  // Elke befondser moet bestaan. 'n Leesfout weier die stoor: 'n verwysing
  // na 'n kliënt wat nie bestaan nie, is erger as 'n stoor wat oorgedoen word.
  if (befondsers.length) {
    const kstore = kry_kliente_store();
    let ontbreek = [];
    try {
      const gevind = await Promise.all(
        befondsers.map((n) => kstore.get(n, { type: "json" }))
      );
      ontbreek = befondsers.filter((n, i) => !gevind[i]);
    } catch (fout) {
      console.error("Kon nie die befondsers nagaan nie:", fout);
      return {
        statusCode: 503,
        body: "Kon nie die befondsers nagaan nie. Die projek is nie gestoor nie.",
      };
    }
    // 'n Befondser wat REEDS op die projek was en intussen weg is, mag bly;
    // net 'n NUWE een moet bestaan. Anders kan 'n projek nooit weer gestoor
    // word sodra een van sy kliënte verdwyn het nie.
    const reeds = new Set((bestaande && bestaande.befondsers) || []);
    const nuut_ontbreek = ontbreek.filter((n) => !reeds.has(n));
    if (nuut_ontbreek.length) {
      return {
        statusCode: 400,
        body: `Kliënt bestaan nie: ${nuut_ontbreek.join(", ")}`,
      };
    }
  }

  const nou = new Date().toISOString();
  const rekord = {
    ...(bestaande || nuwe_projek()),
    id,
    naam,
    befondsers,
    nota,
    bygewerk_op: nou,
  };
  if (!bestaande) {
    rekord.geskep_op = nou;
    rekord.geskep_deur = gebruiker.email || "";
  }
  rekord.aktief = bestaande ? bestaande.aktief !== false : true;

  try {
    await store.setJSON(id, rekord);
  } catch (fout) {
    console.error(`Kon nie projek "${id}" stoor nie:`, fout);
    return { statusCode: 500, body: "Kon nie die projek stoor nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projek: rekord }),
  };
};
