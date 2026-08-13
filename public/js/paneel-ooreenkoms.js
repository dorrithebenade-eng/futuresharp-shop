// public/js/paneel-ooreenkoms.js
//
// Die "Ooreenkoms en dokumente"-blok bo-aan die outeursvorm in die
// paneelbord: wie geteken het, wanneer, watter weergawe; die bankbrief en
// die ID-afskrif; en Future Sharp se bevestiging.
//
// EIE LÊER: paneelbord.js hanteer die vorm en die register en bly
// onaangeraak behalwe vir één aanroep. Dit is 'n groot lêer en die blok
// het niks met die res van sy werk te doen nie.
//
// KLOUSULE 14: die outeur onderteken elektronies wanneer hy registreer;
// Future Sharp aanvaar wanneer die registrasie bevestig word. Die knoppie
// hier IS daardie aanvaarding — dit is nie 'n admin-merkie nie.
//
// DIE KNOPPIE DOEN NET EEN DING. Hy skep geen Paystack-subrekening nie en
// stuur geen e-pos nie. Die subrekening word met die hand opgestel en die
// kode in hierdie selfde vorm ingevoer; die knoppie sê net dat dit gedoen
// is. Twee dinge in een knoppie sou beteken 'n mens kan later nie sê
// watter een gebeur het nie.
//
// DIE DOKUMENTE WORD MET 'n AUTHORIZATION-KOP GEHAAL en as 'n blob-URL
// oopgemaak. 'n Gewone <a href> kan nie 'n kop stuur nie, en 'n ID-afskrif
// mag nooit sonder 'n rolkontrole bereikbaar wees nie.

const PO_TERUGVAL = {
  po_kop: "Ooreenkoms en dokumente",
  po_merk_wag: "Wag vir bevestiging",
  po_merk_klaar: "Bevestig",
  po_onderteken_deur: "Onderteken deur",
  po_op: "Op",
  po_weergawe: "Weergawe",
  po_bevestig_deur: "Bevestig deur",
  po_bankbrief: "Bankbrief",
  po_idafskrif: "ID-afskrif",
  po_bevestig_lei:
    "Bevestig die registrasie sodra die uitbetalingsrekening opgestel is. Dit is Future Sharp se ondertekening ingevolge klousule 14, en dit kan nie ongedaan gemaak word nie.",
  po_bevestig_knoppie: "Bevestig registrasie",
  po_bevestig_vra:
    "Bevestig hierdie registrasie? Dit teken Future Sharp se aanvaarding van die ooreenkoms aan en kan nie ongedaan gemaak word nie.",
  po_besig: "Besig …",
  po_geen:
    "Hierdie outeur is met die hand bygevoeg en het nie deur die aansluitvorm geregistreer nie. Daar is geen ondertekende ooreenkoms of dokumente op die rekord nie.",
  po_dok_fout: "Kon nie die dokument oopmaak nie",
  po_bevestig_fout: "Kon nie bevestig nie",
};

function po_t(sleutel) {
  return window.t ? window.t(sleutel) : PO_TERUGVAL[sleutel] || sleutel;
}

function po_datum(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("af-ZA", { year: "numeric", month: "long", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("af-ZA", { hour: "2-digit", minute: "2-digit" })
  );
}

function po_grootte(grepe) {
  const mb = (Number(grepe) || 0) / 1048576;
  return mb.toFixed(1).replace(".", ",") + "MB";
}

function po_ry(etiket, waarde, klas) {
  const ry = document.createElement("div");
  ry.className = "po-ry";

  const links = document.createElement("span");
  links.textContent = etiket;

  const regs = document.createElement("span");
  if (klas) regs.className = klas;
  regs.textContent = waarde;

  ry.appendChild(links);
  ry.appendChild(regs);
  return ry;
}

// --- Die dokumente ------------------------------------------------------

async function po_maak_dokument_oop(outeur_id, soort, knoppie) {
  const oud = knoppie.textContent;
  knoppie.disabled = true;

  try {
    const resp = await fetch(
      `/.netlify/functions/kry-outeur-dokument?outeur_id=${encodeURIComponent(outeur_id)}&soort=${soort}`,
      { headers: kry_outorisasie_kop() }
    );
    if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");

    // Die blaaier het die blob nodig totdat die oortjie hom gelees het.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (fout) {
    console.error("Kon nie die dokument oopmaak nie:", fout);
    alert(`${po_t("po_dok_fout")}: ${fout.message}`);
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = oud;
  }
}

function po_dokument_knoppie(outeur_id, soort, inskrywing) {
  const knoppie = document.createElement("button");
  knoppie.type = "button";
  knoppie.className = "po-dok";

  const naam = document.createElement("span");
  naam.textContent = "📄 " + po_t(soort === "bankbrief" ? "po_bankbrief" : "po_idafskrif");

  const fyn = document.createElement("span");
  fyn.className = "po-dok-naam";
  fyn.textContent = `${inskrywing.naam || ""} · ${po_grootte(inskrywing.grootte)}`;

  knoppie.appendChild(naam);
  knoppie.appendChild(fyn);
  knoppie.addEventListener("click", () => po_maak_dokument_oop(outeur_id, soort, knoppie));
  return knoppie;
}

// --- Die bevestiging ----------------------------------------------------

async function po_bevestig(outeur_id, knoppie) {
  if (!confirm(po_t("po_bevestig_vra"))) return;

  knoppie.disabled = true;
  knoppie.textContent = po_t("po_besig");

  try {
    const resp = await fetch("/.netlify/functions/bevestig-outeur", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ outeur_id }),
    });
    if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);
    const uitslag = await resp.json();

    // Plaaslik bywerk, nie herlaai nie: Blobs se list() is eventueel
    // konsekwent, dus sou 'n herlaai die ou stand kon terugwys en dit sou
    // lyk of die knoppie niks gedoen het nie.
    po_teken(po_huidige_outeur_met(uitslag));
  } catch (fout) {
    console.error("Kon nie bevestig nie:", fout);
    alert(`${po_t("po_bevestig_fout")}: ${fout.message}`);
    knoppie.disabled = false;
    knoppie.textContent = po_t("po_bevestig_knoppie");
  }
}

