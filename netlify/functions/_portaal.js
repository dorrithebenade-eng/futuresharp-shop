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

  const lys = await store.list({ prefix: "K" });
  for (const b of lys.blobs || []) {
    const rekord = await store.get(b.key, { type: "json" }).catch(() => null);
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

module.exports = { sleutel_klop, portaal_admin, koppel_klient };
