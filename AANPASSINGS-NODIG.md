# Aanpassings nodig aan bestaande lêers

Bygewerk nadat julle werklike `_rol-kontrole.js`, `_blob-store.js` en
`identiteit.js` gesien is — `kry-my-boeke.js` en `my-boeke.js` gebruik nou
presies julle bestaande patrone (geen aannames meer nie). Wat volg, is
steeds nodig omdat ek nie toegang tot die res van die repo het nie.

## Nuwe lêers (reg om te plaas)

- `netlify/functions/kry-my-boeke.js` — gebruik `kry_gebruiker_en_kontroleer_rol(event, context, "koper")` en `kry_store("bestellings")`
- `public/my-boeke.html` — plekhouer-bladsy, kop/nav/voetskrif nog nodig (sien punt 4)
- `public/js/my-boeke.js` — gebruik `identiteit_kry_huidige_sessie()` uit `identiteit.js`

## 1. `taal.js` — nuwe vertaal-sleutels om by te voeg

```js
// Afrikaans
my_boeke_titel: "My Boeke",
my_boeke_subtitel: "Al jou gekoopte e-boeke, gereed om te lees.",
lees_aanlyn: "Lees aanlyn",
beskikbaar_vanaf: "Beskikbaar vanaf",
nog_nie_beskikbaar: "Nog nie beskikbaar nie",
meld_aan_vir_my_boeke: "Meld eers aan om jou boeke te sien.",
laai_tans: "Laai tans...",
sessie_verval: "Jou sessie het verval — meld gerus weer aan.",
geen_boeke_nog: "Jy het nog geen e-boeke gekoop nie.",
fout_boeke_laai: "Kon nie jou boeke laai nie — probeer later weer.",
```

```js
// English
my_boeke_titel: "My Books",
my_boeke_subtitel: "All your purchased e-books, ready to read.",
lees_aanlyn: "Read online",
beskikbaar_vanaf: "Available from",
nog_nie_beskikbaar: "Not yet available",
meld_aan_vir_my_boeke: "Please log in to see your books.",
laai_tans: "Loading...",
sessie_verval: "Your session has expired — please log in again.",
geen_boeke_nog: "You haven't purchased any e-books yet.",
fout_boeke_laai: "Couldn't load your books — please try again later.",
```

## 2. `begin-betaling.js` — koppel bestelling aan koper se identiteit

Volg presies dieselfde patroon as `kry-my-boeke.js`:

```js
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
// ... boaan die handler, voor die bestelling geskryf word:
const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
if (!gebruiker) {
  return { statusCode: 401, body: JSON.stringify({ fout: "Meld eers aan om te koop" }) };
}
```

En voeg by die bestelling-rekord voor dit na Blobs geskryf word:

```js
bestelling.koper = {
  netlify_identity_id: gebruiker.id,   // GoTrue se /user gee "id" terug (bevestig teen jul _rol-kontrole.js)
  epos: gebruiker.email,
};
```

**Belangrik:** dit beteken `begin-betaling.js` gaan nou 'n `Authorization:
Bearer <token>`-header van die front-end verwag — sien punt 3 hieronder
vir waar dit vandaan kom.

## 3. `voltooi-betaling.html` / `voltooi-betaling.js` — vereis aanmelding

Aan die begin (bv. by bladsy-laai of net voor "Gaan na betaling"):

```js
const sessie = await identiteit_kry_huidige_sessie();
if (!sessie) {
  // wys aanmeld/registreer-oproep, of herlei na 'n aanmeld-bladsy
  // met 'n "terug"-parameter na voltooi-betaling.html
}
```

En wanneer die "Gaan na betaling"-knoppie `begin-betaling.js` aanroep,
voeg die header by:

```js
fetch("/.netlify/functions/begin-betaling", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessie.access_token}`,
  },
  body: JSON.stringify(/* ... bestaande liggaam ... */),
});
```

(`identiteit.js` moet dus ook op `voltooi-betaling.html` gelaai word, nes
op `paneelbord.html`.)

## 4. `my-boeke.html` — kop/nav/voetskrif

Kopieer die werklike `<nav>`/kop-blokke/voetskrif-opmaak vanaf 'n
bestaande bladsy (bv. `mandjie.html`) na `my-boeke.html`, en voeg 'n
skakel na "My Boeke" by die nav self by (naas die mandjie-ikoon) — ek
het dit nie hier ingesluit nie omdat ek nie die res van die HTML kon
sien nie.

## 5. Nog nie in hierdie stap gedoen nie (volgende stappe)

- **`aanmeld.html`** — koper-aanmeld/registreer-bladsy (met
  `identiteit_meld_aan`/`identiteit_registreer` uit `identiteit.js`).
  Personeel se aanmeld-vloei sit reeds in `paneelbord.html`; kopers het
  nog geen aparte een nie.
- **`identity-registrasie.js`** — bevestig dat dit steeds korrek die
  "koper"-rol toeken (README sê dit doen dit reeds; net kontroleer dit
  steeds so werk ná enige toekomstige veranderinge).
- **`leser.html` + `public/js/leser.js`** — die werklike PDF.js-in-
  blaaier-leser waarna `my-boeke.js` se "Lees aanlyn"-skakel
  (`/leser.html?boek=...`) verwys. Nog nie gebou nie.
