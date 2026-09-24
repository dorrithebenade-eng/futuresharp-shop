// public/js/bankstaat-fnb.js
//
// Lees 'n FNB-bankstaat (PDF) uit die teksitems wat pdf.js gee.
//
// 'N SUIWER FUNKSIE. Dit kry per bladsy 'n lys items { s, x, y, w } en gee 'n
// resultaat terug; dit weet niks van die skerm, die blaaier of pdf.js nie. So
// kan dieselfde kode in die blaaier loop en in Node teen 'n werklike staat
// getoets word.
//
// WAT OP 12 JULIE 2025 SE STAAT GELEER IS (Gold Business Account)
//
//   1. Die saldokolom dra GEEN Dr of Cr nie. Net die openings- en sluitsaldo
//      bo-aan doen dit. Die teken van elke reel se saldo word dus uit die
//      ketting afgelei: opening plus elke bedrag.
//
//   2. 'n Krediet dra "Cr" langs die bedrag, soms as 'n eie item. 'n Bedrag
//      sonder Cr is 'n debiet.
//
//   3. FNB druk die beskrywing van sy EIE FOOIE (die #-reels: #Service Fees,
//      #Monthly Account Fee) as 'n prentjie, nie as teks nie. Die datum en die
//      bedrag is leesbaar; die beskrywing nie. Hulle tel presies op tot die
//      "Bank Charges"-blok bo-aan, en dit is die kontrole wat hulle benoem:
//      klop dit, is hulle FNB-bankkoste; klop dit nie, bly hulle sonder
//      beskrywing en sonder kategorie.
//
//   4. 'n Reel van R0,00 is inligting ("Electronic Payments ... = 35.00") en
//      word nie deur FNB getel nie. Dit word gewys maar nie ingevoer nie.
//
//   5. Die kolom "Accrued Bank Charges" is NIE 'n transaksie nie. Dit is fooie
//      wat later as #-reel gehef word; tel 'n mens dit saam, is die koste dubbel.
//
//   6. Die datum dra geen jaar nie. Die jaar kom uit die staattydperk; 'n
//      tydperk van Desember tot Januarie kry elke maand sy regte jaar.
//
// DRIE KONTROLES, en 'n staat word net aanvaar as al drie klop:
//
//   ketting    openingsaldo plus elke reel gee elke reel se saldo, tot die
//              sluitsaldo
//   omset      FNB se eie telling en totaal van krediete en debiete
//   bankkoste  die reels sonder beskrywing teen die Bank Charges-blok

