// public/js/faktuurpaneel-projekkaart.js
// Weergawe 1 (17 Oktober 2026).
//
// DIE PROJEKKAART: die stand van een projek se finansies in een oogopslag.
// Oopgemaak met die Finansies-knoppie in die Projekte-register.
//
// GEEN NUWE FUNCTION NIE, dieselfde rede as die staat: die kaart tel op wat
// kry-joernaal.js reeds gee, gefiltreer op `projek_id`. Wat op die joernaal
// staan, staan hier.
//
// DRIE BRONNE
//   kry-joernaal     elke inskrywing met hierdie projek, plus die debiteure
//                    (gefaktureer, nog nie betaal nie) en die krediteure
//                    (vergoeding wat nog uitbetaal moet word)
//   kry-fakture      wat op die projek gefaktureer is
//   kry-toekennings  wat 'n befondser toegesê het (net by toelae en borgskap)
//
// TWEE GEDAANTES
//   Toelae of skenking  Toegeken, Ontvang, Bestee, Nog te bestee, en hoe ver
//                       die geld en die tyd al gevorder het. Die geld is beperk
//                       tot die projek; wat nie bestee is nie, is nie vry nie.
//   Fooie en borgskap   die geld van faktuur tot by die organisasie:
//                       Gefaktureer, Ontvang, Projekkoste, Oor na projekkoste.
//
// DIE TYDPERK is van 1 Maart 2024 (die eerste boekjaar in die stelsel) tot
// vandag, sodat 'n projek wat oor boekjare loop, heel is.
//
// Voorvoegsel `pk_`.

