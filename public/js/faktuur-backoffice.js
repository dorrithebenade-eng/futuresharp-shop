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

// ALBEI LYSTE KRY FUTURE SHARP (25 Augustus 2026).
//
// Tot hier is Future Sharp uit die VERDELING gehou, op grond daarvan dat 'n
// ry vir hom soos 'n uitbetaling lyk terwyl dit nie een is nie. Die vrees was
// die winkel se slaggat: 'n ry vir die oorskot beteken die deel word uitbetaal
// EN daar bly niks vir Paystack nie.
//
// Die vrees is ongegrond, en die som keer dit self. fs_bereken() hou 'n lys
// FS_BLY_IN_HOOFREKENING met "Hosting" en "Future Sharp" daarin: so 'n ry tel
// wel by die TOEGEKENDE bedrag — dus krimp die reël se oorskot — maar dit word
// nooit 'n ontvanger nie en beland nooit in 'n Paystack-verdeling nie.
// bo_pad() gee boonop "hoof" vir Future Sharp, dus is daar geen subrekening om
// heen te betaal nie.
//
// Wat dit koop, is 'n verdeling wat volledig LEES. 'n Reël met Eugene 70%,
// Hosting 5% en Future Sharp 25% wys waar elke rand heen gaan; sonder daardie
// derde ry moet 'n mens die oorskot self aflei.
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
          <input data-veld="beskrywing" list="bo-items" value="${ontsnap(k.beskrywing)}"
                 placeholder="${fv_t("bo_beskrywing", "Beskrywing")}">
          <select data-veld="ontvanger">${bo_ontvanger_opsies(k.ontvanger, true)}</select>
          <input class="n" data-veld="bedrag" inputmode="decimal"
                 value="${veld_sent(k.bedrag_sent)}" placeholder="0.00">
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

/* ═══════════════════════════════════════════════════════════════════════
   DIE VERDELING — 'N BLOK PER REEL

   Tot 25 Augustus 2026 was dit EEN plat lys: V.verdeling[ix], met
   perReel[0] as die enigste basis. 'n Faktuur met 'n aanbieding, 'n
   vraelys en 'n verslag — elk met sy eie ontvangers — kon nie bestaan
   nie. Sien Verdeling-Per-Lynitem-Ontwerp.md.

   DIE REELS EN DIE VERDELING IS EEN LYS. Wat hier geteken word, is
   V.reels — dieselfde lys as die dokument links. Tik iemand 'n reël by,
   kom die reël dadelik hier; skrap hy een, gaan die verdeling saam.

   DRIE TOESTANDE PER REEL, en die onderskeid tussen die tweede en die
   derde is die belangrikste ding in hierdie blok:

     reg       — die reël dek homself
     gedra     — amber. Die reël kort iets en die ander reëls dra dit.
                 Dit WERK; die split geld oor die hele faktuur.
     stukkend  — koraal. Kan nooit reg wees nie; die uitreiking keer.

   'N VASTE BEDRAG WAT DIE REEL OORSKRY IS NIE STUKKEND NIE. Dit is in
   die mockup getoets: 'n opgeloste reiskoste het met VYF SENT oorgeskiet
   en is as 'n fout gemerk. 'n Stop oor vyf sent is presies hoe 'n mens
   leer om stops te ignoreer. Net twee dinge is werklik stukkend:
   persentasies wat saam bo 100% optel, en 'n kostereël sonder iemand om
   aan terug te betaal.
   ═══════════════════════════════════════════════════════════════════════ */

// Wat 'n reël se ontvangers saam vra, en of dit reg is.
function bo_reel_toestand(reel, per) {
  const rye = (reel && reel.verdeling) || [];
  const pct = rye.reduce((s, v) => s + (v.tipe === "pct" ? Number(v.waarde) || 0 : 0), 0);
  const koste = reel.soort === "koste";
  const basis = per ? per.basisSent : 0;
  const toegeken = per ? per.toegekenSent : 0;

  const geen_ontvanger =
    koste && !rye.some((v) => String(v.ontvanger || "").trim());

  return {
    koste,
    pct,
    basis,
    oorskot: basis - toegeken,
    stukkend: pct > 100 || geen_ontvanger,
    geen_ontvanger,
    te_veel_pct: pct > 100,
  };
}

