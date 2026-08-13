// uitnodiging.js — publieke aansluit-vorm. Lees ?token= uit die URL,
// haal die rol_tipe op via kry-uitnodiging, bou die regte rol-spesifieke
// velde, en dien in via voltooi-uitnodiging.

const ROL_ETIKETTE = {
  outeur: "Outeur",
  vennoot: "Vennoot (direkteur)",
  ontwerp_admin: "Ontwerp/Admin",
  printing: "Printing",
  aflewering: "Aflewering",
};

// Rol-spesifieke kontak-/bankvelde — id moet 'n sleutel in KONTAK_VELDE
// (bediener-kant wit-lys) wees.
// Ikoon per veld-tipe — vir die groter, grafies-ryker uitleg.
const VELD_IKONE = {
  epos: "📧",
  selfoon: "📱",
  id_nommer: "🪪",
  adres: "🏠",
  bank_naam: "🏦",
  bank_rekeningnommer: "🏦",
  bank_tak_kode: "🏦",
  btw_nommer: "🧾",
  dekkingsarea: "📍",
};

// Voorkom dat blaaiers hierdie velde per ongeluk met 'n aanmeld-vorm
// verwar (en bv. 'n gestoorde e-posadres in die verkeerde veld invul,
// net omdat 'n teksveld toevallig bo die wagwoord-velde sit). "off" vir
// alles wat nie 'n bekende, veilige autocomplete-betekenis het nie.
const VELD_AUTOCOMPLETE = {
  epos: "email",
  selfoon: "tel",
};
function kry_autocomplete(veld_id) {
  return VELD_AUTOCOMPLETE[veld_id] || "off";
}

const ROL_VELDE = {
  outeur: [
    { id: "epos", etiket: "E-pos", tipe: "email", verplig: true },
    { id: "selfoon", etiket: "Selfoonnommer", tipe: "tel", verplig: true },
    { id: "id_nommer", etiket: "ID-/Paspoortnommer", tipe: "text", verplig: true },
    { id: "adres", etiket: "Adres", tipe: "text", verplig: false },
    { id: "bank_naam", etiket: "Bank", tipe: "text", verplig: true },
    { id: "bank_rekeningnommer", etiket: "Rekeningnommer", tipe: "text", verplig: true },
    { id: "bank_tak_kode", etiket: "Tak-kode", tipe: "text", verplig: true },
  ],
  vennoot: [
    { id: "epos", etiket: "E-pos", tipe: "email", verplig: true },
    { id: "selfoon", etiket: "Selfoonnommer", tipe: "tel", verplig: true },
    { id: "btw_nommer", etiket: "BTW-nommer (indien van toepassing)", tipe: "text", verplig: false },
    { id: "bank_naam", etiket: "Bank", tipe: "text", verplig: true },
    { id: "bank_rekeningnommer", etiket: "Rekeningnommer", tipe: "text", verplig: true },
    { id: "bank_tak_kode", etiket: "Tak-kode", tipe: "text", verplig: true },
  ],
  ontwerp_admin: [
    { id: "epos", etiket: "E-pos", tipe: "email", verplig: true },
    { id: "selfoon", etiket: "Selfoonnommer", tipe: "tel", verplig: true },
    { id: "bank_naam", etiket: "Bank", tipe: "text", verplig: true },
    { id: "bank_rekeningnommer", etiket: "Rekeningnommer", tipe: "text", verplig: true },
    { id: "bank_tak_kode", etiket: "Tak-kode", tipe: "text", verplig: true },
  ],
  printing: [
    { id: "epos", etiket: "E-pos", tipe: "email", verplig: true },
    { id: "selfoon", etiket: "Selfoonnommer", tipe: "tel", verplig: true },
    { id: "bank_naam", etiket: "Bank", tipe: "text", verplig: true },
    { id: "bank_rekeningnommer", etiket: "Rekeningnommer", tipe: "text", verplig: true },
    { id: "bank_tak_kode", etiket: "Tak-kode", tipe: "text", verplig: true },
  ],
  aflewering: [
    { id: "epos", etiket: "E-pos", tipe: "email", verplig: true },
    { id: "selfoon", etiket: "Selfoonnommer", tipe: "tel", verplig: true },
    { id: "dekkingsarea", etiket: "Dekkingsarea (watter stede/provinsies)", tipe: "text", verplig: true },
    { id: "bank_naam", etiket: "Bank", tipe: "text", verplig: true },
    { id: "bank_rekeningnommer", etiket: "Rekeningnommer", tipe: "text", verplig: true },
    { id: "bank_tak_kode", etiket: "Tak-kode", tipe: "text", verplig: true },
  ],
};

// Net hierdie twee rolle kry outomaties 'n koper-tipe rekening — moet
// dus 'n wagwoord kies. Ander rolle sien geen wagwoord-velde nie.
const ROLLE_MET_REKENING = ["outeur", "vennoot"];

