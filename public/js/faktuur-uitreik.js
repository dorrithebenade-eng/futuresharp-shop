// public/js/faktuur-uitreik.js
//
// Die Reik uit-knoppie, sy bevestiging, en die betaalskakel daarna.
//
// 'N EIE LÊER, want dit is nuwe funksionaliteit. faktuur-vorm.js kry slegs
// een reël by: die knoppie moet saam met Stoor verdwyn wanneer sluit_toe()
// loop.
//
// DIT IS DIE ENIGSTE ONOMKEERBARE HANDELING IN DIE MODULE. Die nommer word
// getrek, Paystack word geroep, en die verdeling vries. Daarna word 'n
// faktuur GEKANSELLEER, nooit gewysig nie.
//
// DAAROM SÊ DIE BEVESTIGING WAT GAAN GEBEUR, NIE "IS JY SEKER" NIE. "Is jy
// seker" dra geen inligting; 'n mens klik dit weg. Wat 'n mens moet weet, is
// dat die nommer nou getrek word, dat die verdeling vries, en — die
// belangrikste reël op die skerm — HOEVEEL ONTVANGERS MET DIE HAND BETAAL
// MOET WORD. Daardie getal is die oomblik waarop 'n mens sien dat iemand nie
// 'n subrekening het nie, terwyl dit nog reggemaak kan word.
//
// V, SESSIE en KLIENTE is `let`/`const` op die boonste vlak van
// faktuur-vorm.js. Dié leef in die SCRIPT-skoop wat alle klassieke skrifte
// deel, maar hulle verskyn NIE op window nie — die kaal naam is die regte een.

const FU_KOPIEER_TYD = 1800;

// Die posstatus moet die herlaai ná uitreiking oorleef -- sien die nota by die
// herlaai self.
const FU_POS_SLEUTEL = "future_shop_faktuur_pos_fout";

/* EEN BLADSY, TWEE DOKUMENTE. Sien die kop van faktuur-vorm.js.

   `?soort=kwotasie` stuur die uitreiking na uitreik-kwotasie.js in plaas van
   stuur-faktuur.js. Alles anders bly dieselfde: die bevestiging, die
   ontvangerstelling, die stukkend-kontrole, die posstatus wat die herlaai
   oorleef.

   DIE EINDPUNT STAAN HIER EN NERENS ANDERS NIE. 'n fetch met 'n
   hardgekodeerde naam iewers in die lêer is presies hoe 'n kwotasie by
   stuur-faktuur.js beland en 'n FS-nommer opgebruik. */
const FU_IS_KW =
  new URLSearchParams(window.location.search).get("soort") === "kwotasie";

const FU_UITREIK_EIND = FU_IS_KW ? "uitreik-kwotasie" : "stuur-faktuur";

