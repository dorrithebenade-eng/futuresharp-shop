// public/js/faktuurpaneel-fin-afs.js
// Weergawe 1 (19 Oktober 2026).
//
// DIE VOORLOPIGE FINANSIELE STATE, die vyfde oortjie onder State. Vir die
// rekenmeester om na te gaan; nie self 'n oudit of 'n oorsig nie.
//
// VAN KONTANT NA TOEVALLING. Die staat van ontvangste en betalings is op
// kontantbasis. Hier word dit per boekjaar omgesit:
//
//   inkomste = ontvangste + debiteure aan die einde - debiteure aan die begin
//              - toename in ongebruikte toelaes
//   uitgawes = betalings  + krediteure aan die einde - krediteure aan die begin
//
// Die kontant per kategorie kom uit kry-joernaal.js en word presies soos op die
// staat geklassifiseer (fs_dele_van uit faktuurpaneel-fin-staat.js). Die
// debiteure en krediteure op elke jaareinde kom uit kry-jaareinde.js. Die
// banksaldo kom uit die ingevoerde bankstate (kry-fin-bank.js).
//
// ELKE JAAR VANAF REGISTRASIE WORD GELAAI, want die opgehoopte oorskot en die
// beginsaldo's hang van al die vorige jare af. Die maatskappy het op 1 Maart
// 2024 by nul begin (die bankrekening is daardie dag sonder 'n deposito
// oopgemaak).
//
// NOG NIE HIER NIE (wag op inligting): toerusting as bate met
// waardevermindering, en lenings van direkteure. Albei staan as reels met 'n
// streep en 'n nota, sodat niemand dink hulle is vergeet nie.
//
// Voorvoegsel `afs_`.

