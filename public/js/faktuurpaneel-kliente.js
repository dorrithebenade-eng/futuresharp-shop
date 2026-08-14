// public/js/faktuurpaneel-kliente.js
//
// Die kliënteregister op Boekhouding se Registers-blad.
//
// 'N NUWE LÊER, NIE 'N WYSIGING NIE. faktuurpaneel.js hanteer die sessie en
// die pille; hierdie een vul die Registers-afdeling. Dieselfde patroon as
// paneel-registers.js in die paneelbord.
//
// DIE NUWE REKORD WORD PLAASLIK BYGEVOEG ná die stoor, nie weer gevra nie.
// Blobs se list() loop sowat vier sekondes agter, en 'n pas geskepte kliënt
// sou lyk of hy nie gestoor is nie.

const FK = {
  kliente: [],
  duplikate: [],
  sessie: null,
  wysig: null,      // die nommer wat gewysig word, of null vir 'n nuwe een
  soort: "instansie",
  keuses: {},
};

const FK_VELDE = [
  ["naam", "fk_veld_naam", "Naam"],
  ["kontak", "fk_veld_kontak", "Kontakpersoon"],
  ["epos", "fk_veld_epos", "E-pos"],
  ["selfoon", "fk_veld_selfoon", "Selfoon"],
];

function fk_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

// Alle teks wat van buite kom, gaan hierdeur voordat dit in innerHTML beland.
function fk_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function fk_vra(pad, opsies) {
  const o = opsies || {};
  const resp = await fetch("/.netlify/functions/" + pad, {
    method: o.metode || "GET",
    headers: {
      Authorization: `Bearer ${FK.sessie.access_token}`,
      ...(o.liggaam ? { "Content-Type": "application/json" } : {}),
    },
    ...(o.liggaam ? { body: JSON.stringify(o.liggaam) } : {}),
  });
  if (!resp.ok) throw new Error(`Status ${resp.status}`);
  return resp.status === 204 ? null : resp.json();
}

// ---------- die lys ----------

function fk_pas(k, soek) {
  if (!soek) return true;
  const q = soek.toLowerCase().replace(/\s/g, "");
  return [k.nommer, k.naam, k.kontak, k.epos, k.selfoon]
    .some((v) => (v || "").toLowerCase().replace(/\s/g, "").includes(q));
}

function fk_teken_lys() {
  const plek = document.getElementById("fk-lys");
  if (!plek) return;

  const soek = (document.getElementById("fk-soek") || {}).value || "";
  const lys = FK.kliente.filter((k) => fk_pas(k, soek.trim()));

  const hulp = document.getElementById("fk-hulp");
  if (hulp) {
    hulp.textContent = soek.trim()
      ? lys.length + " " + fk_t(lys.length === 1 ? "fk_pas_een" : "fk_pas_meer",
          lys.length === 1 ? "kliënt pas" : "kliënte pas")
      : FK.kliente.length + " " + fk_t("fk_kliente", "kliënte");
  }

  if (!lys.length) {
    plek.innerHTML = `<p class="stelsel-boodskap">${
      FK.kliente.length
        ? fk_t("fk_geen_pas", "Geen kliënt pas nie.")
        : fk_t("fk_geen_kliente", "Daar is nog geen kliënte nie.")
    }</p>`;
    return;
  }

  const dup = new Set();
  FK.duplikate.forEach((p) => p.nommers.forEach((n) => dup.add(n)));

  plek.innerHTML = lys.map((k) => `
    <div class="fk-ry" data-nommer="${fk_ontsnap(k.nommer)}">
      <div class="fk-ry-hoof">
        <div class="fk-ry-naam">${fk_ontsnap(k.naam)}
          <span class="fk-nr">${fk_ontsnap(k.nommer)}</span>
          ${!k.gesien ? `<span class="fk-merkie fk-merkie-nuut">${fk_t("fk_nuut", "Nuut")}</span>` : ""}
          ${dup.has(k.nommer) ? `<span class="fk-merkie fk-merkie-dup">${fk_t("fk_moontlike_dup", "Moontlike duplikaat")}</span>` : ""}
          ${k.onvolledig ? `<span class="fk-merkie">${fk_t("fk_onvolledig", "Onvolledig")}</span>` : ""}
        </div>
        <div class="fk-ry-onder">${[
          k.soort === "privaat" ? fk_t("fk_privaat", "Privaat") : fk_t("fk_instansie", "Instansie"),
          k.kontak, k.epos, k.selfoon,
        ].filter(Boolean).map(fk_ontsnap).join(" · ")}</div>
      </div>
    </div>`).join("");

  plek.querySelectorAll(".fk-ry").forEach((ry) =>
    ry.addEventListener("click", () => fk_maak_vorm_oop(ry.getAttribute("data-nommer"))));
}

