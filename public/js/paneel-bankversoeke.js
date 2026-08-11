// public/js/paneel-bankversoeke.js
//
// Wys bo-aan die Outeurs-afdeling wie op 'n verandering van sy
// bankbesonderhede wag, en die knoppie wat dit as gedoen merk.
//
// EIE LÊER: paneelbord.js word nie aangeraak nie. Hierdie een haak in by
// die bestaande Outeurs-afdeling en skryf 'n blok voor die lys in.
//
// DIE VOLGORDE OP DIE SKERM IS DIE VOLGORDE VAN DIE WERK. Die versoekte
// besonderhede staan bo, want dit is wat by die betaaldiens ingetik word;
// die merkblokkie staan daaronder; die knoppie heel onder, en hy bly dof
// tot die merkblokkie afgemerk is. Die knoppie doen nie die verandering
// nie — hy teken aan dat sy reeds gedoen is.
//
// DIE MERKBLOKKIE BEGIN ELKE KEER LEEG, ook ná 'n herlaai. Dit is die
// bevestiging van 'n handeling wat pas gebeur het, nie 'n instelling nie.

const PBV_KRY = "/.netlify/functions/kry-outeurs";
const PBV_MERK = "/.netlify/functions/merk-bankversoek-gedoen";

function pbv_vertaal(sleutel, terugval) {
  return window.t ? window.t(sleutel) : terugval;
}

function pbv_datum(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const maande = ["Januarie", "Februarie", "Maart", "April", "Mei", "Junie",
    "Julie", "Augustus", "September", "Oktober", "November", "Desember"];
  return d.getDate() + " " + maande[d.getMonth()] + " " + d.getFullYear();
}

// Die houer waarin ons teken. Word een keer voor die outeurslys ingeskryf.
function pbv_kry_houer() {
  let houer = document.getElementById("pbv-blok");
  if (houer) return houer;

  const lys = document.getElementById("paneel-outeurs-lys");
  if (!lys || !lys.parentNode) return null;

  houer = document.createElement("div");
  houer.id = "pbv-blok";
  lys.parentNode.insertBefore(houer, lys);
  return houer;
}

function pbv_ry(etiket, waarde) {
  const ry = document.createElement("div");
  ry.className = "pbv-ry";

  const e = document.createElement("span");
  e.className = "pbv-et";
  e.textContent = etiket;

  const w = document.createElement("span");
  w.className = "pbv-wa";
  w.textContent = waarde || "";

  ry.appendChild(e);
  ry.appendChild(w);
  return ry;
}

function pbv_bou_kaart(outeur) {
  const versoek = outeur.bank_versoek || {};
  const ou = outeur.kontak_inligting || {};

  const kaart = document.createElement("div");
  kaart.className = "pbv-kaart";

  const kop = document.createElement("p");
  kop.className = "pbv-naam";
  kop.textContent = outeur.naam || outeur.outeur_id;
  kaart.appendChild(kop);

  const datum = document.createElement("p");
  datum.className = "pbv-datum";
  datum.textContent =
    pbv_vertaal("pbv_versoek_op", "Versoek") + " " + pbv_datum(versoek.versoek_op);
  kaart.appendChild(datum);

  // Wat by die betaaldiens ingetik moet word.
  kaart.appendChild(pbv_ry(pbv_vertaal("ob_bank_houer_ry", "Rekeninghouer"), versoek.houer));
  kaart.appendChild(pbv_ry(pbv_vertaal("ob_bank", "Bank"), versoek.bank_naam));
  kaart.appendChild(pbv_ry(pbv_vertaal("ob_takkode", "Takkode"), versoek.bank_tak_kode));
  kaart.appendChild(
    pbv_ry(pbv_vertaal("ob_rekening", "Rekeningnommer"), versoek.bank_rekeningnommer)
  );

  // Die ou rekening, net as daar een was. Dit is wat 'n mens by die
  // betaaldiens moet herken om te weet jy is by die regte subrekening.
  if (ou.bank_rekeningnommer) {
    const oud = document.createElement("p");
    oud.className = "pbv-oud";
    oud.textContent =
      pbv_vertaal("pbv_tans", "Tans op rekord:") +
      " " +
      [ou.bank_naam, ou.bank_tak_kode, ou.bank_rekeningnommer].filter(Boolean).join(" \u00b7 ");
    kaart.appendChild(oud);
  }

  if (versoek.opmerking) {
    const opm = document.createElement("p");
    opm.className = "pbv-opmerking";
    opm.textContent = versoek.opmerking;
    kaart.appendChild(opm);
  }

  // Die bevestiging.
  const merkry = document.createElement("label");
  merkry.className = "pbv-merkry";

  const merk = document.createElement("input");
  merk.type = "checkbox";

  const merkteks = document.createElement("span");
  merkteks.textContent = pbv_vertaal(
    "pbv_bevestig",
    "Ek het die rekening by Paystack verander"
  );

  merkry.appendChild(merk);
  merkry.appendChild(merkteks);
  kaart.appendChild(merkry);

  const knoppie = document.createElement("button");
  knoppie.type = "button";
  knoppie.className = "kaart-aksie pbv-knop";
  knoppie.textContent = pbv_vertaal("pbv_gedoen", "Merk as gedoen");
  knoppie.disabled = true;
  kaart.appendChild(knoppie);

  const boodskap = document.createElement("p");
  boodskap.className = "pbv-boodskap";
  boodskap.style.display = "none";
  kaart.appendChild(boodskap);

  merk.addEventListener("change", () => {
    knoppie.disabled = !merk.checked;
  });

  knoppie.addEventListener("click", () =>
    pbv_merk_gedoen(outeur.outeur_id, knoppie, merk, boodskap)
  );

  return kaart;
}