function fu_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function fu_ontsnap(waarde) {
  return String(waarde == null ? "" : waarde)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fu_rand(sent) {
  return window.t_rand ? t_rand(sent, kry_huidige_taal()) : "R" + (sent / 100).toFixed(2);
}

/* ═══ die skerm ═══ */

function fu_wys(html) {
  const paneel = document.getElementById("fu-paneel");
  // Die Druk-knoppie. Geen inline onclick nie — daardie attribuut het die
  // Betaal-knoppie se klik vir dae stilweg gekanselleer.
  // Kanselleer geld slegs 'n UITGEREIKTE faktuur. 'n Konsep het geen nommer,
  // dus laat hy geen gaping in die reeks nie en word hy geskrap.
  const kan = document.getElementById("fv-kanselleer");
  if (kan) {
    if (V.stand === "gestuur") {
      kan.style.display = "";
      kan.addEventListener("click", fu_vra_kanselleer);
    } else {
      kan.style.display = "none";
    }
  }

  const druk = document.getElementById("fv-druk");
  if (druk) druk.addEventListener("click", () => window.print());

  const skerm = document.getElementById("fu-skerm");
  if (!paneel || !skerm) return;
  paneel.innerHTML = html;
  skerm.hidden = false;
}

function fu_toe() {
  // Die Druk-knoppie. Geen inline onclick nie — daardie attribuut het die
  // Betaal-knoppie se klik vir dae stilweg gekanselleer.
  // Kanselleer geld slegs 'n UITGEREIKTE faktuur. 'n Konsep het geen nommer,
  // dus laat hy geen gaping in die reeks nie en word hy geskrap.
  const kan = document.getElementById("fv-kanselleer");
  if (kan) {
    if (V.stand === "gestuur") {
      kan.style.display = "";
      kan.addEventListener("click", fu_vra_kanselleer);
    } else {
      kan.style.display = "none";
    }
  }

  const druk = document.getElementById("fv-druk");
  if (druk) druk.addEventListener("click", () => window.print());

  const skerm = document.getElementById("fu-skerm");
  if (skerm) skerm.hidden = true;
}

/* ═══ die telling ═══
   Dieselfde som as die backoffice en dieselfde som as stuur-faktuur.js — die
   gedeelde fs_invoer_uit_faktuur(). 'n Mens betaal 'n PERSOON, nie 'n ry nie,
   dus word per ontvanger getel en nie per verdelingsry nie. */
function fu_tel_ontvangers() {
  try {
    const u = fs_bereken(fs_invoer_uit_faktuur(V, (o) => bo_pad(o) === "split"));
    const name = new Map();
    (u.ontvangers || []).forEach((o) => {
      if (!o.naam || o.sent <= 0) return;
      name.set(o.naam, (name.get(o.naam) || 0) + o.sent);
    });
    let split = 0;
    let hoof = 0;
    name.forEach((_, naam) => {
      if (bo_pad(naam) === "split") split += 1;
      else hoof += 1;
    });
    return { split, hoof };
  } catch (fout) {
    console.error("Kon nie die ontvangers tel nie:", fout);
    return { split: 0, hoof: 0 };
  }
}

function fu_ontvangerwoord(n) {
  return n === 1
    ? fu_t("fu_ontvanger_een", "1 ontvanger")
    : `${n} ${fu_t("fu_ontvangers", "ontvangers")}`;
}

/* ═══ die bevestiging ═══ */

function fu_vra() {
  if (V.stand !== "konsep") return;

  // SONDER 'N KLIËNT-E-POS HET DIE PROFORMA NÊRENS OM HEEN TE GAAN NIE. Die
  // keer sit hier by uitreiking, nie by die kliënt nie: 'n onvolledige kliënt
  // kan gekies word en 'n konsep kan gebou word — jy weet dalk nog nie sy
  // e-pos terwyl jy die bedrae uitwerk nie.
  //
  // Die SELFOON keer nie. Sonder e-pos kan die proforma nie uitgaan nie;
  // sonder selfoon is dit bloot ongerieflik. Twee verskillende gewigte.
  if (!String((V.klient && V.klient.epos) || "").trim()) {
    fu_vra_epos();
    return;
  }

  const totaal = fu_totaal_sent();
  const gratis = totaal === 0;
  const tel = gratis ? { split: 0, hoof: 0 } : fu_tel_ontvangers();

  const rye = [
    `<div><dt>${
      FU_IS_KW ? fu_t("fd_gekwoteer_aan", "Gekwoteer aan") : fu_t("fu_aan", "Gefaktureer aan")
    }</dt><dd>${fu_ontsnap(V.klient.naam)}</dd></div>`,
    `<div><dt>${
      FU_IS_KW
        ? fu_t("fu_kw_gaan_aan", "Kwotasie gaan aan")
        : fu_t("fu_proforma_aan", "Proforma gaan aan")
    }</dt><dd>${fu_ontsnap(V.klient.epos)}</dd></div>`,
    `<div><dt>${
      FU_IS_KW ? fu_t("fd_totaal", "Totaal") : fu_t("fu_totaal", "Totaal verskuldig")
    }</dt><dd>${fu_rand(totaal)}</dd></div>`,
  ];

  if (gratis) {
    rye.push(
      `<div><dt>${fu_t("fu_betaalskakel", "Betaalskakel")}</dt><dd>${fu_t(
        "fu_geen_skakel",
        "Geen — die faktuur is klaar betaal"
      )}</dd></div>`
    );
  } else {
    rye.push(
      `<div><dt>${fu_t("fu_deur_paystack", "Uitbetaal deur Paystack")}</dt><dd>${fu_ontvangerwoord(
        tel.split
      )}</dd></div>`
    );
    // Hierdie ry is die belangrikste een op die skerm. 'n Ontvanger sonder 'n
    // subrekening kan nie deur Paystack betaal word nie, en sonder hierdie
    // getal lyk dit of almal outomaties betaal word.
    if (tel.hoof > 0) {
      rye.push(
        `<div class="fu-let-op"><dt>${fu_t(
          "fu_met_hand",
          "Met die hand oorbetaal"
        )}</dt><dd>${fu_ontvangerwoord(tel.hoof)}</dd></div>`
      );
    }
  }

  // NA die betalingsrye, want daardie ry gaan oor geld wat kan misluk en
  // hierdie een oor 'n aantekening wat later ontbreek.
  const sonder_kat = fu_reels_sonder_kategorie();
  if (sonder_kat > 0) {
    rye.push(
      `<div class="fu-let-op"><dt>${fu_t(
        "fu_sonder_kategorie",
        "Sonder kategorie"
      )}</dt><dd>${
        sonder_kat === 1
          ? fu_t("fu_sonder_kategorie_een", "een re\u00ebl")
          : sonder_kat + " " + fu_t("fu_sonder_kategorie_meer", "re\u00eble")
      }</dd></div>`
    );
  }

  fu_wys(`
    <h2>${fu_t("fu_vra_kop", "Reik hierdie faktuur uit?")}</h2>
    <p>${
      gratis
        ? fu_t(
            "fu_vra_teks_gratis",
            "'n Koepon het die bedrag tot niks verminder. Paystack word glad nie geroep nie en die faktuur gaan dadelik na Betaal. Daar is niks om te verdeel nie."
          )
        : fu_t(
            "fu_vra_teks",
            "Die volgende nommer word toegeken en die verdeling vries op wat nou op die skerm staan. Daarna kan die faktuur nie meer gewysig word nie — net gekanselleer."
          )
    }</p>
    <dl class="fu-lys">${rye.join("")}</dl>
    <div class="fu-knoppe">
      <button type="button" class="kaart-aksie fu-stil" id="fu-terug">${fu_t(
        "fu_terug",
        "Terug"
      )}</button>
      <button type="button" class="kaart-aksie fu-doen" id="fu-doen">${fu_t(
        "fu_reik_uit",
        "Reik uit"
      )}</button>
    </div>`);

  document.getElementById("fu-terug").addEventListener("click", fu_toe);
  document.getElementById("fu-doen").addEventListener("click", fu_doen);
}

/* HOEVEEL REELS GEEN KATEGORIE DRA.

   'n Uitgereikte faktuur is gevries. 'n Reel wat sonder kategorie uitgaan, sal
   nooit een kry nie, en sy bedrag staan vir altyd buite die staat se
   optelling. Dit is presies die restant wat die kategorie moes voorkom.

   DIT KEER NIE. 'n Kategorie is 'n aantekening vir die boeke, nie 'n
   voorwaarde vir 'n dokument -- anders staan 'n faktuur wat vandag moet uitgaan
   stil oor 'n reel wat later reggemaak kan word. Die skerm SE dit; jy besluit.
   Dieselfde gewig as die "met die hand oorbetaal"-ry hierbo: 'n let op, nie 'n
   hek nie.

   Die toets kom uit faktuur-backoffice.js sodat die twee skerms nie oor
   verskillende reels praat nie. Ontbreek daardie leer, val ons terug op
   dieselfde reel hier -- die knoppie moet werk al laai een skrip nie. */
function fu_reels_sonder_kategorie() {
  const toets =
    typeof window.bo_kat_ontbreek === "function"
      ? window.bo_kat_ontbreek
      : (r) => {
          if (!r || r.kategorie_id) return false;
          const naam = String(r.beskrywing || "").trim();
          const bedrag = Math.round(
            (Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0)
          );
          return Boolean(naam) || bedrag > 0;
        };
  return (V.reels || []).filter(toets).length;
}

function fu_totaal_sent() {
  const reelsom = (V.reels || []).reduce(
    (s, r) => s + Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0)),
    0
  );
  return Math.max(0, reelsom - (V.afslag_sent || 0)) + (V.skenking_sent || 0);
}

