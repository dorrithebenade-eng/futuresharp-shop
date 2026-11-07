const KATALOGUS_ENDPOINT = "/.netlify/functions/kry-katalogus";

const DEMO_PRODUKTE = [
  {
    slug: "voorbeeld-produk",
    titel: "Voorbeeld Titel",
    outeur: "Outeur Naam",
    oorsig: "In hierdie meesleurende verhaal volg ons 'n hoofkarakter wat op 'n reis van selfontdekking begin, aangedryf deur gebeure wat haar hele wêreld op sy kop keer. Met ryke beskrywings en onvergeetlike karakters neem die skrywer die leser op 'n reis vol spanning, humor en oomblikke van diepe insig. Elke hoofstuk bou op die vorige, en teen die tyd wat jy by die laaste bladsy kom, sal jy die boek nie kan neersit sonder om dadelik weer van voor af te wil begin lees nie. 'n Aanrader vir enigeen wat van pakkende, karaktergedrewe stories hou.",
    vol_beskrywing:
      "Hierdie is die volledige beskrywing van die boek. Dit kan verskeie paragrawe bevat wat die verhaal, tema, of doel van die boek verduidelik aan potensiële kopers.",
    omslag: "",
    formate: {
      eboek: { beskikbaar: true, prys_sent: 15000 },
      harde_kopie: { beskikbaar: true, prys_sent: 28000, vrystelling_datum: "2026-11-01" },
    },
  },
  {
    slug: "voorbeeld-produk-slegs-eboek",
    titel: "Nog 'n Voorbeeld Titel",
    outeur: "Outeur Naam",
    oorsig: "'n Intieme en eerlike vertelling wat lesers laat nadink oor die keuses wat ons daaglikse lewens vorm. Met 'n unieke stem en skerp waarneming van menslike verhoudinge, bou die skrywer 'n wêreld wat beide bekend en verrassend voel. Hierdie e-boek is ideaal vir wie 'n vinnige maar betekenisvolle leeservaring soek — kort genoeg om in 'n naweek te geniet, maar ryk genoeg om lank ná die laaste bladsy by jou te bly.",
    vol_beskrywing: "Volledige beskrywing hier.",
    omslag: "",
    formate: {
      eboek: { beskikbaar: true, prys_sent: 12000 },
      harde_kopie: { beskikbaar: false },
    },
  },
];

// R300 eerder as R300.00, soos op die boekkaarte (November 2026). Net waar
// daar werklik sente is, wys ons hulle.
function formateer_prys_sent(sent) {
  const rand = (sent || 0) / 100;
  const teks = Number.isInteger(rand) ? String(rand) : rand.toFixed(2).replace(".", ",");
  return "R" + teks.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
}

function kry_produk_slug_uit_url() {
  const params = new URLSearchParams(window.location.search);
  return params.get("produk");
}

// Lees die aangemelde koper se reeds-gekoopte e-boeke — dieselfde patroon
// as katalogus.js. Gee 'n leë Set terug (nooit 'n fout nie) as niemand
// aangemeld is nie, of as die versoek misluk — die produk-bladsy moet
// steeds normaal werk vir 'n besoeker sonder rekening.
async function kry_besit_info() {
  const leeg = { eboek_besit: new Set(), leen_aktief: new Map() };
  try {
    if (typeof identiteit_kry_huidige_sessie !== "function") return leeg;
    const sessie = await identiteit_kry_huidige_sessie();
    if (!sessie || !sessie.access_token) return leeg;

    const resp = await fetch("/.netlify/functions/kry-my-boeke", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });
    if (!resp.ok) return leeg;

    const data = await resp.json();
    const eboek_besit = new Set();
    const leen_aktief = new Map(); // produk_slug -> dae_oor
    (data.boeke || []).forEach((boek) => {
      if (boek.is_leen) {
        if (boek.leen_aktief) leen_aktief.set(boek.produk_slug, boek.dae_oor);
      } else {
        eboek_besit.add(boek.produk_slug);
      }
    });
    return { eboek_besit, leen_aktief };
  } catch (fout) {
    console.warn("Kon nie besit-status laai nie:", fout);
    return leeg;
  }
}