async function pbv_merk_gedoen(outeur_id, knoppie, merk, boodskap) {
  knoppie.disabled = true;
  boodskap.style.display = "none";

  try {
    const resp = await fetch(PBV_MERK, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ outeur_id, bevestig: merk.checked === true }),
    });

    if (!resp.ok) {
      const rede = await resp.text();
      boodskap.textContent = rede || pbv_vertaal("pbv_fout", "Kon nie die rekord bywerk nie");
      boodskap.style.display = "";
      knoppie.disabled = !merk.checked;
      return;
    }

    // Die lys word PLAASLIK bygewerk in plaas van weer gevra: Blobs se
    // list() is eventueel konsekwent, en 'n herlees op hierdie oomblik kan
    // die versoek wys wat pas verwyder is.
    await pbv_laai();
  } catch (fout) {
    console.error("Kon nie die bankversoek merk nie:", fout);
    boodskap.textContent = pbv_vertaal("fout_netwerk", "Kon nie verbind nie.");
    boodskap.style.display = "";
    knoppie.disabled = !merk.checked;
  }
}

function pbv_teken(outeurs) {
  const houer = pbv_kry_houer();
  if (!houer) return;

  houer.textContent = "";

  const wagtend = outeurs.filter((o) => o && o.bank_versoek);
  if (wagtend.length === 0) return;

  const kop = document.createElement("h3");
  kop.className = "pbv-kop";
  kop.textContent =
    pbv_vertaal("pbv_kop", "Bankbesonderhede-versoeke") + " (" + wagtend.length + ")";
  houer.appendChild(kop);

  const hulp = document.createElement("p");
  hulp.className = "paneel-hulp-teks";
  hulp.textContent = pbv_vertaal(
    "pbv_hulp",
    "Verander die rekening eers by Paystack. Die knoppie hier teken net aan dat dit gedoen is."
  );
  houer.appendChild(hulp);

  wagtend.forEach((o) => houer.appendChild(pbv_bou_kaart(o)));
}

async function pbv_laai() {
  try {
    const resp = await fetch(PBV_KRY, { headers: { ...kry_outorisasie_kop() } });
    if (!resp.ok) return;

    const data = await resp.json();
    pbv_teken(data.outeurs || []);
  } catch (fout) {
    console.error("Kon nie die bankversoeke laai nie:", fout);
  }
}

// Wag tot paneelbord.js die outeurslys geteken het — dan is die sessie
// geldig en die afdeling bestaan. 'n Eie oproep by bladsy-laai sou sonder
// 'n token loop.
document.addEventListener("DOMContentLoaded", () => {
  const lys = document.getElementById("paneel-outeurs-lys");
  if (!lys) return;

  let gedoen = false;
  new MutationObserver(() => {
    if (gedoen) return;
    gedoen = true;
    pbv_laai();
  }).observe(lys, { childList: true });
});
