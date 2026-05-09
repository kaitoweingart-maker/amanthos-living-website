# Anleitung: Google Hotel Center & Free Booking Links einrichten

**Für:** Amanthos Living (3 Properties — Glattbrugg, Grenchen, Duillier)
**Voraussetzung:** PR #1 ist gemerged und die Site ist auf GitHub Pages live (`https://www.amanthosliving.com`)
**Geschätzte Zeit:** 1–2 Stunden Arbeit, 1–2 Wochen bis Approval

Arbeite die Phasen der Reihe nach durch. Jede Phase baut auf der vorigen auf.

---

## Phase 1 — Google Business Profile prüfen (15 Min)

**Ziel:** Sicherstellen, dass die 3 Properties als **Hotel** kategorisiert sind und alle unter `kaito.weingart@amanthos.com` laufen.

### 1.1 Übersicht öffnen
Browser → https://business.google.com/locations
(Einloggen mit `kaito.weingart@amanthos.com`)

Du solltest **alle 3 Properties** in der Liste sehen:
- Amanthos Living Glattbrugg (oder ähnlich)
- Amanthos Living Grenchen (oder ähnlich)
- Amanthos Living Duillier (oder ähnlich)

**Falls eine fehlt:** Sie ist unter einem anderen Google-Konto. Du musst entweder das Profil übertragen lassen, oder mit dem anderen Konto separat in Hotel Center weitermachen.

### 1.2 Pro Property: Kategorie prüfen

Für **jede** der 3 Properties:

1. Klick auf den Hotelnamen → Detail-Ansicht öffnet sich
2. Linke Seitenleiste → **„Bearbeiten"** oder **„Profil bearbeiten"** (Stift-Icon)
3. Unter **„Über"** oder **„Details"** → Feld **„Kategorie"** suchen
4. Hauptkategorie muss exakt **„Hotel"** sein (nicht „Apartment", „Lodging", „Ferienwohnung", „Serviced Apartment")
5. Falls falsch → ändern auf **„Hotel"** → Speichern

**Warum das wichtig ist:** Hotel Center akzeptiert nur Listings mit Kategorie „Hotel". Andere Kategorien führen zu „No match found" und das Setup scheitert.

### 1.3 Pro Property: Adresse und Telefon abgleichen

Vergleich gegen die Daten in `feeds/hotel_list.xml`:

| Property | Adresse | Telefon |
|---|---|---|
| GBAL (Zurich Airport) | Oberhauserstrasse 30, 8152 Glattbrugg | +41 43 217 86 94 |
| GNBE (Solothurn / Grenchen) | Bettlachstrasse 20, 2540 Grenchen | +41 41 562 34 88 |
| NYAL (Nyon / Duillier) | Rue du Château 11, 1266 Duillier | +41 41 562 34 87 |

**Falls Abweichungen:** Lieber GBP korrigieren als XML — das Hotelname-Feld in GBP muss langfristig richtig sein.

### 1.4 Profilname abgleichen

Das **GBP-Profilname** muss mit dem `<name>` in `hotel_list.xml` zu mindestens **80% übereinstimmen** (Google match-toleriert leicht).

XML-Namen aktuell:
- `Amanthos Living — Zurich Airport`
- `Amanthos Living — Solothurn / Grenchen`
- `Amanthos Living — Nyon / Duillier`

Wenn dein GBP z.B. nur **„Amanthos Living Glattbrugg"** heisst, ist das kein Match. Lösung:
- **Variante A:** GBP umbenennen auf `Amanthos Living — Zurich Airport` (vorher klären ob das markenrechtlich/operativ ok ist)
- **Variante B:** XML im Repo anpassen — sag mir welche Namen die GBPs haben, dann passe ich `hotel_list.xml` an und pushe einen Folge-Commit.

---

## Phase 2 — Hotel Center Account anlegen (10 Min)

### 2.1 Account erstellen
1. Browser → https://hotelcenter.google.com
2. Mit `kaito.weingart@amanthos.com` einloggen (gleiches Konto wie GBP!)
3. Erste Seite: **„Get started"** / **„Jetzt starten"** klicken
4. Formular ausfüllen:
   - **Account name:** `Amanthos Living`
   - **Country:** Switzerland
   - **Currency:** CHF
   - **Time zone:** Europe/Zurich
