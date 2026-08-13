// Personeel-paneelbord — Netlify Identity-aanmelding, katalogus-lys, en
// die "Voeg produk by"/"Wysig"-vorm. Rolkontrole gebeur ook bediener-kant
// in elke Function (sien _rol-kontrole.js) — hierdie front-end-kontrole is
// net vir 'n gemaklike gebruikerservaring, nie die werklike sekuriteit nie.

const ALLE_PRODUKTE_ENDPOINT = "/.netlify/functions/kry-alle-produkte";
const SKEP_PRODUK_ENDPOINT = "/.netlify/functions/skep-produk";
const WYSIG_PRODUK_ENDPOINT = "/.netlify/functions/wysig-produk";
const VERWYDER_PRODUK_ENDPOINT = "/.netlify/functions/verwyder-produk";
const KRY_OUTEURS_ENDPOINT = "/.netlify/functions/kry-outeurs";
const SKEP_OUTEUR_ENDPOINT = "/.netlify/functions/skep-outeur";
const WYSIG_OUTEUR_ENDPOINT = "/.netlify/functions/wysig-outeur";
const SKRAP_OUTEUR_ENDPOINT = "/.netlify/functions/skrap-outeur";
const LAAI_EBOEK_OP_ENDPOINT = "/.netlify/functions/laai-eboek-op";
const SKEP_KOEPON_ENDPOINT = "/.netlify/functions/skep-koepon";
const KRY_KOEPONS_ENDPOINT = "/.netlify/functions/kry-koepons";

// Voorafgestelde etikette — elk met vaste AF/EN-teks, sodat personeel nie
// self vertalings hoef te tik/onthou nie. "aangepas" laat steeds vrye teks
// toe vir uitsonderings.
const VOORAFGESTELDE_ETIKETTE = {
  nuut: { af: "Nuut!", en: "New!" },
  topverkoper: { af: "Topverkoper", en: "Bestseller" },
  spesiale_aanbod: { af: "Spesiale aanbod", en: "Special offer" },
};

function kry_etiket_voorafgestelde_sleutel(teks_af, teks_en) {
  for (const [sleutel, waarde] of Object.entries(VOORAFGESTELDE_ETIKETTE)) {
    if (waarde.af === teks_af && waarde.en === teks_en) return sleutel;
  }
  return "aangepas";
}
const WYSIG_KOEPON_ENDPOINT = "/.netlify/functions/wysig-koepon";

// In-geheue kas van outeurs — gevul deur laai_outeurs(), gebruik om die
// verdeling-aftrekkieslyste op elke boek-vorm te bou sonder om elke keer
// weer te moet gaan haal.
let outeurs_kas = [];
let produkte_kas = [];

function formateer_prys_sent(sent) {
  return `R${(sent / 100).toFixed(2)}`;
}

// Gedeelde funksie — ook deur paneel-registers.js gebruik (vir Vennote).
// Genereer (of hergebruik) 'n aanhoudende verslag-skakel en wys dit vir
// personeel om te kopieer.
async function genereer_verslag_skakel(rol_tipe, entiteit_id, knoppie) {
  const oorspronklike_teks = knoppie.textContent;
  knoppie.disabled = true;
  knoppie.textContent = "Besig …";

  try {
    const resp = await fetch("/.netlify/functions/skep-verslag-skakel", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ rol_tipe, entiteit_id }),
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();

    const skakel = `${window.location.origin}/verslag.html?token=${data.token}`;
    window.prompt("Verslag-skakel (Ctrl+C om te kopieer) — werk vir altyd, stuur dit aan die persoon:", skakel);
  } catch (fout) {
    console.error("Kon nie verslag-skakel genereer nie:", fout);
    alert("Kon nie verslag-skakel genereer nie — probeer weer.");
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = oorspronklike_teks;
  }
}

function kry_rolle(gebruiker) {
  return (gebruiker && gebruiker.app_metadata && gebruiker.app_metadata.roles) || [];
}

function het_personeel_rol(gebruiker) {
  return kry_rolle(gebruiker).includes("personeel");
}

// 'n Vennoot (direkteur) sonder personeel-rol kom die paneelbord binne,
// maar sien SLEGS Dokumente en die Verdeling-rekenaar, lees-alleen. Die
// beperking self leef in paneel-vennoot.js; hier besluit ons net wie
// deurgelaat word en watter data gelaai word.
function het_slegs_vennoot_rol(gebruiker) {
  const rolle = kry_rolle(gebruiker);
  return rolle.includes("vennoot") && !rolle.includes("personeel");
}

// --- Aanmeld-status ---

function verberg_alle_auth_afdelings() {
  document.getElementById("paneel-aanmeld-afdeling").style.display = "none";
  document.getElementById("paneel-herstel-afdeling").style.display = "none";
  document.getElementById("paneel-nuwe-wagwoord-afdeling").style.display = "none";
  document.getElementById("paneel-status").style.display = "none";
}

function wys_aangemeld_toestand(gebruiker) {
  if (het_slegs_vennoot_rol(gebruiker)) {
    // Vennoot-modus: geen produkte, outeurs of koepons word gelaai nie —
    // daardie Functions sou in elk geval 403 gee. Net die raamwerk wys;
    // dokumente.js laai self wanneer sy afdeling sigbaar word.
    verberg_alle_auth_afdelings();
    document.getElementById("paneel-afmeld-knoppie").style.display = "inline-flex";
    document.getElementById("paneel-gebruiker-epos").textContent = gebruiker.email;
    document.getElementById("paneel-inhoud").style.display = "block";
    document.getElementById("paneel-hoof").style.visibility = "visible";
    if (typeof paneel_vennoot_beperk === "function") paneel_vennoot_beperk();
    return;
  }

  if (!het_personeel_rol(gebruiker)) {
    // Nie personeel nie — moet NOOIT enigiets van die paneelbord se
    // binnekant sien nie, nie eens 'n foutboodskap wat na "personeel-rol"
    // verwys nie. Stuur stilweg terug na die winkel.
    window.location.href = "index.html";
    return;
  }

  verberg_alle_auth_afdelings();
  document.getElementById("paneel-afmeld-knoppie").style.display = "inline-flex";
  document.getElementById("paneel-gebruiker-epos").textContent = gebruiker.email;

  document.getElementById("paneel-inhoud").style.display = "block";
  document.getElementById("paneel-hoof").style.visibility = "visible";
  laai_produkte();
  laai_outeurs();
  laai_koepons();
}

function wys_afgemeld_toestand() {
  verberg_alle_auth_afdelings();
  document.getElementById("paneel-aanmeld-afdeling").style.display = "block";
  document.getElementById("paneel-afmeld-knoppie").style.display = "none";
  document.getElementById("paneel-gebruiker-epos").textContent = "";
  document.getElementById("paneel-inhoud").style.display = "none";
  document.getElementById("paneel-hoof").style.visibility = "visible";
}

function kry_outorisasie_kop() {
  const sessie = identiteit_kry_sessie();
  return sessie ? { Authorization: `Bearer ${sessie.access_token}` } : {};
}

// --- Produkte-lys ---

async function laai_produkte() {
  const wrap = document.getElementById("paneel-produkte-lys");
  wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_produkte_laai")}</p>`;

  try {
    const resp = await fetch(ALLE_PRODUKTE_ENDPOINT, { headers: kry_outorisasie_kop() });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    produkte_kas = data.produkte || [];
    wys_produkte_lys(data.produkte || []);
  } catch (fout) {
    console.error("Kon nie produkte laai nie:", fout);
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_kon_nie_produkte_laai")}</p>`;
  }
}

