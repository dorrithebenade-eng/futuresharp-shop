# CLAUDE.md: Future Sharp Shop

Lees hierdie lêer voordat jy enige werk in hierdie repo doen. As die taak die Future Sharp-paneel, FSF of FSVS raak, lees ook `FS-INTEGRASIE.md`.

## Die opdrag "LEES"

Wanneer Dorrithé net "LEES" sê, wil sy hê jy moet die gedeelde Google Drive-vouer "Future Sharp Stand van sake" lees (Future Sharp se Drive, futuresharpmentor@gmail.com, binne Future Sharp NPC).

1. Kyk eers of die Google Drive-koppeling in hierdie sessie aan is. As dit aan is, lees self "00 LEES MY EERS" en dan die betrokke Stand van sake-lêers, ook in 'n wolksessie.
2. Net as die koppeling nie aan is nie: vra Dorrithé om die relevante deel van die nota in te plak, of om die Google Drive-koppeling aan te skakel.
3. Moenie aannames maak oor wat in die nota staan nie.
4. Vra vrae as iets ná die lees steeds nie duidelik is nie.

## Oor die projek

Future Sharp NPC (Pretoria) se Afrikaans-eerste platform vir fakturering, boekhouding en e-handel. Twee komponente:

1. **Faktureringstelsel** (`futuresharp-shop.netlify.app`): rekeningkundige paneel, fakture en kwotasies, Paystack-integrasie, kasboek-uitvoer.
2. **Future Shop** (`futureshop.futuresharp.co.za`): aanlyn boekwinkel vir e-boeke, harde kopieë en lenings, met 'n outeursportaal, admin-paneel en kliëntwinkel.

Dorrithé bestuur en ontwikkel die platform, maar skryf nie self kode nie. Bou elke lêer volledig. Die stelsel is in aktiewe toetsfase (`TOETSFASE=aan` doelbewus) met regte transaksies.

## Stapel

- Netlify: hosting, Functions, Blobs, Identity (GoTrue)
- GitHub: hierdie repo, `main`-tak. Netlify ontplooi outomaties vanaf `main`.
- Paystack: betalings en subrekening-verdelings (splits)
- Afrihost: SMTP
- LearnWorlds: kursusse
- ExcelJS: xlsx-uitvoer (lui gelaai)

Die repo is **publiek**. Moet nooit sleutels, wagwoorde, rekeningbesonderhede of persoonlike inligting in kode of kommentaar plaas nie. Geheime bly in Netlify se omgewingsveranderlikes.

## Kodekonvensies

- Die hele kodebasis is Afrikaans: veranderlikes, funksies, CSS-klasse, UI-etikette en kommentaar.
- `taal.js` is die sentrale vertaallêer. Gebruik `t_in(sleutel, taal)` vir dokumenttaal-spesifieke oproepe en `t()` vir die platformtaal. Voeg nuwe skermteks altyd as sleutels hier by.
- Nuwe JS-funksionaliteit gaan waar moontlik in aparte lêers, eerder as om bestaande lêers te verander.
- Datums: `JJJJ/MM/DD`.
- Netlify Blobs-sleutels: joernaal `J-{jaar}-{tyd}-{staart}`; Paystack-transaksies `T-{jaar}-{verwysing}`; fakture `FS-NNNNN`; kwotasies `KW-NNNNN`.

## Kritieke patroon: stil veldverlies

Funksies wat rekords veld vir veld bou, verloor stilweg enige nuwe veld wat nie uitdruklik gelys is nie. Wanneer 'n veld by `nuwe_faktuur()` gevoeg word, moet elk van hierdie plekke besluit wat met die veld gebeur:

1. `_faktuur-pdf.js`
2. `kry-faktuur.js`
3. `kry-fakture.js`
4. `kry-kwotasie.js`
5. `kry-kwotasies.js`
6. `kry-publieke-kwotasie.js`
7. `aanvaar-kwotasie.js`
8. `fs_invoer_uit_faktuur()` in `faktuur-som.js`

