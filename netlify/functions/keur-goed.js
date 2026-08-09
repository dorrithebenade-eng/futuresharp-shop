// netlify/functions/keur-goed.js
//
// Keur 'n indiening goed. Dit BEREI VOOR; dit publiseer nie.
//
// WAT HIER GEBEUR: die manuskrip en die omslag word uit `indienings-leers`
// na `eboeke` en `omslae` geskuif — dieselfde stores en dieselfde
// sleutelvorm as laai-eboek-op.js en laai-omslag-op.js. Daarna dra die
// rekord 'n `eboek_sleutel` en 'n `omslag`-pad, presies wat skep-produk.js
// verwag.
//
// WAT HIER NIE GEBEUR NIE: geen produk word geskep nie. Die boek gaan op
// die rak wanneer die produkvorm gestoor word, met sy volle validering —
// die prys, die verdeling, die Paystack-minimum. 'n Knoppie wat stilweg 'n
// produk skep, sou daardie validering omseil, en dan is dit 'n outeur wat
// die fout sien.
//
// DIE STAND WORD `goedgekeur`, nie `op_rak` nie. Dit is 'n werklike vyfde
// toestand: goedgekeur, lêers geskuif, wag om opgestel te word. Sonder dit
// sou 'n boek as "op die rak" gelys word terwyl hy nog nêrens is nie.
// (Teenoor `onttrek`, wat GEEN aparte stand kry nie, want dit verskil in
// niks van 'n konsep.)
//
// 'N WYSIGING WERK ANDERS: daar is reeds 'n produk. Die hangende voorstel
// word die lewendige data en die stand gaan terug na `op_rak`. Die winkel
// self verander eers wanneer die produkvorm gestoor word.
//
// 'N WYSIGING RAAK NOOIT DIE LEERS NIE. Wat gewysig kan word, is die
// formate en die prys — 'n harde kopie by of af, 'n e-boek by of af, Leen
// aan of af. 'n Nuwe manuskrip of omslag is 'n nuwe boekopstelling en gaan
// as 'n NUWE indiening in, met sy eie vormnommer.
//
// Daarom loop die kopieerblok slegs by 'n EERSTE goedkeuring. Het hy ook by
// 'n wysiging geloop, sou elke goedgekeurde wysiging 'n tweede afskrif van
// dieselfde manuskrip in `eboeke` gemaak het — tot 60MB elk — waarna die
// produk steeds na die eerste afskrif wys. Die nuwe afskrif doen niks
// behalwe plek opneem.
//
// `bywerking_wagtend` MERK 'n goedgekeurde wysiging wat nog nie in die
// produk beland het nie. Sonder dit staan die indiening op `op_rak`, net
// soos elke ander boek op die rak, en die Werk by-knoppie weet nie by watter
// een hy hoort nie. Die merk leef op die INDIENING, nooit op die produk nie:
// die winkel dra geen inligting oor wat in die paneelbord hanteer word nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_indienings_store, voeg_geskiedenis_by } = require("./_indienings");

const LEERS_STORE = "indienings-leers";

const UITBREIDINGS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function nommer_is_geldig(nommer) {
  return /^BV-\d{4}-\d{4}$/.test(String(nommer || ""));
}

