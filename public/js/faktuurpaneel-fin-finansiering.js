// public/js/faktuurpaneel-fin-finansiering.js
// Weergawe 2 (17 Oktober 2026): net die beperkte geld. Die blok "Ontvangste
// volgens finansiering" is van die staat afgehaal: dit het dieselfde ontvangste
// as die kategorieboom anders gegroepeer en tot dieselfde totaal opgetel, en
// 'n staat moet die geld op een manier klassifiseer. Wie betaal het, word deur
// die kategorieboom gewys (bv. 'n hoofkop Toelaes en skenkings).
// Weergawe 1 (17 Oktober 2026).
//
// DIE BEPERKTE GELD WAT NOG NIE BESTEE IS NIE. Per projek met 'n toelae of
// skenking: wat in die tydperk ontvang is, minus wat in die tydperk op daardie
// projek betaal is, en nooit minder as nul nie. Dit staan in die oorskot, maar
// is nie vry om te gebruik nie; die staat trek dit af om te wys wat vir die
// organisasie beskikbaar is.
//
// Suiwer funksie: geen DOM, geen oproep nie. faktuurpaneel-fin-staat.js roep
// dit met die inskrywings en die projekte wat dit reeds gelaai het.

(function () {
  function beperk(inskrywings, projekte) {
    const toelae = new Set((projekte || [])
      .filter((p) => p.finansiering === "toelae").map((p) => p.id));
    const per = new Map();   // projek_id -> { in, uit }
    (inskrywings || []).forEach((r) => {
      if (!r.projek_id || !toelae.has(r.projek_id)) return;
      const x = per.get(r.projek_id) || { in: 0, uit: 0 };
      const sent = Number(r.bedrag_sent) || 0;
      if (r.rigting === "in") x.in += sent; else x.uit += sent;
      per.set(r.projek_id, x);
    });
    let som = 0;
    per.forEach((x) => { som += Math.max(0, x.in - x.uit); });
    return som;
  }

  window.ff_beperk = beperk;
})();
