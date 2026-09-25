// public/js/faktuurpaneel-maandopsomming.js
// Weergawe 2 (25 September 2026).
//
// Die Bankstate-pil se tweede aansig: die maandopsomming vir een boekjaar, en
// die werkboek vir die rekenmeester.
//
// TWEE BRONNE, NAAS MEKAAR, NOOIT DEURMEKAAR NIE
//
//   Die bank     kry-bankmaande: per kalendermaand die opening, in, uit en
//                sluit uit die ingevoerde state, en hoeveel reels nog oop is.
//   Die joernaal kry-joernaal: dieselfde lys wat die Joernaal-pil en die
//                finansiele staat gebruik, per maand opgetel.
//
// DIE VERSKIL WORD GEWYS, NIE WEGGEPRAAT NIE. Die joernaal boek Paystack-geld
// op die dag van die transaksie; die bank sien dit eers by die vereffening, 'n
// dag of twee later. Oor 'n maandgrens is daar dus 'n verskil wat normaal is.
// Net so 'n betaling uit eie sak, wat in die joernaal staan maar nooit deur die
// bank geloop het nie. Die verskil word per maand gewys, en die werkboek lys
// die joernaalinskrywings wat nie aan 'n bankreel gekoppel is nie, sodat 'n
// mens elke rand van die verskil kan naspeur.
//
// INSKRYWINGS UIT 'N TOETSSTAAT TEL NIE. Hul bankverwysing begin met B-T; hulle
// word uitgesluit en die skerm se hoeveel.
//
// DIE WERKBOEK LEEN DIE JOERNAAL SE GEREEDSKAP. ExcelJS laai en die leer
// aflaai gebeur deur jn_laai_exceljs() en jn_stuur_af() uit
// faktuurpaneel-joernaal.js, wat voor hierdie leer gelaai word. Een plek wat
// skrips van buite haal en leers aflaai, eerder as twee afskrifte daarvan.