5. **Terms of Service** akzeptieren (Hotel Center ToS + Free Booking Links ToS — beide Häkchen)
6. **„Create account"** / **„Konto erstellen"** klicken

### 2.2 Account-ID notieren
Nach dem Anlegen siehst du oben rechts deine **Account ID** (z.B. `1234567890`).
→ Notier sie dir, du brauchst sie später bei der GA4-Verknüpfung.

---

## Phase 3 — Domain in Search Console verifizieren (15–60 Min)

Hotel Center erlaubt nur Landing-Page-URLs auf verifizierten Domains.

### 3.1 Search Console öffnen
Browser → https://search.google.com/search-console
(Mit `kaito.weingart@amanthos.com` einloggen)

### 3.2 Property hinzufügen
1. Oben links Dropdown → **„+ Property hinzufügen"**
2. Typ wählen: **„Domain"** (nicht „URL-Präfix") → robuster
3. Eingeben: `amanthosliving.com` (ohne www, ohne https://)
4. **„Weiter"** klicken

### 3.3 DNS-Verifikation
Search Console zeigt einen **TXT-Record** an (sieht aus wie `google-site-verification=...`).

**Wo eingeben?** Dort wo deine DNS verwaltet wird. Tipp: Wenn du nicht weisst wo:
```bash
dig +short NS amanthosliving.com
```
zeigt dir den Nameserver-Provider.

Übliche Provider:
- **Cloudflare:** dash.cloudflare.com → DNS → Records → Add → Type: TXT, Name: @, Value: `<verification-string>`
- **GoDaddy:** DNS Management → Add → TXT → Host: @ → Value: `<verification-string>`
- **Namecheap:** Domain List → Manage → Advanced DNS → Add New Record → TXT Record → Host: @
- **Hostpoint / Infomaniak / Cyon (CH):** Webhosting → DNS-Zone → TXT-Record hinzufügen

Nach dem Hinzufügen: 5–60 Min warten, dann in Search Console **„Verifizieren"** klicken.

### 3.4 In Hotel Center linken
1. Zurück nach https://hotelcenter.google.com
2. Linke Seitenleiste → **„Linked accounts"** / **„Verknüpfte Konten"**
3. Bei **Search Console** → **„Link"** klicken
4. `amanthosliving.com` aus der Liste wählen → **„Confirm"**

→ Status muss **„Linked"** zeigen, sonst wird Phase 5 später blockiert.

---

## Phase 4 — Hotel List importieren (24–48h Wartezeit)

### 4.1 Voraussetzung prüfen
Die Datei muss erreichbar sein:
```
https://www.amanthosliving.com/feeds/hotel_list.xml
```
→ In Chrome aufrufen. Du musst die XML-Quelle sehen (3 `<listing>` Blöcke).

**Falls 404:** PR #1 ist noch nicht gemerged oder GitHub Pages noch nicht deployed. Erst mergen + 5 Min warten.

### 4.2 Hotel List anlegen
1. Hotel Center → linke Seitenleiste → **„Hotel list"** (oder **„Hotelliste"**)
2. Oben rechts → **„+ Add hotel list"** / **„Hotelliste hinzufügen"**
3. Formular:
   - **List name:** `Amanthos Living Properties`
   - **Method:** **Fetch URL** (nicht „Upload file")
   - **Feed URL:** `https://www.amanthosliving.com/feeds/hotel_list.xml`
   - **Schedule:** Daily (Standard)
4. **„Save"** / **„Speichern"** klicken

### 4.3 Verarbeitung abwarten
- Status springt auf **„Processing"** → das ist normal
- Nach 24–48h: Status sollte **„Active"** sein
- Pro Hotel siehst du dann einen **Match-Status:**
  - ✅ **„Match found"** — alles ok, Hotel ist mit GBP verknüpft
  - ⚠️ **„Match pending"** — noch in Arbeit, abwarten
  - ❌ **„No match"** — Name oder Adresse stimmt nicht mit GBP überein → Phase 1 nochmal prüfen

### 4.4 Bei „No match"
Klick auf das Hotel → Details → Google zeigt dir den Grund:
- „Name mismatch": GBP-Name und XML-Name zu unterschiedlich
- „Address mismatch": Adresse weicht ab
- „Category mismatch": GBP nicht als Hotel kategorisiert

→ Korrigieren, dann **„Re-verify"** klicken.

---

## Phase 5 — Free Booking Links aktivieren (3–7 Tage Approval)

### 5.1 Programm starten
1. Hotel Center → linke Seitenleiste → **„Free booking links"** (oder **„Kostenlose Buchungslinks"**)
2. Erste Seite: **„Get started"** klicken
3. Mehrere Häkchen-Boxen → alle akzeptieren