function wys_produkte_lys(produkte) {
  const wrap = document.getElementById("paneel-produkte-lys");

  if (!produkte.length) {
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_nog_geen_produkte")}</p>`;
    return;
  }

  wrap.innerHTML = produkte
    .map((produk) => {
      const eboek = produk.formate && produk.formate.eboek;
      const hardeKopie = produk.formate && produk.formate.harde_kopie;
      const leen = produk.formate && produk.formate.leen;

      const pryse = [];
      if (eboek && eboek.beskikbaar) pryse.push(`${t("paneel_eboek")} — ${formateer_prys_sent(eboek.prys_sent)}`);
      if (hardeKopie && hardeKopie.beskikbaar) pryse.push(`${t("paneel_hardekopie")} — ${formateer_prys_sent(hardeKopie.prys_sent)}`);
      if (leen && leen.beskikbaar) pryse.push(`${t("leen_etiket")} — ${formateer_prys_sent(leen.prys_sent)}`);

      // Wys die Leen-segment as die boek leen aanbied, OF as daar histories
      // reeds leen-aankope was (selfs al is leen intussen afgeskakel) —
      // anders verdwyn nuttige geskiedenis stilweg uit die oorsig.
      const wys_leen_teller = leen || (produk.aankope_leen || 0) > 0;

      return `
        <div class="paneel-produk-ry ${produk.aktief ? "" : "paneel-produk-ry-onaktief"}">
          <div class="paneel-produk-inligting">
            <strong>${produk.titel}</strong>
            <span class="paneel-produk-outeur">${produk.outeur}</span>
            <span class="paneel-produk-pryse">${pryse.join(" · ") || t("paneel_geen_formaat")}</span>
            <span class="paneel-produk-besigtigings">👁 ${produk.besigtigings || 0}</span>
            <span class="paneel-produk-aankope">
              🛒 ${t("paneel_eboek")}: ${produk.aankope_eboek || 0} (${formateer_prys_sent(produk.opbrengs_eboek_sent || 0)})
              · ${t("paneel_hardekopie")}: ${produk.aankope_harde_kopie || 0} (${formateer_prys_sent(produk.opbrengs_harde_kopie_sent || 0)})
              ${wys_leen_teller ? `· ${t("leen_etiket")}: ${produk.aankope_leen || 0} (${formateer_prys_sent(produk.opbrengs_leen_sent || 0)})` : ""}
            </span>
            ${!produk.aktief ? `<span class="paneel-onaktief-etiket">${t("paneel_onaktief")}</span>` : ""}
          </div>
          <div class="paneel-produk-aksies">
            <button class="terug-skakel paneel-wysig-knoppie" data-slug="${produk.slug}">${t("paneel_wysig")}</button>
            <button class="terug-skakel paneel-aktief-knoppie" data-slug="${produk.slug}" data-aktief="${produk.aktief}">
              ${produk.aktief ? t("paneel_deaktiveer") : t("paneel_aktiveer")}
            </button>
            <button class="terug-skakel paneel-skrap-knoppie" data-slug="${produk.slug}" data-titel="${produk.titel}">${t("paneel_skrap")}</button>
          </div>
        </div>
      `;
    })
    .join("");

  wrap.querySelectorAll(".paneel-wysig-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const produk = produkte.find((p) => p.slug === knoppie.dataset.slug);
      if (produk) open_vorm_vir_wysig(produk);
    });
  });

  wrap.querySelectorAll(".paneel-aktief-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", async () => {
      const nuwe_aktief_status = knoppie.dataset.aktief !== "true";
      knoppie.disabled = true;
      try {
        const resp = await fetch(WYSIG_PRODUK_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
          body: JSON.stringify({ slug: knoppie.dataset.slug, wysigings: { aktief: nuwe_aktief_status } }),
        });
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        laai_produkte();
      } catch (fout) {
        console.error("Kon nie aktief-status wysig nie:", fout);
        alert(t("paneel_kon_nie_status_wysig"));
        knoppie.disabled = false;
      }
    });
  });

  wrap.querySelectorAll(".paneel-skrap-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", async () => {
      const bevestig_teks = t("paneel_skrap_bevestig").replace("%titel%", knoppie.dataset.titel);
      if (!window.confirm(bevestig_teks)) return;

      knoppie.disabled = true;
      try {
        const resp = await fetch(VERWYDER_PRODUK_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
          body: JSON.stringify({ slug: knoppie.dataset.slug }),
        });

        if (resp.status === 409) {
          const data = await resp.json().catch(() => null);
          alert((data && data.fout) || t("paneel_kon_nie_skrap_nie"));
          knoppie.disabled = false;
          return;
        }
        if (!resp.ok) throw new Error(`Status ${resp.status}`);

        laai_produkte();
      } catch (fout) {
        console.error("Kon nie produk skrap nie:", fout);
        alert(t("paneel_kon_nie_skrap_nie"));
        knoppie.disabled = false;
      }
    });
  });
}

// --- Outeurs-lys ---

async function laai_outeurs() {
  const wrap = document.getElementById("paneel-outeurs-lys");
  wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_outeurs_laai")}</p>`;

  try {
    const resp = await fetch(KRY_OUTEURS_ENDPOINT, { headers: kry_outorisasie_kop() });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    outeurs_kas = data.outeurs || [];
    wys_outeurs_lys(outeurs_kas);
    // Ververs enige reeds-oop verdeling-aftrekkieslyste met die nuutste
    // outeurs-lys (bv. ná 'n nuwe outeur bygevoeg is terwyl 'n boek se
    // vorm reeds oop was).
    ververs_alle_verdeling_aftrekkieslyste();
    ververs_alle_outeur_aftrekkieslyste();
  } catch (fout) {
    console.error("Kon nie outeurs laai nie:", fout);
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_kon_nie_outeurs_laai")}</p>`;
  }
}

// null = nuwe outeur word bygevoeg; andersins die outeur_id wat tans
// gewysig word.
let outeur_wysig_toestand = null;

function wys_outeurs_lys(outeurs) {
  const wrap = document.getElementById("paneel-outeurs-lys");

  if (!outeurs.length) {
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_nog_geen_outeurs")}</p>`;
    return;
  }

  wrap.innerHTML = outeurs
    .map(
      (outeur) => `
        <div class="paneel-produk-ry">
          <div class="paneel-produk-inligting">
            <strong>${outeur.naam}</strong>
            <span class="paneel-produk-outeur">${outeur.subrekening_kode}</span>
          </div>
          <div class="paneel-produk-aksies">
            <button class="terug-skakel paneel-outeur-wysig-knoppie" data-id="${outeur.outeur_id}">${t("paneel_wysig")}</button>
            <button class="terug-skakel paneel-outeur-verslag-knoppie" data-id="${outeur.outeur_id}">Verslag-skakel</button>
            <button class="terug-skakel paneel-skrap-knoppie paneel-outeur-skrap-knoppie" data-id="${outeur.outeur_id}">${t("paneel_skrap")}</button>
          </div>
        </div>
      `
    )
    .join("");

  wrap.querySelectorAll(".paneel-outeur-wysig-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const outeur = outeurs.find((o) => o.outeur_id === knoppie.dataset.id);
      if (outeur) open_outeur_vorm(outeur);
    });
  });

  wrap.querySelectorAll(".paneel-outeur-verslag-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const outeur = outeurs.find((o) => o.outeur_id === knoppie.dataset.id);
      if (outeur) genereer_verslag_skakel("outeur", outeur.outeur_id, knoppie);
    });
  });

  wrap.querySelectorAll(".paneel-outeur-skrap-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const outeur = outeurs.find((o) => o.outeur_id === knoppie.dataset.id);
      if (outeur) skrap_outeur(outeur, knoppie);
    });
  });
}

const OUTEUR_KONTAK_VELDE = ["epos", "selfoon", "id-nommer", "adres", "bank-rekeninghouer", "bank-naam", "bank-rekeningnommer", "bank-tak-kode", "bank-tipe"];
// Bediener-kant KONTAK_VELDE gebruik onderstrepe (id_nommer, bank_naam, ens.);
// HTML-veld-ID's hierbo gebruik koppeltekens (foutbestande CSS-konvensie in
// hierdie kodebasis) — hierdie kaart versoen die twee.
const OUTEUR_KONTAK_VELD_SLEUTELS = {
  "epos": "epos", "selfoon": "selfoon", "id-nommer": "id_nommer",
  "adres": "adres", "bank-rekeninghouer": "bank_rekeninghouer",
  "bank-naam": "bank_naam", "bank-rekeningnommer": "bank_rekeningnommer",
  "bank-tak-kode": "bank_tak_kode", "bank-tipe": "bank_tipe",
};

function open_outeur_vorm(outeur) {
  outeur_wysig_toestand = outeur ? outeur.outeur_id : null;
  document.getElementById("outeur-vorm-naam").value = outeur ? outeur.naam : "";
  document.getElementById("outeur-vorm-subrekening").value = outeur ? outeur.subrekening_kode : "";

  const kontak = (outeur && outeur.kontak_inligting) || {};
  OUTEUR_KONTAK_VELDE.forEach((html_veld) => {
    const el = document.getElementById(`outeur-vorm-${html_veld}`);
    if (el) el.value = kontak[OUTEUR_KONTAK_VELD_SLEUTELS[html_veld]] || "";
  });

  document.getElementById("paneel-outeur-vorm-foute").style.display = "none";
  document.getElementById("paneel-outeur-vorm-indien").textContent = outeur
    ? "Stoor wysigings"
    : t("paneel_voeg_outeur_by_knoppie");
  document.getElementById("paneel-outeur-vorm-afdeling").style.display = "block";
  document.getElementById("paneel-outeur-vorm-afdeling").scrollIntoView({ behavior: "smooth" });
}

