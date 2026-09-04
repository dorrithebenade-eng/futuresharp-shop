// public/js/kwotasie.js
//
// Die kwotasie soos die kliënt haar sien, met die knoppie wat haar aanvaar.
//
// DIE BLADSY LEES IN DIE KWOTASIE SE TAAL, nie in die blaaier s'n nie. Daarom
// t_in(sleutel, taal) en nooit t() — t() lees kry_huidige_taal() uit
// localStorage, wat die PLATFORM se taal is en 'n heel ander bron. Die
// dokument wat die kliënt ontvang het, was in die kwotasie se taal; hierdie
// bladsy is dieselfde gesprek.
//
// Tot die antwoord terug is, weet ons nie eers watter taal nie. Die
// besig-boodskap loop dus deur dieselfde t_in() met die blaaier se voorkeur as
// die beste raaiskoot.
//
// DIESELFDE PATROON AS betaal-klaar.js. Wat daar 'n betaling is, is hier 'n
// aanbod.

const KW_KONTAK = "admin@futuresharp.co.za";

let KW = null;      // die kwotasie soos die bediener haar gegee het
let KW_SLEUTEL = "";
let KW_KODE = "";
let KW_BESIG = false;

function kw_rand(sent, taal) {
  return window.t_rand ? t_rand(sent, taal) : "R" + (Number(sent || 0) / 100).toFixed(2);
}

// Alles wat van buite af kom, gaan hierdeur voordat dit in HTML beland.
function kw_ontsnap(waarde) {
  return String(waarde == null ? "" : waarde)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Slegs die datum. 'n Kwotasie se geldigheid loop op DAE — sy is die hele
// laaste dag geldig — en 'n uur langs "geldig tot" sou suggereer dat sy om
// 14:32 doodgaan.
function kw_datum(iso, taal) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const maande = t_in("fd_maande", taal).split(",");
  const naam = maande.length === 12 ? maande[d.getMonth()] : String(d.getMonth() + 1);
  return `${d.getDate()} ${naam} ${d.getFullYear()}`;
}

function kw_reels_na_html(u) {
  return u.reels
    .map(
      (r) => `<tr>
        <td>${kw_ontsnap(r.beskrywing) || "&nbsp;"}</td>
        <td class="n">${r.is_groep ? "" : kw_ontsnap(r.hoeveelheid)}</td>
        <!-- Die eenheidsprys sonder die R, soos op die faktuurdokument: die
             BEDRAG-kolom dra die geldeenheid, die eenheidsprys nie. -->
        <td class="n">${
          r.is_groep ? "" : kw_ontsnap(kw_rand(r.prys_pp_sent, u.taal).replace(/^R\s*/, ""))
        }</td>
        <td class="n sterk">${kw_rand(r.bedrag_sent, u.taal)}</td>
      </tr>`
    )
    .join("");
}

/* DIE DOKUMENT. Dieselfde vorm as die faktuur s'n, met drie verskille:
   KWOTASIE, "Gekwoteer aan", en "Totaal" sonder "verskuldig" -- niks is
   verskuldig voordat sy aanvaar is nie. */
