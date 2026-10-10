---
thema: glattbrugg-longstay
datum: 2026-10-09
status: aktiv
modus: voll
repo: ~/Projects/amanthos-living-website
plankey: glattbrugg-longstay
---

# Bauplan: Glattbrugg Longstay bis 89 Nächte online schalten (Seite DE und EN, Formular, Antwortmail, Register und Lead-Messung, Meta, Google, SMG, Vertrag)

> **Auszug für das öffentliche Repo (Abschnitt 0a des Masters).** Der Master liegt in
> `amanthos-ai-agents/docs/bauplan-glattbrugg-longstay-2026-10-09.md`. In diesem Auszug stehen:
> aus Abschnitt 0 die Punkte Personendaten, Preise an einer Stelle, Repo-Konventionen der
> Website und Sprache, die Kontrakte K1 (nur die öffentliche Datei), K2 bis K5, K7 und K14,
> die Segmente 0 bis 3 und der Sammelstellen-Block. Alles andere steht nur im Master. Die
> Scope-Blöcke der Segmente 0 bis 3 und der Sammelstellen-Block sind mit dem Master
> zeilengleich (`bauplan-scope.sh files` und `sammelstellen`). Wo der Master auf K6 verweist,
> gilt hier: Wortprüfung des Orchestrators, Liste nicht in diesem Repo.
>
> `status: aktiv` in diesem Auszug: Baustart vom Inhaber am 10.10.2026 freigegeben.

> **Scharfschalten:** Der Plan ist ein Vollplan im Zustand `draft`. Vor Beginn des Parallelbaus
> stellt der Inhaber `status:` in dieser Datei und in den sechs Plankopien auf `aktiv` (je Repo
> ein Doku-PR, den der Orchestrator vorbereiten darf; der Merge durch den Inhaber ist die
> Aktivierung). Solange `draft` steht, sind Edit-Gate, Commit-Gate und der PR-Check
> `plan-abgleich` stumm. Segment-Branches heissen in jedem Repo
> `segment/glattbrugg-longstay/<nr>-<slug>`; nur dort greifen die Gates. Jeder Commit trägt im
> Body den Block:
>
> ```
> Plan-Abgleich:
>   erledigt: <Abschnitte>
>   offen: <was aussteht>
>   abweichung: <keine | was anders gebaut wurde und warum>
> ```
>
> Bauagenten committen nach jedem Teilschritt. Überschreitet ein Segment 400 Zeilen
> Produktivcode, hält der Agent an und meldet es; er teilt nicht selbst. Testzeilen und Doku
> zählen nicht. Kein Segment erstellt einen PR, merged oder schreibt nach aussen (Apaleo, Meta,
> Google, SMG, Render, Supabase, Postfächer).

## 0. Randbedingungen (Auszug)

- **Gäste- und Personendaten.** Kein Segment liest, loggt oder committet Personendaten.
  Fixtures sind synthetisch (`Testperson Muster`, `test-lead@example.invalid`,
  `+41 79 123 45 67`). Wer ein Feld zeigen muss, schreibt `"email": "<redacted>"`. Hat ein
  Agent Personendaten committet, meldet er Datei und Zeile, statt still zu korrigieren.
  Dokumente nennen Rollen, nie Namen von Gästen oder Mitarbeitenden.
- **Preise an einer Stelle.** Öffentliche Preise stehen nur in `js/glattbrugg-units.js` (K1).
  Kein HTML, kein Backend-Modul, keine Antwortmail trägt eine Preiszahl. Die Dokumente in
  `amanthos-standortabgabe` zitieren K1 mit Stand und Verweis.
- **Repo-Konventionen Website.** Vanilla JS als IIFE mit `var`, `module.exports` für `node --test`, keine Build-Stufe, keine Dependencies.
- **Sprache.** Deutsch mit Schweizer Orthografie (ss), Englisch auf der EN-Seite. Kein
  Gedankenstrich. Code, Commits, PRs auf Englisch.

## 2. Segment 0: Kontrakte (sequenziell, vor allem anderen)

Je Repo ein PR auf dem Branch `segment/glattbrugg-longstay/0-kontrakte`. In platform, jarvis,
daily-reports und standortabgabe ist es nur die Plankopie (Orchestrator, Doku). In
living-website materialisiert Segment 0 die Kontrakte K1, K2, K5, K14 (Opus, high). In mcps
trägt es Register und Migration nach K10 (Opus, xhigh, weil `supabase/migrations/*` FL-3 ist).

**Dateien:**

```bauplan-scope segment=0
# repo: alle sieben (Master, fuenf Vollkopien, ein Auszug)
docs/bauplan-glattbrugg-longstay-2026-10-09.md
# repo: amanthos-living-website
js/glattbrugg-units.js
js/glattbrugg-config.js
css/glattbrugg.css
tests/dev-server.py
tests/glattbrugg-contract.test.mjs
tests/fixtures/glattbrugg-dom-contract.json
tests/fixtures/glattbrugg-skeleton.html
# repo: amanthos-mcps
packages/shared/src/standorte.ts
packages/shared/src/standorte.json
packages/shared/src/standorte.test.ts
packages/mcp-sales/src/lib/buchung.test.ts
packages/mcp-sales/src/lib/calcom.test.ts
packages/mcp-sales/src/lib/tools.test.ts
packages/mcp-sales/src/lib/store.test.ts
packages/mcp-sales/README.md
supabase/migrations/20261010090000_sales_register.sql
```

