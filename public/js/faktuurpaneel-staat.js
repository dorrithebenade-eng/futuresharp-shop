// public/js/faktuurpaneel-staat.js
//
// Die Staat-blad op Boekhouding.
//
// 'N NUWE LÊER, NIE 'N WYSIGING NIE. faktuurpaneel.js hanteer die sessie en
// die pille; hierdie een vul die Staat-afdeling. Dieselfde patroon as
// faktuurpaneel-kliente.js en -begunstigdes.js — en soos hulle haal hy sy
// EIE sessie met identiteit_kry_huidige_sessie(). Die naam `FP_SESSIE` leef in
// faktuurpaneel.js se skoop en is hier nie beskikbaar nie.
//
// DIE WERKLYS GAAN OOR HANDMATIGE BETALINGS ALLEEN. Wat deur Paystack geloop
// het, is by vereffening klaar betaal en verskyn nooit hier as werk nie — net
// in die tweede lys, met sy eie merkie.
//
// NIKS WORD GEMERK BY DIE OOPMAAK NIE. 'n Afmerk het geen pad terug in die
// kode nie: die ry staan daarna as betaal, met 'n verwysing wat dan by geen
// banktransaksie pas nie. Oral waar geld beweeg, is hierdie module eerder
// stadig as gerieflik. Vir die gewone geval is daar Merk almal — een klik,
// maar 'n klik wat 'n mens gekies het.

const ST = {
  sessie: null,
  data: null,
  oop: {},        // watter groepe oopgevou is
  gekies: {},     // sleutel "faktuursleutel|indeks" -> waar
  besig: false,
};

function st_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function st_rand(sent) {
  const taal = window.kry_huidige_taal ? window.kry_huidige_taal() : "af";
  return window.t_rand ? window.t_rand(sent, taal) : "R" + ((Number(sent) || 0) / 100).toFixed(2);
}

