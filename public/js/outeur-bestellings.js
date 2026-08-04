// public/js/outeur-bestellings.js
//
// Die Bestellings-afdeling: harde kopieë wat die outeur moet stuur, en dié
// wat hy reeds gestuur het. Hy merk hulle hier as gestuur, met 'n datum en
// 'n opsionele spoornommer, en kan dit later wysig of terugtrek.
//
// EIE LÊER, soos outeur-titels.js. Dit wag op die "outeur-gereed"-sein en
// weet niks van aanmelding nie.

function ob_vertaal(sleutel, terugval) {
  return window.t ? window.t(sleutel) : terugval;
}

const OB_MAANDE = [
  "Januarie", "Februarie", "Maart", "April", "Mei", "Junie",
  "Julie", "Augustus", "September", "Oktober", "November", "Desember",
];

// JJJJ-MM-DD of 'n volle ISO-tydstip na "4 Augustus 2026".
function ob_leesbare_datum(waarde) {
  if (!waarde) return "";
  const datum = new Date(String(waarde).length === 10 ? `${waarde}T00:00:00` : waarde);
  if (Number.isNaN(datum.getTime())) return "";
  return `${datum.getDate()} ${OB_MAANDE[datum.getMonth()]} ${datum.getFullYear()}`;
}

function ob_vandag() {
  const nou = new Date();
  const maand = String(nou.getMonth() + 1).padStart(2, "0");
  const dag = String(nou.getDate()).padStart(2, "0");
  return `${nou.getFullYear()}-${maand}-${dag}`;
}

// --- Een bestelling ---

function ob_bou_adres(aflewering) {
  const blok = document.createElement("div");
  blok.className = "outeur-adres";

  if (aflewering.ontvanger) {
    const naam = document.createElement("strong");
    naam.textContent = aflewering.ontvanger;
    blok.appendChild(naam);
  }

  const onderste = [aflewering.provinsie, aflewering.poskode].filter(Boolean).join(", ");
  const reels = [aflewering.straat, aflewering.stad, onderste].filter(Boolean);

  reels.forEach((teks) => {
    blok.appendChild(document.createTextNode(teks));
    blok.appendChild(document.createElement("br"));
  });

  if (aflewering.selfoon) {
    const skakel = document.createElement("a");
    skakel.href = `tel:${aflewering.selfoon.replace(/\s+/g, "")}`;
    skakel.textContent = aflewering.selfoon;
    blok.appendChild(skakel);
  }

  // 'n Ou bestelling sonder ontvanger laat die outeur raai. Sê waar die
  // gaping is eerder as om 'n halwe adres te wys.
  if (!aflewering.ontvanger) {
    const nota = document.createElement("p");
    nota.className = "outeur-adres-nota";
    nota.textContent = ob_vertaal(
      "outeur_geen_ontvanger",
      "Geen ontvangernaam is by hierdie bestelling gestoor nie. Kontak Future Sharp voordat jy dit stuur."
    );
    blok.appendChild(nota);
  }

  return blok;
}

