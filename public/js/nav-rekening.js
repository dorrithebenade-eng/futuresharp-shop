// public/js/nav-rekening.js
//
// Twee verantwoordelikhede, albei nav-verwant, saam hier om nie 'n
// nuwe skrip-tag op al nege bladsye te hoef byvoeg nie (hierdie lêer is
// reeds oral gelaai):
//
// 1. Mobiele hamburger-kieslys — op smal skerms word die nav-regs-
//    inhoud (Mandjie, rekening, taal) 'n verskuilde skyfie-paneel wat
//    met 'n hamburger-knoppie oop-/toegemaak word (soortgelyk aan die
//    algemene "volskerm-oorvloei-menu"-patroon).
// 2. Rekening-aftrekkieslys — soos voorheen: "Meld aan", of e-pos +
//    "My Boeke"/"Paneelbord" + "Meld af" vir wie aangemeld is.
//
// Vereis identiteit.js reeds gelaai. Vereis die bestaande mini-kop-
// merk-op (mini-kop-inner > mini-kop-regs > #nav-rekening-plek).

// --- 3. Die hoofskakels (November 2026) ---
// Boeke, Video's, Kursusse, My Leeskamer en Kontak, vir ELKE besoeker, ook
// wie nie aangemeld is nie. Voorheen het 'n besoeker net Kursusse en Kontak
// gesien en nooit agtergekom dat daar 'n Leeskamer is nie. Een plek om te
// onderhou i.p.v. al die aparte HTML-lêers.
//
// Kursusse is 'n eksterne skakel en maak in 'n nuwe oortjie oop, sodat 'n
// koper nie die winkel verloor nie. Die skakel van die bladsy waarop die
// besoeker is, kry .mini-kop-skakel--aktief (koraal onderstreep).
(function () {
  const regs = document.querySelector(".mini-kop-regs");
  if (!regs) return;
  const tt = (sleutel, terug) => (window.t ? window.t(sleutel) : terug);
  const pad = window.location.pathname.replace(/\/+$/, "") || "/";
  const blad = pad.split("/").pop() || "index.html";

  const skakels = [
    { href: "index.html#katalogus-rooster", teks: tt("nav_boeke", "Boeke"), aktief: blad === "produk.html" },
    { href: "/talks", teks: tt("nav_videos", "Video's"), aktief: /^\/(talks|talk|teater)/.test(pad) },
    { href: "https://www.futuresharp.co/courses", teks: tt("nav_kursusse", "Kursusse"), ekstern: true },
    { href: "my-boeke.html", teks: tt("my_boeke_titel", "My Leeskamer"), aktief: blad === "my-boeke.html" },
    { href: "kontak.html", teks: tt("nav_kontak", "Kontak"), aktief: blad === "kontak.html" },
  ];

  const groep = document.createElement("nav");
  groep.className = "mini-kop-hoofskakels";
  groep.setAttribute("aria-label", tt("nav_hoof", "Hoofkieslys"));
  for (const s of skakels) {
    const a = document.createElement("a");
    a.href = s.href;
    a.className = "mini-kop-kursusse-skakel" + (s.aktief ? " mini-kop-skakel--aktief" : "");
    a.textContent = s.teks;
    if (s.ekstern) { a.target = "_blank"; a.rel = "noopener"; }
    if (s.aktief) a.setAttribute("aria-current", "page");
    groep.appendChild(a);
  }
  regs.insertBefore(groep, regs.firstChild);
})();

// --- 5. Die voet (November 2026) ---
// Een voet vir elke winkelbladsy, hier ingevoeg om dieselfde rede as die
// skakels hierbo. "Vir skrywers" maak die skrywersafdeling op die
// Kontak-bladsy oop (kontak.js lees #skrywer).
(function () {
  if (document.querySelector(".winkel-voet")) return;
  const tt = (sleutel, terug) => (window.t ? window.t(sleutel) : terug);
  const voet = document.createElement("footer");
  voet.className = "winkel-voet";
  voet.innerHTML = `
    <div class="winkel-voet-binne">
      <span>${tt("voet_inisiatief_a", "'n Inisiatief van")} <b>Future Sharp</b></span>
      <span class="winkel-voet-skakels">
        <a href="kontak.html">${tt("nav_kontak", "Kontak")}</a>
        <a href="kontak.html#skrywer">${tt("voet_vir_skrywers", "Vir skrywers")}</a>
      </span>
    </div>`;
  const doel = () => document.body.appendChild(voet);
  if (document.body) doel(); else document.addEventListener("DOMContentLoaded", doel);
})();

