// paneel-talks.js — FutureSharp Talks: die Talks-afdeling in die paneelbord.
//
// Lys, skep, wysig, (de)aktiveer en skrap talks, en teken hul omslag.
// Talks leef in hul eie "talks"-store en raak niks van die boeke se
// katalogus nie (sien _talk-validering.js vir hoekom).
//
// Die hele afdeling word hier gebou, in #paneel-talks-wortel; paneelbord.html
// dra net die kieslysitem en die leë houer. Die omslag word getoken deur
// talk-omslag.js, wat vóór hierdie lêer moet laai.
//
// Hang af van paneelbord.js (kry_outorisasie_kop) en identiteit.js
// (identiteit_kop, met vars token).

const PT = {
  kry: "/.netlify/functions/kry-talks",
  skep: "/.netlify/functions/skep-talk",
  wysig: "/.netlify/functions/wysig-talk",
  skrap: "/.netlify/functions/skrap-talk",
  sprekers: "/.netlify/functions/kry-sprekers",
  ontwerp: "/.netlify/functions/kry-ontwerp-admin",
  omslag: "/.netlify/functions/laai-omslag-op",
};

const PT_ETIKETTE = {
  nuut: { teks_af: "Nuut!", teks_en: "New!" },
  topverkoper: { teks_af: "Topverkoper", teks_en: "Bestseller" },
  spesiale_aanbod: { teks_af: "Spesiale aanbod", teks_en: "Special offer" },
};

const pt = {
  talks: [],
  sprekers: [],
  ontwerp: [],
  wysig_slug: null,
  gekose_sprekers: [],
  kategoriee: [],
  sleutelwoorde: [],
  verdelings: [],
  omslag: "",
  omslag_gegenereer: false,
  omslag_handtekening: "",
  gelaai: false,
};

async function pt_kop(ekstra) {
  if (typeof identiteit_kop === "function") return identiteit_kop(ekstra);
  return Object.assign({}, ekstra || {}, kry_outorisasie_kop());
}

function pt_esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function pt_rand(sent) {
  return "R" + (sent / 100).toFixed(2).replace(".", ",");
}

function pt_duur_na_sekondes(teks) {
  const t = String(teks || "").trim();
  if (!t) return 0;
  const dele = t.split(":").map((d) => parseInt(d, 10));
  if (dele.some((d) => Number.isNaN(d))) return 0;
  return dele.reduce((som, d) => som * 60 + d, 0);
}

