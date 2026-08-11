// public/js/outeur-staat.js
//
// Die "Staat"-afdeling van die outeurspaneelbord: wat die outeur se boeke
// in 'n gekose tydperk gedoen het.
//
// EIE LÊER, soos outeur-titels.js en outeur-besonderhede.js. outeur.js
// hanteer aanmelding en stuur `outeur-gereed`; hierdie lêer weet niks van
// aanmelding nie.
//
// DIT LAAI EERS WANNEER DIE OORTJIE OOPGEMAAK WORD. kry-my-staat.js loop
// elke bestelling deur, en 'n outeur wat net sy bestellings kom kyk, hoef
// nie daarvoor te betaal nie. Die eerste klik laai; daarna nie weer nie.
//
// DIE VENSTER WORD HIER GETEL, NIE OP DIE BEDIENER NIE. Die Function gee
// elke titel se syfers PER MAAND terug; die vier vinnige knoppies en die
// twee maandvelde tel bloot oor die gekose maande. Daarom is 'n verstelling
// onmiddellik en nie 'n nuwe oproep nie.
//
// HELE MAANDE, nie dae nie. Besigtigings bestaan net per maand
// (`besigtigings_maand`), en twee soorte tyd op een skerm — verkope per dag,
// besigtigings per maand — sou nie te verdedig wees nie.

const OS_FUNKSIE = "/.netlify/functions/kry-my-staat";

// Alles wat die bediener gestuur het. Bly staan sodat die venster verstel
// kan word sonder om weer te vra.
let OS_DATA = null;
let OS_GELAAI = false;

function os_vertaal(sleutel, terugval) {
  return window.t ? window.t(sleutel) : terugval;
}

function os_el(id) {
  return document.getElementById(id);
}

