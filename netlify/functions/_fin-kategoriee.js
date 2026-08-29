// netlify/functions/_fin-kategoriee.js
//
// Die register van FINANSIELE kategoriee — die reels waaronder inkomste en
// uitgawes op die staat val.
//
// DIE NAAM DRA "FIN-" OM 'N REDE. `skep-kategorie.js` bestaan reeds en is die
// WINKEL se produkkategoriee — Fiksie, Handleidings, Kinderboeke. Twee dinge
// wat albei "kategorie" heet en niks met mekaar te doen het nie, is presies
// hoe 'n mens later die verkeerde Function oopmaak.
//
// DIE BOOM
//
// Elke kategorie mag na 'n ander een wys deur `onder`. Die diepte is
// onbeperk, en 'n kategorie op ENIGE vlak mag self inskrywings dra:
//
//   Terugbetaalde koste
//       Reiskoste            R380 direk geboek
//           Petrol           R2 100
//           Vliegkaartjies   R2 300
//
// Reiskoste se totaal is R4 780 — haar eie plus haar kinders. Sonder daardie
// reel sou elke kategorie 'n "Ander"-kind moes kry om iets te kan dra.
//
// SKRAP BESTAAN NIE
//
// 'n Kategorie word nooit verwyder nie; sy word onder 'n ander een gesit. Dit
// is nie 'n gerief nie, dit is die enigste hantering wat 'n ou staat onveranderd
// laat. "Reis koste" — 'n spelfout wat 'n maand lank gebruik is — bly bestaan,
// wys onder "Reiskoste", en haar bedrae tel op die regte reel. Skrap 'n mens
// haar, verskuif 'n historiese bedrag, en 'n staat wat verlede maand uitgegaan
// het, is nie meer die staat wat die stelsel vandag wys nie.
//
// DIE RIGTING IS NIE OORTOLLIG NIE
//
// "Bankkoste" is nooit inkomste. Die veld keer dat 'n uitgawe per ongeluk aan
// die inkomstekant beland, en dit keer 'n subkategorie wat teen haar ouer se
// rigting indruis — 'n uitgawe onder Inkomste laat die staat stilweg verkeerd
// optel.
//
// GEDEK DEUR HOSTING
//
// Hosting is 'n heffing op projekwerk wat Future Sharp se oorhoofse koste dra:
// subskripsies, data, LearnWorlds, KI. Die vraag wat niemand tans kan
// beantwoord nie, is of die persentasie reg is.
//
// Die stelsel neem GEEN standpunt in oor wat hosting moet dek nie. Die merkie
// staan op die kategorie en die staat tel op wat gemerk is. Merk julle later
// die oudit ook, skuif die syfer saam. Merk julle niks, verdwyn die blok.
//
// VASTE KATEGORIEE
//
// Twee word deur die stelsel self geskryf en mag nie verwyder of van rigting
// verander word nie: die faktuur se diensinkomste, en Paystack se
// transaksiefooi. Hulle mag WEL onder 'n ander een gesit word — dit is die
// enigste ding wat aan hulle verander mag.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "fin-kategoriee";
const RIGTINGS = ["in", "uit"];

// Die twee wat die stelsel self skryf. Hul id's is vas, want kry-joernaal.js
// en die staat verwys direk daarna.
const VAS = {
  "diensinkomste": { naam: "Diensinkomste", rigting: "in" },
  "paystack-transaksiefooi": { naam: "Paystack \u2014 transaksiefooi", rigting: "uit" },
};

function kry_fin_kategoriee_store() {
  return kry_store(STORE_NAAM);
}

