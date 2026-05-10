# Google Hotel Center / Free Booking Links — Setup

This folder contains the data feeds and configuration needed to connect Amanthos Living to Google's Free Booking Links programme. Free Booking Links shows direct-booking URLs alongside paid Hotel Ads in Google Search, Google Maps and Google Travel — at no media cost.

The technical pieces (deeplink handling, conversion tracking, XML feed) live in this repo. The Hotel Center account, property verification and link approval must be done by Amanthos in the Google consoles.

---

## What's in this folder

- `hotel_list.xml` — Hotel List Feed. Static XML with the 3 properties (GBAL, GNBE, NYAL). Imported once into Hotel Center; updated only when properties change.
- `README-google-hotel-center.md` — this file.

The booking engine (`/js/booking.js`) accepts deeplinks of the form documented below and pushes a `book_on_google_conversion` event into `dataLayer` when a Google-sourced session books.

---

## Landing-Page URL template (paste into Hotel Center)

```
https://www.amanthosliving.com/?hotel_id=(PARTNER_HOTEL_ID)&checkin=(CHECKIN)&checkout=(CHECKOUT)&num_adults=(NUM_ADULTS)&num_children=(NUM_CHILDREN)&user_language=(USER_LANGUAGE)&utm_source=google&utm_medium=hpa&utm_campaign=freebookinglinks
```

Macros in parentheses are replaced by Google at click-time. The booking engine reads the parameters, prefills the search form (property, dates, guests) and auto-triggers `fetchOffers()`.

Recognised parameters:

| Parameter | Source | Notes |
|---|---|---|
| `hotel_id` | Google `(PARTNER_HOTEL_ID)` | Must match an entry in `hotel_list.xml` (`GBAL`, `GNBE`, `NYAL`) |
| `checkin` | Google `(CHECKIN)` | `YYYY-MM-DD` |
| `checkout` | Google `(CHECKOUT)` | `YYYY-MM-DD`, must be after `checkin` |
| `num_adults` | Google `(NUM_ADULTS)` | 1–6, defaults to 2 |
| `num_children` | Google `(NUM_CHILDREN)` | 0–4, defaults to 0 |
| `utm_source` | static | Used for conversion attribution |
| `utm_medium` | static | Used for conversion attribution |
| `utm_campaign` | static | Used for conversion attribution |

Invalid/missing values cause a silent fallback to the empty form — the page never errors.

---

## Setup checklist (Amanthos)

### 1. Google Business Profile (one per property)
- Each property must have a verified GBP entry with category **Hotel** (not "lodging" or "apartment").
- Address, phone, website, opening hours must match `hotel_list.xml` exactly.

### 2. Hotel Center account
1. Go to https://hotelcenter.google.com
2. Create an account using the same Google Workspace as the GBP listings (e.g. `kaito.weingart@amanthos.com`).
3. Accept the Hotel Center terms and the Free Booking Links terms.

### 3. Domain verification
- Add `www.amanthosliving.com` as a verified site in Search Console under the same Google account.
- In Hotel Center → *Linked accounts* → link Search Console.

### 4. Hotel List import
1. In Hotel Center → *Hotel list* → *Add hotel list*.
2. Upload `feeds/hotel_list.xml` (raw URL: `https://www.amanthosliving.com/feeds/hotel_list.xml`) — Hotel Center can fetch directly.
3. Wait for processing (24–48h). Each property must reach status **Match found** by linking to the verified GBP.

### 5. Free Booking Links activation
1. In Hotel Center → *Free booking links* → *Get started*.
2. Choose **Manual setup** (not API connectivity for now).
3. **Click destination type**: *Direct booking site*.
4. Paste the **Landing-Page URL template** (see above).
5. Submit for review. Approval typically takes 3–7 days.

### 6. Conversion tracking linkage
1. In GTM, add a new **GA4 Event** trigger listening to `book_on_google_conversion`.
2. Map fields: `transaction_id`, `value`, `currency`, `hotel_id`.
3. In Hotel Center → *Settings* → *Linked accounts* → link the GA4 property.
4. Verify in Hotel Center → *Performance* → conversions appear within 24h after a real booking.

### 7. Test (after approval)
- In Hotel Center → *Diagnostics* → use the **Test landing page** tool with sample params. The booking engine should land directly on the offer list for the requested property and dates.
- Manually visit:
  ```
  https://www.amanthosliving.com/?hotel_id=GBAL&checkin=2026-08-01&checkout=2026-08-03&num_adults=2&num_children=0&utm_source=google&utm_medium=hpa&utm_campaign=freebookinglinks
  ```
  → form should fill in, search should auto-trigger.

---

## Out of scope (for later)

- **Hotel Prices feed** — push live prices/availability so Google shows competitive rates next to OTAs. Requires a server endpoint on `amanthos-website-api`. Add when paid Hotel Ads is activated.
- **Transaction Messages (ARI Push)** — real-time inventory updates. Only worth it if booking volume justifies it.
- **Paid Hotel Ads (CPC bidding)** — separate programme; opt in after Free Booking Links is live and converting.
