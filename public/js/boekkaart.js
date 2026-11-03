// public/js/boekkaart.js
//
// Die nuwe boekkaart (November 2026) en die hulpfunksies vir afdelings,
// gedeel deur die Boeke-bladsy (boeke.js) en die tuisblad se "Nuut op die
// rak" (tuis-rak.js). Sien "Winkelfront-Herontwerp-November-2026".
//
// Die kaart is doelbewus kalm: omslag op 'n roomkleurige vlak, 'n klein
// lyntjie (afdeling en boeknommer, of die skrywer), die titel, en prys en
// formaat. Die formaat is 'n .beskikbaar-merker-knoppie, dus maak
// formaat-info.js steeds die venster "Hoe kry en lees ek 'n e-boek?" oop.
//
// Vereis taal.js (t, kry_huidige_taal) en, vir besit, identiteit.js.

const BK_KATALOGUS = "/.netlify/functions/kry-katalogus";
const BK_AFDELINGS = "/.netlify/functions/kry-afdelings";

// 'n Veilige anker vir 'n ry, bv. "SPEEL-SLIM FOKUS" -> "speel-slim-fokus".
function bk_anker(kode) {
  return String(kode || "ander").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ander";
}

function bk_esc(w) {
  return String(w == null ? "" : w)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function bk_taal() {
  return typeof kry_huidige_taal === "function" ? kry_huidige_taal() : "af";
}

// "Speel-Slim Fokus: Eerste Blik" -> "Eerste Blik". Die afdeling se naam
// staan reeds in die lyntjie bo die titel en in die ry se opskrif.
function bk_kort_titel(p) {
  const titel = String(p.titel || "");
  const pas = titel.match(/^([^:]{2,40}):\s+(.+)$/);
  return pas ? pas[2] : titel;
}

function bk_rand(sent) {
  const r = Math.round((sent || 0) / 100);
  return "R" + String(r).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function bk_is_toekoms(datum) {
  if (!datum) return false;
  const d = new Date(datum);
  return !isNaN(d) && d > new Date();
}

// --- Afdelings ------------------------------------------------------------

// Die reekskode van 'n boek: sy eie, of sy eweknie s'n. volgorde is die
// boek se NOMMER in die reeks ("Boek 3"), nie sy plek op die rak nie.
function bk_reeks(p, per_slug) {
  let kode = p.reeks && p.reeks.reeks_slug;
  let volgorde = p.reeks && p.reeks.volgorde_in_reeks;
  if (!kode && p.eweknie_slug && per_slug) {
    const e = per_slug.get(p.eweknie_slug);
    if (e && e.reeks && e.reeks.reeks_slug) {
      kode = e.reeks.reeks_slug;
      volgorde = volgorde || e.reeks.volgorde_in_reeks;
    }
  }
  return { kode: kode ? kode.trim().toUpperCase() : "", volgorde: Number(volgorde) || null };
}

// LIDMAATSKAP (November 2026): in die paneel kan personeel elke ry se boeke
// en hul volgorde kies (afdeling.boeke). Hierdie kaart sê vir elke slug in
// watter ry hy staan en op watter plek. 'n Eweknie kry dieselfde plek.
// Twee rondtes: eers die boeke wat self in 'n lys staan, dan hul eweknieë
// in die ANDER taal. 'n Eweknie in dieselfde taal ('n Ma se Reis en 'n Pa se
// Reis) is 'n aparte boek met sy eie plek.
function bk_lidmaatskap(afdelings, per_slug) {
  const kaart = new Map();
  const lyste = (afdelings || []).map((a) => ({ kode: a.kode, boeke: a.boeke || [] }));
  lyste.forEach((a) => a.boeke.forEach((slug, i) => {
    if (!kaart.has(slug)) kaart.set(slug, { kode: a.kode, posisie: i + 1 });
  }));
  lyste.forEach((a) => a.boeke.forEach((slug, i) => {
    const p = per_slug && per_slug.get(slug);
    const e = p && p.eweknie_slug && per_slug.get(p.eweknie_slug);
    if (e && e.taal !== p.taal && !kaart.has(e.slug)) kaart.set(e.slug, { kode: a.kode, posisie: i + 1 });
  }));
  return kaart;
}

// Die ry en plek van 'n boek: eers die paneel se keuse, dan sy reeks.
function bk_kode(p, per_slug, lidmaatskap) {
  const reeks = bk_reeks(p, per_slug);
  const lid = lidmaatskap && lidmaatskap.get(p.slug);
  if (lid) return { kode: lid.kode, volgorde: reeks.volgorde, posisie: lid.posisie };
  return { kode: reeks.kode, volgorde: reeks.volgorde, posisie: null };
}

function bk_afdeling_naam(kode, afdelings_per_kode, voorbeeld) {
  const en = bk_taal() === "en";
  const a = afdelings_per_kode && afdelings_per_kode.get(kode);
  if (a) {
    const naam = en ? (a.naam_en || a.naam_af) : (a.naam_af || a.naam_en);
    if (naam) return naam;
  }
  // Terugval: die deel voor die dubbelpunt in 'n boek se titel, anders die kode.
  const pas = voorbeeld && String(voorbeeld.titel || "").match(/^([^:]{2,40}):\s+/);
  if (pas) return pas[1].trim();
  return kode.charAt(0) + kode.slice(1).toLowerCase();
}

// Watter boeke wys in die huidige taal: die boeke in hierdie taal, plus
// boeke wat net in die ander taal bestaan (sonder 'n eweknie hier).
// LET WEL: 'n eweknie tel net as hy in die HUIDIGE taal is. 'n Ma se Reis en
// 'n Pa se Reis is eweknieë van mekaar, maar albei Afrikaans; in Engels moet
// albei steeds wys, want daar is geen Engelse uitgawe nie.
function bk_in_taal(produkte, keuse) {
  if (keuse === "albei") return produkte.slice();
  const taal = keuse === "af" || keuse === "en" ? keuse : bk_taal();
  const per_slug = new Map(produkte.map((p) => [p.slug, p]));
  return produkte.filter((p) => {
    if (!p.taal || p.taal === taal) return true;
    const e = p.eweknie_slug && per_slug.get(p.eweknie_slug);
    return !(e && e.taal === taal);
  });
}

// --- Besit -----------------------------------------------------------------

async function bk_kry_besit() {
  try {
    if (typeof identiteit_kry_huidige_sessie !== "function") return new Set();
    const sessie = await identiteit_kry_huidige_sessie();
    if (!sessie || !sessie.access_token) return new Set();
    const r = await fetch("/.netlify/functions/kry-my-boeke", { headers: { Authorization: `Bearer ${sessie.access_token}` } });
    if (!r.ok) return new Set();
    const d = await r.json();
    return new Set((d.boeke || []).filter((b) => !b.is_leen).map((b) => b.produk_slug));
  } catch {
    return new Set();
  }
}

async function bk_laai_alles() {
  const [kat, afd, besit] = await Promise.all([
    fetch(BK_KATALOGUS).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(BK_AFDELINGS).then((r) => (r.ok ? r.json() : { afdelings: [] })).catch(() => ({ afdelings: [] })),
    bk_kry_besit(),
  ]);
  const produkte = kat.produkte || [];
  return {
    produkte,
    per_slug: new Map(produkte.map((p) => [p.slug, p])),
    afdelings_per_kode: new Map((afd.afdelings || []).map((a) => [a.kode, a])),
    afdelings: afd.afdelings || [],
    lidmaatskap: bk_lidmaatskap(afd.afdelings || [], new Map(produkte.map((p) => [p.slug, p]))),
    besit,
  };
}

// --- Die kaart --------------------------------------------------------------

function bk_formate(p) {
  const f = p.formate || {};
  const lys = [];
  if (f.eboek && f.eboek.beskikbaar) lys.push({ sleutel: "eboek", teks: t("eboek_etiket"), prys: f.eboek.prys_sent });
  if (f.harde_kopie && f.harde_kopie.beskikbaar) lys.push({ sleutel: "harde_kopie", teks: t("hardekopie_etiket"), prys: f.harde_kopie.prys_sent });
  if (f.leen && f.leen.beskikbaar) lys.push({ sleutel: "leen", teks: t("leen_etiket"), prys: f.leen.prys_sent, tydperk: f.leen.tydperk_dae || 30 });
  return lys;
}

function bk_etiket(p) {
  if (!p.etiket) return "";
  const taal = p.taal === "af" || p.taal === "en" ? p.taal : bk_taal();
  const teks = taal === "en"
    ? (p.etiket.teks_en || p.etiket.teks_af || p.etiket.teks || "")
    : (p.etiket.teks_af || p.etiket.teks_en || p.etiket.teks || "");
  if (!teks) return "";
  return `<span class="bk-etiket bk-etiket--${bk_esc(p.etiket.kleur || "amber")}">${bk_esc(teks)}</span>`;
}

// konteks: { per_slug, afdelings_per_kode, besit }
function bk_kaart(p, konteks) {
  const { per_slug, afdelings_per_kode, besit, lidmaatskap } = konteks;
  const skakel = `produk.html?produk=${encodeURIComponent(p.slug)}`;
  const { kode, volgorde } = bk_kode(p, per_slug, lidmaatskap);

  let lyn;
  if (kode) {
    const naam = bk_afdeling_naam(kode, afdelings_per_kode, p);
    lyn = volgorde ? `${naam} · ${t("bk_boek")} ${volgorde}` : naam;
  } else {
    lyn = p.outeur || "";
  }

  const taal = bk_taal();
  let taal_nota = "";
  let taal_skakel = "";
  if (p.taal && p.taal !== taal) {
    taal_nota = t(p.taal === "en" ? "bk_in_engels" : "bk_in_afrikaans");
  } else if (p.eweknie_slug && per_slug && per_slug.has(p.eweknie_slug)) {
    const e = per_slug.get(p.eweknie_slug);
    if (e.taal && e.taal !== taal) {
      taal_nota = t(e.taal === "en" ? "bk_ook_in_engels" : "bk_ook_in_afrikaans");
      taal_skakel = `produk.html?produk=${encodeURIComponent(e.slug)}`;
    }
  }

  const formate = bk_formate(p);
  const pryse = formate.map((f) => f.prys).filter((x) => x > 0);
  const laagste = pryse.length ? Math.min(...pryse) : 0;
  const verskil = new Set(pryse).size > 1;
  const voorbestel = p.formate && p.formate.eboek && p.formate.eboek.beskikbaar && bk_is_toekoms(p.formate.eboek.vrystelling_datum);

  const formaat_knoppies = formate
    .map((f) => `<button type="button" class="beskikbaar-merker bk-formaat" data-formaat="${f.sleutel}"${f.tydperk ? ` data-tydperk="${f.tydperk}"` : ""}>${bk_esc(f.teks)}</button>`)
    .join('<span class="bk-skeier">·</span>');

  const besit_dit = besit instanceof Set && besit.has(p.slug);
  const onder = besit_dit
    ? `<p class="bk-onder"><span class="bk-gekoop">${t("reeds_gekoop")}</span><a class="bk-lees" href="/leser.html?boek=${encodeURIComponent(p.slug)}">${t("bk_lees_nou")} →</a></p>`
    : `<p class="bk-onder"><span class="bk-prys">${laagste ? (verskil ? t("vanaf_prys") + " " : "") + bk_rand(laagste) : ""}</span>${formaat_knoppies ? `<span class="bk-skeier">·</span>${formaat_knoppies}` : ""}</p>`;

  const omslag = p.omslag
    ? `<img class="bk-omslag" src="${bk_esc(p.omslag)}" alt="${bk_esc(p.titel)}" loading="lazy">`
    : `<span class="bk-omslag bk-omslag--leeg" aria-hidden="true"></span>`;

  return `
    <article class="bk">
      <a class="bk-vlak" href="${skakel}" aria-label="${bk_esc(p.titel)}">${omslag}${bk_etiket(p)}${voorbestel ? `<span class="bk-voorbestel">${t("voorbestelling_chip")}</span>` : ""}</a>
      <p class="bk-lyn">${bk_esc(lyn)}</p>
      <h3 class="bk-titel"><a href="${skakel}">${bk_esc(bk_kort_titel(p))}</a></h3>
      ${onder}
      ${taal_nota ? `<p class="bk-taal">${taal_skakel ? `<a href="${taal_skakel}">${bk_esc(taal_nota)} →</a>` : bk_esc(taal_nota)}</p>` : ""}
    </article>`;
}

// --- Die rye ---------------------------------------------------------------
// Gedeel deur die Boeke-bladsy en die paneel se "Rye op die Boeke-bladsy".
// Volgorde van die rye: die paneel se volgorde (plek), dan reekse sonder 'n
// plek, en "Ander boeke" altyd laaste (kode ""). Binne 'n ry: die paneel se
// volgorde, dan die reeksnommer, dan die titel.
function bk_bou_rye(produkte, konteks) {
  const { per_slug, afdelings_per_kode, lidmaatskap } = konteks;
  const groepe = new Map();
  for (const p of produkte) {
    const { kode, volgorde, posisie } = bk_kode(p, per_slug, lidmaatskap);
    if (!groepe.has(kode)) groepe.set(kode, []);
    groepe.get(kode).push({ p, volgorde, posisie });
  }
  const en = bk_taal() === "en";
  const taal_nou = bk_taal();
  const rye = [...groepe.entries()].map(([kode, boeke]) => {
    boeke.sort((a, b) => (a.posisie || 9999) - (b.posisie || 9999)
      || (a.volgorde || 999) - (b.volgorde || 999)
      // Met albei tale sigbaar: die uitgawe in die winkel se taal eerste.
      || (a.p.taal === taal_nou ? 0 : 1) - (b.p.taal === taal_nou ? 0 : 1)
      || String(a.p.titel).localeCompare(String(b.p.titel), "af", { numeric: true }));
    const meta = afdelings_per_kode.get(kode);
    return {
      kode,
      naam: kode ? bk_afdeling_naam(kode, afdelings_per_kode, boeke[0].p) : t("bk_ander_boeke"),
      beskrywing: meta ? (en ? (meta.beskrywing_en || meta.beskrywing_af) : (meta.beskrywing_af || meta.beskrywing_en)) : "",
      plek: kode ? ((meta && meta.plek) || 500) : 10000,
      boeke: boeke.map((b) => b.p),
    };
  });
  rye.sort((a, b) => a.plek - b.plek || b.boeke.length - a.boeke.length || a.naam.localeCompare(b.naam, "af"));
  return rye;
}