function bou_beskikbaar_merkers(eboek, hardeKopie, leen) {
  const merkers = [];
  if (eboek && eboek.beskikbaar) {
    merkers.push(`<button type="button" class="beskikbaar-merker beskikbaar-merker--eboek" data-formaat="eboek">📖 ${t("eboek_etiket")}</button>`);
  }
  if (hardeKopie && hardeKopie.beskikbaar) {
    merkers.push(`<button type="button" class="beskikbaar-merker beskikbaar-merker--hardekopie" data-formaat="harde_kopie">📦 ${t("hardekopie_etiket")}</button>`);
  }
  if (leen && leen.beskikbaar) {
    merkers.push(`<button type="button" class="beskikbaar-merker beskikbaar-merker--leen" data-formaat="leen" data-tydperk="${leen.tydperk_dae || 30}">⏳ ${t("leen_etiket")}</button>`);
  }
  if (!merkers.length) return "";
  return `
    <p class="beskikbaar-as-etiket">${t("beskikbaar_as_etiket")}</p>
    <div class="beskikbaar-merkers">${merkers.join("")}</div>
  `;
}

// Bou die ISBN-blok onderaan die beskrywing. Reëls:
//  · Geen ISBN → leë string, die hele blok verskyn nie.
//  · Albei nommers → twee reëls, elk met sy formaat-etiket.
//  · Net een nommer → die nommer alleen, sonder formaat-etiket ('n enkele
//    "E-boek: 978-…" sonder 'n tweede reël daarnaas lees onnodig).
//  · Leen kry NOOIT 'n eie reël nie — dis dieselfde PDF as die e-boek,
//    dus dieselfde nommer.
function bou_isbn_blok(produk) {
  const isbn = produk.isbn;
  if (!isbn) return "";

  const eboek = (isbn.eboek || "").trim();
  const harde_kopie = (isbn.harde_kopie || "").trim();
  if (!eboek && !harde_kopie) return "";

  let reels;
  if (eboek && harde_kopie) {
    reels = [
      `<div class="produk-isbn-ry"><span class="produk-isbn-formaat">${t("isbn_eboek")}</span><span class="produk-isbn-nommer">${eboek}</span></div>`,
      `<div class="produk-isbn-ry"><span class="produk-isbn-formaat">${t("isbn_hardekopie")}</span><span class="produk-isbn-nommer">${harde_kopie}</span></div>`,
    ].join("");
  } else {
    reels = `<div class="produk-isbn-ry"><span class="produk-isbn-nommer">${eboek || harde_kopie}</span></div>`;
  }

  return `
    <div class="produk-isbn-blok">
      <p class="produk-isbn-etiket">${t("isbn_etiket")}</p>
      ${reels}
    </div>
  `;
}

