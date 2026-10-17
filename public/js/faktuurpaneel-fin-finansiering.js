// public/js/faktuurpaneel-fin-finansiering.js
// Weergawe 1 (17 Oktober 2026).
//
// ONTVANGSTE VOLGENS FINANSIERING, vir die staat van ontvangste en betalings.
//
// Die kategorieboom se WAT die geld was (Werkswinkels, Studievaardigheid
// Sessies). Hierdie blok se WIE betaal het, uit die projek waaraan die
// ontvangs gekoppel is:
//
//   Fooie vir dienste      die kliënt betaal vir die diens wat hy self kry,
//                          per instansie (Skole, Ouers en individue, ...)
//   Toelaes en skenkings   beperk tot die projek
//   Borgskappe
//   Nie aan 'n projek gekoppel nie
//                          'n ontvangs sonder projek. Dit verdwyn nooit stil
//                          nie, sodat die blok altyd tot die totale ontvangste
//                          optel.
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
  function t(sleutel, verstek) {
    const uit = window.t ? window.t(sleutel) : null;
    return uit && uit !== sleutel ? uit : verstek;
  }

  const INST = [
    ["skole", "pj_inst_skole", "Skole"],
    ["ouers", "pj_inst_ouers", "Ouers en individue"],
    ["hoer", "pj_inst_hoer", "Hoër onderwys"],
    ["korporatief", "pj_inst_korporatief", "Korporatief"],
    ["", "ff_inst_geen", "Instansie nie gekies nie"],
  ];

  function bereken(inskrywings, projekte) {
    const per_id = new Map((projekte || []).map((p) => [p.id, p]));
    const fooie = new Map(INST.map((i) => [i[0], 0]));
    let toelae = 0;
    let borgskap = 0;
    let los = 0;
    const toelae_per = new Map();   // projek_id -> { in, uit }

    (inskrywings || []).forEach((r) => {
      const sent = Number(r.bedrag_sent) || 0;
      const p = r.projek_id ? per_id.get(r.projek_id) : null;
      const fin = p ? (p.finansiering || "fooie") : "";
      if (fin === "toelae") {
        const x = toelae_per.get(p.id) || { in: 0, uit: 0 };
        if (r.rigting === "in") x.in += sent; else x.uit += sent;
        toelae_per.set(p.id, x);
      }
      if (r.rigting !== "in") return;
      if (!p) { los += sent; return; }
      if (fin === "toelae") toelae += sent;
      else if (fin === "borgskap") borgskap += sent;
      else {
        const inst = fooie.has(p.instansie || "") ? (p.instansie || "") : "";
        fooie.set(inst, fooie.get(inst) + sent);
      }
    });

    let beperk = 0;
    toelae_per.forEach((x) => { beperk += Math.max(0, x.in - x.uit); });

    const fooie_som = [...fooie.values()].reduce((a, b) => a + b, 0);
    const rye = [];
    if (fooie_som) {
      rye.push({ naam: t("pj_fin_fooie", "Fooie vir dienste"), vlak: 1, totaal_sent: fooie_som, hoof: true });
      INST.forEach(([id, sl, verstek]) => {
        const s = fooie.get(id);
        if (s) rye.push({ naam: t(sl, verstek), vlak: 2, totaal_sent: s, hoof: false });
      });
    }
    if (toelae) rye.push({ naam: t("ff_toelae", "Toelaes en skenkings (beperk tot die projek)"), vlak: 1, totaal_sent: toelae, hoof: true });
    if (borgskap) rye.push({ naam: t("ff_borgskap", "Borgskappe"), vlak: 1, totaal_sent: borgskap, hoof: true });
    if (los) rye.push({ naam: t("ff_los", "Nie aan 'n projek gekoppel nie"), vlak: 1, totaal_sent: los, hoof: true, los: true });

    return {
      rye,
      som_sent: fooie_som + toelae + borgskap + los,
      los_sent: los,
      beperk_sent: beperk,
      het_projekte: fooie_som + toelae + borgskap > 0,
    };
  }

  window.ff_bereken = bereken;
})();
