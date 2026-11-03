// public/js/videos.js — die Video's-bladsy (November 2026, fase 5).
//
// Video's is die formaat; FutureSharp Talks is 'n reeks daarbinne (soos TED
// Talks), en Dagstukkies en Video-stories kom by. Elke reeks is 'n ry. Die
// Talks-ry wys die nuutste vier talks; "Sien alles" gaan na /talks, waar
// die volle lys met soek en kategorieë is. Die ander rye wys "Binnekort"
// totdat daar video's is.
//
// Vereis taal.js, fst-taal.js en fst-gedeel.js (fst_esc, fst_duur, fst_prys).

(function () {
  function talk_kaart(talk) {
    const v = talk.video || {};
    const prys = v.net_koepon ? t("fst_net_koepon_kort") : v.prys_sent > 0 ? fst_prys(v.prys_sent) : "";
    const etiket = talk.etiket
      ? `<span class="vd-etiket">${fst_esc(kry_huidige_taal() === "en" ? talk.etiket.teks_en : talk.etiket.teks_af)}</span>`
      : "";
    return `
      <a class="vd-kaart" href="/talks/${encodeURIComponent(talk.slug)}">
        <span class="vd-beeld">
          ${talk.omslag ? `<img src="${fst_esc(talk.omslag)}" alt="" loading="lazy">` : ""}
          <span class="vd-speel" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="#1B1B19"/></svg></span>
          ${etiket}
          ${v.duur_sekondes ? `<span class="vd-duur">${fst_esc(fst_duur(v.duur_sekondes))}</span>` : ""}
        </span>
        <span class="vd-titel">${fst_esc(talk.titel)}</span>
        <span class="vd-wie">${fst_esc([talk.spreker, prys].filter(Boolean).join(" · "))}</span>
      </a>`;
  }

  function binnekort(n, titel) {
    let html = "";
    for (let i = 0; i < n; i++) {
      html += `
        <div class="vd-kaart vd-kaart--binnekort" aria-hidden="true">
          <span class="vd-beeld vd-beeld--leeg vd-tint-${i % 4}"><span class="vd-binnekort-merk">${fst_esc(t("vd_binnekort"))}</span></span>
          <span class="vd-titel">${fst_esc(titel)}</span>
        </div>`;
    }
    return html;
  }

  async function laai() {
    const rooster = document.getElementById("vd-talks");
    document.getElementById("vd-dag").innerHTML = binnekort(4, t("vd_dag_een"));
    document.getElementById("vd-stories").innerHTML = binnekort(4, t("vd_storie_een"));
    try {
      const r = await fetch(FST_KATALOGUS);
      if (!r.ok) throw new Error(`Status ${r.status}`);
      const talks = ((await r.json()).talks || [])
        .slice()
        .sort((a, b) => String(b.geskep_op || "").localeCompare(String(a.geskep_op || "")))
        .slice(0, 4);
      rooster.innerHTML = talks.length ? talks.map(talk_kaart).join("") : `<p class="stelsel-boodskap">${fst_esc(t("fst_leeg"))}</p>`;
    } catch (fout) {
      console.error("Kon nie talks laai nie:", fout);
      rooster.innerHTML = `<p class="stelsel-boodskap">${fst_esc(t("fst_kon_nie_laai"))}</p>`;
    }
  }

  document.addEventListener("DOMContentLoaded", laai);
})();