// Slegs die outeur teken 'n Outeursooreenkoms. Die dokument word vooraf
// per e-pos gestuur en is doelbewus NIE hier as skakel nie — die .docx'e
// leef nie op die werf nie, en 'n skakel na iets wat nie bestaan nie, is
// erger as geen skakel. Die merkblokkie bevestig wat hy reeds ontvang
// het; hy is nie 'n handtekening nie.
const ROLLE_MET_OOREENKOMS = ["outeur"];

function kry_token_uit_url() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("token") || "").trim();
}

function wys_status(teks, is_fout) {
  const el = document.getElementById("uitnodiging-status");
  el.textContent = teks;
  el.style.display = "block";
  el.classList.toggle("stelsel-boodskap--fout", !!is_fout);
}

function bou_velde(rol_tipe) {
  const wrap = document.getElementById("uitnodiging-velde");
  const velde = ROL_VELDE[rol_tipe] || [];

  const veldeHtml = velde
    .map(
      (veld) => `
        <div class="uitn-veld-groep">
          <label class="uitn-etiket-groot" for="uitn-${veld.id}">
            <span class="uitn-ikoon-etiket">${VELD_IKONE[veld.id] || "✏️"}</span>${veld.etiket}
            ${veld.verplig ? '<span class="veld-verplig">(verplig)</span>' : '<span class="veld-opsioneel">(opsioneel)</span>'}
          </label>
          <input type="${veld.tipe}" id="uitn-${veld.id}" class="uitn-invoer-groot" autocomplete="${kry_autocomplete(veld.id)}" ${veld.verplig ? "required" : ""}>
        </div>
      `
    )
    .join("");

  // Ná die bankvelde en VOOR die wagwoord: dit is die laaste ding wat hy
  // bevestig oor die ooreenkoms self, voordat die vorm oorgaan na sy
  // winkelrekening.
  const ooreenkomsHtml = ROLLE_MET_OOREENKOMS.includes(rol_tipe)
    ? `
        <div class="uitn-ooreenkoms">
          <label class="uitn-merk-etiket" for="uitn-ooreenkoms">
            <input type="checkbox" id="uitn-ooreenkoms" class="uitn-merkblokkie" required>
            <span>Ek het die Outeursooreenkoms van Future Sharp ontvang en gelees, en ek aanvaar die inhoud daarvan.</span>
          </label>
        </div>
      `
    : "";

  const rekeningHtml = ROLLE_MET_REKENING.includes(rol_tipe)
    ? `
        <div class="uitn-rekening-afdeling">
          <p class="uitn-rekening-nota">
            🔑 Met hierdie e-pos en wagwoord kan jy voortaan direk by die Future
            Shop-winkel en -leser aanmeld.
          </p>
          <div class="uitn-veld-groep">
            <label class="uitn-etiket-groot" for="uitn-wagwoord">
              <span class="uitn-ikoon-etiket">🔒</span>Kies 'n wagwoord
              <span class="veld-verplig">(verplig)</span>
            </label>
            <input type="password" id="uitn-wagwoord" class="uitn-invoer-groot" autocomplete="new-password" minlength="6" required>
          </div>
          <div class="uitn-veld-groep">
            <label class="uitn-etiket-groot" for="uitn-wagwoord-bevestig">
              <span class="uitn-ikoon-etiket">🔒</span>Bevestig wagwoord
              <span class="veld-verplig">(verplig)</span>
            </label>
            <input type="password" id="uitn-wagwoord-bevestig" class="uitn-invoer-groot" autocomplete="new-password" minlength="6" required>
          </div>
        </div>
      `
    : "";

  wrap.innerHTML = veldeHtml + ooreenkomsHtml + rekeningHtml;
}

function kry_kontak_inligting_uit_vorm(rol_tipe) {
  const velde = ROL_VELDE[rol_tipe] || [];
  const kontak_inligting = {};
  velde.forEach((veld) => {
    const waarde = document.getElementById(`uitn-${veld.id}`).value.trim();
    if (waarde) kontak_inligting[veld.id] = waarde;
  });
  return kontak_inligting;
}