// Alle teks wat van buite kom, gaan hierdeur voordat dit in innerHTML beland.
function st_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Die store se datums is volle ISO-datumtye. Dieselfde slaggat as
// datum_dokument() in _fakture.js: 'n ISO-datum is UTC, en deur 'n Date stuur
// kon hom 'n dag skuif. Sny die eerste tien karakters.
function st_datum(waarde) {
  const s = String(waarde || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return s.split("-").reverse().join("/");
}

async function st_vra(naam, opsies) {
  const resp = await fetch("/.netlify/functions/" + naam, {
    ...(opsies || {}),
    headers: {
      ...((opsies && opsies.headers) || {}),
      ...(await identiteit_kop()),
    },
  });
  if (!resp.ok) {
    const teks = await resp.text().catch(() => "");
    throw new Error(teks || String(resp.status));
  }
  return resp.json();
}

// ── Die drie syfers ─────────────────────────────────────────────────────

function st_teken_opsomming() {
  const o = (ST.data && ST.data.opsomming) || {};
  const plek = document.getElementById("st-drie");
  if (!plek) return;

  plek.innerHTML = `
    <div class="st-blok st-klaar">
      <p class="st-blok-kop">${st_t("st_kop_uitbetaal", "Reeds uitbetaal")}</p>
      <p class="st-blok-syfer">${st_rand(o.uitbetaal_sent)}</p>
      <p class="st-blok-nota">${st_t("st_nota_uitbetaal", "Deur Paystack by vereffening, of met die hand afgemerk.")}</p>
    </div>
    <div class="st-blok st-skuld">
      <p class="st-blok-kop">${st_t("st_kop_uitstaande", "Moet nog uitbetaal word")}</p>
      <p class="st-blok-syfer">${st_rand(o.uitstaande_sent)}</p>
      <p class="st-blok-nota">${st_t("st_nota_uitstaande", "In die hoofrekening, met iemand anders se naam daarop.")}</p>
    </div>
    <div class="st-blok st-wag">
      <p class="st-blok-kop">${st_t("st_kop_verwag", "Verwagte inkomste")}</p>
      <p class="st-blok-syfer">${st_rand(o.verwag_sent)}</p>
      <p class="st-blok-nota">${st_t("st_nota_verwag", "Uitgereik en nog nie betaal nie. Nog niemand se geld nie.")}</p>
    </div>`;
}

// ── Die werklys ─────────────────────────────────────────────────────────

function st_ry_sleutel(r) {
  return r.faktuur_sleutel + "|" + r.indeks;
}

function st_groep_gekies(groep) {
  return groep.rye.filter((r) => ST.gekies[st_ry_sleutel(r)]);
}

// WAARVOOR die persoon betaal word, uit die faktuur se reels.
//
// Een persoon kan uit DRIE reels van dieselfde faktuur betaal word -- 'n
// aanbieding, 'n vraelys en 'n verslag -- en stuur-faktuur.js vou hulle vir
// Paystack saam tot een ry. Die staat wys die dele weer uitmekaar, want die
// vraag wat 'n begunstigde werklik vra, is nie "hoeveel" nie maar "waarvoor".
//
// Ouer fakture -- uitgereik voor 25 Augustus 2026 -- dra dit nie, en dan
// verskyn daar eenvoudig niks. Geen terugval nie: 'n geraaide beskrywing is
// erger as geen beskrywing.
function st_waarvoor(rye) {
  if (!Array.isArray(rye) || !rye.length) return "";
  return rye
    .filter((w) => w && w.reel)
    .map(
      (w) =>
        st_ontsnap(w.reel) +
        (Number(w.bedrag_sent) > 0 ? " " + st_rand(w.bedrag_sent) : "")
    )
    .join(" \u00B7 ");
}

function st_teken_werklys() {
  const plek = document.getElementById("st-werk");
  if (!plek) return;

  const groepe = (ST.data && ST.data.groepe) || [];
  const tel = document.getElementById("st-werk-tel");
  if (tel) {
    tel.textContent = groepe.length
      ? groepe.length + " " + (groepe.length === 1
          ? st_t("st_begunstigde", "begunstigde")
          : st_t("st_begunstigdes", "begunstigdes"))
      : "";
  }

  if (!groepe.length) {
    plek.innerHTML = `<p class="st-leeg">${st_t("st_werk_leeg", "Niks staan uit nie. Elke begunstigde het sy geld.")}</p>`;
    return;
  }

  plek.innerHTML = groepe.map((g) => {
    const oop = ST.oop[g.sleutel] === true;
    const gekies = st_groep_gekies(g);
    const gekies_sent = gekies.reduce((s, r) => s + (Number(r.bedrag_sent) || 0), 0);

    return `
      <div class="st-groep${oop ? " oop" : ""}" data-groep="${st_ontsnap(g.sleutel)}">
        <div class="st-groep-kop" data-vou="${st_ontsnap(g.sleutel)}">
          <span class="st-pyl">${oop ? "\u25BE" : "\u25B8"}</span>
          <span class="st-groep-naam">${st_ontsnap(g.naam)}
            <small>${g.rye.length} ${g.rye.length === 1
              ? st_t("st_ry", "ry") : st_t("st_rye", "rye")}</small>
          </span>
          <span class="st-groep-bedrag">${st_rand(g.totaal_sent)}</span>
        </div>
        <div class="st-groep-lyf">
          <div class="st-kies-balk">
            <button type="button" class="st-skakel" data-almal="${st_ontsnap(g.sleutel)}">${
              gekies.length === g.rye.length
                ? st_t("st_merk_geen", "Merk niks")
                : st_t("st_merk_almal", "Merk almal")}</button>
          </div>
          ${g.rye.map((r) => {
            const sl = st_ry_sleutel(r);
            return `
              <label class="st-ry">
                <input type="checkbox" data-kies="${st_ontsnap(sl)}"${ST.gekies[sl] ? " checked" : ""}>
                <span class="st-ry-wat">${st_ontsnap(r.nommer)}
                  <small>${st_ontsnap(r.klient)}</small>
                  ${(() => {
                    const w = st_waarvoor(r.waarvoor);
                    return w ? `<small class="st-waarvoor">${w}</small>` : "";
                  })()}
                </span>
                <span class="st-ry-bedrag">${st_rand(r.bedrag_sent)}</span>
              </label>`;
          }).join("")}

          <div class="st-afmerk">
            <p class="st-fout" data-fout="${st_ontsnap(g.sleutel)}"></p>
            <div class="st-velde">
              <div class="st-veld">
                <label class="veld-etiket">${st_t("st_datum", "Datum van die oorbetaling")}</label>
                <input type="date" class="veld-invoer" data-datum="${st_ontsnap(g.sleutel)}"
                       value="${new Date().toISOString().slice(0, 10)}">
              </div>
              <div class="st-veld">
                <label class="veld-etiket">${st_t("st_verwysing", "Bankverwysing")}</label>
                <input type="text" class="veld-invoer" data-verw="${st_ontsnap(g.sleutel)}"
                       placeholder="${st_t("st_verwysing_plek", "Soos dit in die bankstaat staan")}">
              </div>
            </div>
            <p class="st-som" data-som="${st_ontsnap(g.sleutel)}">${
              gekies.length
                ? st_t("st_som_voor", "Word afgemerk:") + " " + st_rand(gekies_sent)
                  + " (" + gekies.length + " " + (gekies.length === 1
                    ? st_t("st_ry", "ry") : st_t("st_rye", "rye")) + ")"
                : st_t("st_niks_gekies", "Kies watter rye hierdie oorbetaling dek.")}</p>
            <button type="button" class="kaart-aksie" data-doen="${st_ontsnap(g.sleutel)}"${
              gekies.length ? "" : " disabled"}>${st_t("st_merk", "Merk as betaal")}</button>
          </div>
        </div>
      </div>`;
  }).join("");

  st_koppel_werklys();
}

// Werk net die twee dele by wat van 'n merkie afhang, in plaas van die hele
// lys oor te teken — 'n hertekening sou die datum- en verwysingsvelde
// leegmaak terwyl iemand daarin tik.
function st_werk_groep_by(sleutel) {
  const g = ((ST.data && ST.data.groepe) || []).find((x) => x.sleutel === sleutel);
  if (!g) return;

  const gekies = st_groep_gekies(g);
  const sent = gekies.reduce((s, r) => s + (Number(r.bedrag_sent) || 0), 0);

  const som = document.querySelector(`[data-som="${CSS.escape(sleutel)}"]`);
  if (som) {
    som.textContent = gekies.length
      ? st_t("st_som_voor", "Word afgemerk:") + " " + st_rand(sent)
        + " (" + gekies.length + " " + (gekies.length === 1
          ? st_t("st_ry", "ry") : st_t("st_rye", "rye")) + ")"
      : st_t("st_niks_gekies", "Kies watter rye hierdie oorbetaling dek.");
  }

  const knop = document.querySelector(`[data-doen="${CSS.escape(sleutel)}"]`);
  if (knop) knop.disabled = gekies.length === 0;

  const almal = document.querySelector(`[data-almal="${CSS.escape(sleutel)}"]`);
  if (almal) {
    almal.textContent = gekies.length === g.rye.length
      ? st_t("st_merk_geen", "Merk niks")
      : st_t("st_merk_almal", "Merk almal");
  }
}

function st_koppel_werklys() {
  document.querySelectorAll("[data-vou]").forEach((el) =>
    el.addEventListener("click", () => {
      const s = el.getAttribute("data-vou");
      ST.oop[s] = !ST.oop[s];
      st_teken_werklys();
    }));

  document.querySelectorAll("[data-kies]").forEach((el) =>
    el.addEventListener("change", () => {
      const sl = el.getAttribute("data-kies");
      if (el.checked) ST.gekies[sl] = true;
      else delete ST.gekies[sl];
      const groep = el.closest(".st-groep");
      if (groep) st_werk_groep_by(groep.getAttribute("data-groep"));
    }));

  document.querySelectorAll("[data-almal]").forEach((el) =>
    el.addEventListener("click", () => {
      const s = el.getAttribute("data-almal");
      const g = ((ST.data && ST.data.groepe) || []).find((x) => x.sleutel === s);
      if (!g) return;
      const alles = st_groep_gekies(g).length === g.rye.length;
      g.rye.forEach((r) => {
        const sl = st_ry_sleutel(r);
        if (alles) delete ST.gekies[sl];
        else ST.gekies[sl] = true;
      });
      document.querySelectorAll(`.st-groep[data-groep="${CSS.escape(s)}"] [data-kies]`)
        .forEach((b) => { b.checked = !alles; });
      st_werk_groep_by(s);
    }));

  document.querySelectorAll("[data-doen]").forEach((el) =>
    el.addEventListener("click", () => st_merk_af(el.getAttribute("data-doen"))));
}

async function st_merk_af(sleutel) {
  if (ST.besig) return;

  const g = ((ST.data && ST.data.groepe) || []).find((x) => x.sleutel === sleutel);
  if (!g) return;

  const gekies = st_groep_gekies(g);
  const fout = document.querySelector(`[data-fout="${CSS.escape(sleutel)}"]`);
  const verw_veld = document.querySelector(`[data-verw="${CSS.escape(sleutel)}"]`);
  const datum_veld = document.querySelector(`[data-datum="${CSS.escape(sleutel)}"]`);

  if (fout) fout.textContent = "";

  if (!gekies.length) return;

  const verwysing = (verw_veld && verw_veld.value.trim()) || "";
  if (!verwysing) {
    if (fout) fout.textContent = st_t("st_fout_verwysing", "Vul die bankverwysing in.");
    if (verw_veld) verw_veld.focus();
    return;
  }

  const knop = document.querySelector(`[data-doen="${CSS.escape(sleutel)}"]`);
  ST.besig = true;
  if (knop) knop.disabled = true;

  try {
    await st_vra("merk-uitbetaal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verwysing,
        datum: (datum_veld && datum_veld.value) || "",
        rye: gekies.map((r) => ({ faktuur_sleutel: r.faktuur_sleutel, indeks: r.indeks })),
      }),
    });

    gekies.forEach((r) => delete ST.gekies[st_ry_sleutel(r)]);
    await st_laai();
  } catch (f) {
    console.error("Kon nie afmerk nie:", f);
    if (fout) {
      fout.textContent = String(f.message || "").trim()
        || st_t("st_fout_merk", "Kon nie afmerk nie. Probeer weer.");
    }
    if (knop) knop.disabled = false;
  } finally {
    ST.besig = false;
  }
}