// --- 1. Mobiele hamburger-kieslys (loop ongeag aanmeld-status) ---
(function () {
  const inner = document.querySelector(".mini-kop-inner");
  const regs = document.querySelector(".mini-kop-regs");
  if (!inner || !regs) return;

  const hamburger = document.createElement("button");
  hamburger.type = "button";
  hamburger.className = "mini-kop-hamburger";
  hamburger.setAttribute("aria-label", "Kieslys");
  hamburger.setAttribute("aria-expanded", "false");
  hamburger.innerHTML = "<span></span><span></span><span></span>";

  const toemaak_knoppie = document.createElement("button");
  toemaak_knoppie.type = "button";
  toemaak_knoppie.className = "mini-kop-regs-toemaak";
  toemaak_knoppie.setAttribute("aria-label", "Maak kieslys toe");
  toemaak_knoppie.textContent = "✕";

  const agtergrond = document.createElement("div");
  agtergrond.className = "mini-kop-regs-agtergrond";

  // Die taal-wisselaar bly ALTYD sigbaar in die kopbalk, ook op mobiel
  // — ons kloon dit in 'n aparte, altyd-sigbare balkie langs die
  // hamburger, en verskuil die oorspronklike een (binne die skyfie-
  // paneel) net op mobiel via CSS, om duplisering te vermy. taal.js se
  // eie DOMContentLoaded-luisteraar (wat .taal-knoppie-elemente aan
  // kliek-hanteerders koppel) loop eers NÁ hierdie sinkrone kode, so
  // die kloon se knoppies word ook korrek gekoppel.
  const mobiel_balk = document.createElement("div");
  mobiel_balk.className = "mini-kop-mobiel-balk";

  const taal_oorspronklik = regs.querySelector(".taal-wisselaar");
  if (taal_oorspronklik) {
    const taal_kloon = taal_oorspronklik.cloneNode(true);
    mobiel_balk.appendChild(taal_kloon);
  }
  // DIE MANDJIE MOET OP 'N FOON SIGBAAR BLY.
  //
  // By 640px skuif .mini-kop-regs — met die mandjie en sy teller daarin —
  // heeltemal in die skyfie-paneel in. 'n Koper wat 'n boek insit, sien dus
  // NIKS gebeur nie, en weet ook nie waarheen om te gaan nie. 'n Mandjie wat
  // 'n mens nie sien nie, voel soos 'n knoppie wat niks gedoen het nie.
  //
  // Ons sit hom dus in die altyd-sigbare balkie, links van die taal-
  // wisselaar. Die ikoon bly staan al is die mandjie leeg — een wat eers
  // verskyn wanneer daar iets in is, laat 'n mens die eerste keer soek.
  const kop_mandjie = document.createElement("a");
  kop_mandjie.href = "mandjie.html";
  kop_mandjie.className = "kop-mandjie";
  kop_mandjie.setAttribute("aria-label", window.t ? window.t("nav_mandjie") : "Mandjie");
  kop_mandjie.innerHTML =
    '<svg class="mandjie-ikoon" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle>' +
    '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>' +
    '</svg><span class="kop-mandjie-teller" id="kop-mandjie-teller"></span>';
  // Heel links in die balkie, voor die taal-wisselaar: die mandjie is die
  // ding waarheen 'n koper op pad is, nie 'n instelling nie.
  mobiel_balk.insertBefore(kop_mandjie, mobiel_balk.firstChild);

  mobiel_balk.appendChild(hamburger);

  inner.insertBefore(mobiel_balk, regs.nextSibling);
  regs.insertBefore(toemaak_knoppie, regs.firstChild);
  inner.parentElement.insertBefore(agtergrond, inner.nextSibling);

  function maak_oop() {
    regs.classList.add("mini-kop-regs-oop");
    agtergrond.classList.add("mini-kop-regs-agtergrond-oop");
    hamburger.setAttribute("aria-expanded", "true");
  }
  function maak_toe() {
    regs.classList.remove("mini-kop-regs-oop");
    agtergrond.classList.remove("mini-kop-regs-agtergrond-oop");
    hamburger.setAttribute("aria-expanded", "false");
  }

  hamburger.addEventListener("click", maak_oop);
  toemaak_knoppie.addEventListener("click", maak_toe);
  agtergrond.addEventListener("click", maak_toe);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") maak_toe();
  });
  // Maak toe as die skerm weer wyer as mobiel gemaak word (bv. rotasie).
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1024) maak_toe();
  });

  // --- Die teller, sonder om mandjie.js aan te raak ---
  //
  // mandjie.js se wys_mandjie_teller() ken net EEN element: #mandjie-teller,
  // binne die skyfie-paneel. In plaas daarvan om daardie funksie te wysig
  // (en dan twee plekke te hê wat dieselfde waarheid moet weet), kyk ons na
  // die bestaande teller en weerspieël hom. Dieselfde MutationObserver-
  // patroon as paneel-kieslys.js.
  //
  // Die voordeel: elke pad wat die mandjie verander — insit, verwyder,
  // leegmaak, of 'n bestelling wat deurgaan — werk die ou teller by, en
  // hierdie een volg vanself. Daar is niks om te vergeet nie.
  const kop_teller = kop_mandjie.querySelector("#kop-mandjie-teller");
  const bron = document.getElementById("mandjie-teller");

  function werk_teller_by(klop) {
    if (!kop_teller) return;
    const aantal = bron ? (bron.textContent || "").trim() : "";
    kop_teller.textContent = aantal;
    kop_teller.classList.toggle("wys", aantal !== "");

    // Een klop wanneer 'n item BYKOM. Dit is die sein dat iets gebeur het;
    // sonder dit lyk 'n suksesvolle byvoeging soos niks.
    if (klop && aantal !== "") {
      kop_mandjie.classList.remove("kop-mandjie-klop");
      void kop_mandjie.offsetWidth; // dwing die animasie om oor te begin
      kop_mandjie.classList.add("kop-mandjie-klop");
    }
  }

  if (bron) {
    let vorige = (bron.textContent || "").trim();
    new MutationObserver(() => {
      const nuwe = (bron.textContent || "").trim();
      const bygekom = nuwe !== "" && (vorige === "" || Number(nuwe) > Number(vorige));
      vorige = nuwe;
      werk_teller_by(bygekom);
    }).observe(bron, { childList: true, characterData: true, subtree: true });
  }

  // Die eerste teken: mandjie.js roep wys_mandjie_teller() by
  // DOMContentLoaded, ná hierdie sinkrone kode, dus wag ons daarvoor.
  document.addEventListener("DOMContentLoaded", () => werk_teller_by(false));
  werk_teller_by(false);
})();

