// public/js/faktuur-vorm.js
//
// Die faktuurvorm. Slag een: die DOKUMENT — die kliënt, die reëls, die
// somme, die aantekening, die twee betaalpaaie, en die outostoor.
//
// Die backoffice (die begroting en die verdeling) kom in die volgende slag.
// Hulle word doelbewus apart gebou: die dokument bepaal die totaal, die
// backoffice verdeel dit, en 'n fout in die een moet nie soos 'n fout in die
// ander lyk nie.
//
// ─────────────────────────────────────────────────────────────────────────
// DIE TAAL LOOP LANGS TWEE PAAIE, EN HULLE MAG NIE MENG NIE
//
//   die BLADSY   — t() en data-i18n. Die platform se taal, uit localStorage.
//                  Dit is julle skerm.
//   die DOKUMENT — t_in(sleutel, V.taal). Die FAKTUUR se eie taalveld, wat
//                  op die rekord gestoor word.
//
// 'n Skool in die Wes-Kaap en 'n departement in Gauteng kry nie noodwendig
// dieselfde een nie, en die keuse mag nie 'n stelselinstelling wees wat by
// die volgende faktuur verkeerd staan nie. Gebruik 'n mens t() binne die
// dokument, druk elke faktuur in die taal wat toevallig in hierdie blaaier
// gekies is.
//
// ─────────────────────────────────────────────────────────────────────────
// ALLES IS SENT
//
// Rand met desimale tel nie betroubaar op nie. Die vorm hou sent, wys rand,
// en stuur sent. Die bediener reken die bedrae in elk geval self oor — 'n
// getal wat afgelei kan word, word nooit van hier af vertrou nie.

/* ═══ die toestand ═══ */
const V = {
  sleutel: null,          // null = nog nooit gestoor nie
  nommer: null,
  stand: "konsep",
  taal: "af",             // die DOKUMENT se taal
  klient_id: null,
  klient: { naam: "", kontakpersoon: "", epos: "", selfoon: "", adres: "" },
  bestelnommer: "",
  reels: [],              // { beskrywing, hoeveelheid, prys_pp_sent }
  dokument_nota: "",
  afslag_sent: 0,
  skenking_sent: 0,
  koepon_kode: null,
  // Die backoffice s'n. Hulle leef HIER, in een toestand, want die
  // faktuurtotaal en die verdeling is een som — nie twee skerms wat mekaar
  // se getalle raai nie.
  koste: [],              // { beskrywing, ontvanger, bedrag_sent, inskrywing }
  verdeling: [],          // { ontvanger, tipe: pct | vas, waarde }
  hosting_pct: 5,
  betaalbaar_teen: null,
  geskep_op: null,
  betaalskakel: null,
};

let SESSIE = null;
let KLIENTE = [];
let VUIL = false;         // daar is veranderinge wat nog nie gestoor is nie
let BESIG = false;
let TYD = null;

/* ═══ die twee vertaalpaaie ═══ */

// Die BLADSY se taal. Dieselfde patroon as faktuurpaneel.js: t() gee die
// sleutel terug wanneer hy hom nie ken nie, dus geld die verstek slegs
// wanneer taal.js glad nie gelaai het nie of die sleutel nog nie bygekom het
// nie.
function fv_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

