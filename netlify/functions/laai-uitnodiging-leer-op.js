// netlify/functions/laai-uitnodiging-leer-op.js
//
// Die bankbrief en die ID-afskrif wat by die uitnodigingsvorm aangeheg word.
//
// WAAROM NIE laai-indiening-leer-op.js NIE: daardie een vereis 'n aangemelde
// koper en 'n bestaande outeursrekord. Hier bestaan nog nie een van die twee
// nie — die persoon is besig om te registreer. Die enigste ding wat op
// hierdie oomblik bestaan, is die uitnodigingstoken.
//
// DIE TOKEN IS DUS DIE MAGTIGING, en dit word streng gehanteer:
//   - hy moet bestaan, nog "hangend" wees, en nog nie verval het nie
//   - slegs TWEE soorte lêers kan geskryf word, met vaste sleutels
//   - 5MB elk, en die inhoud word getoets, nie net die aangemelde tipe nie
// Daar is dus geen manier om hierdie eindpunt as 'n oop lêerstoor te gebruik
// nie: 'n geldige, ongebruikte, onverlope token gee toegang tot presies twee
// sleutels wat bo-oor mekaar skryf.
//
// DIE SLEUTEL IS DIE TOKEN: `<token>/bankbrief.pdf`. Dieselfde gevolg as by
// die indienings — 'n tweede poging skryf bo-oor die eerste en laat niks
// agter nie.
//
// GEVOELIGE DATA. 'n ID-afskrif en 'n bankbrief is van 'n ander orde as 'n
// manuskrip. Hierdie store is NOOIT publiek nie en word slegs deur 'n
// Function met 'n rolkontrole gelees. Verlaat iemand die vorm halfpad, bly
// die lêer teen 'n token wat verval; skrap-uitnodiging.js ruim hom op.
//
// Versoek (JSON):
//   { token, soort, opload_id, stuk_indeks, is_laaste, data_base64,
//     inhoud_tipe, naam }
//   soort: "bankbrief" of "idafskrif"
//
// Antwoord: { klaar: false } tussenin, of { klaar: true, ... }

const { kry_store } = require("./_blob-store");
const { is_verval } = require("./_uitnodiging-geldig");

const LEERS_STORE = "uitnodiging-leers";

const MAKS_STUK_GREPE = 4 * 1024 * 1024; // 4MB ná base64-dekodering
const MAKS_LEER = 5 * 1024 * 1024;

const SOORTE = ["bankbrief", "idafskrif"];

const TOEGELATE_TIPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Die token kom uit crypto.randomBytes(24).toString("hex") — 48 heksadesimale
// karakters, niks anders nie. Dit word in 'n Blob-sleutel ingevoeg, dus word
// dit getoets eerder as vertrou.
function token_is_geldig(token) {
  return /^[a-f0-9]{48}$/.test(String(token || ""));
}