### K1: Kategorienliste GBAL, die eine Quelle

Die vollständige Staffel steht nur im Master. Öffentlich ist allein die folgende Datei.

**Öffentliche Datei `js/glattbrugg-units.js`** (IIFE nach `js/nyon-units.js`, reine Daten,
Export `module.exports` und `window.GLATTBRUGG_UNITS`):

- `UNITS`: fünf Einträge in obiger Reihenfolge mit `key`, `code`, `name`, `sqm` (Zahl oder
  `null`), `maxPersons`, `units`, `longstayUnits`, `price30` (30 bis 59 Nächte), `price60` (60
  bis 89 Nächte), `listed`. Für nicht gelistete Kategorien stehen `price30` und `price60` auf
  `null`; die Zahlen kommen erst mit dem Entscheid, die Kategorie zu listen.
- `EXTRA_PERSON: 250`, `MIN_NIGHTS: 30`, `MAX_NIGHTS: 89`, `VAT_LABEL: '3.8 %'`,
  `CURRENCY: 'CHF'`, `VERSION: '1'`. Keine Zimmernummern, keine Firmenkonditionen.
- Invarianten (Kontrakttest): Schlüssel und Reihenfolge exakt; Summe `units` 22; Summe
  `longstayUnits` 8; `listed` genau dann, wenn `longstayUnits > 0`; gelistet heisst beide
  Preise gesetzt, `price30 - price60 === 200` und `price60 >= 2100`; nicht gelistet heisst
  beide `null`; `sqm null` nur bei `superior`.

Die fünf Schlüssel und Namen gelten wörtlich auch für Backend (K8), Dokumente (K13) und
Anzeigentexte. Anzeige des Preises (K5): "CHF 2'100 je 30 Nächte" plus "rund CHF 70 pro
Nacht" (`Math.round(preis / 30)`); die Einheit ist immer 30 Nächte oder eine Nacht, nie ein
Monat (offene Frage 1).

### K2: Konstanten (`js/glattbrugg-config.js`)

IIFE nach `js/nyon-config.js`, Export `module.exports` und `window.GLATTBRUGG_CONFIG`:

| Schlüssel | Wert |
|---|---|
| `API_BASE` | wie `nyon-config.js` (`typeof window.AMANTHOS_API_BASE === 'string'`, sonst `https://amanthos-website-api.onrender.com`) |
| `CONTACT_PATH`, `FORM_KIND` | `/api/contact`, `glattbrugg` |
| `PAGE_URL_DE` | `https://www.amanthosliving.com/longstay-zuerich-flughafen/` |
| `PAGE_URL_EN` | `https://www.amanthosliving.com/long-stay-zurich-airport/` |
| `GA4_ID`, `ADS_ID` | `G-8LPLG0BPJ6`, `AW-702540316` |
| `ADS_SEND_TO` | `''` (leer heisst kein Conversion-Aufruf; die Verdrahtung trägt `AW-702540316/<label>` ein) |
| `CONTENT_NAME` | `glattbrugg-longstay` |
| `PHONE`, `PHONE_HREF` | `+41 41 562 97 00`, `tel:+41415629700` (Nummer aus dem JSON-LD von `/zurich/`; offene Frage 5) |
| `EMAIL` | `sales@amanthosliving.com` (offene Frage 4) |
| `VERSION` | `'1'` |

### K3: Formular-JSON an `POST /api/contact`

JSON, höchstens 65 KB, alle Werte Strings. Die Website sendet immer alle 18 Schlüssel, leer
als `""`.

| Schlüssel | Website sendet | Backend prüft (`contact_glattbrugg.parse`) |
|---|---|---|
| `form` | `"glattbrugg"` | Pflicht, sonst `400 Unknown form.` |
| `name` | Eingabe, getrimmt | mindestens 2 Zeichen, sonst `400`; gekürzt auf 200 |
| `email` | Eingabe, getrimmt | `^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$`, sonst `400`; wird `Reply-To` |
| `phone` | Eingabe | einzeilig, gekürzt auf 40 |
| `company` | Eingabe (Firma, optional) | einzeilig, gekürzt auf 200 |
| `unit` | Schlüssel aus K1 (nur gelistete im Auswahlfeld), sonst `""` | einer der fünf Schlüssel, sonst `""` |
| `arrival_month` | `YYYY-MM` aus `gb-arrival`, sonst `""` | `^\d{4}-(0[1-9]\|1[0-2])$`, sonst `""` |
| `duration_months` | `"1"`, `"2"`, `"3"`, sonst `""` | Menge `{"1","2","3"}`, sonst `""`; **nie ein Wert über 3** |
| `persons` | `"1"`, `"2"`, `"3"` | Menge `{"1","2","3"}`, sonst `""` |
| `message` | Freitext | gekürzt auf 5000 |
| `event_id` | je Absendung `crypto.randomUUID()`, Rückfall `'g-' + ...` | `^[A-Za-z0-9-]{8,64}$`, sonst `uuid4()` |
| `locale` | `"de"` oder `"en"` aus `<html lang>` | Menge `{"de","en"}`, sonst `""` |
| `utm_source`, `utm_medium`, `utm_campaign` | aus `location.search`, je Wert `^[A-Za-z0-9._-]{1,64}$`, sonst `""` | dasselbe Muster, sonst `""` |
| `gclid`, `fbclid` | nur aus `window.amMeta.tracking()`, also nur mit Einwilligung | gekürzt auf 512, nie in Mail oder Log |
| `company_website` | Honigtopf, bei Menschen `""` | gefüllt heisst Bot: `200 {ok:true}` ohne Mail |