// Die DOKUMENT se taal. t_in() neem die taal as argument.
function dt(sleutel, verstek) {
  const uit = window.t_in ? window.t_in(sleutel, V.taal) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

/* ═══ getalle en teks ═══ */
function rand(sent) {
  return "R " + (Number(sent || 0) / 100).toLocaleString("af-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Rand-teks na sent. Die gebruiker tik "1 250,50" of "1250.5"; albei moet
// werk. Math.round en nie parseInt nie: 12,505 sent bestaan nie.
function na_sent(teks) {
  const skoon = String(teks == null ? "" : teks)
    .replace(/\s/g, "")
    .replace(/[Rr]/g, "")
    .replace(",", ".");
  const getal = Number(skoon);
  return Number.isFinite(getal) && getal > 0 ? Math.round(getal * 100) : 0;
}

function sent_as_teks(sent) {
  return (Number(sent || 0) / 100).toFixed(2);
}

// Leeg by nul. Die plekhouer wys 0,00 in grys, sodat 'n mens weet wat die
// veld verwag sonder dat daar iets is om uit te vee.
function veld_sent(sent) {
  return Number(sent) ? (Number(sent) / 100).toFixed(2) : "";
}
function veld_getal(n) {
  return Number(n) ? String(n) : "";
}

function ontsnap(waarde) {
  return String(waarde == null ? "" : waarde)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Die datum word met fd_maande gebou, NIE met toLocaleDateString nie —
// daardie een gee die blaaier se taal, wat 'n derde bron sou wees naas die
// platform en die faktuur.
function dok_datum(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const maande = dt("fd_maande", "Jan,Feb,Mrt,Apr,Mei,Jun,Jul,Aug,Sep,Okt,Nov,Des").split(",");
  return `${d.getDate()} ${maande[d.getMonth()] || ""} ${d.getFullYear()}`;
}

// Vir 'n <input type="date">, wat altyd YYYY-MM-DD wil hê.
function invoer_datum(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/* ═══ die somme op die dokument ═══
   Reëls minus afslag, plus skenking. Die verdeling loop op die totaal en dit
   is die backoffice se werk; hier gaan dit net oor wat die kliënt sien. */
function reelsom() {
  return V.reels.reduce(
    (s, r) => s + Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0)),
    0
  );
}
function totaal() {
  return Math.max(0, reelsom() - V.afslag_sent) + V.skenking_sent;
}

/* ═══ teken ═══ */

function teken_klient() {
  const plek = document.getElementById("d-klient");
  if (!plek) return;
  const k = V.klient || {};
  if (!V.klient_id) {
    plek.innerHTML = `<span class="leeg">${fv_t("fv_geen_klient", "Nog geen kliënt gekies nie")}</span>`;
    return;
  }
  const reels = [`<strong>${ontsnap(k.naam)}</strong>`];
  if (k.kontakpersoon) reels.push(ontsnap(k.kontakpersoon));
  if (k.adres) reels.push(`<span class="adres">${ontsnap(k.adres)}</span>`);
  plek.innerHTML = reels.join("<br>");
}

function teken_reels() {
  const plek = document.getElementById("fv-reels");
  if (!plek) return;

  plek.innerHTML = V.reels
    .map((r, ix) => {
      const bedrag = Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0));
      return `
      <tr data-reel="${ix}">
        <td><input class="tel-invoer" data-veld="beskrywing" value="${ontsnap(r.beskrywing)}"></td>
        <td class="n"><input class="tel-invoer n" data-veld="hoeveelheid" inputmode="decimal" value="${ontsnap(r.hoeveelheid)}"></td>
        <td class="n"><input class="tel-invoer n" data-veld="prys" inputmode="decimal" value="${veld_sent(r.prys_pp_sent)}" placeholder="0,00"></td>
        <td class="n sterk">${rand(bedrag)}</td>
        <td class="n"><button type="button" class="dok-vee" title="${fv_t("fv_verwyder_reel", "Verwyder reël")}">&times;</button></td>
      </tr>`;
    })
    .join("");

  bind_reels();
}

// Terwyl iemand tik, mag die veld nie onder sy vinger herbou word nie — dan
// spring die wyser na die einde. Ons werk dus net die SYFERS by.
function bind_reels() {
  document.querySelectorAll("#fv-reels tr").forEach((tr) => {
    const ix = Number(tr.getAttribute("data-reel"));

    tr.querySelectorAll("[data-veld]").forEach((el) => {
      el.addEventListener("input", () => {
        const veld = el.getAttribute("data-veld");
        if (veld === "beskrywing") {
          V.reels[ix].beskrywing = el.value;
        } else if (veld === "hoeveelheid") {
          const getal = Number(String(el.value).replace(",", "."));
          V.reels[ix].hoeveelheid = Number.isFinite(getal) && getal >= 0 ? getal : 0;
        } else {
          V.reels[ix].prys_pp_sent = na_sent(el.value);
        }
        const r = V.reels[ix];
        const sel = tr.querySelector("td.sterk");
        if (sel) {
          sel.textContent = rand(
            Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0))
          );
        }
        teken_somme();
        if (window.bo_teken_syfers) window.bo_teken_syfers();
        merk_vuil();
      });
    });

    const vee = tr.querySelector(".dok-vee");
    if (vee) {
      vee.addEventListener("click", () => {
        V.reels.splice(ix, 1);
        teken_reels();
        teken_somme();
        merk_vuil();
      });
    }
  });
}