// ── Die twee lyste ──────────────────────────────────────────────────────

function st_teken_verwag() {
  const plek = document.getElementById("st-verwag");
  if (!plek) return;
  const lys = (ST.data && ST.data.verwag) || [];

  const tel = document.getElementById("st-verwag-tel");
  if (tel) {
    tel.textContent = lys.length
      ? lys.length + " " + (lys.length === 1
          ? st_t("st_faktuur", "faktuur") : st_t("st_fakture", "fakture"))
      : "";
  }

  if (!lys.length) {
    plek.innerHTML = `<p class="st-leeg">${st_t("st_verwag_leeg", "Geen onbetaalde faktuur nie.")}</p>`;
    return;
  }

  plek.innerHTML = `<div class="st-lys">${lys.map((f) => {
    const teen = f.betaalbaar_teen ? st_datum(f.betaalbaar_teen) : "";
    const uit = f.uitgereik_op ? st_datum(f.uitgereik_op) : "";
    const onder = [
      st_ontsnap(f.klient),
      uit ? st_t("st_uitgereik", "uitgereik") + " " + uit : "",
      teen ? st_t("st_betaalbaar", "betaalbaar teen") + " " + teen : "",
    ].filter(Boolean).join(" \u00B7 ");
    return `
      <div class="st-lys-ry">
        <span class="st-ry-wat">${st_ontsnap(f.nommer)}<small>${onder}</small></span>
        <span class="st-ry-bedrag">${st_rand(f.bedrag_sent)}</span>
      </div>`;
  }).join("")}</div>`;
}

