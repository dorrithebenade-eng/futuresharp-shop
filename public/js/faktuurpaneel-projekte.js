// public/js/faktuurpaneel-projekte.js
// Weergawe 4 (17 Oktober 2026): projeknommer, finansiering (fooie, toelae of
// borgskap), instansie en tydperk. Die PBA en wie baat vind, wys net by 'n
// toelae of skenking. Die ou vrye-teks soort word net nog gewys as dit daar is.
// Weergawe 3 (25 September 2026): ook die openbare-voordeel-aktiwiteit (PBA)
// met sy Deel II-merk, en wie baat vind. Sien stoor-projek.js.
//
// Die register van projekte, op Boekhouding se Registers-blad.
//
// WAT 'N PROJEK DRA (fase B, 25 September 2026)
//
//   soort      vrye teks, met voorstelle uit die bestaande projekte: julle bou
//              die lys self op deur 'n nuwe soort in te tik
//   vir wie    die skool of instansie waarvoor die projek is, uit die
//              kliënteregister. Nie "begunstigde" nie: die Begunstigdes-register
//              is reeds wie Paystack-uitbetalings kry.
//   toekennings  die befondsing, elk met sy kontrolelys. Hulle word in 'n eie
//              venster bestuur; sien faktuurpaneel-toekennings.js.
//
// Die ou befondsers-veld (kliëntnommers) word nie meer op die vorm gewys nie.
// 'n Projek wat dit reeds dra, hou dit, en die lys noem dit.
//
// Voorvoegsel `PJ` / `pj_`.

const PJ = {
  projekte: [],
  kliente: [],        // { nommer, naam, soort }
  sessie: null,
  wysig: null,
};

function pj_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function pj_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pj_rand(sent) {
  const n = Math.round(Math.abs(Number(sent) || 0));
  const heel = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return "R" + heel + "," + String(n % 100).padStart(2, "0");
}

async function pj_vra(naam, opsies) {
  const resp = await fetch("/.netlify/functions/" + naam, {
    ...(opsies || {}),
    headers: { ...((opsies && opsies.headers) || {}), ...(await identiteit_kop()) },
  });
  if (!resp.ok) {
    const teks = await resp.text().catch(() => "");
    throw new Error(teks || String(resp.status));
  }
  return resp.json();
}

/* ═══ die lys ═══ */

const PJ_FIN = {
  fooie: ["pj_fin_fooie", "Fooie vir dienste"],
  toelae: ["pj_fin_toelae", "Toelae of skenking"],
  borgskap: ["pj_fin_borgskap", "Borgskap"],
};
const PJ_INST = {
  skole: ["pj_inst_skole", "Skole"],
  ouers: ["pj_inst_ouers", "Ouers en individue"],
  hoer: ["pj_inst_hoer", "Ho\u00ebr onderwys"],
  korporatief: ["pj_inst_korporatief", "Korporatief"],
};
function pj_fin_naam(f) { const x = PJ_FIN[f || "fooie"] || PJ_FIN.fooie; return pj_t(x[0], x[1]); }
function pj_inst_naam(i) { const x = PJ_INST[i]; return x ? pj_t(x[0], x[1]) : ""; }
function pj_datum(d) { return d ? String(d).replace(/-/g, "/") : ""; }

function pj_pas(p, soek) {
  if (!soek) return true;
  return [p.nr, p.naam, p.nota, p.soort, p.vir_wie_naam, pj_fin_naam(p.finansiering), pj_inst_naam(p.instansie)]
    .filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, "").includes(soek);
}