function fk_teken_strook() {
  const plek = document.getElementById("fk-strook");
  if (!plek) return;
  if (!FK.duplikate.length) { plek.innerHTML = ""; return; }

  const p = FK.duplikate[0];
  const naam = (n) => {
    const k = FK.kliente.find((x) => x.nommer === n);
    return k ? k.naam : n;
  };

  plek.innerHTML = `<div class="fk-waarsku">
    <div class="fk-waarsku-teks">
      <strong>${FK.duplikate.length === 1
        ? fk_t("fk_dup_een", "Twee inskrywings deel 'n e-posadres")
        : FK.duplikate.length + " " + fk_t("fk_dup_meer", "pare deel 'n e-posadres")}</strong>
      ${fk_ontsnap(naam(p.nommers[0]))} ${fk_t("fk_en", "en")} ${fk_ontsnap(naam(p.nommers[1]))} — ${fk_ontsnap(p.epos)}
    </div>
    <button type="button" class="kaart-aksie" id="fk-dup-open">${fk_t("fk_kontroleer", "Kontroleer")}</button>
  </div>`;

  document.getElementById("fk-dup-open")
    .addEventListener("click", () => fk_maak_dup_oop(p.nommers[0], p.nommers[1]));
}

// ---------- die kliëntvorm ----------

function fk_stel_soort(nuwe) {
  FK.soort = nuwe;
  document.querySelectorAll(".fk-soort-knop").forEach((b) =>
    b.classList.toggle("aan", b.getAttribute("data-soort") === nuwe));
  const privaat = nuwe === "privaat";
  // Die kontakveld verdwyn heeltemal by 'n privaat kliënt. 'n Veld wat leeg
  // moet bly, laat 'n mens wonder of hy iets mis.
  document.getElementById("fk-kontak-ry").style.display = privaat ? "none" : "";
  document.getElementById("fk-naam-etiket").textContent = privaat
    ? fk_t("fk_naam_privaat", "Naam en van")
    : fk_t("fk_naam_instansie", "Naam van die instansie");
}

function fk_maak_vorm_oop(nommer) {
  FK.wysig = nommer || null;
  const k = FK.kliente.find((x) => x.nommer === nommer) ||
    { soort: "instansie", naam: "", kontak: "", epos: "", selfoon: "" };

  document.getElementById("fk-vorm-titel").textContent = nommer
    ? fk_t("fk_wysig_klient", "Wysig kliënt")
    : fk_t("fk_nuwe_klient", "Nuwe kliënt");
  fk_stel_soort(k.soort || "instansie");
  document.getElementById("fk-naam").value = k.naam || "";
  document.getElementById("fk-kontak").value = k.kontak || "";
  document.getElementById("fk-epos").value = k.epos || "";
  document.getElementById("fk-selfoon").value = k.selfoon || "";
  document.getElementById("fk-vorm-fout").style.display = "none";
  document.getElementById("fk-vorm").classList.add("oop");
  document.getElementById("fk-naam").focus();
}

function fk_maak_vorm_toe() {
  document.getElementById("fk-vorm").classList.remove("oop");
  FK.wysig = null;
}

async function fk_stoor() {
  const naam = document.getElementById("fk-naam").value.trim();
  const fout = document.getElementById("fk-vorm-fout");
  if (!naam) {
    fout.textContent = fk_t("fk_naam_verplig", "Die naam is verplig.");
    fout.style.display = "";
    document.getElementById("fk-naam").focus();
    return;
  }

  const liggaam = {
    nommer: FK.wysig || undefined,
    soort: FK.soort,
    naam,
    kontak: document.getElementById("fk-kontak").value.trim(),
    epos: document.getElementById("fk-epos").value.trim(),
    selfoon: document.getElementById("fk-selfoon").value.trim(),
  };

  const knoppie = document.getElementById("fk-stoor");
  knoppie.disabled = true;

  try {
    const uit = await fk_vra("stoor-klient", { metode: "POST", liggaam });

    // Plaaslik by die lys voeg, nie weer vra nie — sien die kop van die lêer.
    const rekord = {
      nommer: uit.nommer,
      soort: liggaam.soort,
      naam: liggaam.naam,
      kontak: liggaam.soort === "privaat" ? "" : liggaam.kontak,
      epos: liggaam.epos.toLowerCase(),
      selfoon: liggaam.selfoon,
      bron: "paneel",
      gesien: true,
      fakture: 0,
    };
    rekord.onvolledig = !rekord.epos || !rekord.selfoon ||
      (rekord.soort === "instansie" && !rekord.kontak);

    const ix = FK.kliente.findIndex((x) => x.nommer === uit.nommer);
    if (ix >= 0) FK.kliente[ix] = rekord; else FK.kliente.push(rekord);
    FK.kliente.sort((a, b) => (a.naam || "").localeCompare(b.naam || "", "af-ZA"));

    fk_maak_vorm_toe();
    fk_teken_lys();
  } catch (f) {
    console.error("Kon nie die kliënt stoor nie:", f);
    fout.textContent = fk_t("fk_stoor_fout", "Kon nie stoor nie. Probeer weer.");
    fout.style.display = "";
  } finally {
    knoppie.disabled = false;
  }
}