// Dieselfde slug as die begunstigde- en outeursregisters s'n. Die id kom uit
// die naam en verander NOOIT: 'n werk-item en 'n joernaalinskrywing wys
// daarheen, en 'n hernoeming mag nie hul verwysing breek nie.
function maak_slug(teks) {
  return String(teks || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nuwe_kategorie() {
  const nou = new Date().toISOString();
  return {
    id: "",
    naam: "",
    onder: "",              // die id van die ouer, of "" vir 'n hoofkategorie
    rigting: "uit",
    gedek_deur_hosting: false,
    vas: false,             // deur die stelsel geskryf; naam en rigting is vas
    nota: "",               // vir die boekhouer
    geskep_op: nou,
    geskep_deur: "",
    bygewerk_op: nou,
  };
}

// DIE KRINGLOOPWAG.
//
// Sit iemand Reiskoste onder Petrol terwyl Petrol reeds onder Reiskoste is,
// loop elke som wat oor die boom optel vir ewig. Die kontrole hoort HIER en
// nie op die skerm nie — die skerm is nie die poort nie.
//
// Die stap-perk is 'n tweede net: 'n boom wat op een of ander manier reeds
// stukkend in die store staan, moet hierdie funksie nie laat hang nie.
function sou_kringloop(id, nuwe_onder, almal) {
  if (!nuwe_onder) return false;
  if (nuwe_onder === id) return true;

  const per_id = new Map(almal.map((k) => [k.id, k]));
  let loop = nuwe_onder;
  let stappe = 0;

  while (loop && stappe < 200) {
    if (loop === id) return true;
    const ouer = per_id.get(loop);
    loop = ouer ? ouer.onder : "";
    stappe += 1;
  }
  return stappe >= 200;
}

// Hoe diep le hierdie kategorie? 1 is 'n hoofkategorie.
//
// Die staat se uitvoer dra hierdie getal as 'n EIE KOLOM. 'n CSV kan nie
// inkeping en vetdruk dra nie, en 'n boekhouer kan op 'n getal sorteer en
// filter — op spasies kan hy nie.
function vlak_van(kategorie, almal) {
  const per_id = new Map(almal.map((k) => [k.id, k]));
  let vlak = 1;
  let loop = kategorie ? kategorie.onder : "";
  let stappe = 0;

  while (loop && stappe < 200) {
    const ouer = per_id.get(loop);
    // 'n WEESKIND IS 'N WORTEL. Wys `onder` na 'n id wat nie bestaan nie, is
    // die kategorie op vlak 1 -- nie een dieper as 'n ouer wat weg is nie.
    // Andersins lees sy op die staat asof sy onder haar bure hoort.
    if (!ouer) break;
    vlak += 1;
    loop = ouer.onder;
    stappe += 1;
  }
  return vlak;
}

// Die volle pad, van die hoofkategorie af: "Terugbetaalde koste / Reiskoste /
// Petrol". Die staat wys dit waar 'n mens 'n enkele reel sonder sy boom sien.
function pad_van(kategorie, almal) {
  const per_id = new Map(almal.map((k) => [k.id, k]));
  const dele = [];
  let loop = kategorie;
  let stappe = 0;

  while (loop && stappe < 200) {
    dele.unshift(loop.naam);
    loop = loop.onder ? per_id.get(loop.onder) : null;
    stappe += 1;
  }
  return dele.join(" / ");
}

// Sorteer die boom vir vertoning: elke ouer onmiddellik gevolg deur haar
// kinders, en op elke vlak alfabeties. Sonder dit lees die register en die
// staat in stoorvolgorde, wat niks beteken nie.
function sorteer_boom(almal) {
  const kinders = new Map();
  almal.forEach((k) => {
    const sleutel = k.onder || "";
    if (!kinders.has(sleutel)) kinders.set(sleutel, []);
    kinders.get(sleutel).push(k);
  });
  kinders.forEach((lys) =>
    lys.sort((a, b) => String(a.naam).localeCompare(String(b.naam), "af-ZA"))
  );

  const uit = [];
  const loop = (ouer_id, diepte) => {
    if (diepte > 200) return;
    (kinders.get(ouer_id) || []).forEach((k) => {
      uit.push(k);
      loop(k.id, diepte + 1);
    });
  };
  loop("", 0);

  // 'n Weeskind — sy ouer is weg of die id is stukkend — moet SIGBAAR bly.
  // Val hy stil uit die lys, verdwyn sy bedrag saam met hom van die staat.
  if (uit.length < almal.length) {
    const gesien = new Set(uit.map((k) => k.id));
    almal.forEach((k) => {
      if (!gesien.has(k.id)) uit.push(k);
    });
  }
  return uit;
}

module.exports = {
  STORE_NAAM,
  RIGTINGS,
  VAS,
  kry_fin_kategoriee_store,
  maak_slug,
  nuwe_kategorie,
  sou_kringloop,
  vlak_van,
  pad_van,
  sorteer_boom,
};