function sluit_outeur_vorm() {
  outeur_wysig_toestand = null;
  document.getElementById("paneel-outeur-vorm-afdeling").style.display = "none";
}

async function hanteer_outeur_vorm_indiening(gebeurtenis) {
  gebeurtenis.preventDefault();
  const foutWrap = document.getElementById("paneel-outeur-vorm-foute");
  foutWrap.style.display = "none";

  const naam = document.getElementById("outeur-vorm-naam").value.trim();
  const subrekening_kode = document.getElementById("outeur-vorm-subrekening").value.trim();
  const wysig_id = outeur_wysig_toestand;

  const kontak_inligting = {};
  OUTEUR_KONTAK_VELDE.forEach((html_veld) => {
    const el = document.getElementById(`outeur-vorm-${html_veld}`);
    if (el && el.value.trim()) kontak_inligting[OUTEUR_KONTAK_VELD_SLEUTELS[html_veld]] = el.value.trim();
  });

  const knoppie = document.getElementById("paneel-outeur-vorm-indien");
  knoppie.disabled = true;
  knoppie.textContent = t("besig");

  try {
    const endpoint = wysig_id ? WYSIG_OUTEUR_ENDPOINT : SKEP_OUTEUR_ENDPOINT;
    const liggaam = wysig_id
      ? { outeur_id: wysig_id, naam, subrekening_kode, kontak_inligting }
      : { naam, subrekening_kode, kontak_inligting };

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify(liggaam),
    });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    sluit_outeur_vorm();
    laai_outeurs();
  } catch (fout) {
    console.error("Kon nie outeur stoor nie:", fout);
    foutWrap.textContent = `${t("paneel_kon_nie_stoor")}${fout.message}`;
    foutWrap.style.display = "block";
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = wysig_id ? "Stoor wysigings" : t("paneel_voeg_outeur_by_knoppie");
  }
}

// Kyk of hierdie outeur reeds op enige boek se verdeling gebruik word —
// waarsku net, blokkeer nie (soos deur Dorrithé bevestig).
async function kry_outeur_gebruik_in_produkte(outeur_id) {
  try {
    const resp = await fetch(ALLE_PRODUKTE_ENDPOINT, { headers: kry_outorisasie_kop() });
    if (!resp.ok) return [];
    const data = await resp.json();
    const produkte = data.produkte || [];

    const titels = [];
    produkte.forEach((produk) => {
      const alle_verdelings = [
        ...((produk.formate && produk.formate.eboek && produk.formate.eboek.verdelings) || []),
        ...((produk.formate && produk.formate.harde_kopie && produk.formate.harde_kopie.verdelings) || []),
      ];
      const in_gebruik = alle_verdelings.some((v) => v.rol_tipe === "outeur" && v.entiteit_id === outeur_id);
      if (in_gebruik) titels.push(produk.titel);
    });

    return titels;
  } catch (fout) {
    console.error("Kon nie outeur-gebruik nagaan nie:", fout);
    return [];
  }
}

async function skrap_outeur(outeur, knoppie) {
  knoppie.disabled = true;

  const titels = await kry_outeur_gebruik_in_produkte(outeur.outeur_id);

  let bevestig_teks = `Skrap "${outeur.naam}"?`;
  if (titels.length) {
    bevestig_teks =
      `Let op: "${outeur.naam}" word tans gebruik in: ${titels.join(", ")}.\n\n` +
      `Skrapping sal NIE daardie boek se verdeling outomaties verwyder nie — gaan dit self na.\n\n` +
      `Wil jy steeds "${outeur.naam}" skrap?`;
  }

  if (!window.confirm(bevestig_teks)) {
    knoppie.disabled = false;
    return;
  }

  try {
    const resp = await fetch(SKRAP_OUTEUR_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ outeur_id: outeur.outeur_id }),
    });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    laai_outeurs();
  } catch (fout) {
    console.error("Kon nie outeur skrap nie:", fout);
    alert(`Kon nie skrap nie: ${fout.message}`);
    knoppie.disabled = false;
  }
}

// --- Koepons ---

function formateer_koepon_status(koepon) {
  if (!koepon.aktief) return t("paneel_koepon_status_onaktief");
  if (koepon.verval_op && new Date(koepon.verval_op) < new Date()) return t("paneel_koepon_status_verval");
  if (koepon.gebruike_tot_dusver >= koepon.maks_gebruike) return t("paneel_koepon_status_op");
  return t("paneel_koepon_status_aktief");
}

async function laai_koepons() {
  const wrap = document.getElementById("paneel-koepons-lys");
  if (!wrap) return;
  wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_koepons_laai")}</p>`;

  try {
    const resp = await fetch(KRY_KOEPONS_ENDPOINT, { headers: kry_outorisasie_kop() });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    wys_koepons_lys(data.koepons || []);
  } catch (fout) {
    console.error("Kon nie koepons laai nie:", fout);
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_kon_nie_koepons_laai")}</p>`;
  }
}

