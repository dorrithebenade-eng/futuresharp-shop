// public/js/my-boeke.js
//
// Gebruik die bestaande identiteit.js-module (moet VOOR hierdie skrip op
// die bladsy gelaai word) — geen eie localStorage-lees of eie
// token-verwerking hier nie, alles loop deur identiteit_*-funksies.

function wys_status(teks) {
  const status_el = document.getElementById("my-boeke-status");
  if (status_el) status_el.textContent = teks;
}

function bou_boek_kaart(boek) {
  // 'n Boek is oopmaakbaar as dit beskikbaar is EN (nie 'n leen is NIE, OF
  // die leen nog aktief is — 'n verval-de leen word soos 'n
  // nie-beskikbare boek behandel: nie-klikbaar, met 'n duidelike merker).
  const kan_oopmaak = boek.beskikbaar_nou && (!boek.is_leen || boek.leen_aktief !== false);

  const el = document.createElement(kan_oopmaak ? "a" : "div");
  el.className = "my-boek-kaart";
  if (kan_oopmaak) {
    el.href = `/leser.html?boek=${encodeURIComponent(boek.produk_slug)}`;
  } else {
    el.setAttribute("aria-disabled", "true");
  }

  const omslag_wrap = document.createElement("div");
  omslag_wrap.className = "my-boek-omslag-wrap";

  if (boek.omslag) {
    const omslag_img = document.createElement("img");
    omslag_img.className = "my-boek-omslag";
    omslag_img.src = boek.omslag;
    omslag_img.alt = `Omslag van ${boek.titel}`;
    omslag_img.loading = "lazy";
    omslag_wrap.appendChild(omslag_img);
  } else {
    const plek_el = document.createElement("div");
    plek_el.className = "my-boek-omslag my-boek-omslag--plek";
    plek_el.setAttribute("role", "img");
    plek_el.setAttribute("aria-label", `Geen omslag beskikbaar vir ${boek.titel}`);
    plek_el.textContent = boek.titel;
    omslag_wrap.appendChild(plek_el);
  }

  if (!boek.beskikbaar_nou) {
    const merker = document.createElement("span");
    merker.className = "my-boek-merker";
    merker.textContent = boek.vrystelling_datum
      ? (window.t ? window.t("beskikbaar_vanaf") : "Beskikbaar vanaf") + " " + boek.vrystelling_datum
      : (window.t ? window.t("nog_nie_beskikbaar") : "Nog nie beskikbaar nie");
    omslag_wrap.appendChild(merker);
  } else if (boek.is_leen && boek.leen_aktief === false) {
    const merker = document.createElement("span");
    merker.className = "my-boek-merker my-boek-merker--verval";
    merker.textContent = window.t ? window.t("leen_verval_etiket") : "Leen verval";
    omslag_wrap.appendChild(merker);
  }

  el.appendChild(omslag_wrap);

  const titel_el = document.createElement("p");
  titel_el.className = "my-boek-titel";
  titel_el.textContent = boek.titel;
  el.appendChild(titel_el);

  if (boek.outeur) {
    const outeur_el = document.createElement("p");
    outeur_el.className = "my-boek-outeur";
    outeur_el.textContent = boek.outeur;
    el.appendChild(outeur_el);
  }

  // Leen-status-reël — net vir aktiewe leen-items, wys hoeveel dae oor is.
  if (boek.is_leen && boek.leen_aktief && typeof boek.dae_oor === "number") {
    const leen_el = document.createElement("p");
    leen_el.className = "my-boek-leen-status";
    const eenheid = boek.dae_oor === 1
      ? (window.t ? window.t("dag_enkelvoud") : "dag oor")
      : (window.t ? window.t("dae_oor_meervoud") : "dae oor");
    leen_el.textContent = `⏳ ${boek.dae_oor} ${eenheid}`;
    el.appendChild(leen_el);
  }

  return el;
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
    data.boeke.forEach((boek) => lys_el.appendChild(bou_boek_kaart(boek)));
  } catch (fout) {
    console.error("Kon nie My Boeke laai nie:", fout);
    wys_status(
      window.t ? window.t("fout_boeke_laai") : "Kon nie jou boeke laai nie — probeer later weer."
    );
  }
}

document.addEventListener("DOMContentLoaded", laai_my_boeke);