/* ═══ die e-pos wat ontbreek ═══ */

function fu_vra_epos() {
  fu_wys(`
    <h2>${fu_t("fu_geen_epos_kop", "Hierdie kliënt het nog geen e-posadres nie")}</h2>
    <div class="fu-keer">
      ${fu_t(
        "fu_geen_epos_teks",
        "Die proforma het dus nêrens om heen te gaan nie. Voeg dit hier by — die faktuur bly staan en die adres word by die kliënt se rekord gestoor."
      )}
      <label for="fu-epos">${fu_t("fu_epos_etiket", "E-posadres")}</label>
      <input type="email" id="fu-epos" autocomplete="off" inputmode="email">
      <p class="fu-keer-fout" id="fu-epos-fout" hidden></p>
    </div>
    <div class="fu-knoppe">
      <button type="button" class="kaart-aksie fu-stil" id="fu-terug">${fu_t(
        "fu_terug",
        "Terug"
      )}</button>
      <button type="button" class="kaart-aksie fu-doen" id="fu-epos-stoor">${fu_t(
        "fu_stoor_gaan_voort",
        "Stoor en gaan voort"
      )}</button>
    </div>`);

  document.getElementById("fu-terug").addEventListener("click", fu_toe);
  document.getElementById("fu-epos-stoor").addEventListener("click", fu_stoor_epos);
  const veld = document.getElementById("fu-epos");
  if (veld) {
    veld.focus();
    veld.addEventListener("keydown", (e) => {
      if (e.key === "Enter") fu_stoor_epos();
    });
  }
}

