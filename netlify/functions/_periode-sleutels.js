// Gedeelde periodesleutels vir die besoektellers.
//
// WAAROM DIT BESTAAN: tel-besoek.js SKRYF 'n teller saam met die sleutel
// van die periode waarin dit tel; kry-statistieke.js moet daardie sleutel
// teen die HUIDIGE periode toets voordat dit die getal vertoon. Bereken
// albei die sleutel elk op sy eie, dryf hulle vroeër of later uitmekaar
// en die paneel wys weer 'n ou getal onder 'n vars etiket.
//
// Alles word in UTC bereken. Netlify se Functions loop in UTC, en 'n
// teller wat sy grens op 'n ander tydsone trek as die een wat hom lees,
// is presies die fout wat hierdie lêer uitsluit.

function iso_week_sleutel(datum) {
  // ISO 8601-weeknommer (Maandag = eerste dag, Week 1 bevat die jaar se
  // eerste Donderdag) — standaard, ondubbelsinnige weeksleutel.
  const d = new Date(
    Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth(), datum.getUTCDate())
  );
  const dagNommer = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dagNommer);
  const jaarBegin = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNommer = Math.ceil(((d - jaarBegin) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNommer).padStart(2, "0")}`;
}

function dag_sleutel(datum) {
  return datum.toISOString().slice(0, 10); // JJJJ-MM-DD
}

function maand_sleutel(datum) {
  return datum.toISOString().slice(0, 7); // JJJJ-MM
}

// Al drie in een oproep, uit EEN oomblik. Word die tyd drie keer apart
// gelees, kan 'n oproep wat middernag tref twee periodes meng.
function kry_periode_sleutels(datum) {
  const nou = datum || new Date();
  return {
    daagliks: dag_sleutel(nou),
    weekliks: iso_week_sleutel(nou),
    maandeliks: maand_sleutel(nou),
  };
}

module.exports = {
  iso_week_sleutel,
  dag_sleutel,
  maand_sleutel,
  kry_periode_sleutels,
};
