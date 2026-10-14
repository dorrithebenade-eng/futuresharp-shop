// public/js/admin-kop.js
//
// DIE KOP VAN DIE ADMIN-PANELE. Eers opgestel 9 Okt 2026 in FS Integrated;
// op 14 Okt 2026 oorgebou na die ontwerp wat Dorrithé goedgekeur het (die
// "katalogus-kop"). Sien admin-kop.css vir die vorm.
//
// WAT HIERDIE LÊER DOEN
//   1. Die area-pille (deur paneel-area-pille.js gebou) skuif na die boonste
//      ry van die kop, links, met e-pos, Meld af en AF/EN regs.
//   2. Onder die ry kom die "held": die area se naam as groot titel, die
//      teal leusestrook met die hand en die spiraal, en regs die logo.
//   3. 'n Wit kaart oorvleuel die onderkant van die kop. Dit wys die afdeling
//      waarin 'n mens is, 'n kort beskrywing, en die bladsy se afdelings.
//
// DIE KAART RAAK NIE AAN DIE BLADSY SE EIE KIESLYS NIE. Die oorspronklike
// knoppies bly in die DOM (net versteek) en hou al hul luisteraars. Die kaart
// se knoppies is plaasvervangers wat die oorspronklike een klik, en die kaart
// volg die klas "aktief" van die oorspronklikes. So breek geen bladsy se eie
// logika nie, en 'n knoppie wat 'n ander lêer later byvoeg of verwyder
// (Groepskakels, rol-items), verskyn of verdwyn vanself.
//
// Governance het 'n vouerboom met subvouers, nie afdelings nie. Daar wys die
// kaart die vouer waarin 'n mens is, en die boom bly op die bladsy.

