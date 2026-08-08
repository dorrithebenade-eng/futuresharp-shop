// public/js/paneel-indiening-oordrag.js
//
// Die Stel op-knoppie: 'n goedgekeurde indiening wat die produkvorm oopmaak
// met alles wat die vorm uit die indiening kan weet, reeds ingevul.
//
// DIT PUBLISEER NIE. Die vorm word oopgemaak en gevul; die boek gaan op die
// rak wanneer Dorrithé stoor, met skep-produk.js se volle validering. Dit is
// dieselfde reël as keur-goed.js s'n — 'n knoppie wat stilweg 'n produk
// skep, omseil die validering, en dan is dit 'n outeur wat die fout sien.
//
// EIE LÊER: paneelbord.js, paneel-goedkeuring.js en verdeling-rekenaar.js
// bly onaangeraak. Die knoppie word by die oop indiening ingehaak met 'n
// waarnemer, en die verdelingsrye word deur die vorm se EIE
// voeg_verdeling_ry_by() gebou — 'n ry met ingespuite HTML lyk reg en stoor
// niks.
//
// DIE PRYS KOM UIT vs_bereken(), NOOIT UIT DIE INVOERVELD NIE. Die outeur se
// vorm neem 'n prys OF 'n verlangde wins; lees 'n mens die veld as 'n prys,
// sit daar 'n te lae prys in die vorm. Dieselfde slaggat as by die
// Verdeling-rekenaar.
//
// AFRONDING: op na die naaste R5, met Math.ceil. Afwaarts kan die prys onder
// Paystack se minimum druk. Die afronding vergroot die boekdeel terwyl die
// outeur se koste vas bly, dus word sy persentasie ná die afronding bereken,
// nie voor nie.
//
// WAT NIE OORKOM NIE: kategorieë (die outeur tik vrye teks, die vorm het
// merkblokkies), die etiket, die vrystellingsdatum, en die voorraadstatus —
// die indienvorm se "voorraad word gehou / elke bestelling word gedruk" is
// nie dieselfde vraag as die katalogus se "beskikbaar / uitverkoop" nie.
//
// GEEN LEË RYE NIE. Slegs die outeur se rye word geskryf. Ontwerp/Admin
// weet die indiening niks van nie, en 'n ry wat op nul staan, is 'n ry wat
// later gemis word.
//
// HOSTING IS DIE UITSONDERING: dit word altyd gemerk, op 5% van die
// BOEKPRYS. Dit is Future Sharp se eie aandeel en geld op elke boek, dus is
// die verstek 'n gemerkte blokkie wat afgesit kan word, nie 'n leë een wat
// onthou moet word. Die 5% geld op die boekdeel en word na 'n persentasie
// van die VOLLE prys omgereken, want die katalogus ken net die volle prys —
// die outeur se versending mag nie Hosting betaal nie.
//
// 'n GEMERKTE BLOKKIE SONDER 'N WAARDE STOOR AS NIKS.
// kry_hosting_vanuit_vorm() gee null terug by 'n leë of nul-veld, en dan lyk
// die skerm of Hosting aan is terwyl daar niks gestoor word nie. Die merkie
// en die getal gaan dus altyd saam.

const PIO_OUTEUR_PCT = 70;
const PIO_HOSTING_PCT = 5;
const PIO_AANNAMES = { paystackPct: 2.9, paystackVaste: 1, btwPct: 15 };
const PIO_ROND = 5;

const PIO_FORMATE = ["eboek", "hardekopie", "leen"];

// Wat wag om as opgestel gemerk te word: { nommer, slug }. Leef net in die
// geheue — 'n herlaai laat die merk eenvoudig weg, en dan staan die
// indiening nog by "wag om opgestel te word" waar dit sigbaar is.
let PIO_WAG = null;

function pio_t(sleutel, terugval) {
  return window.t ? window.t(sleutel) : terugval;
}

// PG_OOP is 'n gewone skrip-veranderlike in paneel-goedkeuring.js en dus
// hier bereikbaar. Die try vang die geval waar daardie lêer nie gelaai het
// nie.
function pio_oop() {
  try {
    return typeof PG_OOP !== "undefined" ? PG_OOP : null;
  } catch {
    return null;
  }
}

// Dieselfde vorm as keur-goed.js se veilige_sleutel_gedeelte, sodat die
// slug en die lêersleutels van dieselfde titel af kom.
function pio_slug(teks) {
  return String(teks || "boek")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "boek";
}

function pio_som(blok) {
  if (!blok || !blok.aan) return null;
  if (typeof vs_bereken !== "function") return null;

  const u = vs_bereken({
    modus: blok.modus || "prys",
    begin: Number(blok.invoer) || 0,
    koste: Number(blok.koste) || 0,
    outeurPct: PIO_OUTEUR_PCT,
    hostingPct: PIO_HOSTING_PCT,
    rond: PIO_ROND,
    paystackPct: PIO_AANNAMES.paystackPct,
    paystackVaste: PIO_AANNAMES.paystackVaste,
    btwPct: PIO_AANNAMES.btwPct,
  });

  return u && !u.leeg ? u : null;
}