function bou_aksie_ry(produk, formaat, formaat_data, etiket, besit, leen_dae_oor) {
  // E-boeke wat die koper reeds besit — geen koop-knoppie nie, net 'n
  // duidelike "Alreeds joune"-merker met 'n skakel na die leser. Harde
  // kopieë word doelbewus NIE so beperk nie (geskenke/vervangingskopieë
  // is 'n geldige rede om weer te koop).
  if (formaat === "eboek" && besit) {
    return `
      <div class="produk-formaat-ry">
        <div class="produk-formaat-info">
          <span class="produk-formaat-etiket">${etiket}</span>
          <span class="produk-besit-merker">✅ ${t("reeds_gekoop")}</span>
        </div>
        <a class="kaart-aksie produk-alreeds-eie-knoppie" href="leser.html?boek=${produk.slug}">
          ${t("gaan_lees")}
        </a>
        ${bou_geskenk_knoppie(produk, formaat_data)}
      </div>
    `;
  }

  // 'n Aktiewe leen — wys hoeveel dae oor is, geen nuwe koop-knoppie nie.
  if (formaat === "leen" && typeof leen_dae_oor === "number") {
    return `
      <div class="produk-formaat-ry">
        <div class="produk-formaat-info">
          <span class="produk-formaat-etiket">${etiket}</span>
          <span class="produk-leen-aktief-merker">⏳ ${t("leen_dae_oor_voorvoegsel")} ${leen_dae_oor} ${leen_dae_oor === 1 ? t("dag_enkelvoud") : t("dae_oor_meervoud")}</span>
        </div>
        <a class="kaart-aksie produk-alreeds-eie-knoppie" href="leser.html?boek=${produk.slug}">
          ${t("gaan_lees")}
        </a>
      </div>
    `;
  }

  const knoppie_id = `voeg-by-mandjie-${formaat}`;
  const voorbestelling = is_voorbestelling(formaat_data);
  const knoppie_teks =
    formaat === "leen" ? t("leen_nou_knoppie") : voorbestelling ? t("voorbestel_nou") : t("voeg_by_mandjie");

  return `
    <div class="produk-formaat-ry">
      <div class="produk-formaat-info">
        <span class="produk-formaat-etiket">${etiket}</span>
        <span class="produk-formaat-prys">${formateer_prys_sent(formaat_data.prys_sent)}</span>
        ${formaat === "leen"
          ? `<span class="produk-leen-tydperk-nota">${t("leen_verduideliking").replace("%tydperk%", formaat_data.tydperk_dae || 30)}</span>`
          : ""}
        ${voorbestelling
          ? `<span class="produk-voorbestel-nota">${t("voorbestelling_beskikbaar_vanaf")} ${formateer_datum_af(formaat_data.vrystelling_datum)}</span>`
          : ""}
      </div>
      <button class="kaart-aksie produk-formaat-knoppie" id="${knoppie_id}"
        data-slug="${produk.slug}" data-formaat="${formaat}"
        data-titel="${produk.titel}" data-prys="${formaat_data.prys_sent}"
        data-voorbestelling="${voorbestelling}">
        ${knoppie_teks}
      </button>
      ${formaat === "eboek" ? bou_geskenk_knoppie(produk, formaat_data) : ""}
    </div>
  `;
}

// GESKENKE (November 2026): koop die e-boek vir iemand anders. Die boek gaan
// as geskenk in die mandjie; ná betaling kry die koper 'n eenmalige
// geskenkkode (sien netlify/functions/_geskenke.js). Ook as die koper die
// boek self reeds besit.
function bou_geskenk_knoppie(produk, formaat_data) {
  return `
    <button type="button" class="kaart-aksie produk-geskenk-knoppie"
      data-slug="${produk.slug}" data-titel="${titel_ontsnap(produk.titel)}" data-prys="${formaat_data.prys_sent}">
      🎁 ${t("geskenk_knoppie")}
    </button>
  `;
}

// --- Titel-vertoning vir reeksboeke ---
// 'n Boek in 'n reeks (met 'n eweknie of 'n reeks) se titel kan as
// "Reeks: Boektitel" gestoor word, bv. "Speel-Slim Fokus: Eerste Blik".
// Op die kaart en die produkbladsy word dit dan gestapel gewys:
//   SPEEL-SLIM        (eerste woord van die reeks, hoofletters)
//   Fokus             (res van die reeksnaam, skuinsdruk, as daar is)
//   Eerste Blik       (die boek se eie titel)
// Die gestoorde titel self bly gewone teks, sodat fakture, e-posse, die
// mandjie en die leeskamer dit steeds as een reël wys.
function titel_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function bou_titel_html(produk) {
  const titel = String(produk.titel || "");
  const is_reeks = !!(produk.eweknie_slug || (produk.reeks && produk.reeks.reeks_slug));
  const pas = titel.match(/^([^:]{2,40}):\s+(.+)$/);
  if (!is_reeks || !pas) return titel_ontsnap(titel);
  const reeks_woorde = pas[1].trim().split(/\s+/);
  const hoof = reeks_woorde.shift();
  const sub = reeks_woorde.join(" ");
  return `<span class="titel-reeks">${titel_ontsnap(hoof)}</span>`
    + (sub ? `<span class="titel-reeks-sub">${titel_ontsnap(sub)}</span>` : "")
    + `<span class="titel-boek">${titel_ontsnap(pas[2])}</span>`;
}

