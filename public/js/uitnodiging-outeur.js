// uitnodiging-outeur.js — die outeur se aansluitvorm in vier stappe.
//
// WAAROM 'N EIE LEER: uitnodiging.js hanteer vyf rolle met een enkelbladsy-
// vorm en werk. Slegs die OUTEUR teken 'n ooreenkoms, en dit maak sy pad
// wesenlik anders: hy lees en teken voordat hy sy ID en bank gee. Om albei
// in een lêer te dwing, sou die werkende pad vir vier ander rolle raak.
// uitnodiging.js roep uo_begin() aan en gee dan die beheer heeltemal oor.
//
// DIE VOLGORDE IS DIE ONTWERP:
//   1 naam en e-pos  →  2 ooreenkoms lees en teken  →  3 besonderhede en
//   dokumente  →  4 wagwoord
// Hy teken VOORDAT hy sy ID-nommer en bankbesonderhede gee. Andersom sou
// hy die gevoeligste inligting oorhandig voordat hy weet waarvoor.
//
// DIE OOREENKOMS IS ENGELS, in albei tale van die vorm. Daar is net EEN
// weergawe, sodat daar nooit twee tekste is wat van mekaar kan verskil
// nie. Die ondertekeningsblok bly saam met hom Engels; alles anders volg
// die taalkeuse.
//
// DIE HANDTEKENING is die getikte naam plus die bevestiging. Die naam moet
// klop met stap 1 — 'n handtekening wat van die party se naam verskil,
// teken niks. Die bediener dwing dit weer af; hierdie is die hulp, nie die
// slot nie.

const UO_OOREENKOMS_PAD = "/ooreenkoms-outeur-en.html";
const UO_STUK_GREPE = 3 * 1024 * 1024; // 3MB per stuk, soos die indienvorm
const UO_MAKS_LEER = 5 * 1024 * 1024;
const UO_SOORTE = ["bankbrief", "idafskrif"];

let uo_token = null;
let uo_stap = 1;
let uo_besig = false;

const uo_el = (id) => document.getElementById(id);
const uo_waarde = (id) => (uo_el(id) ? uo_el(id).value.trim() : "");

// ---------------------------------------------------------------- stappe

function uo_wys(n) {
  uo_stap = n;
  document.querySelectorAll("[data-uo-bladsy]").forEach((b) => {
    b.classList.toggle("uitn-bladsy--aktief", Number(b.dataset.uoBladsy) === n);
  });
  document.querySelectorAll(".uitn-stap").forEach((s) => {
    const eie = Number(s.dataset.stap);
    s.classList.toggle("uitn-stap--aktief", eie === n);
    s.classList.toggle("uitn-stap--klaar", eie < n);
  });
  uo_el("uo-stappe").style.display = n > 4 ? "none" : "flex";
  uo_fout("");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function uo_fout(teks) {
  const blok = uo_el("uo-foute");
  blok.textContent = teks;
  if (teks) window.scrollTo({ top: 0, behavior: "smooth" });
  return false;
}

// ------------------------------------------------------------ handtekening

function uo_werk_teken_knoppie_by() {
  const knoppie = uo_el("uo-teken-knoppie");
  const naam = uo_waarde("uo-naam");
  const klop = naam !== "" && uo_waarde("uo-handtekening").toLowerCase() === naam.toLowerCase();
  knoppie.disabled = !(klop && uo_el("uo-bevestig").checked);
}

// ------------------------------------------------------------------ lêers

function uo_wys_leer_naam(soort) {
  const invoer = uo_el(`uo-${soort}`);
  const merk = document.querySelector(`[data-uo-naam="${soort}"]`);
  const houer = invoer.closest("[data-uo-leer]");
  const leer = invoer.files[0];

  if (leer) {
    merk.textContent = `${leer.name} — ${(leer.size / 1048576).toFixed(1)}MB`;
    houer.classList.add("uitn-leer--gekies");
  } else {
    merk.textContent = t("uo_geen_leer");
    houer.classList.remove("uitn-leer--gekies");
  }
}

// Stuksgewys, want 'n Netlify Function se versoek is tot sowat 6MB beperk.
// Dieselfde patroon as die indienvorm se il_laai_op().
async function uo_laai_leer_op(soort) {
  const leer = uo_el(`uo-${soort}`).files[0];
  if (!leer) throw new Error(t("uo_e_leer_kort"));
  if (leer.size > UO_MAKS_LEER) throw new Error(t("uo_e_leer_groot"));

  const buffer = await leer.arrayBuffer();
  const grepe = new Uint8Array(buffer);
  const opload_id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const stukke = Math.max(1, Math.ceil(grepe.length / UO_STUK_GREPE));

  for (let i = 0; i < stukke; i++) {
    const sny = grepe.slice(i * UO_STUK_GREPE, (i + 1) * UO_STUK_GREPE);

    let binair = "";
    for (let j = 0; j < sny.length; j++) binair += String.fromCharCode(sny[j]);

    const resp = await fetch("/.netlify/functions/laai-uitnodiging-leer-op", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: uo_token,
        soort,
        opload_id,
        stuk_indeks: i,
        is_laaste: i === stukke - 1,
        data_base64: btoa(binair),
        inhoud_tipe: leer.type || "application/pdf",
        naam: leer.name,
      }),
    });

    if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);
  }
}