Dauer: `1` heisst 30 bis 59 Nächte, `2` heisst 60 bis 75 Nächte, `3` heisst bis höchstens 89
Nächte. Antworten wie bei `nyon`: `200 {"ok": true}` nach zugestellter Mail, `400`, `413`,
`429`, `502`, `503`. Die Website zeigt eigene Texte je Statuscode in der Seitensprache und gibt
den Servertext nie aus:

- `200` de: "Vielen Dank. Wir melden uns persönlich bei Ihnen." en: "Thank you. We will get
  back to you personally."
- `400` de: "Bitte prüfen Sie Name und E-Mail-Adresse." en: "Please check your name and email
  address."
- `429` de: "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in einer Minute erneut."
  en: "Too many requests in a short time. Please try again in a minute."
- `502`, `503`, Netzfehler de: "Die Anfrage konnte nicht gesendet werden. Rufen Sie uns an:
  <PHONE>, oder schreiben Sie an <EMAIL>." en: "Your request could not be sent. Please call
  us on <PHONE> or write to <EMAIL>." (Telefon als `tel:`, Adresse als `mailto:`)

### K4: Ereignisse und Messung (Website, Segment 3)

Alle Aufrufe in `try/catch`. Kein Ereignis trägt Name, E-Mail, Telefon, Firma oder Nachricht.
Alles in der Tabelle feuert erst nach `200`, nie beim Klick; gespeichert wird nichts.

| Kanal | Aufruf | Bedingung |
|---|---|---|
| GA4 | `gtag('event', 'generate_lead', { lead_form: 'glattbrugg', unit, duration_months, locale })` | immer, Consent Mode regelt die Übertragung |
| Google Ads | `gtag('event', 'conversion', { send_to: ADS_SEND_TO })` | Einwilligung und `ADS_SEND_TO` nicht leer |
| Meta | `fbq('track', 'Lead', { content_name: 'glattbrugg-longstay' }, { eventID: event_id })` | Einwilligung und `typeof window.fbq === 'function'` |
| Plausible | `plausible('Lead', { props: { form: 'glattbrugg', locale } })` | `typeof window.plausible === 'function'` |
| GA4, Telefon | `gtag('event', 'phone_click', { lead_form: 'glattbrugg' })` bei Klick auf `a[href^="tel:"]` | immer |

Browser-Lead und Server-Lead tragen dieselbe `event_id` (Pixel `1113120988050573`). Beide
Seiten laden das Plausible-Snippet mit `plausible.init()`; sein Fehlen kostete Nyon neun Tage.

### K5: Seitenaufbau und DOM-Kontrakt (Segmente 1, 2, 3)

**URLs.** Deutsch `/longstay-zuerich-flughafen/`, Englisch `/long-stay-zurich-airport/`. Die Site
benennt Schwesterseiten mit einem Schlüsselwort in der Zielsprache (`grenchen-mieten`,
`grenchen-louer`), nicht mit einem Sprachsuffix; beide Pfade halten K6 ein und stehen lesbar
im Anzeigenpfad.

**Kopf**, Reihenfolge wie `nyon-louer/index.html`: CSP-Meta als erstes Element, `content`
byte-gleich mit `nyon-louer/index.html`; `consent.js` synchron; `meta.js` defer; gtag-Lader
wörtlich; `charset`, `viewport`; Titel und Beschreibung aus K7; **`<meta name="robots"
content="noindex, nofollow">`** (die Verdrahtung stellt nach Freigabe F1 auf `index, follow`);
`canonical` auf sich selbst; `hreflang` `de` auf die deutsche, `en` und `x-default` auf die
englische Seite; Open Graph mit `og:image` `images/zurich/hero.webp`; Icon, Font-Preloads,
`style.css` mit Ladetrick, `css/grenchen.css`, `css/glattbrugg.css`; JSON-LD `LodgingBusiness`
(Name, Adresse, `url` der Seite, ohne Preis und ohne Bewertung); Sentry; Plausible mit
`plausible.init()`. `<html lang="de">` beziehungsweise `lang="en"`. Kein `i18n.js`, kein
`booking.js`, kein `data-animate`, kein `langSelector`.

**Skripte am Ende**, alle `defer`, in dieser Reihenfolge: `glattbrugg-config.js`,
`glattbrugg-units.js`, `glattbrugg-page.js`, `anruf.js`.

**Abschnitte in dieser Reihenfolge:** Hero (`section.g-hero`, H1), `#suiten` (Karten und
Leistungsliste), `#anfrage` (Formular), `#lage`, `#faq`, `#kontakt`, Footer. Nav mit Ankern und
einem Link auf die Schwesterseite (`lang` und `hreflang` gesetzt). Keine neuen Bilder; erlaubt
sind die vorhandenen unter `images/zurich/`.

