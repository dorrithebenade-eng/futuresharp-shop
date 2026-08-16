// public/js/faktuur-foon.js
//
// Die verdeling-opsomming wat op 'n foon in die backoffice se plek kom.
//
// 'N EIE LÊER wat by die bestaande skerm inhaak. faktuur-backoffice.js bly
// onaangeraak; hy roep reeds bo_teken() na elke verandering, en hierdie een
// haak by daardie oomblik in.
//
// WAT DIT IS, EN WAT DIT NIE IS NIE
//
// Nie 'n verkleinde backoffice nie. Die begroting, die verdelingsrye en die
// afslagvelde val WEG op 'n foon, want om hulle te VERANDER verg 'n groter
// skerm — die syfers lê langs mekaar sodat hulle vergelyk kan word, en dit
// werk eenvoudig nie op 380px nie.
//
// Wat oorbly, is die GETALLE wat 'n mens moet weet voordat hy stuur, plus die
// hele dokument, wat volledig bewerkbaar bly. Dit is die faktuur wat 'n mens
// tussen twee vergaderings maak, en dit werk slegs omdat die verdeling reeds
// êrens vasstaan.
//
// DIE ONTVANGERS WORD GETEL, NIE GELYS NIE. Op 'n foon is die vraag nie WIE
// nie; dit is HOEVEEL moet ek later self oorbetaal. Daardie tweede reël —
// "met die hand" — is die enigste een wat later werk maak.
//
// DIE WAARSKUWING MAG NOOIT WEGVAL NIE. 'n Mens kan op 'n foon 'n bedrag
// verander en die verdeling oorbestee sonder om dit te sien, en dan weier
// Paystack die transaksie by uitreiking. Die tekort staan dus BOAAN, voor die
// syfers.

function fo_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

// Die som se getalle kom in RAND. Dieselfde formateerder as die res van die
// module, en dieselfde taal as die backoffice: die platform s'n, nie die
// faktuur s'n nie. Hierdie kaart is jou skerm, nie die kliënt se dokument.
function fo_rand(bedrag) {
  const sent = Math.round((Number(bedrag) || 0) * 100);
  return window.t_rand ? t_rand(sent, kry_huidige_taal()) : "R" + (sent / 100).toFixed(2);
}

