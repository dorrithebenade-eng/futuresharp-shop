// public/js/paneel-indiening-bywerking.js
//
// Die Werk by-knoppie: 'n goedgekeurde WYSIGING aan 'n boek wat reeds op die
// rak staan. Dit is die eweknie van Stel op — daar word 'n nuwe boek geskep,
// hier word 'n bestaande een reggemaak.
//
// SONDER HIERDIE KNOPPIE VERDWYN WERK. 'n Outeur dien 'n wysiging in, dit
// word goedgekeur, die stand gaan terug na `op_rak` — en die produk verander
// nêrens nie. Die goedkeuring beteken dan niks in die winkel nie.
//
// DIE BESTAANDE VORM, NIE 'N NUWE NIE. open_vorm_vir_wysig() laai die hele
// boek soos hy nou is: sy titel, sy omslag, sy e-boek-sleutel, sy mede-
// outeurs, sy Ontwerp/Admin-ry. Hierdie lêer raak dáárna NET die drie
// formaatblokke. Alles anders bly presies soos die katalogus dit het.
//
// WAT 'N WYSIGING KAN WEES: 'n e-boek by of af, 'n harde kopie by of af, Leen
// aan of af, die boekprys, en die outeur se druk-/afleweringskoste. Meer nie.
// 'n Nuwe manuskrip of omslag is 'n nuwe boekopstelling en gaan as 'n NUWE
// indiening in — daarom raak hierdie lêer nooit `vorm-eboek-sleutel` of
// `vorm-omslag` nie.
//
// RYE WORD BEWAAR. Stel op skryf op 'n leë vorm en kan die rylys uitvee.
// Hier mag dit nie: 'n mede-outeur se ry, Ontwerp/Admin, Printing en
// Aflewering staan reeds in die vorm en die indiening weet niks van hulle
// nie. Slegs die rye van HIERDIE outeur word herskryf — op rol EN entiteit,
// nie op rol alleen nie.
//
// 'N FORMAAT WAT AFGEHAAL WORD, HOU SY RYE. Die blokkie gaan af en die rye
// bly staan as verwysingspunt: kom die formaat later terug, is die ou
// verdeling daar om na te kyk. 'n Formaat wat af is, betaal in elk geval
// niks uit nie.
//
// DIE NOTA VERGELYK TEEN DIE PRODUK, nie teen 'n ou indiening nie. Ná
// goedkeuring het `hangend` reeds `data` geword — die ou waardes leef net
// nog in die katalogus. Dit is boonop die eerlike vergelyking: dit wys wat
// werklik in die winkel gaan verander.
//
// DIT PUBLISEER NIE. Die vorm word gevul; die boek verander wanneer Dorrithé
// stoor, met wysig-produk.js se volle validering. Dieselfde reël as
// keur-goed.js en paneel-indiening-oordrag.js s'n.

// Die som en die helpers kom uit paneel-indiening-oordrag.js. DOELBEWUS
// hergebruik: pio_som() dra die aannames (70%, Hosting 5%, afronding na R5,
// Paystack se koers). Dieselfde som wat op twee plekke apart leef, verskil
// vroeër of later met 'n paar sent, en dan weier wysig-produk.js die boek.

// Die indiening praat van "hardekopie"; die katalogus stoor "harde_kopie".
const PIB_FORMATE = [
  { s: "eboek", katalogus: "eboek", i18n: "pib_f_eboek", naam: "E-boek" },
  { s: "hardekopie", katalogus: "harde_kopie", i18n: "pib_f_hardekopie", naam: "Harde kopie" },
  { s: "leen", katalogus: "leen", i18n: "pib_f_leen", naam: "Leen" },
];

// Wag om as bygewerk gemerk te word: { nommer, slug }. Leef net in die
// geheue — 'n herlaai laat die merk weg, en dan staan die Werk by-knoppie
// nog daar waar dit sigbaar is.
let PIB_WAG = null;

function pib_t(sleutel, terugval) {
  return window.t ? window.t(sleutel) : terugval;
}

function pib_oop() {
  try {
    return typeof PG_OOP !== "undefined" ? PG_OOP : null;
  } catch {
    return null;
  }
}

function pib_produk(slug) {
  try {
    if (typeof produkte_kas === "undefined" || !Array.isArray(produkte_kas)) return null;
    return produkte_kas.find((p) => p.slug === slug) || null;
  } catch {
    return null;
  }
}

function pib_rand(bedrag) {
  return "R" + Number(bedrag || 0).toFixed(2).replace(".", ",");
}

