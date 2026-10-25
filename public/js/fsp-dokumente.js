// public/js/fsp-dokumente.js
//
// DOKUMENTESKAKELS VIR SPESIFIEKE PERSONE IN DIE FUTURE SHARP-PANEEL (Oktober
// 2026). Eie lêer, soos fsp-verslae.js: dit sit self die pil "Dokumente" en sy
// afdeling by, direk ná Verslae.
//
// Werk soos Verslae, maar: die naam word getik; die vouers staan in 'n eie
// hoofvouer (bv. DOKUMENTE DEEL); die skakel is /dokumente/<lukrake kode>; en
// die beeld wys groot "Future Sharp" met die etiket Dokumente, sonder die
// persoon se naam. Die naam is net in die boodskap en in die paneel se lys.
//
// Hergebruik: die beeldtekening (fsp-verslag-beeld.js), die Google-koppeling,
// die handtekening en die CSS van Verslae (fsv-klasse).
//
// Die bediener: netlify/functions/dokumente.js en dokumente-bladsy.js.

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const TAAL = { af: "Afrikaans", en: "English" };
  const KIESBAAR = ["af", "en"];
  const ETIKET = { af: "Dokumente", en: "Documents" };
  const BESKRYWING = { af: "Jou Future Sharp-dokumente op een plek.", en: "Your Future Sharp documents in one place." };
  const VOORGESTELDE_HOOFVOUER = "DOKUMENTE DEEL";
  const MAANDE = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
  const kort = (iso) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.getDate() + " " + MAANDE[d.getMonth()] + " " + d.getFullYear() : ""; };
  const beeld_adres = (s) => "/dokumente-beeld/" + encodeURIComponent(s.kode) + ".jpg?v=" + (s.beeld_v || 1);

  const S = {
    google: { gekoppel: false }, skakels: [], sjablone: null,
    vouers: null, vouer: null, vouer_soek: "", taal: "af",
    gekies: null, filter: "oop", soek: "",
  };

  async function bediener(liggaam) {
    const r = await fetch("/.netlify/functions/dokumente", {
      method: "POST",
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify(liggaam),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.fout || "Fout " + r.status);
    return data;
  }

  function kennis(teks) {
    const k = $("#fsp-kennis");
    if (!k) return;
    k.textContent = teks;
    k.classList.add("wys");
    clearTimeout(kennis.t);
    kennis.t = setTimeout(() => k.classList.remove("wys"), 2800);
  }

  // ---------- Die beeld: groot Future Sharp, etiket Dokumente ----------
  async function beeld_data(taal) {
    const c = document.createElement("canvas");
    await window.teken_verslag_beeld(c, { taal, etiket: ETIKET[taal], sonder_kop: true, groot_reels: ["Future", "Sharp"] });
    return c.toDataURL("image/jpeg", 0.88);
  }

  // ---------- Die boodskap ----------
  function groet(t, voornaam) {
    const v = String(voornaam || "").trim();
    return t === "en" ? (v ? "Dear " + v : "Good day") : (v ? "Beste " + v : "Goeie dag");
  }

  function boodskap(s, voornaam) {
    const sj = S.sjablone || {};
    return String(sj[s.taal] || "").replace(/\{groet\}/g, groet(s.taal, voornaam)).replace(/\{naam\}/g, s.naam).replace(/\{skakel\}/g, s.skakel);
  }

  function hand_reels() {
    const h = S.handtekening;
    return h && h.naam ? [h.naam, h.titel].filter(Boolean).join("\n") : "Future Sharp";
  }
  const wa_teks = () => $("#fsd-teks").value.replace(/\s+$/, "") + "\n" + hand_reels();

  // ---------- Bou die afdeling ----------
  function bou() {
    const nav = $("#fsp-kieslys");
    const vraelyste = $('section[data-afdeling="vraelyste"]');
    if (!nav || !vraelyste || $('[data-gaan="dokumente"]', nav)) return;

    const pil = document.createElement("button");
    pil.type = "button";
    pil.className = "fsp-pil";
    pil.dataset.gaan = "dokumente";
    pil.textContent = "Dokumente";
    const voor = $('[data-gaan="verslae"]', nav) || $('[data-gaan="groepe"]', nav) || $('[data-gaan="leerders"]', nav);
    if (voor) voor.insertAdjacentElement("afterend", pil);
    else nav.appendChild(pil);

    const afd = document.createElement("section");
    afd.className = "fsp-afdeling";
    afd.dataset.afdeling = "dokumente";
    afd.innerHTML =
      '<div id="fsd-opstel"></div>' +
      '<div class="fsp-kaart" id="fsd-nuut" hidden>' +
        "<h2>Nuwe dokumenteskakel</h2>" +
        '<p class="fsp-hulp fsp-hulp-bo">Tik die persoon se naam en kies sy of haar vouer in Google Drive. Die paneel deel die vouer sodat enigiemand met die skakel dit kan oopmaak en lees (kyker, nie redigeerder nie), en maak \'n eie Future Sharp-skakel met die Dokumente-beeld vir WhatsApp en e-pos.</p>' +
        '<div class="fsv-rooster">' +
          "<div>" +
            '<div class="fsp-veld"><label class="fsp-et" for="fsd-naam">Persoon se naam</label>' +
              '<input id="fsd-naam" class="fsp-invoer" maxlength="120" placeholder="Tik die persoon se naam" autocomplete="off">' +
              '<p class="fsp-hulp">Net vir die paneel se lys en die boodskap. Die naam kom nie op die beeld of in die skakel nie.</p></div>' +
            '<div class="fsp-veld"><span class="fsp-et">Taal op die beeld en in die boodskap</span>' +
              '<div class="fsp-filters fsv-taal" id="fsd-taal">' + KIESBAAR.map((t) => '<button type="button" class="fsp-filter' + (t === "af" ? " aan" : "") + '" data-taal="' + t + '">' + TAAL[t] + "</button>").join("") + "</div></div>" +
          "</div>" +
          '<div class="fsp-veld"><span class="fsp-et">Google Drive-vouer</span>' +
            '<div class="fsv-vouers"><input class="fsv-soek" id="fsd-vouer-soek" placeholder="Soek" aria-label="Soek \'n vouer"><div class="fsv-vouer-lys" id="fsd-vouer-lys"><div class="fsv-vouer-leeg">Word gelaai …</div></div></div>' +
            '<div class="fsv-deel nog" id="fsd-deel-nota">Kies die persoon se vouer.</div>' +
            '<p class="fsp-hulp">Is die vouer nie in die lys nie? <button type="button" class="fsv-skakelknop" id="fsd-plak-wys">Plak sy skakel</button></p>' +
            '<div class="fsv-plak" id="fsd-plak"><input class="fsp-invoer" id="fsd-plak-skakel" placeholder="https://drive.google.com/drive/folders/…"></div>' +
          "</div>" +
        "</div>" +
        '<div id="fsd-bestaan"></div>' +
        '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-hoof" id="fsd-skep">Skep die skakel</button></div>' +
      "</div>" +
      '<div id="fsd-uit" hidden></div>' +
      '<div id="fsd-lys-blok" hidden>' +
        '<div class="fsp-filters"><input type="search" id="fsd-soek" placeholder="Soek op naam" aria-label="Soek"></div>' +
        '<div class="fsp-filters" id="fsd-filters" role="group" aria-label="Filter"></div>' +
        '<div class="fsp-lys" id="fsd-lys"></div>' +
      "</div>" +
      '<div id="fsd-meer"></div>';
    const verslae = $('section[data-afdeling="verslae"]');
    if (verslae) verslae.insertAdjacentElement("afterend", afd);
    else vraelyste.insertAdjacentElement("beforebegin", afd);

    pil.addEventListener("click", wys);
    afd.addEventListener("click", klik);
    afd.addEventListener("input", invoer);
    afd.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.dataset && e.target.dataset.kode) { e.preventDefault(); kies(e.target.dataset.kode); }
    });
  }

  function wys() {
    for (const a of $$(".fsp-afdeling")) a.classList.toggle("wys", a.dataset.afdeling === "dokumente");
    for (const p of $$("#fsp-kieslys .fsp-pil")) p.classList.toggle("aktief", p.dataset.gaan === "dokumente");
    laai();
  }

  async function laai() {
    try {
      neem(await bediener({ aksie: "stand" }));
      teken();
      if (S.google.gekoppel && S.google.hoofvouer) laai_vouers();
      else if (S.google.gekoppel) wys_hoofvouers($("#fsd-hoof-lys"));
    } catch (f) {
      $("#fsd-opstel").innerHTML = '<div class="fsp-kaart"><p class="fsp-waarsku">Kon nie laai nie: ' + esc(f.message) + "</p></div>";
    }
  }

  function neem(d) {
    S.google = d.google || S.google;
    S.skakels = d.skakels || S.skakels;
    S.sjablone = d.sjablone || S.sjablone;
    if ("handtekening" in d) S.handtekening = d.handtekening;
    if ("epos_gereed" in d) S.epos_gereed = d.epos_gereed;
  }

  async function laai_vouers() {
    try {
      S.vouers = (await bediener({ aksie: "vouers" })).vouers || [];
    } catch (f) {
      S.vouers = [];
      $("#fsd-vouer-lys").innerHTML = '<div class="fsv-vouer-leeg">Kon nie die vouers laai nie: ' + esc(f.message) + "</div>";
      return;
    }
    if (!S.vouer) pas_vouer();
    teken_vouers();
  }

  // ---------- Teken ----------
  function teken() {
    const klaar = S.google.gekoppel && S.google.hoofvouer;
    teken_opstel();
    $("#fsd-nuut").hidden = !klaar;
    teken_lys();
    teken_meer();
  }

  function teken_opstel() {
    const o = $("#fsd-opstel");
    if (S.google.gekoppel && S.google.hoofvouer) { o.innerHTML = ""; return; }
    if (!S.google.gekoppel) {
      o.innerHTML =
        '<div class="fsp-kaart"><h2>Koppel eers Google Drive</h2>' +
        '<p class="fsp-hulp fsp-hulp-bo">Dokumente gebruik dieselfde Google-koppeling as Verslae. Gaan na <b>Verslae</b> en koppel Google Drive daar; kom dan terug hierheen.</p></div>';
      return;
    }
    o.innerHTML =
      '<div class="fsp-kaart">' +
        "<h2>Kies die hoofvouer vir Dokumente</h2>" +
        '<p class="fsp-hulp fsp-hulp-bo">Dokumente het sy eie hoofvouer, apart van Verslae se vouer vir die skole. Deel die vouer <b>' + VOORGESTELDE_HOOFVOUER + "</b> (met \'n vouer per persoon daarin) met hierdie adres, as <b>Redigeerder</b> (Editor):</p>" +
        '<div class="fsp-ry-knop"><code class="fsv-epos-sa" id="fsd-sa">' + esc(S.google.epos) + '</code><button type="button" class="fsp-knop fsp-knop-lig" data-kopieer="#fsd-sa">Kopieer</button></div>' +
        '<p class="fsp-hulp">In Google Drive: regsklik op die vouer › <b>Share</b> › plak die adres › kies <b>Editor</b> › haal die merkie by <b>Notify people</b> af › <b>Share</b>. Die paneel verander of skrap nooit lêers nie.</p>' +
        '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-hoof" id="fsd-hoof-soek">Ek het gedeel: wys die vouers</button></div>' +
        '<div id="fsd-hoof-lys"></div>' +
      "</div>";
  }

  // Kies vanself die vouer met dieselfde naam as die persoon.
  function pas_vouer() {
    const naam = $("#fsd-naam").value.trim().toLowerCase();
    if (!naam || !S.vouers) return;
    const v = S.vouers.find((x) => x.naam.trim().toLowerCase() === naam) ||
      S.vouers.find((x) => x.naam.toLowerCase().includes(naam) || naam.includes(x.naam.toLowerCase()));
    if (v) { S.vouer = v.id; $("#fsd-plak-skakel").value = ""; }
  }

  function teken_vouers() {
    const lys = $("#fsd-vouer-lys");
    if (!S.vouers || !S.google.hoofvouer) return;
    const q = S.vouer_soek.trim().toLowerCase();
    const sigbaar = S.vouers.filter((v) => !q || v.naam.toLowerCase().includes(q));
    lys.innerHTML = sigbaar.length
      ? sigbaar.map((v) => '<button type="button" class="fsv-vouer' + (v.id === S.vouer ? " aan" : "") + '" data-vouer="' + esc(v.id) + '"><span class="fsv-ik"></span>' + esc(v.naam) + "<small>" + esc(kort(v.verander)) + "</small></button>").join("")
      : '<div class="fsv-vouer-leeg">' + (S.vouers.length ? "Geen vouer pas nie." : "Die hoofvouer (" + esc(S.google.hoofvouer.naam) + ") het nog geen subvouers nie. Skep een per persoon in Google Drive.") + "</div>";
    $("#fsd-vouer-soek").placeholder = "Soek in " + S.google.hoofvouer.naam;
    const plak = $("#fsd-plak-skakel").value.trim();
    $("#fsd-deel-nota").textContent = S.vouer || plak
      ? "Wanneer jy die skakel skep, deel die paneel die vouer: enigiemand met die skakel kan kyk."
      : "Kies die persoon se vouer.";
  }

  function teken_taal() {
    for (const b of $$("#fsd-taal .fsp-filter")) b.classList.toggle("aan", b.dataset.taal === S.taal);
  }

  function teken_lys() {
    const blok = $("#fsd-lys-blok");
    const oop = S.skakels.filter((s) => s.oop).length;
    $("#fsd-filters").innerHTML =
      '<button type="button" class="fsp-filter' + (S.filter === "oop" ? " aan" : "") + '" data-filter="oop">Aktief <b>' + oop + "</b></button>" +
      '<button type="button" class="fsp-filter' + (S.filter === "toe" ? " aan" : "") + '" data-filter="toe">Onaktief <b>' + (S.skakels.length - oop) + "</b></button>";
    const q = S.soek.trim().toLowerCase();
    const lys = S.skakels.filter((s) => (S.filter === "oop" ? s.oop : !s.oop) && (!q || s.naam.toLowerCase().includes(q)));
    $("#fsd-lys").innerHTML = lys.length
      ? lys.map((s) =>
          '<div class="fsp-ry" role="button" tabindex="0" data-kode="' + esc(s.kode) + '" data-stand="' + (s.oop ? "gereel" : "verval") + '">' +
            '<div class="fsp-ry-no">' + esc(kort(s.geskep_op)) + "</div>" +
            '<div><div class="fsp-ry-naam">' + esc(s.naam) + '</div><div class="fsp-ry-sub">' + esc(ETIKET[s.taal] + " · " + TAAL[s.taal] + " · Drive › " + s.vouer_naam + " · /dokumente/" + s.kode) + "</div>" +
              (s.geskep_deur ? '<div class="fsp-ry-sub">Geskep deur ' + esc(s.geskep_deur) + "</div>" : "") + "</div>" +
            '<div><span class="fsp-stand ' + (s.oop ? "gereel" : "verval") + '">' + (s.oop ? "Aktief" : "Onaktief") + "</span></div>" +
          "</div>").join("")
      : '<p class="fsp-leeg">' + (S.skakels.length ? "Niks hier nie." : "Nog geen dokumenteskakels nie. Skep die eerste een hierbo.") + "</p>";
    blok.hidden = !(S.google.gekoppel && S.google.hoofvouer) && !S.skakels.length;
  }

  function teken_meer() {
    const m = $("#fsd-meer");
    if (!S.google.gekoppel) { m.innerHTML = ""; return; }
    const sj = S.sjablone || {};
    const h = S.handtekening || {};
    m.innerHTML =
      '<details class="fsv-meer"><summary>Boodskappe vir dokumenteskakels</summary><div>' +
        '<p class="fsp-hulp fsp-hulp-bo"><b>{groet}</b> word "Beste Marié" as jy \'n voornaam intik (anders "Goeie dag"), <b>{naam}</b> die persoon se naam soos in die lys en <b>{skakel}</b> die skakel. Die handtekening van wie stuur, kom vanself onderaan. Hierdie boodskappe is apart van dié vir die skole.</p>' +
        '<div class="fsv-sj-twee">' +
          '<label><span class="fsp-klein-et">Afrikaans</span><textarea class="fsp-invoer" id="fsd-sj-af" rows="11">' + esc(sj.af || "") + "</textarea></label>" +
          '<label><span class="fsp-klein-et">English</span><textarea class="fsp-invoer" id="fsd-sj-en" rows="11">' + esc(sj.en || "") + "</textarea></label>" +
        "</div>" +
        '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-hoof" id="fsd-sj-stoor">Stoor die boodskappe</button></div>' +
      "</div></details>" +
      '<details class="fsv-meer" id="fsd-hand-kaart"><summary>My handtekening</summary><div>' +
        '<p class="fsp-hulp fsp-hulp-bo">Dieselfde handtekening as by Verslae. Dit kom onderaan elke boodskap wat jy stuur, en antwoorde op die e-pos gaan na die adres hier.</p>' +
        '<div class="fsv-aan">' +
          '<div class="fsp-veld"><label class="fsp-klein-et" for="fsd-h-naam">Naam soos dit onderaan staan</label><input class="fsp-invoer" id="fsd-h-naam" maxlength="80" placeholder="Bv. Prof. Ignatius Gous" value="' + esc(h.naam || "") + '"></div>' +
          '<div class="fsp-veld"><label class="fsp-klein-et" for="fsd-h-titel">Titel <span class="fsv-klein">(opsioneel)</span></label><input class="fsp-invoer" id="fsd-h-titel" maxlength="100" placeholder="Bv. Direkteur, Future Sharp NPC" value="' + esc(h.titel || "") + '"></div>' +
          '<div class="fsp-veld"><label class="fsp-klein-et" for="fsd-h-epos">E-posadres vir antwoorde</label><input class="fsp-invoer" id="fsd-h-epos" type="email" maxlength="120" value="' + esc(h.epos || "") + '"></div>' +
          '<div class="fsp-veld"><label class="fsp-klein-et" for="fsd-h-sel">Selfoon <span class="fsv-klein">(opsioneel, net in die e-pos)</span></label><input class="fsp-invoer" id="fsd-h-sel" maxlength="30" value="' + esc(h.selfoon || "") + '"></div>' +
        "</div>" +
        '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-hoof" id="fsd-h-stoor">Stoor my handtekening</button></div>' +
      "</div></details>" +
      '<details class="fsv-meer"><summary>Hoofvouer vir Dokumente</summary><div>' +
        '<p class="fsp-hulp fsp-hulp-bo">Die vouer waarin elke persoon se eie vouer staan. Dit is apart van Verslae se hoofvouer vir die skole.</p>' +
        '<p class="fsp-hulp">Hoofvouer: <b>' + esc(S.google.hoofvouer ? S.google.hoofvouer.naam : "nog nie gekies nie") + "</b></p>" +
        '<div class="fsp-ry-knop"><code class="fsv-epos-sa" id="fsd-sa2">' + esc(S.google.epos) + '</code><button type="button" class="fsp-knop fsp-knop-lig" data-kopieer="#fsd-sa2">Kopieer</button></div>' +
        '<div class="fsp-aksies"><button type="button" class="fsp-knop fsp-knop-lig" id="fsd-hoof-ander">Kies \'n ander hoofvouer</button></div>' +
        '<div id="fsd-hoof-lys2"></div>' +
      "</div></details>";
  }

  // ---------- Een skakel ----------
  async function kies(kode) {
    S.gekies = kode;
    const s = S.skakels.find((x) => x.kode === kode);
    const uit = $("#fsd-uit");
    if (!s) { uit.hidden = true; return; }
    const titel = "Future Sharp · " + ETIKET[s.taal];
    uit.innerHTML =
      '<div class="fsp-strook">' +
        '<div class="fsp-strook-titel">' + esc(s.naam) + " · " + esc(ETIKET[s.taal]) + (s.oop ? "" : ' <span class="fsp-stand verval">Onaktief</span>') + "</div>" +
        '<span class="fsp-strook-taal">Skakel</span>' +
        '<code id="fsd-skakel">' + esc(s.skakel) + "</code>" +
        '<button type="button" class="fsp-knop fsp-knop-lig" data-kopieer="#fsd-skakel">Kopieer</button>' +
      "</div>" +
      '<div class="fsp-epos"><div class="fsv-uit">' +
        '<div class="fsv-wa"><div class="fsv-wa-et">So lyk dit in WhatsApp</div><div class="fsv-wa-bel">' +
          '<div class="fsv-wa-kaart"><img src="' + beeld_adres(s) + '" alt="">' +
            '<div class="t">' + esc(titel) + '</div><div class="d">' + esc(BESKRYWING[s.taal]) + '</div><div class="u">futureshop.futuresharp.co.za</div></div>' +
          '<div class="fsv-wa-teks" id="fsd-wa-teks"></div><div class="fsv-wa-tyd">✓✓</div>' +
        "</div></div>" +
        "<div>" +
          '<div class="fsp-epos-titel">Stuur aan</div>' +
          '<div class="fsp-epos-hulp">Die voornaam en jou handtekening gaan in albei: WhatsApp en e-pos.</div>' +
          '<div class="fsv-aan fsv-aan3">' +
            '<div class="fsp-veld"><label class="fsp-klein-et" for="fsd-voornaam">Voornaam <span class="fsv-klein">(opsioneel)</span></label><input class="fsp-invoer" id="fsd-voornaam" maxlength="60" placeholder="Bv. ' + esc(s.naam.split(" ")[0]) + '" autocomplete="off"></div>' +
            '<div class="fsp-veld"><label class="fsp-klein-et" for="fsd-sel">Selfoon</label><input class="fsp-invoer" id="fsd-sel" inputmode="tel" placeholder="082 123 4567"></div>' +
            '<div class="fsp-veld"><label class="fsp-klein-et" for="fsd-epos">E-posadres</label><input class="fsp-invoer" id="fsd-epos" type="email" placeholder="naam@voorbeeld.co.za"></div>' +
          "</div>" +
          '<div class="fsv-hand" id="fsd-hand"></div>' +
          '<div class="fsp-epos-titel" style="margin-top:12px">Boodskap</div>' +
          '<div class="fsp-epos-hulp">Uit die Dokumente-sjabloon; die voornaam en die skakel word ingevul en jou handtekening kom vanself onderaan. Pas gerus aan voor jy stuur.</div>' +
          '<textarea class="fsp-invoer" id="fsd-teks" rows="10">' + esc(boodskap(s, "")) + "</textarea>" +
          '<label class="fsv-chk"><input type="checkbox" id="fsd-afskrif" checked> Stuur vir my \'n afskrif van die e-pos</label>' +
          '<div class="fsp-epos-ry">' +
            '<button type="button" class="fsp-knop fsp-knop-wa" id="fsd-wa"' + (s.oop ? "" : " disabled") + ">Stuur op WhatsApp</button>" +
            '<button type="button" class="fsp-knop fsp-knop-hoof" id="fsd-pos"' + (s.oop && S.epos_gereed ? "" : " disabled") + ">Stuur e-pos</button>" +
            '<button type="button" class="fsp-knop fsp-knop-lig" id="fsd-kopieer">Kopieer boodskap</button>' +
            '<a class="fsp-knop fsp-knop-lig" href="' + beeld_adres(s) + '" download="future-sharp-dokumente.jpg">Laai beeld af</a>' +
          "</div>" +
          (S.epos_gereed ? "" : '<p class="fsp-waarsku">Stuur e-pos werk sodra die verslae@-posbus se wagwoord in Netlify gestel is.</p>') +
          '<p class="fsp-hulp">WhatsApp maak oop op jou eie foon of rekenaar met die boodskap klaar ingetik. Die e-pos gaan uit verslae@futuresharp.co.za met jou naam as afsender en die knoppie <b>' + (s.taal === "en" ? "Open the documents" : "Maak die dokumente oop") + "</b>; antwoorde gaan na jou adres.</p>" +
          '<div class="fsv-deel nog" id="fsd-deel-stand">' + (s.oop ? "Kyk of die vouer nog gedeel is …" : "Die vouer word nie meer gedeel nie.") + "</div>" +
          '<div class="fsv-wysig"><span class="fsp-klein-et">Taal</span>' +
            KIESBAAR.map((t) => '<button type="button" class="fsp-filter' + (t === s.taal ? " aan" : "") + '" data-wtaal="' + t + '">' + TAAL[t] + "</button>").join("") +
          "</div>" +
          '<p class="fsp-hulp"><a href="' + esc(s.drive) + '" target="_blank" rel="noopener">Drive › ' + esc(s.vouer_naam) + "</a> · geskep " + kort(s.geskep_op) + (s.geskep_deur ? " deur " + esc(s.geskep_deur) : "") + (s.oop ? "" : " · gedeaktiveer " + kort(s.gesluit_op)) + "</p>" +
          geskiedenis_html(s) +
          '<div class="fsp-aksies"><button type="button" class="fsp-knop ' + (s.oop ? "fsp-knop-gevaar" : "fsp-knop-lig") + '" id="fsd-sluit">' + (s.oop ? "Deaktiveer die skakel" : "Aktiveer weer") + "</button></div>" +
          (s.oop
            ? '<p class="fsp-hulp">Deaktiveer haal ook die deling van die vouer in Drive weg. Die lêers self bly staan.</p>'
            : '<div class="fsp-toets-skrap"><b>Skrap hierdie dokumenteskakel</b>' +
              '<p class="fsp-hulp">Tik <b>' + esc(s.naam) + "</b> om te bevestig. Die vouer en die dokumente in Google Drive bly staan.</p>" +
              '<div class="fsp-skrap-ry"><input type="text" class="fsp-invoer" id="fsd-skrap-naam" autocomplete="off" placeholder="' + esc(s.naam) + '">' +
              '<button type="button" class="fsp-knop fsp-knop-gevaar" id="fsd-skrap" disabled>Skrap</button></div></div>') +
        "</div>" +
      "</div></div>";
    S.groet_nou = groet(s.taal, "");
    teken_hand();
    teken_wa_teks();
    uit.hidden = false;
    uit.scrollIntoView({ behavior: "smooth", block: "start" });
    if (s.oop) {
      try {
        const d = await bediener({ aksie: "kontroleer", kode });
        const el = $("#fsd-deel-stand");
        if (!el || S.gekies !== kode) return;
        el.className = "fsv-deel" + (d.gedeel ? "" : " fout");
        el.innerHTML = d.gedeel
          ? "✓ <span><b>Gedeel:</b> enigiemand met die skakel kan kyk</span>"
          : '<span><b>Nie meer gedeel nie.</b> Iemand het die deling in Drive verander. <button type="button" class="fsv-skakelknop" id="fsd-deel-weer">Deel weer as kyker</button></span>';
      } catch (f) {
        const el = $("#fsd-deel-stand");
        if (el) { el.className = "fsv-deel fout"; el.textContent = "Kon nie die deling nagaan nie: " + f.message; }
      }
    }
  }

  function teken_wa_teks() {
    const s = S.skakels.find((x) => x.kode === S.gekies);
    const el = $("#fsd-wa-teks");
    if (!s || !el) return;
    el.innerHTML = esc(wa_teks()).split(esc(s.skakel)).join("<a>" + esc(s.skakel) + "</a>");
  }

  function teken_hand() {
    const el = $("#fsd-hand");
    if (!el) return;
    const h = S.handtekening;
    el.innerHTML = h && h.naam
      ? '<div><span class="fsp-klein-et">Onderteken deur</span><div><b>' + esc(h.naam) + "</b>" + (h.titel ? " · " + esc(h.titel) : "") + (h.epos ? '<div class="fsv-klein">Antwoorde na ' + esc(h.epos) + "</div>" : "") + "</div></div>" +
        '<button type="button" class="fsv-skakelknop" id="fsd-hand-wysig">Wysig my handtekening</button>'
      : '<div><span class="fsp-klein-et">Onderteken deur</span><div>Nog geen handtekening nie; die boodskap eindig met <b>Future Sharp</b>.</div></div>' +
        '<button type="button" class="fsv-skakelknop" id="fsd-hand-wysig">Stel my handtekening op</button>';
  }

  function verander_voornaam(v) {
    const s = S.skakels.find((x) => x.kode === S.gekies);
    if (!s) return;
    const t = $("#fsd-teks");
    const nuut = groet(s.taal, v);
    if (S.groet_nou && t.value.includes(S.groet_nou)) t.value = t.value.replace(S.groet_nou, nuut);
    S.groet_nou = nuut;
    teken_wa_teks();
  }

  function wys_handtekening_vorm() {
    const d = $("#fsd-hand-kaart");
    if (!d) return;
    d.open = true;
    d.scrollIntoView({ behavior: "smooth", block: "start" });
    const n = $("#fsd-h-naam");
    if (n) setTimeout(() => n.focus(), 400);
  }

  async function stoor_handtekening(knop) {
    knop.disabled = true;
    try {
      const d = await bediener({ aksie: "stoor_handtekening", handtekening: { naam: $("#fsd-h-naam").value, titel: $("#fsd-h-titel").value, epos: $("#fsd-h-epos").value, selfoon: $("#fsd-h-sel").value } });
      S.handtekening = d.handtekening;
      teken_hand();
      teken_wa_teks();
      kennis("Handtekening gestoor");
    } catch (f) {
      kennis(f.message);
    } finally {
      knop.disabled = false;
    }
  }

  async function stuur_epos(knop) {
    const s = S.skakels.find((x) => x.kode === S.gekies);
    if (!s) return;
    const aan = $("#fsd-epos").value.trim();
    if (!aan) { $("#fsd-epos").focus(); return kennis("Tik die e-posadres"); }
    if (!confirm("Stuur die e-pos aan " + aan + "?")) return;
    knop.disabled = true;
    knop.textContent = "Stuur …";
    try {
      const d = await bediener({ aksie: "stuur_epos", kode: s.kode, aan, boodskap: $("#fsd-teks").value, afskrif: $("#fsd-afskrif").checked });
      Object.assign(s, d.skakel);
      kennis("E-pos gestuur aan " + d.gestuur.join(", "));
    } catch (f) {
      kennis(f.message);
    } finally {
      knop.disabled = false;
      knop.textContent = "Stuur e-pos";
    }
  }

  async function kopieer(teks) {
    try { await navigator.clipboard.writeText(teks); }
    catch (_) { const a = document.createElement("textarea"); a.value = teks; document.body.appendChild(a); a.select(); document.execCommand("copy"); a.remove(); }
    kennis("Gekopieer");
  }

  // ---------- Aksies ----------
  async function skep(knop) {
    const naam = $("#fsd-naam").value.trim();
    const vouer = $("#fsd-plak-skakel").value.trim() || S.vouer;
    if (naam.length < 2) return kennis("Tik die persoon se naam");
    if (!vouer) return kennis("Kies die persoon se vouer");
    knop.disabled = true;
    knop.textContent = "Besig …";
    try {
      const beeld = await beeld_data(S.taal);
      const d = await bediener({ aksie: "skep", naam, vouer, taal: S.taal, beeld });
      S.skakels.unshift(d.skakel);
      S.filter = "oop";
      $("#fsd-naam").value = "";
      $("#fsd-plak-skakel").value = "";
      S.vouer = null;
      S.vouer_hand = false;
      teken_vouers();
      teken_bestaan();
      teken_lys();
      kies(d.skakel.kode);
      kennis("Skakel geskep en die vouer gedeel");
    } catch (f) {
      kennis(f.message);
    } finally {
      knop.disabled = false;
      knop.textContent = "Skep die skakel";
    }
  }

  async function verander_taal(taal) {
    const s = S.skakels.find((x) => x.kode === S.gekies);
    if (!s || s.taal === taal) return;
    try {
      const beeld = await beeld_data(taal);
      const d = await bediener({ aksie: "wysig", kode: s.kode, taal, beeld });
      Object.assign(s, d.skakel);
      teken_lys();
      kies(s.kode);
      kennis("Taal: " + TAAL[taal]);
    } catch (f) {
      kennis(f.message);
    }
  }

  async function sluit(knop) {
    const s = S.skakels.find((x) => x.kode === S.gekies);
    if (!s) return;
    if (s.oop && !confirm("Deaktiveer die skakel vir " + s.naam + "? Die vouer word dan ook nie meer met enigiemand met die skakel gedeel nie.")) return;
    knop.disabled = true;
    try {
      const d = await bediener({ aksie: "sluit", kode: s.kode, oop: !s.oop });
      Object.assign(s, d.skakel);
      teken_lys();
      kies(s.kode);
      kennis(s.oop ? "Die skakel is weer aktief en die vouer gedeel" : "Die skakel is gedeaktiveer en die deling weggehaal");
    } catch (f) {
      kennis(f.message);
      knop.disabled = false;
    }
  }

  async function deel_weer() {
    const s = S.skakels.find((x) => x.kode === S.gekies);
    if (!s) return;
    try {
      await bediener({ aksie: "sluit", kode: s.kode, oop: true });
      kies(s.kode);
      kennis("Die vouer is weer gedeel");
    } catch (f) { kennis(f.message); }
  }

  async function skrap(knop) {
    const s = S.skakels.find((x) => x.kode === S.gekies);
    if (!s) return;
    knop.disabled = true;
    try {
      await bediener({ aksie: "skrap", kode: s.kode, naam: $("#fsd-skrap-naam").value.trim() });
      S.skakels = S.skakels.filter((x) => x.kode !== s.kode);
      S.gekies = null;
      $("#fsd-uit").hidden = true;
      teken_lys();
      kennis("Dokumenteskakel geskrap");
    } catch (f) {
      kennis(f.message);
      knop.disabled = false;
    }
  }

  function wa_nommer(teks) {
    let n = String(teks || "").replace(/[^\d+]/g, "");
    if (!n) return "";
    if (n.startsWith("+")) n = n.slice(1);
    else if (n.startsWith("00")) n = n.slice(2);
    else if (n.startsWith("0")) n = "27" + n.slice(1);
    return /^\d{8,15}$/.test(n) ? n : null;
  }

  const WAT = { geskep: "Skakel geskep", gewysig: "Taal verander", epos: "E-pos gestuur", whatsapp: "WhatsApp oopgemaak", gedeaktiveer: "Gedeaktiveer", geaktiveer: "Weer geaktiveer" };
  const tyd = (iso) => { const d = new Date(iso); return kort(iso) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };

  function geskiedenis_html(s) {
    const lys = s.geskiedenis || [];
    if (!lys.length) return "";
    const ry = (g) => '<li><span class="fsv-gs-tyd">' + esc(tyd(g.op)) + "</span><span><b>" + esc(WAT[g.wat] || g.wat) + "</b>" +
      (g.aan ? " aan " + esc(g.aan) : "") + (g.taal ? " (" + esc(TAAL[g.taal] || g.taal) + ")" : "") + (g.deur ? " · " + esc(g.deur) : "") + "</span></li>";
    return '<div class="fsv-gs"><span class="fsp-klein-et">Geskiedenis</span><ul>' + lys.slice(0, 4).map(ry).join("") + "</ul>" +
      (lys.length > 4 ? '<details><summary>Wys alles (' + lys.length + ")</summary><ul>" + lys.slice(4).map(ry).join("") + "</ul></details>" : "") + "</div>";
  }

  function teken_bestaan() {
    const el = $("#fsd-bestaan");
    if (!el) return;
    const naam = $("#fsd-naam").value.trim().toLowerCase();
    const reeds = naam ? S.skakels.filter((x) => x.oop && x.naam.trim().toLowerCase() === naam) : [];
    el.innerHTML = reeds.length
      ? '<div class="fsv-deel fsv-bestaan">' +
          "<span><b>Daar is reeds " + (reeds.length > 1 ? reeds.length + " aktiewe skakels" : "'n aktiewe skakel") + " vir hierdie persoon.</b><br>" +
          reeds.map((x) => esc(TAAL[x.taal]) + ", geskep " + kort(x.geskep_op) + (x.geskep_deur ? " deur " + esc(x.geskep_deur) : "") +
            ' · <button type="button" class="fsv-skakelknop" data-oop="' + esc(x.kode) + '">Maak dit oop</button>').join("<br>") +
          "<br>Jy kan steeds 'n nuwe een skep, byvoorbeeld in die ander taal.</span></div>"
      : "";
  }

  function stuur_wa() {
    const n = wa_nommer($("#fsd-sel").value);
    if (n === null) return kennis("Die selfoonnommer lyk nie reg nie");
    window.open("https://wa.me/" + n + "?text=" + encodeURIComponent(wa_teks()), "_blank", "noopener");
    const s = S.skakels.find((x) => x.kode === S.gekies);
    if (s) bediener({ aksie: "log_whatsapp", kode: s.kode, aan: $("#fsd-sel").value }).then((d) => { Object.assign(s, d.skakel); }).catch(() => {});
  }

  // Die vouer DOKUMENTE DEEL kom bo-aan en is gemerk, as dit gedeel is.
  async function wys_hoofvouers(houer) {
    if (!houer) return;
    houer.innerHTML = '<p class="fsp-leeg">Word gelaai …</p>';
    try {
      const { vouers } = await bediener({ aksie: "hoofvouers" });
      const voorstel = (v) => v.naam.trim().toUpperCase() === VOORGESTELDE_HOOFVOUER;
      const lys = vouers.filter(voorstel).concat(vouers.filter((v) => !voorstel(v)));
      houer.innerHTML = lys.length
        ? '<div class="fsv-vouers" style="margin-top:12px"><div class="fsv-vouer-lys">' +
            lys.map((v) => '<button type="button" class="fsv-vouer' + (voorstel(v) ? " aan" : "") + '" data-hoof="' + esc(v.id) + '"><span class="fsv-ik"></span>' + esc(v.naam) + "<small>" + (voorstel(v) ? "Kies hierdie een" : "Kies") + "</small></button>").join("") +
          "</div></div>"
        : '<p class="fsp-waarsku">Nog geen vouer is met die paneel gedeel nie. Google kan \'n minuut of twee neem; probeer dan weer.</p>';
    } catch (f) {
      houer.innerHTML = '<p class="fsp-waarsku">' + esc(f.message) + "</p>";
    }
  }

  async function stel_hoofvouer(id) {
    try {
      neem(await bediener({ aksie: "stel_hoofvouer", vouer: id }));
      S.vouers = null;
      S.vouer = null;
      teken();
      laai_vouers();
      kennis("Hoofvouer vir Dokumente: " + S.google.hoofvouer.naam);
    } catch (f) { kennis(f.message); }
  }

  async function stoor_sjablone(knop) {
    knop.disabled = true;
    try {
      const d = await bediener({ aksie: "stoor_sjablone", sjablone: { af: $("#fsd-sj-af").value, en: $("#fsd-sj-en").value } });
      S.sjablone = d.sjablone;
      kennis("Boodskappe gestoor");
    } catch (f) {
      kennis(f.message);
    } finally {
      knop.disabled = false;
    }
  }

  // ---------- Gebeure ----------
  function klik(e) {
    const b = e.target.closest("button, .fsp-ry[data-kode]");
    if (!b) return;
    if (b.dataset.taal) { S.taal = b.dataset.taal; teken_taal(); return; }
    if (b.dataset.wtaal) return verander_taal(b.dataset.wtaal);
    if (b.dataset.vouer) { S.vouer = b.dataset.vouer; S.vouer_hand = true; $("#fsd-plak-skakel").value = ""; teken_vouers(); return; }
    if (b.dataset.hoof) return stel_hoofvouer(b.dataset.hoof);
    if (b.dataset.filter) { S.filter = b.dataset.filter; teken_lys(); return; }
    if (b.dataset.kode) return kies(b.dataset.kode);
    if (b.dataset.oop) return kies(b.dataset.oop);
    switch (b.id) {
      case "fsd-skep": return skep(b);
      case "fsd-sluit": return sluit(b);
      case "fsd-skrap": return skrap(b);
      case "fsd-wa": return stuur_wa();
      case "fsd-pos": return stuur_epos(b);
      case "fsd-kopieer": return kopieer(wa_teks());
      case "fsd-hand-wysig": return wys_handtekening_vorm();
      case "fsd-h-stoor": return stoor_handtekening(b);
      case "fsd-deel-weer": return deel_weer();
      case "fsd-sj-stoor": return stoor_sjablone(b);
      case "fsd-hoof-soek": return wys_hoofvouers($("#fsd-hoof-lys"));
      case "fsd-hoof-ander": return wys_hoofvouers($("#fsd-hoof-lys2"));
      case "fsd-plak-wys": $("#fsd-plak").classList.toggle("wys"); $("#fsd-plak-skakel").focus(); return;
    }
  }

  function invoer(e) {
    const id = e.target.id;
    // Pas die vouer by die naam, tensy iemand self 'n vouer gekies het.
    if (id === "fsd-naam") { if (!S.vouer_hand) { S.vouer = null; pas_vouer(); } teken_vouers(); teken_bestaan(); }
    if (id === "fsd-vouer-soek") { S.vouer_soek = e.target.value; teken_vouers(); }
    if (id === "fsd-plak-skakel") { if (e.target.value.trim()) S.vouer = null; teken_vouers(); }
    if (id === "fsd-soek") { S.soek = e.target.value; teken_lys(); }
    if (id === "fsd-teks") teken_wa_teks();
    if (id === "fsd-voornaam") verander_voornaam(e.target.value);
    if (id === "fsd-skrap-naam") {
      const s = S.skakels.find((x) => x.kode === S.gekies);
      $("#fsd-skrap").disabled = !s || e.target.value.trim() !== s.naam;
    }
  }

  document.addEventListener("DOMContentLoaded", bou);
})();
