// public/js/faktuurpaneel-bankstate-meervoudig.js
// Weergawe 1 (16 Oktober 2026).
//
// Meer as een FNB-staat gelyk oplaai. faktuurpaneel-bankstate.js stuur hierheen
// sodra meer as een PDF gekies is; een lêer loop steeds deur die gewone
// voorskou.
//
// DIESELFDE LESER, DIESELFDE INVOER. Elke PDF word in die blaaier gelees met
// bankstaat-fnb.js en, as al drie kontroles klop, met voer-bankstaat-in
// ingevoer, presies soos een staat. Die bediener kontroleer elkeen weer en
// weier oorvleueling; niks hier vervang dit nie.
//
// DIE VOLGORDE. State word van die oudste na die nuutste ingevoer, een na die
// ander, nooit gelyk nie. So sien elke invoer die vorige een, en die pasmaak
// teen die joernaal gebeur in dieselfde volgorde as wat die bank dit gesien het.
//
// WAT UITBLY, en waarom, staan by elke lêer:
//   'n kontrole wat nie klop nie (word genoem)
//   'n tydperk wat 'n reeds ingevoerde staat van dieselfde rekening oorvleuel
//   'n tydperk wat 'n ander lêer in dieselfde keuse oorvleuel (die eerste bly)
//   'n lêer wat nie gelees kon word nie
//
// 'n Staat van 'n ander rekening as Future Sharp s'n word, soos by een staat,
// net as toetsstaat ingevoer.

