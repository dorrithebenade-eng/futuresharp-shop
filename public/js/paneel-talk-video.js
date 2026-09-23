// paneel-talk-video.js — FutureSharp Talks: die video-oplaai in die talk-vorm.
//
// Twee maniere om 'n talk se video by Mux te kry:
//   1. 'n Lêer van die rekenaar: mux-oplaai-begin.js gee 'n eenmalige
//      oplaaiskakel, en die blaaier stuur die lêer DIREK na Mux met 'n PUT,
//      met 'n vorderingsbalk. Die lêer gaan nooit deur Netlify nie.
//   2. 'n Skakel van die spreker: mux-van-skakel.js laat Mux dit self haal.
// Daarna vra die paneel elke vyf sekondes vir die stand (mux-video-stand.js)
// tot die video gereed is.
//
// Hang af van paneel-talks.js (pt, pt_kop, pt_esc, pt_teken_lys,
// pt_sekondes_na_duur), wat vroeër laai, en roep ptv_open(talk) van daar.

const PTV = {
  begin: "/.netlify/functions/mux-oplaai-begin",
  skakel: "/.netlify/functions/mux-van-skakel",
  stand: "/.netlify/functions/mux-video-stand",
};

const ptv = { slug: null, besig: false, peiling: null };

function ptv_wortel() {
  return document.getElementById("pt-video");
}

function ptv_open(talk) {
  ptv.slug = talk ? talk.slug : null;
  if (!ptv.slug) {
    ptv_wortel().innerHTML = `<p class="paneel-hulp-teks ptv-nota">Stoor die talk eers; daarna kan jy hier die video oplaai.</p>`;
    return;
  }
  if (ptv.besig) {
    // 'n Oplaai loop reeds (dalk vir hierdie talk); wys net die vordering.
    return;
  }
  ptv_teken({ stand: "laai" });
  ptv_vra_stand();
}

function ptv_teken(v) {
  const w = ptv_wortel();
  const s = v.stand;

  if (s === "laai") {
    w.innerHTML = `<p class="paneel-hulp-teks ptv-nota">Video se stand word gelaai …</p>`;
    return;
  }

  if (s === "gereed") {
    w.innerHTML = `
      <div class="ptv-gereed">
        <p class="ptv-stand ptv-ok">Video gereed${v.duur_sekondes ? ` · ${pt_sekondes_na_duur(v.duur_sekondes)}` : ""}${v.resolusie ? ` · ${pt_esc(v.resolusie)}` : ""}</p>
        <button type="button" class="pt-knop-twee" id="ptv-vervang">Vervang video</button>
      </div>`;
    document.getElementById("ptv-vervang").addEventListener("click", () => ptv_teken({ stand: "geen", vervang: true }));
    ptv_vul_duur(v.duur_sekondes);
    return;
  }

  if (s === "wag_vir_oplaai" || s === "verwerk") {
    w.innerHTML = `
      <p class="ptv-stand">Mux verwerk die video …</p>
      <div class="ptv-balk ptv-balk-besig"><i></i></div>
      <p class="paneel-hulp-teks ptv-nota">Dit neem gewoonlik 'n paar minute. Jy kan die vorm toemaak; die verwerking gaan voort.${v.speel_nog_ou || v.speel_playback_id ? " Die vorige video speel tot die nuwe een gereed is." : ""}</p>`;
    ptv_begin_peiling();
    return;
  }

  // "geen", "fout", of vervanging
  w.innerHTML = `
    ${s === "fout" ? `<p class="ptv-stand ptv-fout">${pt_esc(v.fout || "Iets het met die video verkeerd geloop.")} Probeer weer.</p>` : ""}
    <div class="ptv-oplaai" id="ptv-sleep">
      <p>Sleep die videolêer hierheen, of</p>
      <label class="kaart-aksie ptv-kies">Kies 'n videolêer
        <input type="file" id="ptv-leer" accept="video/*" hidden>
      </label>
    </div>
    <p class="ptv-of">of</p>
    <label class="veld-etiket" for="ptv-skakel">Skakel van die spreker <span class="veld-opsioneel">(moet 'n direkte aflaaiskakel wees)</span></label>
    <div class="ptv-skakel-ry">
      <input type="url" id="ptv-skakel" class="veld-invoer" placeholder="https://…">
      <button type="button" class="pt-knop-twee" id="ptv-haal">Haal</button>
    </div>
    ${v.vervang ? `<button type="button" class="pt-skakel" id="ptv-terug">Hou die huidige video</button>` : ""}
    <p id="ptv-boodskap" class="ptv-stand ptv-fout" style="display:none;"></p>`;

  document.getElementById("ptv-leer").addEventListener("change", (e) => {
    const leer = e.target.files && e.target.files[0];
    if (leer) ptv_laai_op(leer);
  });
  const sleep = document.getElementById("ptv-sleep");
  ["dragenter", "dragover"].forEach((n) => sleep.addEventListener(n, (e) => { e.preventDefault(); sleep.classList.add("ptv-oor"); }));
  ["dragleave", "drop"].forEach((n) => sleep.addEventListener(n, (e) => { e.preventDefault(); sleep.classList.remove("ptv-oor"); }));
  sleep.addEventListener("drop", (e) => {
    const leer = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (leer) ptv_laai_op(leer);
  });
  document.getElementById("ptv-haal").addEventListener("click", ptv_van_skakel);
  const terug = document.getElementById("ptv-terug");
  if (terug) terug.addEventListener("click", () => { ptv_teken({ stand: "laai" }); ptv_vra_stand(); });
}

