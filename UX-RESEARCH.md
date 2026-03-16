# CostMini UX Research — Competitive Analysis & User Experience Patterns

> Comprehensive research on how similar tools function and how users experience medicine price comparison, prescription scanning, and healthcare commerce — via website and WhatsApp.
>
> Research covers 14+ platforms across global and Indian markets.

---

## Table of Contents
1. [GoodRx (US Gold Standard)](#1-goodrx-us-gold-standard)
2. [Cost Plus Drugs (Radical Transparency)](#2-cost-plus-drugs-radical-transparency)
3. [Amazon Pharmacy](#3-amazon-pharmacy)
4. [Blink Health](#4-blink-health)
5. [Indian Competitors (Truemeds, 1mg, PharmEasy, RxJinn, DavaIndia)](#5-indian-competitors)
6. [Professional Drug Info (Epocrates, Drugs.com, WebMD)](#6-professional-drug-info-tools)
7. [Medication Management (Medisafe, NHS App)](#7-medication-management-apps)
8. [Prescription Scanner Apps](#8-prescription-scanner-apps)
9. [WhatsApp Healthcare Commerce](#9-whatsapp-healthcare-commerce)
10. [Cross-Cutting UX Pattern Analysis](#10-cross-cutting-ux-pattern-analysis)
11. [User Journey Maps](#11-user-journey-maps)
12. [Top Recommendations](#12-top-recommendations)

---

## 1. GoodRx (US Gold Standard)

### Price Comparison Presentation
- **Card-based layout with pharmacy logos**: Each pharmacy gets a horizontal card — logo (left), price in large bold green text (center), "Get Free Coupon" CTA (right). NOT a traditional table.
- **Price anchoring**: Shows "Retail Price" (crossed out gray, e.g., ~$45) above discounted price (bold green, e.g., $8.22). Savings percentage as badge ("Up to 82% off").
- **Quantity/dosage selector**: Horizontal bar at top — drug form (tablet/capsule/liquid), dosage (250mg/500mg), quantity (30/60/90). Prices update dynamically.
- **Map integration**: "Prices Near You" map with pharmacy price pins. Toggle between list and map view.

### Generic/Brand Switching
- **"Switch to Generic" banner**: Prominent yellow/green banner says "A generic version is available" with exact savings ("Save $120 by switching").
- **Tabbed interface**: Brand and generic on same page as tabs, not separate pages.

### Search & Autocomplete
- Single search bar hero on homepage: "Search for your medication"
- Typeahead shows drug names AND conditions ("amo" → "Amoxicillin" + "Infection")
- Autocomplete shows drug form: "Amoxicillin (Generic for Amoxil) - Capsule"
- Recent searches for logged-in users

### Trust Signals
- "FDA-approved" badge, "GoodRx verified" stamps
- Partner pharmacy logos (CVS, Walgreens, Walmart)
- "Accepted at 70,000+ pharmacies" counter
- "Price last checked [date]" on every price
- User review counts and ratings for pharmacies

### Mobile Experience
- Bottom navigation bar (Search, My Rx, Savings, Account)
- Swipeable pharmacy price cards
- Barcode scanner for pill bottles
- Location-based results as default
- Large, senior-friendly fonts and high contrast

### Personalization
- "My Prescriptions" dashboard
- Price alert notifications for drops
- Insurance toggle (with/without)
- Family profiles for multiple people
- Pharmacy preference default

### Key Takeaways for CostMini
- Fuzzy search is table stakes — users misspell drug names constantly
- Price-anchoring (MRP crossed out + savings %) is the single most proven conversion pattern
- Pharmacy cards > tables for comparison display
- Pill identifier is a powerful differentiator (Phase 2 medicine bottle scanning)
- Large fonts matter — healthcare users skew older

---

## 2. Cost Plus Drugs (Radical Transparency)

### Price Presentation
- **Cost breakdown table**: Manufacturing cost + 15% markup + $3 pharmacist fee + $5 shipping = Total. Transparency IS the brand.
- **Single price, no comparison**: Shows "Average retail price: $XXX" vs "Our price: $XX" — implicit comparison.
- **Clean, minimal cards**: Apple-store aesthetic. White card, drug name, dosage, one bold price.

### Generic-Only Model
- Only sells generics. Brand name shown in parentheses as reference.
- "Same FDA-approved medications" messaging throughout.

### Key Takeaway for CostMini
- Cost breakdown transparency is extremely powerful for India where trust in pricing is low.
- Showing "MRP: Rs.500, Wholesale: Rs.150, Platform markup: Rs.20, You pay: Rs.170" would be revolutionary and unprecedented in India.

---

## 3. Amazon Pharmacy

### Price Presentation
- **Prime vs. non-Prime pricing**: Two-column display drives Prime conversions.
- **Insurance toggle**: Switches between "With Insurance" and "Without Insurance" views.
- **Familiar Amazon card layout**: Drug listings look like product cards with ratings and "Subscribe & Save."

### Personalization
- Full prescription management dashboard
- Auto-refill / Subscribe & Save for medications
- Insurance card on file
- Alexa reminders for medication adherence

### Key Takeaway for CostMini
- Auto-refill subscription model drives retention. For CostMini, a "with/without insurance" toggle could become "MRP vs. best available price."

---

## 4. Blink Health

### Visual Price Comparison
- **Horizontal bar graph**: "Average cash price" (long red/gray bar) vs. "Blink price" (short green bar). Visual ratio creates emotional impact.
- **Condition-based search**: Search by condition ("high blood pressure") → see all relevant medications with prices.
- **"Pay online, pick up in store"** unique flow.

### Key Takeaway for CostMini
- Bar-graph comparison is more emotionally impactful than a table of numbers. Easy to implement.
- Condition-based search is an excellent discovery pattern for Indian users who know their condition but not the drug name.

---

## 5. Indian Competitors

### 5.1 Truemeds (Direct Competitor)
**Core Flow:**
1. User uploads prescription photo (website or app)
2. Algorithm scans 2 lakh+ medicines for generic alternatives
3. **Doctor calls within 15 minutes** to confirm substitution
4. Order placed with generic — avg 47% savings for switchers

**UX Patterns:**
- Upload front-and-center — single CTA "Upload Prescription"
- Doctor consultation is **free** — massive trust builder
- "You save Rs. X" prominently on every substitution
- Before/after comparison: branded price vs generic price
- Trust: "Verified by licensed doctors", "CDSCO approved"

**Takeaway:** Doctor-in-the-loop builds trust that pure algorithm can't match. Upload-first flow converts better than search-first. Savings in rupees > savings in percentage.

### 5.2 1mg / Tata 1mg
- Unified search: medicines, lab tests, doctors, health articles
- "Alternatives" tab on every drug page showing generics sorted by price
- Drug monograph pages (uses, side effects, interactions) — drives organic SEO traffic
- Medication tracker and health records in app
- Single pharmacy (own), so no multi-pharmacy comparison

**Takeaway:** Drug monograph pages are SEO goldmines. CostMini Phase 5 aligns perfectly.

### 5.3 PharmEasy
- Prominent "Upload Prescription" with camera and gallery options
- Auto-detect medicines from prescription (OCR-based)
- Cart-based ordering with delivery tracking
- Refill reminders based on past orders
- WhatsApp used for order notifications only — NOT automated bot

**Takeaway:** PharmEasy's real API already integrated. Their upload flow is proven — mirror camera/gallery toggle.

### 5.4 RxJinn (Price Comparison)
- Direct price comparison across 1mg, Apollo, Netmeds, Truemeds
- Simple search bar, results as comparison table
- Links out to each pharmacy for purchase
- No scoring algorithm — pure price comparison
- Minimal UI, functional but unpolished

**Takeaway:** CostMini's scoring algorithm is the clear differentiator. Multi-pharmacy comparison table is the expected format.

### 5.5 DavaIndia (Generic Focus)
- Sources only generic medicines, delivers to doorstep
- Doctor verification on every order
- "Generic-first" positioning resonates with cost-conscious Indians

### Competitive Differentiation Table

| Feature | RxJinn | Truemeds | 1mg | CostMini |
|---------|--------|----------|-----|----------|
| Multi-pharmacy comparison | Yes | No | No | **Yes (8 pharmacies)** |
| Quality scoring | No | Basic | No | **Advanced (multi-factor)** |
| Safety personalization | No | Doctor call | No | **Algorithm + patient profile** |
| Prescription scan | No | Yes | Yes | **Yes (multi-image)** |
| WhatsApp bot | No | No | No | **Yes (planned)** |
| Medicine bottle scan | No | No | No | **Yes (planned)** |
| Price alerts | No | No | Yes | **Yes (planned)** |
| Open/transparent algorithm | No | No | No | **Yes (score breakdown)** |

---

## 6. Professional Drug Info Tools

### 6.1 Epocrates
- **Color-coded severity**: Interactions shown as red (contraindicated), orange (major), yellow (moderate), green (minor) bars.
- **Multi-drug interaction checker**: Input 2-10 drugs → interaction matrix.
- **Pill identifier**: Camera or manual entry (color, shape, imprint code).
- Structured monograph layout: Dosing, Interactions, Adverse Effects, Contraindications, Pharmacology.

### 6.2 Drugs.com
- **Community drug reviews with ratings**: Users rate 1-10 on effectiveness, ease of use, satisfaction.
- **Interaction checker**: Sequential "Add drug" flow builds list → pairwise severity matrix.
- **Plain-language + clinical toggle**: Serve both patients and professionals.
- **Condition-centric pages**: All treatments for a condition with user ratings.

### 6.3 WebMD
- **Step-by-step wizard**: (1) Enter drugs → (2) Review list → (3) View interactions. Progress bar at top.
- **Food/alcohol interactions** included, not just drug-drug.
- "Medically Reviewed" badge with doctor name and credentials.

### Key Takeaways for CostMini
- Color-coded interaction severity (red/orange/yellow/green) is universal language
- Step-by-step wizard reduces cognitive load for complex tasks
- Community reviews are a trust and engagement tool
- Food/alcohol interactions are a differentiator often overlooked

---

## 7. Medication Management Apps

### 7.1 Medisafe
- **Visual pill reminder**: Large colorful pill icons on daily timeline. Tap to confirm taken.
- **"Medfriend" system**: Family member notified if you miss a dose — social accountability.
- **Drug interaction warnings**: Immediate warnings when adding a new med. Red/yellow/green severity.
- **Adherence calendar heatmap**: Green = taken, red = missed, yellow = late.

**Takeaway:** Medfriend/caregiver notification is brilliant for Indian family-centric healthcare. Adherence heatmap drives daily engagement.

### 7.2 NHS App (UK)
- **Timeline-based medication list** with renewal dates
- **One-tap repeat prescription ordering** — core value prop
- **Status pipeline**: Requested → Approved → Ready to Collect → Collected
- Full medical record access integrated

**Takeaway:** Prescription status pipeline and repeat ordering are excellent retention patterns.

### 7.3 Chemist Warehouse (Australia)
- Autocomplete with product thumbnails (visual recognition)
- Loyalty points on every product
- Deep categorization via mega-menu

**Takeaway:** Product images in autocomplete significantly improve recognition.

---

## 8. Prescription Scanner Apps

### Medicine & Supplement Scanner Apps
- Camera captures medicine bottle/pack label
- OCR extracts: brand name, active ingredients, manufacturer, expiry, batch number
- Cross-references against drug database
- Shows alternatives, interactions, side effects

### Prescription Reader AI
- Handwriting recognition for doctor prescriptions (notoriously illegible)
- Extracts: drug name, dosage, frequency, duration, quantity
- Confidence scores for each extracted field
- Multi-language support (critical for India — English, Hindi, regional languages)

### Google Lens Medicine Scanning
- **Point-and-scan**: Camera viewfinder with real-time text recognition
- **Smart card overlay**: Results shown ON camera view — drug name, dosage, manufacturer, quick links
- **Barcode/QR scanning** for exact product identification

### Key Takeaways for CostMini
- Two distinct scan modes: prescription vs medicine pack (already planned)
- Confidence scores should be shown to users — transparency about AI accuracy
- Handwriting recognition is hardest — Gemini 2.5 Flash handles this well
- Overlay-card pattern (results on camera view) reduces friction
- Batch/expiry extraction is a future differentiator (authenticity verification)

---

## 9. WhatsApp Healthcare Commerce

### 9.1 JioMart WhatsApp (Best-in-Class)
**Flow:**
1. Send "Hi" → welcome + interactive list menu
2. "Browse Categories" → WhatsApp List Message with categories
3. Product cards with images, prices, "Add to Cart" buttons
4. Cart summary as formatted text → checkout link to web for payment
5. Order confirmation via template message

**Results:** **9x order growth, 6x new customer conversion** vs traditional channels.

**Key Patterns:**
- Entry points: wa.me links, QR codes, SMS campaigns
- Uses WhatsApp's native Product Catalog (multi-product messages, up to 30 items)
- Payment handoff to web (no in-chat payment)
- English and Hindi via language selection prompt

### 9.2 WhatsApp Business API Capabilities

| Type | Description | Limits |
|------|-------------|--------|
| Text | Plain text with markdown | 4096 chars |
| Image | JPEG/PNG with caption | 5MB max |
| Interactive Buttons | Text body + reply buttons | 3 buttons max, 20-char titles |
| List Message | Header + body + selectable rows | 10 rows max, 24-char titles |
| Template Message | Pre-approved outbound messages | Must be Meta-approved |
| Multi-Product | Products from catalog | Up to 30 products |
| Flows | Multi-step forms (newer feature) | JSON-defined screens |

**24-Hour Session Window:** After user message, 24h for free-form replies. After that, only template messages.

### 9.3 Current State of Indian Pharmacy WhatsApp Bots

**PharmEasy:** Notifications only (order confirmation, delivery). Prescription uploads processed by human agents, not bots. User sends photo → auto-reply → human pharmacist reviews → calls back.

**1mg (Tata 1mg):** Order tracking and notifications only. No automated search.

**No major Indian pharmacy has a fully automated WhatsApp bot that does instant medicine search + price comparison + prescription OCR.** This is CostMini's market gap.

### 9.4 Proven Health Bot Patterns

**MyGov Corona Helpdesk (70M+ users):**
- Language toggle first (English/Hindi via buttons)
- Sequential button prompts over free-text input
- Quick replies minimize typing (important for low-literacy users)
- Stateless interactions

**HealthifyMe Diet Bot:**
- Image-in, instant-number-out pattern (food photo → calorie count)
- Analogous to CostMini's "prescription photo → savings amount"

**Practo:** Doctors already share prescriptions via WhatsApp. CostMini can be the natural next step: "Got a prescription on WhatsApp? Forward it to CostMini for cheaper alternatives."

### 9.5 Recommended CostMini WhatsApp Flow

```
FIRST CONTACT:
User: "Hi"
Bot: Welcome (language: English/Hindi buttons)
  -> [English] [Hindi]

MEDICINE NAME SEARCH:
User: "Dolo 650"
Bot: [<3 seconds]
  *Dolo 650 (Paracetamol 650mg)*
  Brand: Rs.30 | Generic: Rs.6
  Save 80%!
  [View All Prices] [Find Generic] [Share]

PRESCRIPTION IMAGE:
User: [photo]
Bot: "Analyzing your prescription..." (immediate)
Bot: [5-10 seconds later]
  Found 3 medicines:
  1. Dolo 650 -> Save 80%
  2. Azithral 500 -> Save 79%
  3. Pan 40 -> Save 89%
  Total savings: Rs.220!
  [View Details] [Scan Another]

PHARMACY PRICES (List Message):
  Section: "Pharmacy Prices for Dolo 650"
  - 1mg: Rs.25
  - PharmEasy: Rs.28
  - Netmeds: Rs.22
  - Apollo: Rs.30

SHARING:
Bot generates forward-ready message:
  "I saved Rs.220 on medicines using CostMini!
   Send your prescription to [number] to find cheaper alternatives.
   costmini.in"
```

### 9.6 WhatsApp Error Handling

| Scenario | Response |
|----------|----------|
| Unrecognized text | "I search for medicines. Type a name or send a prescription photo." + menu buttons |
| Blurry image | "Photo is unclear. Tips: Good lighting, hold steady, avoid shadows." |
| No medicines found | "Couldn't identify medicines. Try typing the name, e.g., 'Dolo 650'" |
| Not in database | "'{name}' not in our database yet. Try a different name." |
| Sticker/video/audio | "I can only process text and photos." |
| System error | "Something went wrong. Please try again in a moment." |

### 9.7 WhatsApp UX Constraints
- Max message: 4096 characters
- Max buttons: 3 (quick reply) or 10 (list)
- No tables — use formatted text with line breaks
- Rate limits: 1000 messages/phone/day (business tier)
- iPhone users may send HEIC images (not supported) — need conversion
- Image download URLs expire quickly — process immediately
- Send "typing..." indicator while processing (10-15 second budget)
- Number-based menus as fallback for older WhatsApp versions

### 9.8 Gaps in Current CostMini WhatsApp Implementation

1. No real OCR — `handleDemoImageScan` returns hardcoded data
2. No interactive messages (buttons/lists) in webhook handler
3. English-only, no language selection
4. No session/context management
5. No share/viral mechanics in responses
6. No typing indicators while processing
7. No rate limiting
8. No document type handling (PDF prescriptions)

---

## 10. Cross-Cutting UX Pattern Analysis

### A. Price Comparison Display (Ranked by Effectiveness)

| Pattern | Used By | Why It Works |
|---------|---------|-------------|
| Card list with pharmacy logos | GoodRx, RxSaver | Logos = instant recognition; vertical scan natural |
| Visual bar comparison | Blink Health | Emotional impact of seeing size difference |
| Cost breakdown table | Cost Plus Drugs | Transparency builds trust |
| Price anchoring (MRP crossed out) | GoodRx, all Indian apps | Proven conversion driver |
| Map with price pins | GoodRx | Less relevant for online-only India |

**Recommendation:** Hybrid of card-list (primary) + cost breakdown (differentiator). Each card: pharmacy logo, price (large), MRP (crossed out), savings %, CostMini Score badge, freshness indicator, CTA.

### B. Generic/Brand Switching

| Pattern | Used By | Notes |
|---------|---------|-------|
| Prominent banner alert | GoodRx | "Save $X by switching" — most effective |
| Tab switching | GoodRx | Brand/Generic tabs on same page |
| Side-by-side comparison | Blink Health | Two columns: brand vs generic |
| AI-suggested in chat | Emerging | "You could save 80% with the generic" |

**Recommendation:** GoodRx-style banner on branded drug pages: "Generic alternative: [Name] — Save up to Rs.XX. [View Prices]"

### C. Trust Signal Patterns

| Signal | Applicability to India |
|--------|----------------------|
| Regulatory badges (CDSCO/DCGI) | High |
| "Price last updated" timestamp | Critical — already have freshness |
| "Comparing 8 pharmacies" count | High |
| Professional review badges | Medium |
| Cost transparency/breakdown | Very High — unprecedented in India |
| Aggregate savings counter | High — "Users saved Rs.X lakhs" |

### D. Mobile vs Desktop

| Feature | Desktop | Mobile |
|---------|---------|--------|
| Price comparison | Full table/list | Swipeable cards |
| Search | Wide bar + sidebar filters | Full-screen overlay |
| Drug detail | Multi-column | Single column, accordion |
| Navigation | Top navbar | Bottom tab bar (5 items) |
| Camera | N/A | Barcode/prescription scan |
| Share | Email/print | WhatsApp share sheet |

**Recommendation:** Bottom tab navigation: Home, Search, Scan, My Meds, More.

### E. Personalization Patterns

| Feature | Platforms | Value |
|---------|-----------|-------|
| Saved medication list | GoodRx, Amazon, Medisafe | Core retention |
| Price drop alerts | GoodRx | Re-engagement |
| Auto-refill reminders | Amazon, NHS | Recurring value |
| Family profiles | GoodRx, Medisafe | Multi-user households |
| Adherence tracking | Medisafe | Daily engagement |

**Recommendation:** Start with localStorage-based "My Medicines" (no login required). Allow saving 3-5 drugs, show price changes on return visit.

---

## 11. User Journey Maps

### Journey 1: Price-Conscious Patient (Website)
```
Google search "cheap alternative for [drug]"
  -> Lands on drug detail page (SEO)
  -> Sees price comparison across 8 pharmacies
  -> CostMini Score highlights "Best Value"
  -> Clicks through to pharmacy
  -> Bookmarks CostMini
```

### Journey 2: Prescription Upload (Website)
```
New prescription from doctor
  -> Opens CostMini, "Scan Prescription"
  -> Takes photo
  -> AI extracts 3-5 medicines
  -> Each: current drug, generic alternative, savings
  -> "Save Rs.1,200/month" prominently shown
  -> Shares via WhatsApp to family
```

### Journey 3: WhatsApp Viral Loop
```
Receives WhatsApp forward: "Check medicine prices on CostMini"
  -> Messages CostMini number
  -> Sends prescription photo
  -> Gets alternatives + savings in chat
  -> "View full comparison" link opens website
  -> Shares own results with family
  -> VIRAL LOOP COMPLETE
```

### Journey 4: Medicine Bottle Check (Mobile)
```
Has existing bottle, wonders about cheaper options
  -> CostMini > "Scan Medicine"
  -> Photo of bottle label
  -> AI reads brand name + composition
  -> Shows identical generics at lower prices
  -> Manufacturer quality comparison
  -> Orders generic from recommended pharmacy
```

### Journey 5: Chronic Patient Retention
```
Takes 3-4 daily medications (diabetes + BP)
  -> Sets up medication tracker
  -> Monthly price alerts when generics get cheaper
  -> Quarterly prescription re-scan
  -> CostMini becomes habitual tool
```

---

## 12. Top Recommendations

### Highest Impact, Lowest Effort
1. **Price anchoring on every card** — Always show MRP struck through + green "Save XX%" badge
2. **Generic switch banner** — Prominent dismissible banner with exact rupee savings
3. **Enhanced WhatsApp sharing** — Pre-formatted message with drug name, cheapest price, savings, deep link

### Highest Impact, Medium Effort
4. **Bottom tab navigation (mobile)** — Home, Search, Scan, My Meds, More
5. **"My Medicines" saved list** — localStorage, no login wall, show price changes on return
6. **Cost transparency breakdown** — "Why this price?" expandable section (unprecedented in India)
7. **Condition-based browse** — "Diabetes Medicines" landing pages for SEO + discovery

### Highest Impact, Higher Effort
8. **Drug interaction checker** — Multi-drug input → color-coded severity matrix
9. **Aggregate savings counter** — Homepage "CostMini users saved Rs. X lakhs"
10. **Visual price comparison bars** — Horizontal bar chart per pharmacy (like Blink Health)

### Anti-Patterns to Avoid
1. Requiring login before showing prices — show value first
2. Too many filters on mobile — use smart defaults, hide advanced in sheet
3. Medical jargon — "Bioequivalence" → "Same medicine, different brand"
4. Slow loading without feedback — SSE streaming with per-pharmacy progress (already correct)
5. Ignoring Hindi users — drug names searchable in Hindi transliteration at minimum

---

## Platform Quick Reference

| Platform | Key Innovation | CostMini Can Adopt? |
|----------|---------------|---------------------|
| GoodRx | Price anchoring + pharmacy cards | Yes (cards + anchoring) |
| Cost Plus Drugs | Cost transparency breakdown | Yes (first in India) |
| Blink Health | Visual bar-graph comparison | Yes, easy |
| Truemeds | Doctor-in-the-loop trust | Consider partnerships |
| Medisafe | Adherence + Medfriend alerts | Future (high value for India) |
| Epocrates | Color-coded interaction severity | Yes, for safety info |
| JioMart WhatsApp | Conversational commerce | Yes, growth engine |
| Google Lens | Camera overlay results card | Enhance scan feature |

---

---

## Appendix: Live Browser Research Findings (March 2026)

### GoodRx — Amoxicillin Drug Page (goodrx.com/amoxicillin)
- Heading "Amoxicillin" + subtitle "Generic Amoxil" — instant brand/generic identification
- **Dosage-specific pricing tables**: capsules, oral suspension, chewable tablets, regular tablets — each with Retail Price vs GoodRx Price columns
- Prescription settings selector (form/dosage/quantity) at top of price section
- "Home delivery prices" as separate section with 3 pharmacy cards
- "Other Penicillin Antibiotics" section — 14 related drug links
- "Related conditions" section (Ear Infection, Skin Infection, UTI, etc.)
- **A-Z drug browse** in footer — strong SEO pattern
- 10+ expert-written articles below prices ("Read more about amoxicillin")
- Newsletter signup, app download CTAs, LegitScript/BBB/NABP trust badges in footer

### 1mg — Dolo 650 Drug Page (1mg.com/drugs/dolo-650-tablet-74467)
- **Per-unit pricing**: Rs.2.08/tablet shown prominently
- **MRP vs sale price**: Rs.32.13 → Rs.31.20 (3% off)
- **5 substitutes with per-unit comparison** inline:
  - Welset 650: Rs.1.35/tab (35% cheaper)
  - Leemol 650mg: Rs.1.49/tab
  - Parafast 650mg: Rs.1.52/tab
  - P 650: Rs.1.93/tab
  - Pacimol 650: Rs.1.83/tab
- "View all substitutes" link for full list
- Tab navigation: Drug Info | Side Effects | Dosage | Medicare
- Separate Safety Advice and Drug Interactions sections
- **NPPA Regulated** badge — government price control trust signal
- Clickable manufacturer link (Micro Labs Ltd → manufacturer page)
- Image carousel (6+ slides) for drug packaging photos
- Quantity selector + Add to Cart

### PharmEasy — Search Results (pharmeasy.in/search/all?name=dolo%20650)
- **"Save X% with Branded Substitute"** callout on specific drugs — inline upsell for generics
- MRP struck through + discount percentage ("27% OFF")
- Pack size on every card ("15 Tablet(s) in Strip")
- Manufacturer on every card ("By MICRO LABS")
- Sponsored results clearly labeled ("SPONSORED")
- "What is a valid prescription?" helper at bottom
- Clean card layout — image | name | manufacturer | pack | price | CTA

### Truemeds — Savings Calculator (truemeds.in/savings-calculator)
- **Multi-medicine input**: 5-8 slots for entering medicines with Rs. amount
- "Recommended Substitute" column shows alternatives
- "Calculate Savings" CTA computes total monthly savings
- "Add More" button to add beyond 5 medicines
- Headline: "Check how much you can save on your monthly medicine expenses"
- Search bar with trending medicines: ECOSPRIN, GLYCOMET, ATORVA, STAMLO, etc.
- "Understanding Generic Medicines" educational link in nav

### Apollo Pharmacy — Search Results (apollopharmacy.in/search-medicines/dolo%20650)
- Product cards show composition alongside product name
- Coupon discounts visible on applicable cards
- Mixed results: medicines + related OTC products (nasal sprays, ointments, lozenges)
- Dolo-650: Rs.32, Paracip-650: Rs.16.80, Crocin 650: Rs.32
- Alternative generics visible in same search results (Aquris Acupara 650mg: Rs.15.60)

### Key Patterns Confirmed by Live Research

1. **Per-unit pricing is standard** — 1mg shows Rs/tablet on every drug, making pack-size-agnostic comparison possible. CostMini should adopt this.

2. **Substitute comparison is inline** — 1mg shows 5 substitutes with per-unit prices directly on the drug page, not hidden behind a link. CostMini should show generic alternatives prominently on drug detail pages.

3. **MRP anchoring is universal** — Every Indian pharmacy crosses out MRP and shows discounted price. CostMini already does this via price comparison but should make the anchoring more visual.

4. **PharmEasy's "Save X% with Substitute" callout** is the most actionable pattern — a simple inline banner that converts browsers into generic-switchers.

5. **Truemeds' savings calculator** is unique and worth replicating. Multi-medicine total savings is more compelling than single-drug savings.

6. **NPPA badge (1mg)** is a trust signal CostMini should adopt for price-controlled drugs.

7. **Manufacturer as clickable link** — 1mg links to manufacturer page. CostMini already has this via /manufacturers/[slug].

---

*Research compiled from analysis of 14+ platforms: GoodRx, Cost Plus Drugs, Amazon Pharmacy, Blink Health, RxSaver, Truemeds, 1mg, PharmEasy, RxJinn, DavaIndia, Chemist Warehouse, Medisafe, NHS App, Epocrates, Drugs.com, WebMD, JioMart WhatsApp, HealthifyMe, MyGov Corona Helpdesk, and Google Lens. Live browser verification conducted March 2026.*