// --- Is hierdie koper ook 'n outeur? ---
//
// 'n Outeur het GEEN eie Identity-rol nie (sien kry-my-outeur.js) — die
// enigste manier om te weet, is om te vra. Dit gebeur op 11 bladsye, dus
// word die antwoord vir die sessie gekas: een oproep per aanmelding, nie
// een per bladsy nie.
//
// Misluk die oproep, wys ons eenvoudig geen skakel nie. 'n Ontbrekende
// skakel is 'n ongerief; 'n skakel wat 'n 404 gee, is 'n fout.
//
// DIE KAS HANG AAN DIE GEBRUIKER, nie net aan die oortjie nie. 'n Koper wat
// afmeld en as iemand anders in dieselfde oortjie weer aanmeld, kry 'n nuwe
// sessie maar dieselfde sessionStorage — sonder die e-pos in die waarde erf
// hy die vorige rekening se antwoord, en 'n gewone koper sien 'n
// "Outeurspaneel"-skakel wat vir hom 'n foutbladsy is. Dit het op 6 Aug
// gebeur.
//
// Dit vang ook die omgekeerde: word 'n aangemelde koper as outeur
// geregistreer, is sy gekaste "nee" nou aan sy e-pos gekoppel maar steeds
// vals tot die oortjie toegaan. Daarvoor is die skoonmaak by afmeld nie
// genoeg nie — dit bly 'n bekende beperking, en 'n nuwe oortjie los dit.
const NAV_OUTEUR_SLEUTEL = "future_shop_is_outeur";

