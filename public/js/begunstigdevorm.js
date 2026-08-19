// public/js/begunstigdevorm.js
//
// Die publieke begunstigdevorm. Geen sessie, geen aanmelding.
//
// DIE TAALSKAKELAAR HERLAAI NIE. taal.js se stel_taal() doen 'n
// window.location.reload(), en 'n herlaai halfpad deur 'n vorm gooi weg wat
// iemand reeds getik het — op 'n foon, met bankbesonderhede, is dit die soort
// ding waarna 'n mens nie weer begin nie. Ons stel die taal dus self en teken
// die etikette oor.
//
// DIE VORM VALIDEER NET WAT VERPLIG IS: naam en e-pos. Die bankvelde is
// almal opsioneel — sien die HTML se kommentaar.

(function () {
  "use strict";

  var BESIG = false;

  function e(id) {
    return document.getElementById(id);
  }

  function huidige_taal() {
    try {
      var t = localStorage.getItem("taal");
      return t === "en" ? "en" : "af";
    } catch (fout) {
      return "af";
    }
  }

  // t_in() vertaal na 'n GEKOSE taal, nie na die platform s'n nie. Hierdie
  // bladsy dra sy eie taalkeuse en mag nie van localStorage afhang op die
  // oomblik dat 'n mens die knoppie druk nie.
  function vertaal(sleutel, taal, verstek) {
    if (typeof t_in === "function") {
      var uit = t_in(sleutel, taal);
      if (uit && uit !== sleutel) return uit;
    }
    return verstek;
  }

  function teken_taal(taal) {
    var knoppe = document.querySelectorAll(".bv-taal-knop");
    for (var i = 0; i < knoppe.length; i++) {
      if (knoppe[i].dataset.bvTaal === taal) knoppe[i].classList.add("aan");
      else knoppe[i].classList.remove("aan");
    }

    var elemente = document.querySelectorAll("[data-i18n]");
    for (var j = 0; j < elemente.length; j++) {
      var el = elemente[j];
      var sleutel = el.dataset.i18n;
      var uit = vertaal(sleutel, taal, null);
      if (uit) el.textContent = uit;
    }

    document.documentElement.lang = taal;
  }

  function stel_taal_stil(taal) {
    try {
      localStorage.setItem("taal", taal);
    } catch (fout) {
      // 'n Blaaier met stoor af mag nie die vorm breek nie.
    }
    teken_taal(taal);
  }

  function boodskap(teks, is_fout) {
    var p = e("bv-boodskap");
    p.textContent = teks || "";
    p.className = "bv-boodskap" + (is_fout ? " fout" : "") + (teks ? " wys" : "");
  }

  function wys_veldfout(id, wys) {
    var p = e(id);
    if (p) p.classList.toggle("wys", Boolean(wys));
  }

  function geldige_epos(waarde) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(waarde);
  }

  async function stuur() {
    if (BESIG) return;

    var naam = e("bv-naam").value.trim();
    var epos = e("bv-epos").value.trim();

    var stukkend = false;
    wys_veldfout("bv-naam-fout", !naam);
    if (!naam) stukkend = true;
    wys_veldfout("bv-epos-fout", !geldige_epos(epos));
    if (!geldige_epos(epos)) stukkend = true;

    if (stukkend) {
      boodskap("", false);
      (naam ? e("bv-epos") : e("bv-naam")).focus();
      return;
    }

    BESIG = true;
    var knop = e("bv-stuur");
    knop.disabled = true;
    var taal = huidige_taal();
    boodskap(vertaal("bv_besig", taal, "Besig om te stuur\u2026"), false);

    var liggaam = {
      naam: naam,
      epos: epos,
      selfoon: e("bv-selfoon").value.trim(),
      adres: e("bv-adres").value.trim(),
      rekeninghouer: e("bv-rekeninghouer").value.trim(),
      bank_naam: e("bv-bank-naam").value.trim(),
      rekeningnommer: e("bv-rekeningnommer").value.trim(),
      takkode: e("bv-takkode").value.trim(),
      tipe: e("bv-tipe").value,
      webwerf: e("bv-webwerf").value,
    };

    try {
      var resp = await fetch("/.netlify/functions/dien-begunstigde-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(liggaam),
      });

      if (resp.status === 429) {
        boodskap(
          vertaal("bv_te_veel", taal, "Te veel pogings. Probeer oor 'n uur weer."),
          true
        );
        return;
      }
      if (!resp.ok) throw new Error("Status " + resp.status);

      // DIE VORM WORD VERVANG, NIE LEEGGEMAAK NIE. 'n Leë vorm laat 'n mens
      // wonder of dit deurgegaan het, en dan dien hy 'n tweede keer in.
      e("bv-vorm").style.display = "none";
      e("bv-dankie").classList.add("wys");
      window.scrollTo(0, 0);
    } catch (fout) {
      console.error("Kon nie die besonderhede stuur nie:", fout);
      boodskap(
        vertaal("bv_fout", taal, "Kon nie stuur nie. Probeer asseblief weer."),
        true
      );
    } finally {
      BESIG = false;
      knop.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    teken_taal(huidige_taal());

    var knoppe = document.querySelectorAll(".bv-taal-knop");
    for (var i = 0; i < knoppe.length; i++) {
      knoppe[i].addEventListener("click", function () {
        stel_taal_stil(this.dataset.bvTaal);
      });
    }

    e("bv-stuur").addEventListener("click", stuur);

    // Die veldfoute verdwyn sodra 'n mens begin regmaak. 'n Rooi reël wat bly
    // staan terwyl die veld reeds reg is, leer 'n mens om hom te ignoreer.
    e("bv-naam").addEventListener("input", function () {
      if (this.value.trim()) wys_veldfout("bv-naam-fout", false);
    });
    e("bv-epos").addEventListener("input", function () {
      if (geldige_epos(this.value.trim())) wys_veldfout("bv-epos-fout", false);
    });
  });
})();