// --- Die vergelyking ---
//
// Wat gaan werklik in die winkel verander? Die indiening se blok teenoor die
// katalogus se formaat.

function pib_verskil(f, data, produk) {
  const blok = (data.formate || {})[f.s] || {};
  const aan = Boolean(blok.aan);

  const ou = (produk.formate || {})[f.katalogus] || {};
  const ou_aan = Boolean(ou.beskikbaar);

  if (!aan && !ou_aan) return { f, aan, soort: "" };
  if (aan && !ou_aan) return { f, aan, soort: "bygesit", blok };
  if (!aan && ou_aan) return { f, aan, soort: "afgehaal", ou_prys: (ou.prys_sent || 0) / 100 };

  // Albei aan: het die prys geskuif?
  const u = typeof pio_som === "function" ? pio_som(blok) : null;
  const ou_prys = (ou.prys_sent || 0) / 100;
  if (u && Math.abs(u.P - ou_prys) > 0.005) {
    return { f, aan, soort: "prys", blok, ou_prys, nuwe_prys: u.P };
  }
  return { f, aan, soort: "", blok };
}

function pib_nota_reels(verskille) {
  return verskille
    .filter((v) => v.soort)
    .map((v) => {
      const naam = pib_t(v.f.i18n, v.f.naam);
      if (v.soort === "bygesit") return naam + " " + pib_t("pib_bygesit", "bygesit") + ".";
      if (v.soort === "afgehaal") return naam + " " + pib_t("pib_afgehaal", "afgehaal") + ".";
      return naam + ": " + pib_rand(v.ou_prys) + " \u2192 " + pib_rand(v.nuwe_prys) + ".";
    });
}

// --- Die rye ---

function pib_lees_rye(s) {
  const lys = document.getElementById("vorm-" + s + "-verdelings-lys");
  if (!lys) return [];
  return Array.from(lys.querySelectorAll(".paneel-verdeling-ry")).map((ry) => {
    const tipe = ry.querySelector(".paneel-verdeling-tipe").value;
    const rou = parseFloat(ry.querySelector(".paneel-verdeling-waarde").value);
    // Die veld wys 'n vaste bedrag in RAND; voeg_verdeling_ry_by() verwag
    // SENT en deel weer deur 100. Sonder hierdie omskakeling word 'n
    // bewaarde R80-ry teruggeskryf as R0,80.
    return {
      rol_tipe: ry.querySelector(".paneel-verdeling-rol-tipe").value,
      entiteit_id: ry.querySelector(".paneel-verdeling-entiteit").value,
      tipe,
      waarde: tipe === "vaste_bedrag"
        ? (Number.isFinite(rou) ? Math.round(rou * 100) : 0)
        : (Number.isFinite(rou) ? rou : 0),
    };
  });
}

// Herskryf slegs HIERDIE outeur se rye. Op rol EN entiteit — 'n filter op
// rol alleen sou 'n mede-outeur se ry uitvee, en die indiening weet nie eens
// dat hy bestaan nie.
function pib_skryf_formaat(s, blok, outeur_id) {
  const u = typeof pio_som === "function" ? pio_som(blok) : null;
  if (!u) return false;

  const behou = pib_lees_rye(s).filter(
    (ry) => !(ry.rol_tipe === "outeur" && String(ry.entiteit_id) === String(outeur_id))
  );

  const nuwe = [];
  if (u.K > 0) {
    nuwe.push({
      rol_tipe: "outeur",
      entiteit_id: outeur_id,
      tipe: "vaste_bedrag",
      waarde: Math.round(u.K * 100),
    });
  }
  const pct = u.P > 0 ? (u.outeurPersRand / u.P) * 100 : 0;
  nuwe.push({
    rol_tipe: "outeur",
    entiteit_id: outeur_id,
    tipe: "persentasie",
    waarde: Number(pct.toFixed(2)),
  });

  const prys = document.getElementById("vorm-" + s + "-prys");
  if (prys) prys.value = u.P.toFixed(2);

  const lys = document.getElementById("vorm-" + s + "-verdelings-lys");
  if (lys && typeof voeg_verdeling_ry_by === "function") {
    lys.innerHTML = "";
    nuwe.concat(behou).forEach((ry) => voeg_verdeling_ry_by(s, ry));
  }
  if (typeof pio_merk === "function") pio_merk("vorm-" + s + "-verdeling-aan", true);

  // Hosting geld op die BOEKDEEL en word 'n persentasie van die volle prys —
  // die outeur se versending mag nie Hosting betaal nie.
  const hosting_pct = u.P > 0 ? (u.hostingRand / u.P) * 100 : 0;
  if (typeof pio_merk === "function") pio_merk("vorm-" + s + "-hosting-aan", true);
  const h_tipe = document.getElementById("vorm-" + s + "-hosting-tipe");
  const h_waarde = document.getElementById("vorm-" + s + "-hosting-waarde");
  if (h_tipe) h_tipe.value = "persentasie";
  if (h_waarde) h_waarde.value = Number(hosting_pct.toFixed(2));

  return true;
}

