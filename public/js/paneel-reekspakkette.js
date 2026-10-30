// paneel-reekspakkette.js
//
// REEKSPAKKETTE op die paneel (Oktober 2026), bo-aan die afdeling Koepons.
// 'n Pakket gee 'n vaste prys vir al die e-boeke van 'n reeks saam, binne
// 'n tydperk (sien netlify/functions/_reekspakkette.js). Personeel kan 'n
// pakket skep, die prys en datums verander, en dit aan of af skakel.

(function () {
  const API = "/.netlify/functions/reekspakkette";
  let rou = [];
  let wysig_id = null;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kop = () => (typeof kry_outorisasie_kop === "function" ? kry_outorisasie_kop() : {});
  const rand = (sent) => `R${(sent / 100).toFixed(2)}`;

  // ISO -> JJJJ-MM-DD in Suid-Afrikaanse tyd (vir <input type=date>).
  function na_datumveld(iso) {
    if (!iso) return "";
    const d = new Date(new Date(iso).getTime() + 2 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }
  // JJJJ-MM-DD -> begin of einde van daardie dag in Suid-Afrikaanse tyd.
  const van_iso = (v) => (v ? `${v}T00:00:00+02:00` : null);
  const tot_iso = (v) => (v ? `${v}T23:59:59+02:00` : null);
  const vertoon_datum = (iso) => (iso ? na_datumveld(iso).replace(/-/g, "/") : "…");

  function status(p) {
    const nou = new Date();
    if (!p.aktief) return "Af";
    if (p.van && new Date(p.van) > nou) return "Begin later";
    if (p.tot && new Date(p.tot) < nou) return "Verby";
    return "Aktief";
  }

  async function laai() {
    const lys = $("rp-lys");
    if (!lys) return;
    try {
      const resp = await fetch(`${API}?alles=1`, { headers: kop() });
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      const data = await resp.json();
      rou = data.rou || [];
      const met_pryse = data.pakkette || [];
      if (!rou.length) {
        lys.innerHTML = `<p class="stelsel-boodskap">Nog geen reekspakkette nie.</p>`;
        return;
      }
      lys.innerHTML = rou
        .map((p) => {
          const m = met_pryse.find((x) => x.id === p.id) || {};
          return `
          <div class="paneel-produk-ry">
            <div class="paneel-produk-inligting">
              <strong>${esc(p.naam_af)}</strong>
              <span class="paneel-produk-outeur">${p.slugs.length} boeke · ${rand(p.prys_sent)}${m.los_sent ? ` (los ${rand(m.los_sent)})` : ""} · ${vertoon_datum(p.van)} tot ${vertoon_datum(p.tot)} · ${status(p)}</span>
            </div>
            <div class="paneel-produk-aksies">
              <button class="terug-skakel rp-wysig" data-id="${esc(p.id)}">Wysig</button>
              <button class="terug-skakel rp-wissel" data-id="${esc(p.id)}">${p.aktief ? "Skakel af" : "Skakel aan"}</button>
            </div>
          </div>`;
        })
        .join("");
      lys.querySelectorAll(".rp-wysig").forEach((b) => b.addEventListener("click", () => maak_oop(rou.find((p) => p.id === b.dataset.id))));
      lys.querySelectorAll(".rp-wissel").forEach((b) =>
        b.addEventListener("click", async () => {
          const p = rou.find((x) => x.id === b.dataset.id);
          b.disabled = true;
          await stoor_rekord({ ...p, prys_rand: p.prys_sent / 100, aktief: !p.aktief });
          laai();
        })
      );
    } catch (fout) {
      console.error("Kon nie reekspakkette laai nie:", fout);
      lys.innerHTML = `<p class="stelsel-boodskap">Kon nie die reekspakkette laai nie.</p>`;
    }
  }

  async function stoor_rekord(pakket) {
    const resp = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kop() },
      body: JSON.stringify({ aksie: "stoor", pakket }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.fout || `Status ${resp.status}`);
    return data;
  }

  function boeke_keuses(gekies) {
    const produkte = (typeof produkte_kas !== "undefined" && produkte_kas) || [];
    const gemerk = new Set(gekies || []);
    return [...produkte]
      .sort((a, b) => String(a.titel).localeCompare(String(b.titel), "af"))
      .map((p) => `<label class="koepon-boek-keuse"><input type="checkbox" value="${esc(p.slug)}" ${gemerk.has(p.slug) ? "checked" : ""}><span>${esc(p.titel)}</span></label>`)
      .join("");
  }

  function maak_oop(p) {
    wysig_id = p ? p.id : null;
    $("rp-vorm").style.display = "block";
    $("rp-naam-af").value = p ? p.naam_af : "";
    $("rp-naam-en").value = p ? p.naam_en || "" : "";
    $("rp-prys").value = p ? (p.prys_sent / 100).toFixed(2) : "";
    $("rp-van").value = p ? na_datumveld(p.van) : "";
    $("rp-tot").value = p ? na_datumveld(p.tot) : "";
    $("rp-boeke").innerHTML = boeke_keuses(p ? p.slugs : []);
    $("rp-fout").textContent = "";
    $("rp-skrap").style.display = p ? "" : "none";
  }

  async function stoor_vorm(e) {
    e.preventDefault();
    const fout = $("rp-fout");
    fout.textContent = "";
    const bestaande = wysig_id ? rou.find((p) => p.id === wysig_id) : null;
    try {
      await stoor_rekord({
        id: wysig_id || "",
        naam_af: $("rp-naam-af").value,
        naam_en: $("rp-naam-en").value,
        slugs: [...$("rp-boeke").querySelectorAll("input:checked")].map((b) => b.value),
        prys_rand: Number($("rp-prys").value),
        van: van_iso($("rp-van").value),
        tot: tot_iso($("rp-tot").value),
        aktief: bestaande ? bestaande.aktief : true,
      });
      $("rp-vorm").style.display = "none";
      laai();
    } catch (f) {
      fout.textContent = f.message;
    }
  }

  async function skrap() {
    if (!wysig_id || !window.confirm("Skrap hierdie reekspakket?")) return;
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kop() },
      body: JSON.stringify({ aksie: "skrap", id: wysig_id }),
    });
    $("rp-vorm").style.display = "none";
    laai();
  }

  function bou() {
    const koepons = document.querySelector('[data-afdeling-inhoud="koepons"]');
    if (!koepons || $("rp-afdeling")) return;
    const blok = document.createElement("div");
    blok.id = "rp-afdeling";
    blok.className = "rp-afdeling";
    blok.innerHTML = `
      <div class="paneel-afdeling-kop">
        <h3 class="paneel-afdeling-titel" style="font-size:1.1em">Reekspakkette</h3>
        <button id="rp-nuut" class="terug-skakel" type="button">+ Nuwe pakket</button>
      </div>
      <p class="paneel-hulp-teks">Al die e-boeke van die pakket saam in die mandjie kry die pakketprys. Koepons geld nie bo-op die pakketprys nie.</p>
      <div id="rp-lys"><p class="stelsel-boodskap">Word gelaai …</p></div>
      <form id="rp-vorm" style="display:none">
        <label class="veld-etiket" for="rp-naam-af">Naam (Afrikaans)</label>
        <input id="rp-naam-af" class="veld-invoer" maxlength="120" placeholder="Bv. hele Speel-Slim-reeks">
        <label class="veld-etiket" for="rp-naam-en">Naam (Engels)</label>
        <input id="rp-naam-en" class="veld-invoer" maxlength="120" placeholder="Bv. whole Play-Smart series">
        <label class="veld-etiket">Boeke in die pakket</label>
        <div id="rp-boeke" class="koepon-boeke-lys"></div>
        <label class="veld-etiket" for="rp-prys">Pakketprys (R)</label>
        <input id="rp-prys" class="veld-invoer" type="number" min="1" step="0.01">
        <label class="veld-etiket" for="rp-van">Van</label>
        <input id="rp-van" class="veld-invoer" type="date">
        <label class="veld-etiket" for="rp-tot">Tot en met</label>
        <input id="rp-tot" class="veld-invoer" type="date">
        <p id="rp-fout" class="vb-foute" style="color:#EC5832"></p>
        <button type="submit" class="kaart-aksie paneel-vorm-indien">Stoor</button>
        <button type="button" id="rp-kanselleer" class="terug-skakel">Kanselleer</button>
        <button type="button" id="rp-skrap" class="terug-skakel" style="color:#EC5832">Skrap</button>
      </form>
      <hr class="rp-skeier">`;
    const kop_el = koepons.querySelector(".paneel-afdeling-kop");
    if (kop_el) kop_el.insertAdjacentElement("beforebegin", blok);
    else koepons.prepend(blok);

    $("rp-nuut").addEventListener("click", () => maak_oop(null));
    $("rp-vorm").addEventListener("submit", stoor_vorm);
    $("rp-kanselleer").addEventListener("click", () => ($("rp-vorm").style.display = "none"));
    $("rp-skrap").addEventListener("click", skrap);

    const s = document.createElement("style");
    s.textContent = `.rp-afdeling{margin-bottom:20px}.rp-skeier{border:0;border-top:1px dashed #E3E0D9;margin:20px 0}`;
    document.head.appendChild(s);
  }

  document.addEventListener("DOMContentLoaded", () => {
    bou();
    document.querySelectorAll('.paneel-kieslys-item[data-afdeling="koepons"]').forEach((b) => b.addEventListener("click", laai));
  });
})();
