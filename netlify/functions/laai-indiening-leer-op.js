// netlify/functions/laai-indiening-leer-op.js
//
// Die outeur se manuskrip en omslag, stuksgewys ontvang.
//
// WAAROM NIE laai-eboek-op.js NIE: daardie een vereis die PERSONEEL-rol en
// skryf reguit in die `eboeke`-store — die katalogus se eie plek. 'n Outeur
// se lêer mag nie daar wees voordat dit goedgekeur is nie. Hierdie Function
// skryf dus na `indienings-leers`, en die goedkeuring is die brug: dan word
// die lêer na `eboeke`/`omslae` geskuif, met die bestaande Functions.
//
// DIE SLEUTEL IS DIE VORMNOMMER: `BV-2026-0026/manuskrip.pdf`. Dit beteken
// 'n tweede poging skryf bo-oor die eerste en laat niks agter nie — daar is
// geen opruiming van mislukte oplaaie nodig nie.
//
// STUKSGEWYS, want 'n Netlify Function se versoek is tot sowat 6MB beperk.
// Die kliënt knip die lêer in stukke van 3MB en stuur hulle een vir een;
// ons voeg hulle in 'n tydelike sleutel saam en skuif dit na sy finale plek
// wanneer die laaste stuk aankom. Dieselfde patroon as laai-eboek-op.js.
// 'n Omslag pas in één stuk, maar loop deur dieselfde pad — een kodepad is
// makliker om reg te hou as twee.
//
// Versoek (JSON):
//   { nommer, soort, opload_id, stuk_indeks, is_laaste, data_base64,
//     inhoud_tipe, naam }
//   soort: "manuskrip" of "omslag"
//   inhoud_tipe: slegs by die omslag nodig
//   naam: die oorspronklike lêernaam, sodat die outeur later sien wat hy
//         gestuur het
//
// Antwoord: { klaar: false } tussenin, of { klaar: true, sleutel, ... }
//
// ROL: "koper". 'n Outeur is in Identity se oë 'n gewone koper; die
// werklike grens is dat die vorm aan hom moet behoort.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_my_outeur } = require("./_my-outeur");
const { kry_indienings_store, voeg_geskiedenis_by, is_myne } = require("./_indienings");

const LEERS_STORE = "indienings-leers";

const MAKS_STUK_GREPE = 4 * 1024 * 1024; // 4MB ná base64-dekodering
const MAKS_MANUSKRIP = 60 * 1024 * 1024;
const MAKS_OMSLAG = 4 * 1024 * 1024;

const BEELD_TIPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// 'n Vormnommer is `BV-2026-0026` en niks anders nie. Dit word in 'n
// Blob-sleutel ingevoeg, so dit word getoets eerder as vertrou.
function nommer_is_geldig(nommer) {
  return /^BV-\d{4}-\d{4}$/.test(String(nommer || ""));
}

function tydelike_sleutel(nommer, opload_id) {
  const skoon_id = String(opload_id).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
  return `_tydelik/${nommer}/${skoon_id}`;
}

