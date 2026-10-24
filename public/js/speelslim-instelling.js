// public/js/speelslim-instelling.js
//
// Die sub-blaaie onder Kwotasies (Alle kwotasies, Speel-Slim) en die
// Speel-Slim-prystabel.
//
// DIE PRYSE GELD VIR NUWE AANVRAE. speelslim-aanvraag.js lees die instelling
// by elke aanvraag uit FSF; 'n kwotasie wat reeds uitgereik is, hou sy eie
// bedrae.
//
// DIE VOORSKOU REKEN SOOS DIE BEDIENER. By 'n gelyke verdeling is die
// persentasie per persoon dieselfde formule as los_ontvangers_op() in
// _speelslim.js, met die buffer van 0,1% teen afronding. 'n Eie verdeling is
// 'n vaste lys ontvangers uit die begunstigde-register. Ná Stoor wys die
// skerm wat die bediener teruggee.
//
// DIE SKERM IS NIE DIE POORT NIE. Albei Functions dwing die boekhouding-rol af.

let SS_DATA = null;
let SS_GELAAI = false;

function ss_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function ss_taal() {
  return window.kry_huidige_taal ? kry_huidige_taal() : "af";
}

function ss_rand(sent) {
  return window.t_rand ? t_rand(sent, ss_taal()) : "R" + (Number(sent || 0) / 100).toFixed(2);
}

function ss_pct(n) {
  const teks = String(Math.round(Number(n) * 100) / 100);
  return (ss_taal() === "en" ? teks : teks.replace(".", ",")) + "%";
}

