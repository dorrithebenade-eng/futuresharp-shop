// public/js/outeur.js
//
// Stap 1 van die outeurspaneelbord: meld aan, koppel die rekening aan 'n
// outeur-inskrywing, en wys die oorsig. My boeke, die indienvorm en die
// bestellings kom in later stappe by, elk in sy eie lêer.
//
// identiteit.js moet VOOR hierdie skrip laai — geen eie token-hantering
// hier nie, alles loop deur identiteit_*-funksies.
//
// WAAROM DIE INHOUD MET `hidden` BEGIN: 'n gebruiker wat nie 'n outeur is
// nie, moet nooit die raamwerk van die paneelbord sien nie, ook nie vir 'n
// oomblik terwyl die Function antwoord nie.

function outeur_wys_status(teks) {
  const el = document.getElementById("outeur-status");
  if (el) el.textContent = teks;
}

function outeur_vertaal(sleutel, terugval) {
  return window.t ? window.t(sleutel) : terugval;
}

// Skryf 'n boodskap en maak 'n e-posadres daarin klikbaar. Ons bou dit met
// DOM-nodes eerder as innerHTML — vertaalde teks moet nooit as HTML
// vertolk word nie. styl.css gee reeds .stelsel-boodskap a die huiskleur.
function outeur_wys_status_met_epos(teks, adres) {
  const el = document.getElementById("outeur-status");
  if (!el) return;

  el.textContent = "";
  const posisie = teks.indexOf(adres);

  if (posisie === -1) {
    el.textContent = teks;
    return;
  }

  el.appendChild(document.createTextNode(teks.slice(0, posisie)));

  const skakel = document.createElement("a");
  skakel.href = `mailto:${adres}`;
  skakel.textContent = adres;
  el.appendChild(skakel);

  el.appendChild(document.createTextNode(teks.slice(posisie + adres.length)));
}

const FUTURE_SHOP_EPOS = "futureshop@futuresharp.co.za";

// Die vier syfers op die oorsig. In stap 1 is die getalle nog leeg — die
// Function wat hulle bereken, kom saam met My boeke. Die blok word nou
// reeds geteken sodat die uitleg nie later verskuif nie.
function teken_syfers(data) {
  const houer = document.getElementById("outeur-syfers");
  if (!houer) return;

  const syfers = [
    { sleutel: "outeur_syfer_titels", terugval: "Titels te koop", waarde: data.titels_te_koop },
    { sleutel: "outeur_syfer_verkope", terugval: "Verkope tot op datum", waarde: data.verkope_totaal },
    { sleutel: "outeur_syfer_deel", terugval: "Jou deel tot op datum", waarde: data.deel_totaal },
    { sleutel: "outeur_syfer_bestellings", terugval: "Bestellings om te stuur", waarde: data.bestellings_uitstaande },
  ];

  houer.innerHTML = "";
  syfers.forEach((syfer) => {
    const blok = document.createElement("div");
    blok.className = "outeur-syfer";

    const waarde = document.createElement("div");
    waarde.className = "outeur-syfer-waarde";
    // Nog geen syfer beskikbaar nie — 'n streep lees beter as 'n nul wat
    // soos 'n werklike resultaat lyk.
    waarde.textContent = syfer.waarde === undefined || syfer.waarde === null ? "—" : syfer.waarde;

    const etiket = document.createElement("div");
    etiket.className = "outeur-syfer-etiket";
    etiket.textContent = outeur_vertaal(syfer.sleutel, syfer.terugval);

    blok.appendChild(waarde);
    blok.appendChild(etiket);
    houer.appendChild(blok);
  });
}

function wys_outeur(data) {
  document.getElementById("outeur-status").textContent = "";

  const groet = document.getElementById("outeur-groet");
  const eerste_naam = String(data.naam || "").trim().split(/\s+/)[0];
  if (groet && eerste_naam) {
    groet.textContent = `${outeur_vertaal("outeur_groet", "Goeiedag")}, ${eerste_naam}`;
  }

  // Die kaart wys net solank die uitbetaling nog nie opgestel is nie.
  const kaart = document.getElementById("outeur-status-kaart");
  if (kaart) kaart.hidden = Boolean(data.uitbetaling_gereed);

  teken_syfers(data);

  document.getElementById("outeur-inhoud").hidden = false;

  // Sein vir die afdeling-lêers (outeur-titels.js en later ander) dat die
  // outeur bevestig is en hulle mag begin laai. Hulle weet niks van
  // aanmelding nie; dit bly hier.
  document.dispatchEvent(new CustomEvent("outeur-gereed", { detail: data }));
}

async function laai_outeur() {
  const sessie = await identiteit_kry_huidige_sessie();

  if (!sessie || !sessie.access_token) {
    outeur_wys_status(outeur_vertaal("meld_aan_vir_paneelbord", "Meld eers aan om jou paneelbord te sien."));
    window.location.href = "/aanmeld.html?terug=/outeur.html";
    return;
  }

  outeur_wys_status(outeur_vertaal("laai_tans", "Laai tans..."));

  try {
    const resp = await fetch("/.netlify/functions/kry-my-outeur", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });

    if (resp.status === 401) {
      // wys_sessie_verval() vat die ELEMENT, nie sy id nie, en skryf die
      // boodskap plus 'n aanmeldknoppie daarin.
      if (typeof wys_sessie_verval === "function") {
        wys_sessie_verval(document.getElementById("outeur-status"), "/outeur.html");
      } else {
        outeur_wys_status(outeur_vertaal("sessie_verval", "Jou sessie het verval. Meld asseblief weer aan."));
      }
      return;
    }

    // Aangemeld, maar hierdie rekening hoort nie aan 'n outeur nie. Dit is
    // 'n gewone koper wat by die adres uitgekom het — nie 'n fout nie, en
    // die boodskap moet dit nie soos een laat klink nie.
    if (resp.status === 404) {
      outeur_wys_status_met_epos(
        outeur_vertaal(
          "outeur_geen_inskrywing",
          `Hierdie rekening is nie as 'n outeur geregistreer nie. Skakel Future Sharp indien jy dink dat daar 'n fout is by die volgende e-pos: ${FUTURE_SHOP_EPOS}`
        ),
        FUTURE_SHOP_EPOS
      );
      return;
    }

    if (resp.status === 409) {
      outeur_wys_status_met_epos(
        outeur_vertaal(
          "outeur_dubbel_inskrywing",
          `Meer as een outeur is by hierdie e-posadres geregistreer. Skakel Future Sharp by die volgende e-pos sodat dit reggestel kan word: ${FUTURE_SHOP_EPOS}`
        ),
        FUTURE_SHOP_EPOS
      );
      return;
    }

    if (!resp.ok) {
      outeur_wys_status(outeur_vertaal("fout_algemeen", "Iets het verkeerd geloop. Probeer asseblief weer."));
      return;
    }

    wys_outeur(await resp.json());
  } catch (fout) {
    console.error("Kon nie die outeur laai nie:", fout);
    outeur_wys_status(outeur_vertaal("fout_netwerk", "Kon nie verbind nie. Kontroleer jou verbinding en probeer weer."));
  }
}

document.addEventListener("DOMContentLoaded", laai_outeur);
