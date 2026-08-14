// public/js/paneel-boekhouding-skakel.js
//
// Die skakel na Boekhouding in die paneelbord se sy-kieslys.
//
// 'N NUWE LÊER, NIE 'N WYSIGING NIE. paneelbord.js en paneel-kieslys.js bly
// onaangeraak — dieselfde patroon as paneel-kieslys.js en paneel-registers.js.
//
// DIT IS EENVOUDIGER AS DIE OUTEURSPANEEL-SKAKEL. Daardie een moet 'n e-pos
// teen die outeurs-store opsoek en die antwoord kas, en daar kom die fout van
// 6 Augustus vandaan waar 'n gewone koper 'n Outeurspaneel-skakel gesien het.
// Hier sit die rol IN DIE TOKEN. Niks om op te soek nie, en 'n
// rekeningwisseling kan dit nie verkeerd kry nie.
//
// DIE SKAKEL IS NIE DIE SLOT NIE. kry-fakture.js dwing die rol af en gee 403
// daarsonder. Word hierdie skakel weggelaat of raai iemand die URL, verander
// niks aan wie die data sien nie.
//
// WAAROM 'N <a> EN NIE 'N <button> NIE. Die ander kieslys-items wissel
// afdelings BINNE die bladsy; hierdie een gaan na 'n ander bladsy. 'n Anker
// gee ook die gewone dinge gratis: middelklik open 'n nuwe oortjie, en die
// adres wys in die statusbalk.
//
// paneel-kieslys.js koppel sy klikhanteerders by DOMContentLoaded aan die
// items wat DAN bestaan. Hierdie lêer laai NÁ hom, dus vuur ons
// DOMContentLoaded-luisteraar later en die skakel kry nooit daardie
// hanteerder nie. Sonder dit sou 'n klik eers elke afdeling versteek het
// (data-afdeling is null) voordat die blaaier wegnavigeer.

(function () {
  const BOEKHOUDING_ROL = "boekhouding";

  function woord(sleutel, verstek) {
    const uit = window.t ? window.t(sleutel) : null;
    // t() gee die SLEUTEL terug wanneer hy hom nie ken nie — geen stille
    // terugval nie. Die verstek geld net wanneer taal.js glad nie laai nie.
    return uit && uit !== sleutel ? uit : verstek;
  }

  function bou_opskrif(teks) {
    const kop = document.createElement("div");
    kop.className = "paneel-kieslys-groep";
    kop.textContent = teks;
    return kop;
  }

  function bou_skakel() {
    const kieslys = document.getElementById("paneel-sy-kieslys");
    if (!kieslys) return null;
    if (document.getElementById("paneel-boekhouding-skakel")) return null;

    const skakel = document.createElement("a");
    skakel.id = "paneel-boekhouding-skakel";
    skakel.href = "faktuurpaneel.html";

    // SY EIE KLAS, NIE .paneel-kieslys-item NIE.
    //
    // paneel-vennoot.js verwyder ELKE .paneel-kieslys-item wat nie 'n
    // data-afdeling op sy lys het nie — heeltemal uit die DOM. Hierdie skakel
    // het geen data-afdeling nie, want hy wissel nie 'n afdeling nie; hy
    // navigeer. Met daardie klas sou hy vir 'n vennoot verdwyn, en of dit
    // gebeur, hang af van watter skrip eerste klaarmaak. 'n Fout wat soms
    // werk, is erger as een wat nooit werk nie.
    //
    // Die styl kom uit .paneel-kieslys-skakel in styl.css, wat dieselfde lyk.
    skakel.className = "paneel-kieslys-skakel rol-boekhouding";
    // Die kolletjie kom uit CSS (::before), nie uit die merk-op nie — so hoef
    // die veertien bestaande knoppies in paneelbord.html nie elkeen 'n ekstra
    // <span> te kry nie.
    skakel.textContent = woord("fp_titel", "Boekhouding");

    // Die opskrifte verskyn slegs wanneer daar TWEE groepe is. 'n Opskrif wat
    // een groep benoem terwyl daar net een is, sê niks — dit is wat Eugene
    // sou sien, met "Admin" bo sy twee items en niks anders nie.
    const admin_items = kieslys.querySelectorAll(".paneel-kieslys-item").length;
    if (admin_items > 0) {
      kieslys.insertBefore(
        bou_opskrif(woord("paneel_kieslys_groep_admin", "Admin")),
        kieslys.firstChild
      );
      kieslys.appendChild(bou_opskrif(woord("fp_titel", "Boekhouding")));
    }

    // Heel onder. Boekhouding is 'n ander area, nie nog 'n afdeling van die
    // katalogus nie — dit hoort nie tussen Outeurs en Koepons nie.
    kieslys.appendChild(skakel);
    return skakel;
  }

  async function begin() {
    let sessie = null;
    try {
      sessie = await identiteit_kry_huidige_sessie();
    } catch {
      sessie = null;
    }

    // Geen sessie, of nie die rol nie: geen skakel. 'n Ontbrekende skakel is
    // 'n ongerief; 'n skakel wat op 'n weiering uitloop, is 'n fout.
    if (!sessie || !identiteit_het_rol(sessie.gebruiker, BOEKHOUDING_ROL)) return;

    if (bou_skakel()) return;

    // Die kieslys bestaan nog nie — die paneelbord teken hom eers ná die
    // aanmelding. Dieselfde MutationObserver-patroon as paneel-kieslys.js.
    const kyker = new MutationObserver(() => {
      if (bou_skakel()) kyker.disconnect();
    });
    kyker.observe(document.body, { childList: true, subtree: true });

    // Nie vir ewig nie: is die kieslys ná 'n halfminuut steeds nie daar nie,
    // is die persoon nie aangemeld nie en daar is niks om aan te haak nie.
    setTimeout(() => kyker.disconnect(), 30000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin);
  } else {
    begin();
  }
})();
