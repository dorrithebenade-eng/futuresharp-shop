// netlify/functions/_betaal-url.js
//
// Die adres wat die kliënt kry om sy faktuur te betaal.
//
// ─────────────────────────────────────────────────────────────────────────
// WAAROM DIT NIE PAYSTACK SE ADRES IS NIE
//
// Paystack se toegangskode leef nie so lank as 'n faktuur se betaaltermyn
// nie. Tot 24 September 2026 het die proforma-pos, die PDF, die QR en die
// strook op die skerm die checkout.paystack.com-adres DIREK gedra. Daardie
// string gaan dood terwyl hy in die kliënt se inboks lê, en niks wat ons aan
// ons kant doen, kan dit regmaak nie: die dooie skakel is by hom, nie by ons
// nie.
//
// FS/01962 en FS/01963 het albei op 22 September so gestaan. Albei
// transaksies was "Abandoned"; geen geld het gekom nie, en die kliënt het
// "We could not start this transaction" gesien.
//
// Hierdie adres verwys net na 'n faktuur. Daar is niks aan om te verval nie.
// begin-faktuur-betaling.js vra die Paystack-skakel op die oomblik dat iemand
// klik, en dit is dan sekondes oud.
// ─────────────────────────────────────────────────────────────────────────
//
// EEN PLEK, VIER LESERS. Die proforma-pos, die PDF, die QR en die skerm moet
// almal presies dieselfde string dra. Elkeen wat dit self saamstel, is 'n
// plek waar hulle uitmekaar kan dryf.
//
// ALBEI DELE IS NODIG. Die sleutel vind die rekord; die kode bewys dat die
// persoon die skakel werklik ontvang het. Sonder die kode sou 'n mens by
// FS-01957 kon begin en deur die reeks loop. Dieselfde paar as op
// betaal-klaar.html.

const { nommer_na_sleutel } = require("./_fakture");

function teks(waarde) {
  return String(waarde == null ? "" : waarde).trim();
}

// Gee null terug wanneer daar niks te betaal is nie, en die aanroeper moet
// daarop toets. 'n String wat "gaan betaal" sê en na niks lei, is erger as
// geen skakel.
//
// NULL WANNEER:
//   * die faktuur nog geen publieke kode het nie (sy is 'n konsep)
//   * sy met die hand betaal word (geen Paystack-transaksie bestaan)
// DIE SLEUTEL IS OPSIONEEL. Nie elke aanroeper het hom byderhand -- die
// PDF-bouer kry net die rekord -- dus lei ons hom af uit die nommer. Een reel
// vir daardie omskakeling, in _fakture.js, en nie 'n tweede kopie hier nie.
function bou_betaal_url(rekord, sleutel) {
  const kode = teks(rekord && rekord.publieke_kode);
  const s =
    teks(sleutel) ||
    teks(rekord && rekord.sleutel) ||
    teks(nommer_na_sleutel(rekord && rekord.nommer));
  if (!kode || !s) return null;
  if (rekord && rekord.handmatig === true) return null;

  const werf = teks(process.env.URL) || "http://localhost:8888";
  return `${werf}/betaal.html?f=${encodeURIComponent(s)}&k=${encodeURIComponent(kode)}`;
}

module.exports = { bou_betaal_url };
