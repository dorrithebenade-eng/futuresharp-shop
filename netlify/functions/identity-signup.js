// Netlify Identity "identity-signup" event-funksie.
// Ken outomaties die "koper"-rol toe wanneer 'n nuwe gebruiker registreer.
//
// Opstel: Netlify herken hierdie Function outomaties as 'n Identity-trigger
// SUIWER OP GROND VAN DIE LÊERNAAM — dit moet presies "identity-signup.js"
// wees (soos hierdie lêer nou genoem is). Geen verdere konfigurasie nodig nie.
//
// "personeel"-rol word NOOIT hier toegeken nie — dit word handmatig deur
// die eienaar via die Netlify Identity-kontrolepaneel gedoen.

exports.handler = async (event) => {
  const { user } = JSON.parse(event.body);

  return {
    statusCode: 200,
    body: JSON.stringify({
      app_metadata: {
        roles: ["koper"],
      },
    }),
  };
};
