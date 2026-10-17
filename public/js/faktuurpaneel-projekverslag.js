// public/js/faktuurpaneel-projekverslag.js
// Weergawe 1 (17 Oktober 2026).
//
// DIE PROJEKVERSLAG: al die projekte van een boekjaar langs mekaar, onder
// State. Klik op 'n ry om daardie projek se projekkaart oop te maak.
//
// GEEN NUWE FUNCTION VIR DIE SYFERS NIE, dieselfde rede as die staat en die
// projekkaart: dit tel op wat kry-joernaal.js vir die boekjaar gee, op
// `projek_id`. Wat op die joernaal staan, staan hier.
//
// WATTER PROJEKTE. Elke projek met geld in die boekjaar, plus 'n aktiewe
// projek wie se tydperk in die boekjaar val, sodat 'n nuwe projek sonder geld
// nog nie onsigbaar is nie.
//
// DIE KOLOMME
//   Ontvang           wat in die boekjaar op die projek inkom
//   Projekkoste       wat in die boekjaar op die projek uitgaan
//   Oor na projekkoste  die verskil
//   Bydrae            Oor as persentasie van Ontvang: wat by Future Sharp bly.
//                     Nie by 'n toelae nie, want daar is die oorblywende geld
//                     beperk tot die projek en dus nie 'n bydrae nie.
//   Uitstaande        wat 'n kliënt nog skuld, en vergoeding wat nog uitbetaal
//                     moet word
//
// Die PDF kry die klaar rye in window.PV_PDF_VRAG en teken hulle net
// (kry-projekverslag-pdf.js), soos by die staat.
//
// Voorvoegsel `pv_`.