function pj_teken_lys() {
  const plek = document.getElementById("pj-lys");
  if (!plek) return;

  const soekveld = document.getElementById("pj-soek");
  const soek = (soekveld ? soekveld.value || "" : "").trim().toLowerCase().replace(/\s+/g, "");
  const pas = PJ.projekte.filter((p) => pj_pas(p, soek));

  const hulp = document.getElementById("pj-hulp");
  if (hulp) {
    hulp.textContent = soek
      ? pas.length + " " + pj_t("pj_van", "van") + " " + PJ.projekte.length
      : PJ.projekte.length + " " +
        (PJ.projekte.length === 1 ? pj_t("pj_een", "projek") : pj_t("pj_meer", "projekte"));
  }

  if (!PJ.projekte.length) {
    plek.innerHTML = `<p class="stelsel-boodskap">${pj_t(
      "pj_leeg", "Die register is nog leeg. Voeg die eerste projek by.")}</p>`;
    return;
  }
  if (!pas.length) {
    plek.innerHTML = `<p class="stelsel-boodskap">${pj_t(
      "pj_geen_treffer", "Geen projek pas by die soektog nie.")}</p>`;
    return;
  }

  pj_teken_nommer_ban();

  plek.innerHTML = pas.map((p) => {
    const fin = p.finansiering || "fooie";
    const merkies = [
      p.aktief === false ? `<span class="fk-merkie kt-onaktief">${pj_t("pj_onaktief", "Onaktief")}</span>` : "",
      p.toets ? `<span class="fk-merkie">${pj_t("pj_toets", "Toets")}</span>` : "",
    ].join("");
    const tydperk = p.van || p.tot
      ? `${pj_datum(p.van) || "\u2026"} ${pj_t("pj_tot_kort", "tot")} ${pj_datum(p.tot) || "\u2026"}` : "";
    const eerste = [
      `<span class="pj-fin-merk pj-fin-${pj_ontsnap(fin)}">${pj_ontsnap(pj_fin_naam(fin))}</span>`,
      p.instansie ? pj_ontsnap(pj_inst_naam(p.instansie)) : "",
      p.vir_wie ? `${pj_ontsnap(pj_t("pj_vir", "vir"))} ${pj_ontsnap(p.vir_wie_naam || p.vir_wie)}` : "",
      tydperk ? pj_ontsnap(tydperk) : "",
    ].filter(Boolean).join(" \u00b7 ");
    const ou_soort = p.soort
      ? `<span class="fk-ry-onder pj-oud">${pj_ontsnap(pj_t("pj_ou_soort", "Ou soort:"))} ${pj_ontsnap(p.soort)}</span>` : "";
    const baat = fin !== "toelae" ? "" : [
      p.pba ? pj_ontsnap(p.pba) + (p.pba_deel2 ? " (" + pj_ontsnap(pj_t("pj_deel2_kort", "Deel II")) + ")" : "") : "",
      p.baat_getal != null ? pj_ontsnap(pj_t("pj_baat_tel", "{n} deelnemers").replace("{n}", p.baat_getal)) +
        (p.baat_swart_pct != null ? pj_ontsnap(pj_t("pj_baat_pct", ", {p}% swart").replace("{p}", String(p.baat_swart_pct).replace(".", ","))) : "") : "",
    ].filter(Boolean).join(" \u00b7 ");
    const met_tk = fin !== "fooie" || p.toekennings;
    const tk = !met_tk ? "" : p.toekennings
      ? pj_t("pj_tk_tel", "{n} toekenning(s), {r} toegesê").replace("{n}", p.toekennings).replace("{r}", pj_rand(p.toegese_sent))
      : pj_t("pj_tk_geen", "Nog geen toekenning nie");
    const oud = (p.befondsers || []).length
      ? `<span class="fk-ry-onder pj-oud">${pj_ontsnap(pj_t("pj_oud_bf", "Ou befondsersveld:"))} ${
          (p.befondsers || []).map((b) => pj_ontsnap(b.naam || b.nommer)).join(", ")}</span>` : "";

    const rand = (p.aktief === false
      ? `<button type="button" class="fp-skrap kt-aktiveer" data-pj-aktiveer="${pj_ontsnap(p.id)}">${pj_t("pj_aktiveer", "Aktiveer")}</button>`
      : `<button type="button" class="pj-tk-knop pj-fin-knop" data-pj-fin="${pj_ontsnap(p.id)}">${pj_t("pj_fin_knop", "Finansies")}</button>
         ${met_tk ? `<button type="button" class="pj-tk-knop" data-pj-tk="${pj_ontsnap(p.id)}">${pj_t("pj_tk_knop", "Toekennings")}</button>` : ""}
         <button type="button" class="fp-skrap" data-pj-skrap="${pj_ontsnap(p.id)}">${pj_t("pj_skrap", "Skrap")}</button>`);

    return `
      <div class="fk-ry fk-ry-twee${p.aktief === false ? " kt-ry-onaktief" : ""}">
        <button type="button" class="fk-ry-oop" data-pj="${pj_ontsnap(p.id)}">
          <span class="fk-ry-naam">${p.nr ? `<span class="pj-nr-lys">${pj_ontsnap(p.nr)}</span>` : ""}${pj_ontsnap(p.naam)}${merkies}</span>
          ${eerste ? `<span class="fk-ry-onder">${eerste}</span>` : ""}
          ${baat ? `<span class="fk-ry-onder">${baat}</span>` : ""}
          ${tk ? `<span class="fk-ry-onder">${pj_ontsnap(tk)}</span>` : ""}
          ${ou_soort}
          ${oud}
        </button>
        <span class="fk-ry-rand">${rand}</span>
      </div>`;
  }).join("");

  plek.querySelectorAll("[data-pj]").forEach((b) =>
    b.addEventListener("click", () => pj_maak_vorm_oop(b.getAttribute("data-pj"))));
  plek.querySelectorAll("[data-pj-skrap]").forEach((b) =>
    b.addEventListener("click", () => pj_skrap(b.getAttribute("data-pj-skrap"))));
  plek.querySelectorAll("[data-pj-aktiveer]").forEach((b) =>
    b.addEventListener("click", () => pj_aktiveer(b.getAttribute("data-pj-aktiveer"))));
  plek.querySelectorAll("[data-pj-fin]").forEach((b) =>
    b.addEventListener("click", () => {
      const p = PJ.projekte.find((x) => x.id === b.getAttribute("data-pj-fin"));
      if (p && typeof window.pk_maak_oop === "function") window.pk_maak_oop(p);
    }));
  plek.querySelectorAll("[data-pj-tk]").forEach((b) =>
    b.addEventListener("click", () => {
      const p = PJ.projekte.find((x) => x.id === b.getAttribute("data-pj-tk"));
      if (p && typeof window.tk_maak_oop === "function") window.tk_maak_oop(p);
    }));
}