// ---------- die duplikaat-skerm ----------

function fk_maak_dup_oop(a, b) {
  // Die OUDSTE rekord oorleef — sy nommer is waarna die fakture verwys.
  const eerste = a <= b ? a : b;
  const tweede = eerste === a ? b : a;
  const oud = FK.kliente.find((x) => x.nommer === eerste);
  const nuwe = FK.kliente.find((x) => x.nommer === tweede);
  if (!oud || !nuwe) return;

  FK.keuses = {};
  FK_VELDE.forEach(([v]) => {
    FK.keuses[v] = (oud[v] || "") === (nuwe[v] || "") ? "eenders" : "oud";
  });

  fk_teken_dup(oud, nuwe);
  document.getElementById("fk-dup").classList.add("oop");
}

function fk_teken_dup(oud, nuwe) {
  const verskille = FK_VELDE.filter(([v]) => (oud[v] || "") !== (nuwe[v] || ""));
  const venster = document.getElementById("fk-dup-venster");

  venster.innerHTML = `
    <h2>${fk_t("fk_dup_titel", "Kontroleer hierdie twee")}</h2>
    <p class="fk-lei">${fk_ontsnap(oud.epos)} — ${verskille.length
      ? verskille.length + " " + fk_t(verskille.length === 1 ? "fk_veld_verskil" : "fk_velde_verskil",
          verskille.length === 1 ? "veld verskil." : "velde verskil.")
        + " " + fk_t("fk_kies_waarde", "Kies watter waarde moet bly.")
      : fk_t("fk_niks_nuuts", "Elke veld is dieselfde — die nuwe indiening dra niks nuuts nie.")}</p>

    ${FK_VELDE.map(([v, sleutel, verstek]) => {
      const etiket = fk_t(sleutel, verstek);
      if ((oud[v] || "") === (nuwe[v] || "")) {
        return `<div class="fk-vgl">
          <div class="fk-vgl-etiket">${etiket}</div>
          <div class="fk-vgl-eenders">${fk_ontsnap(oud[v]) || "—"}</div></div>`;
      }
      return `<div class="fk-vgl verskil">
        <div class="fk-vgl-etiket">${etiket}</div>
        <div class="fk-vgl-paar">
          <button type="button" class="fk-vgl-kant ${FK.keuses[v] === "oud" ? "gekies" : ""}"
                  data-veld="${v}" data-kant="oud">
            <span class="fk-vgl-kop">${fk_t("fk_bestaande", "Bestaande")} · ${fk_ontsnap(oud.nommer)}</span>
            <span class="fk-vgl-waarde">${fk_ontsnap(oud[v]) || "—"}</span>
          </button>
          <button type="button" class="fk-vgl-kant ${FK.keuses[v] === "nuwe" ? "gekies" : ""}"
                  data-veld="${v}" data-kant="nuwe">
            <span class="fk-vgl-kop">${fk_t("fk_nuwe_indiening", "Nuwe indiening")} · ${fk_ontsnap(nuwe.nommer)}</span>
            <span class="fk-vgl-waarde">${fk_ontsnap(nuwe[v]) || "—"}</span>
          </button>
        </div></div>`;
    }).join("")}

    <div class="fk-dup-fout stelsel-boodskap" id="fk-dup-fout" style="display:none;"></div>

    <div class="fk-knoppies">
      <button type="button" class="kaart-aksie stil fk-links" id="fk-dup-toe">${fk_t("fk_los", "Los vir eers")}</button>
      <button type="button" class="kaart-aksie stil" id="fk-dup-albei">${fk_t("fk_hou_albei", "Hou albei")}</button>
      <button type="button" class="kaart-aksie stil" id="fk-dup-vee">${fk_t("fk_vee_nuwe", "Vee die nuwe weg")}</button>
      <button type="button" class="kaart-aksie" id="fk-dup-werk">${fk_t("fk_werk_by", "Werk by en vee weg")}</button>
    </div>`;

  venster.querySelectorAll(".fk-vgl-kant").forEach((k) =>
    k.addEventListener("click", () => {
      FK.keuses[k.getAttribute("data-veld")] = k.getAttribute("data-kant");
      fk_teken_dup(oud, nuwe);
    }));

  document.getElementById("fk-dup-toe")
    .addEventListener("click", () => document.getElementById("fk-dup").classList.remove("oop"));
  document.getElementById("fk-dup-albei")
    .addEventListener("click", () => fk_los_dup(oud, nuwe, "hou_albei"));
  document.getElementById("fk-dup-vee")
    .addEventListener("click", () => fk_los_dup(oud, nuwe, "vee_weg"));
  document.getElementById("fk-dup-werk")
    .addEventListener("click", () => fk_los_dup(oud, nuwe, "werk_by"));
}

