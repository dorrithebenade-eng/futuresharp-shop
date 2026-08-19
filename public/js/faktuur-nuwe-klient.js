// public/js/faktuur-nuwe-klient.js
//
// "+ Nuwe kliënt" BINNE die faktuurvorm.
//
// Iemand bel, jy het 'n naam en 'n nommer, en die faktuur staan half klaar.
// Sonder hierdie paneel moet 'n mens die faktuur verlaat, na die Registers
// gaan, die kliënt skep, terugkom en hom soek — en Blobs se list() loop
// sowat vier sekondes agter, dus is hy dikwels nie eens daar nie.
//
// 'N NUWE LEER, NIE 'N WYSIGING AAN faktuur-vorm.js NIE. Daardie lêer dra
// die dokument, die outostoor en die stand; 'n fout hierin mag nie 'n
// konsep kan breek nie.
//
// DIE KOPPELING IS BY DIE NAAM, NIE VIA window NIE. faktuur-vorm.js
// verklaar V, KLIENTE, SESSIE en FV_GELAAI as const/let op die boonste
// vlak van 'n gewone skrip. Dit maak hulle leesbaar vir enige skrip wat NA
// hom laai, maar hulle sit NIE op window nie — `window.V` is undefined.
// Daarom toets ons met typeof en nie met window.V nie.
//
// Verander die laaivolgorde in faktuur.html ooit, sien hierdie lêer dit:
// die skakel word dan glad nie geteken nie. 'n Knoppie wat verskyn en niks
// doen, is erger as een wat nie verskyn nie.
//
// NIKS WORD GELEEN NIE. Elke klas dra die voorvoegsel `nk-`. .veld-ry in
// styl.css is 'n TWEEKOLOM-ROOSTER, etiket links en veld regs — die vorm
// sou skeef gestaan het.

