// netlify/functions/portaal-kennisgewing.js
//
// DIE PORTAAL MELD 'N NUWE REGISTRASIE (November 2026). Die portaal
// (future-sharp-vraelyste) het geen e-pos nie; hy roep hierdie Function ná
// elke registrasie, met die geheime sleutel in x-portaal-sleutel, net soos
// portaal-klient.js.
//
// TWEE POSSE:
//   1. Aan Future Sharp, by ELKE registrasie (besluit 22 Nov 2026).
//      Ontvanger: REGISTRASIE_KENNIS_AAN, anders ADMIN_EPOS, anders die
//      admin-posbus self. Meer as een adres: skei met kommas.
//   2. Aan die konsultant, as die registrasie deur haar skakel kom en sy
//      aktief is en 'n e-posadres het.
//
// NET WAT NODIG IS. Geen geboortedatum, geen toestemmings: die paneel het
// die volle rekord.
//
// Die portaal wag nie hierop nie (hoogstens ses sekondes) en 'n mislukking
// hier raak nie die registrasie nie.

const { sleutel_klop } = require("./_portaal");
const { stuur_epos, ontsnap } = require("./_stuur-epos");
const { konsultant_vir_kode } = require("./_konsultante");

const PANEEL = "https://futureshop.futuresharp.co.za/futuresharp.html";

function admin_ontvangers() {
  return process.env.REGISTRASIE_KENNIS_AAN || process.env.ADMIN_EPOS || process.env.EPOS_ADMIN_GEBRUIKER || "";
}

function teks(w, maks = 120) {
  return String(w == null ? "" : w).trim().slice(0, maks);
}

function graad_of_student(l) {
  if (l.soort === "student") return "Student";
  return l.graad ? "Graad " + teks(l.graad, 10) : "";
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };

  const kop = event.headers || {};
  if (!sleutel_klop(kop["x-portaal-sleutel"] || kop["X-Portaal-Sleutel"])) {
    return { statusCode: 403, body: "Geen toegang nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const no = teks(invoer.no, 40);
  if (!/^(TOETS-)?FS-\d{4}-\d{4,}$/.test(no)) return { statusCode: 400, body: "Ongeldige registrasienommer" };

  const l = invoer.leerder || {};
  const rp = invoer.rp || {};
  const leerder = `${teks(l.naam)} ${teks(l.van)}`.trim();
  const rp_naam = `${teks(rp.naam)} ${teks(rp.van)}`.trim();
  const voorvoeg = invoer.toets ? "[TOETS] " : "";

  let konsultant = null;
  if (invoer.konsultant) {
    try {
      konsultant = await konsultant_vir_kode(invoer.konsultant);
    } catch (fout) {
      console.error("portaal-kennisgewing: kon nie die konsultante lees nie:", fout);
    }
  }

  const besonderhede = [
    `Registrasie: <b>${ontsnap(no)}</b>`,
    `${l.soort === "student" ? "Student" : "Leerder"}: <b>${ontsnap(leerder)}</b>${graad_of_student(l) ? " · " + ontsnap(graad_of_student(l)) : ""}`,
  ];
  if (!rp.self && rp_naam) besonderhede.push(`Rekeningpligtige: ${ontsnap(rp_naam)}`);
  const kontak = [teks(rp.sel, 40), teks(rp.epos, 200)].filter(Boolean).map(ontsnap).join(" · ");
  if (kontak) besonderhede.push(`Kontak: ${kontak}`);

  const uitslae = {};

  // --- 1. Future Sharp ---
  const aan = admin_ontvangers();
  if (aan) {
    const wie = konsultant
      ? `Deur die skakel van <b>${ontsnap(konsultant.naam)}</b>${konsultant.aktief === false ? " (onaktief)" : ""}.`
      : invoer.konsultant
      ? `Deur 'n onbekende konsultantkode: ${ontsnap(teks(invoer.konsultant, 30))}.`
      : "Deur die gewone registrasieskakel.";
    const u = await stuur_epos({
      aan,
      onderwerp: `${voorvoeg}Nuwe registrasie: ${no} (${leerder})`,
      opskrif: "Nuwe registrasie",
      reels: [besonderhede.join("<br>"), wie],
      knoppie: { teks: "Maak Future Sharp oop", url: PANEEL },
      merk: "faktuur",
    });
    uitslae.future_sharp = Boolean(u && u.ok);
  }

  // --- 2. Die konsultant ---
  if (konsultant && konsultant.aktief !== false && konsultant.epos) {
    const voornaam = teks(konsultant.naam).split(/\s+/)[0] || "";
    const u = await stuur_epos({
      aan: konsultant.epos,
      onderwerp: `${voorvoeg}Jou nuwe kliënt: ${no} (${leerder})`,
      opskrif: "Jou nuwe kliënt",
      reels: [
        `Hallo ${ontsnap(voornaam)}`,
        `Iemand het deur jou skakel geregistreer.`,
        besonderhede.join("<br>"),
        "Maak die registrasie in die Future Sharp-paneel oop om die konsultasie te reël.",
      ],
      knoppie: { teks: "Maak Future Sharp oop", url: PANEEL },
      merk: "faktuur",
    });
    uitslae.konsultant = Boolean(u && u.ok);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, uitslae }),
  };
};