function pt_sekondes_na_duur(s) {
  if (!s) return "";
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

// --------------------------------------------------------------- skelet

function pt_bou_skelet() {
  const wortel = document.getElementById("paneel-talks-wortel");
  if (!wortel || wortel.dataset.gebou) return;
  wortel.dataset.gebou = "ja";
  wortel.innerHTML = `
    <div class="paneel-afdeling-kop">
      <h2 class="paneel-afdeling-titel">Talks</h2>
      <button id="pt-nuut" class="kaart-aksie paneel-voeg-by-knoppie" type="button">+ Voeg talk by</button>
    </div>
    <p class="paneel-hulp-teks">Die talks van FutureSharp Talks. Hulle leef apart van die boeke en verskyn later op die FST-blad.</p>
    <div id="pt-lys"><p class="stelsel-boodskap">Talks word gelaai …</p></div>

    <div id="pt-vorm-blok" class="pt-vorm-blok" style="display:none;">
      <div class="paneel-afdeling-kop">
        <h2 id="pt-vorm-titel" class="paneel-afdeling-titel">Voeg talk by</h2>
        <button id="pt-kanselleer" class="terug-skakel paneel-vorm-kanselleer" type="button">✕ Kanselleer</button>
      </div>
      <form id="pt-vorm" novalidate>
        <label class="veld-etiket" for="pt-titel"><span>Titel</span> <span class="veld-verplig">(verplig)</span></label>
        <input type="text" id="pt-titel" class="veld-invoer" maxlength="200">

        <label class="veld-etiket" for="pt-slug"><span>Slug</span> <span class="veld-opsioneel">(die adres: futuresharp.co.za/talks/slug)</span></label>
        <input type="text" id="pt-slug" class="veld-invoer" maxlength="80" placeholder="die-brein-onder-druk">
        <p id="pt-slug-hulp" class="paneel-hulp-teks">Word uit die titel voorgestel. Ná die eerste stoor verander dit nie meer nie, sodat gedeelde skakels bly werk.</p>

        <label class="veld-etiket"><span>Spreker(s)</span> <span class="veld-verplig">(verplig)</span></label>
        <div id="pt-sprekers"></div>
        <button type="button" id="pt-voeg-spreker" class="pt-skakel">+ Voeg spreker by</button>

        <label class="veld-etiket"><span>Kategorieë</span> <span class="veld-opsioneel">(die eerste gemerkte is die hoofkategorie en bepaal die omslag se kleur)</span></label>
        <div id="pt-kategoriee" class="pt-kategoriee"></div>

        <label class="veld-etiket" for="pt-sleutel-invoer"><span>Sleutelwoorde</span> <span class="veld-opsioneel">(Enter of komma na elkeen)</span></label>
        <div id="pt-sleutels" class="pt-sleutels"><input type="text" id="pt-sleutel-invoer" maxlength="40" placeholder="neurowetenskap"></div>

        <label class="veld-etiket" for="pt-oorsig">Oorsig <span class="veld-opsioneel">(op die kaart, sowat 100 woorde)</span></label>
        <textarea id="pt-oorsig" class="veld-invoer paneel-teksarea" rows="4" maxlength="2000"></textarea>

        <label class="veld-etiket" for="pt-vol">Volledige beskrywing <span class="veld-opsioneel">(op die talk-bladsy)</span></label>
        <textarea id="pt-vol" class="veld-invoer paneel-teksarea" rows="6" maxlength="10000"></textarea>

        <label class="veld-etiket">Omslag</label>
        <div class="pt-omslag">
          <div class="pt-omslag-raam">
            <canvas id="pt-doek" width="1280" height="720" aria-label="Omslag-voorskou"></canvas>
            <img id="pt-eie-beeld" alt="" style="display:none;">
          </div>
          <div>
            <div class="pt-knoppe">
              <button type="button" id="pt-genereer" class="kaart-aksie">Genereer omslag</button>
              <label class="pt-knop-twee">Laai eie beeld op
                <input type="file" id="pt-eie-leer" accept="image/png,image/jpeg,image/webp" hidden>
              </label>
            </div>
            <p id="pt-omslag-stand" class="paneel-hulp-teks">Die omslag word uit die titel, die hoofkategorie en die spreker(s) geteken. Stoor jy sonder omslag, word een vanself gegenereer.</p>
          </div>
        </div>

        <label class="veld-etiket" for="pt-etiket">Etiket op die kaart <span class="veld-opsioneel">(opsioneel)</span></label>
        <div class="pt-ry">
          <select id="pt-etiket" class="veld-invoer">
            <option value="">Geen</option>
            <option value="nuut">Nuut! / New!</option>
            <option value="topverkoper">Topverkoper / Bestseller</option>
            <option value="spesiale_aanbod">Spesiale aanbod / Special offer</option>
          </select>
          <select id="pt-etiket-kleur" class="veld-invoer" aria-label="Etiket-kleur">
            <option value="amber">Geel</option>
            <option value="koraal">Koraal</option>
            <option value="teal">Teal</option>
            <option value="swart">Swart</option>
          </select>
        </div>

        <fieldset class="paneel-formaat-blok">
          <legend class="paneel-formaat-titel">Video</legend>
          <label class="paneel-wisselaar"><input type="checkbox" id="pt-beskikbaar" checked> <span>Beskikbaar</span></label>
          <div class="pt-ry">
            <div>
              <label class="veld-etiket" for="pt-prys">Prys (R)</label>
              <input type="number" id="pt-prys" class="veld-invoer" min="0" step="0.01" value="100">
            </div>
            <div>
              <label class="veld-etiket" for="pt-duur">Duur <span class="veld-opsioneel">(mm:ss)</span></label>
              <input type="text" id="pt-duur" class="veld-invoer" placeholder="15:10" maxlength="8">
            </div>
          </div>
          <label class="veld-etiket" for="pt-vrystelling">Vrystellingsdatum <span class="veld-opsioneel">(leeg = dadelik)</span></label>
          <input type="date" id="pt-vrystelling" class="veld-invoer pt-halwe">

          <label class="veld-etiket">Verdeling</label>
          <div id="pt-verdelings"></div>
          <button type="button" id="pt-voeg-verdeling" class="pt-skakel">+ Voeg verdeling by</button>
          <div id="pt-som" class="pt-som"></div>
        </fieldset>

        <div id="pt-foute" class="vb-foute" style="display:none;"></div>
        <button type="submit" id="pt-stoor" class="kaart-aksie paneel-vorm-indien">Skep talk</button>
      </form>
    </div>`;

  document.getElementById("pt-nuut").addEventListener("click", () => pt_open_vorm(null));
  document.getElementById("pt-kanselleer").addEventListener("click", pt_sluit_vorm);
  document.getElementById("pt-voeg-spreker").addEventListener("click", () => {
    pt.gekose_sprekers.push("");
    pt_teken_sprekers();
  });
  document.getElementById("pt-voeg-verdeling").addEventListener("click", () => {
    pt.verdelings.push({ rol_tipe: "ontwerp_admin", entiteit_id: (pt.ontwerp[0] || {}).ontwerp_admin_id || "", tipe: "persentasie", waarde: 5 });
    pt_teken_verdelings();
  });
  document.getElementById("pt-titel").addEventListener("input", () => {
    if (!pt.wysig_slug && !document.getElementById("pt-slug").dataset.handmatig) {
      document.getElementById("pt-slug").value = pt_maak_slug(document.getElementById("pt-titel").value);
    }
    pt_voorskou();
  });
  document.getElementById("pt-slug").addEventListener("input", (e) => {
    e.target.dataset.handmatig = "ja";
    pt_voorskou();
  });
  document.getElementById("pt-sleutel-invoer").addEventListener("keydown", pt_sleutel_toets);
  document.getElementById("pt-sleutel-invoer").addEventListener("blur", () => pt_voeg_sleutel_by(true));
  document.getElementById("pt-prys").addEventListener("input", pt_bereken);
  document.getElementById("pt-genereer").addEventListener("click", () => pt_genereer_en_laai_op());
  document.getElementById("pt-eie-leer").addEventListener("change", pt_laai_eie_beeld_op);
  document.getElementById("pt-vorm").addEventListener("submit", pt_stoor);
}

function pt_maak_slug(teks) {
  return String(teks || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ------------------------------------------------------------------ laai

async function pt_laai() {
  pt_bou_skelet();
  const lys = document.getElementById("pt-lys");
  try {
    const kop = await pt_kop();
    const [t, s, o] = await Promise.all([
      fetch(PT.kry, { headers: kop }),
      fetch(PT.sprekers, { headers: kop }),
      fetch(PT.ontwerp, { headers: kop }),
    ]);
    if (!t.ok) throw new Error(`Talks: status ${t.status}`);
    pt.talks = (await t.json()).talks || [];
    pt.sprekers = s.ok ? (await s.json()).sprekers || [] : [];
    pt.ontwerp = o.ok ? (await o.json()).ontwerp_admin || [] : [];
    pt.gelaai = true;
    pt_teken_lys();
  } catch (fout) {
    console.error("Kon nie talks laai nie:", fout);
    lys.innerHTML = `<p class="stelsel-boodskap">Kon nie talks laai nie. Herlaai die bladsy en probeer weer.</p>`;
  }
}

function pt_kategorie_name(ids) {
  return (ids || []).map((id) => (FST_KATEGORIEE.find((k) => k.id === id) || {}).naam).filter(Boolean).join(", ");
}

function pt_teken_lys() {
  const lys = document.getElementById("pt-lys");
  if (!pt.talks.length) {
    lys.innerHTML = `<p class="stelsel-boodskap">Nog geen talks nie. Klik <strong>+ Voeg talk by</strong> om die eerste een op te stel.</p>`;
    return;
  }
  lys.innerHTML = pt.talks.map((t) => {
    const v = (t.formate && t.formate.video) || {};
    const aktief = t.aktief !== false;
    return `
      <div class="pt-ry-talk${aktief ? "" : " pt-onaktief"}">
        ${t.omslag ? `<img class="pt-duimnael" src="${pt_esc(t.omslag)}" alt="">` : `<div class="pt-duimnael pt-duimnael-leeg"></div>`}
        <div class="pt-inligting">
          <strong>${pt_esc(t.titel)}</strong>
          <span>${pt_esc(t.spreker)}</span>
          <span class="pt-meta">${pt_esc(pt_kategorie_name(t.kategoriee))} · ${pt_rand(v.prys_sent || 0)}${v.duur_sekondes ? " · " + pt_sekondes_na_duur(v.duur_sekondes) : ""}${aktief ? "" : " · onaktief"}${v.beskikbaar ? "" : " · nie beskikbaar nie"}</span>
        </div>
        <div class="pt-aksies">
          <button type="button" class="terug-skakel" data-pt-wysig="${pt_esc(t.slug)}">Wysig</button>
          <button type="button" class="terug-skakel" data-pt-aktief="${pt_esc(t.slug)}">${aktief ? "Deaktiveer" : "Aktiveer"}</button>
          <button type="button" class="terug-skakel paneel-skrap-knoppie" data-pt-skrap="${pt_esc(t.slug)}">Skrap</button>
        </div>
      </div>`;
  }).join("");

  lys.querySelectorAll("[data-pt-wysig]").forEach((b) => b.addEventListener("click", () => {
    const t = pt.talks.find((x) => x.slug === b.dataset.ptWysig);
    if (t) pt_open_vorm(t);
  }));
  lys.querySelectorAll("[data-pt-aktief]").forEach((b) => b.addEventListener("click", () => pt_wissel_aktief(b)));
  lys.querySelectorAll("[data-pt-skrap]").forEach((b) => b.addEventListener("click", () => pt_skrap(b)));
}

// ------------------------------------------------------------------ vorm

function pt_open_vorm(talk) {
  pt.wysig_slug = talk ? talk.slug : null;
  const v = (talk && talk.formate && talk.formate.video) || {};

  document.getElementById("pt-vorm-titel").textContent = talk ? "Wysig talk" : "Voeg talk by";
  document.getElementById("pt-stoor").textContent = talk ? "Stoor wysigings" : "Skep talk";
  document.getElementById("pt-titel").value = talk ? talk.titel : "";
  const slug = document.getElementById("pt-slug");
  slug.value = talk ? talk.slug : "";
  slug.disabled = !!talk;
  delete slug.dataset.handmatig;
  document.getElementById("pt-oorsig").value = talk ? talk.oorsig || "" : "";
  document.getElementById("pt-vol").value = talk ? talk.vol_beskrywing || "" : "";
  document.getElementById("pt-beskikbaar").checked = talk ? !!v.beskikbaar : true;
  document.getElementById("pt-prys").value = talk ? ((v.prys_sent || 0) / 100).toFixed(2) : "100";
  document.getElementById("pt-duur").value = talk ? pt_sekondes_na_duur(v.duur_sekondes) : "";
  document.getElementById("pt-vrystelling").value = (talk && v.vrystelling_datum) || "";

  const etiket = talk && talk.etiket;
  const voorafgestel = etiket ? Object.keys(PT_ETIKETTE).find((k) => PT_ETIKETTE[k].teks_af === etiket.teks_af) : "";
  document.getElementById("pt-etiket").value = voorafgestel || "";
  document.getElementById("pt-etiket-kleur").value = (etiket && etiket.kleur) || "amber";

  pt.gekose_sprekers = talk ? [...(talk.spreker_ids || [])] : [""];
  pt.kategoriee = talk ? [...(talk.kategoriee || [])] : [];
  pt.sleutelwoorde = talk ? [...(talk.sleutelwoorde || [])] : [];
  pt.verdelings = talk
    ? (v.verdelings || []).map((x) => ({ ...x }))
    : [{ rol_tipe: "spreker", entiteit_id: "", tipe: "persentasie", waarde: 70 }];
  pt.omslag = talk ? talk.omslag || "" : "";
  pt.omslag_gegenereer = talk ? !!talk.omslag_gegenereer : false;
  pt.omslag_handtekening = pt.omslag_gegenereer ? pt_handtekening() : "";

  pt_teken_sprekers();
  pt_teken_kategoriee();
  pt_teken_sleutels();
  pt_teken_verdelings();
  pt_wys_omslag();
  pt_foute("");

  document.getElementById("pt-vorm-blok").style.display = "block";
  document.getElementById("pt-vorm-blok").scrollIntoView({ behavior: "smooth", block: "start" });
}

function pt_sluit_vorm() {
  pt.wysig_slug = null;
  document.getElementById("pt-vorm-blok").style.display = "none";
}

function pt_foute(teks) {
  const el = document.getElementById("pt-foute");
  el.textContent = teks || "";
  el.style.display = teks ? "block" : "none";
}

function pt_spreker_naam(id) {
  return (pt.sprekers.find((s) => s.spreker_id === id) || {}).naam || "";
}

function pt_teken_sprekers() {
  const wrap = document.getElementById("pt-sprekers");
  if (!pt.sprekers.length) {
    wrap.innerHTML = `<p class="paneel-hulp-teks">Daar is nog geen sprekers nie. Voeg eers een by onder <strong>Sprekers</strong>.</p>`;
    return;
  }
  wrap.innerHTML = pt.gekose_sprekers.map((id, i) => `
    <div class="pt-spreker-ry">
      <select class="veld-invoer" data-pt-spreker="${i}" aria-label="Spreker ${i + 1}">
        <option value="">Kies 'n spreker …</option>
        ${pt.sprekers.map((s) => `<option value="${pt_esc(s.spreker_id)}" ${s.spreker_id === id ? "selected" : ""}>${pt_esc(s.naam)}</option>`).join("")}
      </select>
      <button type="button" class="pt-x" data-pt-spreker-weg="${i}" aria-label="Verwyder spreker">✕</button>
    </div>`).join("");
  wrap.querySelectorAll("[data-pt-spreker]").forEach((sel) => sel.addEventListener("change", (e) => {
    const i = +e.target.dataset.ptSpreker;
    pt.gekose_sprekers[i] = e.target.value;
    // 'n Nuwe talk se verdeling begin met 'n leë spreker-ry: vul die eerste
    // gekose spreker daarin in, sodat die 70% nie vergeet word nie.
    const leeg = pt.verdelings.find((v) => v.rol_tipe === "spreker" && !v.entiteit_id);
    if (leeg && e.target.value) {
      leeg.entiteit_id = e.target.value;
      pt_teken_verdelings();
    }
    pt_voorskou();
  }));
  wrap.querySelectorAll("[data-pt-spreker-weg]").forEach((b) => b.addEventListener("click", () => {
    pt.gekose_sprekers.splice(+b.dataset.ptSprekerWeg, 1);
    if (!pt.gekose_sprekers.length) pt.gekose_sprekers.push("");
    pt_teken_sprekers();
    pt_voorskou();
  }));
}

function pt_teken_kategoriee() {
  const wrap = document.getElementById("pt-kategoriee");
  wrap.innerHTML = FST_KATEGORIEE.map((k) => {
    const plek = pt.kategoriee.indexOf(k.id);
    return `<label class="pt-kat${plek >= 0 ? " pt-kat-aan" : ""}">
      <input type="checkbox" value="${k.id}" ${plek >= 0 ? "checked" : ""}> ${pt_esc(k.naam)}${plek === 0 ? ' <span class="pt-hoof">hoof</span>' : ""}
    </label>`;
  }).join("");
  wrap.querySelectorAll("input").forEach((inp) => inp.addEventListener("change", (e) => {
    const id = e.target.value;
    if (e.target.checked) {
      if (!pt.kategoriee.includes(id)) pt.kategoriee.push(id);
    } else {
      pt.kategoriee = pt.kategoriee.filter((x) => x !== id);
    }
    pt_teken_kategoriee();
    pt_voorskou();
  }));
}

function pt_teken_sleutels() {
  const wrap = document.getElementById("pt-sleutels");
  const invoer = document.getElementById("pt-sleutel-invoer");
  wrap.querySelectorAll(".pt-sleutel").forEach((el) => el.remove());
  pt.sleutelwoorde.forEach((w, i) => {
    const el = document.createElement("span");
    el.className = "pt-sleutel";
    el.innerHTML = `${pt_esc(w)} <button type="button" aria-label="Verwyder ${pt_esc(w)}">✕</button>`;
    el.querySelector("button").addEventListener("click", () => {
      pt.sleutelwoorde.splice(i, 1);
      pt_teken_sleutels();
    });
    wrap.insertBefore(el, invoer);
  });
}

function pt_voeg_sleutel_by() {
  const invoer = document.getElementById("pt-sleutel-invoer");
  invoer.value.split(",").map((w) => w.trim()).filter(Boolean).forEach((w) => {
    if (!pt.sleutelwoorde.some((x) => x.toLowerCase() === w.toLowerCase()) && pt.sleutelwoorde.length < 20) {
      pt.sleutelwoorde.push(w.slice(0, 40));
    }
  });
  invoer.value = "";
  pt_teken_sleutels();
}

function pt_sleutel_toets(e) {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    pt_voeg_sleutel_by();
  } else if (e.key === "Backspace" && !e.target.value && pt.sleutelwoorde.length) {
    pt.sleutelwoorde.pop();
    pt_teken_sleutels();
  }
}

function pt_teken_verdelings() {
  const wrap = document.getElementById("pt-verdelings");
  const rolle = [
    { id: "spreker", naam: "Spreker", lys: pt.sprekers, idveld: "spreker_id" },
    { id: "ontwerp_admin", naam: "Ontwerp/Admin", lys: pt.ontwerp, idveld: "ontwerp_admin_id" },
  ];
  wrap.innerHTML = pt.verdelings.map((v, i) => {
    const rol = rolle.find((r) => r.id === v.rol_tipe) || rolle[0];
    return `
      <div class="pt-verdeling-ry">
        <select class="veld-invoer" data-pt-v="${i}" data-pt-k="rol_tipe" aria-label="Rol">
          ${rolle.map((r) => `<option value="${r.id}" ${r.id === v.rol_tipe ? "selected" : ""}>${r.naam}</option>`).join("")}
        </select>
        <select class="veld-invoer" data-pt-v="${i}" data-pt-k="entiteit_id" aria-label="Wie">
          <option value="">Kies …</option>
          ${rol.lys.map((e) => `<option value="${pt_esc(e[rol.idveld])}" ${e[rol.idveld] === v.entiteit_id ? "selected" : ""}>${pt_esc(e.naam)}</option>`).join("")}
        </select>
        <select class="veld-invoer" data-pt-v="${i}" data-pt-k="tipe" aria-label="Tipe">
          <option value="persentasie" ${v.tipe === "persentasie" ? "selected" : ""}>%</option>
          <option value="vaste_bedrag" ${v.tipe === "vaste_bedrag" ? "selected" : ""}>R</option>
        </select>
        <input type="number" class="veld-invoer" data-pt-v="${i}" data-pt-k="waarde" min="0" step="0.01" value="${v.tipe === "vaste_bedrag" ? (v.waarde / 100).toFixed(2) : v.waarde}" aria-label="Waarde">
        <button type="button" class="pt-x" data-pt-v-weg="${i}" aria-label="Verwyder verdeling">✕</button>
      </div>`;
  }).join("");

  wrap.querySelectorAll("[data-pt-v]").forEach((el) => {
    const hanteer = (e) => {
      const v = pt.verdelings[+e.target.dataset.ptV];
      const k = e.target.dataset.ptK;
      if (k === "waarde") {
        const getal = parseFloat(e.target.value) || 0;
        // Vaste bedrae word in sent gestoor, soos by die boeke.
        v.waarde = v.tipe === "vaste_bedrag" ? Math.round(getal * 100) : getal;
      } else {
        v[k] = e.target.value;
        if (k === "rol_tipe") {
          v.entiteit_id = "";
          pt_teken_verdelings();
        }
        if (k === "tipe") {
          v.waarde = v.tipe === "vaste_bedrag" ? Math.round(v.waarde * 100) : v.waarde / 100;
          pt_teken_verdelings();
        }
      }
      pt_bereken();
    };
    el.addEventListener("input", hanteer);
    el.addEventListener("change", hanteer);
  });
  wrap.querySelectorAll("[data-pt-v-weg]").forEach((b) => b.addEventListener("click", () => {
    pt.verdelings.splice(+b.dataset.ptVWeg, 1);
    pt_teken_verdelings();
  }));
  pt_bereken();
}

// Dieselfde getalle as _paystack-koste.js: die fooi om te wys, die minimum
// om af te dwing. Die bediener besluit; dit is net die waarskuwing vooraf.
function pt_bereken() {
  const prys_sent = Math.round((parseFloat(document.getElementById("pt-prys").value) || 0) * 100);
  let uit = 0, spreker = 0;
  pt.verdelings.forEach((v) => {
    const bedrag = v.tipe === "vaste_bedrag" ? v.waarde : (prys_sent * v.waarde) / 100;
    uit += bedrag;
    if (v.rol_tipe === "spreker") spreker += bedrag;
  });
  const fooi = prys_sent ? Math.round((0.029 * prys_sent + 100) * 1.15) : 0;
  const minimum = prys_sent ? Math.ceil(0.035 * prys_sent) + 130 : 0;
  const fs = prys_sent - uit;
  const som = document.getElementById("pt-som");
  som.innerHTML =
    `Koper betaal <strong>${pt_rand(prys_sent)}</strong> · spreker(s) ontvang <strong>${pt_rand(Math.round(spreker))}</strong> · ` +
    `Future Sharp hou <strong>${pt_rand(Math.round(fs))}</strong>, waaruit Paystack se fooi van sowat ${pt_rand(fooi)} kom.` +
    (prys_sent && fs < minimum ? `<br><span class="pt-waarskuwing">Die hoofrekening hou minder as die vereiste ${pt_rand(minimum)}. Die stoor sal dit weier.</span>` : "");
}

// ---------------------------------------------------------------- omslag

function pt_handtekening() {
  return JSON.stringify([
    document.getElementById("pt-titel").value.trim(),
    (document.getElementById("pt-slug").value || "").trim(),
    pt.kategoriee,
    pt.gekose_sprekers.filter(Boolean).map(pt_spreker_naam),
  ]);
}

function pt_omslag_gegewens() {
  return {
    titel: document.getElementById("pt-titel").value,
    slug: document.getElementById("pt-slug").value,
    kategoriee: pt.kategoriee,
    sprekers: pt.gekose_sprekers.filter(Boolean).map(pt_spreker_naam),
  };
}

function pt_wys_omslag() {
  const doek = document.getElementById("pt-doek");
  const img = document.getElementById("pt-eie-beeld");
  if (pt.omslag && !pt.omslag_gegenereer) {
    img.src = pt.omslag;
    img.style.display = "block";
    doek.style.display = "none";
  } else {
    img.style.display = "none";
    doek.style.display = "block";
    fst_omslag_laai_lettertipes().then(() => fst_teken_omslag(doek, pt_omslag_gegewens()));
  }
  pt_omslag_stand();
}

// Die voorskou volg die vorm, maar net solank daar nie 'n eie beeld is nie.
function pt_voorskou() {
  if (pt.omslag && !pt.omslag_gegenereer) return;
  fst_teken_omslag(document.getElementById("pt-doek"), pt_omslag_gegewens());
  pt_omslag_stand();
}

function pt_omslag_stand(teks) {
  const el = document.getElementById("pt-omslag-stand");
  if (teks) { el.textContent = teks; return; }
  if (!pt.omslag) {
    el.textContent = "Nog nie gestoor nie. Stoor jy sonder omslag, word hierdie een vanself gegenereer.";
  } else if (!pt.omslag_gegenereer) {
    el.textContent = "Eie beeld. Klik Genereer omslag om dit met 'n gegenereerde een te vervang.";
  } else if (pt.omslag_handtekening !== pt_handtekening()) {
    el.textContent = "Die titel, kategorie of spreker het verander. Die omslag word by die stoor opnuut gegenereer.";
  } else {
    el.textContent = "Gegenereerde omslag, gestoor.";
  }
}

async function pt_laai_beeld_op(inhoud_tipe, data_base64) {
  const resp = await fetch(PT.omslag, {
    method: "POST",
    headers: await pt_kop({ "Content-Type": "application/json" }),
    body: JSON.stringify({ slug: `talk-${document.getElementById("pt-slug").value.trim() || "omslag"}`, inhoud_tipe, data_base64 }),
  });
  if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);
  return (await resp.json()).pad;
}

async function pt_genereer_en_laai_op() {
  const knoppie = document.getElementById("pt-genereer");
  knoppie.disabled = true;
  pt_omslag_stand("Omslag word gegenereer en gestoor …");
  try {
    await fst_omslag_laai_lettertipes();
    const doek = document.getElementById("pt-doek");
    fst_teken_omslag(doek, pt_omslag_gegewens());
    // JPEG eerder as PNG: die gloed en skaduwees maak 'n PNG groot, en op
    // hierdie kwaliteit is die teks steeds skerp.
    const data_base64 = doek.toDataURL("image/jpeg", 0.9).split(",")[1];
    pt.omslag = await pt_laai_beeld_op("image/jpeg", data_base64);
    pt.omslag_gegenereer = true;
    pt.omslag_handtekening = pt_handtekening();
    pt_wys_omslag();
  } catch (fout) {
    console.error("Kon nie omslag stoor nie:", fout);
    pt_omslag_stand(`Kon nie die omslag stoor nie: ${fout.message}`);
    throw fout;
  } finally {
    knoppie.disabled = false;
  }
}

function pt_lees_as_base64(leer) {
  return new Promise((los_op, verwerp) => {
    const leser = new FileReader();
    leser.onload = () => los_op(String(leser.result).split(",")[1]);
    leser.onerror = () => verwerp(new Error("Kon nie die lêer lees nie"));
    leser.readAsDataURL(leer);
  });
}

async function pt_laai_eie_beeld_op(e) {
  const leer = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!leer) return;
  if (leer.size > 4 * 1024 * 1024) {
    pt_omslag_stand("Die beeld is groter as 4MB. Kies 'n kleiner een.");
    return;
  }
  pt_omslag_stand("Beeld word opgelaai …");
  try {
    pt.omslag = await pt_laai_beeld_op(leer.type, await pt_lees_as_base64(leer));
    pt.omslag_gegenereer = false;
    pt_wys_omslag();
  } catch (fout) {
    console.error("Kon nie beeld oplaai nie:", fout);
    pt_omslag_stand(`Kon nie die beeld oplaai nie: ${fout.message}`);
  }
}