**IDs, je Seite genau einmal** (Quelle `tests/fixtures/glattbrugg-dom-contract.json`):
`gb-cards` (leerer Container, das Skript rendert die gelisteten Kategorien aus K1),
`gb-price-note`, `gb-form` (`novalidate`), `gb-name` (`required`), `gb-email` (`required`),
`gb-phone`, `gb-company`, `gb-unit` (`select`, erste Option leer, weitere füllt das Skript),
`gb-arrival` (`type="month"`), `gb-duration` (`select`, Werte `""`, `1`, `2`, `3`),
`gb-persons` (`select`, Werte `1`, `2`, `3`), `gb-message`, `gb-company-website` (Honigtopf in
`<div class="hp" aria-hidden="true">`, `tabindex="-1"`, `autocomplete="off"`), `gb-submit`,
`gb-status` (`role="status"`), `gb-success` (`hidden`), `gb-consent` (Footer-Knopf,
`window.amConsent.open()`). In `<noscript>` innerhalb `#suiten`: Hinweis "Preise auf Anfrage"
mit Telefon und Adresse.

**Klassen.** Aus `style.css` und `grenchen.css`: `section`, `section-alt`, `container`,
`container-narrow`, `section-label`, `section-title`, `section-subtitle`, `btn`, `btn-accent`,
`btn-lg`, `form-grid`, `form-field`, `g-hero`, `g-form`, `g-note`, `g-status`,
`g-status--error`, `g-success`, `hp`, `footer`. Neu in `css/glattbrugg.css` (Segment 0,
höchstens 60 Zeilen): `gb-cards`, `gb-card`, `gb-card-body`, `gb-price`, `gb-night`,
`gb-meta`, `gb-facts`, `gb-note`.

**Keine Preiszahl im HTML.** Kartenpreise, Zuschlag je Person und Auswahlfeld kommen aus K1
über das Skript. Statische Texte stehen in der Seitensprache direkt im HTML; dynamische Texte
(Karten, Status, Erfolg) trägt `glattbrugg-page.js` in einer Tabelle `de`/`en`.

### K7: Faktenblatt DE und EN (alles, was behauptet werden darf)

Quellen: `zurich/index.html` (main 655a3f9), Apaleo vom 10.10.2026, K1, Entscheide des
Briefings. Jede Aussage auf Seite, in Antwortmail, Inserat und Anzeige stammt aus dieser Liste.
Die acht Pflichtaussagen P1 bis P8 stehen auf jeder Seite; ein Inserat trägt P1 bis P5, P7
und P8.

| Nr | Deutsch | Englisch |
|---|---|---|
| P1 | Hotelaufenthalt von 30 bis höchstens 89 Nächten | Hotel stay of 30 to a maximum of 89 nights |
| P2 | Die Endreinigung ist inklusive | Final cleaning is included |
| P3 | Bettwäsche und Handtücher liegen bei der Anreise bereit | Bed linen and towels are ready on arrival |
| P4 | Reinigung und Wäschetausch während des Aufenthalts können Sie gegen Aufpreis dazubuchen | Cleaning and linen change during your stay can be booked at an extra charge |
| P5 | Bei der Anreise füllen Sie den Meldeschein aus | You complete the registration form on arrival |
| P6 | Digitaler Check-in rund um die Uhr | Digital check-in around the clock |
| P7 | Preise brutto, inkl. 3.8 % MWST | Prices are gross, incl. 3.8 % VAT |
| P8 | Im Haus gibt es keine Waschküche | There is no laundry room in the building |
| 9 | Möblierte Suite mit voll ausgestatteter Küche, Arbeitsplatz mit Schreibtisch, Smart TV, schnellem WLAN | Furnished suite with fully equipped kitchen, desk workspace, Smart TV, fast Wi-Fi |
| 10 | Oberhauserstrasse 30, 8152 Glattbrugg; Lift im Haus | Oberhauserstrasse 30, 8152 Glattbrugg; lift in the building |
| 11 | 1 km zum Flughafen Zürich, 9.4 km zum Zürich HB, 0.8 km zum Glatt, 11 km zur ETH | 1 km to Zurich Airport, 9.4 km to Zurich main station, 0.8 km to Glatt, 11 km to ETH |
| 12 | Privater Parkplatz, CHF 10 pro Tag | Private parking, CHF 10 per day |
| 13 | Kategorien, Flächen, Personen und Preise ausschliesslich aus K1 (gelistete Kategorien) | Categories, sizes, guests and prices from K1 only (listed categories) |
| 14 | Während des Aufenthalts keine Reinigung und kein Wäschetausch | No cleaning and no linen change during the stay |
| 15 | Zahlung im Voraus je 30 Tage | Payment in advance for each 30 days |
| 16 | Firmen: ab vier Suiten Konditionen auf Anfrage | Companies: terms for four suites or more on request |
| 17 | Telefon und Adresse aus K2 | Phone and address from K2 |

**Nicht behaupten:** Bewertungen und Sterne, Kaffee und Tee, Verfügbarkeit zu einem Datum,
Antwortfrist, Storno-Regeln, Parkplatzgarantie, Waschsalon in der Nähe, jede Zahl ausser K1,
K2 und dieser Tabelle, der Grund der Obergrenze, Aussagen zur Anmeldung bei der Gemeinde
(offene Frage 18). Vorgeschlagene Titel: de "Suite auf Zeit am Flughafen Zürich: Longstay bis
89 Nächte | Amanthos Living", en "Long stay suites at Zurich Airport, up to 89 nights |
Amanthos Living".

