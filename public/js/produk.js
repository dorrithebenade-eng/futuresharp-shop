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

function formateer_prys_sent(sent) {
  return `R${(sent / 100).toFixed(2)}`;
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
    </div>
  `;
}

function wys_produk(produk, besit_info) {
  document.title = `${produk.titel} — Future Shop`;

  const wrap = document.getElementById("produk-wrap");

  const omslagHtml = produk.omslag
    ? `<img class="produk-omslag" src="${produk.omslag}" alt="Omslag van ${produk.titel}">`
    : `<div class="produk-omslag" role="img" aria-label="Geen omslag beskikbaar vir ${produk.titel}"></div>`;

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

  wrap.innerHTML = `
    <a class="terug-skakel" href="index.html">${t("terug_katalogus")}</a>
    <div class="produk-uitleg">
      ${omslagHtml}
      <div class="produk-inligting">
        <h1 class="produk-titel">${produk.titel}</h1>
        <p class="produk-outeur">${produk.outeur}</p>
        ${bou_beskikbaar_merkers(eboek, hardeKopie, leen)}

        <div class="afdeling-etiket produk-beskrywing-etiket">${t("oor_hierdie_boek")}</div>
        <p class="produk-beskrywing">${produk.vol_beskrywing || produk.oorsig || ""}</p>
      </div>
    </div>

    <div class="koop-afdeling">
      <div class="afdeling-etiket">${t("kies_formaat")}</div>
      <div class="produk-aksies">${aksies.join("")}</div>
      <p class="produk-nota" id="produk-terugvoer" role="status"></p>
    </div>
  `;

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
}

async function laai_produk() {
  const wrap = document.getElementById("produk-wrap");
  const slug = kry_produk_slug_uit_url();

  let produkte;
  let demo_modus = false;
  let besit_info = { eboek_besit: new Set(), leen_aktief: new Map() };
  try {
    const [resp, opgehaalde_besit_info] = await Promise.all([
      fetch(KATALOGUS_ENDPOINT),
      kry_besit_info(),
    ]);
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    produkte = data.produkte || [];
    besit_info = opgehaalde_besit_info;
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
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("geen_produk")} <a href="index.html">${t("terug_katalogus_skakel")}</a></p>`;
    return;
  }

  const produk = produkte.find((p) => p.slug === slug);
  if (!produk) {
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("produk_nie_gevind")} <a href="index.html">${t("terug_katalogus_skakel")}</a></p>`;
    return;
  }

  wys_produk(produk, besit_info);

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
