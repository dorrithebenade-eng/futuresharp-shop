// 'n Betaalde leen moet GOEDKOPER wees as die e-boek van dieselfde titel.
//
// WAAROM: paystack-webhook.js skep by elke leen 'n opgraderingskoepon met
// `afslag_waarde: item.prys_sent` — presies wat vir die leen betaal is.
// Daardie koepon word later van die e-boek se prys afgetrek. Is die leen
// ewe duur of duurder, word die e-boek gratis: begin-betaling.js se
// `Math.max(0, ...)` maak die item nul, die nul-totaal-kortpad vuur,
// Paystack word nooit geroep nie, en die bestelling word sonder verdeling
// en sonder hosting aangeteken. Die koper se oorskot verdwyn boonop
// stilweg — daar is geen krediet en geen terugbetaling nie.
//
// Die reël word by die BRON afgedwing, op skep en op wysig, sodat die
// geval nie kan ontstaan nie. Dit vang ook die stadige weergawe: 'n
// e-boekprys wat later ONDER 'n bestaande leenprys verlaag word.
//
// 'n GRATIS leen (prys 0) word oorgeslaan — 'n koepon van R0 kan niks
// breek nie, en 'n weggee-titel moet moontlik bly.

function kontroleer_leen_prys(formate) {
  const leen = (formate && formate.leen) || null;
  const eboek = (formate && formate.eboek) || null;

  if (!leen || !leen.beskikbaar) return { ok: true, fout: null };

  const leen_sent = Number(leen.prys_sent) || 0;
  const eboek_sent = Number(eboek && eboek.prys_sent) || 0;

  if (leen_sent <= 0) return { ok: true, fout: null };
  if (leen_sent < eboek_sent) return { ok: true, fout: null };

  const rand = (sent) => "R" + (sent / 100).toFixed(2);

  return {
    ok: false,
    fout:
      `Die leenprys (${rand(leen_sent)}) moet laer wees as die e-boek se prys (${rand(eboek_sent)}). ` +
      "By elke leen word 'n opgraderingskoepon geskep ter waarde van die volle leenbedrag, " +
      "wat van die e-boek se prys afgetrek word. Is die leen ewe duur of duurder, word die " +
      "e-boek gratis en die verkoop dra geen verdeling nie. Verhoog die e-boek se prys of " +
      "verlaag die leenprys.",
  };
}

module.exports = { kontroleer_leen_prys };
