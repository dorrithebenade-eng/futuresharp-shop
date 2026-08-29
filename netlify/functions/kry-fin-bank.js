// netlify/functions/kry-fin-bank.js
//
// Boekhouding-beskermd — gee die bankbalansse terug wat 'n tydperk se
// rekonsiliasie nodig het.
//
// TWEE BALANSSE, NIE 'N LYS NIE.
//
//   opening   die balans op die dag VOOR `van` -- die naaste een op of voor
//             daardie dag
//   sluiting  die balans op `tot` -- die naaste een op of voor daardie dag
//
// "DIE NAASTE OP OF VOOR" is doelbewus. Niemand tik 'n balans in vir elke dag
// nie. Tik 'n mens een op 28 Februarie en een op 31 Augustus, moet 'n tydperk
// van 1 Maart tot 29 Augustus steeds werk -- die sluiting is dan 28 Februarie
// s'n, wat verkeerd LYK maar reg is: daar is geen later meting nie.
//
// En dit is presies waarom die antwoord die DATUM van elke balans saamgee. Die
// skerm wys "balans op 28 Feb", nie "sluitingsbalans" nie, en dan sien 'n mens
// dadelik dat 'n nuwe meting nodig is.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fin_bank_store, is_datum } = require("./_fin-bank");

const ROLLE = ["boekhouding"];

// Die dag voor 'n datum. Werk oor maand- en jaargrense sonder 'n biblioteek.
function dag_voor(datum) {
  const d = new Date(datum + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  const v = event.queryStringParameters || {};
  if (!is_datum(v.van) || !is_datum(v.tot)) {
    return { statusCode: 400, body: "Gee 'n geldige `van` en `tot`" };
  }

  let almal = [];
  try {
    const store = kry_fin_bank_store();
    const { blobs } = await store.list();
    almal = (
      await Promise.all((blobs || []).map((b) => store.get(b.key, { type: "json" })))
    ).filter((r) => r && is_datum(r.datum));
  } catch (fout) {
    console.error("Kon nie die bankbalansse lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die bankbalansse laai nie" };
  }

  almal.sort((a, b) => a.datum.localeCompare(b.datum));

  const naaste_op_of_voor = (datum) => {
    let uit = null;
    almal.forEach((r) => {
      if (r.datum <= datum) uit = r;
    });
    return uit;
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      opening: naaste_op_of_voor(dag_voor(v.van)),
      sluiting: naaste_op_of_voor(v.tot),
      // Die volle lys gaan saam sodat die skerm kan wys watter metings bestaan
      // sonder 'n tweede oproep. Hulle is klein: een per maand, hoogstens.
      balansse: almal,
    }),
  };
};