// DIE BOEKBLADSY (November 2026, fase 3). Groot omslag links op 'n
// roomkleurige vlak; regs die ry en boeknommer, die titel, die skrywer, die
// formate met hul knoppies, en direk daaronder waar die boek heen gaan (My
// Leeskamer). Onderaan "Meer uit hierdie ry" met die nuwe boekkaart.
//
// Die klasse wat ander skripte soek, bly: #produk-wrap, .produk-aksies,
// .produk-formaat-knoppie, .produk-geskenk-knoppie, .produk-alreeds-eie-knoppie
// (reekspakket.js sit sy blok ná .produk-aksies in).
function wys_produk(produk, besit_info, konteks) {
  document.title = `${produk.titel} — Future Shop`;

  const wrap = document.getElementById("produk-wrap");
  const kt = konteks || null;

  const omslagHtml = produk.omslag
    ? `<img class="produk-omslag pb-omslag" src="${produk.omslag}" alt="Omslag van ${titel_ontsnap(produk.titel)}">`
    : `<div class="produk-omslag pb-omslag" role="img" aria-label="Geen omslag beskikbaar vir ${titel_ontsnap(produk.titel)}"></div>`;

  const eboek = produk.formate && produk.formate.eboek;
  const hardeKopie = produk.formate && produk.formate.harde_kopie;
  const leen = produk.formate && produk.formate.leen;
  const besit_eboek = besit_info && besit_info.eboek_besit instanceof Set && besit_info.eboek_besit.has(produk.slug);
  const leen_dae_oor =
    besit_info && besit_info.leen_aktief instanceof Map && besit_info.leen_aktief.has(produk.slug)
      ? besit_info.leen_aktief.get(produk.slug)
      : null;

  const aksies = [];
  if (eboek && eboek.beskikbaar) {
    aksies.push(bou_aksie_ry(produk, "eboek", eboek, t("eboek_etiket"), besit_eboek));
  }
  if (hardeKopie && hardeKopie.beskikbaar) {
    aksies.push(bou_aksie_ry(produk, "harde_kopie", hardeKopie, t("hardekopie_etiket"), false));
  }
  // Geen leen-ry as die koper reeds die e-boek self besit nie — geen rede
  // om iets te huur wat jy klaar permanent het nie.
  if (leen && leen.beskikbaar && !besit_eboek) {
    aksies.push(bou_aksie_ry(produk, "leen", leen, t("leen_etiket"), false, leen_dae_oor));
  }

  // "Laat weet my" (November 2026): die harde kopie kom nog, en die boek se
  // merkie in die paneelbord vra of mense belangstel.
  if (produk.vra_harde_kopie === true && !(hardeKopie && hardeKopie.beskikbaar)) {
    aksies.push(bou_harde_kopie_belang(produk));
  }

  // Die ry waarin die boek op die Boeke-bladsy staan, en sy nommer.
  let ry = null;
  let lyn = "";
  if (kt && typeof bk_kode === "function") {
    const { kode, volgorde } = bk_kode(produk, kt.per_slug, kt.lidmaatskap);
    if (kode) {
      const naam = bk_afdeling_naam(kode, kt.afdelings_per_kode, produk);
      ry = { kode, naam };
      lyn = volgorde ? `${naam} · ${t("bk_boek")} ${volgorde}` : naam;
    }
  }
  const titel = typeof bk_kort_titel === "function" && ry ? bk_kort_titel(produk) : produk.titel;

  // Die eweknie in die ander taal.
  let eweknie_html = "";
  const e = produk.eweknie_slug && kt && kt.per_slug.get(produk.eweknie_slug);
  if (e && e.taal && e.taal !== produk.taal) {
    eweknie_html = `<p class="pb-eweknie">${t(e.taal === "en" ? "bk_ook_in_engels" : "bk_ook_in_afrikaans")}:
      <a href="produk.html?produk=${encodeURIComponent(e.slug)}">${titel_ontsnap(e.titel)}</a></p>`;
  }

  const leeskamer_html = eboek && eboek.beskikbaar
    ? `<p class="pb-leeskamer">${t("pb_leeskamer")}
        <button type="button" class="beskikbaar-merker pb-hoe" data-formaat="eboek">${t("pb_hoe_werk_dit")}</button></p>`
    : "";

  const krummel = `<nav class="pb-krummel" aria-label="Broodkrummels">
      <a href="boeke.html">${t("nav_boeke")}</a>
      ${ry ? `<span aria-hidden="true">/</span><a href="boeke.html#afdeling-${bk_anker(ry.kode)}">${titel_ontsnap(ry.naam)}</a>` : ""}
    </nav>`;

  wrap.innerHTML = `
    ${krummel}
    <div class="pb-uitleg">
      <div class="pb-beeld">${omslagHtml}</div>
      <div class="pb-inhoud">
        ${lyn ? `<p class="pb-lyn">${titel_ontsnap(lyn)}</p>` : ""}
        <h1 class="pb-titel">${titel_ontsnap(titel)}</h1>
        <p class="pb-outeur">${titel_ontsnap(produk.outeur || "")}</p>
        <div class="koop-afdeling pb-koop">
          <div class="produk-aksies">${aksies.join("")}</div>
          <p class="produk-nota" id="produk-terugvoer" role="status"></p>
        </div>
        ${leeskamer_html}
        ${eweknie_html}
        <div class="pb-oor">
          <h2 class="pb-oor-titel">${t("oor_hierdie_boek")}</h2>
          <p class="produk-beskrywing">${produk.vol_beskrywing || produk.oorsig || ""}</p>
          ${bou_isbn_blok(produk)}
        </div>
      </div>
    </div>
    <div id="pb-meer"></div>
  `;

  wys_meer_uit_ry(produk, ry, kt);

  wrap.querySelectorAll(".produk-formaat-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const { slug, formaat, titel, prys, voorbestelling } = knoppie.dataset;
      const resultaat = voeg_by_mandjie({
        produk_slug: slug,
        titel,
        formaat,
        prys_sent: Number(prys),
      });

      const terugvoer = document.getElementById("produk-terugvoer");
      if (resultaat.reeds_in_mandjie) {
        terugvoer.textContent = t("reeds_in_mandjie");
      } else {
        knoppie.textContent = voorbestelling === "true" ? t("voorbestel_teken") : t("in_mandjie_teken");
        knoppie.disabled = true;
        terugvoer.textContent =
          voorbestelling === "true" ? t("voorbestelling_bygevoeg") : t("bygevoeg_mandjie");
      }
    });
  });

  koppel_geskenk_knoppies(wrap);
  koppel_harde_kopie_belang(wrap);
}