Dieselfde geld vir `kry-my-outeur.js`: elke nuwe veld moet uitdruklik by die antwoordbouer gevoeg word. Stilte is 'n besluit om die veld te verloor.

## Rekeningkundige reëls

- Die stelsel boek op kontantbasis: net wat die bankrekening bereik, is inkomste.
- Die Paystack-fooi is 'n voorsiening wat by uitreiking gevries word en nooit herbereken word nie.
- Fakture, kwotasies en e-posse gee geen bankbesonderhede nie. Alle betaling gaan deur die Paystack-betaalskakel of QR-kode.
- "EFT" verskyn nooit alleen nie. Gebruik "Onmiddellike EFT, deur die betaalskakel" of "onmiddellike EFT of kaart".

## Paystack en betalings

- Webhook: `/.netlify/functions/paystack-webhook`, slegs vir winkel- en faktuurbetalings.
- **R0-faktuur:** as 'n koepon 'n faktuur na R0 verminder, word Paystack nooit geroep nie (geen `/split`, geen `/transaction/initialize`, geen webhook). Alles wat die webhook sou doen (status na Betaal, split gevries, toegangskode, e-posse) moet in daardie tak self gebeur. Dieselfde patroon as `begin-betaling.js` se `totaal_sent === 0`.
- **Kanselleer betaling:** 'n kliënt wat op Paystack se blad kanselleer, moet terugkeer na die vorige blad. Vir fakture hanteer `cancel_action` in `_faktuur-uitreik.js` dit. Die winkel se `begin-betaling.js` stel tans net `callback_url` na `dankie.html` en het dieselfde behandeling nodig.
- Die Zapier-Zap "Paystack transaction to LearnWorlds user enrollment" moet aan bly. Dit faal sigbaar op faktuur- en winkelbetalings; dit is onskadelike geraas, nie 'n fout om reg te maak nie.
- Gratis inskrywings: `free-enroll.js` roep die Zapier-haak (`ZAPIER_FREE_ENROLL_WEBHOOK_URL`) direk.
- Paystack se paneel is die gesag oor watter betaalmetodes beskikbaar is. Moenie aannames daaroor maak nie.

## E-pos

Twee Afrihost SMTP-rekeninge: `EPOS_GEBRUIKER` (futuresharp@, winkel) en `EPOS_ADMIN_GEBRUIKER` (admin@, fakture en kwotasies). `toets-epos` aanvaar 'n `merk`-parameter om die regte rekening te toets.

## Skermteks

- Skermteks stel net stelselreëls. Dit verduidelik nooit rekeningkundige begrippe vir gebruikers wat dit reeds verstaan nie.
- Geen personifikasie van stelselvoorwerpe nie ("sy" vir 'n faktuur is verkeerd), geen beeldspraak, geen verhalende toon.
- Gebruikers moet 'n register kan aanvul waar dit nodig is, sonder om die vorm te verlaat (soos `faktuur-nuwe-klient.js` vir kliënte).

## Hoe om met Dorrithé te werk

1. Kyk deur vier lense voordat jy werk aanbied: rekenkundig, stelselmatig, grafies, gebruik.
2. Direkte, presiese taal in 'n rekeningkundige register. Geen lang verduidelikings nie.
3. Nommer elke vraag of instruksie aan haar, sodat sy kort en direk kan antwoord.
4. Lees die volle kodepad voordat jy iets vra of bou. Vra een waarneming wat die moontlikhede van mekaar skei.
5. Wys 'n voorskou of mockup voordat jy UI-veranderinge bou.
6. Toetsfase-items word nie voortydig as probleme uitgelig nie. Dorrithé sê wanneer iets aandag nodig het.
7. As sy "wanneer?" vra, wil sy hê dit moet nou gedoen word.

## Plaaslike werk

Dorrithé werk soms plaaslik in `C:\Users\dorri\Projekte\futuresharp-shop` met PowerShell. Veranderinge wat hier gestoot word, moet sy eers met `git pull` aftrek voordat sy plaaslik verder werk.