function nav_outeur_kas_waarde(sessie, is_outeur) {
  const wie = (sessie && sessie.gebruiker && sessie.gebruiker.email) || "";
  return `${is_outeur ? "ja" : "nee"}:${wie}`;
}

// Besit hierdie koper al 'n talk? Net 'n JA word vir die sessie onthou:
// 'n NEE kan binne minute verander (die koper koop sy eerste talk en kom
// terug na die winkel), dus word dit elke keer opnuut gevra.
const NAV_TEATER_SLEUTEL = "future_shop_nav_teater";
// Is hierdie gebruiker 'n spreker? Net 'n JA word vir die sessie onthou.
const NAV_SPREKER_SLEUTEL = "future_shop_nav_spreker";
async function nav_is_spreker(sessie) {
  const ja = `${sessie.gebruiker.email}|ja`;
  try {
    if (sessionStorage.getItem(NAV_SPREKER_SLEUTEL) === ja) return true;
  } catch { /* vra net */ }
  try {
    const resp = await fetch("/.netlify/functions/kry-my-spreker?kort=1", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });
    if (!resp.ok) return false;
    try { sessionStorage.setItem(NAV_SPREKER_SLEUTEL, ja); } catch { /* nie krities nie */ }
    return true;
  } catch {
    return false;
  }
}

async function nav_het_talks(sessie) {
  const ja = `${sessie.gebruiker.email}|ja`;
  try {
    if (sessionStorage.getItem(NAV_TEATER_SLEUTEL) === ja) return true;
  } catch { /* sessionStorage geblokkeer: vra net */ }
  try {
    const resp = await fetch("/.netlify/functions/kry-my-talks", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });
    if (!resp.ok) return false;
    const het = ((await resp.json()).talks || []).length > 0;
    if (het) {
      try { sessionStorage.setItem(NAV_TEATER_SLEUTEL, ja); } catch { /* nie krities nie */ }
    }
    return het;
  } catch {
    return false;
  }
}

async function nav_is_outeur(sessie) {
  const verwag_ja = nav_outeur_kas_waarde(sessie, true);
  const verwag_nee = nav_outeur_kas_waarde(sessie, false);

  try {
    const gekas = sessionStorage.getItem(NAV_OUTEUR_SLEUTEL);
    // Enigiets anders — 'n ander rekening, of die ou formaat sonder e-pos —
    // word geignoreer en oorgeskryf.
    if (gekas === verwag_ja) return true;
    if (gekas === verwag_nee) return false;
  } catch {
    // sessionStorage kan geblokkeer wees — dan vra ons elke keer.
  }

  try {
    const resp = await fetch("/.netlify/functions/kry-my-outeur", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });
    const is_outeur = resp.ok;
    try {
      sessionStorage.setItem(NAV_OUTEUR_SLEUTEL, nav_outeur_kas_waarde(sessie, is_outeur));
    } catch {
      /* nie krities nie */
    }
    return is_outeur;
  } catch {
    return false;
  }

}

