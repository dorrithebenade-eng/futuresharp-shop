// netlify/functions/kry-fin-bank.js
// Weergawe 2 (17 Oktober 2026): DIE BANKSTATE GAAN VOOR. Die balansse word
// uit die ingevoerde FNB-state gelees: die saldo na die laaste reel op of voor
// die datum, of die staat se opening as daar nog geen reel was nie. Eers as
// daar geen staat op of voor die datum is nie, val dit terug op 'n balans wat
// met die hand aangeteken is. Die antwoord se `bron` se watter een dit is, en
// die datum is die van die laaste reel, sodat 'n mens sien as die jongste staat
// voor die tydperk se einde ophou.
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
const B = require("./_bankstate");

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

  // DIE BANKSTATE. Toetsstate tel nie; hulle is nie Future Sharp se bank nie.
  // 'n Leesfout laat die handbalansse staan.
  let reels = [];
  let state = [];
  try {
    state = (await B.lees_almal(B.kry_bankstate_store()))
      .filter((s) => s && s.toets !== true)
      .sort((a, b) => String(a.van).localeCompare(String(b.van)));
    state.forEach((s, si) => (s.reels || []).forEach((r) => {
      if (Number.isFinite(Number(r.saldo_sent))) reels.push({ ...r, _si: si });
    }));
    reels.sort((a, b) =>
      String(a.datum).localeCompare(String(b.datum)) || a._si - b._si || a.nr - b.nr);
  } catch (fout) {
    console.error("Kon nie die bankstate vir die balansse lees nie:", fout);
    reels = [];
    state = [];
  }
  const uit_state = (datum) => {
    let laaste = null;
    for (const r of reels) { if (r.datum <= datum) laaste = r; else break; }
    // Die staat wat die datum dek; voor sy eerste reel is sy opening die balans.
    const dek = state.find((s) => s.van <= datum && s.tot >= datum);
    if (dek && (!laaste || laaste.datum < dek.van) && Number.isFinite(Number(dek.opening_sent))) {
      return { datum, balans_sent: Number(dek.opening_sent), bron: "bankstaat" };
    }
    if (!laaste) {
      // Voor die eerste staat: die rekening het niks gedoen voordat die eerste
      // staat begin nie, dus is daardie staat se opening die balans.
      const eerste = state[0];
      if (eerste && eerste.van > datum && Number.isFinite(Number(eerste.opening_sent))) {
        return { datum, balans_sent: Number(eerste.opening_sent), bron: "bankstaat" };
      }
      return null;
    }
    // Binne 'n gedekte tydperk is die balans geldig op die gevraagde datum self.
    // Na die jongste staat: die balans geld tot daardie staat se einde.
    const gedek = state.some((s) => s.van <= datum && s.tot >= datum);
    const vorige = state.filter((s) => s.tot < datum).map((s) => s.tot).sort().pop();
    return {
      datum: gedek ? datum : (vorige && vorige >= laaste.datum ? vorige : laaste.datum),
      balans_sent: Number(laaste.saldo_sent),
      bron: "bankstaat",
    };
  };

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
      opening: uit_state(dag_voor(v.van)) || naaste_op_of_voor(dag_voor(v.van)),
      sluiting: uit_state(v.tot) || naaste_op_of_voor(v.tot),
      // Die volle lys gaan saam sodat die skerm kan wys watter metings bestaan
      // sonder 'n tweede oproep. Hulle is klein: een per maand, hoogstens.
      balansse: almal,
    }),
  };
};
