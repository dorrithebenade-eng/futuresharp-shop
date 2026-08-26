// public/js/my-boeke.js
//
// Gebruik die bestaande identiteit.js-module (moet VOOR hierdie skrip op
// die bladsy gelaai word) — geen eie localStorage-lees of eie
// token-verwerking hier nie, alles loop deur identiteit_*-funksies.

function wys_status(teks) {
  const status_el = document.getElementById("my-boeke-status");
  if (status_el) status_el.textContent = teks;
}

// Die rekord dra JJJJ-MM-DD (sien merk-bestelling-gestuur.js: 'n DATUM, nie
// 'n tydstip nie -- die outeur weet op watter DAG hy gepos het). "24 Aug 2026"
// lees op 'n kaart beter as "2026-08-24", en die maandnaam volg die bladsy se
// taal.
function formateer_datum(iso) {
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return String(iso);
  const taal =
    (window.kry_huidige_taal && window.kry_huidige_taal()) === "en"
      ? "en-ZA"
      : "af-ZA";
  return d.toLocaleDateString(taal, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function bou_boek_kaart(boek) {
  // 'n Boek is oopmaakbaar as dit beskikbaar is EN (nie 'n leen is NIE, OF
  // die leen nog aktief is — 'n verval-de leen word soos 'n
  // nie-beskikbare boek behandel: nie-klikbaar, met 'n duidelike merker).
  //
  // 'N HARDE KOPIE IS NOOIT OOPMAAKBAAR NIE. Daar is geen leser vir 'n
  // gedrukte boek nie, en 'n kaart wat na leser.html lei vir 'n boek wat per
  // pos kom, is 'n skakel na 'n leë bladsy.
  const kan_oopmaak =
    !boek.is_harde_kopie &&
    boek.beskikbaar_nou &&
    (!boek.is_leen || boek.leen_aktief !== false);

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

  // DIE HARDE-KOPIE-MERKER KOM EERSTE. 'n Gedrukte boek het geen
  // vrystellingsdatum en geen leen nie, dus kan hy nooit met die twee gevalle
  // hieronder bots -- maar die volgorde maak die bedoeling leesbaar: die
  // merker sê wat MET HIERDIE EKSEMPLAAR gebeur, nie of die titel beskikbaar
  // is nie.
  if (boek.is_harde_kopie) {
    const merker = document.createElement("span");
    // 'N PIL, NIE 'N MERKER NIE. .my-boek-merker is 'n VOLLE OORLEG (inset: 0)
    // wat die omslag met 'n donker sluier bedek -- korrek vir 'n boek wat nog
    // nie beskikbaar is nie, want dan is die omslag 'n belofte en nie 'n besit.
    // 'n Harde kopie is GEKOOP en op pad; sy omslag moet sigbaar bly.
    merker.className = boek.gestuur
      ? "my-boek-pil my-boek-pil--gestuur"
      : "my-boek-pil my-boek-pil--bestel";
    merker.textContent = boek.gestuur
      ? (window.t ? window.t("hk_merk_gestuur") : "Gestuur")
      : (window.t ? window.t("hk_merk_bestel") : "Bestel");
    omslag_wrap.appendChild(merker);
  } else if (!boek.beskikbaar_nou) {
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

  // DIE FORMAAT, want een titel kan meer as een keer op die rak staan. Koop 'n
  // mens dieselfde boek as e-boek EN as gedrukte kopie, staan twee kaarte met
  // dieselfde omslag, dieselfde titel en dieselfde outeur langs mekaar. Die
  // e-boek is klikbaar en die harde kopie nie -- maar dit bly onsigbaar tot 'n
  // mens probeer, en 'n kaart wat nie reageer nie lyk stukkend.
  //
  // DIESELFDE SLEUTELS AS DIE MANDJIE EN DIE UITTEKEN. Die koper het "Harde
  // kopie" gekies en "Harde kopie" betaal; hy moet nie hier "Gedrukte boek"
  // lees nie. Drie sleutels wat dieselfde ding beteken, is drie plekke waar
  // hulle uitmekaar kan dryf.
  //
  // LEEN IS DIE UITSONDERING. leen_etiket se Engels is "Borrow" -- 'n
  // werkwoord, wat op 'n knoppie reg lees maar as etiket onder 'n boektitel
  // soos 'n opdrag klink. Daarvoor is daar 'n eie sleutel met "Loan".
  const formaat_woord = boek.is_harde_kopie
    ? window.t && window.t("hardekopie_etiket")
    : boek.is_leen
      ? window.t && window.t("mb_formaat_leen")
      : window.t && window.t("eboek_etiket");

  if (formaat_woord) {
    const formaat_el = document.createElement("p");
    formaat_el.className = "my-boek-formaat";
    formaat_el.textContent = formaat_woord;
    el.appendChild(formaat_el);
  }

  // DIE STATUSREEL VIR 'N HARDE KOPIE. Dit is die hele punt van die kaart:
  // die koper het betaal vir 'n boek wat per pos kom en het tot nou toe nêrens
  // gehad om te kyk nie. Die datum en die spoornommer lê reeds in die rekord --
  // merk-bestelling-gestuur.js skryf hulle wanneer die outeur pos.
  if (boek.is_harde_kopie) {
    const status_el = document.createElement("p");
    status_el.className = "my-boek-hk-status";

    if (boek.gestuur) {
      const datum = boek.gestuur_op
        ? ` ${formateer_datum(boek.gestuur_op)}`
        : "";
      const reel = document.createElement("span");
      reel.textContent =
        (window.t ? window.t("hk_gestuur_op") : "Gestuur op") + datum;
      status_el.appendChild(reel);

      // Die spoornommer op sy eie reël, want dit is die enigste ding op die
      // kaart wat 'n mens oortik of kopieer.
      if (boek.spoornommer) {
        status_el.appendChild(document.createElement("br"));

        // DIE ETIKET IS GEWONE TEKS; NET DIE NOMMER IS MONOSPASIE. Die
        // monospasie is daar sodat 'n 0 van 'n O onderskeibaar is wanneer 'n
        // mens die nommer oortik -- die WOORD "Spoornommer" hoef niemand oor
        // te tik nie, en in monospasie lyk hy soos kode.
        const etiket = document.createTextNode(
          (window.t ? window.t("hk_spoornommer") : "Spoornommer") + " "
        );
        status_el.appendChild(etiket);

        const spoor = document.createElement("span");
        spoor.className = "my-boek-hk-spoor";
        spoor.textContent = boek.spoornommer;
        status_el.appendChild(spoor);
      }
    } else {
      status_el.textContent = window.t
        ? window.t("hk_wag_teks")
        : "Jou bestelling is geplaas. Ons laat weet sodra dit gestuur is.";
    }

    el.appendChild(status_el);
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

  // Leen-na-koop-opgradering: die bediener (kry-my-boeke.js) besluit reeds
  // OF hierdie aanbod nou relevant is (laaste 5 dae van 'n aktiewe leen, of
  // ná verval) — hier wys ons dit bloot as dit teenwoordig is. Voorkom dat
  // die klik na die leser deurloop deur die kaart se eie skakel-gedrag
  // (indien dit 'n <a> is).
  if (boek.opgradering) {
    const opgradering_knoppie = document.createElement("button");
    opgradering_knoppie.type = "button";
    opgradering_knoppie.className = "my-boek-opgradering-knoppie";
    const bedrag = `R${(boek.opgradering.afslag_sent / 100).toFixed(2)}`;
    opgradering_knoppie.textContent = window.t
      ? `${window.t("leen_opgradering_knoppie")} ${bedrag} ${window.t("leen_opgradering_afslag_suffix")}`
      : `Koop nou — ${bedrag} afslag`;
    opgradering_knoppie.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      voeg_by_mandjie({
        produk_slug: boek.produk_slug,
        titel: boek.titel,
        formaat: "eboek",
        prys_sent: boek.opgradering.eboek_prys_sent,
      });
      window.location.href = `/voltooi-betaling.html?koepon=${encodeURIComponent(boek.opgradering.koepon_kode)}`;
    });
    el.appendChild(opgradering_knoppie);
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
      // sessie-verval.js skryf die boodskap én 'n aanmeldknoppie in die
      // status-houer. Val terug op gewone teks indien die lêer nie gelaai
      // is nie.
      const status_el = document.getElementById("my-boeke-status");
      if (window.wys_sessie_verval) {
        window.wys_sessie_verval(status_el, "/my-boeke.html");
      } else {
        wys_status(window.t ? window.t("sessie_verval_kort") : "Sessie verval.");
      }
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