// Net die naam, sonder 'n pad, en kort genoeg om te wys.
function skoon_naam(naam) {
  return String(naam || "")
    .split(/[\\/]/)
    .pop()
    .slice(0, 120);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Slegs POST" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: "Meld eers aan" };
  }

  const outeur = await kry_my_outeur(gebruiker);
  if (!outeur) {
    return { statusCode: 403, body: "Hierdie rekening is nie as 'n outeur geregistreer nie" };
  }

  let versoek;
  try {
    versoek = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige versoek" };
  }

  const { nommer, soort, opload_id, stuk_indeks, is_laaste, data_base64, inhoud_tipe, naam } =
    versoek;

  if (!nommer_is_geldig(nommer)) {
    return { statusCode: 400, body: "Ongeldige vormnommer" };
  }
  if (soort !== "manuskrip" && soort !== "omslag") {
    return { statusCode: 400, body: "Onbekende soort lêer" };
  }
  if (!opload_id || typeof stuk_indeks !== "number" || !data_base64) {
    return { statusCode: 400, body: "Verpligte velde: opload_id, stuk_indeks, data_base64" };
  }
  if (soort === "omslag" && !BEELD_TIPES[inhoud_tipe]) {
    return { statusCode: 400, body: "Slegs JPEG, PNG, WEBP of GIF-beelde word toegelaat" };
  }

  // --- Behoort hierdie vorm aan hierdie outeur, en mag hy hom nog aanraak? ---

  const indienings = kry_indienings_store();
  let rekord;
  try {
    rekord = await indienings.get(nommer, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die indiening lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die lêer stoor nie" };
  }

  if (!rekord) {
    return { statusCode: 404, body: "Hierdie vorm bestaan nie" };
  }
  if (!is_myne(rekord, outeur)) {
    return { statusCode: 403, body: "Hierdie vorm behoort nie aan hierdie rekening nie" };
  }

  // 'n Ingediende rekord is toe — dieselfde reël as stoor-indiening.js. 'n
  // Boek op die rak mag wel 'n nuwe lêer kry; dit hoort by die hangende
  // wysiging en word eers by goedkeuring lewendig.
  if (rekord.stand === "ingedien" || rekord.stand === "wysiging") {
    return {
      statusCode: 409,
      body: "Hierdie vorm is ingedien. Onttrek dit eers as jy 'n ander lêer wil stuur.",
    };
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

  const maks = soort === "manuskrip" ? MAKS_MANUSKRIP : MAKS_OMSLAG;
  const store = kry_store(LEERS_STORE);
  const tyd_sleutel = tydelike_sleutel(nommer, opload_id);

  try {
    const bestaande =
      stuk_indeks === 0 ? null : await store.get(tyd_sleutel, { type: "arrayBuffer" });
    const saamgevoeg = bestaande
      ? Buffer.concat([Buffer.from(bestaande), nuwe_stuk])
      : nuwe_stuk;

    if (saamgevoeg.length > maks) {
      await store.delete(tyd_sleutel);
      return {
        statusCode: 413,
        body:
          soort === "manuskrip"
            ? "Die manuskrip is te groot — hoogstens 60MB"
            : "Die omslag is te groot — hoogstens 4MB",
      };
    }

    if (!is_laaste) {
      await store.set(tyd_sleutel, saamgevoeg);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klaar: false }),
      };
    }

    // --- Die laaste stuk: toets, skuif, en teken aan ---

    if (soort === "manuskrip" && saamgevoeg.slice(0, 4).toString("ascii") !== "%PDF") {
      await store.delete(tyd_sleutel);
      return { statusCode: 400, body: "Die saamgevoegde lêer lyk nie soos 'n geldige PDF nie" };
    }

    const uitbreiding = soort === "manuskrip" ? "pdf" : BEELD_TIPES[inhoud_tipe];
    const finale_sleutel = `${nommer}/${soort}.${uitbreiding}`;
    const tipe = soort === "manuskrip" ? "application/pdf" : inhoud_tipe;

    await store.set(finale_sleutel, saamgevoeg, { metadata: { inhoud_tipe: tipe } });
    await store.delete(tyd_sleutel);

    // Die rekord dra wat gestuur is, sodat die outeur dit sien en die
    // goedkeuringskerm dit kan haal. Die lêer self bly in Blobs.
    const inskrywing = {
      sleutel: finale_sleutel,
      naam: skoon_naam(naam),
      grootte: saamgevoeg.length,
      inhoud_tipe: tipe,
      op: new Date().toISOString(),
    };

    try {
      // Vars gelees: die outeur kon intussen die ander lêer klaar opgelaai het.
      const vars = (await indienings.get(nommer, { type: "json" })) || rekord;
      if (!vars.leers || typeof vars.leers !== "object") vars.leers = {};
      vars.leers[soort] = inskrywing;
      vars.gewysig_op = inskrywing.op;
      voeg_geskiedenis_by(
        vars,
        soort === "manuskrip" ? "manuskrip opgelaai" : "omslag opgelaai",
        gebruiker.email || outeur.naam || "",
        inskrywing.naam
      );
      await indienings.setJSON(nommer, vars);
    } catch (fout) {
      // Die lêer is veilig; net die aantekening het misluk. Dit is nie 'n
      // rede om die outeur se oplaai af te keur nie — hy sou hom weer moes
      // stuur vir niks.
      console.error("Lêer is gestoor maar die rekord kon nie bygewerk word nie:", fout);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ klaar: true, ...inskrywing }),
    };
  } catch (fout) {
    console.error("Kon nie die stuk verwerk nie:", fout);
    return { statusCode: 500, body: "Kon nie die lêer stoor nie" };
  }
};