// ----------------------------------------------------------------- stoor

async function pt_stoor(e) {
  e.preventDefault();
  pt_foute("");
  pt_voeg_sleutel_by();

  const titel = document.getElementById("pt-titel").value.trim();
  const slug = (pt.wysig_slug || document.getElementById("pt-slug").value.trim()).toLowerCase();
  const sprekers = [...new Set(pt.gekose_sprekers.filter(Boolean))];
  const foute = [];
  if (!titel) foute.push("Gee die talk 'n titel.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) foute.push("Die slug mag net kleinletters, syfers en koppeltekens bevat.");
  if (!sprekers.length) foute.push("Kies ten minste een spreker.");
  if (!pt.kategoriee.length) foute.push("Kies ten minste een kategorie.");
  if (pt.verdelings.some((v) => !v.entiteit_id)) foute.push("Elke verdeling-ry het 'n persoon nodig, of verwyder die ry.");
  if (foute.length) {
    pt_foute(foute.join(" "));
    return;
  }

  const knoppie = document.getElementById("pt-stoor");
  const knoppie_teks = knoppie.textContent;
  knoppie.disabled = true;
  knoppie.textContent = "Besig …";

  try {
    // Geen omslag nie, of 'n gegenereerde een wat nie meer by die titel,
    // kategorie of spreker pas nie: genereer nou.
    if (!pt.omslag || (pt.omslag_gegenereer && pt.omslag_handtekening !== pt_handtekening())) {
      await pt_genereer_en_laai_op();
    }

    const etiket_sleutel = document.getElementById("pt-etiket").value;
    const liggaam = {
      slug,
      titel,
      spreker_ids: sprekers,
      kategoriee: pt.kategoriee,
      sleutelwoorde: pt.sleutelwoorde,
      oorsig: document.getElementById("pt-oorsig").value,
      vol_beskrywing: document.getElementById("pt-vol").value,
      omslag: pt.omslag,
      omslag_gegenereer: pt.omslag_gegenereer,
      etiket: etiket_sleutel
        ? { ...PT_ETIKETTE[etiket_sleutel], kleur: document.getElementById("pt-etiket-kleur").value }
        : null,
      formate: {
        video: {
          beskikbaar: document.getElementById("pt-beskikbaar").checked,
          prys_sent: Math.round((parseFloat(document.getElementById("pt-prys").value) || 0) * 100),
          duur_sekondes: pt_duur_na_sekondes(document.getElementById("pt-duur").value),
          vrystelling_datum: document.getElementById("pt-vrystelling").value || null,
          verdelings: pt.verdelings,
          hosting: null,
        },
      },
    };
    if (pt.wysig_slug) {
      const bestaande = pt.talks.find((t) => t.slug === pt.wysig_slug);
      liggaam.aktief = bestaande ? bestaande.aktief !== false : true;
    }

    const resp = await fetch(pt.wysig_slug ? PT.wysig : PT.skep, {
      method: "POST",
      headers: await pt_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify(liggaam),
    });
    if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);
    const talk = await resp.json();

    // Plaaslik bywerk: Blobs se list() kan 'n oomblik agter wees.
    pt.talks = [talk, ...pt.talks.filter((t) => t.slug !== talk.slug)];
    pt_teken_lys();
    pt_sluit_vorm();
  } catch (fout) {
    console.error("Kon nie talk stoor nie:", fout);
    pt_foute(`Kon nie stoor nie: ${fout.message}`);
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = knoppie_teks;
  }
}

