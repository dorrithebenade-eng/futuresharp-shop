// public/js/betaal-klaar.js
//
// Wat het met die betaling gebeur? Vra dit, en sê dit.
//
// DIE BLADSY LEES IN DIE FAKTUUR SE TAAL, nie in die blaaier s'n nie. Daarom
// t_in(sleutel, taal) en nooit t() — t() lees kry_huidige_taal() uit
// localStorage, wat die PLATFORM se taal is en heeltemal 'n ander bron. Die
// dokument wat die kliënt ontvang het, was in die faktuur se taal; hierdie
// bladsy is dieselfde gesprek.
//
// Tot die antwoord terug is, weet ons nie eers watter taal nie. Die
// besig-boodskap loop dus deur dieselfde t_in() met die blaaier se voorkeur
// as die beste raaiskoot — dit staan 'n sekonde of twee op die skerm.

const BK_KONTAK = "admin@futuresharp.co.za";

// Die formateerder leef in taal.js, saam met t_in() — die desimaalteken is 'n
// taalsaak. Hier geld die FAKTUUR se taal, dieselfde bron as die res van die
// bladsy.
function bk_rand(sent, taal) {
  return window.t_rand ? t_rand(sent, taal) : "R" + (Number(sent || 0) / 100).toFixed(2);
}

// Alles wat van buite af kom — die nommer, die betaalskakel — gaan hierdeur
// voordat dit in HTML beland.
function bk_ontsnap(waarde) {
  return String(waarde == null ? "" : waarde)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bk_teken_besig(taal) {
  const el = document.getElementById("bk-besig-teks");
  if (el) el.textContent = t_in("bk_besig", taal);
  const voet = document.getElementById("bk-voet");
  if (voet) voet.textContent = t_in("bk_voet", taal);
}

function bk_teken(u) {
  const taal = u.taal === "en" ? "en" : "af";
  document.documentElement.lang = taal;

  const kaart = document.getElementById("bk-kaart");
  if (!kaart) return;
  kaart.className = "bk-kaart bk-t-" + u.stand;

  const voet = document.getElementById("bk-voet");
  if (voet) voet.textContent = t_in("bk_voet", taal);

  // DIE SYFERS VERSKYN BY ELKE UITKOMS, ook by 'n mislukte een. Iemand wat op
  // hierdie bladsy land, moet kan sien WATTER faktuur dit is.
  //
  // Die bedragetiket verander saam met die toestand, en dit is nie kosmeties
  // nie: wat ontvang is, is nie wat verskuldig is nie. Twee feite, twee woorde.
  const bedrag_etiket = u.stand === "betaal" ? "bk_ontvang" : "bk_verskuldig";

  // NET EEN NOMMER OP DIE BLADSY. Die faktuurnommer IS die bankverwysing.
  // Staan die transaksieverwysing (FS-01957) langs die nommer (FS/01957) —
  // een karakter verskil — tik iemand die verkeerde een in sy betaling oor en
  // die versoening klop nie.
  // GEEN NOMMER, GEEN BLOK. Sonder 'n faktuur is daar niks om te wys nie, en
  // "Totaal verskuldig R0,00" is dan 'n stelling wat nie waar is nie.
  const syfers = !u.nommer ? "" :
    '<dl class="bk-syfers">' +
    '<div class="bk-ry"><dt>' + t_in("bk_nommer", taal) + "</dt>" +
    "<dd>" + bk_ontsnap(u.nommer) + "</dd></div>" +
    '<div class="bk-ry bk-groot"><dt>' + t_in(bedrag_etiket, taal) + "</dt>" +
    "<dd>" + bk_rand(u.bedrag_sent || 0, taal) + "</dd></div>" +
    "</dl>";

  // Niemand loop hier dood nie. Is die faktuur nog onbetaal en is daar 'n
  // lewende skakel, staan die knoppie daar. 'n Gekanselleerde faktuur gee geen
  // skakel terug nie, want 'n knoppie na 'n skakel wat weier, is 'n
  // doodloopstraat met 'n knoppie daarop.
  let aksie = "";
  if (u.stand !== "betaal" && u.betaalskakel) {
    aksie =
      '<div class="bk-aksie"><a class="bk-knop" href="' +
      bk_ontsnap(u.betaalskakel) + '">' + t_in("bk_hervat", taal) + "</a></div>";
  }

  kaart.innerHTML =
    '<div class="bk-kop">' +
    '<span class="bk-merkie">' + t_in("bk_merk_" + u.stand, taal) + "</span>" +
    "<h1>" + t_in("bk_kop_" + u.stand, taal) + "</h1>" +
    "<p>" + t_in("bk_teks_" + u.stand, taal) + "</p>" +
    "</div>" +
    syfers +
    aksie +
    '<div class="bk-nota">' + t_in("bk_navrae", taal) +
    ' <a href="mailto:' + BK_KONTAK + '">' + BK_KONTAK + "</a>.</div>";
}

async function bk_begin() {
  const vraag = new URLSearchParams(window.location.search);
  const f = vraag.get("f") || "";
  const k = vraag.get("k") || "";

  const raaiskoot = kry_huidige_taal();
  bk_teken_besig(raaiskoot);

  // Sonder albei dele is daar niks om te vra nie. Ons wys dieselfde
  // "onbevestig" as by 'n mislukte oproep — 'n bladsy wat sê "verkeerde kode"
  // verklap watter nommers bestaan.
  if (!f || !k) {
    bk_teken({ stand: "onbekend", nommer: "", bedrag_sent: 0, taal: raaiskoot, betaalskakel: null });
    return;
  }

  try {
    const resp = await fetch(
      "/.netlify/functions/kry-betaalstand?f=" +
        encodeURIComponent(f) + "&k=" + encodeURIComponent(k)
    );
    if (!resp.ok) throw new Error("Status " + resp.status);
    const u = await resp.json();
    bk_teken(u);
  } catch (fout) {
    console.error("Kon nie die betaalstand kry nie:", fout);
    bk_teken({ stand: "onbekend", nommer: "", bedrag_sent: 0, taal: raaiskoot, betaalskakel: null });
  }
}

bk_begin();
