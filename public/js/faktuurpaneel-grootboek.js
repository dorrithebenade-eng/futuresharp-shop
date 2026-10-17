// public/js/faktuurpaneel-grootboek.js
// Weergawe 4 (16 Oktober 2026): "Koppel al die oorblywende rekeninge" skep vir
// elke ongekoppelde rekening 'n kategorie met die rekenmeester se naam en
// rigting, of gebruik 'n bestaande een met presies daardie naam, en koppel
// almal in een stoor. "Wys 1 transaksie toe" in die enkelvoud.
// Weergawe 3 (16 Oktober 2026): 'n vierde kontrole, "Geen ontbrekende state nie". Die banksaldo kan
// klop al ontbreek 'n hele staat, want FNB se saldo is absoluut; 'n gaping
// tussen twee state se tydperke word nou self gewys.
// Weergawe 2 (16 Oktober 2026): "+ Nuwe kategorie" in die keuselys skep 'n
// kategorie in die register (stoor-fin-kategorie, met al sy kontroles) en
// koppel die rekening dadelik daaraan, soos by 'n banktransaksie.
// Weergawe 1 (16 Oktober 2026).
//
// Die Bankstate-pil se derde aansig: die rekenmeester se grootboek inlees en
// die ingevoerde state daarvolgens toewys.
//
// DRIE STAPPE OP EEN BLAD
//
//   1. Lees     die PDF word in die blaaier gelees (grootboek-act.js); die
//               lêer verlaat nooit die rekenaar nie. Twee kontroles moet klop.
//   2. Koppel   elke grootboekrekening kry een van Future Sharp se kategoriee.
//               Die koppeling word gestoor en geld vir elke volgende grootboek.
//   3. Wys toe  elke grootboekreel word teen 'n bankreel gepas (GrootboekACT.pas)
//               en die oop bankreels kry hul kategorie deur wys-bankreel-toe,
//               dieselfde Function as die hand-toewysing. Niks wat reeds
//               toegewys is, word verander nie.
//
// DIE BANKSALDO WORD GEKONTROLEER. Die rekenmeester se bankrekening se
// sluitsaldo moet dieselfde wees as die ingevoerde state s'n op die
// grootboek se einddatum. Klop dit nie, ontbreek daar 'n staat of 'n reel,
// en die skerm se so.
//
// DIE GEREEDSKAP KOM UIT faktuurpaneel-bankstate.js (window.BS_GEDEEL): die
// PDF-leser, die oproepe en die opmaak. Hierdie lêer laai na daardie een.

