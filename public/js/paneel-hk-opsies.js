// Harde-kopie-opsies en die register van fisiese items (November 2026).
//
// 1. Katalogus kry 'n knoppie "Fisiese items": 'n register van alles wat
//    gedruk of gepak word (naam, formaat, drukkoste, ISBN).
// 2. Die produkvorm se Harde kopie kry 'n blok "Opsies": elke opsie is 'n
//    stel items met een prys, een verdeling en hosting, en kan 'n
//    kaartjieboodskap vra.
//
// paneelbord.js roep hk_opsies_reset(), hk_opsies_vul(produk) en
// hk_opsies_lees() aan. Gebruik uit paneelbord.js: kry_outorisasie_kop,
// ontsnap_html, skep_verdeling_ry_element, t. Moet NA paneelbord.js laai.

(function () {
  const ITEMS_KRY = "/.netlify/functions/kry-fisiese-items";
  const ITEMS_STOOR = "/.netlify/functions/stoor-fisiese-item";
  const WINKEL = "https://futureshop.futuresharp.co.za";

  let items_kas = [];
  const ROL_ETIKETTE = { outeur: "Outeur", vennoot: "Vennoot (direkteur)", ontwerp_admin: "Ontwerp/Admin", printing: "Printing", aflewering: "Aflewering" };
  let huidige_slug = "";

  const esc = (s) => (typeof ontsnap_html === "function" ? ontsnap_html(String(s == null ? "" : s)) : String(s == null ? "" : s));
  const rand = (sent) => "R" + (Math.round(sent) / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const sleutel_van = (teks) =>
    String(teks || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  // Paystack se fooi: 2,9% + R1, plus 15% BTW, opgerond na die volgende sent.
  const paystack_sent = (prys_sent) => Math.ceil((prys_sent * 0.029 + 100) * 1.15);

  // ---------------------------------------------------------------- items

  async function laai_items() {
    try {
      const r = await fetch(ITEMS_KRY, { headers: kry_outorisasie_kop() });
      if (!r.ok) throw new Error(`Status ${r.status}`);
      items_kas = (await r.json()).items || [];
    } catch (fout) {
      console.error("Kon nie fisiese items laai nie:", fout);
    }
    wys_register();
    document.querySelectorAll(".hko-item-kies").forEach((sel) => {
      const huidig = sel.value || sel.dataset.gekies || "";
      sel.innerHTML = item_opsies_html(huidig);
    });
    document.querySelectorAll(".hko-kaart").forEach(werk_som_by);
  }

  function item_opsies_html(gekies) {
    return `<option value="">Kies 'n item</option>` + items_kas
      .map((i) => `<option value="${esc(i.item_id)}" ${i.item_id === gekies ? "selected" : ""}>${esc(i.naam)}${i.formaat ? " (" + esc(i.formaat) + ")" : ""}</option>`)
      .join("");
  }

  function bou_register_skulp() {
    const anker = document.getElementById("paneel-bondel-eboek");
    if (!anker || document.getElementById("hko-register")) return;
    const knoppies = document.querySelector('[data-afdeling-inhoud="katalogus"] .bondel-kop-knoppies');
    if (knoppies) {
      const k = document.createElement("button");
      k.type = "button";
      k.className = "kaart-aksie bondel-oop-knoppie";
      k.textContent = "Fisiese items";
      k.addEventListener("click", () => {
        const r = document.getElementById("hko-register");
        r.style.display = r.style.display === "none" ? "block" : "none";
        if (r.style.display === "block") laai_items();
      });
      knoppies.insertBefore(k, knoppies.firstChild);
    }
    const blok = document.createElement("div");
    blok.id = "hko-register";
    blok.className = "bondel-eboek";
    blok.style.display = "none";
    blok.innerHTML = `
      <div class="bondel-eboek-kop">
        <h3>Fisiese items</h3>
        <button type="button" class="terug-skakel" id="hko-register-sluit">Sluit</button>
      </div>
      <p class="paneel-hulp-teks">Alles wat gedruk of gepak word, een keer opgestel. Die harde-kopie-opsies van enige boek kies hieruit. Aflewering kan ook 'n item wees.</p>
      <div id="hko-register-lys"></div>
      <div class="veld-ry" style="margin-top:14px;align-items:end;">
        <div><label class="veld-etiket" for="hko-nuut-naam">Naam</label><input id="hko-nuut-naam" class="veld-invoer" placeholder="Joernaal-jaarboek"></div>
        <div><label class="veld-etiket" for="hko-nuut-formaat">Formaat</label><input id="hko-nuut-formaat" class="veld-invoer" placeholder="A4 · hardeband"></div>
        <div><label class="veld-etiket" for="hko-nuut-koste">Drukkoste (R)</label><input id="hko-nuut-koste" type="number" min="0" step="0.01" class="veld-invoer"></div>
        <div><label class="veld-etiket" for="hko-nuut-isbn">ISBN</label><input id="hko-nuut-isbn" class="veld-invoer"></div>
      </div>
      <input type="hidden" id="hko-nuut-id">
      <div style="display:flex;gap:10px;margin-top:10px;align-items:center;">
        <button type="button" class="kaart-aksie" id="hko-nuut-stoor">Stoor item</button>
        <button type="button" class="terug-skakel" id="hko-nuut-kanselleer" style="display:none;">Kanselleer</button>
        <span id="hko-register-boodskap" class="paneel-hulp-teks"></span>
      </div>`;
    anker.after(blok);
    document.getElementById("hko-register-sluit").addEventListener("click", () => (blok.style.display = "none"));
    document.getElementById("hko-nuut-stoor").addEventListener("click", stoor_item);
    document.getElementById("hko-nuut-kanselleer").addEventListener("click", maak_invoer_skoon);
  }

  function wys_register() {
    const lys = document.getElementById("hko-register-lys");
    if (!lys) return;
    if (!items_kas.length) {
      lys.innerHTML = `<p class="stelsel-boodskap">Nog geen items nie.</p>`;
      return;
    }
    lys.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:14px;min-width:620px;">
      <thead><tr style="text-align:left;color:#5B5B5B;font-size:13px;">
        <th style="padding:8px;">Item</th><th style="padding:8px;">Formaat</th><th style="padding:8px;text-align:right;">Drukkoste</th><th style="padding:8px;">ISBN</th><th style="padding:8px;"></th>
      </tr></thead><tbody>
      ${items_kas.map((i) => `<tr style="border-top:1px solid #ECE8E1;">
        <td style="padding:8px;font-weight:500;">${esc(i.naam)}</td>
        <td style="padding:8px;">${esc(i.formaat)}</td>
        <td style="padding:8px;text-align:right;">${i.drukkoste_sent ? rand(i.drukkoste_sent) : "Nog nie"}</td>
        <td style="padding:8px;">${esc(i.isbn)}</td>
        <td style="padding:8px;white-space:nowrap;">
          <button type="button" class="terug-skakel hko-wysig" data-id="${esc(i.item_id)}">Wysig</button>
          <button type="button" class="terug-skakel hko-skrap" data-id="${esc(i.item_id)}">Skrap</button>
        </td></tr>`).join("")}
      </tbody></table></div>`;
    lys.querySelectorAll(".hko-wysig").forEach((b) => b.addEventListener("click", () => {
      const i = items_kas.find((x) => x.item_id === b.dataset.id);
      if (!i) return;
      document.getElementById("hko-nuut-id").value = i.item_id;
      document.getElementById("hko-nuut-naam").value = i.naam || "";
      document.getElementById("hko-nuut-formaat").value = i.formaat || "";
      document.getElementById("hko-nuut-koste").value = i.drukkoste_sent ? (i.drukkoste_sent / 100).toFixed(2) : "";
      document.getElementById("hko-nuut-isbn").value = i.isbn || "";
      document.getElementById("hko-nuut-kanselleer").style.display = "";
    }));
    lys.querySelectorAll(".hko-skrap").forEach((b) => b.addEventListener("click", () => skrap_item(b.dataset.id)));
  }

  function maak_invoer_skoon() {
    ["hko-nuut-id", "hko-nuut-naam", "hko-nuut-formaat", "hko-nuut-koste", "hko-nuut-isbn"].forEach((id) => (document.getElementById(id).value = ""));
    document.getElementById("hko-nuut-kanselleer").style.display = "none";
  }

  async function stoor_item() {
    const boodskap = document.getElementById("hko-register-boodskap");
    const koste = parseFloat(document.getElementById("hko-nuut-koste").value);
    const item = {
      item_id: document.getElementById("hko-nuut-id").value || undefined,
      naam: document.getElementById("hko-nuut-naam").value.trim(),
      formaat: document.getElementById("hko-nuut-formaat").value.trim(),
      drukkoste_sent: Number.isFinite(koste) ? Math.round(koste * 100) : 0,
      isbn: document.getElementById("hko-nuut-isbn").value.trim(),
    };
    if (!item.naam) { boodskap.textContent = "Die item het 'n naam nodig."; return; }
    boodskap.textContent = "Word gestoor …";
    try {
      const r = await fetch(ITEMS_STOOR, {
        method: "POST",
        headers: { ...kry_outorisasie_kop(), "Content-Type": "application/json" },
        body: JSON.stringify({ aksie: "stoor", item }),
      });
      if (!r.ok) throw new Error(await r.text());
      boodskap.textContent = "Gestoor.";
      maak_invoer_skoon();
      await laai_items();
    } catch (fout) {
      boodskap.textContent = "Kon nie stoor nie: " + fout.message;
    }
  }

  async function skrap_item(item_id) {
    const boodskap = document.getElementById("hko-register-boodskap");
    try {
      const r = await fetch(ITEMS_STOOR, {
        method: "POST",
        headers: { ...kry_outorisasie_kop(), "Content-Type": "application/json" },
        body: JSON.stringify({ aksie: "skrap", item_id }),
      });
      if (!r.ok) throw new Error(await r.text());
      boodskap.textContent = "Geskrap.";
      await laai_items();
    } catch (fout) {
      boodskap.textContent = fout.message;
    }
  }

  // --------------------------------------------------------------- opsies

  function bou_opsies_skulp() {
    const velde = document.getElementById("vorm-hardekopie-velde");
    if (!velde || document.getElementById("hko-opsies")) return;
    const blok = document.createElement("div");
    blok.id = "hko-opsies";
    blok.style.cssText = "margin:4px 0 18px;";
    blok.innerHTML = `
      <h4 style="margin:0 0 4px;font-family:var(--font-opskrif);">Opsies</h4>
      <p class="paneel-hulp-teks">Elke opsie is 'n stel fisiese items met een prys en een verdeling. Met een of meer opsies geld die prys, verdeling en hosting hieronder nie; die boek se "vanaf"-prys is die laagste opsie.</p>
      <div id="hko-opsies-lys" style="display:flex;flex-direction:column;gap:14px;"></div>
      <button type="button" class="terug-skakel" id="hko-voeg-opsie-by" style="margin-top:10px;">+ Voeg opsie by</button>`;
    velde.insertBefore(blok, velde.firstChild);
    document.getElementById("hko-voeg-opsie-by").addEventListener("click", () => voeg_opsie_by(null));
  }

  function voeg_opsie_by(o) {
    const lys = document.getElementById("hko-opsies-lys");
    const kaart = document.createElement("div");
    kaart.className = "hko-kaart";
    kaart.dataset.sleutel = (o && o.sleutel) || "";
    kaart.style.cssText = "border:1px solid #E2DED6;border-radius:8px;padding:16px;background:#fff;";
    kaart.innerHTML = `
      <div class="veld-ry" style="align-items:end;">
        <div style="flex:2 1 260px;"><label class="veld-etiket">Naam op die webblad en faktuur</label><input class="veld-invoer hko-naam" value="${esc(o ? o.naam : "")}"></div>
        <div><label class="veld-etiket">Prys (R)</label><input type="number" min="0" step="0.01" class="veld-invoer hko-prys" value="${o && o.prys_sent ? (o.prys_sent / 100).toFixed(2) : ""}"></div>
        <div><label class="veld-etiket">Skakelnaam</label><input class="veld-invoer hko-sleutel" value="${esc(o ? o.sleutel : "")}" placeholder="outomaties"></div>
      </div>
      <p class="veld-etiket" style="margin:10px 0 4px;">Sluit in</p>
      <div class="hko-items" style="display:flex;flex-direction:column;gap:6px;"></div>
      <button type="button" class="terug-skakel hko-voeg-item-by" style="margin-top:6px;">+ Item</button>
      <label class="paneel-merkblokkie-ry" style="display:flex;gap:8px;align-items:center;margin:10px 0;">
        <input type="checkbox" class="hko-kaartjie" ${o && o.kaartjie ? "checked" : ""}> <span>Vra 'n kaartjieboodskap op die betaalbladsy</span>
      </label>
      <label class="paneel-merkblokkie-ry" style="display:flex;gap:8px;align-items:center;margin:0 0 10px;">
        <input type="checkbox" class="hko-beskikbaar" ${!o || o.beskikbaar !== false ? "checked" : ""}> <span>Beskikbaar</span>
      </label>
      <p class="veld-etiket" style="margin:6px 0 4px;">Verdeling</p>
      <div class="hko-verdelings paneel-verdelings-lys"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;">
        <button type="button" class="terug-skakel hko-voeg-verdeling-by">+ Voeg verdeling by</button>
        <button type="button" class="terug-skakel hko-vul-printing">Vul Printing uit die items</button>
      </div>
      <div class="veld-ry" style="margin-top:8px;align-items:end;">
        <div><label class="veld-etiket">Hosting</label>
          <select class="veld-invoer hko-hosting-tipe">
            <option value="">Geen</option>
            <option value="persentasie">Persentasie (%)</option>
            <option value="vaste_bedrag">Vaste bedrag (R)</option>
          </select></div>
        <div><label class="veld-etiket">Waarde</label><input type="number" min="0" step="0.01" class="veld-invoer hko-hosting-waarde"></div>
      </div>
      <div class="hko-som" style="background:#F5F4F1;border-radius:6px;padding:10px 12px;margin-top:10px;font-size:14px;"></div>
      <p class="paneel-hulp-teks hko-skakel" style="margin:8px 0 0;"></p>
      <button type="button" class="terug-skakel hko-verwyder" style="margin-top:8px;">Verwyder hierdie opsie</button>`;
    lys.appendChild(kaart);

    const items_wrap = kaart.querySelector(".hko-items");
    ((o && o.items) || []).forEach((it) => items_wrap.appendChild(item_ry(it)));
    if (!o) items_wrap.appendChild(item_ry(null));

    const verd_wrap = kaart.querySelector(".hko-verdelings");
    ((o && o.verdelings) || []).forEach((v) => verd_wrap.appendChild(skep_verdeling_ry_element("hko", v)));

    if (o && o.hosting) {
      kaart.querySelector(".hko-hosting-tipe").value = o.hosting.tipe;
      kaart.querySelector(".hko-hosting-waarde").value =
        o.hosting.tipe === "vaste_bedrag" ? (o.hosting.waarde / 100).toFixed(2) : o.hosting.waarde;
    }

    kaart.querySelector(".hko-voeg-item-by").addEventListener("click", () => { items_wrap.appendChild(item_ry(null)); werk_som_by(kaart); });
    kaart.querySelector(".hko-voeg-verdeling-by").addEventListener("click", () => { verd_wrap.appendChild(skep_verdeling_ry_element("hko", null)); werk_som_by(kaart); });
    kaart.querySelector(".hko-vul-printing").addEventListener("click", () => vul_printing(kaart));
    kaart.querySelector(".hko-verwyder").addEventListener("click", () => kaart.remove());
    kaart.addEventListener("input", () => werk_som_by(kaart));
    kaart.addEventListener("change", () => werk_som_by(kaart));
    kaart.addEventListener("click", (e) => { if (e.target.closest(".paneel-verdeling-verwyder, .hko-item-verwyder")) setTimeout(() => werk_som_by(kaart), 0); });
    werk_som_by(kaart);
  }

  function item_ry(it) {
    const ry = document.createElement("div");
    ry.className = "hko-item-ry";
    ry.style.cssText = "display:flex;gap:8px;align-items:center;";
    ry.innerHTML = `
      <select class="veld-invoer hko-item-kies" style="flex:1 1 auto;" data-gekies="${esc((it && it.item_id) || "")}">${item_opsies_html(it && it.item_id)}</select>
      <input type="number" min="1" max="20" step="1" class="veld-invoer hko-item-aantal" style="width:80px;" value="${(it && it.aantal) || 1}" aria-label="Aantal">
      <button type="button" class="terug-skakel hko-item-verwyder" aria-label="Verwyder item">✕</button>`;
    ry.querySelector(".hko-item-verwyder").addEventListener("click", () => ry.remove());
    const kies = ry.querySelector(".hko-item-kies");
    kies.addEventListener("change", () => (kies.dataset.gekies = kies.value));
    return ry;
  }

  function lees_items(kaart) {
    return Array.from(kaart.querySelectorAll(".hko-item-ry"))
      .map((ry) => {
        const kies = ry.querySelector(".hko-item-kies");
        return { item_id: kies.value || kies.dataset.gekies || "", aantal: Number(ry.querySelector(".hko-item-aantal").value) || 1 };
      })
      .filter((it) => it.item_id);
  }

  function lees_verdelings(kaart) {
    return Array.from(kaart.querySelectorAll(".hko-verdelings .paneel-verdeling-ry")).map((ry) => {
      const tipe = ry.querySelector(".paneel-verdeling-tipe").value;
      const rou = parseFloat(ry.querySelector(".paneel-verdeling-waarde").value);
      return {
        rol_tipe: ry.querySelector(".paneel-verdeling-rol-tipe").value,
        entiteit_id: ry.querySelector(".paneel-verdeling-entiteit").value,
        tipe,
        waarde: tipe === "vaste_bedrag" ? Math.round(rou * 100) : rou,
      };
    });
  }

  function lees_hosting(kaart) {
    const tipe = kaart.querySelector(".hko-hosting-tipe").value;
    const rou = parseFloat(kaart.querySelector(".hko-hosting-waarde").value);
    if (!tipe || !Number.isFinite(rou) || rou <= 0) return null;
    return { tipe, waarde: tipe === "vaste_bedrag" ? Math.round(rou * 100) : rou };
  }

  function items_koste_sent(kaart) {
    return lees_items(kaart).reduce((som, it) => {
      const i = items_kas.find((x) => x.item_id === it.item_id);
      return som + (i ? (i.drukkoste_sent || 0) * it.aantal : 0);
    }, 0);
  }

  function vul_printing(kaart) {
    const koste = items_koste_sent(kaart);
    const verd_wrap = kaart.querySelector(".hko-verdelings");
    let ry = Array.from(verd_wrap.querySelectorAll(".paneel-verdeling-ry"))
      .find((r) => r.querySelector(".paneel-verdeling-rol-tipe").value === "printing");
    if (!ry) {
      ry = skep_verdeling_ry_element("hko", { rol_tipe: "printing", tipe: "vaste_bedrag", waarde: koste });
      verd_wrap.appendChild(ry);
    } else {
      ry.querySelector(".paneel-verdeling-tipe").value = "vaste_bedrag";
      ry.querySelector(".paneel-verdeling-waarde").value = (koste / 100).toFixed(2);
    }
    werk_som_by(kaart);
  }

  function werk_som_by(kaart) {
    const prys = Math.round((parseFloat(kaart.querySelector(".hko-prys").value) || 0) * 100);
    const naam = kaart.querySelector(".hko-naam").value;
    const sleutel = sleutel_van(kaart.querySelector(".hko-sleutel").value || naam);
    const som = kaart.querySelector(".hko-som");
    const skakel = kaart.querySelector(".hko-skakel");
    const slug = huidige_slug || (document.getElementById("vorm-slug") || {}).value || "";
    skakel.innerHTML = sleutel && slug
      ? `Koopskakel: <code>${esc(WINKEL)}/koop.html?produk=${esc(slug)}&amp;opsie=${esc(sleutel)}</code>`
      : "";
    if (!prys) { som.textContent = "Vul die prys in om die verdeling te sien."; return; }
    const reels = lees_verdelings(kaart).map((v) => {
      const bedrag = v.tipe === "vaste_bedrag" ? Math.min(v.waarde || 0, prys) : Math.round((prys * (v.waarde || 0)) / 100);
      return { etiket: ROL_ETIKETTE[v.rol_tipe] || v.rol_tipe, bedrag: Number.isFinite(bedrag) ? bedrag : 0 };
    });
    const h = lees_hosting(kaart);
    const hosting = h ? (h.tipe === "vaste_bedrag" ? Math.min(h.waarde, prys) : Math.round((prys * h.waarde) / 100)) : 0;
    const fooi = paystack_sent(prys);
    const hou = prys - reels.reduce((s, r) => s + r.bedrag, 0) - hosting - fooi;
    const koste = items_koste_sent(kaart);
    som.innerHTML = `
      ${reels.map((r) => `<div style="display:flex;justify-content:space-between;"><span>${esc(r.etiket)}</span><span>${rand(r.bedrag)}</span></div>`).join("")}
      ${h ? `<div style="display:flex;justify-content:space-between;"><span>Hosting</span><span>${rand(hosting)}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;color:#5B5B5B;"><span>Paystack-voorsiening</span><span>${rand(fooi)}</span></div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid #DCD7CD;margin-top:4px;padding-top:4px;font-weight:600;${hou < 0 ? "color:#B42318;" : ""}"><span>Future Sharp hou</span><span>${rand(hou)}</span></div>
      ${koste ? `<div style="color:#5B5B5B;font-size:13px;margin-top:4px;">Drukkoste van die items: ${rand(koste)}</div>` : ""}`;
  }

  // --------------------------------------------------- koppeling met vorm

  window.hk_opsies_reset = function () {
    bou_opsies_skulp();
    huidige_slug = "";
    const lys = document.getElementById("hko-opsies-lys");
    if (lys) lys.innerHTML = "";
  };

  window.hk_opsies_vul = function (produk) {
    window.hk_opsies_reset();
    huidige_slug = (produk && produk.slug) || "";
    const opsies = (produk && produk.formate && produk.formate.harde_kopie && produk.formate.harde_kopie.opsies) || [];
    opsies.forEach((o) => voeg_opsie_by(o));
    if (!items_kas.length) laai_items();
  };

  window.hk_opsies_lees = function () {
    return Array.from(document.querySelectorAll("#hko-opsies-lys .hko-kaart")).map((kaart) => {
      const naam = kaart.querySelector(".hko-naam").value.trim();
      return {
        sleutel: sleutel_van(kaart.querySelector(".hko-sleutel").value || naam),
        naam,
        prys_sent: Math.round((parseFloat(kaart.querySelector(".hko-prys").value) || 0) * 100),
        beskikbaar: kaart.querySelector(".hko-beskikbaar").checked,
        kaartjie: kaart.querySelector(".hko-kaartjie").checked,
        items: lees_items(kaart),
        verdelings: lees_verdelings(kaart),
        hosting: lees_hosting(kaart),
      };
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    bou_register_skulp();
    bou_opsies_skulp();
    // Die items is nodig vir die opsies se keuselyste; laai hulle sodra
    // die sessie gereed is.
    setTimeout(laai_items, 1500);
  });
})();