// --- Harde kopie: "Laat weet my" ---
// Sien netlify/functions/_harde-kopie-belang.js. 'n Aangemelde koper hoef nie
// sy e-pos in te tik nie; die blokkie verdwyn sodra ons weet wie hy is. Ná
// aanmelding onthou die blaaier dit per boek, sodat die bedankie bly staan.
const HK_SLEUTEL = "future_shop_hk_belang";

function hk_onthou(slug) {
  try {
    const lys = JSON.parse(localStorage.getItem(HK_SLEUTEL) || "[]");
    if (!lys.includes(slug)) lys.push(slug);
    localStorage.setItem(HK_SLEUTEL, JSON.stringify(lys.slice(-200)));
  } catch {}
}
function hk_reeds(slug) {
  try {
    return JSON.parse(localStorage.getItem(HK_SLEUTEL) || "[]").includes(slug);
  } catch {
    return false;
  }
}

function bou_harde_kopie_belang(produk) {
  const reeds = hk_reeds(produk.slug);
  return `
    <div class="produk-formaat-ry hk-belang" data-slug="${titel_ontsnap(produk.slug)}">
      <div class="hk-kop">
        <span class="produk-formaat-etiket">${t("hardekopie_etiket")}</span>
        <span class="hk-binnekort">${t("hk_binnekort")}</span>
      </div>
      <p class="hk-teks">${t("hk_teks")}</p>
      <form class="hk-vorm" novalidate ${reeds ? "hidden" : ""}>
        <input type="email" class="veld-invoer hk-epos" name="epos" autocomplete="email"
          placeholder="${t("hk_epos_plek")}" aria-label="${t("hk_epos_plek")}">
        <input type="text" name="pot" class="hk-pot" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button type="submit" class="kaart-aksie hk-knoppie">${t("hk_knoppie")}</button>
      </form>
      <p class="hk-fout" role="alert" hidden></p>
      <p class="hk-dankie" role="status" ${reeds ? "" : "hidden"}>✓ ${t("hk_dankie")}</p>
      <p class="hk-privaat" ${reeds ? "hidden" : ""}>${t("hk_privaat")}</p>
    </div>
  `;
}

