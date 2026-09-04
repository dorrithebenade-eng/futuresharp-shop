// public/js/paneel-area-pille.js
//
// Die twee AREA-pille — Admin en Boekhouding — bo-aan albei paneelbladsye.
//
// 'N NUWE LÊER, NIE 'N WYSIGING NIE. paneelbord.js, paneel-kieslys.js,
// faktuurpaneel.js en paneel-boekhouding-skakel.js bly onaangeraak. Dieselfde
// patroon as paneel-boekhouding-skakel.js self.
//
// EEN LÊER VIR ALBEI BLADSYE. Watter bladsy dit is, blyk uit die DOM:
// #paneel-sy-kieslys is die paneelbord, #fp-kieslys is Boekhouding. Twee lêers
// sou beteken 'n verandering aan die pil se gedrag moet twee keer gebeur, en
// die dag wat een vergeet word, verskil die twee bladsye stilweg.
//
// DIT VERVANG DIE TWEE GROEPOPSKRIFTE. paneel-boekhouding-skakel.js skryf
// "Admin" en "Boekhouding" as opskrifte in die sy-kieslys en hang die
// Boekhouding-skakel onderaan. Die pil bo dra nou daardie woord; dieselfde
// woord op twee plekke is ruis. Hulle word met CSS versteek, nie met
// JavaScript verwyder nie — sien die nota by DIE VOLGORDE hieronder.
//
// DIE PIL IS NIE DIE SLOT NIE. Elke Function dwing sy eie rol af. Word 'n pil
// weggelaat of raai iemand die URL, verander niks aan wie die data sien nie.
//
// SY EIE KLAS: .paneel-area-pil, NIE .fp-pil NIE. Die twee lyk vandag eenders
// en dit is doelbewus, maar hulle beteken verskillende dinge — .fp-pil wissel
// 'n AFDELING binne Boekhouding, .paneel-area-pil wissel die AREA. Sou 'n mens
// hulle deel, kan die een nooit verander sonder om die ander te sleep, en op
// die Boekhouding-bladsy staan die twee rye reg bo mekaar.