function st_teken_klaar() {
  const plek = document.getElementById("st-klaar");
  if (!plek) return;
  const lys = (ST.data && ST.data.klaar) || [];

  const tel = document.getElementById("st-klaar-tel");
  if (tel) {
    tel.textContent = lys.length
      ? lys.length + " " + (lys.length === 1
          ? st_t("st_inskrywing", "inskrywing") : st_t("st_inskrywings", "inskrywings"))
      : "";
  }

  if (!lys.length) {
    plek.innerHTML = `<p class="st-leeg">${st_t("st_klaar_leeg", "Nog niemand is uitbetaal nie.")}</p>`;
    return;
  }

  plek.innerHTML = `<div class="st-lys">${lys.map((r) => {
    const direk = r.stand === "direk_uitbetaal";
    const op = r.betaal_op ? st_datum(r.betaal_op) : "";
    const onder = [
      st_ontsnap(r.nommer),
      op,
      r.verwysing ? st_t("st_verw_kort", "verwysing") + " " + st_ontsnap(r.verwysing) : "",
    ].filter(Boolean).join(" \u00B7 ");
    return `
      <div class="st-lys-ry">
        <span class="st-ry-wat">${st_ontsnap(r.naam)}<small>${onder}</small>${(() => {
          const w = st_waarvoor(r.waarvoor);
          return w ? `<small class="st-waarvoor">${w}</small>` : "";
        })()}</span>
        <span class="st-merkie${direk ? " st-merkie-direk" : ""}">${
          direk ? st_t("st_direk", "Direk deur Paystack") : st_t("st_met_hand", "Met die hand")}</span>
        <span class="st-ry-bedrag">${st_rand(r.bedrag_sent)}</span>
      </div>`;
  }).join("")}</div>`;
}

// ── Laai ────────────────────────────────────────────────────────────────

async function st_laai() {
  try {
    ST.data = await st_vra("kry-staat");
    st_teken_opsomming();
    st_teken_werklys();
    st_teken_verwag();
    st_teken_klaar();
  } catch (f) {
    console.error("Kon nie die staat laai nie:", f);
    const plek = document.getElementById("st-werk");
    if (plek) {
      plek.innerHTML = `<p class="stelsel-boodskap">${
        st_t("st_laai_fout", "Kon nie die staat laai nie.")}</p>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("st-werk")) return;

  try {
    ST.sessie = await identiteit_kry_huidige_sessie();
  } catch {
    ST.sessie = null;
  }
  if (!ST.sessie || !identiteit_het_rol(ST.sessie.gebruiker, "boekhouding")) return;

  await st_laai();
});