(function () {
  "use strict";

  const M = { items: [], besig: false };

  function G() { return window.BS_GEDEEL; }

  function oorvleuel(a, b) {
    return a.van <= b.tot && b.van <= a.tot;
  }

  function rek4(r) {
    return r && r.rekening ? String(r.rekening.nommer).slice(-4) : "";
  }

  // Bepaal elke item se stand uit sy leesresultaat, die ingevoerde state en
  // die ander items in die keuse.
  function beoordeel() {
    const g = G();
    const almal_toets = M.almal_toets === true;
    const ingevoer = g.state();
    const aanvaar = [];

    M.items
      .slice()
      .sort((a, b) => String((a.r && a.r.tydperk && a.r.tydperk.van) || "z")
        .localeCompare(String((b.r && b.r.tydperk && b.r.tydperk.van) || "z")))
      .forEach((it) => {
        if (it.klaar) return;
        it.rede = "";
        it.gereed = false;
        if (it.nie_pdf) { it.rede = g.t("bm_nie_pdf", "Nie 'n PDF nie"); return; }
        const r = it.r;
        if (!r || (!r.ok && r.fout)) {
          it.rede = (r && r.fout) || g.t("bs_lees_fout", "Kon nie die PDF lees nie.");
          return;
        }
        if (!r.ok) {
          const k = r.kontroles || {};
          const name = [];
          if (k.ketting && !k.ketting.ok) name.push(g.t("bm_k_ketting", "saldo-ketting"));
          if (k.omset && !k.omset.ok) name.push(g.t("bm_k_omset", "FNB se omset"));
          if (k.bankkoste && !k.bankkoste.ok) name.push(g.t("bm_k_bankkoste", "bankkoste"));
          it.rede = g.t("bm_kontrole", "Kontrole klop nie: {k}").replace("{k}", name.join(", "));
          return;
        }
        const r4 = rek4(r);
        it.toets = almal_toets || !g.eie.includes(r4);
        const tyd = r.tydperk;

        if (!it.toets) {
          const bots = ingevoer.find((s) => s.toets !== true && s.rekening4 === r4 && oorvleuel(s, tyd));
          if (bots) {
            it.rede = g.t("bm_reeds", "Oorvleuel met die ingevoerde staat {v} tot {t}")
              .replace("{v}", g.datum(bots.van)).replace("{t}", g.datum(bots.tot));
            return;
          }
        }
        const dubbel = aanvaar.find((a) => a.toets === it.toets && rek4(a.r) === r4 && oorvleuel(a.r.tydperk, tyd));
        if (dubbel) {
          it.rede = g.t("bm_dubbel", "Oorvleuel met {l} in hierdie keuse").replace("{l}", dubbel.naam);
          return;
        }
        it.gereed = true;
        aanvaar.push(it);
      });
  }

  function stand_html(it) {
    const g = G();
    if (it.klaar) {
      return `<span class="bs-stand voorstel">&#10003; ${g.ontsnap(g.t("bm_ingevoer", "Ingevoer"))}</span>`;
    }
    if (it.besig) {
      return `<span class="bs-stand oop">${g.ontsnap(g.t("bm_besig", "Word ingevoer …"))}</span>`;
    }
    if (it.fout_invoer) {
      return `<span class="bs-stand leeg">&#10007; ${g.ontsnap(it.fout_invoer)}</span>`;
    }
    if (it.gereed) {
      const toets_rede = it.toets && !M.almal_toets;
      return `<span class="bs-stand voorstel">&#10003; ${g.ontsnap(toets_rede
        ? g.t("bm_gereed_toets", "Gereed, as toetsstaat (ander rekening)")
        : g.t("bm_gereed", "Gereed"))}</span>`;
    }
    return `<span class="bs-stand leeg">&#10007; ${g.ontsnap(it.rede)}</span>`;
  }

  function teken() {
    const g = G();
    const plek = document.getElementById("bs-uitslag");
    if (!plek) return;
    if (!M.besig && !M.items.some((i) => i.klaar)) beoordeel();

    const rye = M.items.map((it) => {
      const r = it.r && it.r.tydperk ? it.r : null;
      return `<tr>
        <td><span class="bs-beskr">${g.ontsnap(it.naam)}</span></td>
        <td>${r ? `${g.datum(r.tydperk.van)} ${g.ontsnap(g.t("bs_tot", "tot"))} ${g.datum(r.tydperk.tot)}` : "—"}</td>
        <td class="n">${r && Array.isArray(r.transaksies) ? r.transaksies.length : ""}</td>
        <td>${stand_html(it)}</td>
      </tr>`;
    }).join("");

    const gereed = M.items.filter((i) => i.gereed && !i.klaar && !i.fout_invoer).length;
    const gedoen = M.items.some((i) => i.klaar || i.fout_invoer);
    const knop_teks = gereed === 1
      ? g.t("bm_voer_in_een", "Voer 1 staat in")
      : g.t("bm_voer_in", "Voer {n} state in").replace("{n}", gereed);

    let onder = "";
    if (M.melding) onder = `<p class="bs-opsom">${g.ontsnap(M.melding)}</p>`;

    plek.innerHTML = `
      <div class="bm-hou">
        <h3 class="bs-kop3">${g.ontsnap(g.t("bm_kop", "{n} state gekies").replace("{n}", M.items.length))}</h3>
        <div class="bs-tabel-hou">
          <table class="jn-tabel bs-tabel bm-tabel">
            <thead><tr>
              <th>${g.ontsnap(g.t("bm_h_leer", "Lêer"))}</th>
              <th class="bm-w-tyd">${g.ontsnap(g.t("bm_h_tydperk", "Tydperk"))}</th>
              <th class="n bm-w-tel">${g.ontsnap(g.t("bm_h_trans", "Transaksies"))}</th>
              <th class="bm-w-st">${g.ontsnap(g.t("bm_h_stand", "Stand"))}</th>
            </tr></thead>
            <tbody>${rye}</tbody>
          </table>
        </div>
        ${onder}
        <div class="bs-invoer">
          ${gedoen ? "" : `<label class="wi-merk"><input type="checkbox" id="bm-toets"${M.almal_toets ? " checked" : ""}${M.besig ? " disabled" : ""}>
            <span>${g.ontsnap(g.t("bm_almal_toets", "Voer almal as toetsstate in"))}</span></label>`}
          ${gereed && !M.besig ? `<button type="button" class="kaart-aksie" id="bm-voer-in">${g.ontsnap(knop_teks)}</button>` : ""}
          ${M.besig ? "" : `<button type="button" class="kaart-aksie wi-stil" id="bm-toe">${g.ontsnap(g.t("bm_kanselleer", "Maak toe"))}</button>`}
          ${gedoen ? "" : `<p class="bs-lei">${g.ontsnap(g.t("bm_lei",
            "Net state waar al drie kontroles klop, word ingevoer, van die oudste na die nuutste. Die res bly uit."))}</p>`}
        </div>
      </div>`;

    const toets = document.getElementById("bm-toets");
    if (toets) toets.addEventListener("change", () => { M.almal_toets = toets.checked; teken(); });
    const voer = document.getElementById("bm-voer-in");
    if (voer) voer.addEventListener("click", voer_almal_in);
    const toe = document.getElementById("bm-toe");
    if (toe) toe.addEventListener("click", () => { M.items = []; M.melding = ""; G().maak_voorskou_toe(); });
  }

  async function voer_almal_in() {
    const g = G();
    if (M.besig) return;
    beoordeel();
    const lys = M.items
      .filter((i) => i.gereed && !i.klaar && !i.fout_invoer)
      .sort((a, b) => String(a.r.tydperk.van).localeCompare(String(b.r.tydperk.van)));
    if (!lys.length) return;

    M.besig = true;
    let laaste = null;
    for (const it of lys) {
      it.besig = true;
      teken();
      const r = it.r;
      try {
        const uit = await g.pos("voer-bankstaat-in", {
          toets: it.toets === true,
          staat: {
            rekening: r.rekening, tydperk: r.tydperk,
            opening_sent: r.opening_sent, sluit_sent: r.sluit_sent,
            transaksies: r.transaksies.map((x) => ({
              datum: x.datum, beskrywing: x.beskrywing, verwysing: x.verwysing,
              bedrag_sent: x.bedrag_sent, rigting: x.rigting, saldo_sent: x.saldo_sent,
              fnb_fooi: x.fnb_fooi === true,
            })),
          },
        });
        it.klaar = true;
        laaste = uit.staat;
      } catch (f) {
        it.fout_invoer = String(f.message || f);
      }
      it.besig = false;
    }
    M.besig = false;

    const i = M.items.filter((x) => x.klaar).length;
    M.melding = g.t("bm_klaar", "{i} ingevoer, {u} uitgelaat.")
      .replace("{i}", i).replace("{u}", M.items.length - i);
    await g.laai_state();
    teken();
    if (laaste) g.maak_staat_oop(laaste);
  }

  window.bs_meervoudig = async function (lêers) {
    const g = G();
    const plek = document.getElementById("bs-uitslag");
    if (!g || !plek || M.besig) return;

    g.maak_voorskou_toe();
    M.items = lêers.map((l) => ({ lêer: l, naam: l.name }));
    M.melding = "";
    M.almal_toets = false;

    for (let n = 0; n < M.items.length; n++) {
      const it = M.items[n];
      plek.innerHTML = `<p class="stelsel-boodskap">${g.ontsnap(g.t("bm_lees", "Lees {i} van {n} …")
        .replace("{i}", n + 1).replace("{n}", M.items.length))}</p>`;
      if (!/\.pdf$/i.test(it.naam) && it.lêer.type !== "application/pdf") {
        it.nie_pdf = true;
        continue;
      }
      try {
        it.r = window.BankstaatFNB.lees(await g.lees_items(it.lêer));
      } catch (fout) {
        console.error("Kon nie die staat lees nie:", it.naam, fout);
        it.r = { ok: false, fout: g.t("bs_lees_fout", "Kon nie die PDF lees nie.") + " " + (fout.message || "") };
      }
      it.lêer = null;   // die PDF self word nie gehou nie
    }
    // Wys die lêers in tydsvolgorde; wat nie gelees kon word nie, onderaan.
    const van = (it) => String((it.r && it.r.tydperk && it.r.tydperk.van) || "\uffff");
    M.items.sort((a, b) => van(a).localeCompare(van(b)));
    teken();
  };
})();
