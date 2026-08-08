// public/js/paneel-goedkeuring.js
//
// Die Indienings-afdeling in die paneelbord: wat wag, wat op die rak is, en
// wat 'n outeur nog aan werk.
//
// HIERDIE RONDTE IS LEES-ALLEEN. Keur goed en Stuur terug met 'n opmerking
// kom in die volgende stuk. Wat hier moet werk, is dat sy alles kan SIEN wat
// sy nodig het om te besluit — insluitend die manuskrip self.
//
// DIE LÊERS KAN NIE MET 'N GEWONE SKAKEL OOPGEMAAK WORD NIE. 'n Manuskrip
// wat nog nie goedgekeur is nie, is die outeur se ongepubliseerde werk, en
// die Function vereis 'n rol. 'n <a href> stuur geen Authorization-kop nie,
// dus haal ons die lêer met fetch en maak 'n blob-URL.
//
// 'n WYSIGING WYS OU NAAS NUUT, net vir wat verander het. Die res is ruis —
// en 'n prysverandering kry sy eie merk, want dit is die enigste soort wat
// geld raak.
//
// paneelbord.js bly onaangeraak; kry_outorisasie_kop() kom daarvandaan.

let PG_INDIENINGS = [];
let PG_OOP = null;

const PG_GROEPE = [
  { sleutel: "wag", stande: ["ingedien", "wysiging"], i18n: "pg_groep_wag", verstek: "Wag vir hantering" },
  { sleutel: "goedgekeur", stande: ["goedgekeur"], i18n: "pg_groep_goedgekeur", verstek: "Goedgekeur — wag om opgestel te word" },
  { sleutel: "rak", stande: ["op_rak"], i18n: "pg_groep_rak", verstek: "Op die winkelrak" },
  { sleutel: "konsep", stande: ["konsep"], i18n: "pg_groep_konsep", verstek: "In proses by die outeur" },
];

const PG_MERKIES = {
  konsep: ["pg_merk_konsep", "In proses"],
  ingedien: ["pg_merk_ingedien", "Ingedien"],
  wysiging: ["pg_merk_wysiging", "Wysiging hangend"],
  goedgekeur: ["pg_merk_goedgekeur", "Goedgekeur"],
  op_rak: ["pg_merk_rak", "Op die rak"],
};

// Die vorm se velde, in die volgorde waarin hulle op die vorm staan. Wat nie
// hier is nie, word nie gewys nie — 'n nuwe veld moet hier bykom, en dit is
// doelbewus.
const PG_VELDE = [
  ["titel", "pg_v_titel", "Titel"],
  ["subtitel", "pg_v_subtitel", "Subtitel"],
  ["taal", "pg_v_taal", "Taal"],
  ["kategorie", "pg_v_kategorie", "Kategorie"],
  ["bladsye", "pg_v_bladsye", "Bladsye"],
  ["kort_beskrywing", "pg_v_kort", "Kort beskrywing"],
  ["volledige_beskrywing", "pg_v_vol", "Volledige beskrywing"],
  ["isbn_eboek", "pg_v_isbn_e", "ISBN — e-boek"],
  ["isbn_hardekopie", "pg_v_isbn_h", "ISBN — harde kopie"],
  ["aflewering.tyd", "pg_v_aflewertyd", "Afleweringstyd"],
  ["aflewering.gebiede", "pg_v_gebiede", "Gebiede"],
  ["aflewering.voorraad", "pg_v_voorraad", "Voorraad"],
  ["onderteken_naam", "pg_v_naam", "Onderteken deur"],
  ["onderteken_datum", "pg_v_datum", "Datum"],
];

const PG_FORMATE = [
  ["eboek", "pg_f_eboek", "E-boek"],
  ["hardekopie", "pg_f_hardekopie", "Harde kopie"],
  ["leen", "pg_f_leen", "Leen"],
];

// Dieselfde aannames as die outeur se vorm. Verskil hulle, verskil die prys
// wat sy sien van die prys wat hy gesien het.
const PG_OUTEUR_PCT = 70;
const PG_AANNAMES = { paystackPct: 2.9, paystackVaste: 1, btwPct: 15 };

function pg_t(sleutel, terugval) {
  return window.t ? window.t(sleutel) : terugval;
}