- **Watermerk-Function** (`pdf-lib`) — wat die leser aanroep om die PDF
  dinamies te watermerk voor dit gestroom word.

## 6. `aanmeld.html` / `aanmeld.js` — nuut gebou (reg om te plaas)

- `public/aanmeld.html` — aanmeld-, registreer- en wagwoord-herstel-vorms
  (drie wissel-blokke op een bladsy)
- `public/js/aanmeld.js` — gebruik `identiteit_meld_aan`, `identiteit_registreer`,
  `identiteit_stuur_herstel`, `identiteit_kry_huidige_sessie` uit `identiteit.js`
- Ondersteun reeds 'n `?terug=/pad.html`-parameter (bv. `my-boeke.js` se
  herleiding na `/aanmeld.html?terug=/my-boeke.html` werk nou korrek)
- Kop/nav/voetskrif ontbreek steeds hier — sien punt 4 se instruksie, dieselfde geld hier

### ⚠️ Nog 'n oop gaping wat hierdie ontbloot het: `bevestig.html`

`identiteit_registreer()` skep 'n rekening, maar GoTrue vereis normaalweg
dat die koper eers die bevestigingskakel in hul e-pos klik voor 'n
eerste aanmelding kan slaag. Daardie skakel wys na 'n bladsy met 'n
`confirmation_token` in die URL — en `identiteit.js` het reeds die
funksie wat dit verwerk (`identiteit_verwerk_token("signup", token, wagwoord)`),
**maar geen bladsy roep dit nog aan nie.**

Nodig (nie in hierdie stap gebou nie): 'n `bevestig.html` wat:
1. Die `confirmation_token` (of `token`) uit die URL-parameters lees
2. 'n Wagwoord-invoer wys (GoTrue se `/verify` vereis 'n wagwoord in
   dieselfde stap — bevestig of die e-pos-skakel reeds 'n wagwoord bevat
   of nie, en pas aan)
3. `identiteit_verwerk_token("signup", token, wagwoord)` aanroep
4. By sukses na `/my-boeke.html` (of `terug`-parameter) herlei

Sonder hierdie bladsy sal splinternuwe koper-registrasies vaskom by die
"kyk jou e-pos"-stap.

## 7. Nuwe `taal.js`-sleutels vir `aanmeld.html`

```js
// Afrikaans
aanmeld_titel: "Meld aan",
epos_etiket: "E-pos",
wagwoord_etiket: "Wagwoord",
meld_aan_knoppie: "Meld aan",
geen_rekening_nog: "Het jy nog geen rekening nie?",
registreer_hier: "Registreer hier",
wagwoord_vergeet: "Wagwoord vergeet?",
registreer_titel: "Skep 'n rekening",
registreer_knoppie: "Registreer",
het_reeds_rekening: "Het jy reeds 'n rekening?",
meld_aan_hier: "Meld hier aan",
herstel_titel: "Herstel wagwoord",
stuur_herstel_knoppie: "Stuur herstel-skakel",
terug_na_aanmeld: "Terug na aanmeld",
meld_tans_aan: "Meld tans aan...",
aanmeld_fout: "Kon nie aanmeld nie — kyk jou besonderhede.",
registreer_tans: "Skep tans rekening...",
registreer_sukses_bevestig_epos: "Rekening geskep! Kyk jou e-pos vir 'n bevestigingskakel voor jy kan aanmeld.",
registreer_fout: "Kon nie rekening skep nie.",
stuur_tans_herstel: "Stuur tans...",
herstel_epos_gestuur: "Herstel-skakel gestuur — kyk jou e-pos.",
herstel_fout: "Kon nie herstel-epos stuur nie.",
```

```js
// English
aanmeld_titel: "Log in",
epos_etiket: "Email",
wagwoord_etiket: "Password",
meld_aan_knoppie: "Log in",
geen_rekening_nog: "Don't have an account yet?",
registreer_hier: "Register here",
wagwoord_vergeet: "Forgot your password?",
registreer_titel: "Create an account",
registreer_knoppie: "Register",
het_reeds_rekening: "Already have an account?",
meld_aan_hier: "Log in here",
herstel_titel: "Reset password",
stuur_herstel_knoppie: "Send reset link",
terug_na_aanmeld: "Back to login",
meld_tans_aan: "Logging in...",
aanmeld_fout: "Couldn't log in — check your details.",
registreer_tans: "Creating account...",
registreer_sukses_bevestig_epos: "Account created! Check your email for a confirmation link before logging in.",
registreer_fout: "Couldn't create account.",
stuur_tans_herstel: "Sending...",
herstel_epos_gestuur: "Reset link sent — check your email.",
herstel_fout: "Couldn't send reset email.",
```

## Bygewerkte volgorde-voorstel

1. **`bevestig.html`** — sonder dit werk registrasie nie end-tot-end nie (nuwe gaping, hierbo)
2. Plaas `aanmeld.html` + `aanmeld.js` (reg om te plaas)
3. Punt 3: `voltooi-betaling` vereis aanmelding
4. Punt 2: `begin-betaling.js` koppel `koper.netlify_identity_id`
5. Plaas `kry-my-boeke.js`, `my-boeke.html` (met punt 4 se kop/nav bygevoeg), `my-boeke.js` — toets die volle "My Boeke"-lys end-tot-end met 'n regte toets-aankoop
6. `leser.html` + watermerk-Function (volgende sessie se werk)