(function () {
  "use strict";

  const OORDRAG = "__oordrag";
  const NUUT = "__nuut";
  const GB = { r: null, kats: [], koppeling: { rekeninge: {} }, state: [], pas: null, besig: false, melding: "" };

  function G() { return window.BS_GEDEEL; }
  function t(k, v) { return G().t(k, v); }
  function o(s) { return G().ontsnap(s); }
  function rand(s) { return G().rand(s); }
  function datum(s) { return G().datum(s); }

  async function vra(naam) {
    const resp = await fetch("/.netlify/functions/" + naam, { headers: await identiteit_kop() });
    if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
    return resp.json();
  }

  function plek() { return document.getElementById("gb-uitslag"); }

  function merkie(ok, etiket, detail) {
    return `<div class="bs-kontrole ${ok ? "ok" : "fout"}">
      <span class="bs-kontrole-kop">${ok ? "&#10003;" : "&#10007;"} ${o(etiket)}</span>
      <span class="bs-kontrole-detail">${o(detail)}</span></div>`;
  }

  /* ═══ laai ═══ */

  async function laai_kats_en_koppeling() {
    const [k, kp] = await Promise.all([vra("kry-fin-kategoriee"), vra("kry-grootboek-koppeling")]);
    GB.kats = Array.isArray(k.kategoriee) ? k.kategoriee : [];
    GB.koppeling = kp && kp.rekeninge ? kp : { rekeninge: {} };
  }

  // Die regte state wat die grootboek se tydperk raak, volledig.
  async function laai_state() {
    const tyd = GB.r.tydperk;
    const lys = (await vra("kry-bankstate")).state || [];
    const raak = lys.filter((s) => s.toets !== true && s.van <= tyd.tot && s.tot >= tyd.van);
    GB.state = await Promise.all(raak.map((s) =>
      vra("kry-bankstate?sleutel=" + encodeURIComponent(s.sleutel)).then((d) => d.staat)));
  }

  // Die bank se saldo aan die einde van die dag `dag`, uit die state.
  function banksaldo(dag) {
    const st = GB.state.slice().sort((a, b) => String(a.van).localeCompare(String(b.van)));
    let saldo = null;
    st.forEach((s) => {
      if (s.van > dag) return;
      if (saldo === null) saldo = s.opening_sent;
      (s.reels || []).forEach((r) => { if (r.datum <= dag) saldo = r.saldo_sent; });
    });
    return saldo;
  }

  // Gapings in die state se tydperke binne [van, tot]. FNB se state deel 'n
  // grensdag, so 'n gaping is net waar die volgende staat NA die vorige se
  // einde begin.
  function gapings(van, tot) {
    const st = GB.state.slice().sort((a, b) => String(a.van).localeCompare(String(b.van)));
    const uit = [];
    let tot_hier = null;
    st.forEach((s) => {
      if (tot_hier === null) {
        if (s.van > van) uit.push([van, s.van]);
      } else if (s.van > tot_hier) {
        uit.push([tot_hier, s.van]);
      }
      if (tot_hier === null || s.tot > tot_hier) tot_hier = s.tot;
    });
    if (tot_hier === null) uit.push([van, tot]);
    else if (tot_hier < tot) uit.push([tot_hier, tot]);
    return uit;
  }

  function dek(dag) {
    return GB.state.some((s) => s.van <= dag && s.tot >= dag);
  }

  /* ═══ teken ═══ */

  function kat_opsies(rigting, huidig) {
    const gekies = (v) => (v === huidig ? " selected" : "");
    const opsies = GB.kats
      .filter((k) => (k.aktief !== false || k.id === huidig) && (k.rigting === "in" ? "in" : "uit") === rigting)
      .map((k) => `<option value="${o(k.id)}"${gekies(k.id)}>${o(k.pad || k.naam)}</option>`).join("");
    return `<option value=""${gekies("")}>${o(t("gb_nie_gekoppel", "Nog nie gekoppel nie"))}</option>
      ${opsies}
      <option value="${OORDRAG}"${gekies(OORDRAG)}>${o(t("gb_oordrag", "Oordrag tussen eie rekeninge"))}</option>
      <option value="${NUUT}">${o(t("bs_nuwe_kat", "+ Nuwe kategorie \u2026"))}</option>`;
  }

  function teken() {
    const p = plek();
    const r = GB.r;
    if (!p || !r) return;
    if (!r.ok && r.fout) {
      p.innerHTML = `<p class="bs-foutboodskap">${o(r.fout)}</p>`;
      return;
    }

    const k = r.kontroles;
    const rek_detail = k.rekeninge.ok
      ? t("gb_rek_ok", "Al {n} rekeninge se inskrywings gee hul sluitsaldo.").replace("{n}", r.rekeninge.length + (r.bank ? 1 : 0))
      : t("gb_rek_fout", "Klop nie by: {k}. Die grootboek is nie volledig gelees nie.").replace("{k}", k.rekeninge.foute.join(", "));
    const bal_detail = !k.balans.bank_gevind
      ? t("gb_bal_geen", "Geen bankrekening in die grootboek gevind nie.")
      : t("gb_bal", "Bank {b}, die ander rekeninge saam {a}.")
          .replace("{b}", rand(k.balans.bank_sent)).replace("{a}", rand(k.balans.ander_sent));

    // Die bank teen die state.
    let bank_ok = false;
    let bank_detail;
    if (!r.bank) {
      bank_detail = t("gb_bs_geen", "Geen bankrekening om na te gaan nie.");
    } else if (!dek(r.tydperk.tot)) {
      bank_detail = t("gb_bs_nie_gedek", "Geen ingevoerde staat dek {d} nie.").replace("{d}", datum(r.tydperk.tot));
    } else {
      const s = banksaldo(r.tydperk.tot);
      bank_ok = s === r.bank.sluit_sent;
      bank_detail = t("gb_bs", "Grootboek {g}, state {s} op {d}.")
        .replace("{g}", rand(r.bank.sluit_sent)).replace("{s}", rand(s)).replace("{d}", datum(r.tydperk.tot));
    }

    const gaps = gapings(r.tydperk.van, r.tydperk.tot);
    const dek_detail = gaps.length
      ? t("gb_dek_fout", "Geen staat dek {g} nie. Laai die ontbrekende staat op.")
          .replace("{g}", gaps.map(([a, b]) => `${datum(a)} ${t("bs_tot", "tot")} ${datum(b)}`).join("; "))
      : t("gb_dek_ok", "Die state loop aaneen van {v} tot {t}, sonder gapings.").replace("{v}", datum(r.tydperk.van)).replace("{t}", datum(r.tydperk.tot));

    const pas = GB.pas;
    const per_kode = {};
    if (pas) pas.uitslag.forEach((u) => {
      const p2 = per_kode[u.g.kode] = per_kode[u.g.kode] || { gepas: 0, tel: 0 };
      p2.tel += 1;
      if (u.stand !== "geen") p2.gepas += 1;
    });

    const rye = r.rekeninge.map((x) => {
      const huidig = (GB.koppeling.rekeninge[x.kode] || {}).kategorie || "";
      const pk = per_kode[x.kode] || { gepas: 0, tel: x.tel };
      return `<tr>
        <td class="gb-kode">${o(x.kode)}</td>
        <td>${o(x.naam)}<span class="bs-verw">${o(x.rigting === "in" ? t("gb_inkomste", "Ontvangs") : t("gb_uitgawe", "Betaling"))}</span></td>
        <td class="n">${pk.gepas} / ${pk.tel}</td>
        <td class="n">${rand(x.netto_sent)}</td>
        <td><select class="veld-invoer gb-kies" data-kode="${o(x.kode)}" data-naam="${o(x.naam)}" data-rigting="${x.rigting}"${GB.besig ? " disabled" : ""}>
          ${kat_opsies(x.rigting, huidig)}</select></td>
      </tr>`;
    }).join("");

    p.innerHTML = `
      <div class="bs-kop">
        <div><span class="bs-kop-etiket">${o(t("gb_grootboek", "Grootboek"))}</span>${o(r.entiteit)}</div>
        <div><span class="bs-kop-etiket">${o(t("bs_tydperk", "Tydperk"))}</span>
          ${datum(r.tydperk.van)} ${o(t("bs_tot", "tot"))} ${datum(r.tydperk.tot)}</div>
      </div>
      <div class="bs-kontroles">
        ${merkie(k.rekeninge.ok, t("gb_k_rek", "Rekeninge"), rek_detail)}
        ${merkie(k.balans.ok, t("gb_k_bal", "Balans"), bal_detail)}
        ${merkie(bank_ok, t("gb_k_bank", "Bank teen die state"), bank_detail)}
        ${merkie(!gaps.length, t("gb_k_dek", "Geen ontbrekende state nie"), dek_detail)}
      </div>
      ${r.ok ? "" : `<p class="bs-opsom fout">${o(t("gb_nie_aanvaar", "Die grootboek is nie aanvaar nie: een of meer kontroles klop nie."))}</p>`}
      <h3 class="bs-kop3">${o(t("gb_koppel_kop", "Koppel elke rekening aan 'n kategorie"))}</h3>
      <p class="bs-lei">${o(t("gb_koppel_lei", "Die koppeling word dadelik gestoor en geld ook vir volgende jaar se grootboek. Jy kan dit enige tyd verander; wat reeds toegewys is, bly soos dit is."))}</p>
      ${ongekoppel().length && !GB.besig ? `<div class="bs-invoer">
        <button type="button" class="kaart-aksie" id="gb-koppel-almal">${o(t("gb_koppel_almal", "Koppel al {n} oorblywende rekeninge").replace("{n}", ongekoppel().length))}</button>
        <p class="bs-lei">${o(t("gb_koppel_almal_lei", "Elke rekening wat nog nie gekoppel is nie, kry 'n kategorie met die rekenmeester se naam. Bestaan daar reeds een met presies daardie naam, word dit gebruik. Name kan later onder Registers verander word."))}</p>
      </div>` : ""}
      <div class="bs-tabel-hou">
        <table class="jn-tabel bs-tabel gb-tabel">
          <thead><tr>
            <th class="gb-w-kode">${o(t("gb_h_kode", "Kode"))}</th>
            <th>${o(t("gb_h_rek", "Rekening"))}</th>
            <th class="n gb-w-gepas">${o(t("gb_h_gepas", "Gepas"))}</th>
            <th class="n bs-w-bed">${o(t("gb_h_bedrag", "Bedrag"))}</th>
            <th class="gb-w-kat">${o(t("gb_h_kat", "Kategorie"))}</th>
          </tr></thead>
          <tbody>${rye}</tbody>
        </table>
      </div>
      ${r.ok ? opsomming() : ""}`;

    p.querySelectorAll(".gb-kies").forEach((s) => s.addEventListener("change", () => koppel(s)));
    const almal = document.getElementById("gb-koppel-almal");
    if (almal) almal.addEventListener("click", koppel_almal);
    const knop = document.getElementById("gb-wys-toe");
    if (knop) knop.addEventListener("click", wys_toe);
  }

  function lys(titel, items) {
    if (!items.length) return "";
    return `<details class="gb-lys"><summary>${o(titel)} (${items.length})</summary><ul>${items.join("")}</ul></details>`;
  }

  function opsomming() {
    const pas = GB.pas;
    if (!pas) return "";
    const tel = { toewys: 0, reeds: 0, verskil: 0, ongekoppel: 0, geen: 0 };
    pas.uitslag.forEach((u) => { tel[u.stand] += 1; });
    const tyd = GB.r.tydperk;
    const los = pas.los.filter((b) => b.r.datum >= tyd.van && b.r.datum <= tyd.tot);

    const reel_g = (u) => `<li>${datum(u.g.datum)} · ${o(u.g.kode)} ${o(u.g.rekening)} · ${o(u.g.beskrywing)} · ${rand(u.g.bedrag_sent)}${
      u.bank ? ` <span class="bs-verw">${o(t("gb_bank", "Bank"))}: ${datum(u.bank.datum)} ${o(u.bank.beskrywing || "")}</span>` : ""}</li>`;
    const reel_b = (b) => `<li>${datum(b.r.datum)} · ${o(b.r.beskrywing || "—")} · ${b.r.rigting === "in" ? "+" : "−"}${rand(b.r.bedrag_sent)}</li>`;

    const lyste =
      lys(t("gb_l_verskil", "Reeds anders verklaar, word nie verander nie"), pas.uitslag.filter((u) => u.stand === "verskil").map(reel_g)) +
      lys(t("gb_l_ongekoppel", "Rekening nog nie gekoppel nie"), pas.uitslag.filter((u) => u.stand === "ongekoppel").map(reel_g)) +
      lys(t("gb_l_geen", "Grootboekinskrywings sonder banktransaksie"), pas.uitslag.filter((u) => u.stand === "geen").map(reel_g)) +
      lys(t("gb_l_los", "Banktransaksies sonder grootboekinskrywing"), los.map(reel_b));

    const knop = tel.toewys && !GB.besig
      ? `<button type="button" class="kaart-aksie" id="gb-wys-toe">${o(tel.toewys === 1
          ? t("gb_wys_toe_een", "Wys 1 transaksie toe")
          : t("gb_wys_toe", "Wys {n} transaksies toe").replace("{n}", tel.toewys))}</button>`
      : "";

    return `
      <h3 class="bs-kop3">${o(t("gb_pas_kop", "Teen die ingevoerde state"))}</h3>
      <div class="gb-tel">
        ${tel.toewys ? `<span class="bs-stand oop">${tel.toewys} ${o(t("gb_t_toewys", "om toe te wys"))}</span>` : ""}
        ${tel.reeds ? `<span class="bs-stand voorstel">${tel.reeds} ${o(t("gb_t_reeds", "reeds so toegewys"))}</span>` : ""}
        ${tel.verskil ? `<span class="bs-stand leeg">${tel.verskil} ${o(t("gb_t_verskil", "anders verklaar"))}</span>` : ""}
        ${tel.ongekoppel ? `<span class="bs-stand leeg">${tel.ongekoppel} ${o(t("gb_t_ongekoppel", "nie gekoppel nie"))}</span>` : ""}
        ${tel.geen ? `<span class="bs-stand leeg">${tel.geen} ${o(t("gb_t_geen", "sonder banktransaksie"))}</span>` : ""}
        ${los.length ? `<span class="bs-stand leeg">${los.length} ${o(t("gb_t_los", "banktransaksies sonder grootboekinskrywing"))}</span>` : ""}
      </div>
      ${GB.melding ? `<p class="bs-opsom">${o(GB.melding)}</p>` : ""}
      <div class="bs-invoer">${knop}
        <p class="bs-lei">${o(t("gb_wys_lei", "Net oop of voorgestelde transaksies kry 'n kategorie. Elkeen kry die grootboekrekening as nota."))}</p>
      </div>
      ${lyste}`;
  }

  function herpas() {
    GB.pas = GB.r && GB.r.ok ? window.GrootboekACT.pas(GB.r.reels, GB.state, GB.koppeling) : null;
  }

  /* ═══ aksies ═══ */

  // 'n Nuwe kategorie binne die ry. Die rigting is die rekening s'n; die naam
  // begin as die rekenmeester se rekeningnaam en kan verander word.
  function nuwe_kat_vorm(sel) {
    const td = sel.closest("td");
    const rigting = sel.getAttribute("data-rigting");
    const ouers = GB.kats
      .filter((k) => k.aktief !== false && (k.rigting === "in" ? "in" : "uit") === rigting)
      .map((k) => `<option value="${o(k.id)}">${o(k.pad || k.naam)}</option>`).join("");
    td.innerHTML = `<div class="bs-nk">
      <input type="text" class="veld-invoer bs-nk-naam" maxlength="120" value="${o(sel.getAttribute("data-naam"))}">
      <select class="veld-invoer bs-nk-onder">
        <option value="">${o(t("bs_nk_bo", "Op die boonste vlak"))}</option>${ouers}
      </select>
      <div class="bs-nk-knoppe">
        <button type="button" class="bs-bevestig bs-nk-skep">${o(t("gb_nk_skep", "Skep en koppel"))}</button>
        <button type="button" class="bs-ontdoen bs-nk-weg">${o(t("bs_nk_kanselleer", "Kanselleer"))}</button>
      </div>
      <p class="bs-nk-fout" hidden></p>
    </div>`;
    const naam = td.querySelector(".bs-nk-naam");
    naam.focus();
    naam.select();
    td.querySelector(".bs-nk-weg").addEventListener("click", teken);
    const skep = async () => {
      const fout = td.querySelector(".bs-nk-fout");
      const n = naam.value.trim();
      if (!n) {
        fout.textContent = t("bs_nk_naam_kort", "Die naam is verpligtend.");
        fout.hidden = false;
        return;
      }
      const onder = td.querySelector(".bs-nk-onder").value;
      const knop = td.querySelector(".bs-nk-skep");
      knop.disabled = true;
      try {
        const uit = await G().pos("stoor-fin-kategorie", { naam: n, onder, rigting });
        const k = uit.kategorie;
        const ouer = GB.kats.find((x) => x.id === onder);
        k.pad = ouer ? `${ouer.pad || ouer.naam} / ${k.naam}` : k.naam;
        GB.kats.push(k);
        GB.kats.sort((a, b) => String(a.pad || a.naam).localeCompare(String(b.pad || b.naam), "af-ZA"));
        await koppel(sel, k.id);
      } catch (f) {
        fout.textContent = String(f.message || f);
        fout.hidden = false;
        knop.disabled = false;
      }
    };
    td.querySelector(".bs-nk-skep").addEventListener("click", skep);
    naam.addEventListener("keydown", (ev) => { if (ev.key === "Enter") skep(); if (ev.key === "Escape") teken(); });
  }

  function ongekoppel() {
    return GB.r && GB.r.rekeninge
      ? GB.r.rekeninge.filter((x) => !((GB.koppeling.rekeninge[x.kode] || {}).kategorie))
      : [];
  }

  // Een kategorie per oorblywende rekening. Twee rekeninge met dieselfde naam
  // en rigting (die rekenmeester het twee keer "Reparasies & Instandhouding")
  // kry dieselfde kategorie.
  async function koppel_almal() {
    const lys = ongekoppel();
    if (!lys.length || GB.besig) return;
    GB.besig = true;
    teken();
    const soek = (naam, rigting) => GB.kats.find((k) =>
      String(k.naam || "").trim().toLowerCase() === naam.trim().toLowerCase() &&
      (k.rigting === "in" ? "in" : "uit") === rigting);
    const nuut = {};
    const foute = [];
    for (const x of lys) {
      let k = soek(x.naam, x.rigting);
      if (!k) {
        try {
          const uit = await G().pos("stoor-fin-kategorie", { naam: x.naam, onder: "", rigting: x.rigting });
          k = uit.kategorie;
          k.pad = k.naam;
          GB.kats.push(k);
        } catch (f) {
          foute.push(`${x.kode}: ${String(f.message || f)}`);
          continue;
        }
      }
      nuut[x.kode] = { kategorie: k.id, naam: x.naam, rigting: x.rigting };
    }
    if (Object.keys(nuut).length) {
      try {
        GB.koppeling = await G().pos("stoor-grootboek-koppeling", { rekeninge: nuut });
      } catch (f) {
        foute.push(String(f.message || f));
      }
    }
    GB.kats.sort((a, b) => String(a.pad || a.naam).localeCompare(String(b.pad || b.naam), "af-ZA"));
    GB.besig = false;
    GB.melding = foute.length ? foute.join(" ") : "";
    herpas();
    teken();
  }

  async function koppel(s, waarde) {
    if (waarde === undefined && s.value === NUUT) { nuwe_kat_vorm(s); return; }
    const kategorie = waarde === undefined ? s.value : waarde;
    const kode = s.getAttribute("data-kode");
    try {
      const d = await G().pos("stoor-grootboek-koppeling", {
        rekeninge: { [kode]: { kategorie, naam: s.getAttribute("data-naam"), rigting: s.getAttribute("data-rigting") } },
      });
      GB.koppeling = d;
    } catch (f) {
      window.alert(String(f.message || f));
    }
    GB.melding = "";
    herpas();
    teken();
  }

  async function wys_toe() {
    if (GB.besig || !GB.pas) return;
    const per_staat = new Map();
    GB.pas.uitslag.filter((u) => u.stand === "toewys").forEach((u) => {
      const l = per_staat.get(u.staat) || [];
      l.push(u.kategorie === OORDRAG
        ? { nr: u.nr, aksie: "oordrag" }
        : { nr: u.nr, aksie: "kategorie", kategorie_id: u.kategorie,
            nota: `${t("gb_nota", "Grootboek")} ${u.g.kode} ${u.g.rekening}: ${u.g.beskrywing}`.slice(0, 500) });
      per_staat.set(u.staat, l);
    });
    GB.besig = true;
    teken();
    let reg = 0;
    const foute = [];
    for (const [sleutel, reels] of per_staat) {
      try {
        await G().pos("wys-bankreel-toe", { sleutel, reels });
        reg += reels.length;
      } catch (f) {
        foute.push(String(f.message || f));
      }
    }
    try { await laai_state(); } catch (f) { foute.push(String(f.message || f)); }
    GB.besig = false;
    herpas();
    GB.melding = t("gb_klaar", "{n} transaksies toegewys.").replace("{n}", reg) +
      (foute.length ? " " + foute.join(" ") : "");
    teken();
    if (window.bs_laai) window.bs_laai();
  }

  async function verwerk(lêer) {
    const p = plek();
    if (!lêer || !p) return;
    if (!/\.pdf$/i.test(lêer.name) && lêer.type !== "application/pdf") {
      p.innerHTML = `<p class="bs-foutboodskap">${o(t("gb_net_pdf", "Kies die grootboek as PDF."))}</p>`;
      return;
    }
    p.innerHTML = `<p class="stelsel-boodskap">${o(t("gb_lees", "Die grootboek word gelees …"))}</p>`;
    GB.melding = "";
    try {
      GB.r = window.GrootboekACT.lees(await G().lees_items(lêer));
      if (GB.r.ok || GB.r.rekeninge) {
        await laai_kats_en_koppeling();
        await laai_state();
      }
    } catch (fout) {
      console.error("Kon nie die grootboek lees nie:", fout);
      GB.r = { ok: false, fout: t("gb_lees_fout", "Kon nie die grootboek lees nie.") + " " + (fout.message || "") };
    }
    herpas();
    teken();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const invoer = document.getElementById("gb-leer");
    if (!invoer) return;
    invoer.addEventListener("change", () => {
      verwerk(invoer.files && invoer.files[0]);
      invoer.value = "";
    });
    // 'n Hand-toewysing in die ander aansig verander die stand van die reels.
    document.addEventListener("bs-gelaai", async () => {
      if (!GB.r || !GB.r.ok || GB.besig) return;
      try { await laai_state(); herpas(); teken(); } catch (f) { /* volgende keer */ }
    });
  });
})();