function kw_dokument(u) {
  const m = u.maatskappy;
  const afslag =
    u.afslag_sent > 0
      ? `<tr><td>${kw_ontsnap(t_in("fd_afslag", u.taal))}</td>
           <td class="n">− ${kw_rand(u.afslag_sent, u.taal)}</td></tr>`
      : "";
  const sub =
    u.afslag_sent > 0
      ? `<tr><td>${kw_ontsnap(t_in("fd_subtotaal", u.taal))}</td>
           <td class="n">${kw_rand(u.totaal_sent + u.afslag_sent, u.taal)}</td></tr>`
      : "";

  return `<div class="kw-dok">
    <div class="kw-dok-kop">
      <div>
        <div class="kw-dok-merk">${kw_ontsnap(m.naam)}</div>
        <div class="kw-dok-fyn">${
          m.registrasienommer
            ? kw_ontsnap(t_in("fd_reg_nr", u.taal) + " " + m.registrasienommer) + "<br>"
            : ""
        }${kw_ontsnap(m.adres).replace(/\n/g, "<br>")}<br>${kw_ontsnap(m.epos)}</div>
      </div>
      <div class="kw-dok-nr">
        <div class="et">${kw_ontsnap(t_in("fd_kwotasie", u.taal))}</div>
        <div class="nr">${kw_ontsnap(u.nommer)}</div>
        <!-- GEEN DATUM HIER NIE. Sy staan in die besonderhede, soos op die
             faktuur. Twee keer op een dokument laat 'n mens wonder of hulle
             dieselfde ding beteken. -->
        ${
          u.hersiening > 1
            ? `<div class="kw-dok-fyn">${kw_ontsnap(
                t_in("fd_kw_hersiening", u.taal) + " " + u.hersiening
              )}</div>`
            : ""
        }
      </div>
    </div>

    <div class="kw-dok-party">
      <div>
        <p class="kw-et">${kw_ontsnap(t_in("fd_gekwoteer_aan", u.taal))}</p>
        <div class="kw-klient"><strong>${kw_ontsnap(u.klient.naam)}</strong>${
          u.klient.kontakpersoon ? "<br>" + kw_ontsnap(u.klient.kontakpersoon) : ""
        }${u.klient.adres ? "<br>" + kw_ontsnap(u.klient.adres).replace(/\n/g, "<br>") : ""}</div>
      </div>
      <div>
        <p class="kw-et">${kw_ontsnap(t_in("fd_besonderhede", u.taal))}</p>
        <div class="kw-datums">
          <div><span>${kw_ontsnap(t_in("fd_datum", u.taal))}</span><b>${kw_ontsnap(
            kw_datum(u.dokument_datum || u.uitgereik_op, u.taal)
          )}</b></div>
          <div><span>${kw_ontsnap(t_in("fd_geldig_tot", u.taal))}</span><b>${kw_ontsnap(
            kw_datum(u.geldig_tot, u.taal)
          )}</b></div>
          ${
            u.bestelnommer
              ? `<div><span>${kw_ontsnap(
                  t_in("fd_bestelnommer", u.taal)
                )}</span><b>${kw_ontsnap(u.bestelnommer)}</b></div>`
              : ""
          }
        </div>
      </div>
    </div>

    <table class="kw-tabel">
      <thead><tr>
        <th>${kw_ontsnap(t_in("fd_kol_beskrywing", u.taal))}</th>
        <th class="n">${kw_ontsnap(t_in("fd_kol_hoeveelheid", u.taal))}</th>
        <th class="n">${kw_ontsnap(t_in("fd_kol_eenheidsprys", u.taal))}</th>
        <th class="n">${kw_ontsnap(t_in("fd_kol_bedrag", u.taal))}</th>
      </tr></thead>
      <tbody>${kw_reels_na_html(u)}</tbody>
    </table>

    <div class="kw-somme"><table>
      ${sub}${afslag}
      <tr class="tot"><td>${kw_ontsnap(t_in("fd_totaal", u.taal))}</td>
        <td class="n">${kw_rand(u.totaal_sent, u.taal)}</td></tr>
    </table></div>

    ${
      u.dokument_nota
        ? `<div class="kw-nota">${kw_ontsnap(u.dokument_nota).replace(/\n/g, "<br>")}</div>`
        : ""
    }

    <!-- WAT DIE DATUM BETEKEN.

         "Geldig tot 29 Aug 2026" alleen lees soos 'n sperdatum met 'n gevolg
         wat niemand genoem het nie. Die tweede sin sê wat by aanvaarding
         gebeur, en dieselfde blok staan op die vorm sodat 'n mens sien wat die
         klient gaan lees.

         By 'n reeds aanvaarde of verlope kwotasie val hy weg -- dan is dit nie
         meer 'n aanbod nie. -->
    ${
      u.kan_aanvaar
        ? `<div class="kw-geldig">
             <b>${kw_ontsnap(
               t_in("fd_kw_geldig_kop", u.taal) + " " + kw_datum(u.geldig_tot, u.taal)
             )}</b><br>${kw_ontsnap(t_in("fd_kw_geldig_lei", u.taal))}
           </div>`
        : ""
    }
  </div>`;
}