async function pt_wissel_aktief(knoppie) {
  const talk = pt.talks.find((t) => t.slug === knoppie.dataset.ptAktief);
  if (!talk) return;
  knoppie.disabled = true;
  try {
    const resp = await fetch(PT.wysig, {
      method: "POST",
      headers: await pt_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ...talk, aktief: talk.aktief === false }),
    });
    if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);
    const bygewerk = await resp.json();
    pt.talks = pt.talks.map((t) => (t.slug === bygewerk.slug ? bygewerk : t));
    pt_teken_lys();
  } catch (fout) {
    console.error("Kon nie aktief wissel nie:", fout);
    alert(`Kon nie verander nie: ${fout.message}`);
    knoppie.disabled = false;
  }
}

async function pt_skrap(knoppie) {
  const talk = pt.talks.find((t) => t.slug === knoppie.dataset.ptSkrap);
  if (!talk) return;
  if (!window.confirm(`Skrap "${talk.titel}" permanent, saam met sy omslag?\n\nOm dit net van die FST-blad af te haal, gebruik eerder Deaktiveer.`)) return;
  knoppie.disabled = true;
  try {
    const resp = await fetch(PT.skrap, {
      method: "POST",
      headers: await pt_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify({ slug: talk.slug }),
    });
    if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);
    pt.talks = pt.talks.filter((t) => t.slug !== talk.slug);
    pt_teken_lys();
  } catch (fout) {
    console.error("Kon nie talk skrap nie:", fout);
    alert(`Kon nie skrap nie: ${fout.message}`);
    knoppie.disabled = false;
  }
}

// ----------------------------------------------------------------- begin

// Laai wanneer die afdeling oopgemaak word, en elke keer daarna opnuut, sodat
// 'n spreker wat intussen bygevoeg is, in die keuselys verskyn.
document.addEventListener("DOMContentLoaded", () => {
  pt_bou_skelet();
  document.querySelectorAll('.paneel-kieslys-item[data-afdeling="talks"]').forEach((b) => {
    b.addEventListener("click", () => {
      if (document.getElementById("pt-vorm-blok").style.display !== "block") pt_laai();
    });
  });
});