/* ═══ projekte sonder 'n nommer ═══ */

function pj_teken_nommer_ban() {
  const ban = document.getElementById("pj-nommer-ban");
  if (!ban) return;
  const sonder = PJ.projekte.filter((p) => !p.nr).length;
  if (!sonder) { ban.style.display = "none"; ban.innerHTML = ""; return; }
  ban.style.display = "";
  ban.innerHTML = `<span>${pj_ontsnap((sonder === 1
      ? pj_t("pj_sonder_nr_een", "1 projek het nog nie 'n nommer nie.")
      : pj_t("pj_sonder_nr", "{n} projekte het nog nie 'n nommer nie.")).replace("{n}", sonder))}</span>
    <button type="button" class="kaart-aksie" id="pj-gee-nr">${pj_ontsnap(pj_t("pj_gee_nr", "Gee nommers"))}</button>`;
  document.getElementById("pj-gee-nr").addEventListener("click", pj_gee_nommers);
}

async function pj_gee_nommers() {
  const knop = document.getElementById("pj-gee-nr");
  if (knop) knop.disabled = true;
  try {
    await pj_vra("nommer-projekte", { method: "POST" });
    await pj_laai();
  } catch (fout) {
    window.alert(String(fout.message || fout));
    if (knop) knop.disabled = false;
  }
}

/* ═══ die vorm ═══ */

function pj_kies_fin() {
  const k = document.querySelector('input[name="pj-fin"]:checked');
  return k ? k.value : "fooie";
}

function pj_wys_toelae_deel() {
  const deel = document.getElementById("pj-toelae-deel");
  if (deel) deel.style.display = pj_kies_fin() === "toelae" ? "" : "none";
}