function bo_teken_verdeling(S) {
  const plek = document.getElementById("vd-lys");
  if (!plek) return;

  const konsep = V.stand === "konsep";

  plek.innerHTML = V.reels
    .map((r, rx) => {
      const per = S.u.perReel[rx];
      const t = bo_reel_toestand(r, per);
      const basis = t.basis / 100;

      // 'N LEE RY VERSKYN NIE OP 'N UITGEREIKTE FAKTUUR NIE. Terwyl 'n mens
      // werk, is 'n leë ry reg: jy voeg hom by en vul hom daarna. Maar 'n
      // uitgereikte faktuur is 'n REKORD, en die vries in stuur-faktuur.js
      // laat sulke rye in elk geval uit — die skerm wys dus wat gevries is.
      const rye = (r.verdeling || [])
        .map((v, ix) => {
          if (!konsep && !String(v.ontvanger || "").trim() && !(Number(v.waarde) > 0)) return "";
          const rand =
            v.tipe === "pct"
              ? ((Number(v.waarde) || 0) / 100) * basis
              : (Number(v.waarde) || 0) / 100;
          const waarde = v.tipe === "pct" ? veld_getal(v.waarde) : veld_sent(v.waarde);

          // Paystack kan iemand sonder 'n subrekening nie betaal nie. Sonder
          // hierdie merkie lyk die ry soos elke ander een, en by uitreiking
          // misluk die verdeling — of erger, dit lyk of hy betaal is.
          const pad = bo_pad(v.ontvanger);
          const merk =
            pad === "split"
              ? ""
              : `<div class="vd-waarsku"><span class="bt-pad ${pad}">${bo_pad_et(pad)}</span></div>`;

          return `
          <div class="vd-ry" data-reel="${rx}" data-ry="${ix}">
            <select data-veld="ontvanger">${bo_ontvanger_opsies(v.ontvanger, true)}</select>
            <div class="vd-tipe">
              <button type="button" data-tipe="pct" class="${v.tipe === "pct" ? "aan" : ""}">%</button>
              <button type="button" data-tipe="vas" class="${v.tipe === "vas" ? "aan" : ""}">R</button>
            </div>
            <input class="n" data-veld="waarde" inputmode="decimal" value="${ontsnap(waarde)}"
                   placeholder="${v.tipe === "pct" ? "0" : "0.00"}">
            <div class="uit">${rand_uit(rand)}</div>
            <button type="button" class="bo-vee" title="${fv_t("bo_verwyder", "Verwyder")}">&times;</button>
          </div>${merk}`;
        })
        .join("");

      const naam = ontsnap(r.beskrywing || fv_t("bo_reel_naamloos", "Naamloos"));
      const isk = r.soort === "koste";

      // Die somreël onderaan elke reël. 'n Kostereël wys niks: sy dra geen
      // hosting en het geen oorskot — die ontvanger kry die volle bedrag.
      const som = isk
        ? `<div class="vd-som">${fv_t(
            "bo_koste_reel",
            "Geen hosting — die ontvanger kry die volle bedrag terug."
          )}</div>`
        : `<div class="vd-som">
             <span>${fv_t("bo_hosting_kort", "Hosting")}
               <input class="n vd-host" data-reel="${rx}" data-veld="hosting"
                      inputmode="decimal" value="${ontsnap(veld_getal(r.hosting_pct))}">%</span>
             <span>${fv_t("bo_oorskot_kort", "Oorskot")}
               <strong class="${t.oorskot < 0 ? "kort" : t.oorskot > 0 ? "oor" : ""}">${rand_uit(
                 t.oorskot / 100
               )}</strong></span>
           </div>`;

      let band = "";
      if (t.stukkend) {
        band = `<div class="vd-band stop">${
          t.geen_ontvanger
            ? fv_t(
                "bo_koste_sonder_ontvanger",
                "'n Uitgawe moet iemand hê om aan terug te betaal. Kies 'n ontvanger, of maak die reël 'n inkomste."
              )
            : fv_t("bo_pct_bo_honderd", "Die persentasies tel op tot ") + t.pct + "%."
        }</div>`;
      } else if (t.oorskot < 0) {
        band = `<div class="vd-band">${fv_t(
          "bo_reel_gedra",
          "Hierdie reël kort "
        )}${rand_uit(-t.oorskot / 100)}${fv_t(
          "bo_reel_gedra_end",
          ". Die ander reëls dra dit."
        )}</div>`;
      }

      return `
      <div class="vd-reel" data-reel="${rx}">
        <div class="vd-reel-kop">
          <span class="vd-nr">${rx + 1}</span>
          <span class="vd-naam">${naam}</span>
          <div class="vd-soort">
            <button type="button" data-soort="verkoop" class="${isk ? "" : "aan"}">${fv_t(
              "bo_soort_inkomste",
              "Inkomste"
            )}</button>
            <button type="button" data-soort="koste" class="${isk ? "aan" : ""}">${fv_t(
              "bo_soort_uitgawe",
              "Uitgawe"
            )}</button>
          </div>
          <span class="vd-bedrag">${rand_uit(
            Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0)) / 100
          )}</span>
        </div>
        ${rye}
        <button type="button" class="vd-voeg" data-reel="${rx}">${fv_t(
          "bo_voeg_ontvanger",
          "+ Voeg 'n ontvanger by"
        )}</button>
        ${som}
        ${band}
      </div>`;
    })
    .join("");

  /* ═══ die hanteerders ═══
     TWEE INDEKSE, NIE EEN NIE. `data-reel` sê watter reël, `data-ry` watter
     ry binne daardie reël. Albei is die indeks in die VOLLE lys — filter 'n
     mens eers en nommer dan, wys 'n klik op die derde sigbare ry na 'n ander
     inskrywing. */

  plek.querySelectorAll(".vd-ry").forEach((ry) => {
    const rx = Number(ry.getAttribute("data-reel"));
    const ix = Number(ry.getAttribute("data-ry"));
    const lys = () => V.reels[rx].verdeling;

    ry.querySelector("select").addEventListener("change", (e) => {
      lys()[ix].ontvanger = e.target.value;
      bo_teken();
      merk_vuil();
    });

    ry.querySelectorAll(".vd-tipe button").forEach((b) => {
      b.addEventListener("click", () => {
        // 'n Persentasie en 'n bedrag is nie dieselfde getal nie. Skakel 'n
        // mens van 55% na R, is "55" nie R55 nie — die waarde word skoongevee
        // eerder as om stilweg 'n verkeerde bedrag te word.
        lys()[ix].tipe = b.getAttribute("data-tipe");
        lys()[ix].waarde = 0;
        bo_teken();
        merk_vuil();
      });
    });

    ry.querySelector('[data-veld="waarde"]').addEventListener("input", (e) => {
      const v = lys()[ix];
      v.waarde =
        v.tipe === "pct"
          ? Number(String(e.target.value).replace(",", ".")) || 0
          : na_sent(e.target.value);

      // NET die syfers word bygewerk terwyl iemand tik — herbou 'n mens die
      // ry, spring die wyser na die einde van die veld.
      const X = bo_som();
      const b = X.u.perReel[rx] ? X.u.perReel[rx].basisSent / 100 : 0;
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
      lys().splice(ix, 1);
      bo_teken();
      merk_vuil();
    });
  });

  plek.querySelectorAll(".vd-voeg").forEach((knop) => {
    knop.addEventListener("click", () => {
      const rx = Number(knop.getAttribute("data-reel"));
      if (!Array.isArray(V.reels[rx].verdeling)) V.reels[rx].verdeling = [];

      // DIE RY BEGIN MET 'N WERKLIKE ONTVANGER, nie met 'n lee naam nie.
      //
      // 'n Keuselys wys sy eerste opsie sodra hy verskyn, maar `change` vuur
      // eers wanneer iemand iets ANDERS kies. 'n Ry wat met "" begin, wys dus
      // 'n naam op die skerm terwyl V nog niks dra -- en dan sê die koraalband
      // dat 'n uitgawe geen ontvanger het nie terwyl daar duidelik een staan.
      //
      // Kies iemand wat werklik betaal kan word; anders die eerste op die lys,
      // met sy merkie wat sê wat kort.
      const eerste =
        BEGUNSTIGDES.find((b) => (b.subrekening_kode || "").trim()) || BEGUNSTIGDES[0];
      V.reels[rx].verdeling.push({
        ontvanger: eerste ? eerste.naam : "",
        tipe: "pct",
        waarde: 0,
      });
      bo_teken();
      merk_vuil();
    });
  });

  plek.querySelectorAll(".vd-soort button").forEach((knop) => {
    knop.addEventListener("click", () => {
      const rx = Number(knop.closest(".vd-reel").getAttribute("data-reel"));
      const soort = knop.getAttribute("data-soort");
      if (V.reels[rx].soort === soort) return;
      V.reels[rx].soort = soort;
      // 'n Kostereël dra nooit hosting nie: trek 'n mens hosting van 'n
      // terugbetaling af, kry die persoon minder terug as wat hy uitgegee het.
      if (soort === "koste") V.reels[rx].hosting_pct = 0;
      bo_teken();
      merk_vuil();
    });
  });

  plek.querySelectorAll(".vd-host").forEach((el) => {
    el.addEventListener("input", () => {
      const rx = Number(el.getAttribute("data-reel"));
      const getal = Number(String(el.value).replace(",", "."));
      V.reels[rx].hosting_pct = Number.isFinite(getal)
        ? Math.min(100, Math.max(0, getal))
        : 0;
      bo_teken_somme(bo_som());
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

  // TWEE TOETSE, TWEE OORSAKE, EN HULLE MAG NIE SAAM VUUR NIE.
  //
  // `oorbestee` beteken die verdelingsrye vra meer as wat verdeelbaar is.
  // `tekort` beteken die oorskot dek nie wat uit die hoofrekening begroot is
  // nie. Wanneer die rye oorbestee, word die oorskot OOK negatief — en dan het
  // albei boodskappe gevuur, waarvan die tweede 'n oorsaak noem wat nie
  // bestaan nie: "die faktuur dek nie die begrote koste nie" terwyl die
  // begroting op R0,00 staan.
  //
  // Die oorbestee-boodskap is die werklike oorsaak en sy praat alleen.
  const tekort_blok = g("s-tekort");
  if (tekort_blok) {
    tekort_blok.innerHTML = tekort && !u.oorbestee
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
  stel("f-koepon", V.koepon_kode || "");
  // GEEN f-hosting MEER NIE. Hosting leef op elke reël, in die verdelingsblok.
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

  // DIE NAAM EN DIE BEDRAG PER REEL WORD SAAM BYGEWERK.
  //
  // Verander 'n mens 'n reel se beskrywing in die dokument links, loop net
  // hierdie funksie -- bo_teken() sou die hele verdelingsblok herbou en die
  // wyser uit die veld ruk waarin iemand tik. Sonder hierdie stukkie het die
  // verdeling steeds die OU naam gedra: 'n mens hernoem "Reiskoste" na
  // "Pamflette" en regs staan Reiskoste nog.
  //
  // Net die TEKS word aangeraak, nooit die struktuur nie, dus is daar niks om
  // te herbind nie.
  V.reels.forEach((r, rx) => {
    const blok = document.querySelector(`.vd-reel[data-reel="${rx}"]`);
    if (!blok) return;

    const naam = blok.querySelector(".vd-naam");
    if (naam) naam.textContent = r.beskrywing || fv_t("bo_reel_naamloos", "Naamloos");

    const bedrag = blok.querySelector(".vd-bedrag");
    if (bedrag) {
      bedrag.textContent = rand_uit(
        Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0)) / 100
      );
    }
  });
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
  bind("f-koepon", (w) => { V.koepon_kode = w.trim().toUpperCase() || null; });

  const voeg_koste = document.getElementById("bt-voeg");
  if (voeg_koste) {
    voeg_koste.addEventListener("click", () => {
      V.koste.push({ beskrywing: "", ontvanger: HOOFREKENING, bedrag_sent: 0, inskrywing: "" });
      bo_teken();
      merk_vuil();
    });
  }

  // GEEN ENKELE "voeg 'n ry by" MEER NIE. Elke reël het sy eie knoppie in
  // die verdelingsblok — 'n ry moet weet aan WATTER reël hy hang.
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