// --- Die nota ---

function pib_verwyder_nota() {
  const oud = document.getElementById("pib-nota");
  if (oud) oud.remove();
}

function pib_wys_nota(nommer, reels, waarskuwing) {
  pib_verwyder_nota();
  const anker = document.getElementById("paneel-vorm-titel");
  if (!anker) return;

  const nota = document.createElement("div");
  nota.id = "pib-nota";
  nota.className = "pib-nota";

  const kop = document.createElement("div");
  kop.className = "pib-nota-kop";
  kop.textContent = nommer + " \u2014 " + pib_t("pib_nota_kop", "goedgekeurde wysiging");
  nota.appendChild(kop);

  if (reels.length) {
    const ul = document.createElement("ul");
    ul.className = "pib-nota-lys";
    reels.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r;
      ul.appendChild(li);
    });
    nota.appendChild(ul);
  } else {
    const p = document.createElement("p");
    p.className = "pib-nota-reel";
    p.textContent = pib_t("pib_geen_verskil",
      "Die formate en pryse stem reeds ooreen met die katalogus.");
    nota.appendChild(p);
  }

  if (waarskuwing) {
    const w = document.createElement("p");
    w.className = "pib-nota-waarsku";
    w.textContent = waarskuwing;
    nota.appendChild(w);
  }

  anker.parentNode.insertBefore(nota, anker.nextSibling);
}

// --- Werk by ---

function pib_werk_by(rekord) {
  if (typeof open_vorm_vir_wysig !== "function") {
    console.error("open_vorm_vir_wysig ontbreek — die vorm kan nie oopgemaak word nie");
    return;
  }

  const slug = rekord.produk_id;
  const produk = pib_produk(slug);
  if (!produk) {
    alert(pib_t("pib_geen_produk",
      "Hierdie boek staan nie in die katalogus nie. Maak die Katalogus-afdeling eers oop."));
    return;
  }

  const data = rekord.data || {};
  const verskille = PIB_FORMATE.map((f) => pib_verskil(f, data, produk));

  if (typeof paneel_kieslys_wys_afdeling === "function") {
    paneel_kieslys_wys_afdeling("katalogus");
  }
  open_vorm_vir_wysig(produk);

  // Die outeur se ry in die vorm. Kom hy nie in die keuselys voor nie, kan
  // sy rye nie herskryf word nie — dan sê die nota so en Dorrithé doen dit
  // met die hand.
  let outeur_id = rekord.outeur_id || "";
  const kieslyste = Array.from(document.querySelectorAll("#vorm-outeurs-lys .paneel-outeur-ry-kies"));
  const het_outeur = kieslyste.some((k) => String(k.value) === String(outeur_id));

  let waarskuwing = "";
  verskille.forEach((v) => {
    if (!v.soort) return;

    if (v.soort === "afgehaal") {
      // Die blokkie gaan af; die rye BLY staan as verwysingspunt.
      if (typeof pio_merk === "function") pio_merk("vorm-" + v.f.s + "-beskikbaar", false);
      return;
    }

    if (typeof pio_merk === "function") pio_merk("vorm-" + v.f.s + "-beskikbaar", true);
    if (!het_outeur) {
      waarskuwing = pib_t("pib_geen_outeur_ry",
        "Hierdie outeur is nie in die vorm se outeurslys nie. Die verdelingsrye is nie herskryf nie.");
      return;
    }
    if (!pib_skryf_formaat(v.f.s, v.blok, outeur_id)) {
      waarskuwing = pib_t("pib_geen_som",
        "Een van die formate se prys kon nie bereken word nie. Gaan die bedrae na.");
    }
  });

  const leen = (data.formate || {}).leen;
  if (leen && leen.aan && leen.dae) {
    const veld = document.getElementById("vorm-leen-tydperk");
    if (veld) veld.value = leen.dae;
  }

  if (typeof wys_verberg_formaat_velde === "function") wys_verberg_formaat_velde();

  pib_wys_nota(rekord.nommer, pib_nota_reels(verskille), waarskuwing);

  PIB_WAG = { nommer: rekord.nommer, slug };
}