### 5.2 Click-Destination konfigurieren
Im Schritt **„Click destination"**:
1. Type: **„Direct booking site"** (nicht OTA)
2. **Landing page URL** Feld → folgendes **exakt** einfügen (Copy-Paste):

```
https://www.amanthosliving.com/?hotel_id=(PARTNER_HOTEL_ID)&checkin=(CHECKIN)&checkout=(CHECKOUT)&num_adults=(NUM_ADULTS)&num_children=(NUM_CHILDREN)&user_language=(USER_LANGUAGE)&utm_source=google&utm_medium=hpa&utm_campaign=freebookinglinks
```

Wichtig: Die **Klammern um `(PARTNER_HOTEL_ID)` etc. müssen drin bleiben** — das sind Google's Macros, die zur Klickzeit ersetzt werden.

3. **„Test URL"** Button → Google ruft testweise die Landing-Page mit Sample-Daten auf
   - Erwartung: Booking-Engine fülle Form aus, starte Suche
   - Falls Fehler: Phase 6 (Test) zuerst manuell durchspielen

### 5.3 Submit
1. **„Submit for review"** / **„Zur Prüfung einreichen"** klicken
2. Status: **„Pending review"**
3. Approval dauert **3–7 Werktage**
4. Du bekommst eine Mail an `kaito.weingart@amanthos.com`

---

## Phase 6 — Manueller Test (5 Min, kann sofort gemacht werden)

Nicht warten auf Phase 5 Approval — der manuelle Test funktioniert sobald PR gemerged ist.

In Chrome / einem privaten Fenster öffnen:

```
https://www.amanthosliving.com/?hotel_id=GBAL&checkin=2026-08-01&checkout=2026-08-03&num_adults=2&num_children=0&utm_source=google&utm_medium=hpa&utm_campaign=freebookinglinks
```

Erwartung:
- ✅ Property „Zurich Airport" ist im Bookingbar ausgewählt
- ✅ Datum „1. Aug 2026 → 3. Aug 2026" ist im Datepicker
- ✅ 2 Erwachsene, 0 Kinder ist gesetzt
- ✅ Seite scrollt automatisch zum Booking-Bereich
- ✅ Offers werden geladen (Skeleton → echte Karten)

**Falls eines davon nicht klappt:** Sag mir welcher Schritt fehlschlägt, dann schau ich in den Code.

Test gleich danach mit `hotel_id=GNBE` und `hotel_id=NYAL`.

---

## Phase 7 — GA4 mit Hotel Center linken (Conversion-Tracking, 30 Min)

**Voraussetzung:** GA4 ist auf der Site aktiv und über GTM eingebunden (vermutlich schon der Fall, da `gtm.js` im `<head>` ist).

### 7.1 GTM-Trigger und Tag anlegen
1. Browser → https://tagmanager.google.com → Container für `amanthosliving.com` öffnen
2. Linke Seitenleiste → **„Triggers"** → **„New"**
   - Name: `Booking Confirmed - Google Source`
   - Type: **Custom Event**
   - Event name: `book_on_google_conversion`
   - Trigger fires on: **All Custom Events**
3. **„Save"**
4. Linke Seitenleiste → **„Tags"** → **„New"**
   - Name: `GA4 — Google Hotel Conversion`
   - Type: **Google Analytics: GA4 Event**
   - Configuration tag: deine bestehende GA4 Config-Tag
   - Event name: `book_on_google_conversion`
   - Event Parameters (manuell anlegen):
     | Parameter | Value |
     |---|---|
     | `transaction_id` | `{{Event - transaction_id}}` (Variable über Data Layer Variable) |
     | `value` | `{{Event - value}}` |
     | `currency` | `{{Event - currency}}` |
     | `hotel_id` | `{{Event - hotel_id}}` |
   - Triggering: der oben angelegte `Booking Confirmed - Google Source` Trigger