/* DIE AANVAARBLOK.

   DIE VELDE IS LEEG. 'n Kwotasie word AANGESTUUR -- die departementshoof stuur
   hom na finansies, of andersom -- en die persoon wat klik, is dikwels nie die
   geadresseerde nie. Dit is juis waarom die naam gevra word.

   DIE BESTELNOMMER IS OPSIONEEL. By 'n skool word hy deur die finansiële
   afdeling geskep NADAT hulle die kwotasie gesien het, en die persoon wat
   aanvaar, het hom dikwels nog nie. */
function kw_aanvaarblok(u) {
  return `<div class="kw-kaart kw-aanvaar">
    <h2>${kw_ontsnap(t_in("kw_aanvaar_kop", u.taal))}</h2>
    <p>${kw_ontsnap(t_in("kw_aanvaar_lei", u.taal))}</p>

    <div class="kw-velde">
      <div>
        <label for="kw-naam">${kw_ontsnap(t_in("kw_naam", u.taal))}</label>
        <input id="kw-naam" type="text" maxlength="200" autocomplete="name"
               placeholder="${kw_ontsnap(t_in("kw_naam_plek", u.taal))}">
      </div>
      <div>
        <label for="kw-epos">${kw_ontsnap(t_in("kw_epos", u.taal))}</label>
        <input id="kw-epos" type="email" maxlength="200" autocomplete="email"
               placeholder="${kw_ontsnap(t_in("kw_epos_plek", u.taal))}">
      </div>
    </div>
    <div class="kw-velde kw-velde-een">
      <div>
        <label for="kw-po">${kw_ontsnap(t_in("fd_bestelnommer", u.taal))}</label>
        <!-- VOORGEVUL WANNEER DIE KWOTASIE HOM REEDS DRA.

             Staan hy op die dokument hierbo en wys die veld leeg, tik iemand
             hom oor of laat hom leeg -- en dan gaan die faktuur sonder die PO
             uit, wat presies is wat 'n finansiële afdeling laat terugstuur. -->
        <input id="kw-po" type="text" maxlength="100"
               value="${kw_ontsnap(u.bestelnommer || "")}"
               placeholder="${kw_ontsnap(t_in("kw_bestelnommer_plek", u.taal))}">
      </div>
    </div>

    <p class="kw-fout" id="kw-fout" hidden></p>

    <div class="kw-aksies">
      <button type="button" class="kw-knop" id="kw-aanvaar-knop">${kw_ontsnap(
        t_in("kw_aanvaar_knop", u.taal)
      )}</button>
      <!-- 'n Skool se finansiële afdeling laai 'n dokument in haar eie stelsel;
           'n skakel help haar nie. window.print() plus die @media print-blok in
           kwotasie.css gee 'n PDF wat net die dokument dra. -->
      <button type="button" class="kw-knop kw-knop-stil" id="kw-druk">${kw_ontsnap(
        t_in("kw_laai_af", u.taal)
      )}</button>
    </div>

    <p class="kw-kontak">${kw_ontsnap(t_in("kw_kontak_lei", u.taal))}
      <a href="mailto:${kw_ontsnap(u.maatskappy.epos)}">${kw_ontsnap(
        u.maatskappy.epos
      )}</a>.</p>
  </div>`;
}

// 'n Blok wat 'n toestand aankondig en niks vra nie: verval, reeds aanvaar, of
// 'n fout. Dieselfde vorm as betaal-klaar.js se kaart.
function kw_boodskap(u, soort, kop, teks, ekstra) {
  return `<div class="kw-kaart kw-t-${soort}">
    <span class="kw-merkie">${kw_ontsnap(t_in("fp_kw_stand_" + soort, u.taal))}</span>
    <h2>${kw_ontsnap(kop)}</h2>
    <p>${kw_ontsnap(teks)}</p>
    ${ekstra || ""}
    <p class="kw-kontak">${kw_ontsnap(t_in("kw_kontak_lei", u.taal))}
      <a href="mailto:${kw_ontsnap(u.maatskappy.epos)}">${kw_ontsnap(
        u.maatskappy.epos
      )}</a>.</p>
  </div>`;
}