function pg_ontsnap(teks) {
  return String(teks === null || teks === undefined ? "" : teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pg_rand(bedrag) {
  return "R" + (Number(bedrag) || 0).toLocaleString("af-ZA", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function pg_datum(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("af-ZA", { year: "numeric", month: "short", day: "numeric" });
}

function pg_diep(voorwerp, pad) {
  return String(pad).split(".").reduce(
    (h, s) => (h && h[s] !== undefined ? h[s] : undefined),
    voorwerp
  );
}

// --- Die lys ---

function pg_kaart(r) {
  const merk = PG_MERKIES[r.stand] || ["", r.stand];
  const titel = r.titel || pg_t("pg_geen_titel", "Sonder titel");
  const datum = r.ingedien_op || r.gewysig_op;

  return (
    '<div class="pg-kaart" data-pg-nommer="' + pg_ontsnap(r.nommer) + '">' +
    '<div class="pg-kaart-teks">' +
    '<div class="pg-kaart-titel">' + pg_ontsnap(titel) + "</div>" +
    '<div class="pg-kaart-fyn">' + pg_ontsnap(r.nommer) +
    (r.outeur_naam ? " · " + pg_ontsnap(r.outeur_naam) : "") +
    " · " + pg_datum(datum) + "</div></div>" +
    '<span class="pg-merk pg-merk-' + pg_ontsnap(r.stand) + '">' +
    pg_ontsnap(pg_t(merk[0], merk[1])) + "</span></div>"
  );
}

function pg_teken_lys() {
  const wrap = document.getElementById("pg-lys");
  if (!wrap) return;

  if (!PG_INDIENINGS.length) {
    wrap.innerHTML = '<p class="stelsel-boodskap">' +
      pg_ontsnap(pg_t("pg_geen", "Daar is nog geen indienings nie.")) + "</p>";
    return;
  }

  let uit = "";
  PG_GROEPE.forEach((groep) => {
    const in_groep = PG_INDIENINGS.filter((r) => groep.stande.indexOf(r.stand) !== -1);
    if (!in_groep.length) return;
    uit += '<h3 class="pg-groep">' + pg_ontsnap(pg_t(groep.i18n, groep.verstek)) +
      ' <span class="pg-tel">' + in_groep.length + "</span></h3>";
    uit += in_groep.map(pg_kaart).join("");
  });

  wrap.innerHTML = uit;
}

async function pg_laai() {
  const wrap = document.getElementById("pg-lys");
  if (wrap) {
    wrap.innerHTML = '<p class="stelsel-boodskap">' +
      pg_ontsnap(pg_t("pg_laai", "Indienings word gelaai …")) + "</p>";
  }

  try {
    const resp = await fetch("/.netlify/functions/kry-indienings", {
      headers: kry_outorisasie_kop(),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const uit = await resp.json();
    PG_INDIENINGS = uit.indienings || [];
    pg_teken_lys();
  } catch (fout) {
    console.error("Kon nie die indienings laai nie:", fout);
    if (wrap) {
      wrap.innerHTML = '<p class="stelsel-boodskap">' +
        pg_ontsnap(pg_t("pg_laai_fout", "Kon nie die indienings laai nie.")) + "</p>";
    }
  }
}

// --- Een indiening ---

function pg_ry(etiket, waarde, verander) {
  return '<div class="pg-ry' + (verander ? " pg-ry-verander" : "") + '">' +
    '<div class="pg-etiket">' + pg_ontsnap(etiket) + "</div>" +
    '<div class="pg-waarde">' + (waarde === "" || waarde === undefined
      ? '<span class="pg-leeg">—</span>' : pg_ontsnap(waarde)) + "</div></div>";
}

function pg_ry_oud_nuut(etiket, oud, nuut) {
  return '<div class="pg-ry pg-ry-verander">' +
    '<div class="pg-etiket">' + pg_ontsnap(etiket) + "</div>" +
    '<div class="pg-waarde"><span class="pg-oud">' +
    (oud === "" || oud === undefined ? "—" : pg_ontsnap(oud)) + "</span>" +
    '<span class="pg-pyl">→</span><strong>' +
    (nuut === "" || nuut === undefined ? "—" : pg_ontsnap(nuut)) + "</strong></div></div>";
}

// Wat 'n formaat werklik kos. Die outeur se vorm neem 'n prys OF 'n
// verlangde wins; die prys kom altyd uit die som, nooit uit die veld nie.
function pg_formaat_prys(blok) {
  if (!blok || !blok.aan) return null;
  if (typeof vs_bereken !== "function") return null;

  const u = vs_bereken({
    modus: blok.modus || "prys",
    begin: Number(blok.invoer) || 0,
    koste: Number(blok.koste) || 0,
    outeurPct: PG_OUTEUR_PCT,
    paystackPct: PG_AANNAMES.paystackPct,
    paystackVaste: PG_AANNAMES.paystackVaste,
    btwPct: PG_AANNAMES.btwPct,
  });
  return u && !u.leeg ? u : null;
}

function pg_formate_html(data, ou_data) {
  let uit = "";
  PG_FORMATE.forEach(([sleutel, i18n, naam]) => {
    const blok = (data.formate || {})[sleutel] || {};
    if (!blok.aan) return;

    const u = pg_formaat_prys(blok);
    const ou_blok = ou_data ? (ou_data.formate || {})[sleutel] : null;
    const ou_u = ou_blok ? pg_formaat_prys(ou_blok) : null;
    const prys_verander = Boolean(ou_u && u && Math.abs(ou_u.P - u.P) > 0.005);

    uit += '<div class="pg-formaat' + (prys_verander ? " pg-formaat-prys" : "") + '">' +
      '<div class="pg-formaat-kop">' + pg_ontsnap(pg_t(i18n, naam)) +
      (prys_verander ? '<span class="pg-prysmerk">' +
        pg_ontsnap(pg_t("pg_prys_verander", "Prysverandering")) + "</span>" : "") +
      "</div>";

    if (!u) {
      uit += pg_ry(pg_t("pg_prys", "Prys"), pg_t("pg_geen_prys", "Nog nie ingevul nie"), false);
    } else if (prys_verander) {
      uit += pg_ry_oud_nuut(pg_t("pg_prys", "Prys"), pg_rand(ou_u.P), pg_rand(u.P));
    } else {
      uit += pg_ry(pg_t("pg_prys", "Prys"), pg_rand(u.P), false);
    }

    if (u) {
      if (u.K > 0) uit += pg_ry(pg_t("pg_koste", "Outeur se koste, terug"), pg_rand(u.K), false);
      uit += pg_ry(pg_t("pg_outeur_wins", "Outeur verdien aan die boek"), pg_rand(u.outeurWins), false);
      uit += pg_ry(pg_t("pg_fs", "Future Sharp ontvang"), pg_rand(u.futureSharpRand), false);
    }
    if (blok.tydperk) {
      uit += pg_ry(pg_t("pg_tydperk", "Leentydperk"), blok.tydperk, false);
    }
    uit += "</div>";
  });

  return uit || '<p class="pg-leeg">' +
    pg_ontsnap(pg_t("pg_geen_formaat", "Geen formaat is aangedui nie.")) + "</p>";
}

function pg_besonderhede_html(rekord) {
  // 'n Hangende wysiging: `hangend` is die voorstel, `data` is wat lewendig is.
  const is_wysiging = Boolean(rekord.hangend);
  const data = rekord.hangend || rekord.data || {};
  const ou_data = is_wysiging ? (rekord.data || {}) : null;

  let uit = "";

  if (is_wysiging) {
    uit += '<div class="pg-nota">' +
      pg_ontsnap(pg_t("pg_wysiging_nota",
        "Dit is 'n hangende wysiging. Die winkel wys steeds die ou waardes.")) + "</div>";
  }

  if (rekord.opmerking) {
    uit += '<div class="pg-opmerking"><strong>' +
      pg_ontsnap(pg_t("pg_vorige_opmerking", "Vorige opmerking")) + ":</strong> " +
      pg_ontsnap(rekord.opmerking) + "</div>";
  }

  // --- Die velde ---
  uit += '<h4 class="pg-kop">' + pg_ontsnap(pg_t("pg_besonderhede", "Besonderhede")) + "</h4>";
  PG_VELDE.forEach(([pad, i18n, naam]) => {
    const nuut = pg_diep(data, pad);
    const oud = ou_data ? pg_diep(ou_data, pad) : undefined;
    const verskil = ou_data && String(oud ?? "") !== String(nuut ?? "");

    // By 'n wysiging wys ons net wat verander het, plus die titel as anker.
    if (ou_data && !verskil && pad !== "titel") return;
    if (!ou_data && (nuut === undefined || nuut === "")) return;

    uit += verskil
      ? pg_ry_oud_nuut(pg_t(i18n, naam), oud, nuut)
      : pg_ry(pg_t(i18n, naam), nuut, false);
  });

  // --- Mede-outeurs ---
  const mede = data.mede_outeurs || [];
  if (mede.length) {
    uit += '<h4 class="pg-kop">' + pg_ontsnap(pg_t("pg_mede", "Mede-outeurs")) + "</h4>";
    mede.forEach((m) => {
      uit += pg_ry(m.naam || "—", [m.epos, m.pct ? m.pct + "%" : ""].filter(Boolean).join(" · "), false);
    });
  }

  // --- Formate en prys ---
  uit += '<h4 class="pg-kop">' + pg_ontsnap(pg_t("pg_formate", "Formate en prys")) + "</h4>";
  uit += pg_formate_html(data, ou_data);

  // --- Lêers ---
  uit += '<h4 class="pg-kop">' + pg_ontsnap(pg_t("pg_leers", "Lêers")) + "</h4>";
  const leers = rekord.leers || {};
  [["manuskrip", "pg_manuskrip", "Manuskrip"], ["omslag", "pg_omslag", "Omslag"]].forEach(
    ([soort, i18n, naam]) => {
      const inskrywing = leers[soort];
      if (!inskrywing) {
        uit += pg_ry(pg_t(i18n, naam), pg_t("pg_geen_leer", "Geen lêer"), false);
        return;
      }
      uit += '<div class="pg-ry"><div class="pg-etiket">' +
        pg_ontsnap(pg_t(i18n, naam)) + "</div>" +
        '<div class="pg-waarde">' + pg_ontsnap(inskrywing.naam || "") +
        ' <button type="button" class="pg-wys" data-pg-wys="' + soort +
        '" data-pg-vir="' + pg_ontsnap(rekord.nommer) + '">' +
        pg_ontsnap(pg_t("pg_wys_leer", "Wys")) + "</button></div></div>";
    }
  );

  // --- Geskiedenis ---
  const gesk = rekord.geskiedenis || [];
  if (gesk.length) {
    uit += '<h4 class="pg-kop">' + pg_ontsnap(pg_t("pg_geskiedenis", "Geskiedenis")) + "</h4>";
    uit += '<ul class="pg-geskiedenis">';
    gesk.slice().reverse().forEach((g) => {
      uit += "<li>" + pg_ontsnap(g.handeling) + " · " + pg_datum(g.op) +
        (g.wie ? " · " + pg_ontsnap(g.wie) : "") +
        (g.nota ? " · " + pg_ontsnap(g.nota) : "") + "</li>";
    });
    uit += "</ul>";
  }

  // --- Wat die produkvorm nodig het ---
  if (rekord.eboek_sleutel || rekord.omslag) {
    uit += '<h4 class="pg-kop">' +
      pg_ontsnap(pg_t("pg_katalogus", "In die katalogus se stores")) + "</h4>";
    if (rekord.eboek_sleutel) {
      uit += pg_ry(pg_t("pg_eboek_sleutel", "E-boek-sleutel"), rekord.eboek_sleutel, false);
    }
    if (rekord.omslag) {
      uit += pg_ry(pg_t("pg_omslag_pad", "Omslag-pad"), rekord.omslag, false);
    }
  }

  // --- Die twee handelinge ---
  //
  // Daar is GEEN afkeur nie. 'n Afkeur eindig 'n gesprek; 'n opmerking hou
  // hom aan die gang, en die geskiedenis wys later hoe die boek by sy
  // finale vorm uitgekom het.
  if (rekord.stand === "ingedien" || rekord.stand === "wysiging") {
    uit += '<div class="pg-aksies">' +
      '<button type="button" class="kaart-aksie pg-keur" id="pg-keur-goed">' +
      pg_ontsnap(pg_t("pg_keur_goed", "Keur goed")) + "</button>" +
      '<button type="button" class="kaart-aksie" id="pg-stuur-terug">' +
      pg_ontsnap(pg_t("pg_stuur_terug", "Stuur terug met \u2019n opmerking")) + "</button>" +
      "</div>" +
      '<div class="pg-terug-blok" id="pg-terug-blok" hidden>' +
      '<label for="pg-opmerking">' +
      pg_ontsnap(pg_t("pg_opmerking_etiket", "Wat moet die outeur regmaak?")) + "</label>" +
      '<textarea id="pg-opmerking" rows="4"></textarea>' +
      '<button type="button" class="kaart-aksie pg-keur" id="pg-terug-stuur">' +
      pg_ontsnap(pg_t("pg_terug_stuur", "Stuur terug")) + "</button></div>";
  }

  return uit;
}

// --- Die twee handelinge ---

async function pg_handeling(pad, liggaam, knoppie, besig_teks) {
  const oorspronklik = knoppie ? knoppie.textContent : "";
  if (knoppie) { knoppie.disabled = true; knoppie.textContent = besig_teks; }

  try {
    const resp = await fetch("/.netlify/functions/" + pad, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, kry_outorisasie_kop()),
      body: JSON.stringify(liggaam),
    });
    if (!resp.ok) throw new Error(await resp.text());

    const uit = await resp.json();

    // Blobs se list() loop agter. Werk die PLAASLIKE lys by in plaas van
    // weer te vra — anders lyk dit of niks gebeur het nie.
    const ry = PG_INDIENINGS.find((r) => r.nommer === uit.nommer);
    if (ry) ry.stand = uit.stand;
    pg_teken_lys();

    pg_maak_leser_toe();
    await pg_maak_oop(uit.nommer);
  } catch (fout) {
    console.error("Die handeling het misluk:", fout);
    alert(String(fout.message || fout) || pg_t("pg_handeling_fout", "Die handeling het misluk."));
    if (knoppie) { knoppie.disabled = false; knoppie.textContent = oorspronklik; }
  }
}

async function pg_maak_oop(nommer) {
  const paneel = document.getElementById("pg-een");
  const inhoud = document.getElementById("pg-een-inhoud");
  const kop = document.getElementById("pg-een-kop");
  if (!paneel || !inhoud) return;

  paneel.style.display = "";
  inhoud.innerHTML = '<p class="stelsel-boodskap">' +
    pg_ontsnap(pg_t("pg_laai_een", "Die vorm word gelaai …")) + "</p>";
  if (kop) kop.textContent = nommer;

  try {
    const resp = await fetch(
      "/.netlify/functions/kry-indienings?nommer=" + encodeURIComponent(nommer),
      { headers: kry_outorisasie_kop() }
    );
    if (!resp.ok) throw new Error(await resp.text());

    const rekord = await resp.json();
    PG_OOP = rekord;
    if (kop) {
      kop.textContent = (rekord.titel || pg_t("pg_geen_titel", "Sonder titel")) +
        " · " + rekord.nommer;
    }
    inhoud.innerHTML = pg_besonderhede_html(rekord);
    paneel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (fout) {
    console.error("Kon nie die vorm laai nie:", fout);
    inhoud.innerHTML = '<p class="stelsel-boodskap">' +
      pg_ontsnap(pg_t("pg_een_fout", "Kon nie die vorm laai nie.")) + "</p>";
  }
}

// --- Die lêer wys ---
//
// Fetch met die kop, dan 'n blob-URL. 'n Gewone skakel kan nie 'n
// Authorization-kop stuur nie, en die Function laat niks sonder een deur.

let PG_LEER_URL = null;
let PG_PDF = null;
let PG_BLADSY = 1;

async function pg_teken_bladsy(nommer) {
  if (!PG_PDF) return;
  const totaal = PG_PDF.numPages;
  PG_BLADSY = Math.min(Math.max(1, nommer), totaal);

  const doek = document.getElementById("pg-doek");
  const teller = document.getElementById("pg-bladsy-teller");
  if (!doek) return;

  const bladsy = await PG_PDF.getPage(PG_BLADSY);

  // Skaal na die houer se breedte, sodat die bladsy pas sonder om te rol.
  const rou = bladsy.getViewport({ scale: 1 });
  const breedte = doek.parentElement ? doek.parentElement.clientWidth - 4 : 700;
  const skaal = breedte > 0 ? breedte / rou.width : 1;
  const aansig = bladsy.getViewport({ scale: skaal });

  doek.width = aansig.width;
  doek.height = aansig.height;
  await bladsy.render({ canvasContext: doek.getContext("2d"), viewport: aansig }).promise;

  if (teller) teller.textContent = PG_BLADSY + " / " + totaal;
}

async function pg_render_pdf(grepe, bak) {
  if (!bak) return;

  if (typeof pdfjsLib === "undefined") {
    bak.innerHTML = '<p class="stelsel-boodskap">' +
      pg_ontsnap(pg_t("pg_pdf_fout", "Kon nie die PDF-leser laai nie.")) + "</p>";
    return;
  }

  bak.innerHTML =
    '<div class="pg-pdf-balk">' +
    '<button type="button" class="pg-wys" id="pg-vorige">' +
    pg_ontsnap(pg_t("pg_vorige", "Vorige")) + "</button>" +
    '<span class="pg-bladsy-teller" id="pg-bladsy-teller">…</span>' +
    '<button type="button" class="pg-wys" id="pg-volgende">' +
    pg_ontsnap(pg_t("pg_volgende", "Volgende")) + "</button></div>" +
    '<div class="pg-doek-bak"><canvas id="pg-doek"></canvas></div>';

  try {
    PG_PDF = await pdfjsLib.getDocument({ data: grepe }).promise;
    PG_BLADSY = 1;
    await pg_teken_bladsy(1);

    document.getElementById("pg-vorige")
      .addEventListener("click", () => pg_teken_bladsy(PG_BLADSY - 1));
    document.getElementById("pg-volgende")
      .addEventListener("click", () => pg_teken_bladsy(PG_BLADSY + 1));
  } catch (fout) {
    console.error("Kon nie die PDF render nie:", fout);
    bak.innerHTML = '<p class="stelsel-boodskap">' +
      pg_ontsnap(pg_t("pg_pdf_fout", "Kon nie die PDF-leser laai nie.")) + "</p>";
  }
}

function pg_maak_leser_toe() {
  const leser = document.getElementById("pg-leser");
  if (leser) leser.style.display = "none";
  const bak = document.getElementById("pg-leser-bak");
  if (bak) bak.innerHTML = "";
  PG_PDF = null;
  if (PG_LEER_URL) {
    URL.revokeObjectURL(PG_LEER_URL);
    PG_LEER_URL = null;
  }
}

async function pg_wys_leer(nommer, soort, knoppie) {
  const oorspronklik = knoppie ? knoppie.textContent : "";
  if (knoppie) { knoppie.disabled = true; knoppie.textContent = pg_t("pg_haal", "Haal …"); }

  try {
    const resp = await fetch(
      "/.netlify/functions/kry-indiening-leer?nommer=" + encodeURIComponent(nommer) +
      "&soort=" + encodeURIComponent(soort),
      { headers: kry_outorisasie_kop() }
    );
    if (!resp.ok) throw new Error(await resp.text());

    // Die tipe moet UITDRUKLIK op die blob staan, anders weet die blaaier
    // nie wat hy kry nie.
    const rou = await resp.blob();
    const tipe = resp.headers.get("Content-Type") || rou.type ||
      (soort === "manuskrip" ? "application/pdf" : "image/jpeg");
    const blob = new Blob([rou], { type: tipe });

    pg_maak_leser_toe();
    PG_LEER_URL = URL.createObjectURL(blob);

    // IN DIE BLADSY, nie 'n nuwe oortjie nie. Chrome se instelling
    // "Download PDFs instead of automatically opening them" laat 'n
    // window.open van 'n PDF aflaai; 'n iframe omseil dit. En 'n manuskrip
    // wat naas sy eie besonderhede lees, is in elk geval die beter plek om
    // hom te beoordeel.
    const leser = document.getElementById("pg-leser");
    const bak = document.getElementById("pg-leser-bak");
    const kop = document.getElementById("pg-leser-kop");
    const aflaai = document.getElementById("pg-leser-aflaai");

    if (kop) {
      kop.textContent = (soort === "manuskrip"
        ? pg_t("pg_manuskrip", "Manuskrip")
        : pg_t("pg_omslag", "Omslag")) + " · " + nommer;
    }
    if (aflaai) {
      aflaai.href = PG_LEER_URL;
      aflaai.download = ((PG_OOP && PG_OOP.leers && PG_OOP.leers[soort] &&
        PG_OOP.leers[soort].naam) || soort);
    }

    if (leser) {
      leser.style.display = "";
      leser.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (soort !== "manuskrip") {
      if (bak) bak.innerHTML = '<img class="pg-beeld" src="' + PG_LEER_URL + '" alt="Omslag">';
      return;
    }

    // 'n IFRAME WERK NIE VIR 'N PDF NIE. Chrome se instelling "Download PDFs
    // instead of automatically opening them" wys 'n plekhouer in plaas van
    // die dokument, en geen kode omseil dit — dit is 'n bewuste keuse van
    // die gebruiker. Ons render dus self met PDF.js, presies soos die winkel
    // se leser, en dan maak die instelling nie saak nie.
    await pg_render_pdf(await blob.arrayBuffer(), bak);
  } catch (fout) {
    console.error("Kon nie die lêer wys nie:", fout);
    alert(pg_t("pg_leer_fout", "Kon nie die lêer oopmaak nie."));
  } finally {
    if (knoppie) { knoppie.disabled = false; knoppie.textContent = oorspronklik; }
  }
}

// --- Koppelings ---

document.addEventListener("click", (e) => {
  const kaart = e.target.closest("[data-pg-nommer]");
  if (kaart) {
    pg_maak_oop(kaart.getAttribute("data-pg-nommer"));
    return;
  }

  const wys = e.target.closest("[data-pg-wys]");
  if (wys) {
    e.stopPropagation();
    pg_wys_leer(wys.getAttribute("data-pg-vir"), wys.getAttribute("data-pg-wys"), wys);
    return;
  }

  const keur = e.target.closest("#pg-keur-goed");
  if (keur) {
    pg_handeling("keur-goed", { nommer: PG_OOP.nommer }, keur,
      pg_t("pg_besig", "Besig \u2026"));
    return;
  }

  const wys_terug = e.target.closest("#pg-stuur-terug");
  if (wys_terug) {
    const blok = document.getElementById("pg-terug-blok");
    if (blok) {
      blok.hidden = false;
      const veld = document.getElementById("pg-opmerking");
      if (veld) veld.focus();
    }
    return;
  }

  const stuur = e.target.closest("#pg-terug-stuur");
  if (stuur) {
    const veld = document.getElementById("pg-opmerking");
    const opmerking = veld ? veld.value.trim() : "";
    if (!opmerking) {
      alert(pg_t("pg_opmerking_verplig", "Skryf eers 'n opmerking."));
      if (veld) veld.focus();
      return;
    }
    pg_handeling("stuur-terug", { nommer: PG_OOP.nommer, opmerking }, stuur,
      pg_t("pg_besig", "Besig \u2026"));
    return;
  }

  const leser_toe = e.target.closest("#pg-leser-toe");
  if (leser_toe) { pg_maak_leser_toe(); return; }

  const toe = e.target.closest("#pg-een-toe");
  if (toe) {
    pg_maak_leser_toe();
    const paneel = document.getElementById("pg-een");
    if (paneel) paneel.style.display = "none";
    PG_OOP = null;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const herlaai = document.getElementById("pg-herlaai");
  if (herlaai) herlaai.addEventListener("click", pg_laai);
});

// Dieselfde "wag tot die paneel sigbaar is"-patroon as elders.
(function pg_waarnemer() {
  const teiken = document.getElementById("paneel-inhoud");
  if (!teiken) return;

  let reeds = false;
  const waarnemer = new MutationObserver(() => {
    if (!reeds && teiken.style.display !== "none") {
      reeds = true;
      pg_laai();
    }
  });
  waarnemer.observe(teiken, { attributes: true, attributeFilter: ["style"] });

  if (teiken.style.display !== "none") {
    reeds = true;
    pg_laai();
  }
})();
