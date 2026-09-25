// netlify/functions/kry-bankmaande.js
// Weergawe 2 (25 September 2026).
//
// Die bank se kant van die maandopsomming, vir een boekjaar. Rol: boekhouding.
//
// ?jaar=2025 gee Maart 2025 tot Februarie 2026 (die boekjaar se beginjaar,
// soos oral in die joernaal).
//
// PER KALENDERMAAND, NIE PER STAAT NIE. FNB se state loop van die 13de tot die
// 12de; die rekenmeester werk in kalendermaande. Die reels van alle regte
// state word dus saamgegooi en per maand opgetel.
//
// WAT PER MAAND TERUGKOM
//
//   dekking      hoeveel van die maand se dae deur 'n ingevoerde staat gedek is.
//                'n Maand wat nie ten volle gedek is nie, se syfers is
//                onvolledig, en die skerm se dit.
//   opening,     die saldo voor die maand se eerste reel en na sy laaste, uit die
//   sluit        saldo-ketting van die state self
//   in, uit      alle reels behalwe FNB se R0,00-inligtingsreels
//   per stand    die netto van wat oop, gepas, toegewys en oordrag is. Elke reel
//                is presies een van die vier, so hulle tel altyd op tot die
//                bank se netto beweging. Dit is die "elke rand verklaar"-toets.
//
// TOETSSTATE TEL NIE. Hulle is nie Future Sharp se bank nie.
//
// Die reels self kom ook terug, sodat die werkboek hulle kan lys sonder 'n
// tweede oproep.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const B = require("./_bankstate");

function maand_einde(j, m) {
  return new Date(Date.UTC(j, m, 0)).getUTCDate();   // m is 1-12
}

function iso(j, m, d) {
  return `${j}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };

  const jaar = Number((event.queryStringParameters || {}).jaar);
  if (!Number.isInteger(jaar) || jaar < 2020 || jaar > 2100) {
    return { statusCode: 400, body: "Gee 'n geldige boekjaar." };
  }
  const van = iso(jaar, 3, 1);
  const tot = iso(jaar + 1, 2, maand_einde(jaar + 1, 2));

  let state;
  try {
    state = (await B.lees_almal(B.kry_bankstate_store()))
      .filter((s) => s.toets !== true && s.van <= tot && s.tot >= van)
      .sort((a, b) => String(a.van).localeCompare(String(b.van)));
  } catch (fout) {
    console.error("Kon nie die bankstate lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die bankstate laai nie" };
  }

  // Alle reels, in volgorde: datum, dan die staat, dan die reel se plek.
  const alle = [];
  state.forEach((s, si) => (s.reels || []).forEach((r) => {
    alle.push({ ...r, staat: s.sleutel, _si: si });
  }));
  alle.sort((a, b) =>
    String(a.datum).localeCompare(String(b.datum)) || a._si - b._si || a.nr - b.nr);

  const effek = (r) => (r.stand === "inligting" ? 0 : (r.rigting === "in" ? r.bedrag_sent : -r.bedrag_sent));

  const maande = [];
  for (let i = 0; i < 12; i++) {
    const m = ((2 + i) % 12) + 1;          // 3..12, 1, 2
    const j = m >= 3 ? jaar : jaar + 1;
    const dae = maand_einde(j, m);
    const eerste = iso(j, m, 1);
    const laaste = iso(j, m, dae);

    let gedek = 0;
    for (let d = 1; d <= dae; d++) {
      const dag = iso(j, m, d);
      if (state.some((s) => s.van <= dag && s.tot >= dag)) gedek += 1;
    }

    const reels = alle.filter((r) => r.datum >= eerste && r.datum <= laaste);
    const voor = alle.filter((r) => r.datum < eerste);

    let opening = null;
    let sluit = null;
    if (reels.length) {
      opening = reels[0].saldo_sent - effek(reels[0]);
      sluit = reels[reels.length - 1].saldo_sent;
    } else if (gedek) {
      if (voor.length) {
        opening = sluit = voor[voor.length - 1].saldo_sent;
      } else {
        const s = state.find((x) => x.van <= laaste && x.tot >= eerste);
        opening = sluit = s ? s.opening_sent : null;
      }
    }

    const netto = { oop: 0, gepas: 0, toegewys: 0, oordrag: 0 };
    let in_sent = 0;
    let uit_sent = 0;
    let oop_tel = 0;
    reels.forEach((r) => {
      if (r.stand === "inligting") return;
      const e = effek(r);
      if (r.rigting === "in") in_sent += r.bedrag_sent; else uit_sent += r.bedrag_sent;
      const k = r.stand === "voorstel" ? "oop" : r.stand;
      netto[k] = (netto[k] || 0) + e;
      if (k === "oop") oop_tel += 1;
    });

    maande.push({
      maand: `${j}-${String(m).padStart(2, "0")}`,
      dae, gedek,
      opening_sent: opening, sluit_sent: sluit,
      in_sent, uit_sent,
      reels: reels.filter((r) => r.stand !== "inligting").length,
      oop_tel,
      netto,
    });
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jaar, van, tot,
      state: state.map((s) => ({ sleutel: s.sleutel, van: s.van, tot: s.tot, rekening4: s.rekening4 })),
      maande,
      reels: alle
        .filter((r) => r.datum >= van && r.datum <= tot)
        .map(({ _si, ...r }) => r),
    }),
  };
};
