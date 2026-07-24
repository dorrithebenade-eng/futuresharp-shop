// public/js/my-boeke.js
//
// Gebruik die bestaande identiteit.js-module (moet VOOR hierdie skrip op
// die bladsy gelaai word) — geen eie localStorage-lees of eie
// token-verwerking hier nie, alles loop deur identiteit_*-funksies.

function wys_status(teks) {
  const status_el = document.getElementById("my-boeke-status");
  if (status_el) status_el.textContent = teks;
}

function bou_boek_ry(boek) {
  const li = document.createElement("li");
  li.className = "boek-ry";

  const titel_el = document.createElement("span");
  titel_el.className = "boek-titel";
  titel_el.textContent = boek.titel;
  li.appendChild(titel_el);

  if (boek.beskikbaar_nou) {
    const skakel = document.createElement("a");
    skakel.className = "knoppie knoppie--primer";
    skakel.href = `/leser.html?boek=${encodeURIComponent(boek.produk_slug)}`;
    skakel.textContent = window.t ? window.t("lees_aanlyn") : "Lees aanlyn";
    li.appendChild(skakel);
  } else {
    const wag_boodskap = document.createElement("span");
    wag_boodskap.className = "boek-nog-nie-beskikbaar";
    const datum_teks = boek.vrystelling_datum
      ? (window.t ? window.t("beskikbaar_vanaf") : "Beskikbaar vanaf") + " " + boek.vrystelling_datum
      : (window.t ? window.t("nog_nie_beskikbaar") : "Nog nie beskikbaar nie");
    wag_boodskap.textContent = datum_teks;
    li.appendChild(wag_boodskap);
  }

  return li;
}

async function laai_my_boeke() {
  // identiteit_kry_huidige_sessie() verfris outomaties 'n verlope
  // access_token via die refresh_token — sien identiteit.js.
  const sessie = await identiteit_kry_huidige_sessie();

  if (!sessie || !sessie.access_token) {
    wys_status(
      window.t
        ? window.t("meld_aan_vir_my_boeke")
        : "Meld eers aan om jou boeke te sien."
    );
    // Pas hierdie pad aan indien die koper-aanmeld-bladsy anders genoem is
    window.location.href = "/aanmeld.html?terug=/my-boeke.html";
    return;
  }

  wys_status(window.t ? window.t("laai_tans") : "Laai tans...");

  try {
    const resp = await fetch("/.netlify/functions/kry-my-boeke", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });

    if (resp.status === 401) {
      wys_status(
        window.t ? window.t("sessie_verval") : "Jou sessie het verval — meld gerus weer aan."
      );
      return;
    }

    if (!resp.ok) {
      throw new Error(`Onverwagte status: ${resp.status}`);
    }

    const data = await resp.json();
    const lys_el = document.getElementById("my-boeke-lys");
    lys_el.innerHTML = "";

    if (!data.boeke || data.boeke.length === 0) {
      wys_status(
        window.t ? window.t("geen_boeke_nog") : "Jy het nog geen e-boeke gekoop nie."
      );
      return;
    }

    wys_status("");
    data.boeke.forEach((boek) => lys_el.appendChild(bou_boek_ry(boek)));
  } catch (fout) {
    console.error("Kon nie My Boeke laai nie:", fout);
    wys_status(
      window.t ? window.t("fout_boeke_laai") : "Kon nie jou boeke laai nie — probeer later weer."
    );
  }
}

document.addEventListener("DOMContentLoaded", laai_my_boeke);