async function koppel_harde_kopie_belang(wrap) {
  const blok = wrap.querySelector(".hk-belang");
  if (!blok) return;
  const vorm = blok.querySelector(".hk-vorm");
  const epos_veld = blok.querySelector(".hk-epos");
  const fout = blok.querySelector(".hk-fout");
  const dankie = blok.querySelector(".hk-dankie");
  const privaat = blok.querySelector(".hk-privaat");
  const knoppie = blok.querySelector(".hk-knoppie");
  const slug = blok.dataset.slug;

  let token = null;
  let profiel_epos = "";
  try {
    if (typeof identiteit_kry_huidige_sessie === "function") {
      const sessie = await identiteit_kry_huidige_sessie();
      if (sessie && sessie.access_token) {
        token = sessie.access_token;
        profiel_epos = (sessie.gebruiker && sessie.gebruiker.email) || "";
      }
    }
  } catch {}
  if (token) {
    epos_veld.hidden = true;
    privaat.hidden = true;
  }

  epos_veld.addEventListener("input", () => { fout.hidden = true; });

  vorm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const epos = token ? profiel_epos : epos_veld.value.trim();
    if (!token && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(epos)) {
      fout.textContent = t("hk_fout_epos");
      fout.hidden = false;
      epos_veld.focus();
      return;
    }
    knoppie.disabled = true;
    try {
      const kop = { "Content-Type": "application/json" };
      if (token) kop.Authorization = `Bearer ${token}`;
      const resp = await fetch("/.netlify/functions/harde-kopie-belang", {
        method: "POST",
        headers: kop,
        body: JSON.stringify({
          slug,
          epos,
          taal: typeof kry_huidige_taal === "function" ? kry_huidige_taal() : "af",
          pot: vorm.elements.pot.value,
        }),
      });
      if (resp.status === 400) {
        const data = await resp.json().catch(() => ({}));
        if (data.fout === "epos") {
          fout.textContent = t("hk_fout_epos");
          fout.hidden = false;
          knoppie.disabled = false;
          return;
        }
      }
      if (!resp.ok) throw new Error(String(resp.status));
      hk_onthou(slug);
      vorm.hidden = true;
      privaat.hidden = true;
      fout.hidden = true;
      dankie.hidden = false;
    } catch {
      fout.textContent = t("hk_fout");
      fout.hidden = false;
      knoppie.disabled = false;
    }
  });
}

(function () {
  const styl = document.createElement("style");
  styl.textContent =
    ".produk-geskenk-knoppie{display:block;width:100%;margin:8px 0 0;background:#fff;color:var(--teal,#479F91);border:2px solid var(--teal,#479F91)}" +
    ".produk-geskenk-knoppie:disabled{opacity:.75}";
  document.head.appendChild(styl);
})();

// Ander boeke uit dieselfde ry, in die ry se volgorde, met die nuwe kaart.
function wys_meer_uit_ry(produk, ry, kt) {
  const plek = document.getElementById("pb-meer");
  if (!plek || !ry || !kt || typeof bk_bou_rye !== "function") return;
  const rye = bk_bou_rye(bk_in_taal(kt.produkte), kt);
  const self = rye.find((r) => r.kode === ry.kode);
  const ander = self ? self.boeke.filter((p) => p.slug !== produk.slug && p.slug !== produk.eweknie_slug) : [];
  if (!ander.length) return;
  plek.innerHTML = `
    <section class="bk-ry pb-meer">
      <div class="bk-ry-kop bk-ry-kop--met-skakel">
        <h2 class="bk-ry-titel">${t("pb_meer_uit_ry")}</h2>
        <a class="bk-sien-alles" href="boeke.html#afdeling-${bk_anker(ry.kode)}">${t("bk_sien_alles")} →</a>
      </div>
      <div class="bk-rooster bk-rooster--vier">${ander.slice(0, 4).map((p) => bk_kaart(p, kt)).join("")}</div>
    </section>`;
}

