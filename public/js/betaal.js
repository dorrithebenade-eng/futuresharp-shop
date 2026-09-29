// public/js/betaal.js
//
// Stuur die kliënt na 'n VARS Paystack-skerm vir sy faktuur.
//
// ─────────────────────────────────────────────────────────────────────────
// WAAROM HIERDIE BLADSY BESTAAN
//
// Paystack se toegangskode leef nie so lank as 'n faktuur se betaaltermyn
// nie. Tot 24 September 2026 het die proforma-pos, die PDF en die QR die
// checkout.paystack.com-adres DIREK gedra. Daardie string gaan dood terwyl hy
// in die kliënt se inboks lê, en niks wat ons aan ons kant doen, kan dit
// regmaak nie — die dooie skakel is by hom, nie by ons nie.
//
// Hierdie bladsy se adres verwys net na 'n faktuur en kan dus nie verval nie.
// Die Paystack-skakel word gevra op die oomblik dat iemand hier land.
// ─────────────────────────────────────────────────────────────────────────
//
// DIT IS 'N DEURGANG, NIE 'N BESTEMMING NIE. Gaan alles reg, sien die kliënt
// hom 'n oomblik en is dan by Paystack. Hy bestaan vir die gevalle waar daar
// NIE deurgegaan kan word nie — reeds betaal, gekanselleer, of Paystack
// antwoord nie — want 'n foutbladsy sonder konteks laat iemand met 'n
// rekening in sy hand en geen idee wat om te doen nie.
//
// DIE BLADSY LEES IN DIE FAKTUUR SE TAAL, nie in die blaaier s'n nie. Daarom
// t_in(sleutel, taal) en nooit t(): t() lees kry_huidige_taal() uit
// localStorage, wat die PLATFORM se taal is en 'n heeltemal ander bron.
// Dieselfde reël as betaal-klaar.js, en dieselfde klasse en sleutels, sodat
// die twee bladsye een gesig het.

const BT_KONTAK = "admin@futuresharp.co.za";

function bt_rand(sent, taal) {
  return window.t_rand ? t_rand(sent, taal) : "R" + (Number(sent || 0) / 100).toFixed(2);
}

function bt_ontsnap(waarde) {
  return String(waarde == null ? "" : waarde)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bt_teken_besig(taal) {
  const el = document.getElementById("bk-besig-teks");
  if (el) el.textContent = t_in("bt_besig", taal);
  const voet = document.getElementById("bk-voet");
  if (voet) voet.textContent = t_in("bk_voet", taal);
}

function bt_teken(u) {
  const taal = u.taal === "en" ? "en" : "af";
  document.documentElement.lang = taal;

  const kaart = document.getElementById("bk-kaart");
  if (!kaart) return;

  const voet = document.getElementById("bk-voet");
  if (voet) voet.textContent = t_in("bk_voet", taal);

  // DIE SYFERS VERSKYN BY ELKE UITKOMS. Iemand wat hier land, moet kan sien
  // WATTER faktuur dit is, ook wanneer daar niks te betaal is nie.
  //
  // Die bedragetiket verander saam met die toestand: wat ontvang is, is nie
  // wat verskuldig is nie. Dieselfde onderskeid as op betaal-klaar.html.
  const bedrag_etiket = u.stand === "betaal" ? "bk_ontvang" : "bk_verskuldig";

  const syfers = !u.nommer ? "" :
    '<dl class="bk-syfers">' +
    '<div class="bk-ry"><dt>' + t_in("bk_nommer", taal) + "</dt>" +
    "<dd>" + bt_ontsnap(u.nommer) + "</dd></div>" +
    '<div class="bk-ry bk-groot"><dt>' + t_in(bedrag_etiket, taal) + "</dt>" +
    "<dd>" + bt_rand(u.bedrag_sent || 0, taal) + "</dd></div>" +
    "</dl>";

  // DIE KNOPPIE IS DIE TERUGVAL. Gaan die outomatiese sprong deur, sien
  // niemand hom. Blokkeer 'n blaaier die sprong, of kom die kliënt terug, is
  // hy die pad vorentoe.
  //
  // Geen skakel, geen knoppie: 'n knoppie na niks is 'n doodloopstraat met 'n
  // knoppie daarop.
  let aksie = "";
  if (u.stand === "oop" && u.betaalskakel) {
    aksie =
      '<div class="bk-aksie"><a class="bk-knop" href="' +
      bt_ontsnap(u.betaalskakel) + '">' + t_in("bt_gaan_betaal", taal) + "</a></div>";
  }

  kaart.className = "bk-kaart bk-t-" + (u.stand === "betaal" ? "betaal" : "oop");
  kaart.innerHTML =
    '<div class="bk-kop">' +
    "<h1>" + t_in("bt_kop_" + u.stand, taal) + "</h1>" +
    "<p>" + t_in("bt_teks_" + u.stand, taal) + "</p>" +
    "</div>" +
    syfers +
    aksie +
    '<div class="bk-nota">' + t_in("bk_navrae", taal) +
    ' <a href="mailto:' + BT_KONTAK + '">' + BT_KONTAK + "</a>.</div>";
}

(async function bt_begin() {
  const vraag = new URLSearchParams(window.location.search);

  // DIESELFDE AFSNY AS OP betaal-klaar.js. 'n Egte sleutel en 'n egte kode dra
  // nooit 'n vraagteken nie, dus is dit veilig, en dit red die bladsy wanneer
  // 'n skakel iewers met 'n tweede vraagteken aanmekaar geplak is.
  const skoon = (w) => String(w || "").split("?")[0];
  const f = skoon(vraag.get("f"));
  const k = skoon(vraag.get("k"));

  const raaiskoot = window.kry_huidige_taal ? kry_huidige_taal() : "af";
  bt_teken_besig(raaiskoot);

  if (!f || !k) {
    bt_teken({ stand: "fout", nommer: "", bedrag_sent: 0, taal: raaiskoot });
    return;
  }

  let u;
  try {
    const resp = await fetch(
      "/.netlify/functions/begin-faktuur-betaling?f=" +
        encodeURIComponent(f) + "&k=" + encodeURIComponent(k),
      { cache: "no-store" }
    );
    if (!resp.ok) throw new Error("Status " + resp.status);
    u = await resp.json();
  } catch (fout) {
    console.error("Kon nie die betaling begin nie:", fout);
    bt_teken({ stand: "fout", nommer: "", bedrag_sent: 0, taal: raaiskoot });
    return;
  }

  // DIE SPRONG GEBEUR VOOR DIE TEKEN, sodat die kliënt nie 'n bladsy sien
  // flits nie.
  //
  // location.replace() en nie .href nie: hierdie bladsy hoort NIE in die
  // blaaier se geskiedenis nie. Druk die kliënt by Paystack die terugknoppie,
  // moet hy by sy e-pos uitkom, nie by 'n deurgang wat hom dadelik weer
  // wegstuur nie.
  if (u.stand === "oop" && u.betaalskakel) {
    window.location.replace(u.betaalskakel);
  }

  // Loop steeds, vir die geval die sprong geblokkeer word.
  bt_teken(u);
})();