// --- 2. Rekening-aftrekkieslys ---
(async function () {
  const plek = document.getElementById("nav-rekening-plek");
  if (!plek) return;

  let sessie = null;
  try {
    sessie = await identiteit_kry_huidige_sessie();
  } catch {
    sessie = null;
  }

  if (!sessie) {
    const meld_aan_teks = window.t ? window.t("meld_aan_knoppie") : "Meld aan";
    plek.innerHTML = `<a href="aanmeld.html" class="mini-kop-rekening">${meld_aan_teks}</a>`;
    return;
  }

  // LET WEL: hierdie is die WINKEL-kant se rekening-nav — dit wys
  // ALTYD "My Boeke", nooit "Paneelbord" nie, ongeag of die
  // onderliggende rekening toevallig ook 'n personeel-rol het. Winkel-
  // en paneel-aanmelding is doelbewus volledig geskeide sessies (sien
  // identiteit.js) — 'n personeel-rekening wat hier aanmeld, word in
  // hierdie konteks bloot as 'n gewone koper behandel.
  //
  // Geen aftrekkieslys nie — e-pos, "My Boeke" en "Meld af" staan
  // reguit langs mekaar in die kopbalk. Op smal skerms val hulle
  // vanself in die bestaande mobiele skyfie-paneel (.mini-kop-regs)
  // in, saam met Mandjie en die taal-wisselaar — geen aparte
  // mobiel-hantering hier nodig nie.
  const my_boeke_teks = window.t ? window.t("my_boeke_titel") : "My Boeke";
  const meld_af_teks = window.t ? window.t("paneel_meld_af") : "Meld af";
  const inisiale = sessie.gebruiker.email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((deel) => deel[0].toUpperCase())
    .join("") || sessie.gebruiker.email.slice(0, 2).toUpperCase();

  plek.innerHTML = `
    <div class="nav-rekening-groep">
      <div class="nav-rekening-identiteit">
        <span class="nav-rekening-avatar" title="${sessie.gebruiker.email}" aria-hidden="true">${inisiale}</span>
        <span class="nav-rekening-epos-mobiel">${sessie.gebruiker.email}</span>
      </div>
      <a href="my-boeke.html" class="nav-rekening-skakel">${my_boeke_teks}</a>
      <button type="button" id="rekening-meld-af-knoppie" class="nav-rekening-skakel nav-rekening-skakel--gedemp">${meld_af_teks}</button>
    </div>
  `;

  document.getElementById("rekening-meld-af-knoppie").addEventListener("click", () => {
    identiteit_meld_af();
    window.location.href = "index.html";
  });

  // Die outeurspaneel-skakel kom NA die kop geteken is, want dit wag op 'n
  // bediener-antwoord. Hy word voor "My Boeke" ingevoeg: die outeur se eie
  // werk staan voor sy aankope.
  const is_outeur = await nav_is_outeur(sessie);
  if (is_outeur) {
    const groep = document.querySelector(".nav-rekening-groep");
    const my_boeke = groep && groep.querySelector('a[href="my-boeke.html"]');
    if (groep) {
      const skakel = document.createElement("a");
      skakel.href = "outeur.html";
      skakel.className = "nav-rekening-skakel";
      skakel.textContent = window.t ? window.t("nav_outeurspaneel") : "Outeurspaneel";
      groep.insertBefore(skakel, my_boeke);
    }
  }

  // "Sprekerspaneel" (FutureSharp Talks) net vir wie spreker is maar NIE
  // outeur nie. Wie albei is, gaan via die Outeurspaneel en skakel daar oor
  // (paneel-rol-skakelaar.js), sodat die kop nie nog 'n item kry nie.
  if (!is_outeur && (await nav_is_spreker(sessie))) {
    const groep = document.querySelector(".nav-rekening-groep");
    const my_boeke = groep && groep.querySelector('a[href="my-boeke.html"]');
    if (groep && !groep.querySelector('a[href="spreker.html"]')) {
      const skakel = document.createElement("a");
      skakel.href = "spreker.html";
      skakel.className = "nav-rekening-skakel";
      skakel.textContent = window.t ? window.t("nav_sprekerspaneel") : "Sprekerspaneel";
      groep.insertBefore(skakel, my_boeke);
    }
  }

  // "My Teater" (FutureSharp Talks) verskyn net vir wie al 'n talk besit,
  // direk ná "My Leeskamer".
  if (await nav_het_talks(sessie)) {
    const groep = document.querySelector(".nav-rekening-groep");
    const my_boeke = groep && groep.querySelector('a[href="my-boeke.html"]');
    if (groep && !groep.querySelector('a[href="/teater"]')) {
      const skakel = document.createElement("a");
      skakel.href = "/teater";
      skakel.className = "nav-rekening-skakel";
      skakel.textContent = window.t ? window.t("nav_my_teater") : "My Teater";
      groep.insertBefore(skakel, my_boeke ? my_boeke.nextSibling : null);
    }
  }
})();

// --- 4. (Afgeskakel November 2026) ---
// AF/EN het van September af links langs die handelsnaam gestaan. In die
// nuwe kop is daar minder items, en die woordmerk is groter; AF/EN bly dus
// regs in .mini-kop-regs, waar 'n besoeker dit verwag.