// --- Die vorm vul ---

function pio_veld(id, waarde) {
  const el = document.getElementById(id);
  if (el) el.value = waarde;
}

// 'n Merkblokkie wat verander, moet sy change-gebeurtenis stuur — die vorm
// wys en verberg sy afdelings daarop.
function pio_merk(id, aan) {
  const el = document.getElementById(id);
  if (!el || el.checked === aan) return;
  el.checked = aan;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function pio_vul_formaat(s, blok, outeur_id) {
  const aan = Boolean(blok && blok.aan);
  pio_merk("vorm-" + s + "-beskikbaar", aan);
  if (!aan) return;

  const u = pio_som(blok);
  if (!u) return;

  pio_veld("vorm-" + s + "-prys", u.P.toFixed(2));

  const lys = document.getElementById("vorm-" + s + "-verdelings-lys");
  if (lys) lys.innerHTML = "";
  pio_merk("vorm-" + s + "-verdeling-aan", true);

  if (typeof voeg_verdeling_ry_by !== "function") return;

  // Die outeur kry twee dinge: sy druk- en afleweringskoste terug as 'n
  // vaste bedrag, en sy persentasie op die boekprys. Die vorm hou 'n vaste
  // bedrag in SENT en wys dit in rand — gee 'n mens rand deur, verskyn R80
  // as R0,80.
  if (u.K > 0) {
    voeg_verdeling_ry_by(s, {
      rol_tipe: "outeur",
      entiteit_id: outeur_id,
      tipe: "vaste_bedrag",
      waarde: Math.round(u.K * 100),
    });
  }

  // 'n Persentasie op die boekdeel word 'n kleiner persentasie van die volle
  // prys. Die katalogus ken net die volle prys.
  const pct = u.P > 0 ? (u.outeurPersRand / u.P) * 100 : 0;
  voeg_verdeling_ry_by(s, {
    rol_tipe: "outeur",
    entiteit_id: outeur_id,
    tipe: "persentasie",
    waarde: Number(pct.toFixed(2)),
  });

  // Hosting: altyd gemerk, met sy getal. hostingRand kom uit dieselfde som
  // en geld op die boekdeel; hier word dit 'n persentasie van die volle
  // prys, want dit is wat die vorm stoor.
  const hosting_pct = u.P > 0 ? (u.hostingRand / u.P) * 100 : 0;
  pio_merk("vorm-" + s + "-hosting-aan", true);
  pio_veld("vorm-" + s + "-hosting-tipe", "persentasie");
  pio_veld("vorm-" + s + "-hosting-waarde", Number(hosting_pct.toFixed(2)));
}

function pio_wys_nota(reels) {
  pio_verwyder_nota();

  const anker = document.getElementById("paneel-vorm-titel");
  if (!anker) return;

  const nota = document.createElement("div");
  nota.id = "pio-nota";
  nota.className = "pio-nota";
  nota.textContent = reels.filter(Boolean).join(" ");
  anker.parentNode.insertBefore(nota, anker.nextSibling);
}

function pio_verwyder_nota() {
  const oud = document.getElementById("pio-nota");
  if (oud) oud.remove();
}

function pio_stel_op(rekord) {
  if (typeof open_vorm_vir_toevoeging !== "function") {
    console.error("open_vorm_vir_toevoeging ontbreek — die vorm kan nie oopgemaak word nie");
    return;
  }

  const data = rekord.data || {};

  if (typeof paneel_kieslys_wys_afdeling === "function") {
    paneel_kieslys_wys_afdeling("katalogus");
  }
  open_vorm_vir_toevoeging();

  const slug = pio_slug(data.titel);
  pio_veld("vorm-slug", slug);
  pio_veld("vorm-titel", data.titel || "");
  pio_veld("vorm-oorsig", data.kort_beskrywing || "");
  pio_veld("vorm-vol-beskrywing", data.volledige_beskrywing || "");
  pio_veld("vorm-isbn-eboek", data.isbn_eboek || "");
  pio_veld("vorm-isbn-hardekopie", data.isbn_hardekopie || "");
  pio_veld("vorm-omslag", rekord.omslag || "");
  pio_veld("vorm-eboek-sleutel", rekord.eboek_sleutel || "");

  if (typeof wys_omslag_voorskou === "function") {
    wys_omslag_voorskou(rekord.omslag || "");
  }

  // open_vorm_vir_toevoeging() sit een leë outeursry neer. Is die outeur nie
  // in die keuselys nie, bly die veld leeg en die nota sê so — die vorm sal
  // in elk geval nie sonder 'n outeur stoor nie.
  let outeur_id = rekord.outeur_id || "";
  const kies = document.querySelector("#vorm-outeurs-lys .paneel-outeur-ry-kies");
  if (kies) {
    kies.value = outeur_id;
    if (kies.value !== outeur_id) outeur_id = "";
  }

  const formate = data.formate || {};
  PIO_FORMATE.forEach((s) => pio_vul_formaat(s, formate[s], outeur_id));

  if (formate.leen && formate.leen.aan && formate.leen.dae) {
    pio_veld("vorm-leen-tydperk", formate.leen.dae);
  }

  if (typeof wys_verberg_formaat_velde === "function") wys_verberg_formaat_velde();

  pio_wys_nota([
    rekord.nommer + " \u2014 " + pio_t("pio_nota",
      "ingevul uit die indiening. Die prys is op na die naaste R5 gerond. " +
      "Kategorieë, die etiket en die vrystellingsdatum bly leeg."),
    data.kategorie
      ? pio_t("pio_kategorie", "Die outeur het aangedui:") + " " + data.kategorie + "."
      : "",
    outeur_id
      ? ""
      : pio_t("pio_geen_outeur",
          "Hierdie outeur het nog geen inskrywing in die Outeurs-oortjie nie."),
  ]);

  PIO_WAG = { nommer: rekord.nommer, slug };
}

// --- Die merk ná stoor ---

async function pio_merk_opgestel(wag) {
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
      }
      if (typeof pg_teken_lys === "function") pg_teken_lys();
    }
  } catch (fout) {
    console.error("Kon nie die indiening as opgestel merk nie:", fout);
    alert(pio_t("pio_merk_fout",
      "Die boek is geskep, maar die indiening kon nie as opgestel gemerk word nie."));
  }
}

