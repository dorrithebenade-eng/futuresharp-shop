// public/js/grootboek-act.js
// Weergawe 1 (16 Oktober 2026).
//
// Lees die rekenmeester se "GL Detailed Ledger" (ACT Solutions, as PDF) uit
// die teksitems wat pdf.js gee.
//
// 'N SUIWER FUNKSIE, soos bankstaat-fnb.js: per bladsy 'n lys items
// { s, x, y, w } in, 'n resultaat uit. Dit weet niks van die skerm nie en kan
// in Node teen 'n werklike grootboek getoets word.
//
// DIE UITLEG (geleer op die grootboek van 1 Maart 2024 tot 28 Februarie 2025)
//
//   Kop        "GL Detailed Ledger 01/03/2024 to 28/02/2025"
//   Rekening   "2200/000 : Bankkoste", op 'n nuwe bladsy met "...Continued"
//   Reel       datum, inskrywingsoort, verwysing, beskrywing, Debit of Credit,
//              Cumulative. Die beskrywing loop soms oor twee of drie reels.
//   Slot       "Closing Balance as at 28/02/2025" met die rekening se saldo
//
// DIE KOLOMME WORD PER BLADSY UIT DIE KOP GELEES. Die bedrae is regs belyn;
// 'n bedrag behoort aan die kop waarvan die regterkant die naaste aan syne is.
// Die bladsye is nie ewe wyd nie, so vaste x-waardes sou breek.
//
// DIE BANKREKENING is die een wie se reels almal "ZContras" as verwysing dra:
// die rekenmeester se saamgevoegde teenboekings. Sy reels word nie gepas nie;
// net sy sluitsaldo word teen die bank se saldo gekontroleer.
//
// TWEE KONTROLES, en die grootboek word net aanvaar as albei klop:
//
//   rekeninge   elke rekening se debiete min krediete gee sy sluitsaldo
//   balans      die bankrekening se beweging is gelyk aan die teenkant van
//               al die ander rekeninge saam
//
// RIGTING. 'n Debiet op 'n ander rekening as die bank is geld wat UIT die bank
// gegaan het; 'n krediet is geld wat IN gekom het.