(function () {
  const BEGIN_JAAR = 2024;

  // Uit die CIPC-sertifikaat (COR39 van 14 Oktober 2026).
  const MAATSKAPPY = {
    naam: "Future Sharp NPC",
    reg_nr: "2024/117444/08",
    soort: "Maatskappy sonder winsoogmerk",
    belasting_nr: "9446402225",
    geregistreer: "2024-03-01",
    jaareinde: "Laaste dag van Februarie",
    kantoor: "285 Talana-laan, Villieria, Pretoria, 0186",
    pos: "Posbus 11602, Queenswood, 0121",
    bank: "First National Bank",
    direkteure: [
      { naam: "Ignatius Gous", aangestel: "2024-02-29" },
      { naam: "Rialetta Gous", aangestel: "2024-02-29" },
      { naam: "Marike Venter", aangestel: "2024-02-29" },
      { naam: "Eugene Botha", aangestel: "2025-03-01" },
      { naam: "Dorrithé Labuschagne", aangestel: "2025-03-01" },
    ],
  };

  const AFS = { gereed: false, oop: false, jaar: null, sub: "state", s: null, rou: null };

  function t(sleutel, verstek) {
    const uit = window.t ? window.t(sleutel) : null;
    return uit && uit !== sleutel ? uit : verstek;
  }
  function o(teks) {
    return String(teks == null ? "" : teks)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  // Bedrae sonder R, negatief tussen hakies, soos in finansiele state.
  function b(sent) {
    const v = Math.round(Number(sent) || 0);
    if (v === 0) return "–";
    const n = Math.abs(v);
    const heel = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const s = heel + "," + String(n % 100).padStart(2, "0");
    return v < 0 ? "(" + s + ")" : s;
  }
  function r(sent) {
    return "R" + b(sent).replace(/[()]/g, "");
  }
  function datum_teks(iso) {
    if (!iso) return "";
    const m = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
    return `${Number(iso.slice(8, 10))} ${m[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
  }
  async function vra(naam, vraag) {
    const resp = await fetch("/.netlify/functions/" + naam + (vraag ? "?" + vraag : ""),
      { headers: await identiteit_kop() });
    if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
    return resp.json();
  }
  function grense(jaar) {
    return { van: `${jaar}-03-01`, tot: new Date(Date.UTC(jaar + 1, 2, 0)).toISOString().slice(0, 10) };
  }
  function boekjaar_van(iso) {
    const j = Number(iso.slice(0, 4));
    return Number(iso.slice(5, 7)) >= 3 ? j : j - 1;
  }

  /* ═══ die klassifikasie ═══ */

  // Een inskrywing (of debiteur/krediteur in dieselfde vorm) se dele by die
  // kategoriee, met dieselfde rigtingtoets as die staat. Wat nie pas nie,
  // gaan na "" (Ongekategoriseer).
  function voeg_by(kaart, r, rigting, per_naam, per_id) {
    fs_dele_van(r, per_naam).forEach((d) => {
      if (!d.bedrag_sent) return;
      const kat = d.kategorie_id ? per_id.get(d.kategorie_id) : null;
      const pas = kat && (kat.rigting === "in" ? "in" : "uit") === rigting;
      const id = pas ? d.kategorie_id : "";
      kaart.set(id, (kaart.get(id) || 0) + d.bedrag_sent);
    });
  }

  function bereken() {
    const R = AFS.rou;
    const per_naam = new Map(R.werk_items.map((w) => [fs_sleutel(w.naam), w]));
    const per_id = new Map(R.kategoriee.map((k) => [k.id, k]));
    const kat = (id) => per_id.get(id);
    const top_van = (id) => {
      let k = kat(id);
      for (let i = 0; k && k.onder && i < 10; i++) k = kat(k.onder);
      return k || null;
    };
    const proj_kop = top_van("vergoeding-vir-dienste");
    const is_los_bate = (id) => {
      let k = kat(id);
      for (let i = 0; k && i < 10; i++) {
        if (/los\s*bate/i.test(k.naam || "")) return true;
        k = k.onder ? kat(k.onder) : null;
      }
      return false;
    };
    // Die reel op die staat waaronder 'n kategorie val.
    const reel_van = (id, rigting) => {
      if (!id) return { id: "", naam: t("fs_ongekat", "Ongekategoriseer"), groep: rigting === "in" ? "in" : "bedryf" };
      const top = top_van(id);
      if (rigting === "in") return { id: top.id, naam: top.naam, groep: "in" };
      if (proj_kop && top.id === proj_kop.id) {
        // Die kind direk onder Projekkoste, of Projekkoste self.
        let k = kat(id);
        for (let i = 0; k && k.onder && k.onder !== proj_kop.id && i < 10; i++) k = kat(k.onder);
        return { id: k.id, naam: k.naam, groep: "projek" };
      }
      return { id: top.id, naam: top.naam, groep: "bedryf" };
    };

    const jare = [];
    for (let j = BEGIN_JAAR; j <= AFS.jaar; j++) jare.push(j);

    const per_jaar = new Map();
    let alle_inskrywings = [];
    jare.forEach((j) => {
      const g = grense(j);
      const jn = R.joernaal.get(j) || {};
      const lys = Array.isArray(jn.inskrywings) ? jn.inskrywings : [];
      alle_inskrywings = alle_inskrywings.concat(lys);
      const k_in = new Map(), k_uit = new Map();
      const los_bates = [];
      lys.forEach((x) => {
        const rig = x.rigting === "in" ? "in" : "uit";
        voeg_by(rig === "in" ? k_in : k_uit, x, rig, per_naam, per_id);
        if (rig === "uit") {
          fs_dele_van(x, per_naam).forEach((d) => {
            if (d.kategorie_id && is_los_bate(d.kategorie_id) && d.bedrag_sent) {
              los_bates.push({ datum: x.datum, beskrywing: x.beskrywing || "", bedrag_sent: d.bedrag_sent });
            }
          });
        }
      });
      const je = (R.jaareinde || {})[g.tot] || { debiteure: [], krediteure: [] };
      const d_in = new Map(), k_kred = new Map();
      je.debiteure.forEach((d) => voeg_by(d_in, { dele: d.dele, bedrag_sent: d.bedrag_sent, kategorie_id: "diensinkomste" }, "in", per_naam, per_id));
      je.krediteure.forEach((k) => voeg_by(k_kred, { waarvoor: k.waarvoor, bedrag_sent: k.bedrag_sent }, "uit", per_naam, per_id));
      const bank = R.bank.get(j) || {};
      const toelae = typeof window.ff_beperk === "function"
        ? window.ff_beperk(alle_inskrywings.slice(), R.projekte) : 0;
      per_jaar.set(j, {
        jaar: j, ...g,
        kontant_in: k_in, kontant_uit: k_uit,
        deb: d_in, kred: k_kred,
        deb_lys: je.debiteure, kred_lys: je.krediteure,
        deb_sent: je.debiteure.reduce((a, d) => a + d.bedrag_sent, 0),
        kred_sent: je.krediteure.reduce((a, d) => a + d.bedrag_sent, 0),
        toelae_sent: toelae,
        bank_sluit: bank.sluiting || null,
        bank_open: bank.opening || null,
        los_bates,
      });
    });

    const som = (m) => [...m.values()].reduce((a, v) => a + v, 0);
    const leeg = { kontant_in: new Map(), kontant_uit: new Map(), deb: new Map(), kred: new Map(),
      deb_sent: 0, kred_sent: 0, toelae_sent: 0, bank_sluit: { balans_sent: 0, datum: `${BEGIN_JAAR}-02-29`, bron: "bankstaat" } };

    // Die toevallingsyfers per jaar.
    let opgehoop = 0;
    jare.forEach((j) => {
      const x = per_jaar.get(j);
      const v = per_jaar.get(j - 1) || leeg;
      const inkomste = new Map(), uitgawes = new Map();
      const sleutels = (a, b2, c) => new Set([...a.keys(), ...b2.keys(), ...c.keys()]);
      sleutels(x.kontant_in, x.deb, v.deb).forEach((id) => {
        const s = (x.kontant_in.get(id) || 0) + (x.deb.get(id) || 0) - (v.deb.get(id) || 0);
        if (s) inkomste.set(id, s);
      });
      sleutels(x.kontant_uit, x.kred, v.kred).forEach((id) => {
        const s = (x.kontant_uit.get(id) || 0) + (x.kred.get(id) || 0) - (v.kred.get(id) || 0);
        if (s) uitgawes.set(id, s);
      });
      x.inkomste = inkomste;
      x.uitgawes = uitgawes;
      x.toelae_uitgestel = x.toelae_sent - v.toelae_sent;
      x.kontant_in_sent = som(x.kontant_in);
      x.kontant_uit_sent = som(x.kontant_uit);
      x.inkomste_sent = som(inkomste) - x.toelae_uitgestel;
      x.uitgawes_sent = som(uitgawes);
      x.oorskot = x.inkomste_sent - x.uitgawes_sent;
      x.fondse_begin = opgehoop;
      opgehoop += x.oorskot;
      x.fondse_einde = opgehoop;
      x.bank_sent = x.bank_sluit ? Number(x.bank_sluit.balans_sent) || 0 : 0;
      x.bank_vorig = j === BEGIN_JAAR ? 0 : (per_jaar.get(j - 1).bank_sent);
      x.bates = x.bank_sent + x.deb_sent;
      x.laste = x.kred_sent + x.toelae_sent;
      x.verskil_balans = x.bates - x.laste - x.fondse_einde;
      x.d_deb = x.deb_sent - v.deb_sent;
      x.d_kred = x.kred_sent - v.kred_sent;
      x.d_toelae = x.toelae_sent - v.toelae_sent;
      x.bedryf_kontant = x.oorskot - x.d_deb + x.d_kred + x.d_toelae;
      x.verskil_kontant = (x.bank_sent - x.bank_vorig) - x.bedryf_kontant;
      x.kontant_netto = x.kontant_in_sent - x.kontant_uit_sent;
      x.verskil_bank = (x.bank_sent - x.bank_vorig) - x.kontant_netto;
    });

    // Die reels van die inkomstestaat, met die vorige jaar langsaan.
    const ditjaar = per_jaar.get(AFS.jaar);
    const vorig = per_jaar.get(AFS.jaar - 1) || null;
    const reels = (rigting) => {
      const kaart = new Map();
      const voeg = (m, kol) => m.forEach((s, id) => {
        const rl = reel_van(id, rigting);
        const k = rl.groep + "|" + rl.id;
        const x = kaart.get(k) || { ...rl, nou: 0, vorig: 0 };
        x[kol] += s;
        kaart.set(k, x);
      });
      voeg(rigting === "in" ? ditjaar.inkomste : ditjaar.uitgawes, "nou");
      if (vorig) voeg(rigting === "in" ? vorig.inkomste : vorig.uitgawes, "vorig");
      return [...kaart.values()].filter((x) => x.nou || x.vorig)
        .sort((a, b2) => (a.id === "") - (b2.id === "") || String(a.naam).localeCompare(String(b2.naam), "af-ZA"));
    };
    const ink = reels("in");
    const uit = reels("uit");
    return {
      jaar: AFS.jaar, x: ditjaar, v: vorig, per_jaar,
      ink, projek: uit.filter((u) => u.groep === "projek"), bedryf: uit.filter((u) => u.groep === "bedryf"),
      proj_naam: proj_kop ? proj_kop.naam : t("fs_projekkoste", "Projekkoste"),
    };
  }

  /* ═══ die teken ═══ */

  const jaar_kort = (j) => String(j + 1);
  function kop3(titel, sub) {
    return `<h3>${o(titel)}</h3>${sub ? `<p class="afs-sub">${o(sub)}</p>` : ""}`;
  }
  function tabel_kop(s) {
    return `<tr><th></th><th class="n">${jaar_kort(s.jaar)}</th>${s.v ? `<th class="n">${jaar_kort(s.jaar - 1)}</th>` : ""}</tr>`;
  }
  function ry(naam, nou, vorig, s, klas) {
    return `<tr${klas ? ` class="${klas}"` : ""}><td>${naam}</td><td class="n">${b(nou)}</td>${
      s.v ? `<td class="n afs-vg">${vorig == null ? "" : b(vorig)}</td>` : ""}</tr>`;
  }
  function groep(naam, s) {
    return `<tr class="afs-groep"><td colspan="${s.v ? 3 : 2}">${o(naam)}</td></tr>`;
  }

  function teken_state(s) {
    const x = s.x, v = s.v;
    const vv = (veld) => (v ? v[veld] : null);
    const som_l = (l, kol) => l.reduce((a, q) => a + q[kol], 0);

    const posisie = `
      <div class="afs-staat">
        ${kop3(t("afs_posisie", "1. Staat van finansiële posisie"), t("afs_op", "op") + " " + datum_teks(x.tot))}
        <div class="afs-tabel"><table>
          ${tabel_kop(s)}
          ${groep(t("afs_bates", "Bates"), s)}
          ${ry(o(t("afs_toerusting", "Toerusting")), 0, v ? 0 : null, s, "afs-ink")}
          ${ry(o(t("afs_debiteure", "Debiteure")), x.deb_sent, vv("deb_sent"), s, "afs-ink")}
          ${ry(o(t("afs_kontant", "Kontant in die bank")), x.bank_sent, vv("bank_sent"), s, "afs-ink")}
          ${ry(o(t("afs_tot_bates", "Totale bates")), x.bates, vv("bates"), s, "afs-subtot")}
          ${groep(t("afs_laste", "Laste"), s)}
          ${ry(o(t("afs_krediteure", "Krediteure")), x.kred_sent, vv("kred_sent"), s, "afs-ink")}
          ${ry(o(t("afs_lenings", "Lenings van direkteure")), 0, v ? 0 : null, s, "afs-ink")}
          ${ry(o(t("afs_toelaes", "Ongebruikte toelaes")), x.toelae_sent, vv("toelae_sent"), s, "afs-ink")}
          ${ry(o(t("afs_tot_laste", "Totale laste")), x.laste, vv("laste"), s, "afs-subtot")}
          ${groep(t("afs_fondse", "Fondse"), s)}
          ${ry(o(t("afs_opgehoop", "Opgehoopte oorskot")), x.fondse_einde, vv("fondse_einde"), s, "afs-ink")}
          ${ry(o(t("afs_laste_fondse", "Laste en fondse")), x.laste + x.fondse_einde, v ? v.laste + v.fondse_einde : null, s, "afs-tot")}
        </table></div>
        ${x.verskil_balans ? `<p class="afs-waarsku">${o(t("afs_balans_verskil",
          "Die bates klop nie met laste plus fondse nie. Verskil: {r}. Kyk na die kontantvloeistaat se onverklaarde verskil.").replace("{r}", r(x.verskil_balans)))}</p>` : ""}
      </div>`;

    const ink_rye = s.ink.map((q) => ry(o(q.naam), q.nou, v ? q.vorig : null, s, "afs-ink")).join("");
    const proj_rye = s.projek.map((q) => ry(o(q.naam), q.nou, v ? q.vorig : null, s, "afs-ink")).join("");
    const bedr_rye = s.bedryf.map((q) => ry(o(q.naam), q.nou, v ? q.vorig : null, s, "afs-ink")).join("");
    const toelae_ry = (x.toelae_uitgestel || (v && v.toelae_uitgestel))
      ? ry(o(t("afs_toelae_uitgestel", "Min: toelaes nog nie bestee nie")), -x.toelae_uitgestel, v ? -v.toelae_uitgestel : null, s, "afs-ink") : "";

    const inkomste = `
      <div class="afs-staat">
        ${kop3(t("afs_inkomstestaat", "2. Staat van inkomste en uitgawes"), t("afs_vir_jaar", "vir die jaar geëindig") + " " + datum_teks(x.tot))}
        <div class="afs-tabel"><table>
          ${tabel_kop(s)}
          ${groep(t("afs_inkomste", "Inkomste"), s)}
          ${ink_rye}${toelae_ry}
          ${ry(o(t("afs_tot_inkomste", "Totale inkomste")), x.inkomste_sent, vv("inkomste_sent"), s, "afs-subtot")}
          ${s.projek.length ? groep(s.proj_naam, s) + proj_rye : ""}
          ${s.bedryf.length ? groep(t("fs_bedryfskoste", "Bedryfskoste"), s) + bedr_rye : ""}
          ${ry(o(t("afs_tot_uitgawes", "Totale uitgawes")), x.uitgawes_sent, vv("uitgawes_sent"), s, "afs-subtot")}
          ${ry(o(t("afs_oorskot_jaar", "Oorskot vir die jaar")), x.oorskot, vv("oorskot"), s, "afs-tot")}
        </table></div>
        <p class="afs-uitleg">${o(t("afs_ink_uitleg", "Die reëls kom uit dieselfde kategorieboom as die staat van ontvangste en betalings."))}</p>
      </div>`;

    const fondse = `
      <div class="afs-staat">
        ${kop3(t("afs_fondse_staat", "3. Staat van veranderinge in fondse"), t("afs_opgehoop_kort", "opgehoopte oorskot"))}
        <div class="afs-tabel"><table>
          ${tabel_kop(s)}
          ${ry(o(t("afs_begin_jaar", "Aan die begin van die jaar")), x.fondse_begin, vv("fondse_begin"), s)}
          ${ry(o(t("afs_oorskot_jaar", "Oorskot vir die jaar")), x.oorskot, vv("oorskot"), s)}
          ${ry(o(t("afs_einde_jaar", "Aan die einde van die jaar")), x.fondse_einde, vv("fondse_einde"), s, "afs-tot")}
        </table></div>
        ${s.jaar === BEGIN_JAAR ? `<p class="afs-uitleg">${o(t("afs_nul_begin", "Die eerste jaar begin by nul: die bankrekening is op 1 Maart 2024 sonder 'n deposito oopgemaak."))}</p>` : ""}
      </div>`;

    const kontant = `
      <div class="afs-staat">
        ${kop3(t("afs_kontantvloei", "4. Kontantvloeistaat"), t("afs_vir_jaar", "vir die jaar geëindig") + " " + datum_teks(x.tot))}
        <div class="afs-tabel"><table>
          ${tabel_kop(s)}
          ${groep(t("afs_bedrywighede", "Bedrywighede"), s)}
          ${ry(o(t("afs_oorskot_jaar", "Oorskot vir die jaar")), x.oorskot, vv("oorskot"), s, "afs-ink")}
          ${ry(o(t("afs_d_deb", "Toename in debiteure")), -x.d_deb, v ? -v.d_deb : null, s, "afs-ink")}
          ${ry(o(t("afs_d_kred", "Toename in krediteure")), x.d_kred, vv("d_kred"), s, "afs-ink")}
          ${(x.d_toelae || (v && v.d_toelae)) ? ry(o(t("afs_d_toelae", "Toename in ongebruikte toelaes")), x.d_toelae, vv("d_toelae"), s, "afs-ink") : ""}
          ${ry(o(t("afs_kontant_bedryf", "Kontant uit bedrywighede")), x.bedryf_kontant, vv("bedryf_kontant"), s, "afs-subtot")}
          ${groep(t("afs_bel_fin", "Belegging en finansiering"), s)}
          ${ry(o(t("afs_toerusting_gekoop", "Toerusting gekoop")), 0, v ? 0 : null, s, "afs-ink")}
          ${ry(o(t("afs_lenings", "Lenings van direkteure")), 0, v ? 0 : null, s, "afs-ink")}
          ${(x.verskil_kontant || (v && v.verskil_kontant)) ? ry(o(t("afs_onverklaar", "Onverklaarde verskil")), x.verskil_kontant, vv("verskil_kontant"), s, "afs-ink afs-rooi") : ""}
          ${ry(o(t("afs_beweging", "Beweging in kontant")), x.bank_sent - x.bank_vorig, v ? v.bank_sent - v.bank_vorig : null, s, "afs-subtot")}
          ${ry(o(t("afs_kontant_begin", "Kontant aan die begin")), x.bank_vorig, vv("bank_vorig"), s)}
          ${ry(o(t("afs_kontant_einde", "Kontant aan die einde")), x.bank_sent, vv("bank_sent"), s, "afs-tot")}
        </table></div>
        <p class="afs-uitleg">${o(bank_bron_teks(x))}</p>
      </div>`;

    return `<div class="afs-rooster">${posisie}${inkomste}${fondse}${kontant}</div>`;
  }

  function bank_bron_teks(x) {
    const s = x.bank_sluit;
    if (!s) return t("afs_bank_geen", "Geen banksaldo vir die jaareinde nie. Voer die bankstate in.");
    if (s.bron === "bankstaat") {
      return s.datum === x.tot
        ? t("afs_bank_staat", "Die eindsaldo kom uit die bankstaat op die jaareinde.")
        : t("afs_bank_staat_dt", "Die eindsaldo kom uit die bankstaat, gemeet op {d}.").replace("{d}", datum_teks(s.datum));
    }
    return t("afs_bank_hand", "Die eindsaldo is met die hand ingetik ({d}), nie uit 'n bankstaat nie.").replace("{d}", datum_teks(s.datum));
  }

  function teken_skedules(s) {
    const x = s.x;
    const v = s.v || { deb_sent: 0, kred_sent: 0, toelae_sent: 0 };
    const aansl = `
      <div class="afs-staat afs-breed">
        ${kop3(t("afs_aansl", "Van kontant na toevalling"), t("afs_aansl_sub", "Hoe die staat van ontvangste en betalings by die finansiële state uitkom."))}
        <div class="afs-tabel"><table>
          <tr><th></th><th class="n">${o(t("afs_inkomste", "Inkomste"))}</th><th class="n">${o(t("afs_uitgawes", "Uitgawes"))}</th><th class="n">${o(t("afs_oorskot", "Oorskot"))}</th></tr>
          <tr><td>${o(t("afs_a_kontant", "Volgens die staat van ontvangste en betalings"))}</td><td class="n">${b(x.kontant_in_sent)}</td><td class="n">${b(x.kontant_uit_sent)}</td><td class="n">${b(x.kontant_in_sent - x.kontant_uit_sent)}</td></tr>
          <tr><td>${o(t("afs_a_deb_begin", "Min debiteure aan die begin"))}</td><td class="n">${b(-v.deb_sent)}</td><td class="n">–</td><td class="n">${b(-v.deb_sent)}</td></tr>
          <tr><td>${o(t("afs_a_deb_einde", "Plus debiteure aan die einde"))}</td><td class="n">${b(x.deb_sent)}</td><td class="n">–</td><td class="n">${b(x.deb_sent)}</td></tr>
          <tr><td>${o(t("afs_a_kred_begin", "Min krediteure aan die begin"))}</td><td class="n">–</td><td class="n">${b(-v.kred_sent)}</td><td class="n">${b(v.kred_sent)}</td></tr>
          <tr><td>${o(t("afs_a_kred_einde", "Plus krediteure aan die einde"))}</td><td class="n">–</td><td class="n">${b(x.kred_sent)}</td><td class="n">${b(-x.kred_sent)}</td></tr>
          ${x.toelae_uitgestel ? `<tr><td>${o(t("afs_toelae_uitgestel", "Min: toelaes nog nie bestee nie"))}</td><td class="n">${b(-x.toelae_uitgestel)}</td><td class="n">–</td><td class="n">${b(-x.toelae_uitgestel)}</td></tr>` : ""}
          <tr class="afs-tot"><td>${o(t("afs_a_afs", "Volgens die finansiële state"))}</td><td class="n">${b(x.inkomste_sent)}</td><td class="n">${b(x.uitgawes_sent)}</td><td class="n">${b(x.oorskot)}</td></tr>
        </table></div>
      </div>`;

    const lys_tabel = (lys, wie_veld, wie_kop, leeg) => lys.length ? `
      <div class="afs-tabel"><table>
        <tr><th>${o(t("afs_h_faktuur", "Faktuur"))}</th><th>${o(wie_kop)}</th><th>${o(t("afs_h_datum", "Datum"))}</th><th class="n">${o(t("afs_h_bedrag", "Bedrag"))}</th><th>${o(t("afs_h_betaal", "Betaal op"))}</th></tr>
        ${lys.slice().sort((a, c) => String(a.nommer).localeCompare(String(c.nommer))).map((d) => `<tr>
          <td>${o(d.nommer)}</td><td>${o(d[wie_veld])}</td><td class="afs-klein">${o(datum_teks(d.datum))}</td>
          <td class="n">${b(d.bedrag_sent)}</td><td class="afs-klein">${d.betaal_op ? o(datum_teks(d.betaal_op)) : `<span class="afs-chip afs-chip-wag">${o(t("afs_nog_oop", "nog oop"))}</span>`}</td></tr>`).join("")}
        <tr class="afs-subtot"><td colspan="3">${o(t("pv_totaal", "Totaal"))}</td><td class="n">${b(lys.reduce((a, d) => a + d.bedrag_sent, 0))}</td><td></td></tr>
      </table></div>` : `<p class="afs-leeg">${o(leeg)}</p>`;

    const deb = `
      <div class="afs-staat">
        ${kop3(t("afs_deb_op", "Debiteure op") + " " + datum_teks(x.tot), t("afs_deb_sub", "Uitgereikte fakture wat op die jaareinde nog nie betaal was nie"))}
        ${lys_tabel(x.deb_lys, "klient", t("afs_h_klient", "Kliënt"), t("afs_geen_deb", "Geen debiteure op die jaareinde nie."))}
      </div>`;
    const kred = `
      <div class="afs-staat">
        ${kop3(t("afs_kred_op", "Krediteure op") + " " + datum_teks(x.tot), t("afs_kred_sub", "Vergoeding vir gefaktureerde werk wat op die jaareinde nog nie uitbetaal was nie"))}
        ${lys_tabel(x.kred_lys, "ontvanger", t("afs_h_aan_wie", "Aan wie"), t("afs_geen_kred", "Geen krediteure op die jaareinde nie."))}
      </div>`;

    const los = `
      <div class="afs-staat">
        ${kop3(t("afs_los", "Los bates: bate of uitgawe?"), t("afs_los_sub", "Betalings in die jaar onder Los bates. Hulle staan nou as uitgawe."))}
        ${x.los_bates.length ? `<div class="afs-tabel"><table>
          <tr><th>${o(t("afs_h_datum", "Datum"))}</th><th>${o(t("afs_h_besk", "Beskrywing"))}</th><th class="n">${o(t("afs_h_bedrag", "Bedrag"))}</th></tr>
          ${x.los_bates.slice().sort((a, c) => String(a.datum).localeCompare(String(c.datum))).map((l) => `<tr>
            <td class="afs-klein">${o(datum_teks(l.datum))}</td><td>${o(l.beskrywing)}</td><td class="n">${b(l.bedrag_sent)}</td></tr>`).join("")}
        </table></div>` : `<p class="afs-leeg">${o(t("afs_geen_los", "Geen betalings onder Los bates in hierdie jaar nie."))}</p>`}
        <p class="afs-uitleg">${o(t("afs_los_uitleg", "Wat langer as 'n jaar gebruik word, kan later as toerusting gemerk word en oor sy gebruiksduur afgeskryf word. Die rekenmeester bevestig."))}</p>
      </div>`;

    const ander = `
      <div class="afs-staat">
        ${kop3(t("afs_ander", "Lenings en ongebruikte toelaes"), t("afs_ander_sub", "Laste wat nie uit die fakture kom nie"))}
        <div class="afs-tabel"><table>
          <tr><th>${o(t("afs_h_item", "Item"))}</th><th>${o(t("afs_h_stand", "Stand"))}</th></tr>
          <tr><td>${o(t("afs_lenings", "Lenings van direkteure"))}</td><td><span class="afs-chip afs-chip-wag">${o(t("afs_nog_nie", "Nog nie aangeteken nie"))}</span></td></tr>
          <tr><td>${o(t("afs_toelaes", "Ongebruikte toelaes"))}</td><td>${x.toelae_sent
            ? `<b>${r(x.toelae_sent)}</b>`
            : `<span class="afs-chip afs-chip-ok">${o(t("afs_geen_toelae", "Geen"))}</span>`}</td></tr>
        </table></div>
        <p class="afs-uitleg">${o(t("afs_lenings_uitleg", "'n Direkteur wat uit eie sak vir Future Sharp betaal het, word as lening aangeteken tot dit terugbetaal is."))}</p>
      </div>`;

    return `<div class="afs-rooster">${aansl}${deb}${kred}${los}${ander}</div>`;
  }

  function direkteure_vir(jaar) {
    const { van, tot } = grense(jaar);
    return MAATSKAPPY.direkteure.map((d) => ({
      ...d,
      stand: d.aangestel <= van ? "hele" : d.aangestel <= tot ? "deel" : "later",
    }));
  }

  function teken_besonder(s) {
    const M = MAATSKAPPY;
    const dir = direkteure_vir(s.jaar);
    const stand_teks = (d) => d.stand === "hele"
      ? `<span class="afs-chip afs-chip-ok">${o(t("afs_hele_jaar", "hele jaar"))}</span>`
      : d.stand === "deel"
        ? `<span class="afs-chip afs-chip-wag">${o(t("afs_deel_jaar", "deel van die jaar"))}</span>`
        : `<span class="afs-chip afs-chip-grys">${o(t("afs_na_jaar", "ná die jaareinde aangestel"))}</span>`;
    return `<div class="afs-rooster">
      <div class="afs-staat">
        ${kop3(t("afs_besonder", "Maatskappybesonderhede"), t("afs_besonder_sub", "Uit die CIPC-sertifikaat (COR39, 14 Oktober 2026)"))}
        <dl class="afs-dl">
          <dt>${o(t("afs_b_naam", "Naam"))}</dt><dd>${o(M.naam)}</dd>
          <dt>${o(t("afs_b_reg", "Registrasienommer"))}</dt><dd>${o(M.reg_nr)}</dd>
          <dt>${o(t("afs_b_soort", "Soort"))}</dt><dd>${o(M.soort)}</dd>
          <dt>${o(t("afs_b_bel", "Belastingnommer"))}</dt><dd>${o(M.belasting_nr)}</dd>
          <dt>${o(t("afs_b_gereg", "Geregistreer"))}</dt><dd>${o(datum_teks(M.geregistreer))}</dd>
          <dt>${o(t("afs_b_jaareinde", "Jaareinde"))}</dt><dd>${o(M.jaareinde)}</dd>
          <dt>${o(t("afs_b_kantoor", "Geregistreerde kantoor"))}</dt><dd>${o(M.kantoor)}</dd>
          <dt>${o(t("afs_b_pos", "Posadres"))}</dt><dd>${o(M.pos)}</dd>
          <dt>${o(t("afs_b_bank", "Bankier"))}</dt><dd>${o(M.bank)}</dd>
        </dl>
      </div>
      <div class="afs-staat">
        ${kop3(t("afs_direkteure", "Direkteure"), `${s.jaar}/${String(s.jaar + 1).slice(2)}`)}
        <div class="afs-tabel"><table>
          <tr><th>${o(t("afs_h_naam", "Naam"))}</th><th>${o(t("afs_h_aangestel", "Aangestel"))}</th><th>${o(t("afs_h_in_jaar", "In die jaar"))}</th></tr>
          ${dir.map((d) => `<tr><td>${o(d.naam)}</td><td class="afs-klein">${o(datum_teks(d.aangestel))}</td><td>${stand_teks(d)}</td></tr>`).join("")}
        </table></div>
      </div>
      <div class="afs-staat afs-breed">
        ${kop3(t("afs_notas", "Notas by die state"))}
        <ol class="afs-lys">${notas(s).map((n) => `<li><b>${o(n[0])}.</b> ${o(n[1])}</li>`).join("")}</ol>
      </div>
    </div>`;
  }

  function notas(s) {
    const later = direkteure_vir(s.jaar).filter((d) => d.stand === "later");
    return [
      [t("afs_n1_kop", "Grondslag van opstelling"), t("afs_n1", "Toevallingsbasis, historiese koste, Suid-Afrikaanse rand. Die raamwerk (IFRS vir KMO's) word deur die rekenmeester bevestig.")],
      [t("afs_n2_kop", "Inkomste"), t("afs_n2", "Fooie word erken op die faktuur se datum. Toelaes word erken soos die geld op die projek bestee word.")],
      [t("afs_n3_kop", "Vergoeding vir projekwerk"), t("afs_n3", "Erken saam met die inkomste waarvoor dit betaal word, op die faktuur se datum. Wat op die jaareinde nog nie uitbetaal was nie, staan as krediteur.")],
      [t("afs_n4_kop", "Toerusting"), t("afs_n4", "Aankope onder Los bates is as uitgawe hanteer. Wat langer as 'n jaar gebruik word, sal as bate teen koste min waardevermindering opgeneem word.")],
      [t("afs_n5_kop", "Belasting"), t("afs_n5", "Die maatskappy is nie as openbare weldaadsorganisasie geregistreer nie. Die belastingposisie word deur die rekenmeester bevestig.")],
      [t("afs_n6_kop", "Gebeure ná die jaareinde"), later.length
        ? t("afs_n6_dir", "{n} is ná die jaareinde as direkteur aangestel.").replace("{n}", later.map((d) => `${d.naam} (${datum_teks(d.aangestel)})`).join(", "))
        : t("afs_n6", "Veranderinge in die direksie word hier genoem sodra hulle by CIPC geregistreer is.")],
    ];
  }

  function kontroles(s) {
    const x = s.x;
    const ok = (teks) => `<span class="afs-kontrole afs-ok">✓ ${o(teks)}</span>`;
    const nee = (teks) => `<span class="afs-kontrole afs-nee">! ${o(teks)}</span>`;
    const uit = [];
    uit.push(x.verskil_balans ? nee(t("afs_k_balans_nee", "Bates ≠ laste + fondse")) : ok(t("afs_k_balans", "Bates = laste + fondse")));
    uit.push(x.verskil_bank
      ? nee(t("afs_k_bank_nee", "Kontant verskil van die bank met {r}").replace("{r}", r(x.verskil_bank)))
      : ok(t("afs_k_bank", "Kontant klop met die bankstaat")));
    const ong = (x.inkomste.get("") || 0) + (x.uitgawes.get("") || 0);
    if (ong) uit.push(nee(t("afs_k_ongekat", "{r} ongekategoriseer").replace("{r}", r(ong))));
    return `<div class="afs-kontroles">${uit.join("")}</div>`;
  }

  function teken() {
    const plek = document.getElementById("afs-inhoud");
    if (!plek || !AFS.s) return;
    const s = AFS.s;
    const subs = [["state", t("afs_sub_state", "Die state")], ["skedules", t("afs_sub_skedules", "Aansluiting en skedules")],
      ["besonder", t("afs_sub_besonder", "Besonderhede en notas")]];
    plek.innerHTML = `
      <div class="afs-strook"><b>${o(t("afs_voorlopig", "Voorlopig."))}</b> ${o(t("afs_voorlopig_teks",
        "Opgestel deur die direkteure uit die boekhoustelsel. Nie deur 'n rekenmeester nagegaan of goedgekeur nie. Bedrae in rand."))}</div>
      ${kontroles(s)}
      <div class="afs-subs">${subs.map(([id, naam]) =>
        `<button type="button" class="afs-sub-knop${AFS.sub === id ? " aan" : ""}" data-afs-sub="${id}">${o(naam)}</button>`).join("")}</div>
      ${AFS.sub === "skedules" ? teken_skedules(s) : AFS.sub === "besonder" ? teken_besonder(s) : teken_state(s)}`;
    plek.querySelectorAll("[data-afs-sub]").forEach((k) => k.addEventListener("click", () => {
      AFS.sub = k.getAttribute("data-afs-sub");
      teken();
    }));
  }

  /* ═══ die werkboek vir die rekenmeester ═══ */

  async function werkboek() {
    if (!AFS.s) return;
    let ExcelJS;
    try { ExcelJS = await jn_laai_exceljs(); } catch (f) { window.alert(String(f.message || f)); return; }
    const s = AFS.s, x = s.x, v = s.v;
    const GELD = '#,##0.00;(#,##0.00);"-"';
    const wb = new ExcelJS.Workbook();
    wb.creator = "Future Sharp";
    wb.created = new Date();
    const blad = (naam, titel, koppe, wydtes) => {
      const bl = wb.addWorksheet(naam);
      bl.addRow([`${MAATSKAPPY.naam}: ${titel}`]).font = { bold: true, size: 13 };
      bl.addRow([`Voorlopig, jaar geëindig ${datum_teks(x.tot)}. Nie deur 'n rekenmeester nagegaan nie.`]).font = { color: { argb: "FF6B6660" } };
      bl.addRow([]);
      if (koppe) {
        const k = bl.addRow(koppe);
        k.font = { bold: true };
        k.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEDE9" } }; });
      }
      wydtes.forEach((w, i) => (bl.getColumn(i + 1).width = w));
      return bl;
    };
    const ry = (bl, waardes, vet, geld_kol) => {
      const q = bl.addRow(waardes.map((w, i) => (i > 0 && typeof w === "number" ? w / 100 : w)));
      if (vet) q.font = { bold: true };
      (geld_kol || [2, 3, 4, 5]).forEach((c) => (q.getCell(c).numFmt = GELD));
      return q;
    };
    const kolomme = v ? ["", String(s.jaar + 1), String(s.jaar)] : ["", String(s.jaar + 1)];
    const twee = (n, a, c) => (v ? [n, a, c] : [n, a]);

    // 1. Proefbalans
    const pb = blad("Proefbalans", `Proefbalans op ${datum_teks(x.tot)}`, ["Rekening", "Debiet", "Krediet"], [44, 16, 16]);
    const pb_rye = [];
    pb_rye.push(["Bank", x.bank_sent, 0]);
    pb_rye.push(["Debiteure", x.deb_sent, 0]);
    pb_rye.push(["Krediteure", 0, x.kred_sent]);
    if (x.toelae_sent) pb_rye.push(["Ongebruikte toelaes", 0, x.toelae_sent]);
    pb_rye.push(["Opgehoopte oorskot aan die begin", x.fondse_begin < 0 ? -x.fondse_begin : 0, x.fondse_begin > 0 ? x.fondse_begin : 0]);
    s.ink.forEach((q) => pb_rye.push([`Inkomste: ${q.naam}`, q.nou < 0 ? -q.nou : 0, q.nou > 0 ? q.nou : 0]));
    if (x.toelae_uitgestel) pb_rye.push(["Toelaes nog nie bestee nie", x.toelae_uitgestel > 0 ? x.toelae_uitgestel : 0, x.toelae_uitgestel < 0 ? -x.toelae_uitgestel : 0]);
    s.projek.concat(s.bedryf).forEach((q) => pb_rye.push([`Uitgawe: ${q.naam}`, q.nou > 0 ? q.nou : 0, q.nou < 0 ? -q.nou : 0]));
    if (x.verskil_balans) pb_rye.push(["Onverklaarde verskil", x.verskil_balans < 0 ? -x.verskil_balans : 0, x.verskil_balans > 0 ? x.verskil_balans : 0]);
    pb_rye.forEach((q) => { if (q[1] || q[2]) ry(pb, q, false, [2, 3]); });
    ry(pb, ["Totaal", pb_rye.reduce((a, q) => a + q[1], 0), pb_rye.reduce((a, q) => a + q[2], 0)], true, [2, 3]);

    // 2. Finansiële posisie
    const fp = blad("Finansiële posisie", `Staat van finansiële posisie op ${datum_teks(x.tot)}`, kolomme, [44, 16, 16]);
    const vv = (veld) => (v ? v[veld] : 0);
    [["Bates"], twee("Toerusting", 0, 0), twee("Debiteure", x.deb_sent, vv("deb_sent")), twee("Kontant in die bank", x.bank_sent, vv("bank_sent")),
      twee("Totale bates", x.bates, vv("bates")), [""], ["Laste"], twee("Krediteure", x.kred_sent, vv("kred_sent")),
      twee("Lenings van direkteure", 0, 0), twee("Ongebruikte toelaes", x.toelae_sent, vv("toelae_sent")),
      twee("Totale laste", x.laste, vv("laste")), [""], ["Fondse"], twee("Opgehoopte oorskot", x.fondse_einde, vv("fondse_einde")),
      twee("Laste en fondse", x.laste + x.fondse_einde, v ? v.laste + v.fondse_einde : 0)]
      .forEach((q) => ry(fp, q, q.length === 1 || /^Totale|^Laste en/.test(q[0]), [2, 3]));

    // 3. Inkomste en uitgawes
    const iu = blad("Inkomste en uitgawes", `Staat van inkomste en uitgawes vir die jaar geëindig ${datum_teks(x.tot)}`, kolomme, [44, 16, 16]);
    ry(iu, ["Inkomste"], true);
    s.ink.forEach((q) => ry(iu, twee(q.naam, q.nou, q.vorig), false, [2, 3]));
    if (x.toelae_uitgestel || (v && v.toelae_uitgestel)) ry(iu, twee("Min: toelaes nog nie bestee nie", -x.toelae_uitgestel, v ? -v.toelae_uitgestel : 0), false, [2, 3]);
    ry(iu, twee("Totale inkomste", x.inkomste_sent, vv("inkomste_sent")), true, [2, 3]);
    if (s.projek.length) { ry(iu, [s.proj_naam], true); s.projek.forEach((q) => ry(iu, twee(q.naam, q.nou, q.vorig), false, [2, 3])); }
    if (s.bedryf.length) { ry(iu, ["Bedryfskoste"], true); s.bedryf.forEach((q) => ry(iu, twee(q.naam, q.nou, q.vorig), false, [2, 3])); }
    ry(iu, twee("Totale uitgawes", x.uitgawes_sent, vv("uitgawes_sent")), true, [2, 3]);
    ry(iu, twee("Oorskot vir die jaar", x.oorskot, vv("oorskot")), true, [2, 3]);

    // 4. Veranderinge in fondse
    const vf = blad("Veranderinge in fondse", "Staat van veranderinge in fondse", kolomme, [44, 16, 16]);
    ry(vf, twee("Aan die begin van die jaar", x.fondse_begin, vv("fondse_begin")), false, [2, 3]);
    ry(vf, twee("Oorskot vir die jaar", x.oorskot, vv("oorskot")), false, [2, 3]);
    ry(vf, twee("Aan die einde van die jaar", x.fondse_einde, vv("fondse_einde")), true, [2, 3]);

    // 5. Kontantvloei
    const kv = blad("Kontantvloei", `Kontantvloeistaat vir die jaar geëindig ${datum_teks(x.tot)}`, kolomme, [44, 16, 16]);
    [twee("Oorskot vir die jaar", x.oorskot, vv("oorskot")), twee("Toename in debiteure", -x.d_deb, v ? -v.d_deb : 0),
      twee("Toename in krediteure", x.d_kred, vv("d_kred")), twee("Toename in ongebruikte toelaes", x.d_toelae, vv("d_toelae")),
      twee("Kontant uit bedrywighede", x.bedryf_kontant, vv("bedryf_kontant")), twee("Toerusting gekoop", 0, 0),
      twee("Lenings van direkteure", 0, 0), twee("Onverklaarde verskil", x.verskil_kontant, vv("verskil_kontant")),
      twee("Beweging in kontant", x.bank_sent - x.bank_vorig, v ? v.bank_sent - v.bank_vorig : 0),
      twee("Kontant aan die begin", x.bank_vorig, vv("bank_vorig")), twee("Kontant aan die einde", x.bank_sent, vv("bank_sent"))]
      .forEach((q) => ry(kv, q, /^Kontant uit|^Kontant aan die einde/.test(q[0]), [2, 3]));
    kv.addRow([]);
    kv.addRow([bank_bron_teks(x)]);

    // 6. Aansluiting
    const vo = v || { deb_sent: 0, kred_sent: 0 };
    const aa = blad("Kontant na toevalling", "Van kontant na toevalling", ["", "Inkomste", "Uitgawes", "Oorskot"], [52, 16, 16, 16]);
    [["Volgens die staat van ontvangste en betalings", x.kontant_in_sent, x.kontant_uit_sent, x.kontant_in_sent - x.kontant_uit_sent],
      ["Min debiteure aan die begin", -vo.deb_sent, 0, -vo.deb_sent],
      ["Plus debiteure aan die einde", x.deb_sent, 0, x.deb_sent],
      ["Min krediteure aan die begin", 0, -vo.kred_sent, vo.kred_sent],
      ["Plus krediteure aan die einde", 0, x.kred_sent, -x.kred_sent],
      ["Min: toelaes nog nie bestee nie", -x.toelae_uitgestel, 0, -x.toelae_uitgestel],
      ["Volgens die finansiële state", x.inkomste_sent, x.uitgawes_sent, x.oorskot]]
      .forEach((q, i, l) => ry(aa, q, i === 0 || i === l.length - 1, [2, 3, 4]));

    // 7. Debiteure en krediteure
    const dk = blad("Debiteure en krediteure", `Uitstaande op ${datum_teks(x.tot)}`, ["Soort", "Faktuur", "Wie", "Datum", "Bedrag", "Betaal op"], [12, 14, 36, 13, 16, 13]);
    x.deb_lys.forEach((d) => ry(dk, ["Debiteur", d.nommer, d.klient, d.datum, d.bedrag_sent, d.betaal_op || "nog oop"], false, [5]));
    x.kred_lys.forEach((d) => ry(dk, ["Krediteur", d.nommer, d.ontvanger, d.datum, d.bedrag_sent, d.betaal_op || "nog oop"], false, [5]));

    // 8. Los bates
    const lb = blad("Los bates", "Betalings onder Los bates (as uitgawe hanteer)", ["Datum", "Beskrywing", "Bedrag", "Bate? (ja/nee)"], [13, 52, 16, 16]);
    x.los_bates.forEach((l) => ry(lb, [l.datum, l.beskrywing, l.bedrag_sent, ""], false, [3]));

    // 9. Besonderhede
    const bs = blad("Besonderhede", "Maatskappybesonderhede", null, [30, 60]);
    const M = MAATSKAPPY;
    [["Naam", M.naam], ["Registrasienommer", M.reg_nr], ["Soort", M.soort], ["Belastingnommer", M.belasting_nr],
      ["Geregistreer", datum_teks(M.geregistreer)], ["Jaareinde", M.jaareinde], ["Geregistreerde kantoor", M.kantoor],
      ["Posadres", M.pos], ["Bankier", M.bank], [""], ["Direkteure", ""]].forEach((q) => bs.addRow(q));
    direkteure_vir(s.jaar).forEach((d) => bs.addRow([d.naam, `aangestel ${datum_teks(d.aangestel)}${d.stand === "later" ? " (ná die jaareinde)" : ""}`]));
    bs.addRow([]);
    bs.addRow(["Notas"]).font = { bold: true };
    notas(s).forEach((n, i) => bs.addRow([`${i + 1}. ${n[0]}`, n[1]]));
    bs.getColumn(2).alignment = { wrapText: true, vertical: "top" };

    const buf = await wb.xlsx.writeBuffer();
    jn_stuur_af(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `Future-Sharp-Finansiele-state-${s.jaar}-${String(s.jaar + 1).slice(2)}-voorlopig.xlsx`);
  }

  /* ═══ laai ═══ */

  async function laai(jaar) {
    AFS.jaar = jaar;
    const plek = document.getElementById("afs-inhoud");
    plek.innerHTML = `<p class="stelsel-boodskap">${o(t("fp_laai", "Word gelaai …"))}</p>`;
    const jare = [];
    for (let j = BEGIN_JAAR; j <= jaar; j++) jare.push(j);
    try {
      const [kat, wi, pj, je, ...per] = await Promise.all([
        vra("kry-fin-kategoriee"),
        vra("kry-werk-items"),
        vra("kry-projekte").catch(() => ({ projekte: [] })),
        vra("kry-jaareinde", "datums=" + jare.map((j) => grense(j).tot).join(",")),
        ...jare.map((j) => vra("kry-joernaal", `van=${grense(j).van}&tot=${grense(j).tot}`)),
        ...jare.map((j) => vra("kry-fin-bank", `van=${grense(j).van}&tot=${grense(j).tot}`)),
      ]);
      const joernaal = new Map(), bank = new Map();
      jare.forEach((j, i) => {
        joernaal.set(j, per[i]);
        bank.set(j, per[jare.length + i]);
      });
      AFS.rou = {
        kategoriee: Array.isArray(kat.kategoriee) ? kat.kategoriee : [],
        werk_items: Array.isArray(wi.items) ? wi.items : [],
        projekte: Array.isArray(pj.projekte) ? pj.projekte : [],
        jaareinde: je.datums || {},
        joernaal, bank,
      };
      AFS.s = bereken();
    } catch (fout) {
      console.error("Kon nie die finansiële state laai nie:", fout);
      plek.innerHTML = `<p class="stelsel-boodskap">${o(t("afs_laai_fout", "Kon nie die finansiële state laai nie."))} ${o(fout.message || "")}</p>`;
      AFS.s = null;
      return;
    }
    teken();
  }

  document.addEventListener("st-aansig", (e) => {
    AFS.oop = e.detail === "afs";
    if (AFS.oop && AFS.gereed && AFS.jaar === null) laai(Number(document.getElementById("afs-jaar").value));
  });

  document.addEventListener("DOMContentLoaded", async () => {
    const kies = document.getElementById("afs-jaar");
    if (!kies) return;
    let sessie = null;
    try { sessie = await identiteit_kry_huidige_sessie(); } catch { sessie = null; }
    if (!sessie || !identiteit_het_rol(sessie.gebruiker, "boekhouding")) return;

    // Net afgehandelde boekjare: die jaar wat nog loop, het nog nie 'n jaareinde nie.
    const vandag = new Date().toISOString().slice(0, 10);
    const laaste = boekjaar_van(vandag) - 1;
    for (let j = laaste; j >= BEGIN_JAAR; j--) {
      const op = document.createElement("option");
      op.value = j;
      op.textContent = `${j}/${String(j + 1).slice(2)}`;
      kies.appendChild(op);
    }
    kies.addEventListener("change", () => laai(Number(kies.value)));
    document.getElementById("afs-excel").addEventListener("click", werkboek);
    AFS.gereed = true;
    if (AFS.oop && AFS.jaar === null) laai(Number(kies.value));
  });
})();