// -------------------------------------------------------------- validering

function uo_geldig(n) {
  if (n === 1) {
    if (!uo_waarde("uo-naam")) return uo_fout(t("uo_e_naam"));
    if (!uo_waarde("uo-epos").includes("@")) return uo_fout(t("uo_e_epos"));

    // Die ooreenkoms noem die party by die naam wat hy pas gegee het.
    uo_el("uo-epos-eggo").textContent = uo_waarde("uo-epos");
    const k_naam = uo_el("k1-naam");
    const k_epos = uo_el("k1-epos");
    if (k_naam) k_naam.textContent = uo_waarde("uo-naam");
    if (k_epos) k_epos.textContent = ` (${uo_waarde("uo-epos")})`;

    uo_el("uo-handtekening").placeholder = uo_waarde("uo-naam");
    uo_werk_teken_knoppie_by();
    return true;
  }

  if (n === 2) {
    if (uo_waarde("uo-handtekening").toLowerCase() !== uo_waarde("uo-naam").toLowerCase()) {
      return uo_fout(t("uo_e_teken"));
    }
    if (!uo_el("uo-bevestig").checked) return uo_fout(t("uo_e_merk"));
    return true;
  }

  if (n === 3) {
    const nodig = [
      ["uo-selfoon", "uo_f_selfoon"],
      ["uo-id-nommer", "uo_f_id"],
      ["uo-rekeninghouer", "uo_f_houer"],
      ["uo-bank", "uo_f_bank"],
      ["uo-rekening", "uo_f_rekening"],
      ["uo-takkode", "uo_f_takkode"],
      ["uo-rekeningtipe", "uo_f_tipe"],
    ];
    const kort = nodig.filter(([id]) => !uo_waarde(id)).map(([, sleutel]) => t(sleutel));
    if (kort.length) return uo_fout(t("uo_e_veld") + kort.join(", "));

    for (const soort of UO_SOORTE) {
      if (!uo_el(`uo-${soort}`).files.length) {
        return uo_fout(soort === "bankbrief" ? t("uo_e_bankbrief") : t("uo_e_idafskrif"));
      }
      if (uo_el(`uo-${soort}`).files[0].size > UO_MAKS_LEER) return uo_fout(t("uo_e_leer_groot"));
    }
    return true;
  }

  if (n === 4) {
    if (uo_waarde("uo-wagwoord").length < 6) return uo_fout(t("uo_e_ww_kort"));
    if (uo_waarde("uo-wagwoord") !== uo_waarde("uo-wagwoord2")) return uo_fout(t("uo_e_ww_verskil"));
    return true;
  }

  return true;
}

// ---------------------------------------------------------------- indiening

async function uo_dien_in() {
  if (uo_besig || !uo_geldig(4)) return;

  const knoppie = uo_el("uo-dien-in");
  uo_besig = true;
  knoppie.disabled = true;
  knoppie.textContent = t("uo_besig_laai");

  try {
    // Die lêers EERSTE. voltooi-uitnodiging.js weier sonder hulle, en 'n
    // mislukte oplaai ná die inskrywing sou 'n outeur agterlaat met 'n
    // rekord wat nie voldoen nie.
    for (const soort of UO_SOORTE) {
      await uo_laai_leer_op(soort);
    }

    knoppie.textContent = t("uo_besig_stuur");

    const resp = await fetch("/.netlify/functions/voltooi-uitnodiging", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: uo_token,
        naam: uo_waarde("uo-naam"),
        wagwoord: uo_waarde("uo-wagwoord"),
        ooreenkoms_aanvaar: true,
        handtekening: uo_waarde("uo-handtekening"),
        kontak_inligting: {
          epos: uo_waarde("uo-epos"),
          selfoon: uo_waarde("uo-selfoon"),
          adres: uo_waarde("uo-adres"),
          id_nommer: uo_waarde("uo-id-nommer"),
          bank_rekeninghouer: uo_waarde("uo-rekeninghouer"),
          bank_naam: uo_waarde("uo-bank"),
          bank_rekeningnommer: uo_waarde("uo-rekening"),
          bank_tak_kode: uo_waarde("uo-takkode"),
          bank_tipe: uo_waarde("uo-rekeningtipe"),
        },
      }),
    });

    if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);
    const resultaat = await resp.json();

    uo_el("uo-klaar-naam").textContent = uo_waarde("uo-naam").split(" ")[0];
    uo_el("uo-op-naam").textContent = uo_waarde("uo-handtekening");
    uo_el("uo-op-datum").textContent = new Date().toLocaleDateString(
      kry_huidige_taal() === "af" ? "af-ZA" : "en-ZA",
      { year: "numeric", month: "long", day: "numeric" }
    );

    // Reeds 'n rekening: nie 'n fout nie, en dit moet nie so lees nie.
    uo_el("uo-klaar-aanmeld").textContent = resultaat.rekening_bestaan_reeds
      ? t("uo_klaar_bestaan")
      : t("uo_klaar_1");

    uo_wys(5);
  } catch (fout) {
    console.error("Kon nie die registrasie voltooi nie:", fout);
    uo_fout(`${t("uo_e_stuur")} ${fout.message}`);
    knoppie.disabled = false;
    knoppie.textContent = t("uo_dien_in");
  } finally {
    uo_besig = false;
  }
}