function ptv_boodskap(teks) {
  const el = document.getElementById("ptv-boodskap");
  if (!el) return;
  el.textContent = teks || "";
  el.style.display = teks ? "block" : "none";
}

// Vul die duur in die vorm in as dit nog leeg is: Mux weet presies hoe lank
// die video is.
function ptv_vul_duur(sekondes) {
  const veld = document.getElementById("pt-duur");
  if (veld && sekondes && !veld.value.trim()) veld.value = pt_sekondes_na_duur(sekondes);
}

async function ptv_vra_stand() {
  const slug = ptv.slug;
  if (!slug) return;
  try {
    const resp = await fetch(`${PTV.stand}?slug=${encodeURIComponent(slug)}`, { headers: await pt_kop() });
    if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);
    const v = await resp.json();
    ptv_werk_lys_by(slug, v);
    if (slug !== ptv.slug || ptv.besig) return; // die vorm het intussen ander talk gewys
    if (v.stand !== "wag_vir_oplaai" && v.stand !== "verwerk") ptv_stop_peiling();
    ptv_teken(v);
  } catch (fout) {
    console.error("Kon nie die video se stand kry nie:", fout);
    if (slug === ptv.slug && !ptv.besig) ptv_teken({ stand: "fout", fout: "Kon nie die video se stand kry nie." });
  }
}

function ptv_werk_lys_by(slug, v) {
  const talk = pt.talks.find((t) => t.slug === slug);
  if (!talk) return;
  talk.video_stand = { stand: v.stand, duur_sekondes: v.duur_sekondes || null, fout: v.fout || null };
  pt_teken_lys();
}

function ptv_begin_peiling() {
  if (ptv.peiling) return;
  ptv.peiling = setInterval(ptv_vra_stand, 5000);
}

function ptv_stop_peiling() {
  if (ptv.peiling) clearInterval(ptv.peiling);
  ptv.peiling = null;
}

function ptv_grootte(grepe) {
  if (grepe > 1024 * 1024 * 1024) return `${(grepe / 1024 / 1024 / 1024).toFixed(1).replace(".", ",")} GB`;
  return `${Math.round(grepe / 1024 / 1024)} MB`;
}

async function ptv_laai_op(leer) {
  const slug = ptv.slug;
  if (!leer.type.startsWith("video/")) {
    ptv_boodskap("Dit lyk nie na 'n videolêer nie. Kies 'n .mp4-, .mov- of soortgelyke lêer.");
    return;
  }

  ptv.besig = true;
  const w = ptv_wortel();
  w.innerHTML = `
    <p class="ptv-stand" id="ptv-teks">Oplaai word voorberei …</p>
    <div class="ptv-balk"><i id="ptv-vul"></i></div>
    <p class="paneel-hulp-teks ptv-nota">${pt_esc(leer.name)} · ${ptv_grootte(leer.size)}. Hou hierdie bladsy oop tot die oplaai klaar is.</p>`;

  try {
    const resp = await fetch(PTV.begin, {
      method: "POST",
      headers: await pt_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify({ slug }),
    });
    if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);
    const { url } = await resp.json();

    await new Promise((los_op, verwerp) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        const vul = document.getElementById("ptv-vul");
        const teks = document.getElementById("ptv-teks");
        if (vul) vul.style.width = `${pct}%`;
        if (teks) teks.textContent = `Word opgelaai … ${pct}%`;
      });
      xhr.addEventListener("load", () => (xhr.status >= 200 && xhr.status < 300 ? los_op() : verwerp(new Error(`Mux het die lêer geweier (status ${xhr.status})`))));
      xhr.addEventListener("error", () => verwerp(new Error("Die verbinding het tydens die oplaai gebreek")));
      xhr.send(leer);
    });

    ptv.besig = false;
    if (slug === ptv.slug) ptv_teken({ stand: "verwerk" });
    ptv_begin_peiling();
  } catch (fout) {
    console.error("Oplaai het misluk:", fout);
    ptv.besig = false;
    if (slug === ptv.slug) {
      ptv_teken({ stand: "geen" });
      ptv_boodskap(`Die oplaai het misluk: ${fout.message}`);
    }
  }
}

async function ptv_van_skakel() {
  const skakel = document.getElementById("ptv-skakel").value.trim();
  if (!skakel) return;
  const knoppie = document.getElementById("ptv-haal");
  knoppie.disabled = true;
  ptv_boodskap("");
  try {
    const resp = await fetch(PTV.skakel, {
      method: "POST",
      headers: await pt_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify({ slug: ptv.slug, skakel }),
    });
    if (!resp.ok) throw new Error((await resp.text()) || `Status ${resp.status}`);
    ptv_teken({ stand: "verwerk" });
    ptv_begin_peiling();
  } catch (fout) {
    ptv_boodskap(fout.message);
    knoppie.disabled = false;
  }
}

// Waarsku voordat die bladsy toegemaak word terwyl 'n lêer nog oplaai.
window.addEventListener("beforeunload", (e) => {
  if (!ptv.besig) return;
  e.preventDefault();
  e.returnValue = "";
});
