// verslag.js — publieke, leesalleen boek-verslag. Lees ?token= uit die
// URL, haal die outeur/vennoot se eie boek-syfers op, en wys dit.

function kry_token_uit_url() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("token") || "").trim();
}

function wys_status(teks) {
  const el = document.getElementById("verslag-status");
  el.textContent = teks;
  el.style.display = "block";
}

function bou_boek_ry(boek) {
  return `
    <div class="verslag-boek-ry">
      <p class="verslag-boek-titel">${boek.titel}</p>
      <div class="verslag-syfers">
        <div class="verslag-syfer-blok">
          <span class="verslag-syfer">${boek.besigtigings}</span>
          <span class="verslag-syfer-etiket">👁 Besigtigings</span>
        </div>
        <div class="verslag-syfer-blok">
          <span class="verslag-syfer">${boek.aankope_eboek}</span>
          <span class="verslag-syfer-etiket">📖 E-boeke verkoop</span>
        </div>
        <div class="verslag-syfer-blok">
          <span class="verslag-syfer">${boek.aankope_harde_kopie}</span>
          <span class="verslag-syfer-etiket">📦 Harde kopieë verkoop</span>
        </div>
      </div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", async () => {
  const token = kry_token_uit_url();

  if (!token) {
    wys_status("Hierdie skakel is onvolledig. Kontak Future Sharp vir 'n nuwe skakel.");
    return;
  }

  wys_status("Verslag word gelaai …");

  try {
    const resp = await fetch(`/.netlify/functions/kry-verslag?token=${encodeURIComponent(token)}`);
    if (!resp.ok) {
      wys_status("Hierdie skakel is nie geldig nie. Kontak Future Sharp vir 'n nuwe skakel.");
      return;
    }

    const data = await resp.json();

    document.getElementById("verslag-naam").textContent = `Welkom, ${data.naam}`;

    const lys = document.getElementById("verslag-boeke-lys");
    if (!data.boeke.length) {
      lys.innerHTML = `<p class="stelsel-boodskap">Nog geen boeke aan jou gekoppel nie.</p>`;
    } else {
      lys.innerHTML = data.boeke.map(bou_boek_ry).join("");
    }

    document.getElementById("verslag-status").style.display = "none";
    document.getElementById("verslag-inhoud").style.display = "block";
  } catch (fout) {
    console.error("Kon nie verslag laai nie:", fout);
    wys_status("Kon nie hierdie verslag laai nie. Probeer weer, of kontak Future Sharp.");
  }
});
