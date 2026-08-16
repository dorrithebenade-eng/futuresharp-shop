// public/js/faktuur-backoffice.js
//
// Die faktuurvorm se tweede helfte: die begroting, die verdeling en die som.
// Niks hierin verskyn op die dokument nie.
//
// Hy laai NÁ faktuur-vorm.js en gebruik daardie lêer se toestand (V), sy
// merk_vuil() en sy fv_t(). Die koppeling loop een rigting: faktuur-vorm.js
// roep window.bo_teken() as dit bestaan, en werk sonder hierdie lêer.
//
// faktuur-som.js moet VOOR albei laai.
//
// ─────────────────────────────────────────────────────────────────────────
// TWEE TAKE, EN HULLE MAG NIE IN EEN LYS SAAMVAL NIE
//
//   Wat kos dit?  — die begroting: koste opgetel tot 'n prys
//   Wie kry wat?  — die verdeling van daardie prys
//
// Die eerste weergawe van die mockup het hulle saamgegooi, en toe lyk 'n
// reiskostery wat die PRYS bepaal presies soos een wat aan Eugene UITBETAAL
// word. Hulle is nie dieselfde ding nie.
//
// DIE BEGROTING IS 'N MAATSTAF, NIE 'N VERPLIGTING NIE. Dit is wat julle
// verwag om te bestee; die werklike rekeninge kom later en kan verskil. Wat
// dit beantwoord, is die enigste vraag waarvoor 'n mens begroot: faktureer
// ons genoeg?

const HOOFREKENING = "Future Sharp";
let BEGUNSTIGDES = [];   // { begunstigde_id, naam, subrekening_kode }

/* ═══════════════════════════════════════════════════════════════════════
   DIE PAD IS 'N GEVOLG, NIE 'N KEUSE NIE

   Die ontvanger bepaal wie betaal. Twee velde vir een feit is presies waar
   hulle later uitmekaar loop — dieselfde redenasie as `versending` teenoor
   `drukker` in die winkel.

   Die derde geval is die een wat maklik misgekyk word: 'n begunstigde
   SONDER 'n subrekening. Paystack kan hom nie betaal nie, dus val sy ry na
   die hoofrekening al is hy 'n begunstigde. Sonder die merkie lyk dit of hy
   outomaties betaal word terwyl niemand hom betaal nie.
   ═══════════════════════════════════════════════════════════════════════ */
function bo_pad(ontvanger) {
  if (!ontvanger || ontvanger === HOOFREKENING) return "hoof";
  const b = BEGUNSTIGDES.find((x) => x.naam === ontvanger);
  return b && (b.subrekening_kode || "").trim() ? "split" : "wag";
}

function bo_pad_et(pad) {
  if (pad === "split") return fv_t("bo_pad_split", "Verdelingsry");
  if (pad === "wag") return fv_t("bo_pad_wag", "Hoofrekening — geen subrekening");
  return fv_t("bo_pad_hoof", "Hoofrekening");
}

/* ═══════════════════════════════════════════════════════════════════════
   DIE SOM

   Wat fs_bereken() ingevoer kry: ÉÉN reël — die faktuur se reëls minus die
   afslag, met elke verdelingsry plus Hosting daarop.

   DIE SKENKING KOM NIE HIER IN NIE, en dit is nie 'n vereenvoudiging nie.
   Gee 'n mens haar as 'n tweede reël, versprei die som die fooi pro rata:
   die faktuur se deel van die vaste R1,30 krimp, die basis groei, en elke
   begunstigde kry 'n sent of twee MEER omdat iemand 'n skenking bygevoeg
   het. Getoets in die mockup: R1 000 het Eugene se bedrag met 2c verander.

   Die verdeling word dus op die FAKTUUR ALLEEN bereken. Die skenking word
   daarna bygetel, dra haar eie deel van die werklike fooi, en die res val na
   die oorskot. Dit is Future Sharp se geld en dit word nooit verdeel nie.
   ═══════════════════════════════════════════════════════════════════════ */