(function () {
  const ADMIN_ROLLE = ["personeel", "vennoot"];
  const BOEKHOUDING_ROL = "boekhouding";

  function woord(sleutel, verstek) {
    const uit = window.t ? window.t(sleutel) : null;
    // t() gee die SLEUTEL terug wanneer hy hom nie ken nie. Die verstek geld
    // net wanneer taal.js glad nie gelaai het nie.
    return uit && uit !== sleutel ? uit : verstek;
  }

  function het_een_van(gebruiker, rolle) {
    return rolle.some((rol) => identiteit_het_rol(gebruiker, rol));
  }

  // Watter bladsy is dit? Die anker bepaal ook WAAR die ry ingaan.
  //
  // Paneelbord: net ná #paneel-statistieke-geskiedenis-plek, dus onder die
  // maandelikse geskiedenis en bo die sy-kieslys.
  //
  // Boekhouding: net voor #fp-kieslys, dus bo die afdelingspille. Daar is geen
  // statistiekblok op daardie bladsy nie; die ry staan bo-aan die paneel.
  function kry_bladsy() {
    if (document.getElementById("paneel-sy-kieslys")) {
      const anker = document.getElementById("paneel-statistieke-geskiedenis-plek");
      if (!anker) return null;
      return { area: "admin", anker, waar: "na" };
    }
    if (document.getElementById("fp-kieslys")) {
      const anker = document.getElementById("fp-kieslys");
      return { area: "boekhouding", anker, waar: "voor" };
    }
    return null;
  }

  function bou_pil(teks, aktief, href) {
    // Die aktiewe pil is 'n <span>, nie 'n knoppie of 'n skakel nie. Hy gaan
    // nêrens heen — 'n mens is reeds daar. 'n Knoppie wat niks doen, nooi 'n
    // klik uit en beloon hom nie.
    if (aktief) {
      const pil = document.createElement("span");
      pil.className = "paneel-area-pil aktief";
      pil.setAttribute("aria-current", "page");
      pil.textContent = teks;
      return pil;
    }
    // Die ander een is 'n <a> en nie 'n <button> nie: hy navigeer na 'n ander
    // bladsy. 'n Anker gee middelklik-in-'n-nuwe-oortjie en die adres in die
    // statusbalk gratis.
    const pil = document.createElement("a");
    pil.className = "paneel-area-pil";
    pil.href = href;
    pil.textContent = teks;
    return pil;
  }

  function bou_ry(gebruiker) {
    const bladsy = kry_bladsy();
    if (!bladsy) return false;
    if (document.getElementById("paneel-area-kieslys")) return true;

    const het_admin = het_een_van(gebruiker, ADMIN_ROLLE);
    const het_boekhouding = identiteit_het_rol(gebruiker, BOEKHOUDING_ROL);

    // MINDER AS TWEE AREAS: GEEN RY. Een pil wat 'n area benoem terwyl daar
    // net een is, sê niks en neem plek. Dieselfde reël as die groepopskrifte
    // wat hy vervang.
    if (!het_admin || !het_boekhouding) return true;

    const ry = document.createElement("nav");
    ry.id = "paneel-area-kieslys";
    ry.className = "paneel-area-kieslys";
    ry.setAttribute("aria-label", woord("paneel_area_kieslys", "Areas"));

    ry.appendChild(
      bou_pil(
        woord("paneel_kieslys_groep_admin", "Admin"),
        bladsy.area === "admin",
        "paneelbord.html"
      )
    );
    ry.appendChild(
      bou_pil(
        woord("fp_titel", "Boekhouding"),
        bladsy.area === "boekhouding",
        "faktuurpaneel.html"
      )
    );

    if (bladsy.waar === "voor") {
      bladsy.anker.parentNode.insertBefore(ry, bladsy.anker);
    } else {
      bladsy.anker.parentNode.insertBefore(ry, bladsy.anker.nextSibling);
    }

    // DIE VOLGORDE.
    //
    // paneel-boekhouding-skakel.js wag ook eers vir die sessie voordat hy sy
    // opskrifte en sy skakel skryf. Watter van die twee eerste klaarmaak, is
    // nie vasgestel nie. Sou ons hulle hier met JavaScript verwyder, werk dit
    // wanneer ons laaste is en misluk stilweg wanneer ons eerste is — en 'n
    // fout wat soms werk, is erger as een wat nooit werk nie.
    //
    // Die klas op <body> laat die CSS dit doen. 'n Reël geld outomaties vir 'n
    // element wat later bykom. Dieselfde redenasie as paneel-vennoot.js.
    document.body.classList.add("paneel-area-pille-aan");
    return true;
  }

  // DIE SESSIE BESTAAN NOG NIE BY DOMContentLoaded NIE — sien die volledige
  // nota in paneel-boekhouding-skakel.js. Peiling is goedkoop, want
  // identiteit_kry_huidige_sessie() lees uit die stoor en raak die netwerk
  // slegs wanneer die token binne 30 sekondes verval.
  async function wag_vir_sessie() {
    const einde = Date.now() + 30000;
    while (Date.now() < einde) {
      let sessie = null;
      try {
        sessie = await identiteit_kry_huidige_sessie();
      } catch {
        sessie = null;
      }
      if (sessie && sessie.gebruiker) return sessie;
      await new Promise((r) => setTimeout(r, 400));
    }
    return null;
  }

  async function begin() {
    const sessie = await wag_vir_sessie();
    if (!sessie) return;

    if (bou_ry(sessie.gebruiker)) return;

    // Die anker bestaan nog nie — die paneel teken sy inhoud eers ná die
    // aanmelding. Dieselfde MutationObserver-patroon as paneel-kieslys.js.
    const kyker = new MutationObserver(() => {
      if (bou_ry(sessie.gebruiker)) kyker.disconnect();
    });
    kyker.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => kyker.disconnect(), 30000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin);
  } else {
    begin();
  }
})();