### K14: Harness (`tests/dev-server.py`, Segment 0)

`STUBBED_PAGES` bekommt fünf Pfade: `/longstay-zuerich-flughafen/` und
`/long-stay-zurich-airport/`, je auch mit `index.html`, sowie
`/tests/fixtures/glattbrugg-skeleton.html`. Fehlt eine Seite, antwortet der Harness wie bisher
`404 <pfad> fehlt noch`. `POST /api/contact` (druckt `CONTACT-BODY`, `fail=502`, `fail=429`),
alle bestehenden Pfade und `/api/offers` bleiben unverändert. Der Harness legt nie eine Datei an.
`tests/fixtures/glattbrugg-skeleton.html` ist die kleinste Seite mit allen IDs aus K5,
`lang="de"`, `noindex`, denselben Skripten wie die Seiten und dem Plausible-Snippet; Segment 3
testet dagegen, solange die Seiten fehlen. `tests/glattbrugg-contract.test.mjs` prüft K1 und K2
sofort und, sobald die Dateien existieren, K5: jede ID genau einmal je Seite, jedes
`getElementById`-Literal des Skripts steht im Fixture, beide Seiten tragen dieselbe ID-Menge,
dieselbe Abschnittsreihenfolge und dieselbe Skriptliste, CSP gleich `nyon-louer`, `hreflang`
wechselseitig, `plausible.init()` vorhanden, keine vierstellige Preiszahl im HTML, die
Pflichtmuster P1 bis P8 je Sprache. Fehlt eine Datei, sagt ein eigener Test, welcher Teil
übersprungen ist.

**Akzeptanzkriterien Segment 0:**

```bauplan-kriterien segment=0
- [ ] Website: node --test tests/*.test.mjs Exit 0, Testzahl vorher und nachher zitiert (Basis 261 laut PR 83, im Worktree neu gemessen); tests/glattbrugg-contract.test.mjs prueft alle Invarianten aus K1 und die Werte aus K2 und nennt die uebersprungenen K5-Teile beim Namen
- [ ] js/glattbrugg-units.js und js/glattbrugg-config.js laden in Node (require) und im Browser; ADS_SEND_TO ist leer; in beiden Dateien keine Zimmernummer, keine Firmenkondition, kein Preis einer nicht gelisteten Kategorie, Wortpruefung des Orchestrators, Liste nicht in diesem Repo
- [ ] tests/fixtures/glattbrugg-dom-contract.json ist gueltiges JSON mit allen IDs, Klassen und den Pflichtmustern P1 bis P8 je Sprache; das Skelett traegt jede ID genau einmal, noindex und plausible.init()
- [ ] css/glattbrugg.css hat hoechstens 60 Zeilen und nur die acht gb-Klassen aus K5
- [ ] Harness: python3 tests/dev-server.py 8080; GET auf das Skelett enthaelt den Stub; GET auf die zwei neuen Seitenpfade antwortet 404 "fehlt noch"; GET / und /nyon-louer/ und /zurich/ verhalten sich wie vor dem Segment (curl-Ausgaben zitiert)
- [ ] Auszug im oeffentlichen Repo nach 0a: bauplan-scope.sh files <auszug> 0..3 und sammelstellen <auszug> stimmen zeilenweise mit dem Master (diff zitiert); Wortpruefung des Orchestrators, Liste nicht in diesem Repo
- [ ] mcps: pnpm install --frozen-lockfile, pnpm -r build, pnpm -r exec tsc --noEmit Exit 0; pnpm -r --no-bail --filter '!./packages/voice-bridge' test Exit 0, Testzahl vorher und nachher zitiert; standorte.json ist byte-gleich mit JSON.stringify(STANDORTE, null, 2) plus Zeilenende
- [ ] mcps Rotbeweis rot zuerst: nach dem Registereintrag und vor der neuen Migration sind die zwei Tests "keeps event_objekt_known ..." und "keeps buchung_objekt_known ..." rot (Zahl zitiert), mit der Migration gruen und nicht uebersprungen
- [ ] mcps: nur der Eintrag living_zuerich und das Interface aendern sich (git diff zitiert); treffer("META | GLATTBRUGG | Traffic") bleibt living_zuerich; geschaeftOf("glattbrugg") ist miete; die Migration enthaelt genau zwei DROP CONSTRAINT IF EXISTS und zwei ADD CONSTRAINT und die Vorpruefung im Kopf; sie wird in diesem Segment nicht angewandt
- [ ] Fuenf Vollkopien byte-gleich mit dem Master bis auf repo: (shasum zitiert); status bleibt draft; in platform, jarvis, daily-reports und standortabgabe kein weiterer Datei-Diff
- [ ] Kein Datei-Diff ausserhalb des Scopes; keine Personendaten; Plan-Abgleich in jedem Commit
```

**Hängt ab von:** nichts. Danach: Inhaber stellt `aktiv` in sieben Dateien.
**Diff geschätzt:** Website rund 170 Zeilen Produktivcode (Daten 75, Konstanten 40, CSS 45,
Harness 10) plus Tests und Fixtures; mcps rund 20 Zeilen TypeScript, 25 Zeilen SQL, dazu
gepinnte Listen in Tests. 75 Minuten Website, 60 Minuten mcps.

## 3. Segmente (parallel, nach Merge von Segment 0 und `status: aktiv`)