function koppel_geskenk_knoppies(wrap) {
  wrap.querySelectorAll(".produk-geskenk-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const { slug, titel, prys } = knoppie.dataset;
      const resultaat = voeg_by_mandjie({
        produk_slug: slug,
        titel,
        formaat: "eboek",
        prys_sent: Number(prys),
        geskenk: true,
      });
      const terugvoer = document.getElementById("produk-terugvoer");
      if (resultaat.reeds_in_mandjie) {
        terugvoer.textContent = t("geskenk_reeds_in_mandjie");
        return;
      }
      knoppie.textContent = "✓ " + t("geskenk_bygevoeg");
      knoppie.disabled = true;
      terugvoer.innerHTML = `${t("geskenk_bygevoeg_nota")} <a href="mandjie.html">${t("gaan_na_mandjie")}</a>`;
    });
  });
}

async function laai_produk() {
  const wrap = document.getElementById("produk-wrap");
  const slug = kry_produk_slug_uit_url();

  let produkte;
  let demo_modus = false;
  let besit_info = { eboek_besit: new Set(), leen_aktief: new Map() };
  let konteks = null;
  try {
    const [resp, opgehaalde_besit_info, afd] = await Promise.all([
      fetch(KATALOGUS_ENDPOINT),
      kry_besit_info(),
      fetch("/.netlify/functions/kry-afdelings").then((r) => (r.ok ? r.json() : { afdelings: [] })).catch(() => ({ afdelings: [] })),
    ]);
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    produkte = data.produkte || [];
    besit_info = opgehaalde_besit_info;
    if (typeof bk_lidmaatskap === "function") {
      const per_slug = new Map(produkte.map((p) => [p.slug, p]));
      const afdelings = afd.afdelings || [];
      konteks = {
        produkte,
        per_slug,
        afdelings,
        afdelings_per_kode: new Map(afdelings.map((a) => [a.kode, a])),
        lidmaatskap: bk_lidmaatskap(afdelings, per_slug),
        besit: besit_info.eboek_besit,
      };
    }
  } catch (fout) {
    console.warn("Kon nie lewendige katalogus laai nie, wys demo-data:", fout);
    produkte = DEMO_PRODUKTE;
    demo_modus = true;
  }

  if (!slug) {
    if (demo_modus) {
      // Voorskou-gerief: sonder 'n spesifieke slug in die URL, wys net
      // die eerste demo-produk sodat die bladsy steeds bekyk kan word.
      wys_produk(produkte[0], besit_info);
      return;
    }
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("geen_produk")} <a href="boeke.html">${t("terug_katalogus_skakel")}</a></p>`;
    return;
  }

  let produk = produkte.find((p) => p.slug === slug);

  // Ongelyste produkte (sien kry-katalogus.js) is nie in die lys nie; vra
  // hulle afsonderlik op volgens slug.
  if (!produk && !demo_modus) {
    try {
      const r = await fetch(`${KATALOGUS_ENDPOINT}?slug=${encodeURIComponent(slug)}`);
      if (r.ok) produk = ((await r.json()).produkte || [])[0];
    } catch (_) {
      /* val deur na "nie gevind nie" */
    }
  }

  // 'n Boek met 'n eie webblad: die webblad is die voorkant. Met &bly=1 in
  // die adres wys die winkel se eie bladsy steeds (vir personeel).
  const bly = new URLSearchParams(window.location.search).get("bly") === "1";
  if (produk && produk.eie_webblad && !bly) {
    window.location.replace(produk.eie_webblad);
    return;
  }

  if (!produk) {
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("produk_nie_gevind")} <a href="boeke.html">${t("terug_katalogus_skakel")}</a></p>`;
    return;
  }

  wys_produk(produk, besit_info, konteks);

  if (!demo_modus) {
    // Agtergrond-belangstelling-telling — "fire and forget", nooit die
    // bladsy se werking laat wag of breek as dit misluk nie.
    fetch("/.netlify/functions/tel-produk-besigtiging", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: produk.slug }),
    }).catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", laai_produk);
