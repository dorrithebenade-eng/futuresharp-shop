// netlify/functions/merk-bankversoek-gedoen.js
//
// Die personeelkant van 'n bankversoek: skryf die nuwe besonderhede op die
// outeursrekord en vee die versoek skoon.
//
// DIT VERANDER NIKS BY DIE BETAALDIENS NIE. Die geld volg die rekening wat
// BINNE die betaaldiens aan die outeur se subrekening gekoppel is, en dit
// word met die hand daar verander. Hierdie Function TEKEN AAN dat daardie
// werk gedoen is.
//
// DAAROM IS `bevestig` VERPLIG. Die skerm hou die knoppie dof tot die
// merkblokkie afgemerk is, maar 'n UI-reël is nie 'n reël nie. Word die
// rekord gemerk terwyl die betaaldiens nog die ou rekening het, sê die
// skerm vir die outeur sy geld gaan na 'n rekening waarheen dit nie gaan
// nie, en die versoek is van die lys af — niemand sien dit tot die
// volgende uitbetaling nie.
//
// DIE OU BESONDERHEDE BLY IN DIE GESKIEDENIS. 'n Uitbetaling wat verkeerd
// geloop het, word later teen hierdie ry opgelos: wat was daar, wat het dit
// geword, wanneer, en deur wie.

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

  const outeur_id = (invoer.outeur_id || "").trim();
  if (!outeur_id) {
    return { statusCode: 400, body: "Verpligte veld: outeur_id" };
  }

  if (invoer.bevestig !== true) {
    return {
      statusCode: 400,
      body: "Bevestig eers dat die rekening by die betaaldiens verander is",
    };
  }

  const store = kry_store("outeurs");

  let bestaande;
  try {
    bestaande = await store.get(outeur_id, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie outeur ${outeur_id} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die rekord bywerk nie" };
  }

  if (!bestaande) {
    return { statusCode: 404, body: `Geen inskrywing met ID "${outeur_id}" gevind nie` };
  }

  const versoek = bestaande.bank_versoek;
  if (!versoek) {
    return { statusCode: 409, body: "Daar is geen hangende versoek nie" };
  }

  const ou = bestaande.kontak_inligting || {};
  const nou = new Date().toISOString();

  const bygewerk = {
    ...bestaande,
    kontak_inligting: {
      ...ou,
      bank_naam: versoek.bank_naam || "",
      bank_tak_kode: versoek.bank_tak_kode || "",
      bank_rekeningnommer: versoek.bank_rekeningnommer || "",
      bank_rekeninghouer: versoek.houer || "",
    },
    bank_geskiedenis: [
      ...(bestaande.bank_geskiedenis || []),
      {
        op: nou,
        deur: gebruiker.email || "",
        versoek_op: versoek.versoek_op || null,
        van: {
          bank_naam: ou.bank_naam || "",
          bank_tak_kode: ou.bank_tak_kode || "",
          bank_rekeningnommer: ou.bank_rekeningnommer || "",
        },
        na: {
          bank_naam: versoek.bank_naam || "",
          bank_tak_kode: versoek.bank_tak_kode || "",
          bank_rekeningnommer: versoek.bank_rekeningnommer || "",
        },
      },
    ],
    gewysig_op: nou,
    gewysig_deur: gebruiker.email || "",
  };

  delete bygewerk.bank_versoek;

  try {
    await store.setJSON(outeur_id, bygewerk);
  } catch (fout) {
    console.error(`Kon nie outeur ${outeur_id} stoor nie:`, fout);
    return { statusCode: 500, body: "Kon nie die rekord bywerk nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, outeur_id, gedoen_op: nou }),
  };
};