Alle zehn zweigen von `origin/main` des jeweiligen Repos ab (`git fetch origin main`, dann
`git checkout -b <branch> origin/main`), arbeiten im eigenen Worktree, pushen, erstellen keinen
PR und mergen nichts. Jedes Segment hängt nur an Segment 0 und baut gegen Kontrakte und Skelett,
nie gegen ein Nachbarsegment. Nach dem Merge sind alle inert: Die Seiten tragen `noindex`, sind
unverlinkt und nicht in der Sitemap; das Skript tut ohne `gb-form` nichts; die Backend-Module
ruft niemand, bis die Verdrahtung den Zweig setzt; die Antwortmail steht auf `aus`.

### Segment 1: Seite Deutsch (Website)

- **Datei-Scope (exklusiv):**
  ```bauplan-scope segment=1
  # repo: amanthos-living-website
  longstay-zuerich-flughafen/index.html
  tests/glattbrugg-de.test.mjs
  ```
- **Auftrag:** `longstay-zuerich-flughafen/index.html` nach K5, abgeleitet aus
  `nyon-louer/index.html` (Kopf, CSP, Lader wörtlich) und dem Skelett aus Segment 0. Texte
  deutsch in Sie-Form, ausschliesslich aus K7; Karten, Preise und Auswahlfeld bleiben leer
  und kommen vom Skript. `tests/glattbrugg-de.test.mjs` prüft die Datei statisch.
- **Akzeptanzkriterien:**
  ```bauplan-kriterien segment=1
  - [ ] node --test tests/*.test.mjs Exit 0, Testzahl zitiert; tests/glattbrugg-de.test.mjs deckt jeden Punkt dieser Liste mit einem eigenen Test; der K5-Teil des Kontrakttests laeuft fuer die deutsche Seite
  - [ ] CSP-Meta ist das erste Element im head, content byte-gleich mit nyon-louer/index.html (md5 beider zitiert); lang="de"; robots noindex, nofollow; canonical auf sich; hreflang de, en, x-default nach K5
  - [ ] Skripte genau nach K5 in dieser Reihenfolge; kein i18n.js, booking.js, data-animate, langSelector; plausible.init() vorhanden
  - [ ] Jede ID aus tests/fixtures/glattbrugg-dom-contract.json genau einmal; gb-cards ist leer; gb-unit hat nur die leere Option; kein Preis aus K1 und kein CHF-Betrag ab 100 im HTML (Test)
  - [ ] Die Pflichtaussagen P1 bis P8 stehen im sichtbaren Text (Test ueber die Muster des Fixtures); jede Aussage der Seite steht in K7; Wortpruefung des Orchestrators, Liste nicht in diesem Repo
  - [ ] Harness http://localhost:8080/longstay-zuerich-flughafen/: Seite laedt ohne Konsolenfehler ausser dem fehlenden glattbrugg-page.js, solange Segment 3 nicht gemergt ist; mit ausgeschaltetem JavaScript zeigt #suiten den Hinweis aus noscript
  - [ ] axe (node .github/scripts/axe.cjs gegen den Harness) 0 serious und 0 critical; jedes Feld hat ein sichtbares label; Tastaturreihenfolge Nav, Karten, Formular, Absenden; 360 px ohne horizontales Scrollen (Screenshot); Lighthouse lokal accessibility mindestens 90 (Wert zitiert)
  - [ ] Keine neuen Bilder; nur vorhandene Dateien unter images/zurich/ referenziert (Liste zitiert); Datenschutz-Link mit dem hreflang der Sprache von privacy/index.html
  - [ ] Produktivcode-Diff hoechstens 400 Zeilen; kein Datei-Diff ausserhalb des Scopes; Plan-Abgleich in jedem Commit
  ```
- **Out-of-Scope:** jedes JavaScript ausser dem wörtlich übernommenen Lader im Kopf, `css/*`,
  `js/*`, die englische Seite, `sitemap.xml`, `zurich/index.html`, das Entfernen von `noindex`.
- **Testplan:** `node --test tests/*.test.mjs`; `python3 tests/dev-server.py 8080`; axe wie in
  `quality.yml` (Installation nach `$TMPDIR`); Lighthouse per `npx`; Screenshot 360 px.
- **Hängt ab von:** Segment 0. **Modell:** Sonnet, high. **Klasse:** FL-1 nach Pfad, Handmerge
  (das Repo hat keinen Required Test-Check). **Diff geschätzt:** rund 210 Zeilen HTML, 120
  Zeilen Test. 60 Minuten.

### Segment 2: Seite Englisch (Website)

- **Datei-Scope (exklusiv):**
  ```bauplan-scope segment=2
  # repo: amanthos-living-website
  long-stay-zurich-airport/index.html
  tests/glattbrugg-en.test.mjs
  ```
- **Auftrag:** `long-stay-zurich-airport/index.html` nach K5 mit derselben Struktur, denselben
  IDs und derselben Abschnittsreihenfolge wie das Skelett, Texte englisch aus der Spalte
  Englisch von K7, `lang="en"`. Kein Übersetzen der deutschen Seite, gebaut wird gegen K5 und
  K7. `tests/glattbrugg-en.test.mjs` prüft die Datei statisch.