5. **„Save"**
6. Oben rechts **„Submit"** → Version publishen

### 7.2 Data Layer Variables anlegen (falls noch nicht da)
Für jeden Parameter (`transaction_id`, `value`, `currency`, `hotel_id`):
1. Variables → **New** → **Data Layer Variable**
2. Name: `Event - transaction_id` (entsprechend)
3. Data Layer Variable Name: `transaction_id`
4. Default value: leer
5. Save

### 7.3 In Hotel Center linken
1. Hotel Center → **„Linked accounts"** → bei **Google Analytics** → **„Link"**
2. GA4-Property auswählen (`amanthosliving.com`)
3. **„Confirm"**
4. Status muss **„Linked"** sein

### 7.4 Verifizieren
- Mache einen echten Test-Booking (z.B. mit `EMAILTEST050` Promo-Code für CHF 0.50, falls aktiv)
- GTM Preview Mode → Event `book_on_google_conversion` muss feuern
- Nach 24h in Hotel Center → **„Performance"** sollte die Conversion auftauchen

---

## FAQ / Troubleshooting

### „Mein GBP-Profil ist als ‚Apartment' kategorisiert, kann ich es ändern?"
Ja, in GBP unter Bearbeiten → Kategorie → ändern auf „Hotel". Dauert ggf. 1–7 Tage bis Google das prüft. Falls Google ablehnt: Du musst Belege liefern (Hotellizenz, Gewerbe-Eintrag).

### „Mehrere Properties, alle unter einem Konto verwalten?"
Ja, in https://business.google.com → linke Seitenleiste → **„Locations"** → **„Create group"** → Name z.B. `Amanthos Living` → alle 3 Properties zuordnen. Dann hast du ein zentrales Dashboard.

### „Ich sehe ‚No match' obwohl Name und Adresse stimmen"
Häufige Ursachen:
1. Adresse-Format leicht unterschiedlich (z.B. „Rue du Château 11" vs. „Rue Du Chateau 11" — Bindestriche, Akzente)
2. Telefonnummer hat anderes Format
3. GBP ist noch nicht „Published" — Status muss aktiv sein, nicht „Draft"

→ In GBP exakt das gleiche Format reinkopieren wie im XML.

### „Wie lange bis ich erste Klicks aus Google sehe?"
- Hotel List: Match in 24–48h
- Free Booking Links Approval: 3–7 Tage
- Erste Impressionen: sofort nach Approval
- Erste Klicks: 1–14 Tage je nach Sichtbarkeit/Suchvolumen

### „Kostet das was?"
**Nein.** Free Booking Links sind 100% kostenlos. Bezahlt sind nur die separaten **Hotel Ads** (CPC) — das ist ein anderes Programm und wird hier nicht aufgesetzt.

### „Was ist mit dem Datenschutz?"
- GA4 muss DSGVO-konform konfiguriert sein (IP-Anonymisierung, Consent Mode v2)
- Hotel Center selbst sammelt nur aggregierte Statistiken pro Hotel
- Die Conversion-Daten enthalten **keine** personenbezogenen Gast-Daten (Name/Email werden im Event nicht gepusht — nur `transaction_id`, `value`, `currency`, `hotel_id`)

---

## Reihenfolge zusammengefasst

1. ☐ PR #1 mergen → GitHub Pages deployt
2. ☐ XML-Erreichbarkeit prüfen (manueller Test in Phase 6)
3. ☐ Phase 1 — GBP-Kategorien prüfen
4. ☐ Phase 2 — Hotel Center Account anlegen
5. ☐ Phase 3 — Search Console + Domain verifizieren
6. ☐ Phase 4 — Hotel List importieren → 24–48h warten
7. ☐ Phase 5 — Free Booking Links submitten → 3–7 Tage warten
8. ☐ Phase 7 — GA4 ↔ Hotel Center linken
9. ☐ Erster echter Test-Booking → Conversion in Hotel Center prüfen

Bei jedem Schritt: Wenn etwas nicht klappt, schick mir einen Screenshot oder die Fehlermeldung — ich helfe weiter.