// DIE VERTALING SELF LEEF IN faktuur-som.js, nie hier nie.
//
// stuur-faktuur.js moet presies dieselfde som doen wanneer hy die verdeling
// vries — die bedrae mag nooit van die kliëntkant af aanvaar word nie. Twee
// kopieë van hierdie vertaling sou beteken die skerm en die gevriesde
// verdeling kan met 'n sent verskil sonder dat iemand dit sien, en dan weier
// Paystack die transaksie of iemand kry 'n sent te min.
//
// Wat hier oorbly, is die enigste stuk wat aan die BLAAIER behoort: wie 'n
// subrekening het, kom uit die lys wat hierdie bladsy gelaai het. Die
// bediener gee dieselfde antwoord uit die store.
function bo_invoer() {
  return fs_invoer_uit_faktuur(V, (ontvanger) => bo_pad(ontvanger) === "split");
}

// Wat die begroting saam vra, per pad. Slegs die HOOFREKENING-deel word teen
// die oorskot getoets: wat deur Paystack loop, is klaar 'n verdelingsry en
// staan reeds in die som. Trek 'n mens dit twee keer af, lyk die faktuur
// armer as wat hy is.
function bo_begroting() {
  let split = 0;
  let hoof = 0;
  V.koste.forEach((k) => {
    const bedrag = (Number(k.bedrag_sent) || 0) / 100;
    if (bo_pad(k.ontvanger) === "split") split += bedrag;
    else hoof += bedrag;
  });
  return { split, hoof };
}

function bo_som() {
  const u = fs_bereken(bo_invoer());
  const skenking = (Number(V.skenking_sent) || 0) / 100;
  const betaal = u.P + skenking;

  // Paystack hef op die VOLLE transaksie. Die verskil tussen die fooi op die
  // faktuur alleen en die fooi op alles, is wat die skenking self kos.
  const volleFooi =
    betaal > 0 ? Math.round(((FS_PS_PCT / 100) * betaal + FS_PS_VAS) * 100) / 100 : 0;
  const skenkingFooi = Math.round((volleFooi - u.paystack) * 100) / 100;

  const oorskot = Math.round((u.oorskot + skenking - skenkingFooi) * 100) / 100;
  const bg = bo_begroting();

  return {
    u,
    betaal,
    fooi: volleFooi,
    skenking,
    skenkingBly: Math.round((skenking - skenkingFooi) * 100) / 100,
    oorskot,
    begroot: bg,
    bly: Math.round((oorskot - bg.hoof) * 100) / 100,
  };
}

/* ═══ teken ═══ */

// Die twee lyste kry NIE dieselfde keuses nie.
//
//   die BEGROTING  — Future Sharp hoort daar. 'n Koste kan deur die
//                    hoofrekening betaal word; dit is die hele punt van die
//                    drie paaie.
//   die VERDELING  — Future Sharp hoort NIE daar nie. Hy IS die
//                    hoofrekening. 'n Ry vir hom verminder die oorskot
//                    sonder om iemand te betaal: dit lyk soos 'n uitbetaling
//                    en is nie een nie. Sy deel is wat OORBLY nadat almal
//                    afgetrek is — presies dieselfde slaggat as die winkel
//                    se oorskot, waar 'n ry daarvoor beteken die deel word
//                    uitbetaal EN daar bly niks vir Paystack nie.
function bo_ontvanger_opsies(gekies, met_hoofrekening) {
  const uit = BEGUNSTIGDES.map(
    (b) => `<option ${b.naam === gekies ? "selected" : ""}>${ontsnap(b.naam)}</option>`
  );
  if (met_hoofrekening) {
    uit.push(
      `<option ${gekies === HOOFREKENING ? "selected" : ""}>${ontsnap(HOOFREKENING)}</option>`
    );
  } else if (gekies === HOOFREKENING) {
    // 'n Ou konsep kan so 'n ry dra. Hy word gewys sodat 'n mens sien wat
    // daar staan, nie stilweg na iemand anders verander nie.
    uit.unshift(`<option selected>${ontsnap(HOOFREKENING)}</option>`);
  }
  return uit.join("");
}