async function fk_los_dup(oud, nuwe, uitkoms) {
  const fout = document.getElementById("fk-dup-fout");
  try {
    await fk_vra("los-duplikaat", {
      metode: "POST",
      liggaam: { hou: oud.nommer, weg: nuwe.nommer, uitkoms, keuses: FK.keuses },
    });
  } catch (f) {
    console.error("Kon nie die duplikaat oplos nie:", f);
    fout.textContent = fk_t("fk_dup_fout", "Kon nie dit doen nie. Probeer weer.");
    fout.style.display = "";
    return;
  }

  // Plaaslik bywerk, nie weer vra nie.
  if (uitkoms === "werk_by") {
    FK_VELDE.forEach(([v]) => { if (FK.keuses[v] === "nuwe") oud[v] = nuwe[v]; });
    if (oud.soort === "privaat") oud.kontak = "";
    oud.onvolledig = !oud.epos || !oud.selfoon ||
      (oud.soort === "instansie" && !oud.kontak);
  }
  if (uitkoms !== "hou_albei") {
    FK.kliente = FK.kliente.filter((x) => x.nommer !== nuwe.nommer);
  }
  oud.gesien = true;
  nuwe.gesien = true;

  FK.duplikate = FK.duplikate.filter((p) =>
    !(p.nommers.includes(oud.nommer) && p.nommers.includes(nuwe.nommer)));
  if (uitkoms !== "hou_albei") {
    FK.duplikate = FK.duplikate.filter((p) => !p.nommers.includes(nuwe.nommer));
  }

  document.getElementById("fk-dup").classList.remove("oop");
  fk_teken_lys();
  fk_teken_strook();
}

// ---------- begin ----------

async function fk_laai() {
  const plek = document.getElementById("fk-lys");
  try {
    const data = await fk_vra("kry-kliente");
    FK.kliente = data.kliente || [];
    FK.duplikate = data.duplikate || [];
    fk_teken_lys();
    fk_teken_strook();
  } catch (f) {
    console.error("Kon nie die kliënte laai nie:", f);
    if (plek) {
      plek.innerHTML = `<p class="stelsel-boodskap">${
        fk_t("fk_laai_fout", "Kon nie die kliënte laai nie.")}</p>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("fk-lys")) return;

  try {
    FK.sessie = await identiteit_kry_huidige_sessie();
  } catch {
    FK.sessie = null;
  }
  if (!FK.sessie || !identiteit_het_rol(FK.sessie.gebruiker, "boekhouding")) return;

  document.getElementById("fk-soek").addEventListener("input", fk_teken_lys);
  document.getElementById("fk-nuut").addEventListener("click", () => fk_maak_vorm_oop(null));
  document.getElementById("fk-kanselleer").addEventListener("click", fk_maak_vorm_toe);
  document.getElementById("fk-stoor").addEventListener("click", fk_stoor);
  document.querySelectorAll(".fk-soort-knop").forEach((b) =>
    b.addEventListener("click", () => fk_stel_soort(b.getAttribute("data-soort"))));

  document.getElementById("fk-kopieer").addEventListener("click", async (ev) => {
    const url = document.getElementById("fk-skakel-url").textContent.trim();
    try {
      await navigator.clipboard.writeText("https://" + url);
      ev.currentTarget.textContent = fk_t("fk_gekopieer", "Gekopieer");
      setTimeout(() => {
        const b = document.getElementById("fk-kopieer");
        if (b) b.textContent = fk_t("fk_kopieer", "Kopieer");
      }, 1400);
    } catch {
      // Sonder klembordtoegang bly die adres sigbaar om met die hand te kies.
    }
  });

  [["fk-vorm", fk_maak_vorm_toe], ["fk-dup", () =>
    document.getElementById("fk-dup").classList.remove("oop")]].forEach(([id, toe]) => {
      const o = document.getElementById(id);
      o.addEventListener("click", (ev) => { if (ev.target === o) toe(); });
    });
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (document.getElementById("fk-dup").classList.contains("oop")) {
      document.getElementById("fk-dup").classList.remove("oop");
    } else {
      fk_maak_vorm_toe();
    }
  });

  await fk_laai();
});