// Dieselfde vorm as laai-eboek-op.js se veilige_sleutel_gedeelte.
function veilige_sleutel_gedeelte(teks) {
  return String(teks || "boek")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "boek";
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Slegs POST" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  let versoek;
  try {
    versoek = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige versoek" };
  }

  if (!nommer_is_geldig(versoek.nommer)) {
    return { statusCode: 400, body: "Ongeldige vormnommer" };
  }

  const indienings = kry_indienings_store();

  let rekord;
  try {
    rekord = await indienings.get(versoek.nommer, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die indiening lees nie:", fout);
    return { statusCode: 500, body: "Kon nie goedkeur nie" };
  }

  if (!rekord) {
    return { statusCode: 404, body: "Hierdie vorm bestaan nie" };
  }
  if (rekord.stand !== "ingedien" && rekord.stand !== "wysiging") {
    return { statusCode: 409, body: "Slegs 'n ingediende vorm kan goedgekeur word" };
  }

  const is_wysiging = rekord.stand === "wysiging";
  const inhoud = is_wysiging ? rekord.hangend : rekord.data;
  const slug = veilige_sleutel_gedeelte((inhoud && inhoud.titel) || rekord.nommer);

  // --- Die lêers skuif ---
  //
  // KOPIEER, moenie skuif nie. Die indiening bly staan as rekord van wat
  // verskaf is; dit is wat later 'n dispuut oplos. 'n Lêer wat weg is,
  // maak daardie rekord halfleeg.

  const leers = rekord.leers || {};
  const uitslag = { eboek_sleutel: rekord.eboek_sleutel || null, omslag: rekord.omslag || null };

  // SLEGS by 'n eerste goedkeuring. By 'n wysiging bly `eboek_sleutel` en
  // `omslag` presies soos hulle is — die produk wys reeds daarheen.
  if (!is_wysiging) {
  const bron = kry_store(LEERS_STORE);

  try {
    if (leers.manuskrip && leers.manuskrip.sleutel) {
      const data = await bron.get(leers.manuskrip.sleutel, { type: "arrayBuffer" });
      if (data) {
        const sleutel = `${slug}-${Date.now()}.pdf`;
        await kry_store("eboeke").set(sleutel, Buffer.from(data), {
          metadata: { inhoud_tipe: "application/pdf" },
        });
        uitslag.eboek_sleutel = sleutel;
      }
    }

    if (leers.omslag && leers.omslag.sleutel) {
      const data = await bron.get(leers.omslag.sleutel, { type: "arrayBuffer" });
      if (data) {
        const tipe = leers.omslag.inhoud_tipe || "image/jpeg";
        const sleutel = `${slug}-${Date.now()}.${UITBREIDINGS[tipe] || "jpg"}`;
        await kry_store("omslae").set(sleutel, Buffer.from(data), {
          metadata: { inhoud_tipe: tipe },
        });
        uitslag.omslag = `/.netlify/functions/kry-omslag?bestand=${encodeURIComponent(sleutel)}`;
      }
    }
  } catch (fout) {
    console.error("Kon nie die lêers oordra nie:", fout);
    return { statusCode: 500, body: "Kon nie die lêers na die katalogus oordra nie" };
  }
  }

  // --- Die rekord ---

  const nou = new Date().toISOString();

  if (is_wysiging) {
    // Die voorstel word die waarheid. Die winkel verander eers wanneer die
    // produkvorm gestoor word.
    rekord.data = rekord.hangend;
    rekord.hangend = null;
    rekord.stand = "op_rak";
    rekord.bywerking_wagtend = true;
  } else {
    rekord.stand = "goedgekeur";
    rekord.bywerking_wagtend = false;
  }

  rekord.eboek_sleutel = uitslag.eboek_sleutel;
  rekord.omslag = uitslag.omslag;
  rekord.goedgekeur_op = nou;
  rekord.gewysig_op = nou;
  rekord.opmerking = "";

  voeg_geskiedenis_by(
    rekord,
    is_wysiging ? "wysiging goedgekeur" : "goedgekeur",
    gebruiker.email || "",
    ""
  );

  try {
    await indienings.setJSON(rekord.nommer, rekord);
  } catch (fout) {
    console.error("Kon nie die goedkeuring stoor nie:", fout);
    return { statusCode: 500, body: "Die lêers is oorgedra maar die stand kon nie stoor nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nommer: rekord.nommer,
      stand: rekord.stand,
      bywerking_wagtend: rekord.bywerking_wagtend,
      eboek_sleutel: uitslag.eboek_sleutel,
      omslag: uitslag.omslag,
    }),
  };
};
