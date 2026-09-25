// public/js/faktuurpaneel-bankstate.js
//
// Die Bankstate-pil: 'n FNB-staat oplaai, lees en kontroleer, invoer, en elke
// reel verklaar.
//
// DIE PDF VERLAAT NOOIT DIE REKENAAR NIE. pdf.js lees dit in die blaaier;
// bankstaat-fnb.js haal die reels uit. By die invoer gaan net die reels na
// die bediener, wat die saldo-ketting van voor af nagaan.
//
// DRIE DELE OP DIE BLAD
//
//   Oplaai en voorskou   die drie kontroles; "Voer in" net as al drie klop
//   Een staat oop        elke reel met sy stand, en die toewysing
//   Ingevoerde state     die lys, nuutste eerste
//
// 'N REEL SE STAND (sien _bankstate.js): oop, voorstel, gepas, toegewys,
// oordrag, inligting. Toewys skep 'n joernaalinskrywing met die bron "bank";
// ontdoen vee dit weer uit. Die joernaal self wys daardie inskrywings as
// leesalleen.
//
// pdf.js WORD LUI GELAAI, eers wanneer 'n staat gekies word.

(function () {
  "use strict";

  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/";
  const BS = { kategoriee: [], resultaat: null, state: [], oop: null, net_oop: false };
  const EIE = ["2857"];
  const OORDRAG = "__oordrag";
  const NUUT = "__nuut";

  function t(sleutel, verstek) {
    const uit = window.t ? window.t(sleutel) : null;
    return uit && uit !== sleutel ? uit : verstek;
  }

  function ontsnap(teks) {
    return String(teks == null ? "" : teks)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Dieselfde vorm as die joernaal se jn_rand(): R1 234,56 met 'n harde spasie.
  function rand(sent) {
    const n = Math.round(Math.abs(Number(sent) || 0));
    const heel = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
    return "R" + heel + "," + String(n % 100).padStart(2, "0");
  }

  // 'n Saldo dra Dr of Cr, soos op die staat self.
  function saldo(sent) {
    return rand(sent) + (sent < 0 ? " Dr" : sent > 0 ? " Cr" : "");
  }

  function datum(iso) {
    return String(iso || "").replace(/-/g, "/");
  }

  async function vra(naam, opsies) {
    const resp = await fetch("/.netlify/functions/" + naam, {
      ...(opsies || {}),
      headers: { ...((opsies && opsies.headers) || {}), ...(await identiteit_kop()) },
    });
    if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
    return resp.json();
  }

  function pos(naam, liggaam) {
    return vra(naam, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(liggaam),
    });
  }

  function laai_pdfjs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise((ja, nee) => {
      const s = document.createElement("script");
      s.src = PDFJS + "pdf.min.js";
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
        ja(window.pdfjsLib);
      };
      s.onerror = () => nee(new Error(t("bs_pdfjs_fout", "Kon nie die PDF-leser laai nie.")));
      document.head.appendChild(s);
    });
  }

  async function lees_items(lêer) {
    const pdfjs = await laai_pdfjs();
    const data = new Uint8Array(await lêer.arrayBuffer());
    const doc = await pdfjs.getDocument({ data }).promise;
    const bladsye = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const blad = await doc.getPage(n);
      const inhoud = await blad.getTextContent();
      bladsye.push({
        items: inhoud.items.map((i) => ({
          s: i.str, x: i.transform[4], y: i.transform[5], w: i.width,
        })),
      });
    }
    return bladsye;
  }

  // Die Bankkoste-kategorie, as dit bestaan. Net 'n VOORSTEL: niks word
  // toegewys voordat die invoer gebou is nie.
  function bankkoste_kategorie() {
    return BS.kategoriee.find((k) =>
      k.aktief !== false && k.rigting === "uit" && /bankkoste/i.test(k.naam || "")) || null;
  }

  function merkie(ok, etiket, detail) {
    return `<div class="bs-kontrole ${ok ? "ok" : "fout"}">
      <span class="bs-kontrole-kop">${ok ? "&#10003;" : "&#10007;"} ${ontsnap(etiket)}</span>
      <span class="bs-kontrole-detail">${ontsnap(detail)}</span></div>`;
  }

  function teken() {
    const plek = document.getElementById("bs-uitslag");
    const r = BS.resultaat;
    if (!plek || !r) return;

    if (!r.ok && r.fout) {
      plek.innerHTML = `<p class="bs-foutboodskap">${ontsnap(r.fout)}</p>`;
      return;
    }

    const k = r.kontroles;
    const kat = bankkoste_kategorie();
    const nommer = r.rekening ? "\u2026" + String(r.rekening.nommer).slice(-4) : "";

    const ketting_detail = k.ketting.ok
      ? t("bs_ketting_ok", "Elke reël se saldo klop, van {o} tot {s}.")
          .replace("{o}", saldo(r.opening_sent)).replace("{s}", saldo(r.sluit_sent))
      : t("bs_ketting_fout", "{n} reël(s) se saldo klop nie. Die staat is nie volledig gelees nie.")
          .replace("{n}", k.ketting.foute.length || 1);

    const om = k.omset;
    const omset_detail = !om.beskikbaar
      ? t("bs_omset_geen", "Die staat dra geen omsettotaal nie.")
      : t("bs_omset", "Krediete {kt} van {kf} ({kr}), debiete {dt} van {df} ({dr}).")
          .replace("{kt}", om.krediete.tel).replace("{kf}", om.fnb_krediete.tel)
          .replace("{kr}", rand(om.krediete.sent))
          .replace("{dt}", om.debiete.tel).replace("{df}", om.fnb_debiete.tel)
          .replace("{dr}", rand(om.debiete.sent));

    const bk = k.bankkoste;
    const bankkoste_detail = bk.reels === 0
      ? t("bs_bk_geen", "Geen reëls sonder beskrywing nie.")
      : bk.ok
        ? t("bs_bk_ok", "{n} fooireëls van {r} klop met die bankkoste-blok.")
            .replace("{n}", bk.reels).replace("{r}", rand(bk.sent))
        : t("bs_bk_fout", "{n} reëls sonder beskrywing ({r}) klop nie met die bankkoste-blok ({b}). Hulle bly sonder kategorie.")
            .replace("{n}", bk.reels).replace("{r}", rand(bk.sent)).replace("{b}", rand(bk.blok_sent));

    const rye = r.transaksies.map((x) => {
      let stand;
      if (x.inligting) {
        stand = `<span class="bs-stand info">${ontsnap(t("bs_st_info", "Inligting, word nie ingevoer nie"))}</span>`;
      } else if (x.fnb_fooi) {
        stand = `<span class="bs-stand voorstel">${ontsnap(t("bs_st_voorstel", "Voorstel:"))} ${
          ontsnap(kat ? kat.pad || kat.naam : t("bs_bk_naam", "Bankkoste"))}${
          kat ? "" : " " + ontsnap(t("bs_bk_bestaan_nie", "(kategorie bestaan nog nie)"))}</span>`;
      } else if (!x.beskrywing) {
        stand = `<span class="bs-stand leeg">${ontsnap(t("bs_st_leeg", "Geen beskrywing, geen kategorie"))}</span>`;
      } else {
        stand = `<span class="bs-stand oop">${ontsnap(t("bs_st_oop", "Nie toegewys nie"))}</span>`;
      }
      return `<tr class="${x.inligting ? "bs-info" : ""}">
        <td>${datum(x.datum)}</td>
        <td><span class="bs-beskr">${ontsnap(x.beskrywing || "\u2014")}</span>${
          x.verwysing ? `<span class="bs-verw">${ontsnap(x.verwysing)}</span>` : ""}</td>
        <td class="n">${x.rigting === "in" && !x.inligting ? rand(x.bedrag_sent) : ""}</td>
        <td class="n bs-uit">${x.rigting === "uit" && !x.inligting ? rand(x.bedrag_sent) : ""}</td>
        <td class="n">${saldo(x.lopende_sent)}</td>
        <td>${stand}</td>
      </tr>`;
    }).join("");

    const tel_fooi = r.transaksies.filter((x) => x.fnb_fooi).length;
    const tel_info = r.transaksies.filter((x) => x.inligting).length;
    const tel_oop = r.transaksies.length - tel_fooi - tel_info;

    plek.innerHTML = `
      <div class="bs-kop">
        <div><span class="bs-kop-etiket">${ontsnap(r.bank)}</span>
          ${ontsnap(r.rekening ? r.rekening.naam : "")} ${ontsnap(nommer)}</div>
        <div><span class="bs-kop-etiket">${ontsnap(t("bs_tydperk", "Tydperk"))}</span>
          ${datum(r.tydperk.van)} ${ontsnap(t("bs_tot", "tot"))} ${datum(r.tydperk.tot)}</div>
      </div>
      <div class="bs-kontroles">
        ${merkie(k.ketting.ok, t("bs_k_ketting", "Saldo-ketting"), ketting_detail)}
        ${merkie(om.ok, t("bs_k_omset", "FNB se omset"), omset_detail)}
        ${merkie(bk.ok, t("bs_k_bankkoste", "Bankkoste"), bankkoste_detail)}
      </div>
      <p class="bs-opsom ${r.ok ? "" : "fout"}">${ontsnap(r.ok
        ? t("bs_aanvaar", "Die staat is volledig gelees.")
        : t("bs_nie_aanvaar", "Die staat is nie aanvaar nie: een of meer kontroles klop nie."))}
        ${ontsnap(t("bs_tel", "{n} reëls: {o} om toe te wys, {f} FNB-bankkoste, {i} inligting.")
          .replace("{n}", r.transaksies.length).replace("{o}", tel_oop)
          .replace("{f}", tel_fooi).replace("{i}", tel_info))}</p>
      <div class="bs-tabel-hou">
        <table class="jn-tabel bs-tabel">
          <thead><tr>
            <th class="jn-w-dat">${ontsnap(t("bs_h_datum", "Datum"))}</th>
            <th>${ontsnap(t("bs_h_beskr", "Beskrywing"))}</th>
            <th class="n bs-w-bed">${ontsnap(t("bs_h_in", "In"))}</th>
            <th class="n bs-w-bed">${ontsnap(t("bs_h_uit", "Uit"))}</th>
            <th class="n bs-w-sal">${ontsnap(t("bs_h_saldo", "Saldo"))}</th>
            <th class="bs-w-st">${ontsnap(t("bs_h_stand", "Stand"))}</th>
          </tr></thead>
          <tbody>${rye}</tbody>
        </table>
      </div>
      ${invoer_blok(r)}
      <p class="bs-nota">${ontsnap(t("bs_niks_gestoor", "Niks is gestoor nie. Die staat is net in die blaaier gelees."))}</p>`;

    const knop = document.getElementById("bs-voer-in");
    if (knop) knop.addEventListener("click", voer_in);
  }

  function invoer_blok(r) {
    if (!r.ok) return "";
    const rek4 = r.rekening ? String(r.rekening.nommer).slice(-4) : "";
    const eie = EIE.includes(rek4);
    return `<div class="bs-invoer">
      <label class="wi-merk"><input type="checkbox" id="bs-toets"${eie ? "" : " checked disabled"}>
        <span>${ontsnap(t("bs_toetsstaat", "Toetsstaat"))}</span></label>
      <button type="button" class="kaart-aksie" id="bs-voer-in">${ontsnap(t("bs_voer_in", "Voer in"))}</button>
      <p class="bs-lei">${ontsnap(eie
        ? t("bs_invoer_lei", "Reels wat die stelsel reeds ken, word gepas; die res wag op toewysing.")
        : t("bs_ander_rek", "Hierdie staat is nie van Future Sharp se rekening nie en kan net as toetsstaat ingevoer word."))}</p>
    </div>`;
  }

  async function voer_in() {
    const knop = document.getElementById("bs-voer-in");
    const r = BS.resultaat;
    if (!r || !r.ok) return;
    knop.disabled = true;
    try {
      const uit = await pos("voer-bankstaat-in", {
        toets: document.getElementById("bs-toets").checked,
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
      BS.resultaat = null;
      document.getElementById("bs-uitslag").innerHTML = "";
      await laai_state();
      maak_staat_oop(uit.staat);
    } catch (f) {
      window.alert(String(f.message || f));
      knop.disabled = false;
    }
  }

  /* ═══ ingevoerde state ═══ */

  function tel_merkies(tel) {
    const l = [];
    if (tel.oop) l.push(`<span class="bs-stand leeg">${tel.oop} ${ontsnap(t("bs_t_oop", "oop"))}</span>`);
    if (tel.voorstel) l.push(`<span class="bs-stand oop">${tel.voorstel} ${ontsnap(t("bs_t_voorstel", "voorgestel"))}</span>`);
    const klaar = (tel.gepas || 0) + (tel.toegewys || 0) + (tel.oordrag || 0);
    if (klaar) l.push(`<span class="bs-stand voorstel">${klaar} ${ontsnap(t("bs_t_klaar", "verklaar"))}</span>`);
    return l.join(" ");
  }

  function teken_state() {
    const plek = document.getElementById("bs-state");
    if (!plek) return;
    if (!BS.state.length) {
      plek.innerHTML = `<p class="stelsel-boodskap">${ontsnap(t("bs_geen_state", "Nog geen state ingevoer nie."))}</p>`;
    } else {
      plek.innerHTML = `<h3 class="bs-kop3">${ontsnap(t("bs_ingevoer", "Ingevoerde state"))}</h3>` +
        BS.state.map((s) => `
        <div class="fk-ry fk-ry-twee">
          <button type="button" class="fk-ry-oop" data-bs="${ontsnap(s.sleutel)}">
            <span class="fk-ry-naam">${ontsnap(s.bank)} \u2026${ontsnap(s.rekening4)} \u00b7 ${datum(s.van)} ${ontsnap(t("bs_tot", "tot"))} ${datum(s.tot)}${
              s.toets ? `<span class="fk-merkie">${ontsnap(t("bs_toets", "Toets"))}</span>` : ""}</span>
            <span class="fk-ry-onder">${tel_merkies(s.tel || {})}</span>
          </button>
        </div>`).join("");
      plek.querySelectorAll("[data-bs]").forEach((k) =>
        k.addEventListener("click", () => laai_staat(k.getAttribute("data-bs"))));
    }
    document.dispatchEvent(new CustomEvent("bs-gelaai", { detail: BS.state }));
  }

  async function laai_state() {
    try {
      const data = await vra("kry-bankstate");
      BS.state = Array.isArray(data.state) ? data.state : [];
    } catch (f) {
      console.error("Kon nie die bankstate laai nie:", f);
      BS.state = [];
    }
    teken_state();
  }
  window.bs_laai = async () => {
    await laai_state();
    if (BS.oop && !BS.state.some((s) => s.sleutel === BS.oop.sleutel)) maak_staat_toe();
  };

  async function laai_staat(sleutel) {
    try {
      const data = await vra("kry-bankstate?sleutel=" + encodeURIComponent(sleutel));
      maak_staat_oop(data.staat);
    } catch (f) {
      window.alert(String(f.message || f));
    }
  }

  /* ═══ een staat oop ═══ */

  function kat_naam(id) {
    const k = BS.kategoriee.find((x) => x.id === id);
    return k ? (k.pad || k.naam) : id;
  }

  function keuse(r, huidig) {
    const gekies = (v) => (v === huidig ? " selected" : "");
    const opsies = BS.kategoriee
      .filter((k) => (k.aktief !== false || k.id === huidig) && (k.rigting === "in" ? "in" : "uit") === r.rigting)
      .map((k) => `<option value="${ontsnap(k.id)}"${gekies(k.id)}>${ontsnap(k.pad || k.naam)}</option>`).join("");
    return `<select class="veld-invoer bs-kies${huidig ? " bs-kies-klaar" : ""}" data-nr="${r.nr}">
      ${huidig ? "" : `<option value="">${ontsnap(t("bs_kies_kat", "Kies kategorie \u2026"))}</option>`}
      ${opsies}
      <option value="${OORDRAG}"${gekies(OORDRAG)}>${ontsnap(t("bs_oordrag", "Oordrag tussen eie rekeninge"))}</option>
      <option value="${NUUT}">${ontsnap(t("bs_nuwe_kat", "+ Nuwe kategorie \u2026"))}</option>
    </select>`;
  }

  /* ═══ 'n nuwe kategorie binne die reel ═══
     Dieselfde patroon as "+ Nuwe kliënt" in die faktuurvorm: 'n register word
     aangevul waar dit nodig is, sonder om die blad te verlaat. Die rigting is
     die reel s'n en kan nie verkeerd gekies word nie; die register se eie
     stoor (stoor-fin-kategorie.js) doen al sy kontroles soos altyd. */
  function nuwe_kat_vorm(sel) {
    const nr = Number(sel.getAttribute("data-nr"));
    const r = BS.oop.reels.find((x) => x.nr === nr);
    const sel_td = sel.closest("td");
    const ouers = BS.kategoriee
      .filter((k) => k.aktief !== false && (k.rigting === "in" ? "in" : "uit") === r.rigting)
      .map((k) => `<option value="${ontsnap(k.id)}">${ontsnap(k.pad || k.naam)}</option>`).join("");
    sel_td.innerHTML = `<div class="bs-nk">
      <input type="text" class="veld-invoer bs-nk-naam" maxlength="120"
             placeholder="${ontsnap(r.rigting === "in" ? t("bs_nk_plek_in", "Naam van die inkomstekategorie") : t("bs_nk_plek_uit", "Naam van die uitgawekategorie"))}">
      <select class="veld-invoer bs-nk-onder">
        <option value="">${ontsnap(t("bs_nk_bo", "Op die boonste vlak"))}</option>${ouers}
      </select>
      <div class="bs-nk-knoppe">
        <button type="button" class="bs-bevestig bs-nk-skep">${ontsnap(t("bs_nk_skep", "Skep en wys toe"))}</button>
        <button type="button" class="bs-ontdoen bs-nk-weg">${ontsnap(t("bs_nk_kanselleer", "Kanselleer"))}</button>
      </div>
      <p class="bs-nk-fout" hidden></p>
    </div>`;
    const naam = sel_td.querySelector(".bs-nk-naam");
    naam.focus();
    sel_td.querySelector(".bs-nk-weg").addEventListener("click", teken_staat);
    const skep = async () => {
      const fout = sel_td.querySelector(".bs-nk-fout");
      const n = naam.value.trim();
      if (!n) {
        fout.textContent = t("bs_nk_naam_kort", "Die naam is verpligtend.");
        fout.hidden = false;
        return;
      }
      const onder = sel_td.querySelector(".bs-nk-onder").value;
      const knop = sel_td.querySelector(".bs-nk-skep");
      knop.disabled = true;
      try {
        const uit = await pos("stoor-fin-kategorie", { naam: n, onder, rigting: r.rigting });
        const k = uit.kategorie;
        const ouer = BS.kategoriee.find((x) => x.id === onder);
        k.pad = ouer ? `${ouer.pad || ouer.naam} / ${k.naam}` : k.naam;
        BS.kategoriee.push(k);
        BS.kategoriee.sort((a, b) => String(a.pad || a.naam).localeCompare(String(b.pad || b.naam), "af-ZA"));
        await wys_toe([{ nr, aksie: "kategorie", kategorie_id: k.id }], r.stand !== "toegewys" && r.stand !== "oordrag");
      } catch (f) {
        fout.textContent = String(f.message || f);
        fout.hidden = false;
        knop.disabled = false;
      }
    };
    sel_td.querySelector(".bs-nk-skep").addEventListener("click", skep);
    naam.addEventListener("keydown", (ev) => { if (ev.key === "Enter") skep(); if (ev.key === "Escape") teken_staat(); });
  }

  function stand_sel(r) {
    const ontdoen = `<button type="button" class="bs-ontdoen" data-ontdoen="${r.nr}">${ontsnap(t("bs_ontdoen", "Ontdoen"))}</button>`;
    switch (r.stand) {
      case "inligting":
        return `<span class="bs-stand info">${ontsnap(t("bs_st_info", "Inligting, word nie ingevoer nie"))}</span>`;
      case "gepas":
        return `<span class="bs-stand voorstel">${ontsnap(r.pas && r.pas.soort === "vereffening"
          ? t("bs_st_paystack", "Verklaar deur Paystack")
          : t("bs_st_joernaal", "Reeds in die joernaal"))}</span> ${ontdoen}`;
      // 'n Toegewysde reel hou sy keuselys, met die huidige keuse gekies: 'n
      // ander keuse vervang die inskrywing in een stap.
      case "toegewys":
        return `${keuse(r, r.kategorie_id)} ${ontdoen}`;
      case "oordrag":
        return `${keuse(r, OORDRAG)} ${ontdoen}`;
      case "voorstel":
        if (r.voorstel_kategorie) {
          const naam = r.voorstel_kategorie === "oordrag"
            ? t("bs_oordrag", "Oordrag tussen eie rekeninge") : kat_naam(r.voorstel_kategorie);
          return `<span class="bs-stand oop">${ontsnap(t("bs_st_voorstel", "Voorstel:"))} ${ontsnap(naam)}</span>
            <button type="button" class="bs-bevestig" data-bevestig="${r.nr}" aria-label="${ontsnap(t("bs_bevestig", "Bevestig"))}">&#10003;</button>
            ${keuse(r)}`;
        }
        return `<span class="bs-stand oop">${ontsnap(t("bs_bk_naam", "Bankkoste"))} ${ontsnap(t("bs_bk_bestaan_nie", "(kategorie bestaan nog nie)"))}</span> ${keuse(r)}`;
      default:
        return keuse(r);
    }
  }

  function teken_staat() {
    const plek = document.getElementById("bs-staat");
    const s = BS.oop;
    if (!plek) return;
    if (!s) { plek.innerHTML = ""; return; }

    const tel = { oop: 0, voorstel: 0, gepas: 0, toegewys: 0, oordrag: 0, inligting: 0 };
    s.reels.forEach((r) => { tel[r.stand] = (tel[r.stand] || 0) + 1; });
    const voorstelle = s.reels.filter((r) => r.stand === "voorstel" && r.voorstel_kategorie).length;
    const wys = BS.net_oop ? s.reels.filter((r) => r.stand === "oop" || r.stand === "voorstel") : s.reels;

    plek.innerHTML = `
      <div class="bs-staat-kop">
        <div><b>${ontsnap(s.bank)} \u2026${ontsnap(s.rekening4)}</b> \u00b7 ${datum(s.van)} ${ontsnap(t("bs_tot", "tot"))} ${datum(s.tot)}
          ${s.toets ? `<span class="fk-merkie">${ontsnap(t("bs_toets", "Toets"))}</span>` : ""}
          <div class="bs-staat-tel">${tel_merkies(tel)}</div></div>
        <div class="bs-staat-knoppe">
          ${voorstelle ? `<button type="button" class="kaart-aksie" id="bs-al-voorstelle">${ontsnap(
            t("bs_al_voorstelle", "Bevestig al {n} voorstelle").replace("{n}", voorstelle))}</button>` : ""}
          <button type="button" class="kaart-aksie wi-stil" id="bs-maak-toe">${ontsnap(t("bs_maak_toe", "Maak toe"))}</button>
        </div>
      </div>
      ${BS.melding ? `<p class="bs-melding">${ontsnap(BS.melding)}</p>` : ""}
      <label class="wi-merk bs-filter"><input type="checkbox" id="bs-net-oop"${BS.net_oop ? " checked" : ""}>
        <span>${ontsnap(t("bs_net_oop", "Wys net reels wat nog verklaar moet word"))}</span></label>
      <div class="bs-tabel-hou">
        <table class="jn-tabel bs-tabel">
          <thead><tr>
            <th class="jn-w-dat">${ontsnap(t("bs_h_datum", "Datum"))}</th>
            <th>${ontsnap(t("bs_h_beskr", "Beskrywing"))}</th>
            <th class="n bs-w-bed">${ontsnap(t("bs_h_in", "In"))}</th>
            <th class="n bs-w-bed">${ontsnap(t("bs_h_uit", "Uit"))}</th>
            <th class="bs-w-toe">${ontsnap(t("bs_h_stand", "Stand"))}</th>
          </tr></thead>
          <tbody>${wys.map((r) => `
            <tr class="${r.stand === "inligting" ? "bs-info" : ""}">
              <td>${datum(r.datum)}</td>
              <td><span class="bs-beskr">${ontsnap(r.beskrywing || "\u2014")}</span>${
                r.verwysing ? `<span class="bs-verw">${ontsnap(r.verwysing)}</span>` : ""}</td>
              <td class="n">${r.rigting === "in" && r.stand !== "inligting" ? rand(r.bedrag_sent) : ""}</td>
              <td class="n bs-uit">${r.rigting === "uit" && r.stand !== "inligting" ? rand(r.bedrag_sent) : ""}</td>
              <td class="bs-toe">${stand_sel(r)}</td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
      <div class="bs-skrap-ry">
        <button type="button" class="fp-skrap" id="bs-skrap-staat">${ontsnap(t("bs_skrap_staat", "Skrap hierdie staat"))}</button>
      </div>`;

    plek.querySelectorAll(".bs-kies").forEach((k) => k.addEventListener("change", () => {
      const nr = Number(k.getAttribute("data-nr"));
      if (!k.value) return;
      if (k.value === NUUT) { nuwe_kat_vorm(k); return; }
      wys_toe([k.value === OORDRAG ? { nr, aksie: "oordrag" } : { nr, aksie: "kategorie", kategorie_id: k.value }], true);
    }));
    plek.querySelectorAll("[data-bevestig]").forEach((k) => k.addEventListener("click", () => {
      const r = s.reels.find((x) => x.nr === Number(k.getAttribute("data-bevestig")));
      wys_toe([opdrag_vir_voorstel(r)]);
    }));
    plek.querySelectorAll("[data-ontdoen]").forEach((k) => k.addEventListener("click", () =>
      wys_toe([{ nr: Number(k.getAttribute("data-ontdoen")), aksie: "ontdoen" }])));
    const al = document.getElementById("bs-al-voorstelle");
    if (al) al.addEventListener("click", () =>
      wys_toe(s.reels.filter((r) => r.stand === "voorstel" && r.voorstel_kategorie).map(opdrag_vir_voorstel)));
    document.getElementById("bs-net-oop").addEventListener("change", (ev) => {
      BS.net_oop = ev.target.checked;
      teken_staat();
    });
    document.getElementById("bs-maak-toe").addEventListener("click", maak_staat_toe);
    document.getElementById("bs-skrap-staat").addEventListener("click", skrap_staat);
  }

  function opdrag_vir_voorstel(r) {
    return r.voorstel_kategorie === "oordrag"
      ? { nr: r.nr, aksie: "oordrag" }
      : { nr: r.nr, aksie: "kategorie", kategorie_id: r.voorstel_kategorie };
  }

  async function wys_toe(reels, soortgelyk) {
    if (!BS.oop || !reels.length) return;
    try {
      const uit = await pos("wys-bankreel-toe", { sleutel: BS.oop.sleutel, reels, soortgelyk: soortgelyk === true });
      BS.oop = uit.staat;
      BS.melding = uit.ekstra
        ? t("bs_soortgelyk", "Ook {n} soortgelyke reël(s) het dieselfde kategorie gekry.").replace("{n}", uit.ekstra)
        : "";
      const i = BS.state.findIndex((x) => x.sleutel === uit.staat.sleutel);
      if (i >= 0) {
        const tel = { oop: 0, voorstel: 0, gepas: 0, toegewys: 0, oordrag: 0, inligting: 0 };
        uit.staat.reels.forEach((r) => { tel[r.stand] = (tel[r.stand] || 0) + 1; });
        BS.state[i].tel = tel;
        teken_state();
      }
    } catch (f) {
      window.alert(String(f.message || f));
    }
    teken_staat();
  }

  function maak_staat_oop(staat) {
    BS.oop = staat;
    BS.melding = "";
    teken_staat();
    const plek = document.getElementById("bs-staat");
    if (plek && plek.scrollIntoView) plek.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function maak_staat_toe() {
    BS.oop = null;
    teken_staat();
  }

  async function skrap_staat() {
    const s = BS.oop;
    if (!s) return;
    const woorde = window.prompt(t("bs_skrap_vra",
      "Die staat en die joernaalinskrywings wat uit sy reels geskep is, word uitgevee. Tik SKRAP STAAT om te bevestig."));
    if (woorde == null) return;
    try {
      await pos("skrap-bankstaat", { sleutel: s.sleutel, woorde: woorde.trim() });
      maak_staat_toe();
      await laai_state();
    } catch (f) {
      window.alert(String(f.message || f));
    }
  }

  async function verwerk(lêer) {
    const plek = document.getElementById("bs-uitslag");
    if (!lêer) return;
    if (!/\.pdf$/i.test(lêer.name) && lêer.type !== "application/pdf") {
      plek.innerHTML = `<p class="bs-foutboodskap">${ontsnap(t("bs_net_pdf", "Kies 'n PDF-staat."))}</p>`;
      return;
    }
    plek.innerHTML = `<p class="stelsel-boodskap">${ontsnap(t("bs_lees", "Die staat word gelees …"))}</p>`;
    try {
      const bladsye = await lees_items(lêer);
      BS.resultaat = window.BankstaatFNB.lees(bladsye);
    } catch (fout) {
      console.error("Kon nie die staat lees nie:", fout);
      BS.resultaat = { ok: false, fout: t("bs_lees_fout", "Kon nie die PDF lees nie.") + " " + (fout.message || "") };
    }
    teken();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const invoer = document.getElementById("bs-leer");
    if (!invoer) return;

    let sessie = null;
    try { sessie = await identiteit_kry_huidige_sessie(); } catch { sessie = null; }
    if (!sessie || !identiteit_het_rol(sessie.gebruiker, "boekhouding")) return;

    invoer.addEventListener("change", () => {
      verwerk(invoer.files && invoer.files[0]);
      invoer.value = "";   // dieselfde lêer kan weer gekies word
    });

    try {
      const data = await vra("kry-fin-kategoriee");
      BS.kategoriee = Array.isArray(data.kategoriee) ? data.kategoriee : [];
    } catch (fout) {
      console.error("Kon nie die kategoriee laai nie:", fout);
    }
    await laai_state();
  });
})();