function bo_teken_begroting() {
  const plek = document.getElementById("bt-lys");
  if (!plek) return;

  plek.innerHTML = V.koste
    .map((k, ix) => {
      const pad = bo_pad(k.ontvanger);
      return `
      <div class="bt-ry" data-koste="${ix}">
        <div class="bt-boonste">
          <input data-veld="beskrywing" value="${ontsnap(k.beskrywing)}"
                 placeholder="${fv_t("bo_beskrywing", "Beskrywing")}">
          <select data-veld="ontvanger">${bo_ontvanger_opsies(k.ontvanger, true)}</select>
          <input class="n" data-veld="bedrag" inputmode="decimal"
                 value="${veld_sent(k.bedrag_sent)}" placeholder="0,00">
          <button type="button" class="bo-vee" title="${fv_t("bo_verwyder", "Verwyder")}">&times;</button>
        </div>
        <div class="bt-onderste">
          <span class="bt-pad ${pad}">${bo_pad_et(pad)}</span>
          <input data-veld="inskrywing" value="${ontsnap(k.inskrywing)}"
                 placeholder="${fv_t("bo_inskrywing_plek", "Inskrywing — bly by die faktuur, gaan nooit uit nie")}">
        </div>
      </div>`;
    })
    .join("");

  plek.querySelectorAll(".bt-ry").forEach((ry) => {
    const ix = Number(ry.getAttribute("data-koste"));

    // Die ontvanger verander die PAD, dus word die ry herteken. Dit is
    // veilig: 'n keuselys word nie onder 'n vinger herbou nie.
    ry.querySelector('[data-veld="ontvanger"]').addEventListener("change", (e) => {
      V.koste[ix].ontvanger = e.target.value;
      bo_teken();
      merk_vuil();
    });

    ry.querySelectorAll("input[data-veld]").forEach((el) => {
      el.addEventListener("input", () => {
        const veld = el.getAttribute("data-veld");
        if (veld === "bedrag") V.koste[ix].bedrag_sent = na_sent(el.value);
        else V.koste[ix][veld] = el.value;
        // NET die syfers word bygewerk terwyl iemand tik — herbou 'n mens
        // die ry, spring die wyser na die einde van die veld.
        if (veld === "bedrag") bo_teken_syfers();
        merk_vuil();
      });
    });

    ry.querySelector(".bo-vee").addEventListener("click", () => {
      V.koste.splice(ix, 1);
      bo_teken();
      merk_vuil();
    });
  });
}

function bo_teken_verdeling(S) {
  const plek = document.getElementById("vd-lys");
  if (!plek) return;

  // Die basis is wat ná Paystack oorbly. 'n Persentasie loop daarop, nooit
  // op die volle bedrag nie.
  const basis = S.u.perReel[0] ? S.u.perReel[0].basisSent / 100 : 0;

  plek.innerHTML = V.verdeling
    .map((v, ix) => {
      const rand =
        v.tipe === "pct" ? ((Number(v.waarde) || 0) / 100) * basis : (Number(v.waarde) || 0) / 100;
      const waarde = v.tipe === "pct" ? veld_getal(v.waarde) : veld_sent(v.waarde);
      // Paystack kan iemand sonder 'n subrekening nie betaal nie. Sonder
      // hierdie merkie lyk die ry soos elke ander een, en by uitreiking
      // misluk die verdeling — of erger, dit lyk of hy betaal is.
      const pad = bo_pad(v.ontvanger);
      const merk = pad === "split" ? "" :
        `<div class="vd-waarsku"><span class="bt-pad ${pad}">${bo_pad_et(pad)}</span></div>`;
      return `
      <div class="vd-ry" data-ry="${ix}">
        <select data-veld="ontvanger">${bo_ontvanger_opsies(v.ontvanger, false)}</select>
        <div class="vd-tipe">
          <button type="button" data-tipe="pct" class="${v.tipe === "pct" ? "aan" : ""}">%</button>
          <button type="button" data-tipe="vas" class="${v.tipe === "vas" ? "aan" : ""}">R</button>
        </div>
        <input class="n" data-veld="waarde" inputmode="decimal" value="${ontsnap(waarde)}"
               placeholder="${v.tipe === "pct" ? "0" : "0,00"}">
        <div class="uit">${rand_uit(rand)}</div>
        <button type="button" class="bo-vee" title="${fv_t("bo_verwyder", "Verwyder")}">&times;</button>
      </div>${merk}`;
    })
    .join("");

  plek.querySelectorAll(".vd-ry").forEach((ry) => {
    const ix = Number(ry.getAttribute("data-ry"));

    ry.querySelector("select").addEventListener("change", (e) => {
      V.verdeling[ix].ontvanger = e.target.value;
      bo_teken();
      merk_vuil();
    });

    ry.querySelectorAll(".vd-tipe button").forEach((b) => {
      b.addEventListener("click", () => {
        // 'n Persentasie en 'n bedrag is nie dieselfde getal nie. Skakel 'n
        // mens van 55% na R, is "55" nie R55 nie — die waarde word skoongevee
        // eerder as om stilweg 'n verkeerde bedrag te word.
        V.verdeling[ix].tipe = b.getAttribute("data-tipe");
        V.verdeling[ix].waarde = 0;
        bo_teken();
        merk_vuil();
      });
    });

    ry.querySelector('[data-veld="waarde"]').addEventListener("input", (e) => {
      const v = V.verdeling[ix];
      v.waarde = v.tipe === "pct" ? Number(String(e.target.value).replace(",", ".")) || 0 : na_sent(e.target.value);
      const X = bo_som();
      const b = X.u.perReel[0] ? X.u.perReel[0].basisSent / 100 : 0;
      const uit = ry.querySelector(".uit");
      if (uit) {
        uit.textContent = rand_uit(
          v.tipe === "pct" ? ((Number(v.waarde) || 0) / 100) * b : (Number(v.waarde) || 0) / 100
        );
      }
      bo_teken_somme(X);
      merk_vuil();
    });

    ry.querySelector(".bo-vee").addEventListener("click", () => {
      V.verdeling.splice(ix, 1);
      bo_teken();
      merk_vuil();
    });
  });
}

