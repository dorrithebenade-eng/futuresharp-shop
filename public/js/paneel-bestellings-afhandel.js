// paneel-bestellings-afhandel.js
//
// "BESTELLINGS AFHANDEL" (November 2026) in die paneelbord.
//
// STAP 1 (skerm): oortjies Om af te handel / Laat / Afgehandel / Alles,
//   merkies met dae, en die versending se besonderhede by 'n afgehandelde
//   harde kopie.
// STAP 2: personeel merk self af (ook afhaal) of maak weer oop
//   (merk-afgehandel-personeel.js).
// STAP 3: "Volg op met outeur" stuur die outeur 'n e-pos en hou rekord
//   (volg-op-met-outeur.js).
//
// WANNEER IS IETS AFGEHANDEL
//   - Net 'n betaalde bestelling (status "Nuut") kan afgehandel of oop wees.
//     "Wag vir betaling" en "Verval" verskyn net onder Alles.
//   - Sonder harde kopie: outomaties afgehandel by betaling (e-boek, leen).
//   - Met harde kopie: afgehandel sodra bestelling.versending.gestuur waar is.
//     Die outeur skryf dit (merk-bestelling-gestuur.js), of personeel.
//   - Laat: oop en meer as BH_LAAT_NA_DAE dae sedert die bestelling.
//
// HOE DIT INHAAK
//   paneel-bestellings.js bly onaangeraak. Hierdie lêer vervang die globale
//   pas_bestellings_filter_toe() met 'n omhulsel: dit beperk ALLE_BESTELLINGS
//   tydelik tot die gekose oortjie, roep die oorspronklike, en sit die volle lys
//   SINCHROON terug. MOET NA paneel-bestellings.js GELAAI WORD.

const BH_LAAT_NA_DAE = 10;
const BH_DAG_MS = 24 * 60 * 60 * 1000;

let BH_AANSIG = "oop";
let BH_OUTEUR_NAME = null; // outeur_id -> naam
let BH_PRODUKTE = null; // slug -> produk
let BH_REGISTERS_BESIG = false;

function bh_t(sleutel, terugval) {
  return typeof t === "function" ? t(sleutel) : terugval;
}