function ob_bou_vorm(bestelling, herlaai) {
  const vorm = document.createElement("div");
  vorm.className = "outeur-versend-vorm";

  // Wyse eerste: dit bepaal watter velde daarna sin maak.
  const wyse_veld = document.createElement("div");
  wyse_veld.className = "outeur-wyse-veld";
  const wyse_etiket = document.createElement("label");
  wyse_etiket.textContent = ob_vertaal("outeur_wyse", "Wie het dit gestuur?");
  const wyse = document.createElement("select");
  wyse.className = "veld-invoer";
  [
    { waarde: "self", sleutel: "outeur_wyse_self", terugval: "Ek het dit self gepos" },
    { waarde: "verskaffer", sleutel: "outeur_wyse_verskaffer", terugval: "'n Drukker of verspreider het dit gestuur" },
  ].forEach((opsie) => {
    const el = document.createElement("option");
    el.value = opsie.waarde;
    el.textContent = ob_vertaal(opsie.sleutel, opsie.terugval);
    wyse.appendChild(el);
  });
  wyse.value = bestelling.wyse === "verskaffer" ? "verskaffer" : "self";
  wyse_veld.appendChild(wyse_etiket);
  wyse_veld.appendChild(wyse);
  vorm.appendChild(wyse_veld);

  // Verskyn slegs by 'n verskaffer. Die outeur kry die kennisgewing van
  // die drukker met 'n verwysingsnommer en skryf dit hier oor.
  const verskaffer_blok = document.createElement("div");
  verskaffer_blok.className = "outeur-veld-paar outeur-verskaffer-blok";

  const naam_veld = document.createElement("div");
  const naam_etiket = document.createElement("label");
  naam_etiket.textContent = ob_vertaal("outeur_verskaffer", "Drukker of verspreider");
  const naam = document.createElement("input");
  naam.type = "text";
  naam.className = "veld-invoer";
  naam.maxLength = 120;
  naam.value = bestelling.verskaffer || "";
  naam_veld.appendChild(naam_etiket);
  naam_veld.appendChild(naam);

  const verw_veld = document.createElement("div");
  const verw_etiket = document.createElement("label");
  verw_etiket.textContent = ob_vertaal("outeur_verskaffer_verwysing", "Sy bestelnommer");
  const verw = document.createElement("input");
  verw.type = "text";
  verw.className = "veld-invoer";
  verw.maxLength = 100;
  verw.value = bestelling.verskaffer_verwysing || "";
  verw_veld.appendChild(verw_etiket);
  verw_veld.appendChild(verw);

  verskaffer_blok.appendChild(naam_veld);
  verskaffer_blok.appendChild(verw_veld);
  vorm.appendChild(verskaffer_blok);

  function wys_verskaffer() {
    verskaffer_blok.style.display = wyse.value === "verskaffer" ? "" : "none";
  }
  wyse.addEventListener("change", wys_verskaffer);
  wys_verskaffer();

  const paar = document.createElement("div");
  paar.className = "outeur-veld-paar";

  const datum_veld = document.createElement("div");
  const datum_etiket = document.createElement("label");
  datum_etiket.textContent = ob_vertaal("outeur_versend_datum", "Datum van versending");
  const datum = document.createElement("input");
  datum.type = "date";
  datum.className = "veld-invoer";
  datum.value = bestelling.gestuur_op || ob_vandag();
  datum.max = ob_vandag();
  datum_veld.appendChild(datum_etiket);
  datum_veld.appendChild(datum);

  const spoor_veld = document.createElement("div");
  const spoor_etiket = document.createElement("label");
  spoor_etiket.textContent = ob_vertaal("outeur_spoornommer", "Spoornommer — opsioneel");
  const spoor = document.createElement("input");
  spoor.type = "text";
  spoor.className = "veld-invoer";
  spoor.maxLength = 100;
  spoor.value = bestelling.spoornommer || "";
  spoor_veld.appendChild(spoor_etiket);
  spoor_veld.appendChild(spoor);

  paar.appendChild(datum_veld);
  paar.appendChild(spoor_veld);
  vorm.appendChild(paar);

  const hulp = document.createElement("p");
  hulp.className = "outeur-hulp";
  hulp.textContent = ob_vertaal(
    "outeur_spoornommer_hulp",
    "Die spoornommer help wanneer die koper later navraag doen."
  );
  vorm.appendChild(hulp);

  const fout = document.createElement("p");
  fout.className = "outeur-versend-fout";
  vorm.appendChild(fout);

  const ry = document.createElement("div");
  ry.className = "outeur-knoppie-ry";

  const bevestig = document.createElement("button");
  bevestig.type = "button";
  bevestig.className = "knoppie-primer";
  bevestig.textContent = ob_vertaal("bevestig", "Bevestig");

  const kanselleer = document.createElement("button");
  kanselleer.type = "button";
  kanselleer.className = "outeur-knoppie-teks";
  kanselleer.textContent = ob_vertaal("kanselleer", "Kanselleer");
  kanselleer.addEventListener("click", herlaai);

  ry.appendChild(bevestig);
  ry.appendChild(kanselleer);

  // Terugtrek verskyn slegs by iets wat reeds gemerk is.
  if (bestelling.gestuur) {
    const terugtrek = document.createElement("button");
    terugtrek.type = "button";
    terugtrek.className = "outeur-knoppie-teks outeur-terugtrek";
    terugtrek.textContent = ob_vertaal("outeur_terugtrek", "Trek terug");
    terugtrek.addEventListener("click", () => {
      ob_stuur(bestelling.bestelnommer, { gestuur: false }, fout, bevestig, herlaai);
    });
    ry.appendChild(terugtrek);
  }

  bevestig.addEventListener("click", () => {
    ob_stuur(
      bestelling.bestelnommer,
      {
        gestuur: true,
        gestuur_op: datum.value,
        wyse: wyse.value,
        verskaffer: naam.value.trim(),
        verskaffer_verwysing: verw.value.trim(),
        spoornommer: spoor.value.trim(),
      },
      fout,
      bevestig,
      herlaai
    );
  });

  vorm.appendChild(ry);
  return vorm;
}