(function () {
  const BEGIN = "2024-03-01";

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
  function datum(d) { return d ? String(d).slice(0, 10).replace(/-/g, "/") : ""; }
  function vandag() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  async function vra(naam, vraag) {
    const resp = await fetch("/.netlify/functions/" + naam + (vraag ? "?" + vraag : ""),
      { headers: await identiteit_kop() });
    if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
    return resp.json();
  }
  function pct(deel, geheel) {
    if (!(geheel > 0)) return 0;
    return Math.max(0, Math.min(100, Math.round((deel / geheel) * 100)));
  }

  const FIN = {
    fooie: ["pj_fin_fooie", "Fooie vir dienste"],
    toelae: ["pj_fin_toelae", "Toelae of skenking"],
    borgskap: ["pj_fin_borgskap", "Borgskap"],
  };
  const INST = {
    skole: ["pj_inst_skole", "Skole"],
    ouers: ["pj_inst_ouers", "Ouers en individue"],
    hoer: ["pj_inst_hoer", "Hoër onderwys"],
    korporatief: ["pj_inst_korporatief", "Korporatief"],
  };

  /* ═══ die venster ═══ */

  function venster() {
    let v = document.getElementById("pk-vorm");
    if (v) return v;
    v = document.createElement("div");
    v.className = "fk-oorlegsel";
    v.id = "pk-vorm";
    v.innerHTML = `<div class="fk-venster pk-venster"><div id="pk-inhoud"></div>
      <div class="fk-knoppies"><button type="button" class="kaart-aksie wi-stil" id="pk-toe">${
        o(t("pk_toe", "Maak toe"))}</button></div></div>`;
    document.body.appendChild(v);
    v.addEventListener("click", (ev) => { if (ev.target === v) maak_toe(); });
    v.querySelector("#pk-toe").addEventListener("click", maak_toe);
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && v.classList.contains("oop")) maak_toe();
    });
    return v;
  }
  function maak_toe() {
    const v = document.getElementById("pk-vorm");
    if (v) v.classList.remove("oop");
  }

  /* ═══ die optelling ═══ */

  function tel(p, joernaal, fakture, toekennings) {
    const id = p.id;
    const inskr = (joernaal.inskrywings || []).filter((r) => r.projek_id === id);
    const deb = (joernaal.debiteure || []).filter((r) => r.projek_id === id);
    const kred = (joernaal.krediteure || []).filter((r) => r.projek_id === id);
    const fak = (fakture || []).filter((f) => f.projek_id === id && (f.stand === "gestuur" || f.stand === "betaal"));

    const som = (lys) => lys.reduce((a, r) => a + (Number(r.bedrag_sent) || 0), 0);
    const ontvang = som(inskr.filter((r) => r.rigting === "in"));
    const uit = inskr.filter((r) => r.rigting === "uit");
    const vergoeding = som(uit.filter((r) => r.bron === "uitbetaling"));
    const ander_koste = som(uit.filter((r) => r.bron !== "uitbetaling"));
    return {
      inskr: inskr.slice().sort((a, b) => String(a.datum).localeCompare(String(b.datum))),
      deb, kred,
      gefaktureer: fak.reduce((a, f) => a + (Number(f.totaal_sent) || 0), 0),
      fakture_tel: fak.length,
      ontvang,
      vergoeding,
      ander_koste,
      koste: vergoeding + ander_koste,
      uitstaande: som(deb),
      verskuldig: som(kred),
      toegeken: (toekennings || []).reduce((a, x) => a + (Number(x.bedrag_sent) || 0), 0),
    };
  }

  /* ═══ die teken ═══ */

  function teel(etiket, bedrag, klein, let_op) {
    return `<div class="pk-teel${let_op ? " pk-let-op" : ""}"><span>${o(etiket)}</span><b>${rand(bedrag)}</b>${
      klein ? `<small>${o(klein)}</small>` : ""}</div>`;
  }
  function staaf(etiket, regs, w, soort) {
    return `<div class="pk-ry"><span>${o(etiket)}</span><span>${o(regs)}</span></div>
      <div class="pk-staaf"><i class="${soort || ""}" style="width:${w}%"></i></div>`;
  }

  function kop(p) {
    const fin = FIN[p.finansiering || "fooie"] || FIN.fooie;
    const inst = INST[p.instansie];
    const besonder = [
      `<span class="pj-fin-merk pj-fin-${o(p.finansiering || "fooie")}">${o(t(fin[0], fin[1]))}</span>`,
      inst ? o(t(inst[0], inst[1])) : "",
      p.vir_wie ? o(p.vir_wie_naam || p.vir_wie) : "",
      p.van || p.tot ? o(`${datum(p.van) || "…"} ${t("pj_tot_kort", "tot")} ${datum(p.tot) || "…"}`) : "",
    ].filter(Boolean).join(" · ");
    return `<div class="pk-kop"><div><h2>${p.nr ? `<span class="pk-nr">${o(p.nr)}</span>` : ""}${o(p.naam)}</h2>
      <div class="pk-besonder">${besonder}</div></div>
      <span class="pk-stand${p.aktief === false ? " af" : ""}">${o(p.aktief === false
        ? t("pj_onaktief", "Onaktief") : t("pk_aktief", "Aktief"))}</span></div>`;
  }

  function teken_toelae(p, s) {
    const nog_bestee = s.ontvang - s.koste;
    const nog_ontvang = s.toegeken - s.ontvang;
    let tyd = "";
    if (p.van && p.tot) {
      const a = new Date(p.van).getTime();
      const b = new Date(p.tot).getTime();
      const n = Date.now();
      const w = b > a ? pct(n - a, b - a) : 0;
      tyd = staaf(t("pk_tyd", "Tyd verstreke"), `${w}%`, w, "grys");
    }
    return `<div class="pk-teels">
        ${teel(t("pk_toegeken", "Toegeken"), s.toegeken,
          s.toegeken ? "" : t("pk_geen_toekenning", "Nog geen toekenning nie"))}
        ${teel(t("pk_ontvang", "Ontvang"), s.ontvang,
          nog_ontvang > 0 ? t("pk_nog_ontvang", "{r} nog te ontvang").replace("{r}", rand(nog_ontvang)) : "")}
        ${teel(t("pk_bestee", "Bestee"), s.koste,
          s.toegeken ? t("pk_van_toegeken", "{p}% van die toekenning").replace("{p}", pct(s.koste, s.toegeken)) : "")}
        ${teel(t("pk_nog_bestee", "Nog te bestee"), nog_bestee, t("pk_van_ontvang", "van wat ontvang is"), nog_bestee > 0)}
      </div>
      <div class="pk-vord">
        ${s.toegeken ? staaf(t("pk_st_ontvang", "Ontvang van die toekenning"),
          `${rand(s.ontvang)} ${t("pk_van", "van")} ${rand(s.toegeken)}`, pct(s.ontvang, s.toegeken)) : ""}
        ${staaf(t("pk_st_bestee", "Bestee van wat ontvang is"),
          `${rand(s.koste)} ${t("pk_van", "van")} ${rand(s.ontvang)}`, pct(s.koste, s.ontvang), "k")}
        ${tyd}
      </div>`;
  }

  function teken_fooie(p, s) {
    const oor = s.ontvang - s.koste;
    return `<div class="pk-vloei">
        ${teel(t("pk_gefaktureer", "Gefaktureer"), s.gefaktureer,
          (s.fakture_tel === 1 ? t("pk_faktuur_een", "1 faktuur") : t("pk_fakture", "{n} fakture").replace("{n}", s.fakture_tel)))}
        <span class="pk-pyl">→</span>
        ${teel(t("pk_ontvang", "Ontvang"), s.ontvang,
          s.uitstaande > 0 ? t("pk_uitstaande", "{r} nog uitstaande").replace("{r}", rand(s.uitstaande))
            : t("pk_niks_uitstaande", "niks uitstaande nie"), s.uitstaande > 0)}
        <span class="pk-pyl">→</span>
        ${teel(t("pk_koste", "Projekkoste"), s.koste,
          s.verskuldig > 0 ? t("pk_verskuldig", "{r} vergoeding nog verskuldig").replace("{r}", rand(s.verskuldig))
            : t("pk_niks_verskuldig", "niks nog verskuldig nie"), s.verskuldig > 0)}
        <span class="pk-pyl">→</span>
        ${teel(t("pk_oor", "Oor ná projekkoste"), oor,
          s.ontvang > 0 ? t("pk_oor_pct", "{p}% vir die organisasie").replace("{p}", pct(oor, s.ontvang)) : "")}
      </div>
      ${s.koste ? `<p class="pk-onder">${o(t("pk_koste_uit", "Projekkoste: {v} vergoeding vir projekwerk, {a} ander koste.")
        .replace("{v}", rand(s.vergoeding)).replace("{a}", rand(s.ander_koste)))}</p>` : ""}`;
  }

  function teken_nog(s) {
    const reels = [
      ...s.deb.map((d) => `<tr><td>${o(t("pk_nog_klient", "Nog nie betaal nie: {n}").replace("{n}", `${d.nommer || ""} ${d.klient || ""}`.trim()))}</td><td class="n">${rand(d.bedrag_sent)}</td></tr>`),
      ...s.kred.map((k) => `<tr><td>${o(t("pk_nog_vergoed", "Vergoeding nog uit te betaal: {o} ({n})").replace("{o}", k.ontvanger || "").replace("{n}", k.nommer || ""))}</td><td class="n">${rand(k.bedrag_sent)}</td></tr>`),
    ];
    if (!reels.length) return "";
    return `<h4>${o(t("pk_nog_kop", "Wat nog moet gebeur"))}</h4>
      <div class="pk-tabel"><table>${reels.join("")}</table></div>`;
  }

  function teken_inskrywings(s) {
    if (!s.inskr.length) {
      return `<p class="pk-leeg">${o(t("pk_geen_inskr",
        "Nog geen geld op hierdie projek nie. Kies die projek op 'n faktuur, of by 'n banktransaksie wat reeds 'n kategorie het."))}</p>`;
    }
    return `<h4>${o(t("pk_inskr_kop", "Transaksies"))}</h4>
      <div class="pk-tabel"><table>
        <tr><th>${o(t("bs_h_datum", "Datum"))}</th><th>${o(t("bs_h_beskr", "Beskrywing"))}</th>
          <th class="n">${o(t("bs_h_in", "In"))}</th><th class="n">${o(t("bs_h_uit", "Uit"))}</th></tr>
        ${s.inskr.map((r) => `<tr><td class="pk-dat">${datum(r.datum)}</td><td>${o(r.beskrywing)}</td>
          <td class="n">${r.rigting === "in" ? rand(r.bedrag_sent) : ""}</td>
          <td class="n pk-uit">${r.rigting === "uit" ? rand(r.bedrag_sent) : ""}</td></tr>`).join("")}
      </table></div>`;
  }

  async function maak_oop(p) {
    const v = venster();
    const plek = v.querySelector("#pk-inhoud");
    plek.innerHTML = kop(p) + `<p class="stelsel-boodskap">${o(t("fp_laai", "Word gelaai …"))}</p>`;
    v.classList.add("oop");

    const met_tk = (p.finansiering || "fooie") !== "fooie";
    try {
      const [joernaal, fak, tk] = await Promise.all([
        vra("kry-joernaal", `van=${BEGIN}&tot=${vandag()}`),
        vra("kry-fakture"),
        met_tk ? vra("kry-toekennings", "projek=" + encodeURIComponent(p.id)) : Promise.resolve({}),
      ]);
      const fakture = Array.isArray(fak.fakture) ? fak.fakture : [];
      const toekennings = Array.isArray(tk.toekennings) ? tk.toekennings : [];
      const s = tel(p, joernaal, fakture, toekennings);
      plek.innerHTML = kop(p) +
        ((p.finansiering === "toelae") ? teken_toelae(p, s) : teken_fooie(p, s)) +
        teken_nog(s) + teken_inskrywings(s);
    } catch (fout) {
      console.error("Kon nie die projekkaart laai nie:", fout);
      plek.innerHTML = kop(p) + `<p class="stelsel-boodskap">${o(t("pk_laai_fout", "Kon nie die projek se finansies laai nie."))}</p>`;
    }
  }

  window.pk_maak_oop = maak_oop;
})();
