// public/js/speelslim-instelling.js
//
// Die sub-blaaie onder Kwotasies (Alle kwotasies, Speel-Slim) en die
// Speel-Slim-prystabel.
//
// DIE PRYSE GELD VIR NUWE AANVRAE. speelslim-aanvraag.js lees die instelling
// by elke aanvraag uit FSF; 'n kwotasie wat reeds uitgereik is, hou sy eie
// bedrae.
//
// DIE VOORSKOU REKEN SOOS DIE BEDIENER. Die persentasie per persoon is
// dieselfde formule as los_ontvangers_op() in _speelslim.js, met die buffer
// van 0,1% teen afronding. Ná Stoor wys die skerm wat die bediener teruggee.
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

function ss_teken_voorskou() {
  const pryse = document.getElementById("ss-pryse");
  const verdeling = document.getElementById("ss-verdeling");
  const fyn = document.getElementById("ss-verdeling-fyn");
  if (!pryse || !verdeling || !SS_DATA) return;

  const hoof = ss_sent_uit(document.getElementById("ss-hoof").value);
  const ekstra = ss_sent_uit(document.getElementById("ss-ekstra").value);
  const hosting = ss_getal_uit(document.getElementById("ss-hosting").value);

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

  const hp = hosting == null ? 0 : hosting;
  const ry = (etiket, pct) => `<tr><td>${ss_ontsnap(etiket)}</td><td class="ss-bedrag">${ss_pct(pct)}</td></tr>`;

  if (SS_DATA.vaste_verdeling) {
    // 'n Vaste verdeling in die store: wys hom soos hy is.
    verdeling.innerHTML =
      ry("Future Sharp (hosting)", hp) +
      SS_DATA.verdeling.map((v) => ry(v.ontvanger, v.waarde)).join("");
    fyn.textContent = "";
    return;
  }

  const name = SS_DATA.ontvangers || [];
  if (!name.length) {
    verdeling.innerHTML = ry("Future Sharp", 100);
    fyn.innerHTML = `<span class="ss-waarsku">${ss_ontsnap(
      ss_t("ss_geen_ontvangers", "Dorrithé en Ignatius is nie in die begunstigde-register gevind nie. Alles gaan na die hoofrekening.")
    )}</span>`;
    return;
  }

  const elk = ss_elk(hp, name.length);
  const buffer = Math.round((100 - hp - elk * name.length) * 100) / 100;
  verdeling.innerHTML =
    ry("Future Sharp (hosting)", hp) +
    name.map((n) => ry(n, elk)).join("") +
    `<tr><td class="ss-fyn">${ss_ontsnap(ss_t("ss_buffer", "Buffer teen afronding (bly in die hoofrekening)"))}</td><td class="ss-bedrag ss-fyn">${ss_pct(buffer)}</td></tr>`;
  fyn.textContent = "";
}

function ss_vul(data) {
  SS_DATA = data;
  document.getElementById("ss-hoof").value = ss_rand_vir_veld(data.hoof_sent);
  document.getElementById("ss-ekstra").value = ss_rand_vir_veld(data.ekstra_sent);
  document.getElementById("ss-hosting").value =
    ss_taal() === "en" ? String(data.hosting_pct) : String(data.hosting_pct).replace(".", ",");

  const stand = document.getElementById("ss-stand");
  if (stand) {
    stand.classList.remove("fout");
    stand.textContent = data.bygewerk_op
      ? `${ss_t("ss_laaste", "Laas gestoor")} ${String(data.bygewerk_op).slice(0, 10).replace(/-/g, "/")}`
      : ss_t("ss_verstek", "Die verstekpryse geld nog.");
  }
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
    stand.textContent = ss_t("ss_ongeldig", "Vul al drie velde met 'n getal in.");
    return;
  }

  knop.disabled = true;
  stand.classList.remove("fout");
  stand.textContent = ss_t("fp_laai", "Word gelaai …");
  try {
    const resp = await fetch("/.netlify/functions/stoor-speelslim-instelling", {
      method: "POST",
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify({ hoof_sent: hoof, ekstra_sent: ekstra, hosting_pct: hosting }),
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
});