async function fu_stoor_epos() {
  const veld = document.getElementById("fu-epos");
  const fout = document.getElementById("fu-epos-fout");
  const knop = document.getElementById("fu-epos-stoor");
  if (!veld) return;

  const epos = veld.value.trim();
  const wys_fout = (teks) => {
    if (!fout) return;
    fout.textContent = teks;
    fout.hidden = false;
  };
  if (fout) fout.hidden = true;

  if (!epos || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epos)) {
    wys_fout(fu_t("fu_epos_ongeldig", "Dit lyk nie soos 'n e-posadres nie."));
    veld.focus();
    return;
  }

  // DIE HELE REKORD GAAN TERUG, nie net die e-pos nie. stoor-klient.js
  // vervang die rekord se velde; stuur 'n mens 'n halwe rekord, verdwyn die
  // soort, die kontakpersoon en die adres stilweg.
  const bestaande = (KLIENTE || []).find((k) => k.nommer === V.klient_id);
  if (!bestaande) {
    wys_fout(fu_t("fu_klient_weg", "Kon nie die kliënt se rekord vind nie."));
    return;
  }

  knop.disabled = true;
  knop.textContent = fu_t("fu_besig", "Besig …");

  try {
    const resp = await fetch("/.netlify/functions/stoor-klient", {
      method: "POST",
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        nommer: bestaande.nommer,
        soort: bestaande.soort,
        naam: bestaande.naam,
        kontak: bestaande.kontak,
        epos,
        selfoon: bestaande.selfoon,
        adres: bestaande.adres,
      }),
    });
    if (!resp.ok) throw new Error(await resp.text());

    // PLAASLIK bygewerk, nie weer gevra nie. Blobs se list() loop sowat vier
    // sekondes agter en die ou adres sou terugkom.
    bestaande.epos = epos;
    V.klient.epos = epos;

    // Terug na die bevestiging, met die adres nou ingevul. Die faktuur is
    // nooit verlaat nie.
    fu_vra();
  } catch (fout_e) {
    console.error("Kon nie die kliënt se e-pos stoor nie:", fout_e);
    knop.disabled = false;
    knop.textContent = fu_t("fu_stoor_gaan_voort", "Stoor en gaan voort");
    wys_fout(fu_t("fu_epos_stoor_fout", "Kon nie die adres stoor nie. Probeer weer."));
  }
}

