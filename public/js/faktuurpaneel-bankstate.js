// public/js/faktuurpaneel-bankstate.js
//
// Die Bankstate-pil, eerste deel: 'n FNB-staat oplaai, lees, die drie kontroles
// wys en die reels voorskou. NIKS WORD GESTOOR NIE. Die invoer in die boeke
// kom in 'n volgende stap, wanneer die lees self vertrou word.
//
// DIE PDF VERLAAT NOOIT DIE REKENAAR NIE. pdf.js lees dit in die blaaier;
// bankstaat-fnb.js haal die reels uit. Net wat later ingevoer word, sal na die
// bediener gaan, en dit is net datum, beskrywing, bedrag en saldo.
//
// pdf.js WORD LUI GELAAI, eers wanneer 'n staat gekies word, en dieselfde
// weergawe as die paneelbord (2.6.347). Niemand wat nooit 'n staat oplaai nie,
// laai 'n megagreep JavaScript nie.

(function () {
  "use strict";

  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/";
  const BS = { kategoriee: [], resultaat: null };

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

  async function vra(naam) {
    const resp = await fetch("/.netlify/functions/" + naam, { headers: await identiteit_kop() });
    if (!resp.ok) throw new Error(await resp.text().catch(() => String(resp.status)));
    return resp.json();
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
      <p class="bs-nota">${ontsnap(t("bs_niks_gestoor", "Niks is gestoor nie. Die staat is net in die blaaier gelees."))}</p>`;
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
  });
})();
