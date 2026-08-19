// public/js/faktuurpaneel-wagkamer.js
//
// DIE WAGKAMER: indienings van die publieke begunstigdevorm, en die oordrag
// na die register.
//
// 'N NUWE LEER, NIE 'N WYSIGING AAN faktuurpaneel-begunstigdes.js NIE.
// Daardie lêer dra die register self; 'n fout hierin mag nie 'n bestaande
// begunstigde kan breek nie.
//
// WAAROM DAAR 'N STAP TUSSENIN IS. Die kliëntvorm skryf reguit in sy register
// — die indiening ís die rekord. Hier nie, en die rede is die
// `begunstigde_id`: dit is 'n slak van die naam en dit VERANDER NOOIT WEER,
// want 'n faktuur se gevriesde verdeling verwys daarna. Tik iemand "eugene
// marais" op die vorm, is dit die verkeerde sleutel vir ewig en die enigste
// herstel is om die rekord oor te maak.
//
// Daarom is die naam op hierdie skerm 'n INVOERVELD en nie teks nie. Dit is
// die laaste oomblik waarop dit reggemaak kan word.
//
// DIE MERKIES KEER NIKS. `in_register` en `is_outeur` sê net wat elders
// bestaan; wat daarmee gedoen word, is 'n mens se besluit. Twee mense kan
// werklik 'n adres deel.