/* ═══ die uitreiking ═══ */

async function fu_doen() {
  const knop = document.getElementById("fu-doen");
  if (knop) {
    knop.disabled = true;
    knop.textContent = fu_t("fu_besig", "Besig …");
  }
  const terug = document.getElementById("fu-terug");
  if (terug) terug.disabled = true;

  try {
    const resp = await fetch("/.netlify/functions/" + FU_UITREIK_EIND, {
      method: "POST",
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify({ sleutel: V.sleutel }),
    });

    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();

    // DIE BLADSY WORD HERLAAI, met die NOMMER in die adresbalk. Die konsep se
    // sleutel bestaan nie meer nie — die rekord het na FS-01957 verhuis — en 'n
    // URL wat na 'n verdwene sleutel wys, is 'n bladsy wat 'n mens nie kan
    // herlaai nie. Die herlaai teken ook die hele skerm as toe, sonder dat
    // hierdie lêer weet hoe faktuur-vorm.js sy dokument bou.
    // DIE POSSTATUS MOET DIE HERLAAI OORLEEF. stuur-faktuur.js gee
    // `pos_gestuur` en `pos_fout` terug met 'n kommentaar wat sê die skerm moet
    // eerlik wees oor of die pos uitgegaan het -- en tot nou toe het hierdie
    // lêer albei weggegooi deur te herlaai. Reik 'n mens 'n faktuur uit terwyl
    // SMTP af is, het die skerm niks gesê nie en 'n mens neem aan die kliënt
    // het sy faktuur.
    //
    // sessionStorage, nie die URL nie: 'n mislukte pos is nie deel van die
    // faktuur se adres nie, en 'n mens moet dit nie per ongeluk kan aanstuur.
    // Dit word gelees en DADELIK verwyder -- 'n tweede herlaai wys dit nie
    // weer nie, want dan is dit ou nuus.
    try {
      if (data.pos_gestuur === false) {
        sessionStorage.setItem(FU_POS_SLEUTEL, String(data.pos_fout || ""));
      } else {
        sessionStorage.removeItem(FU_POS_SLEUTEL);
      }
    } catch {
      // 'n Blaaier wat sessionStorage weier, mag nie die uitreiking keer nie.
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("sleutel");
    url.searchParams.set("nommer", data.nommer);
    window.location.replace(url.toString());
  } catch (fout) {
    console.error("Kon nie die faktuur uitreik nie:", fout);
    fu_wys(`
      <h2>${fu_t("fu_fout_kop", "Kon nie die faktuur uitreik nie")}</h2>
      <div class="fu-fout">
        <b>${fu_t(
          "fu_fout_konsep",
          "Die faktuur bly 'n konsep."
        )}</b> ${fu_t(
      "fu_fout_nommer",
      "Niks is verlore nie en die nommer is nie opgebruik nie — die volgende poging kry dieselfde een."
    )}
        <p class="fu-fout-rede">${fu_ontsnap(String(fout.message || "").trim())}</p>
      </div>
      <div class="fu-knoppe">
        <button type="button" class="kaart-aksie fu-stil" id="fu-terug">${fu_t(
          "fu_terug",
          "Terug"
        )}</button>
        <button type="button" class="kaart-aksie fu-doen" id="fu-doen">${fu_t(
          "fu_probeer_weer",
          "Probeer weer"
        )}</button>
      </div>`);
    document.getElementById("fu-terug").addEventListener("click", fu_toe);
    document.getElementById("fu-doen").addEventListener("click", fu_doen);
  }
}

/* ═══ kanselleer ═══

   'n Uitgereikte faktuur word nie gewysig en nie uitgevee nie. Hy dra 'n
   nommer in 'n deurlopende reeks, en die punt van daardie reeks is dat 'n
   gaping SIGBAAR is. Wil 'n mens iets verander, word gekanselleer en 'n NUWE
   uitgereik.

   DIE REDE IS VERPLIG. Ses maande later is "waarom is FS/01957 gekanselleer?"
   'n boekhoudkundige vraag, en 'n gaping sonder 'n rede is presies wat 'n
   ouditeur vra. */
function fu_vra_kanselleer() {
  fu_wys(`
    <h2>${fu_t("fk_vra_kop", "Kanselleer hierdie faktuur?")}</h2>
    <p>${fu_t(
      "fk_vra_teks",
      "Die faktuur bly staan as rekord, met sy nommer, maar hy word dood gemerk. Wil jy iets verander, word 'n nuwe uitgereik."
    )}</p>

    <label class="fu-etiket" for="fk-rede">${fu_t("fk_rede", "Rede")}</label>
    <textarea class="fu-teksveld" id="fk-rede" rows="2" maxlength="300"></textarea>
    <p class="fu-keer-fout" id="fk-rede-fout" hidden></p>

    <div class="fu-knoppe">
      <button type="button" class="kaart-aksie fu-stil" id="fu-terug">${fu_t(
        "fu_terug",
        "Terug"
      )}</button>
      <button type="button" class="kaart-aksie fu-doen fu-gevaar" id="fk-doen">${fu_t(
        "fk_bevestig",
        "Kanselleer die faktuur"
      )}</button>
    </div>`);

  document.getElementById("fu-terug").addEventListener("click", fu_toe);
  document.getElementById("fk-doen").addEventListener("click", fu_kanselleer);
  const veld = document.getElementById("fk-rede");
  if (veld) veld.focus();
}

async function fu_kanselleer() {
  const veld = document.getElementById("fk-rede");
  const fout_el = document.getElementById("fk-rede-fout");
  const knop = document.getElementById("fk-doen");
  const rede = veld ? veld.value.trim() : "";

  if (fout_el) fout_el.hidden = true;
  if (rede.length < 3) {
    if (fout_el) {
      fout_el.textContent = fu_t("fk_rede_kort", "Gee 'n rede vir die kansellasie.");
      fout_el.hidden = false;
    }
    if (veld) veld.focus();
    return;
  }

  knop.disabled = true;
  knop.textContent = fu_t("fu_besig", "Besig …");

  try {
    const resp = await fetch("/.netlify/functions/kanselleer-faktuur", {
      method: "POST",
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify({ sleutel: V.sleutel, rede }),
    });
    if (!resp.ok) throw new Error(await resp.text());

    // Herlaai, sodat die hele skerm as gekanselleer teken sonder dat hierdie
    // lêer weet hoe faktuur-vorm.js sy dokument bou.
    window.location.reload();
  } catch (fout) {
    console.error("Kon nie die faktuur kanselleer nie:", fout);
    knop.disabled = false;
    knop.textContent = fu_t("fk_bevestig", "Kanselleer die faktuur");
    if (fout_el) {
      fout_el.textContent =
        String(fout.message || "").trim() ||
        fu_t("fk_fout", "Kon nie die faktuur kanselleer nie.");
      fout_el.hidden = false;
    }
  }
}

/* ═══ die QR op die dokument ═══

   Die QR is NIE vir Dorrithé nie. 'n Mens skandeer nie sy eie skerm nie; die
   kode is daar om aan iemand te WYS, en veral om op papier te druk. Op 'n
   gedrukte faktuur is hy die enigste pad na die betaalskakel — 'n knoppie op
   papier is 'n leë blokkie.

   HY IS DIESELFDE STRING as die betaalskakel, kliëntkant gerender. Geen
   tweede bron, niks om uit sinchronisasie te raak nie.

   SVG en nie 'n canvas nie. 'n Canvas druk as 'n lae-resolusie prent; SVG
   druk skerp op enige drukker, en die gedrukte bladsy is die hele rede
   waarom hierdie kode bestaan. */
function fu_teken_qr() {
  const blok = document.getElementById("d-qr");
  const plek = document.getElementById("d-qr-kode");
  if (!blok || !plek) return;

  // 'N KONSEP KRY GEEN QR NIE. 'n Kode wat na niks lei, is erger as geen kode:
  // iemand skandeer hom en land op 'n foutbladsy.
  if (!V.betaalskakel || typeof qrcode !== "function") {
    blok.hidden = true;
    plek.innerHTML = "";
    return;
  }

  try {
    // typeNumber 0 laat die biblioteek self die kleinste weergawe kies wat die
    // data pas; "M" is die middelste foutkorreksie en is genoeg vir 'n kode
    // wat van 'n skoon gedrukte bladsy geskandeer word.
    const q = qrcode(0, "M");
    q.addData(V.betaalskakel);
    q.make();
    plek.innerHTML = q.createSvgTag({ scalable: true, margin: 0 });
    blok.hidden = false;
  } catch (fout) {
    console.error("Kon nie die QR teken nie:", fout);
    blok.hidden = true;
    plek.innerHTML = "";
  }
}

/* ═══ die betaalskakel daarna ═══
   'n STROOK MET 'N TITEL, dieselfde vorm as die kliëntvorm-skakel. Die titel
   is nie versiering nie: sonder 'n naam moet 'n mens elke keer die URL lees
   om te weet watter skakel dit is.

   Die skakel is die authorization_url wat Paystack reeds by uitreiking
   teruggegee het. Die QR is daardie selfde string, kliëntkant gerender — dit
   kom in die volgende stap, saam met die print-uitleg. */
// Het die proforma uitgegaan? Word EEN KEER gelees en dadelik verwyder.
//
// Dit gee 'n string terug wanneer die pos MISLUK het (moontlik leeg as die
// Function geen rede gegee het nie), en null wanneer alles reg was. Die
// onderskeid tussen "" en null is die hele punt: "" beteken "misluk, rede
// onbekend", nie "niks gebeur nie".
function fu_neem_pos_fout() {
  try {
    const waarde = sessionStorage.getItem(FU_POS_SLEUTEL);
    if (waarde === null) return null;
    sessionStorage.removeItem(FU_POS_SLEUTEL);
    return waarde;
  } catch {
    return null;
  }
}

function fu_teken_strook() {
  const plek = document.getElementById("fu-strook");
  if (!plek) return;

  if (V.stand === "konsep") {
    plek.innerHTML = "";
    return;
  }

  const nommer = fu_ontsnap(V.nommer || "");

  // DIE PROFORMA HET NIE UITGEGAAN NIE. Amber, nie koraal: die faktuur IS
  // uitgereik, die nommer is opgebruik en die betaalskakel leef -- daar is
  // niks om te stop nie. Wat oorbly, is werk: die skakel moet met die hand
  // aangestuur word.
  //
  // Die strook staan BO die betaalskakel, want dit sê presies wat 'n mens met
  // daardie skakel moet doen.
  const pos_fout = fu_neem_pos_fout();
  let waarsku = "";
  if (pos_fout !== null) {
    waarsku = `<div class="fu-strook fu-strook-wag">
      <h4>${fu_t("fu_pos_kop", "Die proforma het nie uitgegaan nie")}</h4>
      <p class="fu-strook-teks">${fu_t(
        "fu_pos_teks",
        "Die faktuur is uitgereik en die betaalskakel werk. Stuur die skakel hieronder self aan die kli\u00ebnt."
      )}${pos_fout ? ` <span class="fu-strook-rede">${fu_ontsnap(pos_fout)}</span>` : ""}</p>
    </div>`;
  }

  if (!V.betaalskakel) {
    // 'n R0-faktuur, of een wat gekanselleer is. Geen skakel om te wys nie,
    // en 'n leë strook sou soos 'n fout lyk.
    if (V.stand === "betaal") {
      plek.innerHTML = waarsku + `<div class="fu-strook">
        <h4>${nommer} — ${fu_t("fu_betaal", "betaal")}</h4>
        <p class="fu-strook-teks">${fu_t(
          "fu_gratis_teks",
          "Die bedrag was nul, dus is Paystack nie geroep nie. Die faktuur is aangeteken as betaal en daar is niks om te verdeel nie."
        )}</p>
      </div>`;
      return;
    }
    // Geen skakel en nie betaal nie -- 'n gekanselleerde faktuur. Die
    // waarskuwing bly steeds staan as sy daar is: die proforma het nie
    // uitgegaan nie, en dit is 'n feit oor hierdie faktuur ongeag sy stand.
    plek.innerHTML = waarsku;
    return;
  }

  plek.innerHTML = waarsku + `<div class="fu-strook">
    <h4>${nommer} — ${fu_t("fu_betaalskakel", "Betaalskakel")}</h4>
    <div class="fu-skakel-ry">
      <code id="fu-skakel">${fu_ontsnap(V.betaalskakel)}</code>
      <button type="button" class="fu-mini" id="fu-kopieer">${fu_t(
        "fu_kopieer",
        "Kopieer"
      )}</button>
      <button type="button" class="fu-mini" id="fu-deel" hidden>${fu_t("fu_deel", "Deel")}</button>
    </div>
  </div>`;

  const kopieer = document.getElementById("fu-kopieer");
  kopieer.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(V.betaalskakel);
      kopieer.textContent = fu_t("fu_gekopieer", "Gekopieer");
      setTimeout(() => {
        kopieer.textContent = fu_t("fu_kopieer", "Kopieer");
      }, FU_KOPIEER_TYD);
    } catch (fout) {
      console.error("Kon nie kopieer nie:", fout);
    }
  });

  // Deel bestaan nie op 'n rekenaarblaaier nie. 'n Knoppie wat niks doen nie,
  // is erger as geen knoppie — hy verskyn slegs waar hy werk.
  const deel = document.getElementById("fu-deel");
  if (navigator.share) {
    deel.hidden = false;
    deel.addEventListener("click", () => {
      navigator
        .share({ title: V.nommer || "", url: V.betaalskakel })
        .catch(() => {});
    });
  }
}