let po_outeur = null;

function po_huidige_outeur_met(uitslag) {
  return {
    ...po_outeur,
    ooreenkoms: {
      ...(po_outeur.ooreenkoms || {}),
      bevestig_op: uitslag.bevestig_op,
      bevestig_deur: uitslag.bevestig_deur,
    },
  };
}

// --- Teken ---------------------------------------------------------------

function po_teken(outeur) {
  po_outeur = outeur;

  const blok = document.getElementById("po-blok");
  const merk = document.getElementById("po-merk");
  const lyf = document.getElementById("po-lyf");
  if (!blok || !merk || !lyf) return;

  merk.textContent = "";
  merk.className = "";
  lyf.innerHTML = "";

  // Geen outeur nie: die vorm staan op "voeg by".
  if (!outeur || !outeur.outeur_id) {
    blok.style.display = "none";
    return;
  }

  blok.style.display = "block";

  const ooreenkoms = outeur.ooreenkoms || {};
  const dokumente = outeur.dokumente || {};

  // Met die hand bygevoeg — sê dit reguit in plaas van om leeg te lyk.
  if (!ooreenkoms.aanvaar_op) {
    const p = document.createElement("p");
    p.className = "po-leeg";
    p.textContent = po_t("po_geen");
    lyf.appendChild(p);
    return;
  }

  const bevestig = !!ooreenkoms.bevestig_op;
  merk.className = "po-merk " + (bevestig ? "po-merk--klaar" : "po-merk--wag");
  merk.textContent = po_t(bevestig ? "po_merk_klaar" : "po_merk_wag");

  lyf.appendChild(po_ry(po_t("po_onderteken_deur"), ooreenkoms.handtekening || "—", "po-handtekening"));
  lyf.appendChild(po_ry(po_t("po_op"), po_datum(ooreenkoms.aanvaar_op)));
  lyf.appendChild(
    po_ry(
      po_t("po_weergawe"),
      `${ooreenkoms.weergawe || "—"}${ooreenkoms.taal ? " (" + ooreenkoms.taal.toUpperCase() + ")" : ""}`
    )
  );

  if (bevestig) {
    lyf.appendChild(po_ry(po_t("po_bevestig_deur"), ooreenkoms.bevestig_deur || "—"));
    lyf.appendChild(po_ry(po_t("po_op"), po_datum(ooreenkoms.bevestig_op)));
  }

  const dokRy = document.createElement("div");
  dokRy.className = "po-dokumente";
  ["bankbrief", "idafskrif"].forEach((soort) => {
    if (dokumente[soort] && dokumente[soort].sleutel) {
      dokRy.appendChild(po_dokument_knoppie(outeur.outeur_id, soort, dokumente[soort]));
    }
  });
  if (dokRy.children.length) lyf.appendChild(dokRy);

  if (!bevestig) {
    const voet = document.createElement("div");
    voet.className = "po-bevestig";

    const lei = document.createElement("p");
    lei.className = "po-bevestig-lei";
    lei.textContent = po_t("po_bevestig_lei");

    const knoppie = document.createElement("button");
    knoppie.type = "button";
    knoppie.className = "po-knoppie";
    knoppie.textContent = po_t("po_bevestig_knoppie");
    knoppie.addEventListener("click", () => po_bevestig(outeur.outeur_id, knoppie));

    voet.appendChild(lei);
    voet.appendChild(knoppie);
    lyf.appendChild(voet);
  }
}

// paneelbord.js roep dit aan wanneer die vorm oopmaak.
window.po_wys = po_teken;