function kw_teken(u) {
  const plek = document.getElementById("kw-inhoud");
  if (!plek) return;

  let onder = "";

  if (u.faktuur_nommer) {
    // REEDS AANVAAR. Die kliënt het dalk twee keer geklik of die skakel
    // aangestuur. Die faktuur se nommer staan daar sodat hy weet waarna om te
    // soek in sy pos.
    onder = kw_boodskap(
      u,
      "aanvaar",
      t_in("kw_aanvaar_klaar_kop", u.taal),
      t_in("kw_aanvaar_klaar_lei", u.taal),
      `<p class="kw-nommer">${kw_ontsnap(t_in("bk_nommer", u.taal))}:
        <b>${kw_ontsnap(u.faktuur_nommer)}</b></p>`
    );
  } else if (u.stand === "verval") {
    onder = kw_boodskap(
      u,
      "verval",
      t_in("kw_verval_kop", u.taal),
      t_in("kw_verval_lei", u.taal)
    );
  } else if (!u.kan_aanvaar) {
    // Verwerp, of enigiets anders wat nie oop is nie. Die kliënt kry geen
    // rede: die rede is 'n gesprek, nie 'n boodskap nie.
    onder = kw_boodskap(
      u,
      "verwerp",
      t_in("kw_verval_kop", u.taal),
      t_in("kw_aanvaar_fout", u.taal)
    );
  } else {
    onder = kw_aanvaarblok(u);
  }

  plek.innerHTML = kw_dokument(u) + onder;

  const knop = document.getElementById("kw-aanvaar-knop");
  if (knop) knop.addEventListener("click", kw_aanvaar);

  const druk = document.getElementById("kw-druk");
  if (druk) druk.addEventListener("click", () => window.print());

  const voet = document.getElementById("kw-voet");
  if (voet) {
    voet.textContent =
      u.maatskappy.naam +
      (u.maatskappy.registrasienommer
        ? " · " + t_in("fd_reg_nr", u.taal) + " " + u.maatskappy.registrasienommer
        : "") +
      (u.maatskappy.adres ? " · " + u.maatskappy.adres.replace(/\n/g, ", ") : "");
  }
}

function kw_wys_fout(boodskap) {
  const el = document.getElementById("kw-fout");
  if (!el) return;
  el.textContent = boodskap;
  el.hidden = false;
}

/* AANVAAR.

   DIE KNOPPIE WORD GEDEAKTIVEER EN HERSTEL IN ELKE PAD wat op hierdie bladsy
   bly. Die winkel se betaalknoppie het op "Besig…" vasgesteek omdat hy net in
   die catch-tak herstel is (14 Augustus 2026); hier gebeur dieselfde nie.

   'n Geslaagde aanvaarding herlei WEL, en dan is die knoppie se toestand nie
   meer ons saak nie. */