- **Akzeptanzkriterien:**
  ```bauplan-kriterien segment=2
  - [ ] node --test tests/*.test.mjs Exit 0, Testzahl zitiert; tests/glattbrugg-en.test.mjs deckt jeden Punkt dieser Liste mit einem eigenen Test; der K5-Teil des Kontrakttests laeuft fuer die englische Seite
  - [ ] CSP-Meta zuerst und byte-gleich mit nyon-louer/index.html (md5 zitiert); lang="en"; robots noindex, nofollow; canonical auf sich; hreflang de auf die deutsche, en und x-default auf diese Seite
  - [ ] Skripte, IDs, leere Karten und leeres Auswahlfeld wie in Segment 1; kein Preis aus K1 und kein CHF-Betrag ab 100 im HTML (Test)
  - [ ] Die Pflichtaussagen P1 bis P8 in der englischen Fassung stehen im sichtbaren Text (Test); jede Aussage steht in K7; Wortpruefung des Orchestrators, Liste nicht in diesem Repo
  - [ ] Harness http://localhost:8080/long-stay-zurich-airport/: laedt ohne Konsolenfehler ausser dem fehlenden Skript; noscript-Hinweis englisch; Consent-Banner erscheint bei leerem localStorage
  - [ ] axe 0 serious und 0 critical; 360 px ohne horizontales Scrollen (Screenshot); Lighthouse lokal accessibility mindestens 90 (Wert zitiert); Datenschutz-Link mit hreflang der Sprache von privacy/index.html und dem Zusatz, in welcher Sprache die Seite ist
  - [ ] Produktivcode-Diff hoechstens 400 Zeilen; kein Datei-Diff ausserhalb des Scopes; Plan-Abgleich in jedem Commit
  ```
- **Out-of-Scope:** wie Segment 1, dazu die deutsche Seite.
- **Testplan:** wie Segment 1.
- **Hängt ab von:** Segment 0, nicht von Segment 1. **Modell:** Sonnet, high. **Klasse:** FL-1
  nach Pfad, Handmerge. **Diff geschätzt:** rund 210 Zeilen HTML, 110 Zeilen Test. 60 Minuten.

### Segment 3: Seitenskript (Website)

- **Datei-Scope (exklusiv):**
  ```bauplan-scope segment=3
  # repo: amanthos-living-website
  js/glattbrugg-page.js
  tests/glattbrugg-page.test.mjs
  ```
- **Auftrag:** `js/glattbrugg-page.js` als IIFE nach `js/nyon-page.js`: Sprache aus `<html
  lang>` (`en`, sonst `de`), Karten der gelisteten Kategorien aus K1 in `gb-cards` (Name,
  Fläche, Personen, freie Einheiten, zwei Preiszeilen je 30 Nächte, "rund CHF n pro Nacht",
  Zuschlag je weitere Person), Auswahlfeld aus K1, `min` und `max` von `gb-arrival` (laufender
  Monat bis plus zwölf), Validierung, Payload nach K3, Statustexte, Ereignisse nach K4. Reine
  Helfer als `module.exports` und `window.GLATTBRUGG_PAGE`: `formatChf`, `perNight`,
  `cardModel`, `buildPayload`, `readCampaign`, `newEventId`, `statusText`, `localeOf`.
- **Akzeptanzkriterien:**
  ```bauplan-kriterien segment=3
  - [ ] node --test tests/*.test.mjs Exit 0, Testzahl zitiert: formatChf(2100) gleich "CHF 2'100"; perNight(2100) gleich 70 und perNight(2240) gleich 75; cardModel liefert fuer business und business-plus in de und en beide Preiszeilen, Flaeche, Personen, freie Einheiten; nicht gelistete Kategorien werden nie gerendert
  - [ ] buildPayload liefert genau die 18 Schluessel aus K3, leere Werte als ""; unbekannte unit und duration_months "4" fallen auf ""; locale kommt aus lang; readCampaign verwirft ungueltige utm-Werte einzeln; newEventId passt auf ^[A-Za-z0-9-]{8,64}$; statusText kennt 200, 400, 429, 502, 503 und Netzfehler in de und en
  - [ ] K5-Teil des Kontrakttests: jedes getElementById-Literal steht im Fixture
  - [ ] Harness mit Skelett: zwei Karten mit den Preisen aus K1 und "rund CHF 70 pro Nacht"; Auswahlfeld mit zwei Kategorien; Absenden ohne E-Mail: kein fetch, Fehlertext, aria-invalid; gueltig: CONTACT-BODY traegt form glattbrugg, alle 18 Schluessel, locale de, utm-Werte aus der URL, company_website leer; gb-success sichtbar, gb-form verborgen
  - [ ] Ereignisse: nach 200 steht generate_lead mit lead_form glattbrugg in __gtagCalls; mit Einwilligung und gesetztem ADS_SEND_TO (DevTools) zusaetzlich conversion und in __fbqCalls track Lead mit eventID gleich event_id; ohne Einwilligung fehlen beide; plausible Lead mit props.form glattbrugg (Stub-Beleg); ?contact=fail zeigt den 502-Text mit tel- und mailto-Link ohne generate_lead; ?contact=429 zeigt den 429-Text
  - [ ] gclid und fbclid nur mit Einwilligung; nichts in localStorage (Storage-Inspektor); kein Preis aus K1 im Quelltext (grep zitiert); Wortpruefung des Orchestrators, Liste nicht in diesem Repo
  - [ ] Produktivcode-Diff hoechstens 400 Zeilen; kein Datei-Diff ausserhalb des Scopes; Plan-Abgleich in jedem Commit
  ```
