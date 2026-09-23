// netlify/functions/_portaal.js
//
// DIE BRUG NA DIE REGISTRASIEPORTAAL (future-sharp-vraelyste).
//
// Die portaal is 'n aparte werf met sy eie berging. Twee dinge loop oor die
// brug, albei met dieselfde geheime sleutel, PORTAAL_API_SLEUTEL, wat op
// albei werwe gestel is:
//
//   1. Die portaal roep portaal-klient.js ná elke registrasie, sodat die
//      rekeningpligtige in die kliënteregister beland.
//   2. Die paneel (futuresharp.html) roep portaal.js; dié kontroleer die rol
//      en stuur dan na die portaal se admin-ingang deur.
//
// PORTAAL_ADMIN_URL is die .netlify.app-adres, nie die domein nie: die
// wildcard-rekord na Afrihost breek bediener-tot-bediener-oproepe. Sien
// _rol-kontrole.js.

const { timingSafeEqual } = require("crypto");
const {
  kry_kliente_store,
  skoon_epos,
  skep_nommer,
  nuwe_klient,
  voeg_geskiedenis_by,
} = require("./_kliente");

const PORTAAL_ADMIN_URL = () =>
  String(process.env.PORTAAL_ADMIN_URL || "https://future-sharp-vraelyste.netlify.app").replace(/\/+$/, "") +
  "/portaal/api/admin";

function sleutel_klop(gegee) {
  const geheim = process.env.PORTAAL_API_SLEUTEL || "";
  const a = Buffer.from(String(gegee || ""));
  const b = Buffer.from(geheim);
  if (!geheim || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Roep die portaal se admin-ingang. Gooi 'n fout met .status as dit misluk.
async function portaal_admin(liggaam) {
  const geheim = process.env.PORTAAL_API_SLEUTEL;
  if (!geheim) {
    const f = new Error("PORTAAL_API_SLEUTEL is nie in die winkel gestel nie");
    f.status = 503;
    throw f;
  }
  const beheer = new AbortController();
  const klok = setTimeout(() => beheer.abort(), 9000);
  try {
    const antwoord = await fetch(PORTAAL_ADMIN_URL(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portaal-sleutel": geheim },
      body: JSON.stringify(liggaam),
      signal: beheer.signal,
    });
    const data = await antwoord.json().catch(() => ({}));
    if (!antwoord.ok) {
      const f = new Error(data.fout || "Die portaal antwoord " + antwoord.status);
      f.status = antwoord.status;
      throw f;
    }
    return data;
  } finally {
    clearTimeout(klok);
  }
}

// DIE REKENINGPLIGTIGE IN DIE KLIËNTEREGISTER.
//
// EEN GESIN, EEN REKORD. Bestaan daar reeds 'n kliënt met dieselfde e-pos
// (kleinletter, soos die register dit stoor), word die registrasie aan hom
// gekoppel en geen nuwe rekord geskep nie. Registreer 'n ouer 'n tweede kind,
// kry die tweede faktuur dus dieselfde kliënt.
//
// Andersins: 'n PRIVAAT kliënt met bron "portaal". Die register se eie
// duplikaattoets bly werk soos altyd.
async function koppel_klient({ registrasie, naam, epos, selfoon }) {
  const e = skoon_epos(epos);
  if (!e) throw new Error("Geen e-pos nie");
  const store = kry_kliente_store();

  // Al die kliënte gelyktydig, nie een ná die ander nie.
  const lys = await store.list({ prefix: "K" });
  const rekords = await Promise.all((lys.blobs || []).map((b) => store.get(b.key, { type: "json" }).catch(() => null)));
  for (const rekord of rekords) {
    if (rekord && skoon_epos(rekord.epos) === e) {
      voeg_geskiedenis_by(rekord, "portaal_gekoppel", "portaal", "Registrasie " + (registrasie || ""));
      rekord.bygewerk_op = new Date().toISOString();
      await store.setJSON(rekord.nommer, rekord);
      return { nommer: rekord.nommer, gekoppel: true };
    }
  }

  const rekord = nuwe_klient("portaal");
  rekord.nommer = await skep_nommer(store);
  rekord.soort = "privaat";
  rekord.naam = String(naam || "").trim().slice(0, 200) || e;
  rekord.epos = e;
  rekord.selfoon = String(selfoon || "").trim().slice(0, 60);
  voeg_geskiedenis_by(rekord, "geskep", "portaal", "Registrasie " + (registrasie || ""));
  await store.setJSON(rekord.nommer, rekord);
  return { nommer: rekord.nommer, gekoppel: false };
}

// DIE FAKTUURSLOT.
//
// Is daar al 'n faktuur UITGEREIK met hierdie registrasienommer in een van sy
// reëls, het die kliënt die diens gehad en is die registrasie deel van die
// boeke. Dan mag die nommer nie meer verander nie en die registrasie nie
// geskrap word nie: die faktuur se reël sou na niks verwys, en die
// toestemmings is die bewys agter die rekening.
//
// 'n KONSEP tel nie: dit is nog net 'n kwotasie, en 'n kliënt kan kanselleer
// of nie opdaag nie. 'n Gekanselleerde faktuur tel WEL: dit was uitgereik en
// bly 'n rekord. Kwotasies (eie sleutels in dieselfde store) word oorgeslaan.
async function fakture_vir(nommers) {
  const { kry_fakture_store } = require("./_fakture");
  const { is_kwotasie_sleutel } = require("./_kwotasies");
  const soek = (nommers || []).filter(Boolean).map((n) => String(n).toUpperCase());
  const uit = {};
  if (!soek.length) return uit;
  const store = kry_fakture_store();
  const lys = await store.list();
  const sleutels = (lys.blobs || []).map((b) => b.key).filter((s) => !is_kwotasie_sleutel(s));
  const rekords = await Promise.all(sleutels.map((s) => store.get(s, { type: "json" }).catch(() => null)));
  for (const f of rekords) {
    if (!f || !f.stand || f.stand === "konsep") continue;
    const teks = (f.reels || []).map((r) => String((r && r.beskrywing) || "")).join("\n").toUpperCase();
    for (const n of soek) {
      // Die nommer as 'n heel woord: FS-2026-0158 mag nie op FS-2026-01580 pas nie.
      const patroon = new RegExp("(^|[^0-9A-Z-])" + n.replace(/[-]/g, "\\-") + "(?![0-9])");
      if (patroon.test(teks)) (uit[n] = uit[n] || []).push({ nommer: f.nommer, stand: f.stand });
    }
  }
  return uit;
}

module.exports = { sleutel_klop, portaal_admin, koppel_klient, fakture_vir };