function fo_ontsnap(waarde) {
  return String(waarde == null ? "" : waarde)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Een ontvanger, nie een ry nie. Iemand met 'n kostery en 'n persentasie is
// één oorbetaling — dieselfde groepering as stuur-faktuur.js se vries.
function fo_tel(u) {
  const per_naam = new Map();
  (u.ontvangers || []).forEach((o) => {
    if (!o.naam || o.sent <= 0) return;
    per_naam.set(o.naam, (per_naam.get(o.naam) || 0) + o.sent);
  });

  let split_n = 0;
  let split_sent = 0;
  let hoof_n = 0;
  let hoof_sent = 0;

  per_naam.forEach((sent, naam) => {
    if (bo_pad(naam) === "split") {
      split_n += 1;
      split_sent += sent;
    } else {
      hoof_n += 1;
      hoof_sent += sent;
    }
  });

  return { split_n, split_sent, hoof_n, hoof_sent };
}

function fo_ontvangerwoord(n) {
  return n === 1
    ? fo_t("fo_ontvanger_een", "1 ontvanger")
    : `${n} ${fo_t("fo_ontvangers", "ontvangers")}`;
}

function fo_teken() {
  const plek = document.getElementById("fv-foon");
  if (!plek || typeof bo_som !== "function") return;

  let S;
  try {
    S = bo_som();
  } catch (fout) {
    console.error("Kon nie die opsomming reken nie:", fout);
    return;
  }

  const tel = fo_tel(S.u);
  const tekort = Boolean(S.u.oorbestee) || S.bly < 0;

  const ry = (etiket, bedrag, klasse) =>
    `<div class="fo-ry${klasse ? " " + klasse : ""}"><span>${etiket}</span><b>${bedrag}</b></div>`;

  const rye = [];

  // Wat die kliënt betaal, wat afgaan, en wat oorbly om te verdeel.
  rye.push(ry(fo_t("fo_totaal", "Faktuurtotaal"), fo_rand(S.betaal)));
  rye.push(ry(fo_t("fo_fooi", "Transaksiefooi"), "− " + fo_rand(S.fooi)));
  rye.push(
    ry(fo_t("fo_verdeelbaar", "Verdeelbaar"), fo_rand(S.betaal - S.fooi))
  );

  // Die twee paaie. 'n Ry met nul ontvangers verskyn nie — 'n reël wat
  // "0 ontvangers" sê, is 'n reël wat niks sê nie.
  if (tel.split_n || tel.hoof_n) {
    rye.push(`<div class="fo-kopreel">${fo_t("fo_uitbetaal", "Word uitbetaal")}</div>`);
    if (tel.split_n) {
      rye.push(
        ry(
          `${fo_ontvangerwoord(tel.split_n)} — ${fo_t("fo_deur_paystack", "deur Paystack")}`,
          fo_rand(tel.split_sent / 100)
        )
      );
    }
    // DIE BELANGRIKSTE REËL. 'n Ontvanger sonder 'n subrekening word nie deur
    // Paystack betaal nie; iemand moet dit later self doen.
    if (tel.hoof_n) {
      rye.push(
        ry(
          `${fo_ontvangerwoord(tel.hoof_n)} — ${fo_t("fo_met_hand", "met die hand")}`,
          fo_rand(tel.hoof_sent / 100)
        )
      );
    }
  }

  rye.push(`<div class="fo-kopreel">${fo_t("fo_bly_hoof", "Bly in die hoofrekening")}</div>`);
  if (S.u.hosting > 0) {
    rye.push(ry(fo_t("fo_hosting", "Hosting"), fo_rand(S.u.hosting)));
  }
  if (S.begroot && S.begroot.hoof > 0) {
    rye.push(ry(fo_t("fo_begroot", "Begroot uit die hoofrekening"), "− " + fo_rand(S.begroot.hoof)));
  }
  rye.push(
    ry(fo_t("fo_bly_oor", "Bly oor vir Future Sharp"), fo_rand(S.bly), "groot" + (tekort ? " tekort" : ""))
  );

  plek.innerHTML = `
    <div class="fo-kop">
      <span>${fo_t("fo_kop", "Verdeling — opgestel")}</span>
      ${tekort ? `<span class="fo-merk">${fo_t("fo_tekort", "Tekort")}</span>` : ""}
    </div>
    ${
      tekort
        ? `<div class="fo-waarsku">${fo_t(
            "fo_waarsku",
            "Die verdeling vra meer as wat die faktuur inbring. Paystack sou dit weier — die faktuur kan nie so uitgereik word nie."
          )}</div>`
        : ""
    }
    ${rye.join("")}
    <p class="fo-nota">${fo_t(
      "fo_nota",
      "Om die begroting of die verdeling te verander, is 'n groter skerm nodig."
    )}</p>`;
}

/* ═══ inhaak ═══

   bo_teken() en bo_teken_syfers() staan albei op window (faktuur-backoffice.js
   sit hulle daar uitdruklik). Ons wikkel hulle in plaas daarvan om 'n derde
   plek te skep wat onthou moet word om ook te herteken — dieselfde patroon as
   die MutationObserver wat by die paneelbord se kieslys inhaak sonder om
   paneelbord.js te wysig. */
(function fo_haak_in() {
  const wikkel = (naam) => {
    const oud = window[naam];
    if (typeof oud !== "function") return;
    window[naam] = function (...args) {
      const uit = oud.apply(this, args);
      try {
        fo_teken();
      } catch (fout) {
        console.error("Kon nie die foon-opsomming teken nie:", fout);
      }
      return uit;
    };
  };

  // faktuur-backoffice.js laai voor hierdie lêer, dus staan albei reeds daar.
  wikkel("bo_teken");
  wikkel("bo_teken_syfers");
})();

// Die eerste teken, sodra die faktuur gelaai is. FV_GELAAI is die sein uit
// faktuur-vorm.js — 'n vaste wagtyd is 'n raaiskoot.
(async function fo_begin() {
  for (let i = 0; i < 60 && !FV_GELAAI; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
  }
  fo_teken();
})();