(function (wortel) {
  "use strict";

  function sent(teks) {
    const skoon = String(teks || "").replace(/[,\s]/g, "");
    const m = skoon.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
    if (!m) return null;
    const v = Number(m[2]) * 100 + Number(((m[3] || "") + "00").slice(0, 2));
    return m[1] ? -v : v;
  }

  function iso(dmj) {
    const m = String(dmj).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  }

  function reels_van(items) {
    const gesorteer = items
      .filter((i) => String(i.s || "").trim())
      .slice()
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const reels = [];
    gesorteer.forEach((i) => {
      const laaste = reels[reels.length - 1];
      if (laaste && Math.abs(laaste.y - i.y) <= 2) laaste.items.push(i);
      else reels.push({ y: i.y, items: [i] });
    });
    reels.forEach((r) => r.items.sort((a, b) => a.x - b.x));
    return reels;
  }

  const teks = (r) => r.items.map((i) => String(i.s).trim()).filter(Boolean).join(" ");
  const regs = (i) => i.x + (i.w || 0);

  function lees(bladsye) {
    const fout = (boodskap) => ({ ok: false, fout: boodskap });
    if (!Array.isArray(bladsye) || !bladsye.length) return fout("Die PDF het geen bladsye nie.");

    let tydperk = null;
    let entiteit = "";
    const rekeninge = [];
    let rek = null;
    let laaste = null;

    for (const blad of bladsye) {
      const reels = reels_van(blad.items || []);
      // Die kolomkoppe van hierdie bladsy.
      let kol = null;
      for (const r of reels) {
        const naam = (s) => r.items.find((i) => String(i.s).trim() === s);
        const d = naam("Debit"), k = naam("Credit"), c = naam("Cumulative"), b = naam("Description");
        if (d && k && c && b) {
          kol = { debiet: regs(d), krediet: regs(k), kumulatief: regs(c), beskr: b.x };
          break;
        }
      }

      for (const r of reels) {
        const t = teks(r);
        if (!tydperk) {
          const m = t.match(/GL Detailed Ledger\s+(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})/i);
          if (m) { tydperk = { van: iso(m[1]), tot: iso(m[2]) }; continue; }
        }
        if (!entiteit && /Page:\s*\d+/.test(t)) {
          entiteit = String(r.items[0].s).trim();
          continue;
        }
        if (!kol) continue;

        const rm = t.match(/^(\d{4}\/\d{3})\s*:\s*(.+?)(\s*\.\.\.\s*Continued)?$/i);
        if (rm) {
          if (rm[3] && rek && rek.kode === rm[1]) { laaste = null; continue; }
          rek = { kode: rm[1], naam: rm[2].trim(), reels: [], sluit_sent: null };
          rekeninge.push(rek);
          laaste = null;
          continue;
        }
        if (!rek) continue;

        if (/^Opening Balance/i.test(t)) { laaste = null; continue; }
        const sm = t.match(/^Closing Balance as at\s+(\d{2}\/\d{2}\/\d{4})\s+(-?[\d,]+\.\d{2})$/i);
        if (sm) {
          rek.sluit_sent = sent(sm[2]);
          laaste = null;
          continue;
        }

        const eerste = String(r.items[0].s).trim();
        const datum = /^\d{2}\/\d{2}\/\d{4}$/.test(eerste) ? iso(eerste) : null;
        if (datum) {
          const reel = { datum, soort: "", verwysing: "", beskrywing: "", debiet_sent: 0, krediet_sent: 0 };
          const beskr = [];
          r.items.slice(1).forEach((i, n) => {
            const s = String(i.s).trim();
            const bedrag = /^-?[\d,]+\.\d{2}$/.test(s) ? sent(s) : null;
            if (bedrag != null && i.x > kol.beskr + 60) {
              const re = regs(i);
              const af = [["debiet", kol.debiet], ["krediet", kol.krediet], ["kumulatief", kol.kumulatief]]
                .map(([k, x]) => [k, Math.abs(re - x)])
                .sort((a, b) => a[1] - b[1])[0][0];
              if (af === "debiet") reel.debiet_sent = bedrag;
              else if (af === "krediet") reel.krediet_sent = bedrag;
              return;
            }
            if (i.x >= kol.beskr - 3) beskr.push(s);
            else if (n === 0) reel.soort = s;
            else reel.verwysing = s;
          });
          reel.beskrywing = beskr.join(" ");
          rek.reels.push(reel);
          laaste = reel;
          continue;
        }

        // 'n Voortsetting: die beskrywing se tweede of derde reel. Die "K" van
        // "ONTVANGSKASBOEK" wat na die volgende reel oorloop, staan links van
        // die beskrywing en word hier nie bygetel nie.
        if (laaste) {
          const by = r.items.filter((i) => i.x >= kol.beskr - 3).map((i) => String(i.s).trim()).join(" ");
          if (by) laaste.beskrywing = (laaste.beskrywing + " " + by).trim();
        }
      }
    }

    if (!tydperk) return fout("Dit lyk nie na 'n ACT-grootboek nie: die tydperk is nie gevind nie.");
    if (!rekeninge.length) return fout("Geen rekeninge in die grootboek gevind nie.");

    // Die bankrekening: al sy reels dra ZContras.
    const bank = rekeninge.find((k) => k.reels.length && k.reels.every((r) => /^ZContras$/i.test(r.verwysing)));

    // Kontrole 1: elke rekening se reels gee sy sluitsaldo.
    const rek_foute = [];
    rekeninge.forEach((k) => {
      const netto = k.reels.reduce((s, r) => s + r.debiet_sent - r.krediet_sent, 0);
      k.netto_sent = netto;
      if (k.sluit_sent == null || Math.abs(netto) !== Math.abs(k.sluit_sent)) {
        rek_foute.push(k.kode);
      }
    });

    // Kontrole 2: die bank teen die res.
    const ander = rekeninge.filter((k) => k !== bank);
    const ander_netto = ander.reduce((s, k) => s + k.netto_sent, 0);
    const balans = {
      bank_gevind: !!bank,
      bank_sent: bank ? bank.netto_sent : 0,
      ander_sent: -ander_netto,
      ok: !!bank && bank.netto_sent === -ander_netto,
    };

    // Die reels om te pas.
    const reels = [];
    ander.forEach((k) => k.reels.forEach((r) => {
      const netto = r.debiet_sent - r.krediet_sent;
      if (!netto) return;
      reels.push({
        kode: k.kode, rekening: k.naam, datum: r.datum, beskrywing: r.beskrywing,
        verwysing: r.verwysing, bedrag_sent: Math.abs(netto), rigting: netto > 0 ? "uit" : "in",
      });
    }));

    return {
      ok: rek_foute.length === 0 && balans.ok,
      entiteit,
      tydperk,
      bank: bank ? { kode: bank.kode, naam: bank.naam, sluit_sent: bank.netto_sent } : null,
      rekeninge: ander.filter((k) => k.reels.length).map((k) => ({
        kode: k.kode, naam: k.naam, tel: k.reels.length, netto_sent: k.netto_sent,
        rigting: k.netto_sent > 0 ? "uit" : "in",
      })),
      reels,
      kontroles: {
        rekeninge: { ok: rek_foute.length === 0, foute: rek_foute },
        balans,
      },
    };
  }

  // ── Pas die grootboek teen die ingevoerde state ─────────────────────
  //
  // reels       lees() se reels
  // state       die volledige regte state ({ sleutel, reels: [...] }) wat die
  //             grootboek se tydperk raak
  // koppeling   { "2200/000": { kategorie } }
  //
  // Elke grootboekreel soek een bankreel met dieselfde rigting en bedrag,
  // hoogstens SPELING dae weg; die naaste datum wen, en elke bankreel word net
  // een keer gebruik. Die rekenmeester se datum wyk soms af (FNB se maandfooi
  // op die 1ste teen die staat se datum), daarom nie presies nie.
  //
  // Wat daarna met elke pas gebeur:
  //   toewys     die bankreel is oop of net voorgestel, en die rekening is
  //              gekoppel: dit word toegewys
  //   reeds      die bankreel is reeds so toegewys
  //   verskil    die bankreel is reeds anders toegewys of deur die stelsel
  //              gepas; dit word NIE verander nie, net gewys
  //   ongekoppel die rekening het nog geen kategorie nie
  const SPELING = 7;

  function dae(a, b) {
    return Math.round(Math.abs(Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
  }

  function pas(reels, state, koppeling) {
    const rekeninge = (koppeling && koppeling.rekeninge) || {};
    const bank = [];
    (state || []).forEach((s) => (s.reels || []).forEach((r) => {
      if (r.stand === "inligting" || !r.bedrag_sent) return;
      bank.push({ staat: s.sleutel, r });
    }));
    const gebruik = new Set();
    const id = (b) => b.staat + "#" + b.r.nr;

    const uitslag = reels
      .slice()
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .map((g) => {
        const kandidate = bank
          .filter((b) => !gebruik.has(id(b)) && b.r.rigting === g.rigting &&
            b.r.bedrag_sent === g.bedrag_sent && dae(b.r.datum, g.datum) <= SPELING)
          .sort((a, b) => dae(a.r.datum, g.datum) - dae(b.r.datum, g.datum));
        const b = kandidate[0];
        if (!b) return { g, stand: "geen" };
        gebruik.add(id(b));
        const k = (rekeninge[g.kode] || {}).kategorie || "";
        const r = b.r;
        let stand;
        if (!k) stand = "ongekoppel";
        else if (r.stand === "oop" || r.stand === "voorstel") stand = "toewys";
        else if (k === "__oordrag" ? r.stand === "oordrag" : (r.stand === "toegewys" && r.kategorie_id === k)) stand = "reeds";
        else stand = "verskil";
        return { g, stand, staat: b.staat, nr: r.nr, bank: r, kategorie: k };
      });

    // Bankreels in die tydperk wat geen grootboekreel gekry het nie.
    const los = bank.filter((b) => !gebruik.has(id(b)));
    return { uitslag, los };
  }

  const uit = { lees, sent, pas, SPELING };
  if (typeof module !== "undefined" && module.exports) module.exports = uit;
  else wortel.GrootboekACT = uit;
})(typeof window !== "undefined" ? window : this);