(function (wortel) {
  "use strict";

  const MAANDE = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    january: 1, february: 2, march: 3, april: 4, june: 6, july: 7,
    august: 8, september: 9, october: 10, november: 11, december: 12,
  };

  // "83,970.97" -> 8397097 sent. Alles in SENT, nooit in rand nie: 0,1 + 0,2 is
  // nie 0,3 in 'n dryfpuntgetal nie, en 'n kontrole tot die sent mag nie daarop
  // struikel nie.
  function sent(teks) {
    const skoon = String(teks || "").replace(/[^\d.]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(skoon)) return null;
    const [heel, breuk = ""] = skoon.split(".");
    return Number(heel) * 100 + Number((breuk + "00").slice(0, 2));
  }

  // Groepeer items per reel. 'n Reel is items met (amper) dieselfde y.
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

  function teks_van(items) {
    return items.map((i) => String(i.s).trim()).join(" ").replace(/\s+/g, " ").trim();
  }

  // Die waarde langs 'n etiket in 'n kopblok: die items regs van die etiket,
  // tot by die volgende etiket in dieselfde reel.
  function waarde_by(reels, etiket) {
    for (const r of reels) {
      const i = r.items.findIndex((x) => String(x.s).trim().startsWith(etiket));
      if (i < 0) continue;
      const res = [];
      for (let j = i + 1; j < r.items.length; j++) {
        const s = String(r.items[j].s).trim();
        if (/[A-Za-z]{3,}/.test(s) && !/^(Dr|Cr)$/.test(s) && !/\d/.test(s)) break;
        res.push(s);
        if (/(Dr|Cr)$/.test(s) || res.length >= 2) break;
      }
      const t = res.join(" ");
      const m = t.match(/([\d,]+\.\d{2})\s*(Dr|Cr)?/);
      if (m) return { sent: sent(m[1]), teken: m[2] || "" };
    }
    return null;
  }

  function lees(bladsye) {
    const fout = (boodskap) => ({ ok: false, fout: boodskap });
    if (!Array.isArray(bladsye) || !bladsye.length) return fout("Die PDF het geen bladsye nie.");

    const alle_reels = bladsye.map((b) => reels_van(b.items || []));
    const plat = [].concat(...alle_reels);
    const al_teks = plat.map((r) => teks_van(r.items)).join("\n");

    if (!/First National Bank|fnb\.co\.za|FNB/i.test(al_teks)) {
      return fout("Dit lyk nie na 'n FNB-staat nie.");
    }

    // ── Die kop ──────────────────────────────────────────────────────────
    // Uit die ITEM, nie uit die reel nie: links op dieselfde hoogte staan
    // "Customer VAT Registration Number", en 'n reel-soek tel dit by die naam.
    let rek = null;
    plat.some((r) => r.items.some((i) => {
      const m = String(i.s).trim().match(/^([A-Za-z][A-Za-z ]*Account)\s*:\s*(\d{6,})$/);
      if (m) rek = m;
      return Boolean(m);
    }));
    const per = al_teks.match(
      /Statement Period\s*:\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+to\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/
    );
    if (!per) return fout("Kon nie die staattydperk vind nie.");
    const van = { d: +per[1], m: MAANDE[per[2].toLowerCase()], j: +per[3] };
    const tot = { d: +per[4], m: MAANDE[per[5].toLowerCase()], j: +per[6] };
    if (!van.m || !tot.m) return fout("Kon nie die staattydperk lees nie.");

    const opening = waarde_by(plat, "Opening Balance");
    const sluit = waarde_by(plat, "Closing Balance");
    if (!opening || !sluit) return fout("Kon nie die openings- of sluitsaldo vind nie.");

    const fooiblok = ["Service Fees", "Cash Deposit Fees", "Cash Handling Fees", "Other Fees"]
      .map((e) => waarde_by(plat, e))
      .reduce((som, w) => som + (w ? w.sent : 0), 0);

    const kr_omset = al_teks.match(/No\.\s*Credit\s+Transactions\s+(\d+)\s+([\d,]+\.\d{2})/);
    const db_omset = al_teks.match(/No\.\s*Debit\s+Transactions\s+(\d+)\s+([\d,]+\.\d{2})/);

    // ── Die transaksies ──────────────────────────────────────────────────
    const transaksies = [];
    let kolomme = null;

    alle_reels.forEach((reels, bladsy_nr) => {
      reels.forEach((r) => {
        const s = r.items.map((i) => String(i.s).trim());
        const bedrag_kop = r.items.find((i) => String(i.s).trim() === "Amount");
        const saldo_kop = r.items.find((i) => String(i.s).trim() === "Balance");
        if (bedrag_kop && saldo_kop) {
          kolomme = { bedrag: bedrag_kop.x, saldo: saldo_kop.x, fooi: null };
          return;
        }
        if (kolomme && !kolomme.fooi && s.includes("Charges")) {
          kolomme.fooi = r.items.find((i) => String(i.s).trim() === "Charges").x;
          return;
        }
        if (!kolomme) return;

        const eerste = r.items[0];
        const dm = String(eerste.s).trim().match(/^(\d{1,2})\s+([A-Za-z]{3})$/);
        if (!dm || eerste.x > 40) return;
        const maand = MAANDE[dm[2].toLowerCase()];
        if (!maand) return;

        const fooi_x = kolomme.fooi || kolomme.saldo + 45;
        const regs = (i) => i.x + (i.w || 0);
        const beskr = [], verw = [], bedr = [], sald = [];
        r.items.slice(1).forEach((i) => {
          const t = String(i.s).trim();
          if (regs(i) <= kolomme.bedrag - 15) {
            (i.x < 250 ? beskr : verw).push(t);
          } else if (regs(i) <= kolomme.saldo - 1) {
            bedr.push(t);
          } else if (regs(i) <= fooi_x - 1) {
            sald.push(t);
          }
          // Regs van die saldo: die "Accrued Bank Charges" -- nie 'n transaksie nie.
        });

        const b = bedr.join("");
        const bedrag = sent(b.replace(/Cr|Dr/g, ""));
        const saldo = sent(sald.join("").replace(/Cr|Dr/g, ""));
        if (bedrag === null || saldo === null) return;

        const jaar = van.j === tot.j ? van.j : (maand >= van.m ? van.j : tot.j);
        transaksies.push({
          bladsy: bladsy_nr + 1,
          datum: `${jaar}-${String(maand).padStart(2, "0")}-${String(+dm[1]).padStart(2, "0")}`,
          beskrywing: beskr.join(" ").replace(/\s+/g, " ").trim(),
          verwysing: verw.join(" ").replace(/\s+/g, " ").trim(),
          bedrag_sent: bedrag,
          rigting: /Cr$/.test(b) ? "in" : "uit",
          saldo_sent: saldo,
        });
      });
    });

    if (!transaksies.length) return fout("Kon geen transaksies in die staat vind nie.");

    // ── Kontrole 1: die ketting ──────────────────────────────────────────
    // Positief is krediet (geld in die bank), negatief is oortrokke.
    let loop = opening.teken === "Dr" ? -opening.sent : opening.sent;
    const kettingfoute = [];
    transaksies.forEach((t, n) => {
      loop += t.rigting === "in" ? t.bedrag_sent : -t.bedrag_sent;
      t.lopende_sent = loop;
      if (Math.abs(loop) !== t.saldo_sent) kettingfoute.push(n);
    });
    const sluit_getal = sluit.teken === "Dr" ? -sluit.sent : sluit.sent;
    const ketting = {
      ok: kettingfoute.length === 0 && loop === sluit_getal,
      foute: kettingfoute,
      eind_sent: loop,
      sluit_sent: sluit_getal,
    };

    // ── Inligtingsreels ─────────────────────────────────────────────────
    transaksies.forEach((t) => { t.inligting = t.bedrag_sent === 0; });
    const werklik = transaksies.filter((t) => !t.inligting);

    // ── Kontrole 2: FNB se omset ─────────────────────────────────────────
    const kr = werklik.filter((t) => t.rigting === "in");
    const db = werklik.filter((t) => t.rigting === "uit");
    const som = (l) => l.reduce((a, t) => a + t.bedrag_sent, 0);
    const omset = {
      beskikbaar: Boolean(kr_omset && db_omset),
      krediete: { tel: kr.length, sent: som(kr) },
      debiete: { tel: db.length, sent: som(db) },
      fnb_krediete: kr_omset ? { tel: +kr_omset[1], sent: sent(kr_omset[2]) } : null,
      fnb_debiete: db_omset ? { tel: +db_omset[1], sent: sent(db_omset[2]) } : null,
    };
    omset.ok = omset.beskikbaar &&
      omset.krediete.tel === omset.fnb_krediete.tel &&
      omset.krediete.sent === omset.fnb_krediete.sent &&
      omset.debiete.tel === omset.fnb_debiete.tel &&
      omset.debiete.sent === omset.fnb_debiete.sent;

    // ── Kontrole 3: die reels sonder beskrywing teen die fooiblok ────────
    const sonder = werklik.filter((t) => !t.beskrywing);
    const sonder_som = som(sonder);
    const bankkoste = {
      reels: sonder.length,
      sent: sonder_som,
      blok_sent: fooiblok,
      ok: sonder.length === 0 || (sonder.every((t) => t.rigting === "uit") && sonder_som === fooiblok),
    };
    sonder.forEach((t) => {
      t.fnb_fooi = bankkoste.ok;
      if (bankkoste.ok) t.beskrywing = "FNB-bankkoste";
    });
    transaksies.filter((t) => t.inligting && !t.beskrywing)
      .forEach((t) => { t.beskrywing = "FNB-inligtingsreël"; });

    return {
      ok: ketting.ok && omset.ok && bankkoste.ok,
      bank: "FNB",
      rekening: rek ? { naam: rek[1].trim(), nommer: rek[2] } : null,
      tydperk: {
        van: `${van.j}-${String(van.m).padStart(2, "0")}-${String(van.d).padStart(2, "0")}`,
        tot: `${tot.j}-${String(tot.m).padStart(2, "0")}-${String(tot.d).padStart(2, "0")}`,
      },
      opening_sent: opening.teken === "Dr" ? -opening.sent : opening.sent,
      sluit_sent: sluit_getal,
      transaksies,
      kontroles: { ketting, omset, bankkoste },
    };
  }

  const uit = { lees, sent };
  if (typeof module !== "undefined" && module.exports) module.exports = uit;
  else wortel.BankstaatFNB = uit;
})(typeof window !== "undefined" ? window : this);