// Die som se getalle kom in RAND (fs_bereken werk so), nie in sent nie.
//
// Die formateerder leef in taal.js. Hier geld die PLATFORM se taal, dieselfde
// bron as t() wat elke etiket op hierdie skerm lees.
//
// "Die begroting bly Afrikaans" in die spesifikasie beteken sy skakel nie saam
// met die DOKUMENT nie — nie dat sy vasgespyker is. Sy is jou skerm. Spyker 'n
// mens die getalle vas terwyl die etiket op t() loop, lees daar "Invoice total
// R22 000,00": Engelse etiket, Afrikaanse getal.
function rand_uit(bedrag) {
  const sent = Math.round((Number(bedrag) || 0) * 100);
  return window.t_rand
    ? t_rand(sent, kry_huidige_taal())
    : "R" + (sent / 100).toFixed(2);
}

function bo_teken_somme(S) {
  const g = (id) => document.getElementById(id);
  const u = S.u;
  const stel = (id, waarde) => { const el = g(id); if (el) el.textContent = waarde; };

  stel("vd-fooi", "− " + rand_uit(u.paystack));
  stel("s-totaal", rand_uit(S.betaal));
  stel("s-fooi", "− " + rand_uit(S.fooi));
  stel("s-verdeelbaar", rand_uit(u.verdeelbaar));
  stel("s-uit", rand_uit(u.uitbetaal));
  stel("s-hosting", rand_uit(u.hosting));
  stel("s-skenking", rand_uit(S.skenkingBly));
  stel("s-oorskot", rand_uit(S.oorskot));
  stel("s-begroot", "− " + rand_uit(S.begroot.hoof));
  stel("s-bly", rand_uit(S.bly));

  const skenking_ry = g("s-skenking-ry");
  if (skenking_ry) skenking_ry.style.display = S.skenking > 0 ? "" : "none";

  // Die telling gaan oor MENSE, nie oor rye nie. Eugene met 'n kostery en 'n
  // persentasie is een ontvanger wat twee keer voorkom.
  const mense = new Set(u.ontvangers.map((o) => o.naam));
  stel(
    "s-aantal",
    mense.size === 1
      ? fv_t("bo_een_ontvanger", "1 ontvanger")
      : mense.size + " " + fv_t("bo_ontvangers", "ontvangers")
  );

  // Is die oorskot minder as wat uit die hoofrekening begroot is, faktureer
  // julle te min. Dan heet dit Tekort en dit word koraal.
  const tekort = S.bly < -0.004;
  const et = g("s-bly-et");
  if (et) {
    et.textContent = tekort
      ? fv_t("bo_tekort", "Tekort")
      : fv_t("bo_bly_oor", "Bly oor vir Future Sharp");
  }
  const bly = g("s-bly");
  if (bly) bly.classList.toggle("tekort", tekort);

  const tekort_blok = g("s-tekort");
  if (tekort_blok) {
    tekort_blok.innerHTML = tekort
      ? `<div class="bo-boodskap">${fv_t("bo_dek_nie", "Die faktuur dek nie die begrote koste nie.")}
         <button type="button" class="fv-teks-knop" id="s-dek">${fv_t("bo_verhoog", "Verhoog die prys tot dit dek")}</button></div>`
      : "";
    const dek = document.getElementById("s-dek");
    if (dek) dek.addEventListener("click", bo_dek_die_tekort);
  }

  // Die rye vra meer as wat die faktuur inbring. Dan kan Paystack se fooi nie
  // betaal word nie en die transaksie word geweier.
  const waarsku = g("s-waarsku");
  if (waarsku) {
    waarsku.innerHTML = u.oorbestee
      ? `<div class="bo-boodskap">${fv_t("bo_oorbestee", "Die verdeling oorskry die verdeelbare bedrag met")}
         ${rand_uit(Math.abs(u.oorskot))}. ${fv_t("bo_oorbestee_lei", "Paystack verwerp 'n verdeling wat nie binne die transaksie klop nie.")}</div>`
      : "";
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   VERHOOG DIE PRYS TOT DIT DEK

   'n Knoppie, nie iets wat vanself gebeur nie.

   DIT KAN NIE 'N SENTSTAP WEES NIE. Elke ekstra rand op die prys word
   grotendeels weer uitgedeel: by 70% aan die aanbieder, 5% Hosting en die
   fooi bly net sowat 21 sent van elke rand oor. 'n Tekort van R1 781 verg
   dus meer as R8 000 op die prys, en 'n stap van een sent op 'n slag kom
   nooit daar nie.

   Ons meet dus die HELLING — wat 'n verhoging van R100 werklik aan die
   oorskot doen — en spring. Daarna 'n paar sente om presies te land.

   PARTY TEKORTE IS ONOPLOSBAAR. By 95% plus 5% Hosting vat die persentasies
   alles wat bykom en 'n hoër prys help niks. Dan sê die skerm dit en laat
   die prys staan, in plaas van eindeloos op te stoot.
   ═══════════════════════════════════════════════════════════════════════ */
function bo_dek_die_tekort() {
  const r = V.reels[0];
  if (!r) return;

  const hoev = Number(r.hoeveelheid) || 1;
  const begin = r.prys_pp_sent;
  const bly_by = (sent) => { r.prys_pp_sent = sent; return bo_som().bly; };

  for (let i = 0; i < 30; i += 1) {
    const nou = bo_som().bly;
    if (nou >= 0) break;

    const stap = Math.round(10000 / hoev);          // R100 op die reël
    const huidig = r.prys_pp_sent;
    const proef = bly_by(huidig + stap);
    const helling = (proef - nou) / 100;             // oorskot per rand

    if (helling <= 0.0001) {
      r.prys_pp_sent = begin;
      bo_teken();
      const blok = document.getElementById("s-tekort");
      if (blok) {
        blok.innerHTML = `<div class="bo-boodskap">${fv_t(
          "bo_onoplosbaar",
          "'n Hoër prys help nie: die persentasies vat alles wat bykom. Verlaag 'n persentasie of skuif 'n koste."
        )}</div>`;
      }
      return;
    }

    const spring = Math.ceil((-nou / helling) * 100 / hoev);
    r.prys_pp_sent = huidig + spring;
  }

  // Fyn: stap op tot dit werklik dek, en nooit 'n sent onder nie.
  let wag = 0;
  while (bly_by(r.prys_pp_sent) < 0 && wag < 400) {
    r.prys_pp_sent += 1;
    wag += 1;
  }

  teken_reels();
  teken_somme();
  bo_teken();
  merk_vuil();
}

/* ═══ die twee toegangspunte wat faktuur-vorm.js gebruik ═══ */

// Alles herbou. Word geroep wanneer 'n ry bykom, weggaan of van pad
// verander — nooit terwyl iemand tik nie.
function bo_vul_velde() {
  const stel = (id, waarde) => {
    const el = document.getElementById(id);
    // Nooit die veld waarin iemand tik nie — dan spring die wyser.
    if (el && el !== document.activeElement) el.value = waarde;
  };
  stel("f-afslag", veld_sent(V.afslag_sent));
  stel("f-skenking", veld_sent(V.skenking_sent));
  stel("f-hosting", String(V.hosting_pct));
  stel("f-koepon", V.koepon_kode || "");
}

function bo_teken() {
  const S = bo_som();
  bo_vul_velde();
  bo_teken_begroting();
  bo_teken_verdeling(S);
  bo_teken_somme(S);
}

// Net die syfers. Dit is wat loop terwyl iemand 'n bedrag tik.
function bo_teken_syfers() {
  bo_teken_somme(bo_som());
}

window.bo_teken = bo_teken;
window.bo_teken_syfers = bo_teken_syfers;

/* ═══ begin ═══ */
document.addEventListener("DOMContentLoaded", () => {
  // Die vier velde onderaan word een keer gevul en nooit herbou nie, dus kan
  // die wyser nie spring nie.
  const bind = (id, skryf) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      skryf(el.value);
      bo_teken_syfers();
      teken_somme();     // die afslag en die skenking staan OP die dokument
      merk_vuil();
    });
  };

  bind("f-afslag", (w) => { V.afslag_sent = na_sent(w); });
  bind("f-skenking", (w) => { V.skenking_sent = na_sent(w); });
  bind("f-hosting", (w) => {
    const pct = Number(String(w).replace(",", "."));
    V.hosting_pct = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  });
  bind("f-koepon", (w) => { V.koepon_kode = w.trim().toUpperCase() || null; });

  const voeg_koste = document.getElementById("bt-voeg");
  if (voeg_koste) {
    voeg_koste.addEventListener("click", () => {
      V.koste.push({ beskrywing: "", ontvanger: HOOFREKENING, bedrag_sent: 0, inskrywing: "" });
      bo_teken();
      merk_vuil();
    });
  }

  const voeg_ry = document.getElementById("vd-voeg");
  if (voeg_ry) {
    voeg_ry.addEventListener("click", () => {
      // Kies iemand wat werklik betaal kan word; anders die eerste op die
      // lys, met sy merkie wat sê wat kort.
      const eerste =
        BEGUNSTIGDES.find((b) => (b.subrekening_kode || "").trim()) || BEGUNSTIGDES[0];
      if (!eerste) return;
      V.verdeling.push({ ontvanger: eerste.naam, tipe: "vas", waarde: 0 });
      bo_teken();
      merk_vuil();
    });
  }
});

// Die begunstigdes kom NÁ die sessie. faktuur-vorm.js se DOMContentLoaded
// loop eerste en stel SESSIE; hierdie een wag daarop sonder om die bladsy op
// te hou. Misluk die lees, verskyn die backoffice met 'n leë keuselys in
// plaas van 'n stukkende skerm — presies soos die outeur-lees in
// kry-begunstigdes.js.
(async function bo_laai_begunstigdes() {
  // LET WEL: SESSIE is 'n `let` in faktuur-vorm.js. Dit leef in die
  // script-skoop wat alle skrifte deel, maar dit verskyn NIE op window nie —
  // `window.SESSIE` is altyd undefined. Die bare naam is die regte een.
  for (let i = 0; i < 40 && !SESSIE; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!SESSIE) return;

  try {
    const resp = await fetch("/.netlify/functions/kry-begunstigdes", {
      headers: { Authorization: `Bearer ${SESSIE.access_token}` },
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    BEGUNSTIGDES = data.begunstigdes || [];
  } catch (fout) {
    console.error("Kon nie die begunstigdes laai nie:", fout);
    BEGUNSTIGDES = [];
  }

  bo_teken();
})();