// --- Styl ---

function pio_stel_styl_op() {
  if (document.getElementById("pio-styl")) return;
  const styl = document.createElement("style");
  styl.id = "pio-styl";
  styl.textContent = `
    .pio-nota {
      background: #E9F5F3; border: 1px solid #9FD3CB; border-radius: 8px;
      padding: 11px 14px; margin: 12px 0 4px; font-size: 13.5px; color: #17685E;
    }
  `;
  document.head.appendChild(styl);
}

// --- Inhaak ---

function pio_teken_knoppie() {
  const inhoud = document.getElementById("pg-een-inhoud");
  if (!inhoud) return;

  const rekord = pio_oop();
  if (!rekord || rekord.stand !== "goedgekeur") return;
  if (document.getElementById("pio-stel-op")) return;

  const blok = document.createElement("div");
  blok.className = "pg-aksies";

  const knoppie = document.createElement("button");
  knoppie.type = "button";
  knoppie.id = "pio-stel-op";
  knoppie.className = "kaart-aksie pg-keur";
  knoppie.textContent = pio_t("pio_stel_op", "Stel op");
  knoppie.addEventListener("click", () => {
    const oop = pio_oop();
    if (oop) pio_stel_op(oop);
  });

  blok.appendChild(knoppie);
  inhoud.appendChild(blok);
}

function pio_stel_haak_op() {
  const afdeling = document.getElementById("paneel-vorm-afdeling");
  if (!afdeling) return;

  // sluit_vorm() maak die afdeling toe by 'n GESLAAGDE stoor — en ook by
  // Kanselleer. Die kanselleer-knoppie vee die wagtende merk dus uit
  // voordat die waarnemer loop.
  const kanselleer = document.getElementById("paneel-vorm-kanselleer");
  if (kanselleer) {
    kanselleer.addEventListener("click", () => {
      PIO_WAG = null;
      pio_verwyder_nota();
    });
  }

  // Die slug word by indiening gelees, nie by toemaak nie: sluit_vorm() stel
  // die afdeling toe EN herstel die vorm, so teen die tyd dat die waarnemer
  // loop, is die veld reeds leeg.
  const vorm = document.getElementById("paneel-produk-vorm");
  if (vorm) {
    vorm.addEventListener("submit", () => {
      if (!PIO_WAG) return;
      const veld = document.getElementById("vorm-slug");
      if (veld && veld.value.trim()) PIO_WAG.slug = veld.value.trim();
    });
  }

  new MutationObserver(() => {
    if (!PIO_WAG) return;
    if (afdeling.style.display !== "none") return;
    const wag = PIO_WAG;
    PIO_WAG = null;
    pio_verwyder_nota();
    pio_merk_opgestel(wag);
  }).observe(afdeling, { attributes: true, attributeFilter: ["style"] });
}

function pio_begin() {
  pio_stel_styl_op();
  pio_stel_haak_op();

  const inhoud = document.getElementById("pg-een-inhoud");
  if (inhoud) {
    new MutationObserver(pio_teken_knoppie).observe(inhoud, { childList: true });
    pio_teken_knoppie();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", pio_begin);
} else {
  pio_begin();
}