// -------------------------------------------------------------------- taal

// DIE KNOPPIES DRA .uo-taal-knoppie EN NIE .taal-knoppie NIE. taal.js koppel
// by DOMContentLoaded self stel_taal() aan elke .taal-knoppie, en stel_taal()
// HERLAAI die bladsy. Op 'n vorm in vier stappe sou
// dit alles verloor wat reeds ingetik is. Hierdie bladsy wissel dus in
// plek: die keuse word gestoor sodat die res van die winkel dit ken, maar
// die bladsy word nie herlaai nie.
function uo_wissel_taal(taal) {
  try {
    localStorage.setItem("future_shop_taal", taal);
  } catch (fout) {
    console.error("Kon nie die taalkeuse stoor nie:", fout);
  }
  document.documentElement.lang = taal;
  pas_i18n_toe();
  document.querySelectorAll(".uo-taal-knoppie").forEach((k) =>
    k.classList.toggle("uo-taal-aktief", k.dataset.taal === taal)
  );
  UO_SOORTE.forEach(uo_wys_leer_naam);
}

// --------------------------------------------------------------------- begin

async function uo_begin(token, data) {
  uo_token = token;

  // Die ooreenkoms leef in sy eie lêer, nie in taal.js nie: dit is inhoud,
  // nie koppelvlakteks nie, en die weergawe op die rekord verwys daarna.
  try {
    const resp = await fetch(UO_OOREENKOMS_PAD);
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    uo_el("uo-ooreenkoms").innerHTML = await resp.text();
  } catch (fout) {
    console.error("Kon nie die ooreenkoms laai nie:", fout);
    wys_status(t("uo_e_ooreenkoms"), true);
    return;
  }

  uo_el("uo-teken-datum").textContent = new Date().toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // --- Koppel alles ---

  document.querySelectorAll("[data-uo-volgende]").forEach((k) =>
    k.addEventListener("click", () => {
      if (uo_geldig(uo_stap)) uo_wys(uo_stap + 1);
    })
  );
  document.querySelectorAll("[data-uo-terug]").forEach((k) =>
    k.addEventListener("click", () => uo_wys(uo_stap - 1))
  );

  uo_el("uo-handtekening").addEventListener("input", uo_werk_teken_knoppie_by);
  uo_el("uo-bevestig").addEventListener("change", uo_werk_teken_knoppie_by);
  uo_el("uo-dien-in").addEventListener("click", uo_dien_in);

  document.querySelectorAll("[data-uo-kies]").forEach((k) =>
    k.addEventListener("click", () => uo_el(`uo-${k.dataset.uoKies}`).click())
  );
  UO_SOORTE.forEach((soort) => {
    uo_el(`uo-${soort}`).addEventListener("change", () => uo_wys_leer_naam(soort));
    uo_wys_leer_naam(soort);
  });

  document.querySelectorAll(".uo-taal-knoppie").forEach((k) =>
    k.addEventListener("click", () => uo_wissel_taal(k.dataset.taal))
  );

  // Die rolnota verdwyn wanneer hy onder is. Dit is 'n sein, nie 'n slot —
  // 'n vorm wat weier omdat jy nie ver genoeg gerol het nie, mors tyd.
  const venster = uo_el("uo-ooreenkoms");
  venster.addEventListener("scroll", () => {
    const onder = venster.scrollTop + venster.clientHeight >= venster.scrollHeight - 8;
    uo_el("uo-rol-nota").style.visibility = onder ? "hidden" : "visible";
  });

  uo_werk_teken_knoppie_by();
  uo_wissel_taal(kry_huidige_taal());

  // Die hele oorspronklike blok gaan weg — sy kop, sy statusreël en sy
  // enkelbladsy-vorm. Die outeur sien net hierdie een.
  uo_el("uitn-hoof").style.display = "none";
  uo_el("uo-vorm").style.display = "block";
  uo_wys(1);
}
