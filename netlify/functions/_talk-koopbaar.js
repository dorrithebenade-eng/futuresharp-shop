// FutureSharp Talks — kan hierdie talk nou gekoop word?
// Een plek vir die reël, sodat die talk-bladsy en die betaling nooit van
// mekaar kan verskil nie.

function talk_koopbaar(talk, video) {
  if (!talk || talk.aktief === false) return { koopbaar: false, rede: "nie_aktief" };
  const v = (talk.formate && talk.formate.video) || {};
  if (!v.beskikbaar) return { koopbaar: false, rede: "nie_beskikbaar" };
  const speel = video && (video.stand === "gereed" ? video.playback_id : video.speel_playback_id);
  if (!speel) return { koopbaar: false, rede: "geen_video" };
  if (v.vrystelling_datum) {
    const vandag = new Date().toISOString().slice(0, 10);
    if (v.vrystelling_datum > vandag) return { koopbaar: false, rede: "nog_nie_vrygestel", datum: v.vrystelling_datum };
  }
  return { koopbaar: true };
}

module.exports = { talk_koopbaar };