// Die aangemelde inhoudstipe is die kliënt se woord. Die eerste grepe is die
// lêer se eie. Stem hulle nie ooreen nie, is iets verkeerd.
function inhoud_pas_by_tipe(buffer, tipe) {
  if (tipe === "application/pdf") {
    return buffer.slice(0, 4).toString("ascii") === "%PDF";
  }
  if (tipe === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8;
  }
  if (tipe === "image/png") {
    return buffer.slice(0, 8).toString("hex") === "89504e470d0a1a0a";
  }
  if (tipe === "image/webp") {
    return (
      buffer.slice(0, 4).toString("ascii") === "RIFF" &&
      buffer.slice(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

function tydelike_sleutel(token, opload_id) {
  const skoon_id = String(opload_id).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
  return `_tydelik/${token}/${skoon_id}`;
}

function skoon_naam(naam) {
  return String(naam || "").split(/[\\/]/).pop().slice(0, 120);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Slegs POST" };
  }

  let versoek;
  try {
    versoek = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige versoek" };
  }

  const { token, soort, opload_id, stuk_indeks, is_laaste, data_base64, inhoud_tipe, naam } =
    versoek;

  if (!token_is_geldig(token)) {
    return { statusCode: 400, body: "Ongeldige skakel" };
  }
  if (!SOORTE.includes(soort)) {
    return { statusCode: 400, body: "Onbekende soort lêer" };
  }
  if (!opload_id || typeof stuk_indeks !== "number" || !data_base64) {
    return { statusCode: 400, body: "Verpligte velde: opload_id, stuk_indeks, data_base64" };
  }
  if (!TOEGELATE_TIPES[inhoud_tipe]) {
    return { statusCode: 400, body: "Slegs 'n PDF, JPEG, PNG of WEBP word toegelaat" };
  }

  // --- Is die skakel nog lewendig? ---

  const uitnodigings = kry_store("uitnodigings");
  let uitnodiging;
  try {
    uitnodiging = await uitnodigings.get(token, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die uitnodiging lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die lêer stoor nie" };
  }

  if (!uitnodiging) {
    return { statusCode: 404, body: "Hierdie skakel is nie geldig nie" };
  }
  if (uitnodiging.status !== "hangend") {
    return { statusCode: 409, body: "Hierdie skakel is reeds voltooi" };
  }
  if (is_verval(uitnodiging)) {
    return { statusCode: 410, body: "Hierdie skakel het verval" };
  }

  // --- Die stuk self ---

  let nuwe_stuk;
  try {
    nuwe_stuk = Buffer.from(data_base64, "base64");
  } catch {
    return { statusCode: 400, body: "Ongeldige base64-data" };
  }

  if (nuwe_stuk.length > MAKS_STUK_GREPE) {
    return { statusCode: 413, body: "Stuk te groot — verklein die kliënt se stuk-grootte" };
  }

  const store = kry_store(LEERS_STORE);
  const tyd_sleutel = tydelike_sleutel(token, opload_id);

  try {
    const bestaande =
      stuk_indeks === 0 ? null : await store.get(tyd_sleutel, { type: "arrayBuffer" });
    const saamgevoeg = bestaande
      ? Buffer.concat([Buffer.from(bestaande), nuwe_stuk])
      : nuwe_stuk;

    if (saamgevoeg.length > MAKS_LEER) {
      await store.delete(tyd_sleutel);
      return { statusCode: 413, body: "Die lêer is te groot — hoogstens 5MB" };
    }

    if (!is_laaste) {
      await store.set(tyd_sleutel, saamgevoeg);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klaar: false }),
      };
    }

    // --- Die laaste stuk: toets die inhoud, skryf, en teken aan ---

    if (!inhoud_pas_by_tipe(saamgevoeg, inhoud_tipe)) {
      await store.delete(tyd_sleutel);
      return { statusCode: 400, body: "Die lêer se inhoud pas nie by sy tipe nie" };
    }

    const uitbreiding = TOEGELATE_TIPES[inhoud_tipe];
    const finale_sleutel = `${token}/${soort}.${uitbreiding}`;

    await store.set(finale_sleutel, saamgevoeg, { metadata: { inhoud_tipe } });
    await store.delete(tyd_sleutel);

    const inskrywing = {
      sleutel: finale_sleutel,
      naam: skoon_naam(naam),
      grootte: saamgevoeg.length,
      inhoud_tipe,
      op: new Date().toISOString(),
    };

    try {
      // Vars gelees: die ander lêer kon intussen klaar opgelaai het.
      const vars = (await uitnodigings.get(token, { type: "json" })) || uitnodiging;
      if (!vars.leers || typeof vars.leers !== "object") vars.leers = {};
      vars.leers[soort] = inskrywing;
      await uitnodigings.setJSON(token, vars);
    } catch (fout) {
      // Die lêer is veilig; net die aantekening het misluk. Dit is nie 'n
      // rede om die oplaai af te keur nie — hy sou hom weer moes stuur.
      console.error("Lêer is gestoor maar die uitnodiging kon nie bygewerk word nie:", fout);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        klaar: true,
        soort,
        naam: inskrywing.naam,
        grootte: inskrywing.grootte,
      }),
    };
  } catch (fout) {
    console.error("Kon nie die lêer stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die lêer stoor nie" };
  }
};
