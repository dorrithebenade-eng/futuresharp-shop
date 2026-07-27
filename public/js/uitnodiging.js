// uitnodiging.js — publieke aansluit-vorm. Lees ?token= uit die URL,
// haal die rol_tipe op via kry-uitnodiging, bou die regte rol-spesifieke
// velde, en dien in via voltooi-uitnodiging.

const ROL_ETIKETTE = {
  outeur: "Outeur",
  vennoot: "Vennoot",
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

  wrap.innerHTML = velde
    .map(
      (veld) => `
        <div class="uitn-veld-groep">
          <label class="uitn-etiket-groot" for="uitn-${veld.id}">
            <span class="uitn-ikoon-etiket">${VELD_IKONE[veld.id] || "✏️"}</span>${veld.etiket}
            ${veld.verplig ? '<span class="veld-verplig">(verplig)</span>' : '<span class="veld-opsioneel">(opsioneel)</span>'}
          </label>
          <input type="${veld.tipe}" id="uitn-${veld.id}" class="uitn-invoer-groot" ${veld.verplig ? "required" : ""}>
        </div>
      `
    )
    .join("");
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
  knoppie.disabled = true;
  knoppie.textContent = "Besig …";

  try {
    const resp = await fetch("/.netlify/functions/voltooi-uitnodiging", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        naam,
        kontak_inligting: kry_kontak_inligting_uit_vorm(rol_tipe),
      }),
    });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    document.getElementById("uitnodiging-vorm").style.display = "none";
    wys_status("Dankie! Jou inligting is ontvang. Future Sharp sal binnekort met jou skakel.", false);
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