async function kw_aanvaar() {
  if (KW_BESIG || !KW) return;

  const naam_el = document.getElementById("kw-naam");
  const epos_el = document.getElementById("kw-epos");
  const po_el = document.getElementById("kw-po");
  const knop = document.getElementById("kw-aanvaar-knop");

  const naam = (naam_el && naam_el.value.trim()) || "";
  const epos = (epos_el && epos_el.value.trim()) || "";

  const fout = document.getElementById("kw-fout");
  if (fout) fout.hidden = true;

  if (!naam) {
    kw_wys_fout(t_in("kw_naam_kort", KW.taal));
    if (naam_el) naam_el.focus();
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epos)) {
    kw_wys_fout(t_in("kw_epos_kort", KW.taal));
    if (epos_el) epos_el.focus();
    return;
  }

  KW_BESIG = true;
  const rus = knop ? knop.textContent : "";
  if (knop) {
    knop.disabled = true;
    knop.textContent = t_in("kw_aanvaar_besig", KW.taal);
  }

  try {
    const resp = await fetch("/.netlify/functions/aanvaar-kwotasie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sleutel: KW_SLEUTEL,
        kode: KW_KODE,
        naam,
        epos,
        bestelnommer: (po_el && po_el.value.trim()) || "",
      }),
    });

    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();

    /* DIE BEVESTIGING WORD HIER GETEKEN. Geen herleiding, geen herlaai.

       DIE KLIENT WORD NIE NA PAYSTACK GESTUUR NIE. Hy het pas 'n kwotasie
       aanvaar; hy het nie gesê hy wil nou betaal nie. 'n Kaartveld wat
       onmiddellik verskyn, is 'n tweede besluit wat niemand gevra het nie -- en
       'n skool se finansiële afdeling betaal in elk geval teen 30 dae.

       DIE EPOS DRA ALLES: die proforma as 'n PDF, die betaalskakel en die
       bankbesonderhede. Daar is niks wat hierdie bladsy kan byvoeg nie.

       EN 'N HERLAAI IS NIE 'N BEVESTIGING NIE. Tot 27 Augustus 2026 het
       hierdie tak herlei of herlaai, en toe albei stil misluk, het die knoppie
       op "Faktuur word uitgereik ..." bly staan terwyl die faktuur AL LANK
       uitgereik was en die proforma in die klient se pos. Presies die winkel se
       Besig-fout van 14 Augustus, op 'n nuwe plek.

       Wat hier geteken word, is die toestand wat die bladsy in elk geval sou
       wys as 'n mens haar herlaai -- dieselfde blok, dieselfde woorde. */
    KW.faktuur_nommer = data.faktuur_nommer || KW.faktuur_nommer;
    KW.kan_aanvaar = false;
    KW.stand = "aanvaar";
    kw_teken(KW);
    window.scrollTo(0, 0);
    return;
  } catch (f) {
    console.error("Kon nie die kwotasie aanvaar nie:", f);
    KW_BESIG = false;
    if (knop) {
      knop.disabled = false;
      knop.textContent = rus;
    }
    // Die bediener se boodskap wanneer hy een gee -- hy weet of dit verval,
    // reeds aanvaar of iets anders is. Andersins een sin met 'n pad vorentoe.
    kw_wys_fout(String((f && f.message) || "").trim() || t_in("kw_aanvaar_fout", KW.taal));
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Die blaaier se voorkeur as die beste raaiskoot, tot die antwoord terug is.
  const raaiskoot = (navigator.language || "af").toLowerCase().startsWith("en") ? "en" : "af";
  const besig = document.getElementById("kw-besig-teks");
  if (besig) besig.textContent = t_in("bk_besig", raaiskoot);

  const params = new URLSearchParams(window.location.search);
  KW_SLEUTEL = (params.get("k") || "").trim();
  KW_KODE = (params.get("kode") || "").trim();

  const plek = document.getElementById("kw-inhoud");

  if (!KW_SLEUTEL || !KW_KODE) {
    if (plek) {
      plek.innerHTML = `<div class="kw-kaart kw-t-verval">
        <h2>${t_in("kw_verval_kop", raaiskoot)}</h2>
        <p>${t_in("kw_aanvaar_fout", raaiskoot)}</p>
        <p class="kw-kontak">${t_in("kw_kontak_lei", raaiskoot)}
          <a href="mailto:${KW_KONTAK}">${KW_KONTAK}</a>.</p>
      </div>`;
    }
    return;
  }

  try {
    const resp = await fetch(
      "/.netlify/functions/kry-publieke-kwotasie?k=" +
        encodeURIComponent(KW_SLEUTEL) +
        "&kode=" +
        encodeURIComponent(KW_KODE)
    );
    if (!resp.ok) throw new Error("Status " + resp.status);
    KW = await resp.json();
    kw_teken(KW);
  } catch (f) {
    console.error("Kon nie die kwotasie laai nie:", f);
    if (plek) {
      plek.innerHTML = `<div class="kw-kaart kw-t-verval">
        <h2>${t_in("kw_verval_kop", raaiskoot)}</h2>
        <p>${t_in("kw_aanvaar_fout", raaiskoot)}</p>
        <p class="kw-kontak">${t_in("kw_kontak_lei", raaiskoot)}
          <a href="mailto:${KW_KONTAK}">${KW_KONTAK}</a>.</p>
      </div>`;
    }
  }
});
