// netlify/functions/kry-vereffenings.js
//
// Lees die gestoorde vereffenings vir 'n tydperk. Rol: boekhouding.
//
// DIE STORE WORD GELEES, NIE PAYSTACK NIE. Die afhaal skryf; hierdie lees.
// Dieselfde skeiding as by die joernaal: 'n leesoproep wat by 'n derde party
// gaan haal, is stadig en misluk om redes wat niks met die leser te doen het
// nie.
//
// DIE SLEUTEL DRA DIE FINANSIELE JAAR, dus word net die jare wat die tydperk
// raak oopgemaak, nie die hele store nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { finansiele_jaar } = require("./_joernaal");
const { kry_vereffenings_store, jaar_voorvoegsel } = require("./_vereffenings");

const ROLLE = ["boekhouding"];

function is_datum(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  const vraag = event.queryStringParameters || {};
  const van = String(vraag.van || "").trim();
  const tot = String(vraag.tot || "").trim();

  if (!is_datum(van) || !is_datum(tot)) {
    return { statusCode: 400, body: "Verpligte velde: van en tot, as JJJJ-MM-DD" };
  }

  // ROU IS VIR 'N DIAGNOSE, nie vir die skerm nie. Paystack se eie voorwerp is
  // groot, en die lys sou met 'n paar honderd vereffenings onhanteerbaar word.
  const wys_rou = String(vraag.rou || "") === "1";

  const store = kry_vereffenings_store();
  const jare = new Set([finansiele_jaar(van), finansiele_jaar(tot)].filter((j) => j != null));

  const vereffenings = [];
  const foute = [];

  for (const jaar of jare) {
    let blobs = [];
    try {
      blobs = (await store.list({ prefix: jaar_voorvoegsel(jaar) })).blobs || [];
    } catch (fout) {
      foute.push(`Jaar ${jaar}: ${fout.message || fout}`);
      continue;
    }

    for (const b of blobs) {
      let r;
      try {
        r = await store.get(b.key, { type: "json" });
      } catch (fout) {
        foute.push(`${b.key}: ${fout.message || fout}`);
        continue;
      }
      if (!r || !r.datum) continue;
      if (r.datum < van || r.datum > tot) continue;

      const uit = {
        sleutel: r.sleutel,
        paystack_id: r.paystack_id,
        datum: r.datum,
        ontvanger_kode: r.ontvanger_kode,
        ontvanger_naam: r.ontvanger_naam,
        is_hoofrekening: r.is_hoofrekening,
        // `verwerk_sent` is wat die kliënt betaal het; `bruto_sent` is wat
        // HIERDIE ontvanger daarvan kry. Laat die eerste uit, wys die skerm
        // R0,00 waar R20,00 moet staan -- en dit het presies so gebeur.
        verwerk_sent: r.verwerk_sent,
        bruto_sent: r.bruto_sent,
        fooi_sent: r.fooi_sent,
        netto_sent: r.netto_sent,
        status: r.status,
        verwysings: r.verwysings || [],
      };
      if (wys_rou) uit.rou = r.rou;

      vereffenings.push(uit);
    }
  }

  // Nuutste eerste, soos elke ander lys in die paneel.
  vereffenings.sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ van, tot, aantal: vereffenings.length, vereffenings, foute }),
  };
};
