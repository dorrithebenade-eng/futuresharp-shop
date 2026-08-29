// netlify/functions/_werk-items.js
//
// Die register van werk en uitgawes — die lys waaruit 'n faktuur se begroting
// kies.
//
// TWEE SOORTE, EEN STORE. Die `soort`-veld skei hulle, presies soos die
// spesifikasie dit vir produkte en dienste doen: één store, twee lyste op die
// skerm. Twee stores sou beteken dieselfde vorm bestaan twee keer en die twee
// kan uit pas raak.
//
//   `werk`    — arbeid wat betaal word. Aanbieder, Ontwikkelaar, Filmmaker,
//               Admin. Die deel is INKOMSTE vir daardie persoon, en dit mag 'n
//               vaste bedrag óf 'n persentasie wees.
//
//   `uitgawe` — geld wat iemand uitgehaal het en presies moet terugkry.
//               Reiskoste, akkommodasie, etes, drukwerk. ALTYD 'n vaste
//               bedrag: loop dit op 'n persentasie, kry hy 70% van sy eie
//               petrol terug. Dieselfde slaggat as die winkel se harde kopie,
//               waarvoor vs_bereken() se kosteDeel reeds gebou is.
//
// Die toets is: HET IEMAND GELD UITGEHAAL? Ja, dan is dit 'n uitgawe. Nee, hy
// het gewerk, dan is dit werk.
//
// DIE ITEM DRA GEEN BEDRAG EN GEEN ONTVANGER NIE.
//
// Geen bedrag, want elke geval verskil — 840 km vandag, 120 km volgende keer.
// 'n Verstek wat gewoonlik verkeerd is, is erger as 'n leë veld: 'n mens laat
// hom staan en dan is die bedrag op die faktuur verkeerd omdat niemand gekyk
// het nie.
//
// Geen ontvanger, want die ontvanger BESLUIT wat met die ry gebeur, en dit
// verskil per faktuur. Gaan Admin na Future Sharp, bly dit in die
// hoofrekening; gaan dit na iemand buite, word dit 'n verdelingsry. Die
// register mag geen vaste gedrag vasspyker wat per faktuur verskil nie —
// dieselfde redenasie as waarom die begunstigderegister nie "aanbieder" heet
// nie.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "werk-items";
const SOORTE = ["werk", "uitgawe"];

function kry_werk_items_store() {
  return kry_store(STORE_NAAM);
}

// Dieselfde slug as skep-begunstigde.js s'n. Die ID word by die SKEPPING
// vasgestel en verander nooit met die naam nie: 'n faktuur se begrote ry
// verwys daarna, en 'n hernoeming mag daardie verwysing nie breek nie.
function maak_slug(teks) {
  return String(teks || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nuwe_item(soort, naam, beskrywing) {
  const nou = new Date().toISOString();
  return {
    item_id: maak_slug(naam),
    soort: SOORTE.includes(soort) ? soort : "uitgawe",
    naam: String(naam || "").trim(),
    beskrywing: String(beskrywing || "").trim(),
    // 'N ITEM WORD AFGESKAKEL, NIE UITGEVEE NIE. 'n Ou faktuur se begrote ry
    // verwys na hierdie ID; verdwyn die rekord, wys daardie ry na niks. Wat
    // afgeskakel is, verdwyn uit die keuselys maar bly in die register.
    aktief: true,

    // DIE KATEGORIE, as 'n verwysing na _fin-kategoriee.js se id.
    //
    // HIER, EN NIE OP DIE FAKTUUR NIE. Die faktuur se reel dra 'n vrye teks met
    // hierdie register as datalist; sou elke reel sy eie kategorie kies, moes
    // 'n mens dit by elke faktuur weer kies en dan sou "Drukwerk" op twee
    // fakture onder twee kategoriee kon val.
    //
    // Die staat pas die reel se BESKRYWING teen 'n item se naam en lees die
    // kategorie hier. Pas niks, staan die bedrag as "Ongekategoriseer" -- nie
    // weggelaat nie, want dan tel die staat nie meer tot die bank nie.
    kategorie_id: "",
    geskep_op: nou,
    bygewerk_op: nou,
    geskiedenis: [],
  };
}

function voeg_geskiedenis_by(rekord, handeling, wie, nota) {
  if (!Array.isArray(rekord.geskiedenis)) rekord.geskiedenis = [];
  rekord.geskiedenis.push({
    handeling,
    wie: wie || "",
    nota: nota || "",
    op: new Date().toISOString(),
  });
  return rekord;
}

module.exports = {
  STORE_NAAM,
  SOORTE,
  kry_werk_items_store,
  maak_slug,
  nuwe_item,
  voeg_geskiedenis_by,
};