/* ═══ begin ═══ */

(async function fu_begin() {
  // faktuur-vorm.js se DOMContentLoaded loop eerste en stel SESSIE en V.
  // Hierdie een wag daarop sonder om die bladsy op te hou.
  for (let i = 0; i < 60 && !SESSIE; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!SESSIE) return;

  // WAG OP DIE SEIN, NIE OP 'N KLOK NIE. laai_faktuur() is 'n netwerkoproep;
  // 'n vaste 60 ms is 'n raaiskoot wat op 'n stadige verbinding misluk, en dan
  // lees hierdie lêer 'n uitgereikte faktuur as 'n konsep — die betaalskakel
  // verskyn nooit en die knoppie staan waar hy nie hoort nie.
  for (let i = 0; i < 60 && !FV_GELAAI; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
  }

  const knop = document.getElementById("fv-uitreik");
  if (knop) {
    if (V.stand === "konsep") {
      knop.style.display = "";
      knop.addEventListener("click", fu_vra);
    } else {
      knop.style.display = "none";
    }
  }

  // Die Druk-knoppie. Geen inline onclick nie — daardie attribuut het die
  // Betaal-knoppie se klik vir dae stilweg gekanselleer.
  // Kanselleer geld slegs 'n UITGEREIKTE faktuur. 'n Konsep het geen nommer,
  // dus laat hy geen gaping in die reeks nie en word hy geskrap.
  const kan = document.getElementById("fv-kanselleer");
  if (kan) {
    if (V.stand === "gestuur") {
      kan.style.display = "";
      kan.addEventListener("click", fu_vra_kanselleer);
    } else {
      kan.style.display = "none";
    }
  }

  const druk = document.getElementById("fv-druk");
  if (druk) druk.addEventListener("click", () => window.print());

  const skerm = document.getElementById("fu-skerm");
  if (skerm) {
    // Klik op die agtergrond sluit. Escape ook — 'n oorlegsel waaruit 'n mens
    // nie met Escape kan kom nie, voel soos 'n vasgekeerde bladsy.
    skerm.addEventListener("click", (e) => {
      if (e.target === skerm) fu_toe();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !skerm.hidden) fu_toe();
    });
  }

  fu_teken_strook();
  fu_teken_qr();
})();