(function () {
  const BLADSY = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");

  const AREA_VAN_BLADSY = {
    paneelbord: "admin",
    governance: "governance",
    faktuurpaneel: "boekhouding",
    futuresharp: "futuresharp",
  };
  const AREA = AREA_VAN_BLADSY[BLADSY] || "admin";

  const TITELS = {
    admin: { af: "Admin", en: "Admin" },
    governance: { af: "Governance", en: "Governance" },
    boekhouding: { af: "Boekhouding", en: "Accounts" },
    futuresharp: { af: "Future Sharp", en: "Future Sharp" },
  };

  const LEUSE = {
    af: ["Begin met die einde in gedagte.", "Geniet die reis."],
    en: ["Begin with the end in mind.", "Take joy in the journey."],
  };

  // Die kaart per bladsy. houer: die blok wat net vir 'n aangemelde mens met
  // toegang wys; die kaart wys net wanneer hy wys. nav/items/sleutel: die
  // bladsy se eie afdelingsknoppies. besk: een reël per afdeling.
  const KAARTE = {
    paneelbord: {
      houer: "#paneel-inhoud",
      nav: "#paneel-sy-kieslys",
      items: ".paneel-kieslys-item",
      sleutel: "afdeling",
      besk: {
        af: {
          aflewering: "Bestellings wat afgelewer of gestuur moet word",
          bestellings: "Bestellings uit die winkel, met betaling en aflewering",
          dokumente: "Dokumente wat op die werf beskikbaar is",
          indienings: "Manuskripte en voorstelle wat ingedien is",
          katalogus: "Die boeke en produkte in die winkel",
          kategoriee: "Die kategorieë waarin die winkel se produkte staan",
          koepons: "Afslagkoepons vir die winkel",
          "ontwerp-admin": "Ontwerp- en administrasiewerk",
          outeurs: "Die outeurs en hul profiele",
          printing: "Drukwerk en harde kopieë",
          sprekers: "Sprekers vir FutureSharp TALKS",
          talks: "FutureSharp TALKS: sessies en registrasies",
          uitnodigings: "Uitnodigings wat uitgestuur is",
          vennote: "Die vennote en direkteure",
          "verdeling-rekenaar": "Bereken hoe inkomste verdeel word",
          waarskuwings: "Stelselwaarskuwings wat aandag nodig het",
        },
      },
    },
    faktuurpaneel: {
      houer: "#fp-paneel",
      nav: "#fp-kieslys",
      items: ".fp-pil",
      sleutel: "gaan",
      besk: {
        af: {
          fakture: "Fakture opstel, uitreik en stuur",
          kwotasies: "Kwotasies vir kliënte",
          registers: "Kliënte, begunstigdes, projekte en ander lyste",
          state: "Finansiële state en maandopsommings",
          joernaal: "Joernaalinskrywings",
          bankstate: "Bankstate invoer en vereffen",
          instellings: "Die boekhouding se instellings",
        },
        en: {
          fakture: "Draft, issue and send invoices",
          kwotasies: "Quotations for clients",
          registers: "Clients, beneficiaries, projects and other lists",
          state: "Financial statements and monthly summaries",
          joernaal: "Journal entries",
          bankstate: "Import and reconcile bank statements",
          instellings: "Accounting settings",
        },
      },
    },
    futuresharp: {
      houer: "#fsp-paneel",
      nav: "#fsp-kieslys",
      items: ".fsp-pil",
      sleutel: "gaan",
      besk: {
        af: {
          leerders: "Studievaardigheidskonsultasies: registrasies, datums en vraelyste",
          groepe: "Een skakel vir 'n hele skool of groep",
          vraelyste: "Die vraelyste en die boodskapsjablone",
        },
      },
    },
    governance: {
      houer: "#gov-paneel",
      titel_uit: "#gov-inhoud .gov-kaart-kop h2",
      vaste_besk: "Future Sharp NPC · Reg. nr. 2024/117444/08",
    },
  };

  function taal() {
    try {
      if (typeof kry_huidige_taal === "function") return kry_huidige_taal() === "en" ? "en" : "af";
    } catch (e) { /* val terug */ }
    return document.documentElement.lang === "en" ? "en" : "af";
  }

  function el(tag, klas, teks) {
    const e = document.createElement(tag);
    if (klas) e.className = klas;
    if (teks != null) e.textContent = teks;
    return e;
  }

  // ---------- Die held: titel, leuse, logo ----------
  function bou_held(kop) {
    if (kop.querySelector(":scope > .ak-held")) return;
    const t = taal();
    const held = el("div", "ak-held");
    const binne = el("div", "ak-binne ak-held-ry");

    const titel = el("div", "ak-titel", TITELS[AREA][t]);
    titel.setAttribute("role", "heading");
    titel.setAttribute("aria-level", "1");

    const leuse = el("div", "ak-leuse");
    leuse.appendChild(el("span", "ak-leuse-r", LEUSE[t][0]));
    leuse.appendChild(el("span", "ak-leuse-r", LEUSE[t][1]));
    const hand = el("img", "ak-hand");
    hand.src = "images/hand-spiraal.png";
    hand.alt = "";
    hand.setAttribute("aria-hidden", "true");
    leuse.appendChild(hand);

    const logo = el("img", "ak-logo");
    logo.src = "images/future-sharp-logo.png";
    logo.alt = "Future Sharp";

    binne.append(titel, logo, leuse);
    held.appendChild(binne);
    kop.appendChild(held);
  }

  // ---------- Die boonste ry: pille links ----------
  function plaas_pille() {
    const area = document.getElementById("paneel-area-kieslys");
    const kop = document.querySelector(".mini-kop");
    if (!area || !kop) return false;
    const inner = kop.querySelector(".mini-kop-inner");
    if (!inner) return false;
    area.classList.add("in-kop");
    if (area.parentNode !== inner) inner.insertBefore(area, inner.firstChild);
    document.body.classList.add("ak-pille-aan");
    return true;
  }

  // ---------- Die kaart ----------
  function bou_kaart() {
    const cfg = KAARTE[BLADSY];
    if (!cfg) return;
    const main = document.querySelector("main");
    if (!main || document.getElementById("ak-kaart")) return;

    const kaart = el("section", "ak-kaart");
    kaart.id = "ak-kaart";
    kaart.hidden = true;
    kaart.setAttribute("aria-label", "Afdelings");
    const teks = el("div", "ak-kaart-teks");
    const h2 = el("h2", "ak-kaart-titel");
    const p = el("p", "ak-kaart-besk");
    teks.append(h2, p);
    const oortjies = el("div", "ak-oortjies");
    oortjies.setAttribute("role", "tablist");
    const kies = el("select", "ak-kies");
    kies.setAttribute("aria-label", "Afdeling");
    kaart.append(teks, oortjies, kies);
    main.insertBefore(kaart, main.firstChild);

    const houer = document.querySelector(cfg.houer);
    const t = taal();
    const besk = (cfg.besk && (cfg.besk[t] || cfg.besk.af)) || {};

    function sigbaar(e) {
      return e && e.isConnected && getComputedStyle(e).display !== "none" && !e.hidden;
    }

    function items() {
      const nav = cfg.nav && document.querySelector(cfg.nav);
      if (!nav) return [];
      return Array.from(nav.querySelectorAll(cfg.items)).filter((b) => getComputedStyle(b).display !== "none");
    }

    let besig = false;
    function sinkroniseer() {
      if (besig) return;
      besig = true;
      try {
        const wys = sigbaar(houer);
        kaart.hidden = !wys;
        document.body.classList.toggle("ak-kaart-aan", wys);
        if (!wys) return;

        if (cfg.titel_uit) {
          const bron = document.querySelector(cfg.titel_uit);
          h2.textContent = bron ? bron.textContent.trim() : TITELS[AREA][t];
          p.textContent = cfg.vaste_besk || "";
          oortjies.replaceChildren();
          kies.replaceChildren();
          kaart.classList.add("sonder-oortjies");
          return;
        }

        const lys = items();
        const aktief = lys.find((b) => b.classList.contains("aktief")) || lys[0];
        if (aktief) {
          h2.textContent = aktief.textContent.trim();
          p.textContent = besk[aktief.dataset[cfg.sleutel]] || "";
        }
        kaart.classList.toggle("baie", lys.length > 4);

        const nuwe = lys.map((b) => {
          const o = el("button", "ak-oortjie" + (b === aktief ? " op" : ""), b.textContent.trim());
          o.type = "button";
          o.setAttribute("role", "tab");
          o.setAttribute("aria-selected", String(b === aktief));
          o.addEventListener("click", () => b.click());
          return o;
        });
        oortjies.replaceChildren(...nuwe);

        const opsies = lys.map((b, i) => {
          const o = el("option", "", b.textContent.trim());
          o.value = String(i);
          if (b === aktief) o.selected = true;
          return o;
        });
        kies.replaceChildren(...opsies);
        kies.onchange = () => { const b = lys[Number(kies.value)]; if (b) b.click(); };
      } finally {
        besig = false;
      }
    }

    let wag = 0;
    function later() {
      cancelAnimationFrame(wag);
      wag = requestAnimationFrame(sinkroniseer);
    }

    const kyker = new MutationObserver((veranderinge) => {
      // Ons eie kaart se veranderinge tel nie.
      if (veranderinge.every((v) => kaart.contains(v.target))) return;
      later();
    });
    kyker.observe(main, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    sinkroniseer();
  }

  // ---------- Breedte ----------
  // Die kop lyn op met die bladsy se eie inhoud: elke bladsy het sy eie
  // maksimum breedte, en die kop en kaart volg dit.
  function stel_breedte() {
    const main = document.querySelector("main");
    if (!main) return;
    const cs = getComputedStyle(main);
    const binne = main.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (binne > 200) document.documentElement.style.setProperty("--ak-breedte", Math.round(binne) + "px");
  }

  // ---------- "Vraelyste en verslae" se onderry ----------
  // paneel-verslae-pil.js sit sy skakelry direk onder die kop. In die nuwe kop
  // hoort dit binne die blou band, onder die pille.
  function plek_vir_vv(kop) {
    let plek = kop.querySelector(":scope > .ak-vv-plek");
    if (!plek) {
      plek = el("div", "ak-vv-plek");
      const inner = kop.querySelector(".mini-kop-inner");
      if (inner) inner.after(plek); else kop.prepend(plek);
    }
    return plek;
  }

  function begin() {
    const kop = document.querySelector(".mini-kop");
    if (!kop) return;
    document.body.classList.add("ak-kop", "ak-area-" + AREA);
    stel_breedte();
    window.addEventListener("resize", stel_breedte);
    plek_vir_vv(kop);
    bou_held(kop);
    bou_kaart();

    if (!plaas_pille()) {
      const kyker = new MutationObserver(() => { if (plaas_pille()) kyker.disconnect(); });
      kyker.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => kyker.disconnect(), 30000);
    }
    // paneel-area-pille.js skuif die ry op 'n draai van die foon terug; ons
    // luisteraar loop ná syne en sit hom weer in die kop.
    window.matchMedia("(max-width: 620px)").addEventListener("change", () => setTimeout(plaas_pille, 0));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin);
  } else {
    begin();
  }
})();