async function hanteer_indiening(gebeurtenis, token, rol_tipe) {
  gebeurtenis.preventDefault();
  const foutWrap = document.getElementById("uitnodiging-vorm-foute");
  foutWrap.style.display = "none";

  const naam = document.getElementById("uitn-naam").value.trim();
  const knoppie = document.getElementById("uitnodiging-indien-knoppie");

  const vereis_ooreenkoms = ROLLE_MET_OOREENKOMS.includes(rol_tipe);
  const ooreenkoms_aanvaar = vereis_ooreenkoms
    ? document.getElementById("uitn-ooreenkoms").checked
    : false;

  if (vereis_ooreenkoms && !ooreenkoms_aanvaar) {
    foutWrap.textContent = "Bevestig asseblief dat jy die Outeursooreenkoms ontvang en gelees het.";
    foutWrap.style.display = "block";
    return;
  }

  let wagwoord = "";
  if (ROLLE_MET_REKENING.includes(rol_tipe)) {
    wagwoord = document.getElementById("uitn-wagwoord").value;
    const wagwoord_bevestig = document.getElementById("uitn-wagwoord-bevestig").value;

    if (wagwoord.length < 6) {
      foutWrap.textContent = "Wagwoord moet ten minste 6 karakters wees.";
      foutWrap.style.display = "block";
      return;
    }
    if (wagwoord !== wagwoord_bevestig) {
      foutWrap.textContent = "Die twee wagwoorde stem nie ooreen nie.";
      foutWrap.style.display = "block";
      return;
    }
  }

  knoppie.disabled = true;
  knoppie.textContent = "Besig …";

  try {
    const resp = await fetch("/.netlify/functions/voltooi-uitnodiging", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        naam,
        wagwoord,
        ooreenkoms_aanvaar,
        kontak_inligting: kry_kontak_inligting_uit_vorm(rol_tipe),
      }),
    });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    const resultaat = await resp.json();

    document.getElementById("uitnodiging-vorm").style.display = "none";

    if (ROLLE_MET_REKENING.includes(rol_tipe) && resultaat.rekening_geskep) {
      wys_status(
        "Dankie! Jou inligting is ontvang, en jou rekening is geskep — jy kan nou by die Future Shop-winkel aanmeld met jou e-pos en hierdie wagwoord.",
        false
      );
    } else if (ROLLE_MET_REKENING.includes(rol_tipe) && resultaat.rekening_bestaan_reeds) {
      // Nie 'n fout nie, en dit moet nie so lees nie: hy het reeds 'n
      // Future Shop-rekening en het niks van Future Sharp nodig om aan te
      // meld nie. Die ou boodskap het hom vir niks gestuur.
      wys_status(
        "Dankie! Jou inligting is ontvang. Jy het reeds 'n Future Shop-rekening met hierdie e-posadres — meld daarmee aan, met jou bestaande wagwoord. Die wagwoord wat jy hier gekies het, is nie gebruik nie.",
        false
      );
    } else if (ROLLE_MET_REKENING.includes(rol_tipe)) {
      wys_status(
        "Dankie! Jou inligting is ontvang. Die winkel-rekening kon egter nie outomaties geskep word nie — kontak Future Sharp as jy nie kan aanmeld nie.",
        false
      );
    } else {
      wys_status("Dankie! Jou inligting is ontvang. Future Sharp sal binnekort met jou skakel.", false);
    }
  } catch (fout) {
    console.error("Kon nie uitnodiging voltooi nie:", fout);
    foutWrap.textContent = `Kon nie indien nie: ${fout.message}`;
    foutWrap.style.display = "block";
    knoppie.disabled = false;
    knoppie.textContent = "Dien in";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const token = kry_token_uit_url();

  if (!token) {
    wys_status("Hierdie skakel is onvolledig. Kontak Future Sharp vir 'n nuwe skakel.", true);
    return;
  }

  wys_status("Skakel word nagegaan …", false);

  try {
    const resp = await fetch(`/.netlify/functions/kry-uitnodiging?token=${encodeURIComponent(token)}`);

    // 410 is nie 404 nie: die skakel WAS geldig. "Nie geldig nie" laat
    // iemand dink hy het die adres verkeerd oorgetik en dit weer probeer.
    if (resp.status === 410) {
      wys_status("Hierdie skakel het verval. Kontak Future Sharp vir 'n nuwe een.", true);
      return;
    }

    if (!resp.ok) {
      wys_status("Hierdie skakel is nie geldig nie. Kontak Future Sharp vir 'n nuwe skakel.", true);
      return;
    }

    const data = await resp.json();

    if (data.status === "voltooi") {
      wys_status("Hierdie skakel is reeds gebruik. Kontak Future Sharp as jy dink dit is 'n fout.", true);
      return;
    }

    const rol_etiket = ROL_ETIKETTE[data.rol_tipe] || data.rol_tipe;
    document.getElementById("uitnodiging-titel").textContent = "Welkom by Future Sharp!";
    document.getElementById("uitnodiging-subtitel").textContent =
      `Sluit aan as ${rol_etiket} — dit neem net 'n paar minute`;

    // Die outeur se pad is 'n ander vorm: vier stappe met die ooreenkoms
    // en die ondertekening daarin. Hy word oorhandig aan
    // uitnodiging-outeur.js en niks hieronder loop vir hom nie. Vennoot,
    // printing, aflewering en ontwerp/admin het geen ooreenkoms nie en
    // hou hierdie enkelbladsy-vorm presies soos hy was.
    if (data.rol_tipe === "outeur" && typeof uo_begin === "function") {
      uo_begin(token, data);
      return;
    }

    bou_velde(data.rol_tipe);
    document.getElementById("uitnodiging-status").style.display = "none";
    document.getElementById("uitnodiging-vorm").style.display = "block";

    document.getElementById("uitnodiging-vorm").addEventListener("submit", (gebeurtenis) =>
      hanteer_indiening(gebeurtenis, token, data.rol_tipe)
    );
  } catch (fout) {
    console.error("Kon nie uitnodiging laai nie:", fout);
    wys_status("Kon nie hierdie skakel laai nie. Probeer weer, of kontak Future Sharp.", true);
  }
});