(function () {
  "use strict";

  var LYS = [];
  var GELAAI = false;
  var BESIG = "";

  function e(id) { return document.getElementById(id); }

  function wk_t(sleutel, verstek) {
    var uit = window.t ? window.t(sleutel) : null;
    return uit && uit !== sleutel ? uit : verstek;
  }

  function ontsnap_wk(waarde) {
    return String(waarde == null ? "" : waarde)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function datum(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      return d.toLocaleDateString("af-ZA", { day: "numeric", month: "short", year: "numeric" }) +
        ", " + d.toLocaleTimeString("af-ZA", { hour: "2-digit", minute: "2-digit" });
    } catch (fout) {
      return iso.slice(0, 10);
    }
  }

  async function sessie_kop() {
    var s = await identiteit_kry_huidige_sessie();
    if (!s) throw new Error("Geen sessie");
    return { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token };
  }

  /* ═══ teken ═══ */

  function ry(naam, waarde) {
    if (!waarde) return "";
    return '<tr><td class="wk-et">' + ontsnap_wk(naam) + "</td><td>" + ontsnap_wk(waarde) + "</td></tr>";
  }

  function kaart(i) {
    var k = i.kontak_inligting || {};
    var b = i.bank || {};
    var sleutel = ontsnap_wk(i.sleutel);

    var merkies = "";
    if (i.in_register) {
      merkies += '<span class="wk-merk rooi">' +
        wk_t("wk_in_register", "Staan reeds in die register") +
        (i.register_naam ? " \u00b7 " + ontsnap_wk(i.register_naam) : "") + "</span>";
    }
    if (i.is_outeur) {
      merkies += '<span class="wk-merk amber">' + wk_t("wk_is_outeur", "Ook 'n outeur") + "</span>";
    }

    var bank_rye =
      ry(wk_t("wk_rekeninghouer", "Rekeninghouer"), b.rekeninghouer) +
      ry(wk_t("wk_bank", "Bank"), b.bank_naam) +
      ry(wk_t("wk_rekening", "Rekening"), b.rekeningnommer) +
      ry(wk_t("wk_takkode", "Takkode"), b.takkode) +
      ry(wk_t("wk_tipe", "Rekeningtipe"), b.tipe);

    // Is hy reeds 'n outeur MET 'n kode, word daardie kode voorgestel. Dan
    // word daar nie 'n tweede subrekening gemaak nie, en Paystack se
    // eerste-uitbetaling-goedkeuring hoef nie weer gewag te word nie.
    var kode = i.is_outeur ? (i.outeur_subrekening_kode || "") : "";

    return (
      '<div class="wk-kaart" data-sleutel="' + sleutel + '">' +
        '<div class="wk-kop">' +
          '<div><p class="wk-naam-wys">' + ontsnap_wk(i.naam) + "</p>" +
          '<p class="wk-tyd">' + wk_t("wk_ingedien", "Ingedien") + " " + ontsnap_wk(datum(i.ingedien_op)) + "</p></div>" +
          '<div class="wk-merke">' + merkies + "</div>" +
        "</div>" +

        '<table class="wk-tabel">' +
          ry(wk_t("wk_epos", "E-pos"), k.epos) +
          ry(wk_t("wk_selfoon", "Selfoon"), k.selfoon) +
          ry(wk_t("wk_adres", "Adres"), k.adres) +
          (bank_rye
            ? '<tr><td colspan="2" class="wk-afdeling">' + wk_t("wk_bank_kop", "Bankbesonderhede") + "</td></tr>" + bank_rye
            : '<tr><td colspan="2" class="wk-geen">' + wk_t("wk_geen_bank", "Geen bankbesonderhede ingevul nie.") + "</td></tr>") +
        "</table>" +

        '<div class="wk-velde">' +
          '<label class="wk-etiket">' + wk_t("wk_naam", "Naam vir die register") +
            '<input type="text" class="wk-invoer wk-naam" value="' + ontsnap_wk(i.naam) + '" maxlength="200">' +
          "</label>" +
          '<label class="wk-etiket">' + wk_t("wk_kode", "Subrekening-kode") +
            '<input type="text" class="wk-invoer wk-kode" value="' + ontsnap_wk(kode) + '" placeholder="ACCT_" spellcheck="false">' +
          "</label>" +
        "</div>" +

        '<p class="wk-let">' + wk_t("wk_let",
          "Die naam bepaal die rekord se sleutel en kan daarna nooit verander nie. Sonder 'n kode word die rekord Wag vir subrekening en die ry word met die hand betaal \u2014 dit keer niks.") + "</p>" +

        '<p class="wk-boodskap" data-boodskap></p>' +

        '<div class="wk-aksies">' +
          '<button type="button" class="kaart-aksie wk-oor">' + wk_t("wk_dra_oor", "Dra oor") + "</button>" +
          '<button type="button" class="wk-vee">' + wk_t("wk_vee", "Vee weg") + "</button>" +
        "</div>" +
      "</div>"
    );
  }

  function teken() {
    var houer = e("bg-wagkamer");
    if (!houer) return;

    if (!GELAAI) {
      houer.innerHTML = '<p class="stelsel-boodskap">' + wk_t("fp_laai", "Word gelaai \u2026") + "</p>";
      return;
    }
    // 'N LEE WAGKAMER WYS NIKS. 'n Permanente "geen indienings"-blok sou elke
    // dag ruimte vat vir 'n toestand wat die normaal is.
    if (!LYS.length) {
      houer.innerHTML = "";
      return;
    }

    houer.innerHTML =
      '<div class="wk-band">' +
        '<h3>' + wk_t("wk_titel", "Indienings wat wag") + "</h3>" +
        '<span class="wk-tel">' + LYS.length + "</span>" +
      "</div>" +
      LYS.map(kaart).join("");
  }

  function boodskap(kaart_el, teks, is_fout) {
    var p = kaart_el.querySelector("[data-boodskap]");
    if (!p) return;
    p.textContent = teks || "";
    p.className = "wk-boodskap" + (is_fout ? " fout" : "") + (teks ? " wys" : "");
  }

  /* ═══ laai ═══ */

  async function laai() {
    try {
      var resp = await fetch("/.netlify/functions/kry-begunstigde-indienings", {
        headers: await sessie_kop(),
      });
      if (!resp.ok) throw new Error("Status " + resp.status);
      var data = await resp.json();
      LYS = data.indienings || [];
    } catch (fout) {
      console.error("Kon nie die wagkamer laai nie:", fout);
      LYS = [];
    }
    GELAAI = true;
    teken();
  }

  /* ═══ handelinge ═══ */

  async function dra_oor(kaart_el) {
    var sleutel = kaart_el.dataset.sleutel;
    if (BESIG === sleutel) return;

    var naam = kaart_el.querySelector(".wk-naam").value.trim();
    var kode = kaart_el.querySelector(".wk-kode").value.trim();

    if (!naam) {
      boodskap(kaart_el, wk_t("wk_fout_naam", "Die naam is verplig."), true);
      return;
    }
    if (kode && kode.indexOf("ACCT_") !== 0) {
      boodskap(kaart_el, wk_t("wk_fout_kode", "Die kode moet met ACCT_ begin."), true);
      return;
    }

    BESIG = sleutel;
    boodskap(kaart_el, wk_t("wk_besig", "Besig \u2026"), false);

    try {
      var resp = await fetch("/.netlify/functions/dra-begunstigde-oor", {
        method: "POST",
        headers: await sessie_kop(),
        body: JSON.stringify({ sleutel: sleutel, naam: naam, subrekening_kode: kode }),
      });

      if (resp.status === 409) {
        // GEEN OORSKRYWING NIE. Die bestaande rekord kan reeds 'n subrekening
        // en 'n faktuurgeskiedenis dra. Wat hier hoort, is 'n mens se besluit.
        boodskap(kaart_el, wk_t("wk_bestaan",
          "Daar is reeds 'n begunstigde met hierdie naam. Verander die naam, of vee die indiening weg as dit dieselfde persoon is."), true);
        return;
      }
      if (!resp.ok) throw new Error("Status " + resp.status);

      var data = await resp.json();
      if (data.indiening_geskrap === false) {
        // Die rekord is geskep maar die indiening staan nog. Dit is die veilige
        // kant, en 'n mens moet dit weet — anders lyk dit soos werk wat nie
        // gedoen is nie en hy druk weer.
        boodskap(kaart_el, wk_t("wk_half",
          "Die begunstigde is geskep, maar die indiening kon nie geskrap word nie. Vee hom met die hand weg."), true);
        return;
      }

      verwyder_plaaslik(sleutel);
    } catch (fout) {
      console.error("Kon nie oordra nie:", fout);
      boodskap(kaart_el, wk_t("wk_fout", "Kon nie oordra nie. Probeer weer."), true);
    } finally {
      BESIG = "";
    }
  }

  async function vee_weg(kaart_el) {
    var sleutel = kaart_el.dataset.sleutel;
    if (BESIG === sleutel) return;

    // GEEN HERSTELPAD NIE, dus 'n bevestiging. Die indiening dra iemand se
    // bankbesonderhede en 'n mis-klik beteken hy moet weer gevra word.
    if (!window.confirm(wk_t("wk_vee_seker",
      "Vee hierdie indiening weg? Dit kan nie ongedaan gemaak word nie en die persoon sal weer moet indien."))) return;

    BESIG = sleutel;
    boodskap(kaart_el, wk_t("wk_besig", "Besig \u2026"), false);

    try {
      var resp = await fetch("/.netlify/functions/skrap-begunstigde-indiening", {
        method: "POST",
        headers: await sessie_kop(),
        body: JSON.stringify({ sleutel: sleutel }),
      });
      if (!resp.ok) throw new Error("Status " + resp.status);
      verwyder_plaaslik(sleutel);
    } catch (fout) {
      console.error("Kon nie die indiening skrap nie:", fout);
      boodskap(kaart_el, wk_t("wk_fout_vee", "Kon nie wegvee nie. Probeer weer."), true);
    } finally {
      BESIG = "";
    }
  }

  // DIE LYS WORD PLAASLIK BYGEWERK, NIE WEER GEVRA NIE. Blobs se list() loop
  // sowat vier sekondes agter; 'n herlaai sou die pas geskrapte indiening
  // TERUGBRING en dit sou lyk of niks gebeur het nie.
  function verwyder_plaaslik(sleutel) {
    LYS = LYS.filter(function (x) { return x.sleutel !== sleutel; });
    teken();
    // Die register langsaan dra nou 'n nuwe inskrywing.
    if (typeof bg_laai === "function") bg_laai();
  }

  /* ═══ aanhaak ═══ */

  document.addEventListener("DOMContentLoaded", function () {
    var houer = e("bg-wagkamer");
    if (!houer) return;

    houer.addEventListener("click", function (ev) {
      var kaart_el = ev.target.closest ? ev.target.closest(".wk-kaart") : null;
      if (!kaart_el) return;
      if (ev.target.closest(".wk-oor")) dra_oor(kaart_el);
      else if (ev.target.closest(".wk-vee")) vee_weg(kaart_el);
    });

    laai();
  });
})();
