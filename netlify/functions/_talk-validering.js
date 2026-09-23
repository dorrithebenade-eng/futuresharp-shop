// FutureSharp Talks — bou en valideer 'n talk-rekord uit die vorm se invoer.
// Gedeel deur skep-talk.js en wysig-talk.js, sodat die twee nooit van
// mekaar kan verskil nie.
//
// WAAROM 'N EIE STORE ("talks") EN NIE DIE KATALOGUS NIE
//
// Negentien Functions en 'n handvol kliëntlêers lees die "katalogus"-store,
// en baie van hulle neem aan dat elke produk 'n e-boek het
// (formate.eboek). 'n Talk in daardie store sou die winkelfront, die
// paneelbord se produklys, My Boeke en die statistiek elkeen op sy eie
// manier laat struikel. In 'n eie store raak 'n talk niks van die boeke nie.
// Die struktuur volg nietemin die boek s'n (formate.video met prys_sent,
// verdelings en hosting), sodat die betaalvloei in Fase 4 dit op dieselfde
// manier kan lees.
//
// DIE VELDE WORD EEN VIR EEN GEBOU, nie met ...invoer nie. 'n Veld wat nie
// hier hanteer word nie, kom nie in die rekord nie. (Die les van
// wysig-produk.js se ...wysigings.)

const { kry_store } = require("./_blob-store");
const { kry_maks_verdeling_persentasie, beskryf_minimum } = require("./_paystack-koste.js");
const { FST_KATEGORIE_IDS } = require("./_fst-kategoriee");

const GELDIGE_ROL_TIPES = ["spreker", "ontwerp_admin"];
const GELDIGE_ETIKET_KLEURE = ["amber", "koraal", "teal", "swart"];
const SLUG_PATROON = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function teks(waarde, maks) {
  return String(waarde == null ? "" : waarde).trim().slice(0, maks);
}

function kry_geldige_verdelings(verdelings) {
  if (!Array.isArray(verdelings)) return [];
  return verdelings
    .map((v) => {
      if (!v || !v.entiteit_id) return null;
      if (!GELDIGE_ROL_TIPES.includes(v.rol_tipe)) return null;
      if (!["persentasie", "vaste_bedrag"].includes(v.tipe)) return null;
      const waarde = Number(v.waarde);
      if (!Number.isFinite(waarde) || waarde <= 0) return null;
      if (v.tipe === "persentasie" && waarde > 100) return null;
      return { rol_tipe: v.rol_tipe, entiteit_id: String(v.entiteit_id), tipe: v.tipe, waarde };
    })
    .filter(Boolean);
}

function kry_geldige_hosting(hosting) {
  if (!hosting) return null;
  if (!["persentasie", "vaste_bedrag"].includes(hosting.tipe)) return null;
  const waarde = Number(hosting.waarde);
  if (!Number.isFinite(waarde) || waarde <= 0) return null;
  if (hosting.tipe === "persentasie" && waarde > 100) return null;
  return { tipe: hosting.tipe, waarde };
}

function oorskry_minimum(verdelings, hosting, prys_sent) {
  if (!prys_sent) return false;
  const pct = (b) => (b.tipe === "vaste_bedrag" ? (b.waarde / prys_sent) * 100 : b.waarde);
  const totaal = verdelings.reduce((s, v) => s + pct(v), 0) + (hosting ? pct(hosting) : 0);
  return totaal > kry_maks_verdeling_persentasie(prys_sent);
}

function kry_geldige_etiket(etiket) {
  if (!etiket) return null;
  const teks_af = teks(etiket.teks_af, 30);
  const teks_en = teks(etiket.teks_en, 30);
  if (!teks_af && !teks_en) return null;
  const kleur = GELDIGE_ETIKET_KLEURE.includes(etiket.kleur) ? etiket.kleur : "amber";
  return { teks_af: teks_af || teks_en, teks_en: teks_en || teks_af, kleur };
}

function kry_geldige_datum(waarde) {
  if (!waarde) return null;
  const d = new Date(waarde);
  return Number.isNaN(d.getTime()) ? null : String(waarde).slice(0, 10);
}

// Hou die volgorde soos gekies (die eerste is die hoofkategorie), sonder
// duplikate en net uit die vaste lys.
function kry_geldige_kategoriee(lys) {
  if (!Array.isArray(lys)) return [];
  const gesien = new Set();
  return lys.filter((id) => FST_KATEGORIE_IDS.includes(id) && !gesien.has(id) && gesien.add(id));
}