function wys_koepons_lys(koepons) {
  const wrap = document.getElementById("paneel-koepons-lys");

  if (!koepons.length) {
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_nog_geen_koepons")}</p>`;
    return;
  }

  wrap.innerHTML = koepons
    .map((koepon) => {
      const produk = produkte_kas.find((p) => p.slug === koepon.produk_slug);
      const boek_teks = koepon.produk_slug
        ? (produk ? produk.titel : koepon.produk_slug)
        : t("paneel_koepon_enige_boek");
      const tipe_teks =
        koepon.tipe === "afslag"
          ? koepon.afslag_tipe === "vaste_bedrag"
            ? `${t("paneel_koepon_tipe_afslag")} — R${(koepon.afslag_waarde / 1).toFixed(2)}`
            : `${t("paneel_koepon_tipe_afslag")} — ${koepon.afslag_waarde}%`
          : t("paneel_koepon_tipe_gratis");
      const formaat_teks =
        koepon.formaat_beperking === "eboek"
          ? t("paneel_koepon_formaat_eboek")
          : koepon.formaat_beperking === "harde_kopie"
          ? t("paneel_koepon_formaat_hardekopie")
          : koepon.formaat_beperking === "leen"
          ? t("paneel_koepon_formaat_leen")
          : t("paneel_koepon_formaat_albei");

      return `
        <div class="paneel-produk-ry">
          <div class="paneel-produk-inligting">
            <strong>${koepon.kode}</strong>
            <span class="paneel-produk-outeur">${tipe_teks} · ${boek_teks} · ${formaat_teks} · ${koepon.gebruike_tot_dusver}/${koepon.maks_gebruike} · ${formateer_koepon_status(koepon)}</span>
            ${koepon.nota ? `<span class="paneel-produk-outeur">${koepon.nota}</span>` : ""}
          </div>
          <div class="paneel-produk-aksies">
            <button class="terug-skakel paneel-koepon-aktief-knoppie" data-kode="${koepon.kode}" data-aktief="${koepon.aktief}">
              ${koepon.aktief ? t("paneel_deaktiveer") : t("paneel_aktiveer")}
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  wrap.querySelectorAll(".paneel-koepon-aktief-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", async () => {
      const nuwe_aktief_status = knoppie.dataset.aktief !== "true";
      knoppie.disabled = true;
      try {
        const resp = await fetch(WYSIG_KOEPON_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
          body: JSON.stringify({ kode: knoppie.dataset.kode, aktief: nuwe_aktief_status }),
        });
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        laai_koepons();
      } catch (fout) {
        console.error("Kon nie koepon-status wysig nie:", fout);
        alert(t("paneel_kon_nie_status_wysig"));
        knoppie.disabled = false;
      }
    });
  });
}

function vul_koepon_dropdowns() {
  const produk_select = document.getElementById("koepon-vorm-produk");
  const geen_produk_opsie = `<option value="">${t("paneel_koepon_enige_boek")}</option>`;
  produk_select.innerHTML =
    geen_produk_opsie + produkte_kas.map((p) => `<option value="${p.slug}">${p.titel}</option>`).join("");

  const outeur_select = document.getElementById("koepon-vorm-outeur");
  const geen_outeur_opsie = `<option value="">${t("paneel_koepon_geen_outeur")}</option>`;
  outeur_select.innerHTML =
    geen_outeur_opsie + outeurs_kas.map((o) => `<option value="${o.outeur_id}">${o.naam}</option>`).join("");
}

function wys_verberg_afslag_velde() {
  const tipe = document.getElementById("koepon-vorm-tipe").value;
  document.getElementById("koepon-vorm-afslag-velde").style.display = tipe === "afslag" ? "block" : "none";
}

function open_koepon_vorm() {
  document.getElementById("paneel-koepon-vorm").reset();
  vul_koepon_dropdowns();
  wys_verberg_afslag_velde();
  document.getElementById("paneel-koepon-vorm-foute").style.display = "none";
  document.getElementById("paneel-koepon-vorm-afdeling").style.display = "block";
  document.getElementById("paneel-koepon-vorm-afdeling").scrollIntoView({ behavior: "smooth" });
}

function sluit_koepon_vorm() {
  document.getElementById("paneel-koepon-vorm-afdeling").style.display = "none";
}

function genereer_koepon_kode_voorskou() {
  // Net 'n plaaslike voorskou-kode vir personeel se gerief — die Function
  // self genereer (en bevestig uniekheid van) die WERKLIKE kode as die
  // veld leeg gelaat word. Hierdie voorskou verhoed net dat die veld leeg
  // lyk voor indiening.
  const karakters = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let kode = "";
  for (let i = 0; i < 8; i++) kode += karakters[Math.floor(Math.random() * karakters.length)];
  document.getElementById("koepon-vorm-kode").value = kode;
}

async function hanteer_koepon_vorm_indiening(gebeurtenis) {
  gebeurtenis.preventDefault();
  const foutWrap = document.getElementById("paneel-koepon-vorm-foute");
  foutWrap.style.display = "none";

  const tipe = document.getElementById("koepon-vorm-tipe").value;
  const liggaam = {
    kode: document.getElementById("koepon-vorm-kode").value.trim(),
    tipe,
    afslag_tipe: document.getElementById("koepon-vorm-afslag-tipe").value,
    afslag_waarde: Number(document.getElementById("koepon-vorm-afslag-waarde").value),
    produk_slug: document.getElementById("koepon-vorm-produk").value || null,
    formaat_beperking: document.getElementById("koepon-vorm-formaat").value,
    maks_gebruike: Number(document.getElementById("koepon-vorm-maks-gebruike").value) || 1,
    verval_op: document.getElementById("koepon-vorm-verval").value || null,
    outeur_id: document.getElementById("koepon-vorm-outeur").value || null,
    nota: document.getElementById("koepon-vorm-nota").value.trim(),
  };

  const knoppie = document.getElementById("paneel-koepon-vorm-indien");
  knoppie.disabled = true;
  knoppie.textContent = t("besig");

  try {
    const resp = await fetch(SKEP_KOEPON_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify(liggaam),
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      throw new Error((data && data.fout) || `Status ${resp.status}`);
    }

    sluit_koepon_vorm();
    laai_koepons();
  } catch (fout) {
    console.error("Kon nie koepon stoor nie:", fout);
    foutWrap.textContent = fout.message;
    foutWrap.style.display = "block";
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = t("paneel_voeg_koepon_by_knoppie");
  }
}

// --- Verdeling-rye (herhaalbaar, meervoudige verdelings per formaat,
// oor 5 moontlike rolle: Outeur, Vennoot, Ontwerp/Admin, Printing,
// Aflewering) ---

const ROL_TIPE_KONFIG = {
  outeur: { kas: () => outeurs_kas, idveld: "outeur_id", etiket: "Outeur" },
  vennoot: { kas: () => (window.paneel_register_kas && window.paneel_register_kas["vennote"]) || [], idveld: "vennoot_id", etiket: "Vennoot (direkteur)" },
  ontwerp_admin: { kas: () => (window.paneel_register_kas && window.paneel_register_kas["ontwerp-admin"]) || [], idveld: "ontwerp_admin_id", etiket: "Ontwerp/Admin" },
  printing: { kas: () => (window.paneel_register_kas && window.paneel_register_kas["printing"]) || [], idveld: "printing_id", etiket: "Printing" },
  aflewering: { kas: () => (window.paneel_register_kas && window.paneel_register_kas["aflewering"]) || [], idveld: "aflewering_id", etiket: "Aflewering" },
};

function bou_rol_tipe_opsies_html(gekose_rol_tipe) {
  return Object.entries(ROL_TIPE_KONFIG)
    .map(
      ([sleutel, kfg]) =>
        `<option value="${sleutel}" ${sleutel === gekose_rol_tipe ? "selected" : ""}>${kfg.etiket}</option>`
    )
    .join("");
}

function bou_entiteit_opsies_html(rol_tipe, gekose_entiteit_id) {
  const konfig = ROL_TIPE_KONFIG[rol_tipe] || ROL_TIPE_KONFIG.outeur;
  const geen_opsie = `<option value="">Kies ${konfig.etiket.toLowerCase()}</option>`;
  const opsies = konfig
    .kas()
    .map(
      (item) =>
        `<option value="${item[konfig.idveld]}" ${item[konfig.idveld] === gekose_entiteit_id ? "selected" : ""}>${item.naam}</option>`
    )
    .join("");
  return geen_opsie + opsies;
}

function skep_verdeling_ry_element(voorvoegsel, bestaande) {
  const ry = document.createElement("div");
  ry.className = "paneel-verdeling-ry veld-ry";

  const gekose_rol_tipe = (bestaande && bestaande.rol_tipe) || "outeur";
  const gekose_tipe = (bestaande && bestaande.tipe) || "persentasie";
  // BELANGRIK: "Vaste bedrag"-verdelings word ALTYD in sent gestoor
  // (dieselfde eenheid as prys_sent), maar personeel tik/sien dit altyd
  // in rand — hier skakel ons sent terug na rand vir vertoning.
  // "Persentasie"-tipes het geen eenheid-omskakeling nodig nie.
  const gekose_waarde =
    bestaande && Number.isFinite(bestaande.waarde)
      ? gekose_tipe === "vaste_bedrag"
        ? (bestaande.waarde / 100).toFixed(2)
        : bestaande.waarde
      : "";
  const gekose_entiteit_id = (bestaande && bestaande.entiteit_id) || "";

  ry.innerHTML = `
    <select class="veld-invoer paneel-verdeling-rol-tipe">${bou_rol_tipe_opsies_html(gekose_rol_tipe)}</select>
    <select class="veld-invoer paneel-verdeling-entiteit">${bou_entiteit_opsies_html(gekose_rol_tipe, gekose_entiteit_id)}</select>
    <select class="veld-invoer paneel-verdeling-tipe">
      <option value="persentasie" ${gekose_tipe === "persentasie" ? "selected" : ""}>${t("paneel_persentasie")}</option>
      <option value="vaste_bedrag" ${gekose_tipe === "vaste_bedrag" ? "selected" : ""}>${t("paneel_vaste_bedrag")}</option>
    </select>
    <input type="number" class="veld-invoer paneel-verdeling-waarde" min="0" step="0.01" placeholder="${t("paneel_waarde")}" value="${gekose_waarde}">
    <button type="button" class="terug-skakel paneel-verdeling-verwyder" aria-label="${t("paneel_verwyder_verdeling")}">✕</button>
  `;

  ry.querySelector(".paneel-verdeling-verwyder").addEventListener("click", () => ry.remove());

  // Wanneer die rol verander, moet die entiteit-keuselys heeltemal
  // herbou word (dit verwys nou na 'n ander register) — en die vorige
  // keuse val outomaties weg, want dit hoort nie meer by die nuwe rol nie.
  ry.querySelector(".paneel-verdeling-rol-tipe").addEventListener("change", (gebeurtenis) => {
    const entiteitSelect = ry.querySelector(".paneel-verdeling-entiteit");
    entiteitSelect.innerHTML = bou_entiteit_opsies_html(gebeurtenis.target.value, "");
  });

  return ry;
}

function voeg_verdeling_ry_by(voorvoegsel, bestaande) {
  const lys = document.getElementById(`vorm-${voorvoegsel}-verdelings-lys`);
  lys.appendChild(skep_verdeling_ry_element(voorvoegsel, bestaande || null));
}

function kry_verdelings_uit_vorm(voorvoegsel) {
  const lys = document.getElementById(`vorm-${voorvoegsel}-verdelings-lys`);
  return Array.from(lys.querySelectorAll(".paneel-verdeling-ry")).map((ry) => {
    const tipe = ry.querySelector(".paneel-verdeling-tipe").value;
    const rou_waarde = parseFloat(ry.querySelector(".paneel-verdeling-waarde").value);
    // "Vaste bedrag" word deur personeel in RAND ingetik, maar moet in
    // SENT gestoor word (dieselfde eenheid as prys_sent) — sonder hierdie
    // omskakeling word 'n R60-verdeling as 60 sent (R0.60) uitbetaal.
    const waarde = tipe === "vaste_bedrag" ? Math.round(rou_waarde * 100) : rou_waarde;
    return {
      rol_tipe: ry.querySelector(".paneel-verdeling-rol-tipe").value,
      entiteit_id: ry.querySelector(".paneel-verdeling-entiteit").value,
      tipe,
      waarde,
    };
  });
}

// Ververs elke reeds-oop verdeling-ry se entiteit-keuselys met die
// nuutste register-data (bv. ná 'n nuwe vennoot bygevoeg is terwyl 'n
// boek se vorm reeds oop was) — behou die huidige keuse waar moontlik.
function ververs_alle_verdeling_aftrekkieslyste() {
  document.querySelectorAll(".paneel-verdeling-ry").forEach((ry) => {
    const rolSelect = ry.querySelector(".paneel-verdeling-rol-tipe");
    const entiteitSelect = ry.querySelector(".paneel-verdeling-entiteit");
    const huidige_waarde = entiteitSelect.value;
    entiteitSelect.innerHTML = bou_entiteit_opsies_html(rolSelect.value, huidige_waarde);
  });
}

// --- Outeur-kieser-rye (herhaalbaar — 'n boek kan meer as een outeur hê) ---

function bou_outeur_opsies_html(gekose_outeur_id) {
  const geen_opsie = `<option value="">Kies outeur</option>`;
  const opsies = outeurs_kas
    .map(
      (o) =>
        `<option value="${o.outeur_id}" ${o.outeur_id === gekose_outeur_id ? "selected" : ""}>${o.naam}</option>`
    )
    .join("");
  return geen_opsie + opsies;
}

function skep_outeur_ry_element(gekose_outeur_id) {
  const ry = document.createElement("div");
  ry.className = "paneel-outeur-ry veld-ry";
  ry.innerHTML = `
    <select class="veld-invoer paneel-outeur-ry-kies">${bou_outeur_opsies_html(gekose_outeur_id || "")}</select>
    <button type="button" class="terug-skakel paneel-outeur-ry-verwyder" aria-label="Verwyder outeur">✕</button>
  `;
  ry.querySelector(".paneel-outeur-ry-verwyder").addEventListener("click", () => ry.remove());
  return ry;
}

function voeg_outeur_ry_by(gekose_outeur_id) {
  document.getElementById("vorm-outeurs-lys").appendChild(skep_outeur_ry_element(gekose_outeur_id || null));
}

function kry_outeur_ids_uit_vorm() {
  return Array.from(document.querySelectorAll(".paneel-outeur-ry-kies"))
    .map((select) => select.value)
    .filter(Boolean);
}

// Ververs enige reeds-oop outeur-rye se keuselys (bv. ná 'n nuwe outeur
// via die Uitnodigings-oortjie bygevoeg is) — behou huidige keuse.
function ververs_alle_outeur_aftrekkieslyste() {
  document.querySelectorAll(".paneel-outeur-ry-kies").forEach((select) => {
    const huidige_waarde = select.value;
    select.innerHTML = bou_outeur_opsies_html(huidige_waarde);
  });
}

// --- Vorm: oopmaak/toemaak ---

function reset_vorm() {
  document.getElementById("paneel-produk-vorm").reset();
  document.getElementById("vorm-oorspronklike-slug").value = "";
  document.getElementById("vorm-slug").disabled = false;
  document.getElementById("vorm-eboek-beskikbaar").checked = true;
  document.getElementById("vorm-omslag").value = "";
  wys_omslag_voorskou("");
  document.getElementById("vorm-omslag-status").textContent = "";
  document.getElementById("vorm-eboek-sleutel").value = "";
  document.getElementById("vorm-eboek-lêer-status").textContent = "";
  document.getElementById("vorm-eboek-verdelings-lys").innerHTML = "";
  document.getElementById("vorm-hardekopie-verdelings-lys").innerHTML = "";
  document.getElementById("vorm-leen-verdelings-lys").innerHTML = "";
  document.getElementById("vorm-outeurs-lys").innerHTML = "";
  bou_kategorie_merkblokkies([]);
  document.getElementById("vorm-etiket-pasgemaak-velde").style.display = "none";
  wys_verberg_formaat_velde();
  document.getElementById("paneel-vorm-titel").textContent = t("paneel_voeg_produk_by_titel");
  document.getElementById("paneel-vorm-indien").textContent = t("paneel_skep_produk");
  document.getElementById("paneel-vorm-foute").style.display = "none";
}

function wys_omslag_voorskou(pad) {
  const beeld = document.getElementById("vorm-omslag-voorskou");
  if (pad) {
    beeld.src = pad;
    beeld.style.display = "block";
  } else {
    beeld.removeAttribute("src");
    beeld.style.display = "none";
  }
}

// --- Omslag-oplaai ---

function lees_lêer_as_base64(lêer) {
  return new Promise((resolve, reject) => {
    const leser = new FileReader();
    leser.onload = () => {
      // readAsDataURL gee "data:image/png;base64,iVBORw0..." — ons het
      // net die gedeelte ná die komma nodig.
      const volledig = leser.result;
      const kommaIndeks = volledig.indexOf(",");
      resolve(volledig.slice(kommaIndeks + 1));
    };
    leser.onerror = () => reject(leser.error);
    leser.readAsDataURL(lêer);
  });
}

async function hanteer_omslag_lêer_gekies(gebeurtenis) {
  const lêer = gebeurtenis.target.files && gebeurtenis.target.files[0];
  const statusWrap = document.getElementById("vorm-omslag-status");
  if (!lêer) return;

  const MAKS_GROOTTE = 4 * 1024 * 1024;
  const TOEGELATE_TIPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (!TOEGELATE_TIPES.includes(lêer.type)) {
    statusWrap.textContent = t("paneel_oplaai_verkeerde_tipe");
    gebeurtenis.target.value = "";
    return;
  }
  if (lêer.size > MAKS_GROOTTE) {
    statusWrap.textContent = t("paneel_oplaai_te_groot");
    gebeurtenis.target.value = "";
    return;
  }

  statusWrap.textContent = t("paneel_oplaai_besig");

  try {
    const data_base64 = await lees_lêer_as_base64(lêer);
    const slug = document.getElementById("vorm-slug").value.trim();

    const resp = await fetch("/.netlify/functions/laai-omslag-op", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ slug, inhoud_tipe: lêer.type, data_base64 }),
    });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    const data = await resp.json();
    document.getElementById("vorm-omslag").value = data.pad;
    wys_omslag_voorskou(data.pad);
    statusWrap.textContent = t("paneel_oplaai_sukses");
  } catch (fout) {
    console.error("Kon nie omslag oplaai nie:", fout);
    statusWrap.textContent = `${t("paneel_oplaai_fout")}${fout.message}`;
  }
}

// --- E-boek-PDF-oplaai (stuksgewys — sien laai-eboek-op.js vir hoekom) ---

// Lees 'n Blob/File-fragment as base64, sonder om die HELE lêer eers in
// geheue as een groot data-URL te probeer omskep (belangrik vir groot
// PDF's — ons lees en stuur een stuk op 'n slag).
function lees_stuk_as_base64(stuk) {
  return new Promise((resolve, reject) => {
    const leser = new FileReader();
    leser.onload = () => {
      const volledig = leser.result;
      const kommaIndeks = volledig.indexOf(",");
      resolve(volledig.slice(kommaIndeks + 1));
    };
    leser.onerror = () => reject(leser.error);
    leser.readAsDataURL(stuk);
  });
}

async function hanteer_eboek_lêer_gekies(gebeurtenis) {
  const lêer = gebeurtenis.target.files && gebeurtenis.target.files[0];
  const statusWrap = document.getElementById("vorm-eboek-lêer-status");
  if (!lêer) return;

  if (lêer.type !== "application/pdf") {
    statusWrap.textContent = t("paneel_eboek_oplaai_verkeerde_tipe");
    gebeurtenis.target.value = "";
    return;
  }

  const slug = document.getElementById("vorm-slug").value.trim();
  if (!slug) {
    statusWrap.textContent = t("paneel_eboek_oplaai_geen_slug");
    gebeurtenis.target.value = "";
    return;
  }

  const STUK_GROOTTE = 3 * 1024 * 1024; // 3MB per stuk (ruim onder die 6MB-limiet ná base64)
  const opload_id = crypto.randomUUID();
  const totale_stukke = Math.ceil(lêer.size / STUK_GROOTTE);

  try {
    for (let indeks = 0; indeks < totale_stukke; indeks++) {
      const begin = indeks * STUK_GROOTTE;
      const stuk = lêer.slice(begin, begin + STUK_GROOTTE);
      const data_base64 = await lees_stuk_as_base64(stuk);
      const is_laaste = indeks === totale_stukke - 1;

      statusWrap.textContent = `${t("paneel_eboek_oplaai_besig")} (${indeks + 1}/${totale_stukke})`;

      const resp = await fetch(LAAI_EBOEK_OP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
        body: JSON.stringify({
          slug,
          opload_id,
          stuk_indeks: indeks,
          is_laaste,
          data_base64,
        }),
      });

      if (!resp.ok) {
        const teks = await resp.text();
        throw new Error(teks || `Status ${resp.status}`);
      }

      if (is_laaste) {
        const data = await resp.json();
        document.getElementById("vorm-eboek-sleutel").value = data.eboek_sleutel;
        statusWrap.textContent = t("paneel_eboek_oplaai_sukses");
      }
    }
  } catch (fout) {
    console.error("Kon nie e-boek-PDF oplaai nie:", fout);
    statusWrap.textContent = `${t("paneel_oplaai_fout")}${fout.message}`;
  }
}

function wys_verberg_formaat_velde() {
  document.getElementById("vorm-eboek-velde").style.display =
    document.getElementById("vorm-eboek-beskikbaar").checked ? "block" : "none";
  document.getElementById("vorm-hardekopie-velde").style.display =
    document.getElementById("vorm-hardekopie-beskikbaar").checked ? "block" : "none";
  document.getElementById("vorm-eboek-verdeling-velde").style.display =
    document.getElementById("vorm-eboek-verdeling-aan").checked ? "block" : "none";
  document.getElementById("vorm-hardekopie-verdeling-velde").style.display =
    document.getElementById("vorm-hardekopie-verdeling-aan").checked ? "block" : "none";
  document.getElementById("vorm-eboek-hosting-velde").style.display =
    document.getElementById("vorm-eboek-hosting-aan").checked ? "block" : "none";
  document.getElementById("vorm-hardekopie-hosting-velde").style.display =
    document.getElementById("vorm-hardekopie-hosting-aan").checked ? "block" : "none";
  document.getElementById("vorm-leen-velde").style.display =
    document.getElementById("vorm-leen-beskikbaar").checked ? "block" : "none";
  document.getElementById("vorm-leen-verdeling-velde").style.display =
    document.getElementById("vorm-leen-verdeling-aan").checked ? "block" : "none";
  document.getElementById("vorm-leen-hosting-velde").style.display =
    document.getElementById("vorm-leen-hosting-aan").checked ? "block" : "none";
  document.getElementById("vorm-etiket-velde").style.display =
    document.getElementById("vorm-etiket-aan").checked ? "block" : "none";
}

function open_vorm_vir_toevoeging() {
  reset_vorm();
  voeg_outeur_ry_by(null);
  document.getElementById("paneel-vorm-afdeling").style.display = "block";
  document.getElementById("paneel-vorm-afdeling").scrollIntoView({ behavior: "smooth" });
}

function open_vorm_vir_wysig(produk) {
  reset_vorm();
  document.getElementById("paneel-vorm-titel").textContent = `${t("paneel_wysig_titel_voorvoegsel")}${produk.titel}`;
  document.getElementById("paneel-vorm-indien").textContent = t("paneel_stoor_wysigings");
  document.getElementById("vorm-oorspronklike-slug").value = produk.slug;

  document.getElementById("vorm-slug").value = produk.slug;
  document.getElementById("vorm-slug").disabled = true; // slug is die sleutel — nie wysigbaar nie
  document.getElementById("vorm-titel").value = produk.titel || "";
  if (Array.isArray(produk.outeur_ids) && produk.outeur_ids.length) {
    produk.outeur_ids.forEach((outeur_id) => voeg_outeur_ry_by(outeur_id));
  } else {
    // Ou produkte van vóór hierdie wysiging het net 'n vry-teks outeur-veld
    // — geen outeur_ids nie. Wys een leë ry sodat personeel dit kan opstel.
    voeg_outeur_ry_by(null);
  }
  bou_kategorie_merkblokkies(produk.kategorie_ids || []);
  document.getElementById("vorm-oorsig").value = produk.oorsig || "";
  document.getElementById("vorm-vol-beskrywing").value = produk.vol_beskrywing || "";
  document.getElementById("vorm-isbn-eboek").value = (produk.isbn && produk.isbn.eboek) || "";
  document.getElementById("vorm-isbn-hardekopie").value = (produk.isbn && produk.isbn.harde_kopie) || "";
  document.getElementById("vorm-omslag").value = produk.omslag || "";
  wys_omslag_voorskou(produk.omslag || "");

  if (produk.etiket) {
    document.getElementById("vorm-etiket-aan").checked = true;
    const teks_af = produk.etiket.teks_af || produk.etiket.teks || "";
    const teks_en = produk.etiket.teks_en || "";
    document.getElementById("vorm-etiket-teks-af").value = teks_af;
    document.getElementById("vorm-etiket-teks-en").value = teks_en;

    const voorafgestelde_sleutel = kry_etiket_voorafgestelde_sleutel(teks_af, teks_en);
    document.getElementById("vorm-etiket-voorafgestel").value = voorafgestelde_sleutel;
    document.getElementById("vorm-etiket-pasgemaak-velde").style.display =
      voorafgestelde_sleutel === "aangepas" ? "block" : "none";

    const gekose_kleur_radio = document.querySelector(
      `input[name="vorm-etiket-kleur"][value="${produk.etiket.kleur || "amber"}"]`
    );
    if (gekose_kleur_radio) gekose_kleur_radio.checked = true;
  }

  const eboek = (produk.formate && produk.formate.eboek) || {};
  document.getElementById("vorm-eboek-beskikbaar").checked = !!eboek.beskikbaar;
  document.getElementById("vorm-eboek-prys").value = eboek.prys_sent ? (eboek.prys_sent / 100).toFixed(2) : "";
  document.getElementById("vorm-eboek-vrystelling").value = eboek.vrystelling_datum || "";
  document.getElementById("vorm-eboek-sleutel").value = eboek.eboek_sleutel || "";
  document.getElementById("vorm-eboek-lêer-status").textContent = eboek.eboek_sleutel
    ? t("paneel_eboek_reeds_opgelaai")
    : "";
  if (eboek.verdelings && eboek.verdelings.length) {
    document.getElementById("vorm-eboek-verdeling-aan").checked = true;
    eboek.verdelings.forEach((v) => voeg_verdeling_ry_by("eboek", v));
  }
  if (eboek.hosting) {
    document.getElementById("vorm-eboek-hosting-aan").checked = true;
    document.getElementById("vorm-eboek-hosting-tipe").value = eboek.hosting.tipe || "persentasie";
    document.getElementById("vorm-eboek-hosting-waarde").value = eboek.hosting.waarde
      ? eboek.hosting.tipe === "vaste_bedrag"
        ? (eboek.hosting.waarde / 100).toFixed(2)
        : eboek.hosting.waarde
      : "";
  }

  const hardeKopie = (produk.formate && produk.formate.harde_kopie) || {};
  document.getElementById("vorm-hardekopie-beskikbaar").checked = !!hardeKopie.beskikbaar;
  document.getElementById("vorm-hardekopie-prys").value = hardeKopie.prys_sent ? (hardeKopie.prys_sent / 100).toFixed(2) : "";
  document.getElementById("vorm-hardekopie-vrystelling").value = hardeKopie.vrystelling_datum || "";
  document.getElementById("vorm-hardekopie-voorraad").value = hardeKopie.voorraad_status || "beskikbaar";
  if (hardeKopie.verdelings && hardeKopie.verdelings.length) {
    document.getElementById("vorm-hardekopie-verdeling-aan").checked = true;
    hardeKopie.verdelings.forEach((v) => voeg_verdeling_ry_by("hardekopie", v));
  }
  if (hardeKopie.hosting) {
    document.getElementById("vorm-hardekopie-hosting-aan").checked = true;
    document.getElementById("vorm-hardekopie-hosting-tipe").value = hardeKopie.hosting.tipe || "persentasie";
    document.getElementById("vorm-hardekopie-hosting-waarde").value = hardeKopie.hosting.waarde
      ? hardeKopie.hosting.tipe === "vaste_bedrag"
        ? (hardeKopie.hosting.waarde / 100).toFixed(2)
        : hardeKopie.hosting.waarde
      : "";
  }

  const leen = (produk.formate && produk.formate.leen) || {};
  document.getElementById("vorm-leen-beskikbaar").checked = !!leen.beskikbaar;
  document.getElementById("vorm-leen-prys").value = leen.prys_sent ? (leen.prys_sent / 100).toFixed(2) : "";
  document.getElementById("vorm-leen-tydperk").value = leen.tydperk_dae || 30;
  if (leen.verdelings && leen.verdelings.length) {
    document.getElementById("vorm-leen-verdeling-aan").checked = true;
    leen.verdelings.forEach((v) => voeg_verdeling_ry_by("leen", v));
  }
  if (leen.hosting) {
    document.getElementById("vorm-leen-hosting-aan").checked = true;
    document.getElementById("vorm-leen-hosting-tipe").value = leen.hosting.tipe || "persentasie";
    document.getElementById("vorm-leen-hosting-waarde").value = leen.hosting.waarde
      ? leen.hosting.tipe === "vaste_bedrag"
        ? (leen.hosting.waarde / 100).toFixed(2)
        : leen.hosting.waarde
      : "";
  }

  wys_verberg_formaat_velde();
  document.getElementById("paneel-vorm-afdeling").style.display = "block";
  document.getElementById("paneel-vorm-afdeling").scrollIntoView({ behavior: "smooth" });
}

function sluit_vorm() {
  document.getElementById("paneel-vorm-afdeling").style.display = "none";
  reset_vorm();
}

// --- Vorm: bou versoek-liggaam vanuit die veld-waardes ---

function kry_rand_as_sent(veld_id) {
  const waarde = parseFloat(document.getElementById(veld_id).value);
  return Number.isFinite(waarde) ? Math.round(waarde * 100) : 0;
}

function bou_verdelings_vanuit_vorm(voorvoegsel) {
  const aan = document.getElementById(`vorm-${voorvoegsel}-verdeling-aan`).checked;
  if (!aan) return [];
  return kry_verdelings_uit_vorm(voorvoegsel);
}

function kry_hosting_vanuit_vorm(voorvoegsel) {
  const aan = document.getElementById(`vorm-${voorvoegsel}-hosting-aan`).checked;
  if (!aan) return null;
  const tipe = document.getElementById(`vorm-${voorvoegsel}-hosting-tipe`).value;
  const rou_waarde = parseFloat(document.getElementById(`vorm-${voorvoegsel}-hosting-waarde`).value);
  if (!Number.isFinite(rou_waarde) || rou_waarde <= 0) return null;
  // Selfde rand-na-sent-omskakeling as die verdelings hierbo — Hosting se
  // "Vaste bedrag (R)" word ook deur personeel in rand ingetik.
  const waarde = tipe === "vaste_bedrag" ? Math.round(rou_waarde * 100) : rou_waarde;
  return { tipe, waarde };
}

// Lees die twee opsionele ISBN-velde. null as albei leeg is — dan verskyn
// die ISBN-blok glad nie op die produkbladsy nie. Future Shop reik nie
// ISBN's uit nie; dis die outeur se eie nommer en ons wys dit net.
function kry_isbn_vanuit_vorm() {
  const eboek = document.getElementById("vorm-isbn-eboek").value.trim();
  const harde_kopie = document.getElementById("vorm-isbn-hardekopie").value.trim();
  if (!eboek && !harde_kopie) return null;
  return { eboek, harde_kopie };
}

function kry_etiket_vanuit_vorm() {
  const aan = document.getElementById("vorm-etiket-aan").checked;
  if (!aan) return null;

  const voorafgestelde_sleutel = document.getElementById("vorm-etiket-voorafgestel").value;
  if (!voorafgestelde_sleutel) return null;

  let teks_af;
  let teks_en;

  if (voorafgestelde_sleutel === "aangepas") {
    teks_af = document.getElementById("vorm-etiket-teks-af").value.trim();
    teks_en = document.getElementById("vorm-etiket-teks-en").value.trim();
  } else {
    const voorafgestelde = VOORAFGESTELDE_ETIKETTE[voorafgestelde_sleutel];
    teks_af = voorafgestelde ? voorafgestelde.af : "";
    teks_en = voorafgestelde ? voorafgestelde.en : "";
  }

  if (!teks_af && !teks_en) return null;

  const gekose_kleur = document.querySelector('input[name="vorm-etiket-kleur"]:checked');
  return {
    teks_af: teks_af || teks_en,
    teks_en: teks_en || teks_af,
    kleur: gekose_kleur ? gekose_kleur.value : "amber",
  };
}

function bou_produk_liggaam() {
  const eboekBeskikbaar = document.getElementById("vorm-eboek-beskikbaar").checked;
  const hardeKopieBeskikbaar = document.getElementById("vorm-hardekopie-beskikbaar").checked;
  const leenBeskikbaar = document.getElementById("vorm-leen-beskikbaar").checked;

  return {
    slug: document.getElementById("vorm-slug").value.trim(),
    titel: document.getElementById("vorm-titel").value.trim(),
    outeur_ids: kry_outeur_ids_uit_vorm(),
    kategorie_ids: kry_kategorie_ids_uit_vorm(),
    oorsig: document.getElementById("vorm-oorsig").value.trim(),
    vol_beskrywing: document.getElementById("vorm-vol-beskrywing").value.trim(),
    omslag: document.getElementById("vorm-omslag").value.trim(),
    isbn: kry_isbn_vanuit_vorm(),
    etiket: kry_etiket_vanuit_vorm(),
    formate: {
      eboek: {
        beskikbaar: eboekBeskikbaar,
        prys_sent: kry_rand_as_sent("vorm-eboek-prys"),
        vrystelling_datum: document.getElementById("vorm-eboek-vrystelling").value || null,
        verdelings: bou_verdelings_vanuit_vorm("eboek"),
        hosting: kry_hosting_vanuit_vorm("eboek"),
        eboek_sleutel: document.getElementById("vorm-eboek-sleutel").value.trim() || null,
      },
      harde_kopie: {
        beskikbaar: hardeKopieBeskikbaar,
        prys_sent: kry_rand_as_sent("vorm-hardekopie-prys"),
        voorraad_status: document.getElementById("vorm-hardekopie-voorraad").value,
        vrystelling_datum: document.getElementById("vorm-hardekopie-vrystelling").value || null,
        verdelings: bou_verdelings_vanuit_vorm("hardekopie"),
        hosting: kry_hosting_vanuit_vorm("hardekopie"),
      },
      leen: {
        beskikbaar: leenBeskikbaar,
        prys_sent: kry_rand_as_sent("vorm-leen-prys"),
        tydperk_dae: Number(document.getElementById("vorm-leen-tydperk").value) || 30,
        verdelings: bou_verdelings_vanuit_vorm("leen"),
        hosting: kry_hosting_vanuit_vorm("leen"),
      },
    },
  };
}

function wys_vorm_foute(boodskap) {
  const wrap = document.getElementById("paneel-vorm-foute");
  wrap.textContent = boodskap;
  wrap.style.display = "block";
}

async function hanteer_vorm_indiening(gebeurtenis) {
  gebeurtenis.preventDefault();
  document.getElementById("paneel-vorm-foute").style.display = "none";

  const oorspronklike_slug = document.getElementById("vorm-oorspronklike-slug").value;
  const is_wysiging = !!oorspronklike_slug;
  const produk = bou_produk_liggaam();

  if (!produk.slug || !produk.titel || !produk.outeur_ids.length) {
    wys_vorm_foute(t("paneel_verpligte_velde_fout"));
    return;
  }
  if (!produk.formate.eboek.beskikbaar && !produk.formate.harde_kopie.beskikbaar) {
    wys_vorm_foute(t("paneel_formaat_verplig_fout"));
    return;
  }

  const knoppie = document.getElementById("paneel-vorm-indien");
  knoppie.disabled = true;
  knoppie.textContent = t("besig");

  try {
    const resp = is_wysiging
      ? await fetch(WYSIG_PRODUK_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
          body: JSON.stringify({ slug: oorspronklike_slug, wysigings: produk }),
        })
      : await fetch(SKEP_PRODUK_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
          body: JSON.stringify(produk),
        });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    sluit_vorm();
    laai_produkte();
  } catch (fout) {
    console.error("Kon nie produk stoor nie:", fout);
    wys_vorm_foute(`${t("paneel_kon_nie_stoor")}${fout.message}`);
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = is_wysiging ? t("paneel_stoor_wysigings") : t("paneel_skep_produk");
  }
}

// --- Wagwoord-ogies (gewone <input type="password"> nou — geen Shadow
// DOM meer nie, dus 'n eenvoudige direkte wissel) ---

function koppel_wagwoord_ogies() {
  document.querySelectorAll(".paneel-wagwoord-ogie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      const veld = document.getElementById(knoppie.dataset.teiken);
      const wys = veld.type === "password";
      veld.type = wys ? "text" : "password";
      knoppie.style.opacity = wys ? "1" : "0.55";
    });
  });
}

// --- Token uit URL-hash (uitnodiging/bevestiging/herstel) ---

function kry_token_uit_hash() {
  const hash = window.location.hash;
  const confirmatie = hash.match(/confirmation_token=([^&]+)/);
  const uitnodiging = hash.match(/invite_token=([^&]+)/);
  const herstel = hash.match(/recovery_token=([^&]+)/);

  if (confirmatie) return { tipe: "signup", token: confirmatie[1] };
  if (uitnodiging) return { tipe: "signup", token: uitnodiging[1] };
  if (herstel) return { tipe: "recovery", token: herstel[1] };
  return null;
}

function wys_stel_nuwe_wagwoord_afdeling(token_inligting) {
  verberg_alle_auth_afdelings();
  document.getElementById("paneel-nuwe-wagwoord-afdeling").style.display = "block";
  document.getElementById("paneel-hoof").style.visibility = "visible";

  document.getElementById("paneel-nuwe-wagwoord-vorm").onsubmit = async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const foutWrap = document.getElementById("paneel-nuwe-wagwoord-foute");
    foutWrap.style.display = "none";

    const wagwoord = document.getElementById("nuwe-wagwoord").value;
    try {
      const sessie = await identiteit_verwerk_token(token_inligting.tipe, token_inligting.token, wagwoord);
      // Maak die token uit die URL skoon sodat 'n verfris nie weer probeer nie
      window.history.replaceState(null, "", window.location.pathname);
      wys_aangemeld_toestand(sessie.gebruiker);
    } catch (fout) {
      foutWrap.textContent = `${t("paneel_kon_nie_wagwoord_stel")}${fout.message}`;
      foutWrap.style.display = "block";
    }
  };
}

// --- Opstelling ---

document.addEventListener("DOMContentLoaded", async () => {
  koppel_wagwoord_ogies();

  const token_inligting = kry_token_uit_hash();
  if (token_inligting) {
    wys_stel_nuwe_wagwoord_afdeling(token_inligting);
  } else {
    const sessie = await identiteit_kry_huidige_sessie();
    if (sessie) wys_aangemeld_toestand(sessie.gebruiker);
    else wys_afgemeld_toestand();
  }

  // Aanmeld
  document.getElementById("paneel-aanmeld-vorm").addEventListener("submit", async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const foutWrap = document.getElementById("paneel-aanmeld-foute");
    foutWrap.style.display = "none";

    const epos = document.getElementById("aanmeld-epos").value.trim();
    const wagwoord = document.getElementById("aanmeld-wagwoord").value;
    const bly_aangemeld = document.getElementById("aanmeld-bly-aangemeld").checked;
    try {
      const sessie = await identiteit_meld_aan(epos, wagwoord, bly_aangemeld);
      wys_aangemeld_toestand(sessie.gebruiker);
    } catch (fout) {
      foutWrap.textContent = `${t("paneel_kon_nie_aanmeld")}${fout.message}`;
      foutWrap.style.display = "block";
    }
  });

  // Wagwoord vergeet → wissel na herstel-vorm
  document.getElementById("paneel-wagwoord-vergeet-skakel").addEventListener("click", () => {
    verberg_alle_auth_afdelings();
    document.getElementById("paneel-herstel-afdeling").style.display = "block";
  });
  document.getElementById("paneel-terug-na-aanmeld-skakel").addEventListener("click", () => {
    verberg_alle_auth_afdelings();
    document.getElementById("paneel-aanmeld-afdeling").style.display = "block";
  });

  // Herstel-epos stuur
  document.getElementById("paneel-herstel-vorm").addEventListener("submit", async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const foutWrap = document.getElementById("paneel-herstel-foute");
    const suksesWrap = document.getElementById("paneel-herstel-sukses");
    foutWrap.style.display = "none";
    suksesWrap.style.display = "none";

    const epos = document.getElementById("herstel-epos").value.trim();
    try {
      await identiteit_stuur_herstel(epos);
      suksesWrap.style.display = "block";
    } catch (fout) {
      foutWrap.textContent = `${t("paneel_kon_nie_herstel_stuur")}${fout.message}`;
      foutWrap.style.display = "block";
    }
  });

  // Afmeld
  document.getElementById("paneel-afmeld-knoppie").addEventListener("click", () => {
    identiteit_meld_af();
    wys_afgemeld_toestand();
  });

  // Produk-vorm
  document.getElementById("paneel-voeg-by-knoppie").addEventListener("click", open_vorm_vir_toevoeging);
  document.getElementById("paneel-vorm-kanselleer").addEventListener("click", sluit_vorm);
  document.getElementById("paneel-produk-vorm").addEventListener("submit", hanteer_vorm_indiening);

  document.getElementById("vorm-eboek-beskikbaar").addEventListener("change", wys_verberg_formaat_velde);
  document.getElementById("vorm-hardekopie-beskikbaar").addEventListener("change", wys_verberg_formaat_velde);
  document.getElementById("vorm-eboek-verdeling-aan").addEventListener("change", wys_verberg_formaat_velde);
  document.getElementById("vorm-hardekopie-verdeling-aan").addEventListener("change", wys_verberg_formaat_velde);
  document.getElementById("vorm-eboek-hosting-aan").addEventListener("change", wys_verberg_formaat_velde);
  document.getElementById("vorm-hardekopie-hosting-aan").addEventListener("change", wys_verberg_formaat_velde);
  document.getElementById("vorm-leen-beskikbaar").addEventListener("change", wys_verberg_formaat_velde);
  document.getElementById("vorm-leen-verdeling-aan").addEventListener("change", wys_verberg_formaat_velde);
  document.getElementById("vorm-leen-hosting-aan").addEventListener("change", wys_verberg_formaat_velde);
  document.getElementById("vorm-etiket-aan").addEventListener("change", wys_verberg_formaat_velde);
  document.getElementById("vorm-etiket-voorafgestel").addEventListener("change", (gebeurtenis) => {
    document.getElementById("vorm-etiket-pasgemaak-velde").style.display =
      gebeurtenis.target.value === "aangepas" ? "block" : "none";
  });
  document.getElementById("vorm-omslag-lêer").addEventListener("change", hanteer_omslag_lêer_gekies);
  document.getElementById("vorm-eboek-lêer").addEventListener("change", hanteer_eboek_lêer_gekies);

  // Outeurs
  document.getElementById("paneel-voeg-outeur-by-knoppie").addEventListener("click", () => open_outeur_vorm(null));
  document.getElementById("paneel-outeur-vorm-kanselleer").addEventListener("click", sluit_outeur_vorm);
  document.getElementById("paneel-outeur-vorm").addEventListener("submit", hanteer_outeur_vorm_indiening);

  // Koepons
  document.getElementById("paneel-voeg-koepon-by-knoppie").addEventListener("click", open_koepon_vorm);
  document.getElementById("paneel-koepon-vorm-kanselleer").addEventListener("click", sluit_koepon_vorm);
  document.getElementById("paneel-koepon-vorm").addEventListener("submit", hanteer_koepon_vorm_indiening);
  document.getElementById("koepon-vorm-tipe").addEventListener("change", wys_verberg_afslag_velde);
  document.getElementById("koepon-vorm-genereer").addEventListener("click", genereer_koepon_kode_voorskou);

  // Verdeling-rye (meervoudige outeur-verdelings per formaat)
  document.getElementById("vorm-eboek-voeg-verdeling-by").addEventListener("click", () => voeg_verdeling_ry_by("eboek"));
  document.getElementById("vorm-voeg-outeur-by").addEventListener("click", () => voeg_outeur_ry_by(null));
  document.getElementById("vorm-hardekopie-voeg-verdeling-by").addEventListener("click", () => voeg_verdeling_ry_by("hardekopie"));
  document.getElementById("vorm-leen-voeg-verdeling-by").addEventListener("click", () => voeg_verdeling_ry_by("leen"));
});
