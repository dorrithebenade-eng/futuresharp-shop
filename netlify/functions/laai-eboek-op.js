// Personeel-beskermd — laai 'n e-boek-PDF op na 'n PRIVATE Blobs-store
// ("eboeke"). In teenstelling met laai-omslag-op.js/kry-omslag.js (wat
// omslae PUBLIEK bedien), word e-boek-PDF's NOOIT direk publiek bedien
// nie — kry-eboek-inhoud.js is die enigste manier om by die inhoud te
// kom, en dit verifieer eers dat die aanvraer werklik hierdie boek
// gekoop het.
//
// STUKSGEWYSE OPLAAI: e-boek-PDF's kan maklik groter as Netlify
// Functions se ~6MB-versoekgrootte-limiet wees (Lambda-gebaseer). Die
// kliënt (paneelbord) knip die lêer daarom in klein stukke (~3MB elk)
// en stuur dit een-vir-een; ons voeg dit hier stap-vir-stap saam in 'n
// tydelike Blobs-sleutel, en "finaliseer" dit as die laaste stuk
// aankom deur dit na die regte plek te skuif.
//
// Versoek-vorm (JSON):
//   { slug, opload_id, stuk_indeks, is_laaste, data_base64 }
// - opload_id: die kliënt genereer dit self (bv. crypto.randomUUID())
//   met stuk 0, en stuur dieselfde ID vir elke volgende stuk.
// - stuk_indeks: 0-gebaseerde volgorde-nommer (net vir logging/toetsing
//   — stukke word steeds in volgorde geskryf soos hulle aankom).
// - is_laaste: true vir die finale stuk — voltooi die oplaai.
//
// Antwoord: { klaar: false } tussenin, of { klaar: true, eboek_sleutel }
// by die laaste stuk.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const MAKS_STUK_GREPE = 4 * 1024 * 1024; // 4MB ná base64-dekodering per stuk

function veilige_sleutel_gedeelte(teks) {
  return (teks || "eboek")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "eboek";
}

function tydelike_sleutel(opload_id) {
  return `_tydelik/${opload_id}`;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const { slug, opload_id, stuk_indeks, is_laaste, data_base64 } = invoer;

  if (!slug || !opload_id || typeof stuk_indeks !== "number" || !data_base64) {
    return {
      statusCode: 400,
      body: "Verpligte velde: slug, opload_id, stuk_indeks, data_base64",
    };
  }

  let nuwe_stuk;
  try {
    nuwe_stuk = Buffer.from(data_base64, "base64");
  } catch {
    return { statusCode: 400, body: "Ongeldige base64-data" };
  }

  if (nuwe_stuk.length > MAKS_STUK_GREPE) {
    return { statusCode: 413, body: "Stuk te groot — verklein die kliënt se stuk-grootte" };
  }

  const store = kry_store("eboeke");
  const tyd_sleutel = tydelike_sleutel(opload_id);

  try {
    // Stap 1: voeg hierdie stuk by wat reeds vir hierdie oplaai gestoor is.
    const bestaande = stuk_indeks === 0 ? null : await store.get(tyd_sleutel, { type: "arrayBuffer" });
    const saamgevoeg = bestaande ? Buffer.concat([Buffer.from(bestaande), nuwe_stuk]) : nuwe_stuk;

    // Eenvoudige beskerming teen 'n oplaai wat ewig aanhou groei —
    // 60MB behoort ruim genoeg te wees vir enige realistiese e-boek-PDF.
    if (saamgevoeg.length > 60 * 1024 * 1024) {
      await store.delete(tyd_sleutel);
      return { statusCode: 413, body: "PDF is te groot — maksimum 60MB" };
    }

    if (!is_laaste) {
      await store.set(tyd_sleutel, saamgevoeg);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klaar: false }),
      };
    }

    // Laaste stuk: bevestig dit lyk soos 'n geldige PDF, skuif dit na sy
    // finale, permanente sleutel, en maak die tydelike een skoon.
    if (saamgevoeg.slice(0, 4).toString("ascii") !== "%PDF") {
      await store.delete(tyd_sleutel);
      return { statusCode: 400, body: "Saamgevoegde lêer lyk nie soos 'n geldige PDF nie" };
    }

    const finale_sleutel = `${veilige_sleutel_gedeelte(slug)}-${Date.now()}.pdf`;
    await store.set(finale_sleutel, saamgevoeg, { metadata: { inhoud_tipe: "application/pdf" } });
    await store.delete(tyd_sleutel);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ klaar: true, eboek_sleutel: finale_sleutel }),
    };
  } catch (fout) {
    console.error("Kon nie e-boek-stuk verwerk nie:", fout);
    return { statusCode: 500, body: "Kon nie PDF-stuk stoor nie" };
  }
};