// Subtotaal, afslag en skenking verskyn slegs wanneer hulle bestaan — 'n ry
// wat "R 0,00" sê, is 'n ry wat vra hoekom sy daar is.
function teken_somme() {
  const plek = document.getElementById("fv-somme");
  if (!plek) return;
  const rye = [];
  if (V.afslag_sent > 0 || V.skenking_sent > 0) {
    rye.push(`<div><span>${dt("fd_subtotaal", "Subtotaal")}</span><b>${rand(reelsom())}</b></div>`);
  }
  if (V.afslag_sent > 0) {
    rye.push(`<div><span>${dt("fd_afslag", "Afslag")}</span><b>− ${rand(V.afslag_sent)}</b></div>`);
  }
  if (V.skenking_sent > 0) {
    rye.push(`<div><span>${dt("fd_skenking", "Skenking")}</span><b>${rand(V.skenking_sent)}</b></div>`);
  }
  rye.push(
    `<div class="tot"><span>${dt("fd_totaal_verskuldig", "Totaal verskuldig")}</span><b>${rand(totaal())}</b></div>`
  );
  plek.innerHTML = rye.join("");
}

// Alles binne die dokument wat 'n etiket is, kom hier deur. Dit loop met
// t_in() op die FAKTUUR se taal.
function teken_dok_taal() {
  const stel = (id, sleutel, verstek) => {
    const el = document.getElementById(id);
    if (el) el.textContent = dt(sleutel, verstek);
  };

  stel("d-soort", "fd_proforma", "Proforma-faktuur");
  stel("d-aan", "fd_gefaktureer_aan", "Gefaktureer aan");
  stel("d-besonderhede", "fd_besonderhede", "Besonderhede");
  stel("d-datum", "fd_datum", "Datum");
  stel("d-betaalbaar", "fd_betaalbaar_teen", "Betaalbaar teen");
  stel("d-bestelnr", "fd_bestelnommer", "Bestelnommer");
  stel("d-k-beskrywing", "fd_kol_beskrywing", "Beskrywing");
  stel("d-k-hoeveelheid", "fd_kol_hoeveelheid", "Hoeveelheid");
  stel("d-k-eenheid", "fd_kol_eenheidsprys", "Eenheidsprys");
  stel("d-k-bedrag", "fd_kol_bedrag", "Bedrag");
  stel("d-aantekening", "fd_aantekening", "Aantekening");
  stel("d-eft", "fd_eft_kop", "Onmiddellike EFT — deur die betaalskakel");
  stel("d-eft-lei", "fd_eft_lei", "Kaart, Instant EFT of QR. Die betaling word dadelik bevestig.");
  stel("d-bank", "fd_bank_kop", "Bankoorbetaling");

  const datum_w = document.getElementById("d-datum-w");
  if (datum_w) datum_w.textContent = dok_datum(V.geskep_op);

  // Die nommer bestaan eers by stuur. Tot dan staan daar "Konsep" — nie 'n
  // voorlopige nommer nie, want 'n nommer wat verander, is nie 'n nommer nie.
  const nr = document.getElementById("d-nommer");
  if (nr) nr.textContent = V.nommer || dt("fd_stand_konsep", "Konsep");

  // Die betaalknoppie dra die nommer; hy is dood tot die faktuur uitgereik is.
  const knop = document.getElementById("d-betaal");
  if (knop) {
    knop.textContent = dt("fd_betaal_knop", "Betaal") + (V.nommer ? " " + V.nommer : "");
    knop.classList.toggle("dood", !V.betaalskakel);
    if (V.betaalskakel) knop.setAttribute("href", V.betaalskakel);
    else knop.removeAttribute("href");
  }

  // DIE FAKTUURNOMMER IS DIE BANKVERWYSING. Sonder dit sit 'n mens met 'n
  // bedrag in 'n bankstaat en geen naam nie. Die bankblok dra <br> en 'n
  // <span>, dus innerHTML — die inhoud kom uit taal.js en uit die nommer,
  // nooit van 'n gebruiker nie.
  const bank = document.getElementById("d-bank-lei");
  if (bank) {
    const verw = V.nommer || dt("fd_stand_konsep", "Konsep");
    bank.innerHTML =
      "Future Sharp NPC<br>" +
      `${dt("fd_rekening", "Rekening")} —<br>` +
      `${dt("fd_takkode", "Takkode")} —<br>` +
      `${dt("fd_verwysing", "Verwysing")}: <span class="verw">${ontsnap(verw)}</span>`;
  }

  document.querySelectorAll("#d-taal button").forEach((b) => {
    b.classList.toggle("aan", b.getAttribute("data-taal") === V.taal);
  });
}