(function () {
  "use strict";

  var WAG_MAKS = 60; // 60 x 250ms = 15 sekondes
  var wag_tel = 0;
  var PANEEL_OOP = false;

  function t(sleutel, verstek) {
    return typeof fv_t === "function" ? fv_t(sleutel, verstek) : verstek;
  }

  function veilig(waarde) {
    // ontsnap() is 'n funksieverklaring in faktuur-vorm.js en dus wel op
    // window. Ons toets nogtans, want 'n stille TypeError hier sou die hele
    // paneel doodmaak.
    if (typeof ontsnap === "function") return ontsnap(waarde);
    return String(waarde == null ? "" : waarde);
  }

  /* ═══ die skulp ═══ */

  function bou_paneel() {
    var d = document.createElement("div");
    d.className = "nk-paneel";
    d.id = "nk-paneel";
    d.hidden = true;
    d.innerHTML =
      '<div class="nk-kop">' +
      '<span class="nk-titel">' + t("nk_kop", "Nuwe kliënt") + "</span>" +
      '<button type="button" class="nk-sluit" id="nk-sluit" aria-label="' +
      t("nk_kanselleer", "Kanselleer") + '">&#215;</button>' +
      "</div>" +

      '<div class="nk-soort">' +
      '<button type="button" class="nk-soort-knop aan" data-soort="instansie">' +
      t("nk_instansie", "Instansie") + "</button>" +
      '<button type="button" class="nk-soort-knop" data-soort="privaat">' +
      t("nk_privaat", "Privaat") + "</button>" +
      "</div>" +

      '<div class="nk-ry">' +
      '<label class="nk-etiket" for="nk-naam" id="nk-naam-etiket">' +
      t("nk_naam_instansie", "Naam van die instansie") + "</label>" +
      '<input type="text" class="nk-invoer" id="nk-naam" maxlength="200" autocomplete="off">' +
      '<p class="nk-veldfout" id="nk-naam-fout" hidden>' +
      t("nk_naam_fout", "Vul die naam in.") + "</p>" +
      "</div>" +

      '<div class="nk-ry" id="nk-kontak-ry">' +
      '<label class="nk-etiket" for="nk-kontak">' +
      t("nk_kontak", "Kontakpersoon") + "</label>" +
      '<input type="text" class="nk-invoer" id="nk-kontak" maxlength="200" autocomplete="off">' +
      "</div>" +

      '<div class="nk-paar">' +
      '<div class="nk-ry">' +
      '<label class="nk-etiket" for="nk-epos">' + t("nk_epos", "E-pos") + "</label>" +
      '<input type="email" class="nk-invoer" id="nk-epos" maxlength="200" autocomplete="off">' +
      "</div>" +
      '<div class="nk-ry">' +
      '<label class="nk-etiket" for="nk-selfoon">' + t("nk_selfoon", "Selfoon") + "</label>" +
      '<input type="tel" class="nk-invoer" id="nk-selfoon" maxlength="60" autocomplete="off">' +
      "</div>" +
      "</div>" +

      // DIE DUPLIKAATSTROOK KEER NIE. Twee kliënte kan werklik 'n adres
      // deel — twee departemente by een skool. Hy laat 'n mens SIEN, en die
      // Registers-blad se eie strook vang die res later.
      '<p class="nk-duplikaat" id="nk-duplikaat" hidden></p>' +

      '<div class="nk-ry">' +
      '<label class="nk-etiket" for="nk-adres">' + t("nk_adres", "Adres") + "</label>" +
      '<textarea class="nk-invoer nk-teksveld" id="nk-adres" rows="2" maxlength="500"></textarea>' +
      "</div>" +

      '<p class="nk-boodskap" id="nk-boodskap" hidden></p>' +

      '<div class="nk-aksies">' +
      '<button type="button" class="nk-stoor" id="nk-stoor">' +
      t("nk_stoor", "Stoor en kies") + "</button>" +
      '<button type="button" class="nk-kanselleer" id="nk-kanselleer">' +
      t("nk_kanselleer", "Kanselleer") + "</button>" +
      '<span class="nk-hulp">' +
      t("nk_hulp", "Stoor met net 'n naam — die res kan later") + "</span>" +
      "</div>";
    return d;
  }

  /* ═══ soort ═══
   *
   * 'n PRIVAAT KLIENT HET GEEN KONTAKPERSOON NIE. Hy is sy eie kontak, en 'n
   * leë veld laat 'n mens wonder of hy iets mis. Dieselfde reël as
   * stoor-klient.js, wat die veld bediener-kant leegmaak.
   */

  function stel_soort(soort) {
    var knoppe = document.querySelectorAll(".nk-soort-knop");
    for (var i = 0; i < knoppe.length; i++) {
      if (knoppe[i].dataset.soort === soort) knoppe[i].classList.add("aan");
      else knoppe[i].classList.remove("aan");
    }
    var ry = document.getElementById("nk-kontak-ry");
    var et = document.getElementById("nk-naam-etiket");
    if (soort === "privaat") {
      ry.hidden = true;
      document.getElementById("nk-kontak").value = "";
      et.textContent = t("nk_naam_privaat", "Naam");
    } else {
      ry.hidden = false;
      et.textContent = t("nk_naam_instansie", "Naam van die instansie");
    }
  }

  function huidige_soort() {
    var aan = document.querySelector(".nk-soort-knop.aan");
    return aan ? aan.dataset.soort : "instansie";
  }

  /* ═══ die duplikaattoets ═══
   *
   * DIE E-POS, EN NIKS ANDERS NIE. 'n Skool se naam het vyf skryfwyses —
   * Hoërskool Bloemfontein, HS Bloemfontein — en vrye teks pas nie
   * betroubaar nie. Kleinletter gestoor, kleinletter vergelyk, presies soos
   * _kliente.js dit doen.
   */

  function toets_duplikaat() {
    var strook = document.getElementById("nk-duplikaat");
    var epos = String(document.getElementById("nk-epos").value || "")
      .trim()
      .toLowerCase();
    strook.hidden = true;
    if (!epos || typeof KLIENTE === "undefined" || !KLIENTE.length) return;

    var treffers = [];
    for (var i = 0; i < KLIENTE.length; i++) {
      var k = KLIENTE[i];
      if (String(k.epos || "").trim().toLowerCase() === epos) treffers.push(k.naam || "");
    }
    if (!treffers.length) return;

    strook.innerHTML =
      t("nk_duplikaat", "Hierdie adres staan reeds by") +
      " <b>" + veilig(treffers.join(", ")) + "</b>.";
    strook.hidden = false;
  }

  /* ═══ stoor ═══ */

  function boodskap(teks, is_fout) {
    var p = document.getElementById("nk-boodskap");
    p.textContent = teks || "";
    p.className = is_fout ? "nk-boodskap fout" : "nk-boodskap";
    p.hidden = !teks;
  }

  async function stoor_klient() {
    var knop = document.getElementById("nk-stoor");
    var naam = String(document.getElementById("nk-naam").value || "").trim();
    var fout = document.getElementById("nk-naam-fout");

    if (!naam) {
      fout.hidden = false;
      document.getElementById("nk-naam").focus();
      return;
    }
    fout.hidden = true;

    var soort = huidige_soort();
    var liggaam = {
      soort: soort,
      naam: naam,
      kontak: soort === "privaat" ? "" : String(document.getElementById("nk-kontak").value || "").trim(),
      epos: String(document.getElementById("nk-epos").value || "").trim(),
      selfoon: String(document.getElementById("nk-selfoon").value || "").trim(),
      adres: String(document.getElementById("nk-adres").value || "").trim(),
    };

    knop.disabled = true;
    boodskap(t("nk_besig", "Besig…"), false);

    try {
      var resp = await fetch("/.netlify/functions/stoor-klient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + SESSIE.access_token,
        },
        body: JSON.stringify(liggaam),
      });
      if (!resp.ok) throw new Error("Status " + resp.status);
      var data = await resp.json();

      // DIE LYS WORD PLAASLIK BYGEWERK, NIE WEER GEVRA NIE. Blobs se list()
      // loop sowat vier sekondes agter; 'n herlaai sou die splinternuwe
      // kliënt NIE terugbring nie en dit sou lyk of die stoor misluk het.
      //
      // Die register se veld heet `kontak`; op die faktuur heet dit
      // `kontakpersoon`. Dieselfde vertaling as faktuur-vorm.js se
      // change-luisteraar.
      var nuut = {
        nommer: data.nommer,
        soort: soort,
        naam: naam,
        kontak: liggaam.kontak,
        epos: liggaam.epos,
        selfoon: liggaam.selfoon,
        adres: liggaam.adres,
        onvolledig: !liggaam.epos || !liggaam.selfoon ||
          (soort === "instansie" && !liggaam.kontak),
      };
      KLIENTE.push(nuut);

      var kies = document.getElementById("fv-klient");
      if (kies) {
        var opsie = document.createElement("option");
        opsie.value = nuut.nommer;
        opsie.textContent =
          nuut.naam + (nuut.onvolledig ? " · " + t("fk_onvolledig", "onvolledig") : "");
        kies.appendChild(opsie);
        kies.value = nuut.nommer;
      }

      V.klient_id = nuut.nommer;
      V.klient = {
        naam: nuut.naam,
        kontakpersoon: nuut.kontak,
        epos: nuut.epos,
        selfoon: nuut.selfoon,
        adres: nuut.adres,
      };
      if (typeof teken_klient === "function") teken_klient();
      if (typeof merk_vuil === "function") merk_vuil();

      maak_toe();
    } catch (f) {
      console.error("Kon nie die kliënt stoor nie:", f);
      boodskap(t("nk_fout", "Kon nie stoor nie. Probeer weer."), true);
    } finally {
      knop.disabled = false;
    }
  }

  /* ═══ oop en toe ═══ */

  function maak_oop() {
    var p = document.getElementById("nk-paneel");
    if (!p) return;
    p.hidden = false;
    PANEEL_OOP = true;
    document.getElementById("nk-skakel").hidden = true;
    stel_soort("instansie");
    ["nk-naam", "nk-kontak", "nk-epos", "nk-selfoon", "nk-adres"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.value = "";
    });
    document.getElementById("nk-naam-fout").hidden = true;
    document.getElementById("nk-duplikaat").hidden = true;
    boodskap("", false);
    document.getElementById("nk-naam").focus();
  }

  function maak_toe() {
    var p = document.getElementById("nk-paneel");
    if (!p) return;
    p.hidden = true;
    PANEEL_OOP = false;
    var s = document.getElementById("nk-skakel");
    if (s) s.hidden = false;
  }

  /* ═══ die aanhaking ═══ */

  function haak_aan() {
    var houer = document.getElementById("fv-klient-kies");
    if (!houer) return false;

    // 'N UITGEREIKTE FAKTUUR KRY GEEN SKAKEL NIE. Die dokument is by die
    // kliënt en die verdeling is gevries; die kieser self is toegesluit deur
    // sluit_toe(). 'n Skakel wat oop bly langs 'n toe kieser, lyk soos 'n pad
    // wat nie bestaan nie.
    if (V.stand !== "konsep") return true;

    var skakel = document.createElement("button");
    skakel.type = "button";
    skakel.className = "nk-skakel";
    skakel.id = "nk-skakel";
    skakel.textContent = t("nk_nuwe_klient", "+ Nuwe kliënt");
    houer.appendChild(skakel);
    houer.appendChild(bou_paneel());

    skakel.addEventListener("click", maak_oop);
    document.getElementById("nk-sluit").addEventListener("click", maak_toe);
    document.getElementById("nk-kanselleer").addEventListener("click", maak_toe);
    document.getElementById("nk-stoor").addEventListener("click", stoor_klient);
    document.getElementById("nk-epos").addEventListener("blur", toets_duplikaat);

    var knoppe = document.querySelectorAll(".nk-soort-knop");
    for (var i = 0; i < knoppe.length; i++) {
      knoppe[i].addEventListener("click", function () {
        stel_soort(this.dataset.soort);
      });
    }

    // Escape maak toe. Enter binne 'n veld stoor NIE — 'n mens tik deur die
    // velde met Enter uit gewoonte, en 'n halwe rekord wat homself stoor, is
    // presies wat 'n mens later moet gaan regmaak.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && PANEEL_OOP) maak_toe();
    });

    return true;
  }

  function wag_vir_vorm() {
    if (typeof V === "undefined" || typeof KLIENTE === "undefined" ||
        typeof SESSIE === "undefined" || typeof FV_GELAAI === "undefined") {
      // faktuur-vorm.js het nie gelaai nie, of hy laai NA hierdie lêer.
      // Geen skakel — sien die kop van hierdie lêer.
      console.warn("faktuur-nuwe-klient.js: die faktuurvorm se toestand is nie bereikbaar nie.");
      return;
    }
    if (FV_GELAAI) {
      haak_aan();
      return;
    }
    wag_tel += 1;
    if (wag_tel > WAG_MAKS) return;
    setTimeout(wag_vir_vorm, 250);
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(wag_vir_vorm, 250);
  });
})();