function os_rand(sent) {
  const bedrag = (Number(sent) || 0) / 100;
  return "R" + bedrag.toLocaleString("af-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Die twaalf maandname kom uit één sleutel, met | tussenin. Die blaaier se
// eie `toLocaleDateString("af-ZA")` is nie oral betroubaar vir Afrikaans
// nie, en 'n staat wat "August" sê op 'n Afrikaanse skerm lyk sleg.
function os_maand_name(sleutel) {
  const name = os_vertaal(
    "os_maande",
    "Januarie|Februarie|Maart|April|Mei|Junie|Julie|Augustus|September|Oktober|November|Desember"
  ).split("|");

  const stukke = String(sleutel || "").split("-");
  const nommer = Number(stukke[1]);
  if (!stukke[0] || !nommer || !name[nommer - 1]) return String(sleutel || "");
  return name[nommer - 1] + " " + stukke[0];
}

const OS_FORMAAT_ETIKETTE = {
  eboek: { sleutel: "formaat_eboek", terugval: "E-boek" },
  harde_kopie: { sleutel: "formaat_harde_kopie", terugval: "Harde kopie" },
  leen: { sleutel: "formaat_leen", terugval: "Leen" },
};

function os_formate_teks(formate) {
  return (formate || [])
    .map((naam) => {
      const e = OS_FORMAAT_ETIKETTE[naam];
      return e ? os_vertaal(e.sleutel, e.terugval) : naam;
    })
    .join(", ");
}

// --- Die venster ---

function os_huidige_maand() {
  return new Date().toISOString().slice(0, 7);
}

// Tel 'n titel se maande op binne die venster. Maande wat buite val, word
// eenvoudig oorgeslaan — 'n string-vergelyking werk hier omdat "2026-08"
// leksikografies presies soos 'n datum sorteer.
function os_tel_op(titel, van, tot) {
  let besigtigings = 0;
  let verkope = 0;
  let deel_sent = 0;

  Object.entries(titel.maande || {}).forEach(([maand, syfers]) => {
    if (maand < van || maand > tot) return;
    besigtigings += syfers.besigtigings || 0;
    verkope += syfers.verkope || 0;
    deel_sent += syfers.deel_sent || 0;
  });

  return { besigtigings, verkope, deel_sent };
}

function os_boodskap_ry(teks) {
  const ry = document.createElement("tr");
  const sel = document.createElement("td");
  sel.colSpan = 4;
  sel.className = "os-leeg";
  sel.textContent = teks;
  ry.appendChild(sel);
  return ry;
}

// Wat op die skerm staan ná die laaste teken. Die Excel-uitvoer gebruik
// presies dit — die lêer en die skerm mag nooit verskil nie.
let OS_SIGBAAR = { van: "", tot: "", rye: [], totale: null };

function os_teken() {
  const lyf = os_el("os-lyf");
  if (!lyf || !OS_DATA) return;

  const van = os_el("os-van").value || "0000-01";
  const tot = os_el("os-tot").value || "9999-12";

  lyf.innerHTML = "";

  if (van > tot) {
    lyf.appendChild(
      os_boodskap_ry(os_vertaal("os_omgekeer", "Die begin van die tydperk l\u00ea n\u00e1 die einde."))
    );
    os_stel_totale(null);
    OS_SIGBAAR = { van, tot, rye: [], totale: null };
    return;
  }

  const rye = [];
  OS_DATA.titels.forEach((titel) => {
    const syfers = os_tel_op(titel, van, tot);

    // 'n Titel sonder enige beweging in die venster hoort nie in die staat
    // nie — dit is ruis, nie inligting nie.
    if (!syfers.besigtigings && !syfers.verkope && !syfers.deel_sent) return;

    rye.push({
      titel: titel.titel || "",
      formate: os_formate_teks(titel.formate),
      ...syfers,
    });
  });

  if (!rye.length) {
    lyf.appendChild(
      os_boodskap_ry(os_vertaal("os_geen", "Geen beweging in hierdie tydperk nie."))
    );
  }

  rye.forEach((r) => {
    const ry = document.createElement("tr");

    const eerste = document.createElement("td");
    const naam = document.createElement("span");
    naam.className = "os-titel";
    naam.textContent = r.titel;
    eerste.appendChild(naam);

    if (r.formate) {
      const fyn = document.createElement("span");
      fyn.className = "os-fyn";
      fyn.textContent = r.formate;
      eerste.appendChild(fyn);
    }
    ry.appendChild(eerste);

    [String(r.besigtigings), String(r.verkope), os_rand(r.deel_sent)].forEach((waarde) => {
      const sel = document.createElement("td");
      sel.className = "os-r";
      sel.textContent = waarde;
      ry.appendChild(sel);
    });

    lyf.appendChild(ry);
  });

  const totale = {
    besigtigings: rye.reduce((s, r) => s + r.besigtigings, 0),
    verkope: rye.reduce((s, r) => s + r.verkope, 0),
    deel_sent: rye.reduce((s, r) => s + r.deel_sent, 0),
    titels_met_verkope: rye.filter((r) => r.verkope > 0).length,
  };

  os_stel_totale(totale);

  const onder = os_el("os-tydperk-teks");
  if (onder) {
    onder.textContent =
      van === tot
        ? os_maand_name(van)
        : os_maand_name(van) + " " + os_vertaal("os_tot_woord", "tot") + " " + os_maand_name(tot);
  }

  // Die nota verskyn NET wanneer die venster maande raak waarvoor daar geen
  // besigtigingsdata bestaan nie. Andersins is dit 'n verskoning vir 'n
  // probleem wat nie op die skerm is nie.
  //
  // Die MAAND kom uit die bediener se antwoord, nie uit die sin nie —
  // tel-produk-besigtiging.js besluit wanneer die data begin, en die skerm
  // sê net wat hy gestuur het.
  const nota = os_el("os-nota");
  const vanaf = OS_DATA.besigtigings_vanaf || "";
  if (nota) {
    nota.style.display = vanaf && van < vanaf ? "" : "none";
    if (vanaf) {
      nota.textContent =
        os_vertaal("os_nota_vanaf", "Besigtigings word per maand gehou sedert") +
        " " +
        os_maand_name(vanaf) +
        ". " +
        os_vertaal(
          "os_nota_daarvoor",
          "Maande daarvoor wys geen besigtigings nie, al was daar wel verkope."
        );
    }
  }

  OS_SIGBAAR = { van, tot, rye, totale };
}

function os_stel_totale(totale) {
  const leeg = "\u2014";

  const stel = (id, waarde) => {
    const el = os_el(id);
    if (el) el.textContent = waarde;
  };

  stel("os-s-verkope", totale ? String(totale.verkope) : leeg);
  stel("os-s-deel", totale ? os_rand(totale.deel_sent) : leeg);
  stel("os-s-besigtigings", totale ? String(totale.besigtigings) : leeg);
  stel("os-s-titels", totale ? String(totale.titels_met_verkope) : leeg);

  stel("os-t-besigtigings", totale ? String(totale.besigtigings) : "");
  stel("os-t-verkope", totale ? String(totale.verkope) : "");
  stel("os-t-deel", totale ? os_rand(totale.deel_sent) : "");
}

// maande = 0 beteken alles. "Alles" begin by die vroegste maand waarvoor
// daar werklik iets is, nie by 'n versinne datum nie — 'n staat wat by
// Januarie 2020 begin, lyk of daar vier jaar se stilte was.
function os_stel_venster(maande) {
  const nou = new Date();
  const tot = os_huidige_maand();
  os_el("os-tot").value = tot;

  if (maande === 0) {
    let vroegste = tot;
    (OS_DATA ? OS_DATA.titels : []).forEach((t) => {
      Object.keys(t.maande || {}).forEach((m) => {
        if (m < vroegste) vroegste = m;
      });
    });
    os_el("os-van").value = vroegste;
  } else {
    const d = new Date(Date.UTC(nou.getUTCFullYear(), nou.getUTCMonth() - (maande - 1), 1));
    os_el("os-van").value = d.toISOString().slice(0, 7);
  }

  os_teken();
}

function os_merk_vinnig(knoppie) {
  document.querySelectorAll("#os-vinnig button").forEach((k) => k.classList.remove("aktief"));
  if (knoppie) knoppie.classList.add("aktief");
}

// --- Laai ---

function os_status(teks) {
  const el = os_el("outeur-staat-status");
  if (!el) return;
  el.textContent = teks || "";
}

async function os_laai() {
  if (OS_GELAAI) return;
  OS_GELAAI = true;

  os_status(os_vertaal("os_laai", "Laai\u2026"));

  try {
    const sessie = await identiteit_kry_huidige_sessie();
    if (!sessie || !sessie.access_token) {
      OS_GELAAI = false;
      os_status(os_vertaal("sessie_verval", "Jou sessie het verval. Meld asseblief weer aan."));
      return;
    }

    const resp = await fetch(OS_FUNKSIE, {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });

    if (resp.status === 401) {
      OS_GELAAI = false;
      if (typeof wys_sessie_verval === "function") {
        wys_sessie_verval(os_el("outeur-staat-status"), "/outeur.html");
      } else {
        os_status(os_vertaal("sessie_verval", "Jou sessie het verval. Meld asseblief weer aan."));
      }
      return;
    }

    if (!resp.ok) {
      OS_GELAAI = false;
      os_status(os_vertaal("os_laai_fout", "Kon nie jou staat laai nie. Herlaai die bladsy."));
      return;
    }

    OS_DATA = await resp.json();
    os_status("");

    const inhoud = os_el("os-inhoud");
    if (inhoud) inhoud.hidden = false;

    // Verstek: die laaste drie maande. Lank genoeg om 'n neiging te wys,
    // kort genoeg om nog oor die huidige maand te gaan.
    os_merk_vinnig(document.querySelector('#os-vinnig button[data-maande="3"]'));
    os_stel_venster(3);
  } catch (fout) {
    OS_GELAAI = false;
    console.error("Kon nie die staat laai nie:", fout);
    os_status(os_vertaal("fout_netwerk", "Kon nie verbind nie. Kontroleer jou verbinding en probeer weer."));
  }
}

// --- Excel ---
//
// Dieselfde patroon as die paneelbord se bestellings-uitvoer: 'n kop-area
// met die logo, teal koppe, en 'n wisselende ligte agtergrond. Wat hier
// VERSKIL is dat daar geen tweede blad met 'n verdeling-opsplitsing is nie
// — 'n outeur sien sy eie deel, nooit hoe die res verdeel word nie.

function os_array_buffer_na_base64(buffer) {
  let binêr = "";
  const grepe = new Uint8Array(buffer);
  const brok = 0x8000;
  for (let i = 0; i < grepe.length; i += brok) {
    binêr += String.fromCharCode.apply(null, grepe.subarray(i, i + brok));
  }
  return btoa(binêr);
}

async function os_laai_af_as_excel() {
  const knoppie = os_el("os-uitvoer");
  const oorspronklike = knoppie.textContent;

  if (!OS_SIGBAAR.rye.length) {
    alert(os_vertaal("os_geen", "Geen beweging in hierdie tydperk nie."));
    return;
  }

  knoppie.disabled = true;
  knoppie.textContent = os_vertaal("os_besig", "Word saamgestel \u2026");

  const TEAL = "FF3FB6A4";
  const TEAL_DONKER = "FF0F5257";
  const KORAAL = "FFEC5832";
  const GRYS_LIG = "FFF5F4F1";
  const GRYS_TEKS = "FF5B5B5B";
  const WIT = "FFFFFFFF";

  try {
    const werkboek = new ExcelJS.Workbook();
    werkboek.creator = "Future Shop";
    werkboek.created = new Date();

    let logo_id = null;
    try {
      const resp = await fetch("/icons/paneel-ikoon-512.png");
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      const basis64 = os_array_buffer_na_base64(await resp.arrayBuffer());
      logo_id = werkboek.addImage({ base64: `data:image/png;base64,${basis64}`, extension: "png" });
    } catch (logo_fout) {
      // Nie krities nie — 'n staat sonder logo is steeds 'n staat.
      console.warn("Kon nie die logo laai nie; gaan sonder voort:", logo_fout);
    }

    const blad = werkboek.addWorksheet(os_vertaal("os_nav_staat", "Staat"));
    blad.getColumn(1).width = 4;
    blad.getRow(1).height = 20;
    blad.getRow(2).height = 20;
    blad.getRow(3).height = 20;

    if (logo_id) {
      blad.addImage(logo_id, { tl: { col: 0.1, row: 0.1 }, ext: { width: 56, height: 56 } });
    }

    blad.getCell("C1").value = "FUTURE SHARP — FUTURE SHOP";
    blad.getCell("C1").font = { bold: true, size: 14, color: { argb: TEAL_DONKER } };

    blad.getCell("C2").value =
      os_vertaal("os_excel_kop", "Outeursstaat") + " — " + (OS_DATA.outeur_naam || "");
    blad.getCell("C2").font = { bold: true, size: 12, color: { argb: KORAAL } };

    const tydperk =
      OS_SIGBAAR.van === OS_SIGBAAR.tot
        ? os_maand_name(OS_SIGBAAR.van)
        : os_maand_name(OS_SIGBAAR.van) +
          " " +
          os_vertaal("os_tot_woord", "tot") +
          " " +
          os_maand_name(OS_SIGBAAR.tot);

    blad.getCell("C3").value = `${tydperk}  \u00b7  ${new Date().toLocaleDateString("af-ZA")}`;
    blad.getCell("C3").font = { italic: true, size: 9, color: { argb: GRYS_TEKS } };

    const kop_ry = 5;
    const etikette = [
      "",
      os_vertaal("os_kol_titel", "Titel"),
      os_vertaal("os_kol_formate", "Formate"),
      os_vertaal("os_som_besigtigings", "Besigtigings"),
      os_vertaal("os_som_verkope", "Verkope"),
      os_vertaal("os_som_deel", "Jou deel") + " (R)",
    ];

    const kop = blad.getRow(kop_ry);
    etikette.forEach((etiket, i) => {
      const sel = kop.getCell(i + 1);
      sel.value = etiket;
      sel.font = { bold: true, color: { argb: WIT } };
      sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
      sel.alignment = { vertical: "middle" };
    });
    kop.commit();

    OS_SIGBAAR.rye.forEach((r, i) => {
      const ry = blad.getRow(kop_ry + 1 + i);
      ["", r.titel, r.formate, r.besigtigings, r.verkope, Number((r.deel_sent / 100).toFixed(2))]
        .forEach((w, kol) => (ry.getCell(kol + 1).value = w));

      if (i % 2 === 1) {
        for (let kol = 2; kol <= etikette.length; kol++) {
          ry.getCell(kol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRYS_LIG } };
        }
      }
      ry.commit();
    });

    const totaal_ry = blad.getRow(kop_ry + 1 + OS_SIGBAAR.rye.length);
    const t = OS_SIGBAAR.totale;
    [
      "",
      os_vertaal("os_totaal", "Totaal"),
      "",
      t.besigtigings,
      t.verkope,
      Number((t.deel_sent / 100).toFixed(2)),
    ].forEach((w, kol) => {
      const sel = totaal_ry.getCell(kol + 1);
      sel.value = w;
      sel.font = { bold: true, color: { argb: TEAL_DONKER } };
    });
    totaal_ry.commit();

    // Twee sente, deurgaans. 'n Staat waarteen iemand sy bankstaat hou, mag
    // nie "31" wys waar dit R31,00 is nie.
    blad.getColumn(6).numFmt = "#,##0.00";

    // Elke kolom afsonderlik. 'n Toekenning aan blad.columns VERVANG die
    // blad se hele kolom-model, en die ingebedde logo gaan saam verlore —
    // dit is presies hoekom die eerste uitvoer sonder logo uitgekom het.
    [4, 40, 26, 14, 12, 14].forEach((breedte, i) => {
      blad.getColumn(i + 1).width = breedte;
    });

    const buffer = await werkboek.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const skakel = document.createElement("a");
    skakel.href = url;
    skakel.download = `Future-Shop-Staat-${OS_SIGBAAR.van}-tot-${OS_SIGBAAR.tot}.xlsx`;
    document.body.appendChild(skakel);
    skakel.click();
    skakel.remove();
    URL.revokeObjectURL(url);
  } catch (fout) {
    console.error("Kon nie die Excel-lêer saamstel nie:", fout);
    alert(os_vertaal("os_excel_fout", "Kon nie die Excel-l\u00eaer saamstel nie \u2014 probeer weer."));
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = oorspronklike;
  }
}

// --- Aansluit ---

function os_stel_op() {
  // Die oortjie se eie knoppie. outeur-titels.js se algemene hanteerder wys
  // die afdeling; hierdie een laai die data die EERSTE keer. Twee
  // hanteerders op dieselfde knoppie is in orde, en dit hou
  // outeur-titels.js onaangeraak.
  const pil = document.querySelector('.outeur-pil[data-gaan="staat"]');
  if (pil) pil.addEventListener("click", os_laai);

  document.querySelectorAll("#os-vinnig button").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      os_merk_vinnig(knoppie);
      os_stel_venster(Number(knoppie.getAttribute("data-maande")));
    });
  });

  // Verstel iemand die maande self, is geen vinnige knoppie meer waar nie.
  ["os-van", "os-tot"].forEach((id) => {
    const el = os_el(id);
    if (!el) return;
    el.addEventListener("change", () => {
      os_merk_vinnig(null);
      os_teken();
    });
  });

  const uitvoer = os_el("os-uitvoer");
  if (uitvoer) uitvoer.addEventListener("click", os_laai_af_as_excel);

  const druk = os_el("os-druk");
  if (druk) druk.addEventListener("click", () => window.print());
}

document.addEventListener("outeur-gereed", os_stel_op);