// --- Die merk ná stoor ---

async function pib_merk_bygewerk(wag) {
  try {
    const resp = await fetch("/.netlify/functions/merk-opgestel", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, kry_outorisasie_kop()),
      body: JSON.stringify({ nommer: wag.nommer, slug: wag.slug }),
    });
    if (!resp.ok) throw new Error(await resp.text());

    const uit = await resp.json();

    // Blobs se list() loop agter. Werk die PLAASLIKE lys by in plaas van
    // weer te vra — anders lyk dit of niks gebeur het nie.
    if (typeof PG_INDIENINGS !== "undefined" && Array.isArray(PG_INDIENINGS)) {
      const ry = PG_INDIENINGS.find((r) => r.nommer === uit.nommer);
      if (ry) {
        ry.stand = uit.stand;
        ry.produk_id = uit.produk_id;
        ry.bywerking_wagtend = false;
      }
      if (typeof pg_teken_lys === "function") pg_teken_lys();
    }
  } catch (fout) {
    console.error("Kon nie die indiening as bygewerk merk nie:", fout);
    alert(pib_t("pib_merk_fout",
      "Die boek is bygewerk, maar die indiening kon nie as afgehandel gemerk word nie."));
  }
}

// --- Styl ---

function pib_stel_styl_op() {
  if (document.getElementById("pib-styl")) return;
  const styl = document.createElement("style");
  styl.id = "pib-styl";
  styl.textContent = `
    .pib-nota {
      background: #F2FAF7; border: 1px solid #2E8B6F; border-radius: 8px;
      padding: 11px 14px; margin: 12px 0 4px; font-size: 13.5px; color: #1C5C4A;
    }
    .pib-nota-kop { font-weight: 700; margin-bottom: 5px; }
    .pib-nota-lys { margin: 0; padding-left: 18px; }
    .pib-nota-lys li { margin: 2px 0; }
    .pib-nota-reel { margin: 0; }
    .pib-nota-waarsku {
      margin: 7px 0 0; padding-top: 7px; border-top: 1px solid #BFE0D5;
      color: #8A4030; font-weight: 600;
    }
  `;
  document.head.appendChild(styl);
}

// --- Inhaak ---

function pib_teken_knoppie() {
  const inhoud = document.getElementById("pg-een-inhoud");
  if (!inhoud) return;

  const rekord = pib_oop();
  if (!rekord) return;
  if (rekord.stand !== "op_rak" || !rekord.bywerking_wagtend) return;
  if (document.getElementById("pib-werk-by")) return;

  const blok = document.createElement("div");
  blok.className = "pg-aksies";

  const knoppie = document.createElement("button");
  knoppie.type = "button";
  knoppie.id = "pib-werk-by";
  knoppie.className = "kaart-aksie pg-keur";
  knoppie.textContent = pib_t("pib_werk_by", "Werk by");
  knoppie.addEventListener("click", () => {
    const oop = pib_oop();
    if (oop) pib_werk_by(oop);
  });

  blok.appendChild(knoppie);
  inhoud.appendChild(blok);
}

function pib_stel_haak_op() {
  const afdeling = document.getElementById("paneel-vorm-afdeling");
  if (!afdeling) return;

  // sluit_vorm() maak die afdeling toe by 'n GESLAAGDE stoor — en ook by
  // Kanselleer. Die kanselleer-knoppie vee die wagtende merk dus uit
  // voordat die waarnemer loop.
  const kanselleer = document.getElementById("paneel-vorm-kanselleer");
  if (kanselleer) {
    kanselleer.addEventListener("click", () => {
      PIB_WAG = null;
      pib_verwyder_nota();
    });
  }

  new MutationObserver(() => {
    if (afdeling.style.display === "none" && PIB_WAG) {
      const wag = PIB_WAG;
      PIB_WAG = null;
      pib_verwyder_nota();
      pib_merk_bygewerk(wag);
    }
  }).observe(afdeling, { attributes: true, attributeFilter: ["style"] });
}

document.addEventListener("DOMContentLoaded", () => {
  pib_stel_styl_op();
  pib_stel_haak_op();

  const inhoud = document.getElementById("pg-een-inhoud");
  if (inhoud) {
    new MutationObserver(() => pib_teken_knoppie()).observe(inhoud, {
      childList: true,
      subtree: true,
    });
  }
});
