// PUBLIEK — tel een tuisblad-besoek van die winkel. Die logika self leef
// in _besoek-teller.js, wat FutureSharp Talks (tel-fst-besoek.js) deel.
// Die winkel se sleutels het geen voorvoegsel nie, presies soos voorheen.

const { AFDELINGS, tel_besoek } = require("./_besoek-teller");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  await tel_besoek(AFDELINGS.winkel);
  return { statusCode: 204, body: "" };
};