// Sleutelwoorde soos getik, sonder duplikate (hoof- en kleinletters tel as
// dieselfde woord). Hoogstens 20, elk hoogstens 40 karakters.
function kry_geldige_sleutelwoorde(lys) {
  if (!Array.isArray(lys)) return [];
  const gesien = new Set();
  const uit = [];
  for (const w of lys) {
    const woord = teks(w, 40);
    const sleutel = woord.toLowerCase();
    if (!woord || gesien.has(sleutel)) continue;
    gesien.add(sleutel);
    uit.push(woord);
    if (uit.length >= 20) break;
  }
  return uit;
}

// "A", "A en B", "A, B en C" — soos die boeke se outeur-veld.
function naam_string(name) {
  if (!name.length) return "";
  if (name.length === 1) return name[0];
  return `${name.slice(0, -1).join(", ")} en ${name[name.length - 1]}`;
}

/**
 * Bou 'n talk-rekord. Gee { fout, status } terug by 'n fout, andersins
 * { talk }. `bestaande` is die huidige rekord by 'n wysiging (null by skep):
 * velde wat die vorm nie dra nie (geskep_op, die Bunny video-ID) kom daaruit.
 */
async function bou_talk(invoer, bestaande) {
  const slug = teks(invoer.slug, 80).toLowerCase();
  const titel = teks(invoer.titel, 200);

  if (!slug || !SLUG_PATROON.test(slug)) {
    return { status: 400, fout: "Die slug mag net kleinletters, syfers en koppeltekens bevat, byvoorbeeld die-brein-onder-druk" };
  }
  if (!titel) return { status: 400, fout: "Verpligte veld: titel" };

  const spreker_ids = Array.isArray(invoer.spreker_ids)
    ? [...new Set(invoer.spreker_ids.map((s) => String(s || "").trim()).filter(Boolean))]
    : [];
  if (!spreker_ids.length) return { status: 400, fout: "Kies ten minste een spreker" };

  const sprekers_store = kry_store("sprekers");
  const sprekers = await Promise.all(spreker_ids.map((id) => sprekers_store.get(id, { type: "json" })));
  const onbekend = spreker_ids.filter((id, i) => !sprekers[i]);
  if (onbekend.length) {
    return { status: 400, fout: `Onbekende spreker(s): ${onbekend.join(", ")}` };
  }

  const kategoriee = kry_geldige_kategoriee(invoer.kategoriee);
  if (!kategoriee.length) return { status: 400, fout: "Kies ten minste een kategorie" };

  const video_in = (invoer.formate && invoer.formate.video) || {};
  const prys_sent = Math.round(Number(video_in.prys_sent) || 0);
  if (prys_sent < 0) return { status: 400, fout: "Die prys kan nie negatief wees nie" };
  const duur_sekondes = Math.max(0, Math.min(4 * 3600, Math.round(Number(video_in.duur_sekondes) || 0)));

  const verdelings = kry_geldige_verdelings(video_in.verdelings);
  const hosting = kry_geldige_hosting(video_in.hosting);
  if (oorskry_minimum(verdelings, hosting, prys_sent)) {
    return {
      status: 400,
      fout: "Die verdeling(s) plus Hosting los te min oor vir Future Sharp se hoofrekening; Paystack se fooi moet gedek word. Verminder dit sodat " + beskryf_minimum(prys_sent) + " oorbly.",
    };
  }

  const vorige_video = (bestaande && bestaande.formate && bestaande.formate.video) || {};
  const nou = new Date().toISOString();

  const talk = {
    slug,
    soort: "talk",
    titel,
    spreker: naam_string(sprekers.map((s) => s.naam)),
    spreker_ids,
    kategoriee,
    sleutelwoorde: kry_geldige_sleutelwoorde(invoer.sleutelwoorde),
    oorsig: teks(invoer.oorsig, 2000),
    vol_beskrywing: teks(invoer.vol_beskrywing, 10000),
    omslag: teks(invoer.omslag, 500),
    omslag_gegenereer: !!invoer.omslag_gegenereer,
    etiket: kry_geldige_etiket(invoer.etiket),
    formate: {
      video: {
        beskikbaar: !!video_in.beskikbaar,
        prys_sent,
        duur_sekondes,
        vrystelling_datum: kry_geldige_datum(video_in.vrystelling_datum),
        // Kom in Fase 4 (Bunny Stream). Die vorm stel dit nog nie; 'n
        // wysiging behou dus wat reeds daar is.
        bunny_video_id: vorige_video.bunny_video_id || null,
        verdelings,
        hosting,
      },
    },
    aktief: invoer.aktief === undefined ? (bestaande ? bestaande.aktief !== false : true) : !!invoer.aktief,
    geskep_op: bestaande ? bestaande.geskep_op : nou,
    geskep_deur: bestaande ? bestaande.geskep_deur : invoer._gebruiker,
  };
  if (bestaande) {
    talk.gewysig_op = nou;
    talk.gewysig_deur = invoer._gebruiker;
  }

  return { talk };
}

module.exports = { bou_talk };