function teken_stand() {
  const el = document.getElementById("fv-stand");
  if (!el) return;
  const name = {
    konsep: fv_t("fv_stand_konsep", "Konsep"),
    gestuur: fv_t("fv_stand_gestuur", "Gestuur"),
    betaal: fv_t("fv_stand_betaal", "Betaal"),
    gekanselleer: fv_t("fv_stand_gekanselleer", "Gekanselleer"),
  };
  el.textContent = name[V.stand] || V.stand;
  el.className = "fv-stand fv-stand-" + V.stand;
}

function teken_alles() {
  teken_klient();
  teken_reels();
  teken_somme();
  teken_dok_taal();
  teken_stand();
  // faktuur-backoffice.js haak hier in. Die wag is nie versiering nie: die
  // dokument moet werk al is die backoffice nie gelaai nie.
  if (window.bo_teken) window.bo_teken();
}

/* ═══ die kliëntkeuse ═══ */
async function laai_kliente() {
  try {
    const resp = await fetch("/.netlify/functions/kry-kliente", {
      headers: { Authorization: `Bearer ${SESSIE.access_token}` },
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    KLIENTE = data.kliente || [];
  } catch (fout) {
    console.error("Kon nie die kliënte laai nie:", fout);
    KLIENTE = [];
  }

  const kies = document.getElementById("fv-klient");
  if (!kies) return;
  const opsies = [
    `<option value="">${fv_t("fv_kies_klient", "Kies 'n kliënt …")}</option>`,
  ].concat(
    KLIENTE.map(
      (k) =>
        `<option value="${ontsnap(k.nommer)}" ${k.nommer === V.klient_id ? "selected" : ""}>${ontsnap(
          k.naam
        )}${k.onvolledig ? " · " + fv_t("fk_onvolledig", "onvolledig") : ""}</option>`
    )
  );
  kies.innerHTML = opsies.join("");
}

/* ═══ stoor ═══
 *
 * Konsepte stoor outomaties sowat twee sekondes ná iemand ophou tik, en by
 * blur — plus 'n knoppie, want dit is die enigste manier waarop 'n mens WEET
 * dit is gestoor. Dieselfde patroon as indien.html.
 *
 * 'n Uitgereikte faktuur stoor NIE. Die bediener gee 409 en dit is reg, maar
 * ons vra nie eens: die dokument is by die kliënt en die verdeling is
 * gevries.
 */
function merk_vuil() {
  if (V.stand !== "konsep") return;
  VUIL = true;
  wys_stoorstand(fv_t("fv_nie_gestoor", "Nog nie gestoor nie"), false);
  if (TYD) clearTimeout(TYD);
  TYD = setTimeout(() => stoor(), 2000);
}

function wys_stoorstand(teks, is_fout) {
  const el = document.getElementById("fv-stoorstand");
  if (!el) return;
  el.textContent = teks;
  el.classList.toggle("fout", Boolean(is_fout));
}

function liggaam() {
  return {
    sleutel: V.sleutel || undefined,
    taal: V.taal,
    klient_id: V.klient_id || "",
    bestelnommer: V.bestelnommer,
    dokument_nota: V.dokument_nota,
    betaalbaar_teen: V.betaalbaar_teen || "",
    koste: V.koste,
    verdeling: V.verdeling,
    hosting_pct: V.hosting_pct,
    afslag_sent: V.afslag_sent,
    skenking_sent: V.skenking_sent,
    koepon_kode: V.koepon_kode || "",
    reels: V.reels.map((r) => ({
      soort: "verkoop",
      beskrywing: r.beskrywing,
      hoeveelheid: Number(r.hoeveelheid) || 0,
      prys_pp_sent: Number(r.prys_pp_sent) || 0,
    })),
  };
}

async function stoor() {
  if (V.stand !== "konsep" || BESIG || !SESSIE) return;
  if (TYD) { clearTimeout(TYD); TYD = null; }
  BESIG = true;

  try {
    const resp = await fetch("/.netlify/functions/stoor-faktuur", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SESSIE.access_token}`,
      },
      body: JSON.stringify(liggaam()),
    });

    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();

    // Die eerste stoor gee die sleutel terug. Dit kom in die adresbalk sonder
    // om die bladsy te herlaai — 'n herlaai sou die konsep verloor, en 'n
    // konsep waarvan die URL nie klop nie, is 'n konsep wat nie teruggevind
    // kan word nie.
    if (!V.sleutel && data.sleutel) {
      V.sleutel = data.sleutel;
      const url = new URL(window.location.href);
      url.searchParams.set("sleutel", data.sleutel);
      window.history.replaceState({}, "", url.toString());
    }

    VUIL = false;
    const nou = new Date();
    wys_stoorstand(
      fv_t("fv_gestoor", "Gestoor") +
        " " +
        String(nou.getHours()).padStart(2, "0") + ":" + String(nou.getMinutes()).padStart(2, "0"),
      false
    );
  } catch (fout) {
    console.error("Kon nie die faktuur stoor nie:", fout);
    // Eerlik wees hieroor. 'n Stil mislukking laat iemand aangaan met werk
    // wat nêrens beland nie.
    wys_stoorstand(fv_t("fv_stoor_fout", "Kon nie stoor nie — probeer weer"), true);
  } finally {
    BESIG = false;
  }
}

/* ═══ laai ═══ */
async function laai_faktuur(vraag) {
  const resp = await fetch("/.netlify/functions/kry-faktuur?" + vraag, {
    headers: { Authorization: `Bearer ${SESSIE.access_token}` },
  });
  if (!resp.ok) throw new Error(`Status ${resp.status}`);
  const data = await resp.json();
  const f = data.faktuur || {};

  V.sleutel = f.sleutel || null;
  V.nommer = f.nommer || null;
  V.stand = f.stand || "konsep";
  V.taal = f.taal || "af";
  V.klient_id = f.klient_id || null;
  V.klient = f.klient || V.klient;
  V.bestelnommer = f.bestelnommer || "";
  V.reels = Array.isArray(f.reels)
    ? f.reels.map((r) => ({
        beskrywing: r.beskrywing || "",
        hoeveelheid: r.hoeveelheid || 0,
        prys_pp_sent: r.prys_pp_sent || 0,
      }))
    : [];
  V.dokument_nota = f.dokument_nota || "";
  V.afslag_sent = f.afslag_sent || 0;
  V.skenking_sent = f.skenking_sent || 0;
  V.koepon_kode = f.koepon_kode || null;
  V.koste = Array.isArray(f.koste) ? f.koste : [];
  V.verdeling = Array.isArray(f.verdeling) ? f.verdeling : [];
  // hosting_pct kan wettig 0 wees, dus nie || 5 nie — dan sou iemand wat
  // Hosting doelbewus afskakel, dit elke keer terugkry.
  V.hosting_pct = Number.isFinite(Number(f.hosting_pct)) ? Number(f.hosting_pct) : 5;
  V.betaalbaar_teen = f.betaalbaar_teen || null;
  V.geskep_op = f.geskep_op || null;
  V.betaalskakel = f.betaalskakel || null;
}

// 'n Uitgereikte of betaalde faktuur word gelees, nie gewysig nie. Elke veld
// gaan toe — die dokument is by die kliënt en die verdeling is gevries.
function sluit_toe() {
  document.querySelectorAll("#fv-dok input, #fv-dok textarea, #fv-dok select").forEach((el) => {
    el.setAttribute("disabled", "disabled");
  });
  ["fv-voeg-reel", "fv-stoor"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  const kies = document.getElementById("fv-klient-kies");
  if (kies) kies.style.display = "none";
  wys_stoorstand(fv_t("fv_toe", "Uitgereik — word nie meer gewysig nie"), false);
}

function geen_toegang(teks) {
  const blok = document.getElementById("fv-geen-toegang");
  const vorm = document.getElementById("fv-vorm");
  const el = document.getElementById("fv-geen-toegang-teks");
  if (teks && el) el.textContent = teks;
  if (blok) blok.style.display = "";
  if (vorm) vorm.style.display = "none";
}

/* ═══ begin ═══ */
document.addEventListener("DOMContentLoaded", async () => {
  const hoof = document.getElementById("fv-hoof");
  const wys = () => { if (hoof) hoof.style.visibility = "visible"; };

  try {
    SESSIE = await identiteit_kry_huidige_sessie();
  } catch {
    SESSIE = null;
  }

  if (!SESSIE) { geen_toegang(null); wys(); return; }

  const epos = document.getElementById("paneel-gebruiker-epos");
  if (epos && SESSIE.gebruiker) epos.textContent = SESSIE.gebruiker.email;

  // Die kliëntkant-kontrole is 'n hoflikheid, nie 'n slot. Dra die token nie
  // die rol nie, gee elke Function in elk geval 403.
  if (!identiteit_het_rol(SESSIE.gebruiker, "boekhouding")) {
    geen_toegang(
      fv_t("fp_geen_rol", "Hierdie rekening het nie toegang tot Boekhouding nie. Is die rol pas bygesit, meld een keer af en weer aan.")
    );
    wys();
    return;
  }

  const vorm = document.getElementById("fv-vorm");
  if (vorm) vorm.style.display = "";
  wys();

  const params = new URLSearchParams(window.location.search);
  const sleutel = params.get("sleutel");
  const nommer = params.get("nommer");

  try {
    if (sleutel) await laai_faktuur("sleutel=" + encodeURIComponent(sleutel));
    else if (nommer) await laai_faktuur("nommer=" + encodeURIComponent(nommer));
    else {
      // 'n Nuwe konsep. Hy word NIE dadelik gestoor nie — 'n konsep wat by
      // oopmaak bestaan, laat leë rekords agter van elke keer wat iemand die
      // bladsy oopgemaak en van gedagte verander het. Die eerste stoor
      // gebeur wanneer daar iets is om te stoor.
      V.geskep_op = new Date().toISOString();
      V.reels = [{ beskrywing: "", hoeveelheid: 1, prys_pp_sent: 0 }];
    }
  } catch (fout) {
    console.error("Kon nie die faktuur laai nie:", fout);
    geen_toegang(fv_t("fv_laai_fout", "Kon nie hierdie faktuur laai nie."));
    return;
  }

  // Die velde buite die tabel word een keer gevul; hulle word nooit herbou
  // nie, dus kan die wyser nie spring nie.
  const nota = document.getElementById("fv-nota");
  if (nota) {
    nota.value = V.dokument_nota;
    nota.addEventListener("input", () => { V.dokument_nota = nota.value; merk_vuil(); });
  }

  const bestelnr = document.getElementById("fv-bestelnommer");
  if (bestelnr) {
    bestelnr.value = V.bestelnommer;
    bestelnr.addEventListener("input", () => { V.bestelnommer = bestelnr.value; merk_vuil(); });
  }

  const betaalbaar = document.getElementById("fv-betaalbaar");
  if (betaalbaar) {
    betaalbaar.value = invoer_datum(V.betaalbaar_teen);
    betaalbaar.addEventListener("change", () => {
      V.betaalbaar_teen = betaalbaar.value || null;
      merk_vuil();
    });
  }

  const voeg = document.getElementById("fv-voeg-reel");
  if (voeg) {
    voeg.addEventListener("click", () => {
      V.reels.push({ beskrywing: "", hoeveelheid: 1, prys_pp_sent: 0 });
      teken_reels();
      teken_somme();
      merk_vuil();
    });
  }

  const knop = document.getElementById("fv-stoor");
  if (knop) knop.addEventListener("click", () => stoor());

  document.getElementById("d-taal").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const nuwe = b.getAttribute("data-taal");
    if (!nuwe || nuwe === V.taal) return;
    V.taal = nuwe;
    teken_alles();
    merk_vuil();
  });

  await laai_kliente();
  const kies = document.getElementById("fv-klient");
  if (kies) {
    kies.addEventListener("change", () => {
      V.klient_id = kies.value || null;
      const gekose = KLIENTE.find((k) => k.nommer === V.klient_id);
      // Die register se veld heet `kontak`; op die faktuur heet dit
      // `kontakpersoon`. Hierdie afskrif is net vir die skerm — die bediener
      // lees die kliënt self uit die register wanneer hy stoor.
      V.klient = gekose
        ? {
            naam: gekose.naam || "",
            kontakpersoon: gekose.kontak || "",
            epos: gekose.epos || "",
            selfoon: gekose.selfoon || "",
            adres: gekose.adres || "",
          }
        : { naam: "", kontakpersoon: "", epos: "", selfoon: "", adres: "" };
      teken_klient();
      merk_vuil();
    });
  }

  teken_alles();

  if (V.stand !== "konsep") sluit_toe();

  // By blur stoor ons dadelik in plaas van te wag — iemand wat wegklik, is
  // dikwels iemand wat weggaan.
  window.addEventListener("blur", () => { if (VUIL) stoor(); });
});