function pj_vul_keuses(p) {
  const pbas = [...new Set(PJ.projekte.map((x) => x.pba).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "af-ZA"));
  document.getElementById("pj-pbas").innerHTML =
    pbas.map((s) => `<option value="${pj_ontsnap(s)}"></option>`).join("");

  // Vir wie: die kliënte; 'n kliënt wat intussen weg is, bly sigbaar gekies.
  const kies = document.getElementById("pj-vir-wie");
  const huidig = p ? p.vir_wie || "" : "";
  const opsies = PJ.kliente.map((k) =>
    `<option value="${pj_ontsnap(k.nommer)}"${k.nommer === huidig ? " selected" : ""}>${
      pj_ontsnap(k.nommer)} \u00b7 ${pj_ontsnap(k.naam)}</option>`);
  if (huidig && !PJ.kliente.some((k) => k.nommer === huidig)) {
    opsies.unshift(`<option value="${pj_ontsnap(huidig)}" selected>${pj_ontsnap(huidig)} (${pj_t("pj_weg", "bestaan nie meer")})</option>`);
  }
  kies.innerHTML = `<option value="">${pj_t("pj_vir_wie_geen", "Nie vir een instansie nie")}</option>` + opsies.join("");
}

function pj_maak_vorm_oop(id) {
  const p = id ? PJ.projekte.find((x) => x.id === id) : null;
  PJ.wysig = p ? p.id : null;

  document.getElementById("pj-vorm-titel").textContent = p
    ? pj_t("pj_wysig_titel", "Wysig projek")
    : pj_t("pj_nuwe_titel", "Nuwe projek");
  document.getElementById("pj-naam").value = p ? p.naam : "";
  document.getElementById("pj-nr").textContent = p && p.nr
    ? p.nr
    : pj_t("pj_nr_nuut", "Kry 'n nommer wanneer dit gestoor word");
  document.getElementById("pj-nr").classList.toggle("pj-nr-leeg", !(p && p.nr));
  const fin = (p && p.finansiering) || "fooie";
  document.querySelectorAll('input[name="pj-fin"]').forEach((r) => { r.checked = r.value === fin; });
  pj_wys_toelae_deel();
  document.getElementById("pj-instansie").value = p ? p.instansie || "" : "";
  const ou = document.getElementById("pj-ou-soort");
  if (p && p.soort) {
    ou.textContent = pj_t("pj_ou_soort_hulp", "Voorheen as soort aangeteken: {s}").replace("{s}", p.soort);
    ou.style.display = "";
  } else {
    ou.style.display = "none";
  }
  document.getElementById("pj-van").value = p ? p.van || "" : "";
  document.getElementById("pj-tot").value = p ? p.tot || "" : "";
  document.getElementById("pj-pba").value = p ? p.pba || "" : "";
  document.getElementById("pj-pba-deel2").checked = Boolean(p && p.pba_deel2);
  document.getElementById("pj-baat-beskrywing").value = p ? p.baat_beskrywing || "" : "";
  document.getElementById("pj-baat-getal").value = p && p.baat_getal != null ? p.baat_getal : "";
  document.getElementById("pj-baat-pct").value = p && p.baat_swart_pct != null ? String(p.baat_swart_pct).replace(".", ",") : "";
  document.getElementById("pj-nota").value = p ? p.nota || "" : "";
  pj_vul_keuses(p);

  document.getElementById("pj-vorm-fout").style.display = "none";
  document.getElementById("pj-vorm").classList.add("oop");
  document.getElementById("pj-naam").focus();
}

function pj_maak_vorm_toe() {
  document.getElementById("pj-vorm").classList.remove("oop");
  PJ.wysig = null;
}

function pj_wys_fout(boodskap) {
  const el = document.getElementById("pj-vorm-fout");
  el.textContent = boodskap;
  el.style.display = "";
}

async function pj_stoor() {
  const naam = document.getElementById("pj-naam").value.trim();
  if (!naam) {
    pj_wys_fout(pj_t("pj_naam_kort", "Die naam is verpligtend."));
    return;
  }
  const knop = document.getElementById("pj-stoor");
  knop.disabled = true;
  try {
    await pj_vra("stoor-projek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: PJ.wysig || undefined,
        naam,
        finansiering: pj_kies_fin(),
        instansie: document.getElementById("pj-instansie").value,
        van: document.getElementById("pj-van").value,
        tot: document.getElementById("pj-tot").value,
        vir_wie: document.getElementById("pj-vir-wie").value,
        pba: document.getElementById("pj-pba").value.trim(),
        pba_deel2: document.getElementById("pj-pba-deel2").checked,
        baat_beskrywing: document.getElementById("pj-baat-beskrywing").value.trim(),
        baat_getal: document.getElementById("pj-baat-getal").value.trim(),
        baat_swart_pct: document.getElementById("pj-baat-pct").value.trim().replace(",", "."),
        nota: document.getElementById("pj-nota").value.trim(),
      }),
    });
    pj_maak_vorm_toe();
    await pj_laai();
  } catch (fout) {
    pj_wys_fout(String(fout.message || fout));
  } finally {
    knop.disabled = false;
  }
}