(function () {
  "use strict";

  const GELD = '"R"\\ #,##0.00;[Red]"-R"\\ #,##0.00';
  const MS = { jaar: null, bank: null, joernaal: null, kategoriee: [] };

  function t(sleutel, verstek) {
    const uit = window.t ? window.t(sleutel) : null;
    return uit && uit !== sleutel ? uit : verstek;
  }
  function ontsnap(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function rand(sent) {
    if (sent == null) return "\u2014";
    const n = Math.round(Math.abs(Number(sent) || 0));
    const heel = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
    return (sent < 0 ? "\u2212" : "") + "R" + heel + "," + String(n % 100).padStart(2, "0");
  }
  function saldo(sent) {
    if (sent == null) return "\u2014";
    return rand(Math.abs(sent)) + (sent < 0 ? " Dr" : sent > 0 ? " Cr" : "");
  }
  async function vra(pad) {
    const resp = await fetch("/.netlify/functions/" + pad, { headers: await identiteit_kop() });
    if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
    return resp.json();
  }

  const MAANDE = ["Januarie", "Februarie", "Maart", "April", "Mei", "Junie", "Julie",
    "Augustus", "September", "Oktober", "November", "Desember"];
  function maand_naam(mm) {
    const [j, m] = mm.split("-").map(Number);
    return `${t("ms_m" + m, MAANDE[m - 1])} ${j}`;
  }
  function boekjaar_van(datum) {
    const [j, m] = String(datum).split("-").map(Number);
    return m >= 3 ? j : j - 1;
  }
  function is_toets(r) {
    return String(r.bankreel || "").startsWith("B-T");
  }
  function kat_pad(id) {
    const k = MS.kategoriee.find((x) => x.id === id);
    return k ? (k.pad || k.naam) : (id || "");
  }

  /* ═══ die berekening per maand ═══ */

  function joernaal_per_maand() {
    const per = {};
    (MS.joernaal.inskrywings || []).forEach((r) => {
      if (is_toets(r)) return;
      const mm = String(r.datum).slice(0, 7);
      per[mm] = per[mm] || { in: 0, uit: 0 };
      per[mm][r.rigting === "in" ? "in" : "uit"] += Number(r.bedrag_sent) || 0;
    });
    return per;
  }

  function rye() {
    const jn = joernaal_per_maand();
    return MS.bank.maande.map((m) => {
      const j = jn[m.maand] || { in: 0, uit: 0 };
      const jnetto = j.in - j.uit;
      // Die bank se netto sonder wat nog oop is en sonder oordragte: dit is
      // die deel wat die joernaal behoort te verklaar.
      const verklaar = m.netto.gepas + m.netto.toegewys;
      return {
        ...m,
        j_in: j.in, j_uit: j.uit, j_netto: jnetto,
        verskil: m.gedek ? jnetto - verklaar : null,
      };
    });
  }

  function stand(r) {
    if (!r.gedek) return { klas: "info", teks: t("ms_geen_staat", "Geen staat") };
    if (r.gedek < r.dae) return { klas: "oop", teks: t("ms_gedeeltelik", "Gedeeltelik gedek") };
    if (r.oop_tel) return { klas: "leeg", teks: t("ms_oop", "{n} reëls oop").replace("{n}", r.oop_tel) };
    return { klas: "voorstel", teks: t("ms_klaar", "Klaar") };
  }

  /* ═══ die skerm ═══ */

  function teken() {
    const plek = document.getElementById("ms-tabel");
    if (!plek) return;
    if (!MS.bank) { plek.innerHTML = ""; return; }

    const r = rye();
    const toetse = (MS.joernaal.inskrywings || []).filter(is_toets).length;
    const som = (k) => r.reduce((a, x) => a + (Number(x[k]) || 0), 0);

    plek.innerHTML = `
      <div class="bs-tabel-hou">
        <table class="jn-tabel bs-tabel ms-tabel">
          <thead><tr>
            <th>${ontsnap(t("ms_h_maand", "Maand"))}</th>
            <th class="n">${ontsnap(t("ms_h_opening", "Opening"))}</th>
            <th class="n">${ontsnap(t("ms_h_in", "In"))}</th>
            <th class="n">${ontsnap(t("ms_h_uit", "Uit"))}</th>
            <th class="n">${ontsnap(t("ms_h_sluit", "Sluit"))}</th>
            <th class="n">${ontsnap(t("ms_h_joernaal", "Joernaal netto"))}</th>
            <th class="n">${ontsnap(t("ms_h_verskil", "Verskil"))}</th>
            <th>${ontsnap(t("ms_h_stand", "Stand"))}</th>
            <th></th>
          </tr></thead>
          <tbody>${r.map((x) => {
            const s = stand(x);
            return `<tr>
              <td>${ontsnap(maand_naam(x.maand))}</td>
              <td class="n">${saldo(x.opening_sent)}</td>
              <td class="n">${x.gedek ? rand(x.in_sent) : ""}</td>
              <td class="n bs-uit">${x.gedek ? rand(x.uit_sent) : ""}</td>
              <td class="n">${saldo(x.sluit_sent)}</td>
              <td class="n">${rand(x.j_netto)}</td>
              <td class="n${x.verskil ? " ms-verskil" : ""}">${x.verskil == null ? "" : rand(x.verskil)}</td>
              <td><span class="bs-stand ${s.klas}">${ontsnap(s.teks)}</span></td>
              <td><button type="button" class="bs-ontdoen" data-ms-maand="${x.maand}"
                   title="${ontsnap(t("ms_laai_maand", "Laai maand af"))}">${ontsnap(t("ms_xlsx", "Excel"))}</button></td>
            </tr>`;
          }).join("")}</tbody>
          <tfoot><tr>
            <td><b>${ontsnap(t("ms_totaal", "Boekjaar"))}</b></td><td></td>
            <td class="n"><b>${rand(som("in_sent"))}</b></td>
            <td class="n bs-uit"><b>${rand(som("uit_sent"))}</b></td><td></td>
            <td class="n"><b>${rand(som("j_netto"))}</b></td><td></td><td></td><td></td>
          </tr></tfoot>
        </table>
      </div>
      <p class="bs-nota">${ontsnap(t("ms_verskil_nota",
        "Verskil: die joernaal se netto min die bankreëls wat gepas of toegewys is. Paystack-geld wat oor 'n maandgrens oppad was, en betalings wat nie deur die bank geloop het nie, veroorsaak 'n verskil; die werkboek lys die joernaalinskrywings wat nie aan 'n bankreël gekoppel is nie."))}</p>
      ${toetse ? `<p class="bs-nota">${ontsnap(t("ms_toetse_uit", "{n} inskrywing(s) uit 'n toetsstaat is uitgesluit.").replace("{n}", toetse))}</p>` : ""}`;

    plek.querySelectorAll("[data-ms-maand]").forEach((k) =>
      k.addEventListener("click", () => werkboek(k.getAttribute("data-ms-maand"))));
  }

  async function laai(jaar) {
    const plek = document.getElementById("ms-tabel");
    MS.jaar = jaar;
    plek.innerHTML = `<p class="stelsel-boodskap">${ontsnap(t("fp_laai", "Word gelaai \u2026"))}</p>`;
    try {
      const bank = await vra("kry-bankmaande?jaar=" + jaar);
      const [joernaal, kats] = await Promise.all([
        vra(`kry-joernaal?van=${bank.van}&tot=${bank.tot}`),
        MS.kategoriee.length ? Promise.resolve(null) : vra("kry-fin-kategoriee"),
      ]);
      if (kats) MS.kategoriee = Array.isArray(kats.kategoriee) ? kats.kategoriee : [];
      MS.bank = bank;
      MS.joernaal = joernaal;
      teken();
    } catch (f) {
      console.error("Kon nie die maandopsomming laai nie:", f);
      plek.innerHTML = `<p class="bs-foutboodskap">${ontsnap(t("ms_laai_fout", "Kon nie die maandopsomming laai nie."))} ${ontsnap(f.message || "")}</p>`;
    }
  }

  /* ═══ die werkboek ═══ */

  function blad(wb, naam, titel, sub, koppe, wydtes) {
    const b = wb.addWorksheet(naam, { views: [{ state: "frozen", ySplit: 3 }] });
    b.addRow([titel]);
    b.addRow([sub]);
    b.getRow(1).font = { bold: true, size: 14 };
    b.getRow(2).font = { color: { argb: "FF6B6660" } };
    const kop = b.addRow(koppe);
    kop.font = { bold: true };
    kop.eachCell((s) => {
      s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEDE9" } };
      s.border = { bottom: { style: "thin", color: { argb: "FFB8B2A8" } } };
    });
    wydtes.forEach((w, i) => (b.getColumn(i + 1).width = w));
    return b;
  }

  function geld(ry, kolomme) {
    kolomme.forEach((k) => (ry.getCell(k).numFmt = GELD));
  }

  async function werkboek(maand) {
    if (!MS.bank) return;
    let ExcelJS;
    try {
      ExcelJS = await jn_laai_exceljs();
    } catch (f) {
      window.alert(String(f.message || f));
      return;
    }
    const alle = rye();
    const maande = maand ? alle.filter((x) => x.maand === maand) : alle;
    const van = maand ? `${maand}-01` : MS.bank.van;
    const tot = maand ? `${maand}-${String(maande[0].dae).padStart(2, "0")}` : MS.bank.tot;
    const in_tyd = (d) => d >= van && d <= tot;
    const tydperk = `${van} tot ${tot}`;

    const wb = new ExcelJS.Workbook();
    wb.creator = "Future Sharp";
    wb.created = new Date();

    // 1. Opsomming
    const b1 = blad(wb, "Opsomming", "Future Sharp NPC \u2014 Maandopsomming", tydperk,
      ["Maand", "Dekking (dae)", "Opening", "In", "Uit", "Sluit", "Reëls oop",
        "Joernaal in", "Joernaal uit", "Joernaal netto", "Verskil"],
      [18, 14, 16, 16, 16, 16, 11, 16, 16, 16, 16]);
    maande.forEach((x) => {
      const ry = b1.addRow([maand_naam(x.maand), `${x.gedek}/${x.dae}`,
        x.opening_sent == null ? null : x.opening_sent / 100, x.in_sent / 100, x.uit_sent / 100,
        x.sluit_sent == null ? null : x.sluit_sent / 100, x.oop_tel,
        x.j_in / 100, x.j_uit / 100, x.j_netto / 100, x.verskil == null ? null : x.verskil / 100]);
      geld(ry, [3, 4, 5, 6, 8, 9, 10, 11]);
    });
    b1.addRow([]);
    const nota = [
      "Opening en sluit is die banksaldo; 'n negatiewe bedrag is oortrokke.",
      "Verskil = die joernaal se netto min die bankreëls wat gepas of toegewys is.",
      "Paystack-geld wat oor 'n maandgrens oppad was, en betalings wat nie deur die bank geloop het nie, veroorsaak 'n verskil. Sien die blad 'Nie teen die bank gepas nie'.",
      "Die finansiële staat in die paneel bly die gesaghebbende staat per kategorie.",
    ];
    nota.forEach((n) => (b1.addRow([n]).font = { color: { argb: "FF6B6660" } }));

    // 2. Per kategorie (uit die joernaal)
    const jn = (MS.joernaal.inskrywings || []).filter((r) => !is_toets(r) && in_tyd(r.datum));
    const per_kat = new Map();
    jn.forEach((r) => {
      const dele = Array.isArray(r.dele) && r.dele.length
        ? r.dele.map((d) => ({ id: d.kategorie_id, sent: Number(d.sent != null ? d.sent : d.bedrag_sent) || 0 }))
        : [{ id: r.kategorie_id || (r.bron === "uitbetaling" ? "__uitbetaling" : ""), sent: Number(r.bedrag_sent) || 0 }];
      dele.forEach((d) => {
        const naam = d.id === "__uitbetaling" ? "Uitbetalings aan begunstigdes" : (kat_pad(d.id) || "Ongekategoriseer");
        const k = per_kat.get(naam) || { in: 0, uit: 0 };
        k[r.rigting === "in" ? "in" : "uit"] += d.sent;
        per_kat.set(naam, k);
      });
    });
    const b2 = blad(wb, "Per kategorie", "Inkomste en uitgawes per kategorie", tydperk,
      ["Kategorie", "In", "Uit"], [48, 16, 16]);
    [...per_kat.entries()].sort((a, b) => a[0].localeCompare(b[0], "af-ZA")).forEach(([naam, k]) => {
      geld(b2.addRow([naam, k.in / 100, k.uit / 100]), [2, 3]);
    });

    // 3. Kontantboek
    const b3 = blad(wb, "Kontantboek", "Kontantboek (die joernaal)", tydperk,
      ["Datum", "Beskrywing", "Kategorie", "Bron", "Bankreël", "In", "Uit"],
      [12, 46, 34, 12, 24, 14, 14]);
    jn.slice().sort((a, b) => String(a.datum).localeCompare(String(b.datum))).forEach((r) => {
      const b = Number(r.bedrag_sent) / 100;
      geld(b3.addRow([r.datum, r.beskrywing || "", kat_pad(r.kategorie_id), r.bron || "", r.bankreel || "",
        r.rigting === "in" ? b : null, r.rigting === "in" ? null : b]), [6, 7]);
    });

    // 4. Bankreels
    const breels = (MS.bank.reels || []).filter((r) => in_tyd(r.datum) && r.stand !== "inligting");
    const STAND = { oop: "Oop", voorstel: "Voorgestel", gepas: "Gepas", toegewys: "Toegewys", oordrag: "Oordrag" };
    const b4 = blad(wb, "Bankreëls", "Bankreëls uit die ingevoerde state", tydperk,
      ["Datum", "Beskrywing", "Verwysing", "In", "Uit", "Saldo", "Stand", "Verklaring"],
      [12, 40, 22, 14, 14, 16, 12, 36]);
    breels.forEach((r) => {
      const b = r.bedrag_sent / 100;
      const verklaar = r.stand === "gepas"
        ? (r.pas && r.pas.soort === "vereffening" ? "Paystack-vereffening" : "Bestaande joernaalinskrywing")
        : r.stand === "toegewys" ? kat_pad(r.kategorie_id)
        : r.stand === "oordrag" ? "Oordrag tussen eie rekeninge" : "";
      geld(b4.addRow([r.datum, r.beskrywing, r.verwysing || "", r.rigting === "in" ? b : null,
        r.rigting === "in" ? null : b, r.saldo_sent / 100, STAND[r.stand] || r.stand, verklaar]), [4, 5, 6]);
    });

    // 5. Joernaal wat nie aan 'n bankreel gekoppel is nie
    const gepas = new Set((MS.bank.reels || [])
      .filter((r) => r.stand === "gepas" && r.pas && r.pas.soort === "joernaal").map((r) => r.pas.ref));
    const los = jn.filter((r) => r.bron !== "bank" && !(r.sleutel && gepas.has(r.sleutel)));
    const b5 = blad(wb, "Nie teen die bank gepas nie",
      "Joernaalinskrywings sonder 'n bankreël",
      "Paystack-inkomste word as vereffening gepas, nie per inskrywing nie; betalings uit eie sak loop nie deur die bank nie.",
      ["Datum", "Beskrywing", "Kategorie", "Bron", "In", "Uit"], [12, 46, 34, 12, 14, 14]);
    los.slice().sort((a, b) => String(a.datum).localeCompare(String(b.datum))).forEach((r) => {
      const b = Number(r.bedrag_sent) / 100;
      geld(b5.addRow([r.datum, r.beskrywing || "", kat_pad(r.kategorie_id), r.bron || "",
        r.rigting === "in" ? b : null, r.rigting === "in" ? null : b]), [5, 6]);
    });

    // 6. Debiteure en krediteure (uit die joernaal)
    const b6 = blad(wb, "Debiteure en krediteure", "Uitstaande aan die einde van die tydperk", tydperk,
      ["Soort", "Datum", "Nommer", "Wie", "Bedrag"], [12, 12, 14, 36, 16]);
    (MS.joernaal.debiteure || []).filter((d) => d.datum <= tot).forEach((d) =>
      geld(b6.addRow(["Debiteur", d.datum, d.nommer || "", d.klient || "", Number(d.bedrag_sent) / 100]), [5]));
    (MS.joernaal.krediteure || []).filter((d) => d.datum <= tot).forEach((d) =>
      geld(b6.addRow(["Krediteur", d.datum, d.nommer || "", d.ontvanger || "", Number(d.bedrag_sent) / 100]), [5]));

    const buf = await wb.xlsx.writeBuffer();
    const naam = maand
      ? `Future-Sharp-Maandopsomming-${maand}.xlsx`
      : `Future-Sharp-Boekjaar-${MS.bank.jaar}-${String(MS.bank.jaar + 1).slice(2)}.xlsx`;
    jn_stuur_af(new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }), naam);
  }

  /* ═══ die aansig ═══ */

  function wissel(aansig) {
    document.querySelectorAll("[data-bs-aansig]").forEach((k) =>
      k.classList.toggle("aan", k.getAttribute("data-bs-aansig") === aansig));
    document.getElementById("bs-aansig-reels").hidden = aansig !== "reels";
    document.getElementById("bs-aansig-maande").hidden = aansig !== "maande";
    if (aansig === "maande" && !MS.bank) laai(Number(document.getElementById("ms-jaar").value));
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.getElementById("ms-tabel")) return;
    let sessie = null;
    try { sessie = await identiteit_kry_huidige_sessie(); } catch { sessie = null; }
    if (!sessie || !identiteit_het_rol(sessie.gebruiker, "boekhouding")) return;

    // Die boekjare: vanaf die rekening se eerste jaar tot die huidige. Die
    // verstek is die jaar van die jongste regte staat, anders die huidige.
    const vandag = new Date().toISOString().slice(0, 10);
    const huidig = boekjaar_van(vandag);
    let verstek = huidig;
    try {
      const data = await vra("kry-bankstate");
      const regte = (data.state || []).filter((s) => !s.toets);
      if (regte.length) verstek = boekjaar_van(regte[0].tot);
    } catch { /* die verstek bly die huidige jaar */ }
    const kies = document.getElementById("ms-jaar");
    for (let j = huidig; j >= 2024; j--) {
      const o = document.createElement("option");
      o.value = j;
      o.textContent = `${j}/${String(j + 1).slice(2)}`;
      if (j === verstek) o.selected = true;
      kies.appendChild(o);
    }
    kies.addEventListener("change", () => laai(Number(kies.value)));
    document.getElementById("ms-boekjaar-af").addEventListener("click", () => werkboek(null));
    document.querySelectorAll("[data-bs-aansig]").forEach((k) =>
      k.addEventListener("click", () => wissel(k.getAttribute("data-bs-aansig"))));
    // 'n Toewysing verander die syfers; laai weer wanneer die aansig oopgaan.
    document.addEventListener("bs-gelaai", () => { MS.bank = null; });
  });
})();