(function () {
  const PV = { jaar: null, projekte: [], joernaal: null, oop: false, gereed: false };

  function t(sleutel, verstek) {
    const uit = window.t ? window.t(sleutel) : null;
    return uit && uit !== sleutel ? uit : verstek;
  }
  function o(teks) {
    return String(teks == null ? "" : teks)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function rand(sent) {
    const n = Math.round(Math.abs(Number(sent) || 0));
    const heel = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return (sent < 0 ? "− " : "") + "R" + heel + "," + String(n % 100).padStart(2, "0");
  }
  async function vra(naam, vraag) {
    const resp = await fetch("/.netlify/functions/" + naam + (vraag ? "?" + vraag : ""),
      { headers: await identiteit_kop() });
    if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
    return resp.json();
  }
  function boekjaar_van(iso) {
    const j = Number(iso.slice(0, 4));
    return Number(iso.slice(5, 7)) >= 3 ? j : j - 1;
  }
  function grense(jaar) {
    const tot = new Date(Date.UTC(jaar + 1, 2, 0)).toISOString().slice(0, 10); // laaste dag van Februarie
    return { van: `${jaar}-03-01`, tot };
  }
  function pct(deel, geheel) {
    return geheel > 0 ? Math.round((deel / geheel) * 100) : null;
  }

  const GROEPE = [
    ["fooie", "pj_fin_fooie", "Fooie vir dienste"],
    ["toelae", "pv_toelae", "Toelaes en skenkings"],
    ["borgskap", "pv_borgskap", "Borgskappe"],
  ];
  const INST = {
    skole: ["pj_inst_skole", "Skole"],
    ouers: ["pj_inst_ouers", "Ouers en individue"],
    hoer: ["pj_inst_hoer", "Hoër onderwys"],
    korporatief: ["pj_inst_korporatief", "Korporatief"],
  };

  /* ═══ die optelling ═══ */

  function bereken() {
    const { van, tot } = grense(PV.jaar);
    const j = PV.joernaal || {};
    const per = new Map();
    const kry = (id) => {
      if (!per.has(id)) per.set(id, { ontvang: 0, koste: 0, vergoeding: 0, skuld: 0, verskuldig: 0, beweging: false });
      return per.get(id);
    };
    (j.inskrywings || []).forEach((r) => {
      if (!r.projek_id) return;
      const x = kry(r.projek_id);
      const sent = Number(r.bedrag_sent) || 0;
      x.beweging = true;
      if (r.rigting === "in") x.ontvang += sent;
      else { x.koste += sent; if (r.bron === "uitbetaling") x.vergoeding += sent; }
    });
    (j.debiteure || []).forEach((d) => { if (d.projek_id) { const x = kry(d.projek_id); x.skuld += Number(d.bedrag_sent) || 0; x.beweging = true; } });
    (j.krediteure || []).forEach((k) => { if (k.projek_id) { const x = kry(k.projek_id); x.verskuldig += Number(k.bedrag_sent) || 0; x.beweging = true; } });

    const oorvleuel = (p) => p.aktief !== false && (p.van || p.tot) &&
      (!p.van || p.van <= tot) && (!p.tot || p.tot >= van);

    const rye = PV.projekte
      .filter((p) => (per.get(p.id) || {}).beweging || oorvleuel(p))
      .map((p) => {
        const x = per.get(p.id) || { ontvang: 0, koste: 0, vergoeding: 0, skuld: 0, verskuldig: 0 };
        const fin = p.finansiering || "fooie";
        const oor = x.ontvang - x.koste;
        return { p, fin, ...x, oor, bydrae: fin === "toelae" ? null : pct(oor, x.ontvang) };
      })
      .sort((a, b) => String(a.p.nr || "~").localeCompare(String(b.p.nr || "~")) ||
        String(a.p.naam).localeCompare(String(b.p.naam), "af-ZA"));

    const som = (lys, v) => lys.reduce((a, r) => a + r[v], 0);
    const groepe = GROEPE.map(([id, sl, verstek]) => {
      const lys = rye.filter((r) => r.fin === id);
      return { id, titel: t(sl, verstek), rye: lys,
        ontvang: som(lys, "ontvang"), koste: som(lys, "koste"), oor: som(lys, "oor") };
    }).filter((g) => g.rye.length);
    return {
      van, tot, rye, groepe,
      ontvang: som(rye, "ontvang"), koste: som(rye, "koste"),
      vergoeding: som(rye, "vergoeding"), oor: som(rye, "oor"),
      aktief: rye.filter((r) => r.p.aktief !== false).length,
    };
  }

  /* ═══ die teken ═══ */

  function uitstaande_teks(r) {
    const dele = [];
    if (r.skuld) dele.push(t("pv_skuld", "{r} by die kliënt").replace("{r}", rand(r.skuld)));
    if (r.verskuldig) dele.push(t("pv_verskuldig", "{r} vergoeding nog uit te betaal").replace("{r}", rand(r.verskuldig)));
    return dele.join("; ");
  }
  function besonder(r) {
    const p = r.p;
    return [p.vir_wie_naam || "", p.aktief === false ? t("pj_onaktief", "Onaktief") : ""]
      .filter(Boolean).join(" · ");
  }

  function teken() {
    const plek = document.getElementById("pv-verslag");
    if (!plek) return;
    const s = bereken();
    const jaar_teks = `${PV.jaar}/${String(PV.jaar + 1).slice(2)}`;

    if (!s.rye.length) {
      plek.innerHTML = `<p class="stelsel-boodskap">${o(t("pv_leeg",
        "Geen projek het geld in hierdie boekjaar nie. Kies 'n projek op 'n faktuur, of by 'n banktransaksie wat reeds 'n kategorie het."))}</p>`;
      window.PV_PDF_VRAG = null;
      return;
    }

    const teel = (e, b, k) => `<div class="pv-teel"><span>${o(e)}</span><b>${b}</b>${k ? `<small>${o(k)}</small>` : ""}</div>`;
    const ry = (r) => {
      const inst = INST[r.p.instansie];
      const u = uitstaande_teks(r);
      return `<tr class="pv-ry" data-pv="${o(r.p.id)}" title="${o(t("pv_klik", "Klik om die projekkaart oop te maak"))}">
        <td class="pv-nr">${o(r.p.nr || "")}</td>
        <td>${o(r.p.naam)}${besonder(r) ? `<div class="pv-klein">${o(besonder(r))}</div>` : ""}</td>
        <td>${inst ? o(t(inst[0], inst[1])) : ""}</td>
        <td class="n">${rand(r.ontvang)}</td>
        <td class="n">${rand(r.koste)}</td>
        <td class="n">${rand(r.oor)}${r.fin === "toelae" && r.oor > 0 ? `<div class="pv-klein pv-let">${o(t("pv_nog_bestee", "nog te bestee"))}</div>` : ""}</td>
        <td class="n">${r.bydrae == null ? "–" : r.bydrae + "%"}</td>
        <td class="pv-klein${u ? " pv-let" : ""}">${o(u || t("pv_niks", "niks"))}</td>
      </tr>`;
    };

    plek.innerHTML = `
      <div class="pv-teels">
        ${teel(t("pv_t_projekte", "Projekte"), String(s.rye.length),
          t("pv_t_aktief", "{n} aktief").replace("{n}", s.aktief))}
        ${teel(t("pk_ontvang", "Ontvang"), rand(s.ontvang), t("pv_t_op_projekte", "op projekte"))}
        ${teel(t("pk_koste", "Projekkoste"), rand(s.koste),
          t("pv_t_vergoeding", "waarvan {r} vergoeding").replace("{r}", rand(s.vergoeding)))}
        ${teel(t("pk_oor", "Oor ná projekkoste"), rand(s.oor), t("pv_t_bedryf", "beskikbaar vir bedryfskoste"))}
      </div>
      <div class="pv-tabel"><table>
        <thead><tr>
          <th>${o(t("pv_h_nr", "Nr"))}</th><th>${o(t("pv_h_projek", "Projek"))}</th><th>${o(t("pj_veld_instansie", "Instansie"))}</th>
          <th class="n">${o(t("pk_ontvang", "Ontvang"))}</th><th class="n">${o(t("pk_koste", "Projekkoste"))}</th>
          <th class="n">${o(t("pk_oor", "Oor ná projekkoste"))}</th><th class="n">${o(t("pv_h_bydrae", "Bydrae"))}</th>
          <th>${o(t("pv_h_uitstaande", "Uitstaande"))}</th>
        </tr></thead>
        <tbody>
          ${s.groepe.map((g) => `
            <tr class="pv-groep"><td colspan="8">${o(g.titel)}</td></tr>
            ${g.rye.map(ry).join("")}
            ${s.groepe.length > 1 && g.rye.length > 1 ? `<tr class="pv-sub"><td></td><td>${o(t("pv_subtotaal", "Subtotaal"))}</td><td></td>
              <td class="n">${rand(g.ontvang)}</td><td class="n">${rand(g.koste)}</td><td class="n">${rand(g.oor)}</td>
              <td class="n">${g.id === "toelae" ? "–" : (pct(g.oor, g.ontvang) == null ? "" : pct(g.oor, g.ontvang) + "%")}</td><td></td></tr>` : ""}`).join("")}
          <tr class="pv-tot"><td></td><td>${o(t("pv_totaal", "Totaal"))}</td><td></td>
            <td class="n">${rand(s.ontvang)}</td><td class="n">${rand(s.koste)}</td><td class="n">${rand(s.oor)}</td><td></td><td></td></tr>
        </tbody>
      </table></div>`;

    plek.querySelectorAll("[data-pv]").forEach((tr) => tr.addEventListener("click", () => {
      const p = PV.projekte.find((x) => x.id === tr.getAttribute("data-pv"));
      if (p && typeof window.pk_maak_oop === "function") window.pk_maak_oop(p);
    }));

    // Die PDF se vrag, uit dieselfde syfers as die skerm.
    const vrag_ry = (r) => {
      const inst = INST[r.p.instansie];
      return {
        nr: r.p.nr || "", naam: r.p.naam, besonder: besonder(r),
        instansie: inst ? t(inst[0], inst[1]) : "",
        ontvang_sent: r.ontvang, koste_sent: r.koste, oor_sent: r.oor,
        bydrae: r.bydrae == null ? "–" : r.bydrae + "%",
        nog_bestee: r.fin === "toelae" && r.oor > 0,
        uitstaande: uitstaande_teks(r),
      };
    };
    window.PV_PDF_VRAG = {
      boekjaar: jaar_teks, van: s.van, tot: s.tot,
      teels: { projekte: s.rye.length, aktief: s.aktief, ontvang_sent: s.ontvang, koste_sent: s.koste, vergoeding_sent: s.vergoeding, oor_sent: s.oor },
      groepe: s.groepe.map((g) => ({
        titel: g.titel, rye: g.rye.map(vrag_ry),
        sub: s.groepe.length > 1 && g.rye.length > 1
          ? { ontvang_sent: g.ontvang, koste_sent: g.koste, oor_sent: g.oor } : null,
      })),
      totaal: { ontvang_sent: s.ontvang, koste_sent: s.koste, oor_sent: s.oor },
    };
  }

  /* ═══ laai ═══ */

  async function laai(jaar) {
    PV.jaar = jaar;
    const plek = document.getElementById("pv-verslag");
    plek.innerHTML = `<p class="stelsel-boodskap">${o(t("fp_laai", "Word gelaai …"))}</p>`;
    const { van, tot } = grense(jaar);
    try {
      const [jn, pj] = await Promise.all([
        vra("kry-joernaal", `van=${van}&tot=${tot}`),
        vra("kry-projekte"),
      ]);
      PV.joernaal = jn;
      PV.projekte = Array.isArray(pj.projekte) ? pj.projekte : [];
    } catch (fout) {
      console.error("Kon nie die projekverslag laai nie:", fout);
      plek.innerHTML = `<p class="stelsel-boodskap">${o(t("pv_laai_fout", "Kon nie die projekverslag laai nie."))}</p>`;
      return;
    }
    teken();
  }

  async function laai_pdf() {
    const knop = document.getElementById("pv-pdf");
    const vrag = window.PV_PDF_VRAG;
    if (!vrag) { window.alert(t("pv_pdf_geen", "Daar is geen projekte in hierdie boekjaar nie.")); return; }
    const ou = knop.textContent;
    knop.disabled = true;
    knop.textContent = t("ms_pdf_besig", "Word gebou …");
    try {
      const resp = await fetch("/.netlify/functions/kry-projekverslag-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await identiteit_kop()) },
        body: JSON.stringify(vrag),
      });
      if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
      const uit = await resp.json();
      const grepe = Uint8Array.from(atob(uit.pdf), (c) => c.charCodeAt(0));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([grepe], { type: "application/pdf" }));
      a.download = uit.naam || "projekverslag.pdf";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (fout) {
      console.error("Kon nie die projekverslag as PDF bou nie:", fout);
      window.alert(t("ms_pdf_fout", "Kon nie die PDF bou nie.") + " " + (fout.message || ""));
    } finally {
      knop.disabled = false;
      knop.textContent = ou;
    }
  }

  // Die verslag laai eers wanneer sy oortjie die eerste keer oopgaan.
  // Gaan die oortjie oop voordat die boekjare ingevul is, laai dit aan die
  // einde van die opstel.
  document.addEventListener("st-aansig", (e) => {
    PV.oop = e.detail === "projekte";
    if (PV.oop && PV.gereed && PV.jaar === null) laai(Number(document.getElementById("pv-jaar").value));
  });

  document.addEventListener("DOMContentLoaded", async () => {
    const kies = document.getElementById("pv-jaar");
    if (!kies) return;
    let sessie = null;
    try { sessie = await identiteit_kry_huidige_sessie(); } catch { sessie = null; }
    if (!sessie || !identiteit_het_rol(sessie.gebruiker, "boekhouding")) return;

    const huidig = boekjaar_van(new Date().toISOString().slice(0, 10));
    for (let j = huidig; j >= 2024; j--) {
      const op = document.createElement("option");
      op.value = j;
      op.textContent = `${j}/${String(j + 1).slice(2)}`;
      kies.appendChild(op);
    }
    kies.addEventListener("change", () => laai(Number(kies.value)));
    document.getElementById("pv-pdf").addEventListener("click", laai_pdf);
    PV.gereed = true;
    if (PV.oop && PV.jaar === null) laai(Number(kies.value));
  });

  window.pv_herlaai = () => { if (PV.jaar !== null) laai(PV.jaar); };
})();