function ss_ontsnap(waarde) {
  return String(waarde == null ? "" : waarde)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// "350", "350,00", "R350", "1 000,50" word sente. Leeg of onleesbaar is null.
function ss_sent_uit(teks) {
  const skoon = String(teks || "").replace(/[R\s ]/gi, "").replace(",", ".");
  if (!skoon) return null;
  const n = Number(skoon);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function ss_getal_uit(teks) {
  const skoon = String(teks || "").replace(/[%\s ]/g, "").replace(",", ".");
  if (!skoon) return null;
  const n = Number(skoon);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function ss_rand_vir_veld(sent) {
  const teks = (Number(sent || 0) / 100).toFixed(2);
  return ss_taal() === "en" ? teks : teks.replace(".", ",");
}

// Dieselfde as los_ontvangers_op() in _speelslim.js.
function ss_elk(hosting, n) {
  if (!n) return 0;
  return Math.floor(((100 - hosting) / n - 0.05) * 100) / 100;
}

// DIE RYE OP DIE SKERM. By "gelyk" word hulle uit die name en die hosting
// gereken en is hulle net om te lees; anders is elke ry 'n keuselys en 'n
// persentasie.
let SS_RYE = [];
let SS_GELYK = true;

function ss_hosting_nou() {
  const h = ss_getal_uit(document.getElementById("ss-hosting").value);
  return h == null ? 0 : h;
}

function ss_gelyke_rye() {
  const name = (SS_DATA && SS_DATA.ontvangers) || [];
  const elk = ss_elk(ss_hosting_nou(), name.length);
  return name.map((ontvanger) => ({ ontvanger, waarde: elk }));
}

function ss_huidige_rye() {
  return SS_GELYK ? ss_gelyke_rye() : SS_RYE;
}

function ss_pct_vir_veld(n) {
  if (n === "" || n == null) return "";
  const teks = String(n);
  return ss_taal() === "en" ? teks : teks.replace(".", ",");
}

function ss_teken_rye() {
  const plek = document.getElementById("ss-rye");
  const by = document.getElementById("ss-ry-by");
  const merk = document.getElementById("ss-gelyk");
  if (!plek || !SS_DATA) return;
  merk.checked = SS_GELYK;
  by.hidden = SS_GELYK;

  const name = SS_DATA.begunstigdes || [];
  const rye = ss_huidige_rye();
  plek.innerHTML = rye
    .map((ry, ix) => {
      const opsies = [`<option value="">${ss_ontsnap(ss_t("ss_kies", "Kies 'n ontvanger"))}</option>`]
        .concat(
          [...new Set(name.concat(ry.ontvanger ? [ry.ontvanger] : []))].map(
            (n) => `<option value="${ss_ontsnap(n)}"${n === ry.ontvanger ? " selected" : ""}>${ss_ontsnap(n)}</option>`
          )
        )
        .join("");
      const af = SS_GELYK ? " disabled" : "";
      return `<div class="ss-ry">
        <select class="veld-invoer" data-ss-naam="${ix}"${af}>${opsies}</select>
        <input class="veld-invoer" data-ss-pct="${ix}" inputmode="decimal" value="${ss_ontsnap(ss_pct_vir_veld(ry.waarde))}"${af}>
        <button type="button" class="ss-ry-weg" data-ss-weg="${ix}" title="${ss_ontsnap(ss_t("fp_skrap", "Skrap"))}"${af}>×</button>
      </div>`;
    })
    .join("");

  if (SS_GELYK) return;
  plek.querySelectorAll("[data-ss-naam]").forEach((el) =>
    el.addEventListener("change", () => {
      SS_RYE[Number(el.dataset.ssNaam)].ontvanger = el.value;
      ss_teken_voorskou();
    }));
  plek.querySelectorAll("[data-ss-pct]").forEach((el) =>
    el.addEventListener("input", () => {
      const n = ss_getal_uit(el.value);
      SS_RYE[Number(el.dataset.ssPct)].waarde = n == null ? "" : n;
      ss_teken_voorskou();
    }));
  plek.querySelectorAll("[data-ss-weg]").forEach((el) =>
    el.addEventListener("click", () => {
      SS_RYE.splice(Number(el.dataset.ssWeg), 1);
      ss_teken_rye();
      ss_teken_voorskou();
    }));
}

function ss_teken_voorskou() {
  const pryse = document.getElementById("ss-pryse");
  const verdeling = document.getElementById("ss-verdeling");
  const fyn = document.getElementById("ss-verdeling-fyn");
  if (!pryse || !verdeling || !SS_DATA) return;

  const hoof = ss_sent_uit(document.getElementById("ss-hoof").value);
  const ekstra = ss_sent_uit(document.getElementById("ss-ekstra").value);

  const h = hoof == null ? 0 : hoof;
  const e = ekstra == null ? 0 : ekstra;
  const vraelyste = ss_t("ss_vraelyste", "vraelyste");
  pryse.innerHTML = [
    [ss_t("ss_vb_een", "Gewone verslag (1 vraelys)"), h],
    [`${ss_t("ss_vb_gesamentlik", "Gesamentlik")}, 2 ${vraelyste}`, h + e],
    [`${ss_t("ss_vb_gesamentlik", "Gesamentlik")}, 3 ${vraelyste}`, h + 2 * e],
    [`${ss_t("ss_vb_gesamentlik", "Gesamentlik")}, 4 ${vraelyste}`, h + 3 * e],
  ]
    .map(([etiket, sent]) => `<tr><td>${ss_ontsnap(etiket)}</td><td class="ss-bedrag">${ss_rand(sent)}</td></tr>`)
    .join("");

  // Na die gelyke verdeling se rye: herreken hulle met die nuwe hosting.
  if (SS_GELYK) ss_teken_rye();

  const hp = ss_hosting_nou();
  const ry = (etiket, pct) => `<tr><td>${ss_ontsnap(etiket)}</td><td class="ss-bedrag">${ss_pct(pct)}</td></tr>`;
  const rye = ss_huidige_rye().filter((r) => r.ontvanger);

  if (!rye.length) {
    verdeling.innerHTML = ry("Future Sharp", 100);
    fyn.innerHTML = `<span class="ss-waarsku">${ss_ontsnap(
      SS_GELYK
        ? ss_t("ss_geen_ontvangers", "Dorrithé en Ignatius is nie in die begunstigde-register gevind nie. Alles gaan na die hoofrekening.")
        : ss_t("ss_geen_rye", "Geen ontvangers nie. Alles gaan na die hoofrekening.")
    )}</span>`;
    return;
  }

  const som = rye.reduce((s, r) => s + (Number(r.waarde) || 0), 0);
  const res = Math.round((100 - hp - som) * 100) / 100;
  verdeling.innerHTML =
    ry("Future Sharp (hosting)", hp) +
    rye.map((r) => ry(r.ontvanger, Number(r.waarde) || 0)).join("") +
    `<tr><td class="ss-fyn">${ss_ontsnap(ss_t("ss_buffer", "Bly in die hoofrekening"))}</td><td class="ss-bedrag ss-fyn">${ss_pct(res)}</td></tr>`;

  fyn.innerHTML =
    res < 0.1
      ? `<span class="ss-waarsku">${ss_ontsnap(
          ss_t("ss_te_veel", "Hosting en die ontvangers saam is meer as 99,9%. Verlaag een van die persentasies.")
        )}</span>`
      : "";
}

function ss_vul(data) {
  SS_DATA = data;
  SS_GELYK = !data.vaste_verdeling;
  SS_RYE = (data.verdeling || []).map((v) => ({ ontvanger: v.ontvanger, waarde: v.waarde }));
  document.getElementById("ss-hoof").value = ss_rand_vir_veld(data.hoof_sent);
  document.getElementById("ss-ekstra").value = ss_rand_vir_veld(data.ekstra_sent);
  document.getElementById("ss-hosting").value = ss_pct_vir_veld(data.hosting_pct);

  const stand = document.getElementById("ss-stand");
  if (stand) {
    stand.classList.remove("fout");
    stand.textContent = data.bygewerk_op
      ? `${ss_t("ss_laaste", "Laas gestoor")} ${String(data.bygewerk_op).slice(0, 10).replace(/-/g, "/")}`
      : ss_t("ss_verstek", "Die verstekpryse geld nog.");
  }
  ss_teken_rye();
  ss_teken_voorskou();
}

async function ss_laai() {
  if (SS_GELAAI) return;
  SS_GELAAI = true;
  const stand = document.getElementById("ss-stand");
  try {
    const resp = await fetch("/.netlify/functions/kry-speelslim-instelling", {
      headers: await identiteit_kop(),
    });
    if (!resp.ok) throw new Error(await resp.text());
    ss_vul(await resp.json());
  } catch (fout) {
    console.error("Kon nie die Speel-Slim-instelling laai nie:", fout);
    SS_GELAAI = false;
    if (stand) {
      stand.classList.add("fout");
      stand.textContent = ss_t("ss_laai_fout", "Kon nie die pryse laai nie. Probeer weer.");
    }
  }
}

async function ss_stoor() {
  const stand = document.getElementById("ss-stand");
  const knop = document.getElementById("ss-stoor");
  const hoof = ss_sent_uit(document.getElementById("ss-hoof").value);
  const ekstra = ss_sent_uit(document.getElementById("ss-ekstra").value);
  const hosting = ss_getal_uit(document.getElementById("ss-hosting").value);

  if (hoof == null || ekstra == null || hosting == null) {
    stand.classList.add("fout");
    stand.textContent = ss_t("ss_ongeldig", "Vul die pryse en die hosting met 'n getal in.");
    return;
  }

  // Gelyk: 'n leë lys, sodat die bediener by elke aanvraag self reken.
  let verdeling = [];
  if (!SS_GELYK) {
    if (SS_RYE.some((r) => !r.ontvanger || r.waarde === "" || !(Number(r.waarde) > 0))) {
      stand.classList.add("fout");
      stand.textContent = ss_t("ss_ry_onvolledig", "Kies 'n ontvanger en 'n persentasie vir elke ry.");
      return;
    }
    if (!SS_RYE.length) {
      stand.classList.add("fout");
      stand.textContent = ss_t("ss_geen_rye", "Geen ontvangers nie. Alles gaan na die hoofrekening.");
      return;
    }
    verdeling = SS_RYE.map((r) => ({ ontvanger: r.ontvanger, waarde: Number(r.waarde) }));
  }

  knop.disabled = true;
  stand.classList.remove("fout");
  stand.textContent = ss_t("fp_laai", "Word gelaai …");
  try {
    const resp = await fetch("/.netlify/functions/stoor-speelslim-instelling", {
      method: "POST",
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify({ hoof_sent: hoof, ekstra_sent: ekstra, hosting_pct: hosting, verdeling }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    ss_vul(await resp.json());
    stand.textContent = ss_t("ss_gestoor", "Gestoor. Geld vir elke nuwe aanvraag.");
  } catch (fout) {
    console.error("Kon nie die Speel-Slim-instelling stoor nie:", fout);
    stand.classList.add("fout");
    stand.textContent = String(fout.message || "").trim() || ss_t("ss_stoor_fout", "Kon nie stoor nie.");
  } finally {
    knop.disabled = false;
  }
}

function kw_sub_wys(naam) {
  document.querySelectorAll("#kw-sub .fr-sub-knop").forEach((knop) =>
    knop.classList.toggle("aan", knop.getAttribute("data-kw") === naam));
  document.querySelectorAll(".kw-deel").forEach((blok) =>
    blok.classList.toggle("wys", blok.getAttribute("data-kw") === naam));
  if (naam === "speelslim") ss_laai();
}

document.addEventListener("DOMContentLoaded", () => {
  const sub = document.getElementById("kw-sub");
  if (!sub) return;
  sub.querySelectorAll(".fr-sub-knop").forEach((knop) =>
    knop.addEventListener("click", () => kw_sub_wys(knop.getAttribute("data-kw"))));

  ["ss-hoof", "ss-ekstra", "ss-hosting"].forEach((id) => {
    const veld = document.getElementById(id);
    if (veld) veld.addEventListener("input", ss_teken_voorskou);
  });
  const stoor = document.getElementById("ss-stoor");
  if (stoor) stoor.addEventListener("click", ss_stoor);

  // Van gelyk na 'n eie verdeling: begin by die gelyke syfers, sodat 'n mens
  // net verander wat anders moet wees.
  const merk = document.getElementById("ss-gelyk");
  if (merk) {
    merk.addEventListener("change", () => {
      if (!merk.checked && SS_GELYK) SS_RYE = ss_gelyke_rye();
      SS_GELYK = merk.checked;
      ss_teken_rye();
      ss_teken_voorskou();
    });
  }
  const by = document.getElementById("ss-ry-by");
  if (by) {
    by.addEventListener("click", () => {
      SS_RYE.push({ ontvanger: "", waarde: "" });
      ss_teken_rye();
      ss_teken_voorskou();
    });
  }
});