async function ob_stuur(bestelnommer, data, fout_el, knoppie, herlaai) {
  fout_el.textContent = "";
  knoppie.disabled = true;

  try {
    const sessie = await identiteit_kry_huidige_sessie();
    const resp = await fetch("/.netlify/functions/merk-bestelling-gestuur", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessie.access_token}`,
      },
      body: JSON.stringify({ bestelnommer, ...data }),
    });

    if (!resp.ok) {
      fout_el.textContent = await resp.text();
      knoppie.disabled = false;
      return;
    }
    herlaai();
  } catch (fout) {
    console.error("Kon nie die bestelling merk nie:", fout);
    fout_el.textContent = ob_vertaal("fout_netwerk", "Kon nie verbind nie. Probeer weer.");
    knoppie.disabled = false;
  }
}

function ob_bou_kaart(bestelling, herlaai) {
  const kaart = document.createElement("article");
  kaart.className = "outeur-bestelling" + (bestelling.gestuur ? " klaar" : "");

  const kop = document.createElement("div");
  kop.className = "outeur-bestelling-kop";

  const nommer = document.createElement("span");
  nommer.className = "outeur-bestelling-nommer";
  nommer.textContent = bestelling.bestelnommer;
  kop.appendChild(nommer);

  const merkie = document.createElement("span");
  merkie.className = "outeur-merkie " + (bestelling.gestuur ? "lewend" : "wag");
  merkie.textContent = bestelling.gestuur
    ? ob_vertaal("outeur_gestuur", "Gestuur")
    : ob_vertaal("outeur_om_te_stuur", "Om te stuur");
  kop.appendChild(merkie);

  const datum = document.createElement("span");
  datum.className = "outeur-bestelling-datum";
  datum.textContent = ob_leesbare_datum(bestelling.geplaas_op);
  kop.appendChild(datum);

  kaart.appendChild(kop);

  bestelling.items.forEach((item) => {
    const reel = document.createElement("p");
    reel.className = "outeur-bestelling-titel";

    const titel = document.createElement("strong");
    titel.textContent = item.titel;
    reel.appendChild(titel);

    if (item.hoeveelheid > 1) {
      const hoeveel = document.createElement("span");
      hoeveel.className = "outeur-bestelling-hoeveel";
      hoeveel.textContent = ` × ${item.hoeveelheid}`;
      reel.appendChild(hoeveel);
    }
    kaart.appendChild(reel);
  });

  kaart.appendChild(ob_bou_adres(bestelling.aflewering));

  const aksie = document.createElement("div");
  aksie.className = "outeur-bestelling-aksie";

  if (bestelling.gestuur) {
    const reel = document.createElement("p");
    reel.className = "outeur-gestuur-reel";
    const stukke = [
      `${ob_vertaal("outeur_gestuur_op", "Gestuur op")} ${ob_leesbare_datum(bestelling.gestuur_op)}`,
    ];
    if (bestelling.wyse === "verskaffer" && bestelling.verskaffer) {
      const deur = `${ob_vertaal("outeur_deur", "Deur")} ${bestelling.verskaffer}`;
      stukke.push(
        bestelling.verskaffer_verwysing ? `${deur} (${bestelling.verskaffer_verwysing})` : deur
      );
    }
    if (bestelling.spoornommer) {
      stukke.push(`${ob_vertaal("outeur_spoornommer_kort", "Spoornommer")} ${bestelling.spoornommer}`);
    }
    reel.textContent = stukke.join(" · ");
    aksie.appendChild(reel);
  }

  const oop = document.createElement("button");
  oop.type = "button";
  oop.className = bestelling.gestuur ? "outeur-knoppie-teks" : "knoppie-primer";
  oop.textContent = bestelling.gestuur
    ? ob_vertaal("outeur_wysig_versending", "Wysig")
    : ob_vertaal("outeur_merk_gestuur", "Merk as gestuur");

  oop.addEventListener("click", () => {
    oop.style.display = "none";
    aksie.appendChild(ob_bou_vorm(bestelling, herlaai));
  });

  aksie.appendChild(oop);
  kaart.appendChild(aksie);
  return kaart;
}

// --- Laai ---

function ob_teken_lys(houer, bestellings, leeg_teks, herlaai) {
  houer.innerHTML = "";
  if (!bestellings.length) {
    const leeg = document.createElement("p");
    leeg.className = "outeur-leeg";
    leeg.textContent = leeg_teks;
    houer.appendChild(leeg);
    return;
  }
  bestellings.forEach((b) => houer.appendChild(ob_bou_kaart(b, herlaai)));
}

async function laai_my_bestellings() {
  const status = document.getElementById("outeur-bestellings-status");
  if (status) status.textContent = ob_vertaal("laai_tans", "Laai …");

  const sessie = await identiteit_kry_huidige_sessie();
  if (!sessie || !sessie.access_token) return;

  try {
    const resp = await fetch("/.netlify/functions/kry-my-bestellings", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });

    if (!resp.ok) {
      if (status) {
        status.textContent = ob_vertaal("fout_algemeen", "Iets het verkeerd geloop. Probeer asseblief weer.");
      }
      return;
    }

    const data = await resp.json();
    if (status) status.textContent = "";

    ob_teken_lys(
      document.getElementById("outeur-om-te-stuur"),
      data.om_te_stuur || [],
      ob_vertaal("outeur_niks_om_te_stuur", "Niks om te stuur nie."),
      laai_my_bestellings
    );
    ob_teken_lys(
      document.getElementById("outeur-reeds-gestuur"),
      data.gestuur || [],
      ob_vertaal("outeur_niks_gestuur", "Nog niks gestuur nie."),
      laai_my_bestellings
    );
  } catch (fout) {
    console.error("Kon nie die bestellings laai nie:", fout);
    if (status) {
      status.textContent = ob_vertaal("fout_netwerk", "Kon nie verbind nie. Probeer weer.");
    }
  }
}

document.addEventListener("outeur-gereed", laai_my_bestellings);