function bh_ontsnap(x) {
  return String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// JJJJ-MM-DD of 'n volle ISO-tydstip na JJJJ/MM/DD.
function bh_datum(waarde) {
  if (!waarde) return "";
  const s = String(waarde);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, "/");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

function bh_vandag_iso() {
  const d = new Date(Date.now());
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function bh_dae(b) {
  const begin = new Date(b.geskep_op).getTime();
  if (!Number.isFinite(begin)) return 0;
  return Math.max(0, Math.floor((Date.now() - begin) / BH_DAG_MS));
}

function bh_dae_teks(n) {
  return n === 1 ? bh_t("bh_een_dag", "1 dag") : `${n} ${bh_t("bh_dae", "dae")}`;
}

function bh_is_afhaal(b) {
  return Boolean(b.aflewering && b.aflewering.metode === "afhaal");
}

// "onbetaal" | "outo" | "afgehandel" | "oop" | "laat"
function bh_stand(b) {
  if (!b || b.status !== "Nuut") return "onbetaal";
  if (!b.bevat_harde_kopie) return "outo";
  if (b.versending && b.versending.gestuur === true) return "afgehandel";
  return bh_dae(b) > BH_LAAT_NA_DAE ? "laat" : "oop";
}

function bh_in_aansig(b, aansig) {
  const s = bh_stand(b);
  if (aansig === "oop") return s === "oop" || s === "laat";
  if (aansig === "laat") return s === "laat";
  if (aansig === "klaar") return s === "afgehandel" || s === "outo";
  return true;
}

function bh_tel(lys) {
  const tel = { oop: 0, laat: 0, klaar: 0, alles: lys.length };
  lys.forEach((b) => {
    const s = bh_stand(b);
    if (s === "oop" || s === "laat") tel.oop++;
    if (s === "laat") tel.laat++;
    if (s === "afgehandel" || s === "outo") tel.klaar++;
  });
  return tel;
}

// --- Registers: outeursname en produkte (een keer) ---

async function bh_laai_registers() {
  if (BH_REGISTERS_BESIG || (BH_OUTEUR_NAME && BH_PRODUKTE)) return;
  BH_REGISTERS_BESIG = true;
  try {
    const [o_resp, p_resp] = await Promise.all([
      fetch("/.netlify/functions/kry-outeurs", { headers: kry_outorisasie_kop() }),
      fetch("/.netlify/functions/kry-alle-produkte", { headers: kry_outorisasie_kop() }),
    ]);
    BH_OUTEUR_NAME = {};
    BH_PRODUKTE = {};
    if (o_resp.ok) {
      ((await o_resp.json()).outeurs || []).forEach((o) => {
        if (o && o.outeur_id) BH_OUTEUR_NAME[o.outeur_id] = o.naam || "";
      });
    }
    if (p_resp.ok) {
      ((await p_resp.json()).produkte || []).forEach((p) => {
        if (p && p.slug) BH_PRODUKTE[p.slug] = p;
      });
    }
    pas_bestellings_filter_toe();
  } catch (fout) {
    // Nie-krities: sonder die registers staan "die outeur" en geen name nie.
    console.warn("Bestellings afhandel: kon nie die registers laai nie:", fout);
  } finally {
    BH_REGISTERS_BESIG = false;
  }
}

function bh_outeur_naam(outeur_id) {
  if (!outeur_id) return "";
  return (BH_OUTEUR_NAME && BH_OUTEUR_NAME[outeur_id]) || "";
}

// Dieselfde reël as outeur_by_produk_betrokke() in _outeur-aandeel.js.
function bh_outeur_ids_vir_produk(produk) {
  const ids = new Set();
  if (!produk) return ids;
  (produk.outeur_ids || []).forEach((id) => id && ids.add(id));
  const formate = produk.formate || {};
  const opsie_lyste = ((formate.harde_kopie && formate.harde_kopie.opsies) || []).map((o) => o.verdelings || []);
  ["eboek", "harde_kopie", "leen"]
    .map((n) => (formate[n] && formate[n].verdelings) || [])
    .concat(opsie_lyste)
    .forEach((lys) =>
      lys.forEach((v) => {
        if (!v) return;
        const rol = v.rol_tipe || (v.outeur_id ? "outeur" : null);
        const id = v.entiteit_id || v.outeur_id;
        if (rol === "outeur" && id) ids.add(id);
      })
    );
  return ids;
}

function bh_outeurs_vir_bestelling(b) {
  if (!BH_PRODUKTE || !BH_OUTEUR_NAME) return [];
  const ids = new Set();
  (b.items || [])
    .filter((i) => i && i.formaat === "harde_kopie")
    .forEach((i) => bh_outeur_ids_vir_produk(BH_PRODUKTE[i.produk_slug]).forEach((id) => ids.add(id)));
  return [...ids].map((id) => BH_OUTEUR_NAME[id]).filter(Boolean);
}

// --- Bo die lys: oortjies en waarskuwing ---

function bh_houer() {
  let houer = document.getElementById("bh-bo");
  if (houer) return houer;
  const filters = document.querySelector('[data-afdeling-inhoud="bestellings"] .paneel-bestellings-filters');
  if (!filters) return null;
  houer = document.createElement("div");
  houer.id = "bh-bo";
  filters.parentNode.insertBefore(houer, filters);

  houer.addEventListener("click", (e) => {
    const knoppie = e.target.closest("button[data-bh-aansig]");
    if (!knoppie) return;
    BH_AANSIG = knoppie.dataset.bhAansig;
    pas_bestellings_filter_toe();
  });
  return houer;
}

function bh_teken_bo(lys) {
  const houer = bh_houer();
  if (!houer) return;
  const tel = bh_tel(lys);

  const oortjies = [
    ["oop", bh_t("bh_oortjie_oop", "Om af te handel"), tel.oop],
    ["laat", bh_t("bh_oortjie_laat", "Laat"), tel.laat],
    ["klaar", bh_t("bh_oortjie_klaar", "Afgehandel"), tel.klaar],
    ["alles", bh_t("bh_oortjie_alles", "Alles"), tel.alles],
  ]
    .map(([sleutel, teks, n]) => {
      const klasse = ["bh-oortjie"];
      if (sleutel === BH_AANSIG) klasse.push("bh-oortjie--aktief");
      if (sleutel === "laat" && n) klasse.push("bh-oortjie--laat");
      return `<button type="button" class="${klasse.join(" ")}" data-bh-aansig="${sleutel}">${bh_ontsnap(teks)} <span class="bh-tel">${n}</span></button>`;
    })
    .join("");

  const waarskuwing = tel.laat
    ? `<div class="bh-waarskuwing">
         <span>⚠️ ${bh_ontsnap(
           (tel.laat === 1 ? bh_t("bh_waarsku_een", "1 bestelling is langer as {d} dae nie afgehandel nie.") : bh_t("bh_waarsku_meer", "{n} bestellings is langer as {d} dae nie afgehandel nie."))
             .replace("{n}", tel.laat)
             .replace("{d}", BH_LAAT_NA_DAE)
         )}</span>
         ${BH_AANSIG === "laat" ? "" : `<button type="button" class="bh-waarskuwing-knoppie" data-bh-aansig="laat">${bh_ontsnap(bh_t("bh_wys_hulle", "Wys hulle"))}</button>`}
       </div>`
    : "";

  houer.innerHTML = `${waarskuwing}<div class="bh-oortjies">${oortjies}</div>`;
}

// --- Op elke kaart ---

function bh_wie_het_gemerk(v) {
  const deur = String(v.laas_gewysig_deur || "");
  if (deur.startsWith("personeel:")) return deur.slice("personeel:".length) || "Future Sharp";
  return bh_outeur_naam(deur) || bh_t("bh_die_outeur", "die outeur");
}

function bh_strook_afgehandel(b) {
  const v = b.versending || {};
  const stukke = [];

  if (v.afgehaal) {
    stukke.push(`${bh_t("bh_afgehaal_op", "Afgehaal op")} <strong>${bh_ontsnap(bh_datum(v.gestuur_op))}</strong>`);
  } else {
    stukke.push(`${bh_t("bh_gestuur_op", "Gestuur op")} <strong>${bh_ontsnap(bh_datum(v.gestuur_op))}</strong>`);
    if (v.wyse === "verskaffer") {
      let deur = `${bh_t("bh_deur_verskaffer", "deur")} ${bh_ontsnap(v.verskaffer || bh_t("bh_verskaffer", "'n drukker of verspreider"))}`;
      if (v.verskaffer_verwysing) deur += ` (${bh_ontsnap(v.verskaffer_verwysing)})`;
      stukke.push(deur);
    } else if (v.wyse === "self") {
      stukke.push(bh_ontsnap(bh_t("bh_self_gepos", "self gepos")));
    }
    if (v.spoornommer) {
      stukke.push(`${bh_t("bh_spoornommer", "Spoornommer")} <strong>${bh_ontsnap(v.spoornommer)}</strong>`);
    }
  }

  const nota = v.nota ? `<span class="bh-strook-sub">📝 ${bh_ontsnap(v.nota)}</span>` : "";
  const gemerk = v.laas_gewysig_op
    ? `<span class="bh-strook-sub">${bh_ontsnap(bh_t("bh_gemerk_deur", "Gemerk deur"))} ${bh_ontsnap(bh_wie_het_gemerk(v))} ${bh_ontsnap(bh_t("bh_op", "op"))} ${bh_ontsnap(bh_datum(v.laas_gewysig_op))}</span>`
    : "";

  return `<div class="bh-strook bh-strook--klaar">
      <div class="bh-strook-ry">
        <span>✅ ${stukke.join(" · ")}</span>
        <button type="button" class="bh-knoppie-rand" data-bh-heropen="${bh_ontsnap(b.bestelnommer)}">${bh_ontsnap(bh_t("bh_maak_oop", "Maak weer oop"))}</button>
      </div>
      ${nota}${gemerk}
    </div>`;
}

function bh_strook_opvolg(b) {
  const opvolg = Array.isArray(b.opvolg) ? b.opvolg : [];
  if (!opvolg.length) return "";
  const reels = opvolg
    .map((o) => `${bh_ontsnap(bh_datum(o.op))}${o.aan && o.aan.length ? ` (${bh_ontsnap(o.aan.map((a) => a.naam).filter(Boolean).join(", "))})` : ""}`)
    .join(", ");
  return `<div class="bh-strook-opvolg">✉️ ${bh_ontsnap(bh_t("bh_opgevolg", "Opgevolg met outeur:"))} ${reels}</div>`;
}

function bh_aksies_oop(b) {
  const nr = bh_ontsnap(b.bestelnommer);
  const afhaal = bh_is_afhaal(b);
  const hulp = afhaal
    ? bh_t("bh_hulp_afhaal", "Afhaal: die koper kry geen e-pos nie.")
    : bh_t("bh_hulp_koerier", "Die koper kry 'n e-pos dat die bestelling op pad is, met die spoornommer as daar een is.");

  return `<div class="bh-aksies">
      <button type="button" class="bh-knoppie-primer" data-bh-wys-vorm="${nr}">✓ ${bh_ontsnap(bh_t("bh_merk_afgehandel", "Merk as afgehandel"))}</button>
      <button type="button" class="bh-knoppie-rand bh-knoppie-rand--koraal" data-bh-volg-op="${nr}">✉️ ${bh_ontsnap(bh_t("bh_volg_op", "Volg op met outeur"))}</button>
      <span class="bh-aksie-status" data-bh-status="${nr}"></span>
    </div>
    <div class="bh-vorm" data-bh-vorm="${nr}" hidden>
      <div class="bh-vorm-velde">
        <label>${bh_ontsnap(afhaal ? bh_t("bh_datum_afgehaal", "Datum afgehaal") : bh_t("bh_datum_gestuur", "Datum gestuur"))}
          <input type="date" class="veld-invoer" data-bh-veld="datum" value="${bh_vandag_iso()}" max="${bh_vandag_iso()}">
        </label>
        ${afhaal ? "" : `<label>${bh_ontsnap(bh_t("bh_spoornommer_opsioneel", "Spoornommer (opsioneel)"))}
          <input type="text" class="veld-invoer" data-bh-veld="spoornommer" maxlength="100">
        </label>`}
        <label class="bh-vorm-breed">${bh_ontsnap(bh_t("bh_nota_opsioneel", "Nota (opsioneel)"))}
          <input type="text" class="veld-invoer" data-bh-veld="nota" maxlength="300">
        </label>
      </div>
      <p class="bh-vorm-hulp">${bh_ontsnap(hulp)}</p>
      <p class="bh-vorm-fout" data-bh-fout></p>
      <div class="bh-aksies">
        <button type="button" class="bh-knoppie-primer" data-bh-bevestig="${nr}">${bh_ontsnap(bh_t("bh_bevestig", "Bevestig afgehandel"))}</button>
        <button type="button" class="bh-knoppie-teks" data-bh-kanselleer="${nr}">${bh_ontsnap(bh_t("bh_kanselleer", "Kanselleer"))}</button>
      </div>
    </div>`;
}

function bh_merkie(b) {
  const s = bh_stand(b);
  if (s === "onbetaal") return "";
  if (s === "outo") {
    return `<span class="bh-merkie bh-merkie--klaar" title="${bh_ontsnap(bh_t("bh_outo_titel", "Sonder harde kopie: afgehandel by betaling"))}">${bh_ontsnap(bh_t("bh_merkie_klaar", "Afgehandel"))}</span>`;
  }
  if (s === "afgehandel") {
    return `<span class="bh-merkie bh-merkie--klaar">${bh_ontsnap(bh_t("bh_merkie_klaar", "Afgehandel"))}</span>`;
  }
  const dae = bh_dae_teks(bh_dae(b));
  return s === "laat"
    ? `<span class="bh-merkie bh-merkie--laat">${bh_ontsnap(bh_t("bh_merkie_laat", "Laat"))} · ${bh_ontsnap(dae)}</span>`
    : `<span class="bh-merkie bh-merkie--oop">${bh_ontsnap(bh_t("bh_merkie_oop", "Oop"))} · ${bh_ontsnap(dae)}</span>`;
}

function bh_verryk_kaarte(lys) {
  const wrap = document.getElementById("paneel-bestellings-lys");
  if (!wrap) return;
  const per_nommer = new Map(lys.map((b) => [b.bestelnommer, b]));

  wrap.querySelectorAll(".paneel-bestelling-kaart").forEach((kaart) => {
    const skrap = kaart.querySelector(".paneel-bestelling-skrap-knoppie");
    const b = skrap && per_nommer.get(skrap.dataset.bestelnommer);
    if (!b) return;

    const s = bh_stand(b);
    if (s === "laat") kaart.classList.add("bh-kaart--laat");

    const merk_html = bh_merkie(b);
    const status = kaart.querySelector(".paneel-bestelling-kop .paneel-status-merker");
    if (merk_html && status) status.insertAdjacentHTML("afterend", merk_html);

    if (b.bevat_harde_kopie && s !== "onbetaal") {
      const name = bh_outeurs_vir_bestelling(b);
      const meta = kaart.querySelector(".paneel-bestelling-meta");
      if (name.length && meta) {
        meta.insertAdjacentHTML(
          "afterend",
          `<p class="bh-outeur-reel">${bh_ontsnap(bh_t("bh_outeur", "Outeur:"))} <strong>${bh_ontsnap(name.join(", "))}</strong></p>`
        );
      }
    }

    if (s === "afgehandel") {
      kaart.insertAdjacentHTML("beforeend", bh_strook_afgehandel(b));
    } else if (s === "oop" || s === "laat") {
      kaart.insertAdjacentHTML("beforeend", bh_strook_opvolg(b) + bh_aksies_oop(b));
    }
  });

  // Leë oortjie: 'n boodskap wat by die oortjie pas.
  if (!wrap.querySelector(".paneel-bestelling-kaart")) {
    const leeg = {
      oop: bh_t("bh_leeg_oop", "Niks om af te handel nie."),
      laat: bh_t("bh_leeg_laat", "Niks is laat nie."),
    }[BH_AANSIG];
    const boodskap = wrap.querySelector(".stelsel-boodskap");
    if (leeg && boodskap) boodskap.textContent = leeg;
  }
}

// --- Aksies ---

function bh_vervang_bestelling(bygewerk) {
  if (!bygewerk || !bygewerk.bestelnommer) return;
  const i = ALLE_BESTELLINGS.findIndex((b) => b.bestelnommer === bygewerk.bestelnommer);
  if (i !== -1) ALLE_BESTELLINGS[i] = bygewerk;
}

async function bh_pos(funksie, data) {
  const resp = await fetch(`/.netlify/functions/${funksie}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);
  return resp.json();
}

async function bh_bevestig(knoppie) {
  const nr = knoppie.dataset.bhBevestig;
  const vorm = knoppie.closest("[data-bh-vorm]");
  const veld = (n) => {
    const el = vorm.querySelector(`[data-bh-veld="${n}"]`);
    return el ? el.value.trim() : "";
  };
  const fout = vorm.querySelector("[data-bh-fout]");
  fout.textContent = "";
  knoppie.disabled = true;
  knoppie.textContent = bh_t("bh_besig", "Besig …");
  try {
    const bygewerk = await bh_pos("merk-afgehandel-personeel", {
      bestelnommer: nr,
      afgehandel: true,
      datum: veld("datum"),
      spoornommer: veld("spoornommer"),
      nota: veld("nota"),
    });
    bh_vervang_bestelling(bygewerk);
    pas_bestellings_filter_toe();
  } catch (e) {
    fout.textContent = e.message;
    knoppie.disabled = false;
    knoppie.textContent = bh_t("bh_bevestig", "Bevestig afgehandel");
  }
}

async function bh_heropen(knoppie) {
  const nr = knoppie.dataset.bhHeropen;
  if (!window.confirm(bh_t("bh_heropen_vraag", "Maak hierdie bestelling weer oop? Dit gaan terug na Om af te handel."))) return;
  knoppie.disabled = true;
  try {
    const bygewerk = await bh_pos("merk-afgehandel-personeel", { bestelnommer: nr, afgehandel: false });
    bh_vervang_bestelling(bygewerk);
    pas_bestellings_filter_toe();
  } catch (e) {
    alert(e.message);
    knoppie.disabled = false;
  }
}

async function bh_volg_op(knoppie) {
  const nr = knoppie.dataset.bhVolgOp;
  const status = document.querySelector(`[data-bh-status="${CSS.escape(nr)}"]`);
  knoppie.disabled = true;
  if (status) status.textContent = bh_t("bh_besig", "Besig …");
  try {
    const uitslag = await bh_pos("volg-op-met-outeur", { bestelnommer: nr });
    bh_vervang_bestelling(uitslag.bestelling);
    pas_bestellings_filter_toe();
    const nuwe_status = document.querySelector(`[data-bh-status="${CSS.escape(nr)}"]`);
    if (nuwe_status) {
      let teks = `${bh_t("bh_opvolg_gestuur", "E-pos gestuur aan")} ${(uitslag.aan || []).map((a) => a.naam).join(", ")}.`;
      if (uitslag.sonder_epos && uitslag.sonder_epos.length) {
        teks += ` ${bh_t("bh_geen_epos", "Geen e-posadres vir:")} ${uitslag.sonder_epos.join(", ")}.`;
      }
      nuwe_status.textContent = teks;
    }
  } catch (e) {
    if (status) status.textContent = e.message;
    knoppie.disabled = false;
  }
}

function bh_koppel_lys() {
  const wrap = document.getElementById("paneel-bestellings-lys");
  if (!wrap || wrap.dataset.bhGekoppel) return;
  wrap.dataset.bhGekoppel = "1";
  wrap.addEventListener("click", (e) => {
    const k = e.target.closest("button");
    if (!k) return;
    const ds = k.dataset;
    if (ds.bhWysVorm) {
      const vorm = wrap.querySelector(`[data-bh-vorm="${CSS.escape(ds.bhWysVorm)}"]`);
      if (vorm) vorm.hidden = false;
      k.hidden = true;
    } else if (ds.bhKanselleer) {
      const vorm = wrap.querySelector(`[data-bh-vorm="${CSS.escape(ds.bhKanselleer)}"]`);
      if (vorm) vorm.hidden = true;
      const wys = wrap.querySelector(`[data-bh-wys-vorm="${CSS.escape(ds.bhKanselleer)}"]`);
      if (wys) wys.hidden = false;
    } else if (ds.bhBevestig) {
      bh_bevestig(k);
    } else if (ds.bhHeropen) {
      bh_heropen(k);
    } else if (ds.bhVolgOp) {
      bh_volg_op(k);
    }
  });
}

// --- Die omhulsel ---

(function bh_haak_in() {
  if (typeof pas_bestellings_filter_toe !== "function") {
    console.error("paneel-bestellings-afhandel.js moet NA paneel-bestellings.js gelaai word.");
    return;
  }
  const oorspronklik = pas_bestellings_filter_toe;

  pas_bestellings_filter_toe = function () {
    const alles = ALLE_BESTELLINGS;
    bh_teken_bo(alles);

    let deel = alles.filter((b) => bh_in_aansig(b, BH_AANSIG));
    // Wat nog hanteer moet word: oudste eerste, want dié wag die langste.
    if (BH_AANSIG === "oop" || BH_AANSIG === "laat") {
      deel = deel.slice().sort((a, b) => new Date(a.geskep_op) - new Date(b.geskep_op));
    }

    ALLE_BESTELLINGS = deel;
    try {
      oorspronklik();
    } finally {
      ALLE_BESTELLINGS = alles;
    }

    bh_koppel_lys();
    bh_verryk_kaarte(alles);
    if (!(BH_OUTEUR_NAME && BH_PRODUKTE) && alles.some((b) => b.bevat_harde_kopie)) bh_laai_registers();
  };

  // Het die bestellings reeds gelaai voordat hierdie lêer ingehaak het, teken
  // dan nou oor sodat die oortjies en merkies verskyn.
  if (Array.isArray(ALLE_BESTELLINGS) && ALLE_BESTELLINGS.length) pas_bestellings_filter_toe();
})();
