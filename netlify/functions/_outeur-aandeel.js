// public/js/paneel-epos-toets.js
//
// Een knoppie in die Waarskuwings-afdeling wat 'n toetspos stuur, sodat die
// SMTP-opstelling bevestig kan word sonder om die blaaier se konsole te
// gebruik.
//
// WAAROM DIT BLY NÁ DIE TOETSFASE: dit is nie 'n eenmalige hulpmiddel nie.
// 'n Posbus se wagwoord verander, 'n gasheer se instellings skuif, en dan
// stop kennisgewings stil. Hierdie knoppie sê binne sekondes of pos nog
// uitgaan — sonder om vir 'n werklike verkoop te wag om agter te kom.
//
// Die Function self (toets-epos.js) is personeel-beskermd; hierdie bladsy-
// kode is net die knoppie.

const EPOS_TOETS_ENDPOINT = "/.netlify/functions/toets-epos";

function epos_toets_wys(boodskap, geslaag) {
  const wrap = document.getElementById("epos-toets-uitslag");
  if (!wrap) return;
  wrap.innerHTML = `<div class="epos-toets-uitslag ${geslaag ? "epos-toets-ja" : "epos-toets-nee"}">${boodskap}</div>`;
}

async function epos_toets_stuur() {
  const knoppie = document.getElementById("epos-toets-knoppie");
  const veld = document.getElementById("epos-toets-aan");
  if (!knoppie) return;

  const oorspronklike_teks = knoppie.textContent;
  knoppie.disabled = true;
  knoppie.textContent = "Besig …";
  epos_toets_wys("Word gestuur …", true);

  try {
    const sessie = typeof identiteit_kry_sessie === "function" ? identiteit_kry_sessie() : null;
    const resp = await fetch(EPOS_TOETS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessie ? { Authorization: `Bearer ${sessie.access_token}` } : {}),
      },
      body: JSON.stringify({ aan: (veld && veld.value.trim()) || undefined }),
    });

    let data = null;
    try {
      data = await resp.json();
    } catch {
      // Die Function gee by 'n 403 gewone teks terug, nie JSON nie.
    }

    if (resp.ok && data && data.ok) {
      epos_toets_wys(
        `✓ Gestuur na <b>${data.aan}</b>. Kyk in die inkassie — en in gemorspos, want dít sê iets oor die aflewerbaarheid.`,
        true
      );
    } else if (resp.status === 403) {
      epos_toets_wys("⚠ Geen toegang nie. Meld weer aan en probeer dan opnuut.", false);
    } else {
      // Wys die instellings wat die bediener wél gevind het — dit wys
      // dadelik of 'n omgewingsveranderlike ontbreek, sonder om die
      // wagwoord self te vertoon.
      const o = (data && data.opstelling) || {};
      const detail = data && data.fout ? `<br><span class="epos-toets-fyn">${data.fout}</span>` : "";
      const opstelling = o.gasheer
        ? `<br><span class="epos-toets-fyn">Gasheer ${o.gasheer} · poort ${o.poort} · gebruiker ${o.gebruiker || "—"} · wagwoord ${o.wagwoord_gestel ? "gestel" : "ONTBREEK"}</span>`
        : `<br><span class="epos-toets-fyn">Geen EPOS_-instellings gevind nie — kyk by Netlify se omgewingsveranderlikes.</span>`;
      epos_toets_wys(`⚠ Kon nie stuur nie.${detail}${opstelling}`, false);
    }
  } catch (fout) {
    epos_toets_wys(`⚠ Kon nie die bediener bereik nie: ${fout.message}`, false);
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = oorspronklike_teks;
  }
}

function epos_toets_koppel() {
  const knoppie = document.getElementById("epos-toets-knoppie");
  if (!knoppie) return;
  knoppie.addEventListener("click", epos_toets_stuur);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", epos_toets_koppel);
} else {
  epos_toets_koppel();
}