- **Out-of-Scope:** HTML und CSS, `js/glattbrugg-units.js`, `js/glattbrugg-config.js`,
  `js/meta.js`, `js/consent.js`, `js/anruf.js`, Speichern im Browser.
- **Testplan:** `node --test tests/*.test.mjs`; Harness mit
  `/tests/fixtures/glattbrugg-skeleton.html`, DevTools (`__gtagCalls`, `__fbqCalls`),
  `CONTACT-BODY` auf stdout des Harness, beide Einwilligungszustände.
- **Hängt ab von:** Segment 0. **Modell:** Sonnet, high. **Klasse:** FL-1 nach Pfad, Handmerge.
  **Diff geschätzt:** rund 260 Zeilen Produktivcode, 200 Zeilen Tests. 75 Minuten.

## 4. Sammelstellen (nur die Verdrahtung fasst sie an)

```bauplan-scope sammelstellen
# repo: amanthos-living-website
sitemap.xml
llms.txt
index.html
404.html
robots.txt
.lycheeignore
unlighthouse.config.mjs
.github/workflows/*
.github/scripts/*
zurich/*
zurich-airport/*
nyon/*
nyon-louer/*
appartements-nyon/*
grenchen-mieten/*
grenchen-louer/*
solothurn/*
privacy/*
imprint/*
images/*
assets/*
locales/*
tools/*
js/booking.js
js/deeplink.js
js/meta.js
js/consent.js
js/sentry-init.js
js/app.js
js/chat.js
js/anruf.js
js/i18n.js
js/longstay-config.js
js/longstay-page.js
js/nyon-config.js
js/nyon-units.js
js/nyon-page.js
js/grenchen-config.js
js/grenchen-units.js
js/grenchen-finder.js
js/grenchen-page.js
css/style.css
css/grenchen.css
css/longstay.css
tests/nyon-*
tests/longstay-*
tests/grenchen-*
tests/deeplink.test.mjs
tests/anruf.test.mjs
tests/i18n-fixed.test.mjs
tests/fixtures/grenchen-*
tests/fixtures/longstay-*
tests/fixtures/offers-*
tests/fixtures/deeplink-cases.json
# repo: amanthos-platform
website-backend/server.py
website-backend/run_meta_leads.py
website-backend/meta_leads_routen.py
website-backend/grenchen_autoantwort.py
website-backend/nachlauf_autoantwort.py
website-backend/grenchen_leads.py
website-backend/meta_capi.py
website-backend/contact_grenchen.py
website-backend/contact_longstay.py
website-backend/contact_nyon.py
website-backend/requirements.txt
website-backend/tests/test_contact_grenchen.py
website-backend/tests/test_contact_longstay.py
website-backend/tests/test_contact_nyon.py
website-backend/tests/test_meta_leads*
website-backend/tests/test_grenchen_*
render.yaml
.env.example
DOKUMENTATION.md
CLAUDE.md
pyproject.toml
requirements.txt
requirements-dev.txt
# repo: amanthos-mcps
packages/shared/src/index.ts
packages/mcp-sales/src/lib/types.ts
packages/mcp-sales/src/lib/tools.ts
packages/mcp-sales/src/lib/buchung.ts
packages/mcp-sales/src/lib/calcom.ts
packages/mcp-ads/*
supabase/migrations/*
pnpm-lock.yaml
pnpm-workspace.yaml
package.json
# repo: jarvis
services/vertrieb/sink.ts
services/vertrieb/buchung.ts
services/vertrieb/calcom.ts
services/vertrieb/slot.ts
services/vertrieb/fingerprint.ts
services/vertrieb/manifest.json
services/shared/*
package-lock.json
# repo: amanthos-daily-reports
adsreport/haeuser.json
adsreport/schema.py
adsreport/build.py
adsreport/collect_google.py
adsreport/collect_plausible.py
adsreport/render.py
adsreport/render_svg.py
adsreport/narrative.py
adsreport/regelkreis.py
adsreport/messkette.py
run_ads.sh
run_daily.sh
launchd/*
# repo: amanthos-standortabgabe
README.md
docs/research/*
docs/vertrag-nyon-sejour-long-2026-09-29.md
docs/ablauf-einzug-nyon-2026-09-29.md
docs/inserat-nyon-wohnen-auf-zeit-2026-09-17.md
```

Fällige Einträge der Verdrahtung in diesem Repo:

- `sitemap.xml`: die zwei neuen URLs (`changefreq weekly`, `priority 0.8`, `lastmod` des
  Merge-Tags). `llms.txt`: zwei Zeilen. `.github/workflows/quality.yml`: beide URLs in der
  axe-Liste. `zurich/*`: der Abschnitt "Wohnen auf Zeit" nach Entscheid (offene Frage 10).
- Dateien aus Segment 0, die danach nur die Verdrahtung anfasst: `js/glattbrugg-config.js`
  (`ADS_SEND_TO`), `js/glattbrugg-units.js` (Listen weiterer Kategorien nach Entscheid). Die
  zwei Seiten gehören den Segmenten 1 und 2; nach deren Merge stellt die Verdrahtung `robots`
  auf `index, follow`.