async function pj_skrap(id) {
  const p = PJ.projekte.find((x) => x.id === id);
  if (!p) return;
  if (!window.confirm(
    pj_t("pj_skrap_vra",
      "Vee hierdie projek uit? Word dit reeds deur inskrywings gebruik, " +
      "word dit gedeaktiveer in plaas van uitgevee.") + "\n\n" + p.naam)) return;
  try {
    const uitslag = await pj_vra("skrap-projek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await pj_laai();
    if (uitslag && uitslag.gedeaktiveer) {
      window.alert(pj_t("pj_gedeaktiveer",
        "Hierdie projek word deur {n} inskrywings gebruik en is gedeaktiveer. " +
        "Bestaande inskrywings bly onveranderd; die projek verskyn nie meer in keuselyste nie.")
        .replace("{n}", Number(uitslag.verwysings) || 0));
    }
  } catch (fout) {
    window.alert(String(fout.message || fout));
  }
}

async function pj_aktiveer(id) {
  try {
    await pj_vra("aktiveer-projek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await pj_laai();
  } catch (fout) {
    window.alert(String(fout.message || fout));
  }
}

/* ═══ laai ═══ */

async function pj_laai_kliente() {
  try {
    const data = await pj_vra("kry-kliente");
    PJ.kliente = (Array.isArray(data.kliente) ? data.kliente : [])
      .map((k) => ({ nommer: k.nommer, naam: k.naam || "", soort: k.soort || "instansie" }))
      .sort((a, b) => a.naam.localeCompare(b.naam, "af-ZA"));
  } catch (fout) {
    console.error("Kon nie die kliënte laai nie:", fout);
    PJ.kliente = [];
  }
}

async function pj_laai() {
  const plek = document.getElementById("pj-lys");
  try {
    const data = await pj_vra("kry-projekte");
    PJ.projekte = Array.isArray(data.projekte) ? data.projekte : [];
    pj_teken_lys();
    document.dispatchEvent(new CustomEvent("pj-gelaai", { detail: PJ.projekte }));
  } catch (fout) {
    console.error("Kon nie die projekte laai nie:", fout);
    if (plek) {
      plek.innerHTML = `<p class="stelsel-boodskap">${pj_t("pj_laai_fout", "Kon nie die projekte laai nie.")}</p>`;
    }
  }
}
window.pj_herlaai = pj_laai;

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("pj-lys")) return;

  try {
    PJ.sessie = await identiteit_kry_huidige_sessie();
  } catch {
    PJ.sessie = null;
  }
  if (!PJ.sessie || !identiteit_het_rol(PJ.sessie.gebruiker, "boekhouding")) return;

  document.getElementById("pj-nuut").addEventListener("click", () => pj_maak_vorm_oop(null));
  const soekveld = document.getElementById("pj-soek");
  if (soekveld) soekveld.addEventListener("input", pj_teken_lys);
  document.getElementById("pj-stoor").addEventListener("click", pj_stoor);
  document.getElementById("pj-kanselleer").addEventListener("click", pj_maak_vorm_toe);
  document.querySelectorAll('input[name="pj-fin"]').forEach((r) =>
    r.addEventListener("change", pj_wys_toelae_deel));

  const oorlegsel = document.getElementById("pj-vorm");
  oorlegsel.addEventListener("click", (ev) => { if (ev.target === oorlegsel) pj_maak_vorm_toe(); });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && oorlegsel.classList.contains("oop")) pj_maak_vorm_toe();
  });

  await Promise.all([pj_laai_kliente(), pj_laai()]);
});
