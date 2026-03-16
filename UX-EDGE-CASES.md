# CostMini UX Edge Cases — Complete Audit

> Every edge case across all user journeys, states, devices, and error conditions.
> Organized by page/feature. Severity: CRITICAL / HIGH / MEDIUM / LOW.
> Status: BUG (exists now) / MISSING (needs implementation) / RISK (potential future issue)

---

## 1. SEARCH & AUTOCOMPLETE

### 1.1 Case-Sensitive Search on SQLite [CRITICAL / BUG]
SQLite `contains` without `mode: "insensitive"` is case-sensitive. User types "DOLO" or "dolo" but DB stores "Dolo 650" — gets zero results. The `q.toLowerCase()` in the API doesn't help because Prisma `contains` compares against the DB value directly.
**Fix:** Use raw SQL `LOWER(name) LIKE LOWER(?)` or `COLLATE NOCASE` on SQLite columns. Alternatively, store a `nameLower` indexed column.

### 1.2 No Fuzzy Matching [HIGH / MISSING]
User types "paracetmol" (misspelled) — zero results, no "Did you mean?" suggestion. Indian drug names are often long and easy to misspell (e.g., "azithromycin" → "azithromicin").
**Fix:** Implement Levenshtein distance or trigram matching. At minimum, strip common suffixes and try partial matches.

### 1.3 Autocomplete Shows Nothing for Valid Queries [HIGH / BUG]
Autocomplete requires `q.length >= 2`. User types "D" expecting to see "Dolo 650" — nothing happens. For single-character common searches this feels broken.
**Fix:** Consider showing popular/trending drugs on focus (before any typing), reduce threshold to 1 character.

### 1.4 Autocomplete Dropdown Hidden on Mobile Keyboard [MEDIUM / BUG]
When mobile keyboard is up, the autocomplete dropdown may be hidden behind it or require scrolling. The dropdown renders below the input but viewport is small with keyboard open.
**Fix:** On mobile, consider full-screen search overlay (like Google/Amazon mobile search).

### 1.5 Autocomplete Doesn't Handle Enter Without Selection [LOW / BUG]
User types "paracetamol" and presses Enter without selecting from dropdown — nothing happens. Expected: navigate to medicines list filtered by that query.
**Fix:** On Enter with no selection, navigate to `/medicines?q={query}`.

### 1.6 Stale Autocomplete Cache [LOW / RISK]
Autocomplete caches results for 10 minutes. If drugs are added during that window, they won't appear in autocomplete until cache expires.
**Fix:** Acceptable for now; document as known limitation.

---

## 2. MEDICINES LIST PAGE

### 2.1 Price Sorting is Client-Side Only [HIGH / BUG]
Sort by "Price: Low to High" only sorts the current page of results. If cheapest drug is on page 2, user never sees it first. The API comment says `// We'll sort client-side for price since it's on related table`.
**Fix:** Implement server-side price sorting via Prisma raw query or a computed column.

### 2.2 Zero-Price Drugs Get Best Value Score [HIGH / BUG]
Drugs with `lowestPrice: 0` (never scraped, no prices in DB) get an inflated discount ratio in `computeQuickScore()`. Division `(highestMrp - 0) / highestMrp = 1.0 = 40 points`.
**Fix:** Filter out drugs with `lowestPrice === 0` from the "Best Value" sort, or assign them score 0.

### 2.3 Filter State Lost on Navigation [MEDIUM / MISSING]
User applies filters (category: Antibiotics, generic only), clicks a drug, hits browser Back — all filters reset to defaults. The URL doesn't reflect filter state.
**Fix:** Sync filter state to URL search params: `/medicines?category=Antibiotics&generic=true`. Read params on mount.

### 2.4 Infinite Scroll + Client-Side Filter Mismatch [MEDIUM / BUG]
Client-side filters (in-stock, WHO-certified, price range) run after server fetch. If server returns 20 results but client filter removes 15, user sees only 5 cards but infinite scroll has already triggered loading page 2.
**Fix:** When client-side filtering reduces visible count significantly, show a message: "Showing 5 of 20 loaded. Adjust filters to see more."

### 2.5 Multiple Concurrent Fetches [MEDIUM / BUG]
Rapid filter changes trigger multiple `fetchDrugs` calls via the 300ms debounce. If user clicks 3 category buttons quickly, multiple requests fire and last-to-resolve wins (but may not be last-requested).
**Fix:** Use AbortController to cancel previous fetch when a new one starts.

### 2.6 Sort Pills Not Scrollable-Indicating [LOW / MISSING]
7 sort options overflow on mobile. `overflow-x-auto` works but no visual indicator (gradient fade, arrow) tells user there are more options.
**Fix:** Add gradient overlay on right edge when scrolled, or use shadcn ScrollArea.

### 2.7 Manufacturer Tier Dot is Cryptic [LOW / MISSING]
Small colored dot next to manufacturer name on drug cards. No legend, tooltip is only on hover (not available on mobile touch).
**Fix:** Replace dot with a small badge label ("Premium", "Trusted") or add an info icon that opens a bottom sheet explaining tiers.

---

## 3. DRUG DETAIL PAGE

### 3.1 Price Table Unusable on Mobile [CRITICAL / BUG]
8-column table with `overflow-x-auto` but no sticky columns. On mobile (390px), user sees pharmacy name column and nothing else without scrolling. Critical info (price, stock status) is off-screen.
**Fix:** On mobile, switch to card layout instead of table. Each pharmacy gets a card with all info stacked vertically.

### 3.2 SSE Stream Never Auto-Starts [HIGH / MISSING]
`usePriceStream` provides a `refresh` function but never calls `startStream` automatically. User must click "Live Prices" button to trigger streaming. Most users won't know to do this.
**Fix:** Auto-start stream on page load for drugs with stale cached prices. Keep manual refresh as backup.

### 3.3 SSE Connection Stays Open After Navigation [HIGH / BUG]
`useEffect` cleanup closes EventSource on unmount, but React 18 strict mode double-mounts in dev. Also, if user navigates using browser back/forward (no unmount), EventSource may leak.
**Fix:** Verified that cleanup runs on unmount; test in production build. Consider adding a 30-second timeout on streams.

### 3.4 Multiple Tabs Open Same Drug [MEDIUM / RISK]
User opens 5 drugs in new tabs. Each fires SSE streaming (8 scrapers each). That's 40 concurrent scraper requests. Could get IP blocked by pharmacy sites.
**Fix:** Rate limit at the API level. Queue scraper requests globally, max 2 concurrent pharmacy checks.

### 3.5 "Buy on [Pharmacy]" Links May Be Dead [MEDIUM / RISK]
Scraped URLs expire. PharmEasy product URLs change, Apollo restructures pages. User clicks "Buy on PharmEasy" and gets a 404.
**Fix:** Add `target="_blank"` (already done) + fallback: if sourceUrl is stale, link to pharmacy search page instead. Consider link health checking in cron.

### 3.6 No Prices Available — No Guidance [MEDIUM / BUG]
When `sortedPrices.length === 0` and not streaming, shows "No prices available. Check live prices." But if live prices also return nothing (drug not found on any pharmacy), user is stuck.
**Fix:** Show "This medicine may be available under a different name or pack size. Try searching for [generic name] on these pharmacies:" with direct pharmacy links.

### 3.7 Score Column Empty When Scores Not Computed [LOW / BUG]
`scores[price.source]` can be undefined if the API doesn't return scores. Column shows "—". User doesn't know what CostMini Score means.
**Fix:** Either always compute scores (even estimated), or hide the Score column entirely when no scores are available.

### 3.8 Manufacturer Not In DB [LOW / BUG]
`manufacturerRef` is null for some drugs. The header area handles this gracefully, but the CostMini Score algorithm can't compute quality score.
**Fix:** Show "Unrated manufacturer" label. Score algorithm should use a conservative default (50/100) for unknown manufacturers.

### 3.9 Drug Detail From Direct URL (No Back State) [LOW / MISSING]
User lands on `/medicines/dolo-650` from Google. "Back to Medicines" goes to `/medicines` with no preserved context.
**Fix:** This is acceptable behavior. The back link is correct. Consider breadcrumbs: Home > Medicines > Dolo 650.

---

## 4. SCAN / PRESCRIPTION PAGE

### 4.1 Single Image Only [HIGH / MISSING]
Current scan accepts only one file. User with a 3-drug prescription on 2 pages, or multiple medicine bottles, must scan one at a time.
**Fix:** Accept multiple files in `<input multiple>`. Process each image independently. Show results grouped by image.

### 4.2 No Medicine Bottle/Pack Mode [HIGH / MISSING]
Page title says "AI Prescription Scanner" but user wants to scan a medicine bottle label. Different AI prompt needed (read brand name, composition, MFG date, expiry).
**Fix:** Add mode toggle: "Scan Prescription" vs "Scan Medicine Pack". Different Gemini prompts for each.

### 4.3 Blurry/Unreadable Image — Bad Error Message [MEDIUM / BUG]
Error message is generic: "Could not analyze the prescription. Please try a clearer photo." No tips on HOW to take a clearer photo.
**Fix:** Add photo tips: "Hold your phone steady", "Ensure good lighting", "Include all text in the frame", "Avoid shadows on the prescription".

### 4.4 Handwritten Prescription Misread [MEDIUM / RISK]
Indian doctors' handwriting is notoriously illegible. Gemini reads "Amoxicillin" as "Amoxicilin" or worse. No user verification step.
**Fix:** After OCR, show extracted text with edit capability: "We read: [Amoxicillin 500mg]. Is this correct? [Edit] [Confirm]". Then proceed to matching.

### 4.5 Demo Scan Calls Failing Search API [MEDIUM / BUG]
`handleDemoScan` fetches `/api/drugs/search?q=paracetamol&limit=3`. If API returns 500 (SQLite case-sensitivity, empty DB), demo shows empty results with no error message.
**Fix:** Demo should use hardcoded sample data as fallback, not depend on live API.

### 4.6 Large File Upload on Mobile Data [MEDIUM / MISSING]
Modern phone cameras produce 5-10MB photos. No client-side compression before upload. Slow upload on 3G/4G, no progress indicator for upload phase.
**Fix:** Use canvas-based compression to ~500KB before uploading. Show upload progress bar.

### 4.7 Results Lost on Page Refresh [MEDIUM / BUG]
Scan results are in React state only. User refreshes page, everything is gone. Must re-scan.
**Fix:** Store results in `sessionStorage`. On mount, check for existing results and restore them. Or generate a shareable URL for scan results.

### 4.8 Camera Permission Denied [MEDIUM / MISSING]
"Take Photo" button triggers `fileRef.current?.click()` which opens file picker, not camera directly. On mobile, this shows both options. But if camera permission is denied at browser level, user gets no feedback.
**Fix:** For direct camera capture, use `capture="environment"` attribute on input. Handle permission denial with instructions.

### 4.9 PDF Upload Not Actually Supported [LOW / BUG]
Input accepts `.pdf` but Gemini Vision may not handle multi-page PDFs well. First page only? All pages concatenated?
**Fix:** Either convert PDF to images client-side (pdf.js), or remove PDF from accepted types and document limitation.

### 4.10 Extracted Drug Not In Database [LOW / HANDLED]
Current code shows amber banner: "This medicine is not yet in our database." Good, but could be more helpful.
**Fix:** Add "Search for [extracted name] on pharmacies directly" with links to 1mg/PharmEasy/etc.

---

## 5. AI SEARCH PAGE

### 5.1 No Conversation Context [HIGH / MISSING]
User asks "Compare Dolo 650 vs Crocin" → gets answer. Then asks "What about the 500mg version?" The API sends only the latest query, not conversation history.
**Fix:** Send full `messages` array to the AI endpoint. The Groq API supports multi-turn conversations.

### 5.2 AI Hallucinates Prices [HIGH / RISK]
LLM may generate fake prices like "₹45 for Dolo 650" that aren't from the DB. Current RAG approach injects DB data but LLM can still fabricate.
**Fix:** Post-process AI response: any ₹ amount should be cross-referenced against actual DB prices. Flag unverified prices with "Price not verified" indicator.

### 5.3 Chat Area Height Too Small on Mobile [MEDIUM / BUG]
`max-h-[60vh]` for the conversation area. On a 667px phone, that's ~400px. With keyboard open (~300px visible), the chat area is only ~100px visible.
**Fix:** Use `calc(100vh - [input height] - [header height])` or `dvh` units. On mobile, conversation should expand to fill available space.

### 5.4 Sources Panel Overflows on Mobile [MEDIUM / BUG]
Source cards are `w-48` (192px) in horizontal scroll. On 390px screen, only ~1.5 cards visible with no scroll indicator.
**Fix:** On mobile, stack sources vertically or show as chips/tags instead of full cards.

### 5.5 Sticky Input Covers Content on iOS [MEDIUM / BUG]
`sticky bottom-4` search input. On iOS Safari, the bottom sticky positioning interacts badly with the URL bar show/hide and keyboard.
**Fix:** Test on real iOS devices. May need `position: fixed` with explicit bottom calculation, or use `@supports` for iOS-specific fix.

### 5.6 URL Query Auto-Search Fires Every Re-render [LOW / BUG]
The `useEffect` for auto-search depends on `searchParams` and `initialQueryHandled`. If the URL doesn't change but the component re-renders, the guard `initialQueryHandled` prevents re-fire. This is correct, but if user manually navigates to `/search?q=new+query`, it won't auto-search (already handled = true).
**Fix:** Track the last auto-searched query. If URL param changes to a new value, fire again.

### 5.7 No Way to Share AI Conversation [LOW / MISSING]
User gets a great AI answer about drug comparison. No way to share it (link, copy, screenshot).
**Fix:** "Copy answer" button on each AI response. Optional: generate shareable URL for the conversation.

### 5.8 Empty State After Reset [LOW / MINOR]
User clicks reset (RotateCcw). Chat clears, suggested queries reappear. This is fine, but the URL still has `?q=old+query` from the initial navigation.
**Fix:** On reset, call `router.replace('/search')` to clear URL params.

---

## 6. WHATSAPP BOT (Planned)

### 6.1 Text Messages vs Image Messages [HIGH / MISSING]
Bot must handle both: image (scan prescription/bottle) AND text ("dolo 650 price"). Different processing pipelines.

### 6.2 Voice Notes [MEDIUM / MISSING]
Very common in India, especially elderly users. Bot receives audio, needs to either transcribe (Whisper API) or respond with "Please send a photo or text."

### 6.3 Video Messages [MEDIUM / MISSING]
User sends video of medicine shelf. Need: "Please send a clear photo instead of a video."

### 6.4 Message Length Limits [MEDIUM / RISK]
WhatsApp messages max ~4096 characters. A prescription with 8 drugs + alternatives could exceed. Need to split into multiple messages or summarize with website link.

### 6.5 Rate Limiting Per User [MEDIUM / MISSING]
Prevent abuse: max N messages per hour per phone number. Queue excess with polite response.

### 6.6 Session Continuity WhatsApp to Website [MEDIUM / MISSING]
Bot sends "View full comparison: costmini.in/scan/abc123". User taps link. Website should show the same results without re-scanning.
**Fix:** Generate short-lived scan result URLs stored in DB.

### 6.7 Non-Indian Users [LOW / MISSING]
International numbers messaging the bot. Drug database is India-specific.
**Fix:** Check phone number prefix. Respond with "CostMini currently covers Indian pharmacies."

### 6.8 Media Download Failure [LOW / RISK]
WhatsApp media URLs expire after a period. If webhook processing is slow, the download URL may be invalid by the time we fetch it.
**Fix:** Download media immediately on webhook receipt, before any processing.

---

## 7. PATIENT PROFILE (Planned)

### 7.1 Allergy to Inactive Ingredients [HIGH / RISK]
Patient allergic to lactose (common tablet filler). Algorithm checks active ingredients but not excipients. Dangerous false safety.
**Fix:** Include known excipient data in drug monographs. Flag excipient allergies separately.

### 7.2 Misspelled Allergy Names [MEDIUM / RISK]
User types "penicilin" instead of "penicillin". Interaction check misses the allergy.
**Fix:** Fuzzy match allergies against a standardized allergen database. Show autocomplete for allergy input.

### 7.3 Drug Interaction With Food/Alcohol [MEDIUM / MISSING]
Metformin + alcohol is dangerous. Warfarin + vitamin K foods. These aren't "drug" interactions but critical safety info.
**Fix:** Include food/substance interactions in the interaction database.

### 7.4 Outdated Patient Profile [MEDIUM / RISK]
Patient started a new medication 2 months ago, didn't update CostMini profile. Algorithm misses a critical interaction.
**Fix:** "Last updated: 2 months ago. Review your medications?" prompt. On each scan/search, ask "Are you taking any new medications?"

### 7.5 Privacy Concerns [HIGH / MISSING]
Health data stored in localStorage is vulnerable to XSS attacks, device theft, shared devices. Users may not trust entering their allergies and conditions on a website.
**Fix:** Optional PIN/biometric lock. Clear "Your data stays on your device" messaging. One-tap "Delete all health data" button. Never log health data server-side.

### 7.6 Pregnancy Category Edge Cases [LOW / RISK]
Some drugs are Category B in 1st trimester but Category D in 3rd. Simple "pregnant: yes/no" isn't enough.
**Fix:** Ask for trimester if pregnancy is selected. Use trimester-specific safety data.

---

## 8. ALGORITHM EDGE CASES (Planned)

### 8.1 Two Drugs Tie on Score [MEDIUM / RISK]
Exact same CostMini Score for two options. Which gets "Best Value" badge?
**Fix:** Tiebreaker hierarchy: (1) more pharmacies available, (2) fresher price data, (3) alphabetical.

### 8.2 Quality Premium vs Price Gap [HIGH / RISK]
Premium manufacturer drug costs 10x generic (₹500 vs ₹50). Algorithm says quality is higher but is it 10x better? Users may feel misled.
**Fix:** "Diminishing returns" modifier: quality premium contribution should be capped relative to price gap. Show explicit "You pay ₹450 more for [X quality factors]."

### 8.3 Unknown Manufacturer Score [MEDIUM / RISK]
Small/new manufacturer not in DB. Quality score defaults to 50/100 (middle). Could be unsafe OR actually great.
**Fix:** Show "Unrated manufacturer — limited quality data available" warning. Conservative scoring: default to 40, not 50.

### 8.4 Drug With No Adverse Effect Data [MEDIUM / RISK]
New drug or rare formulation with no safety profile in DB. Safety score can't be computed.
**Fix:** Conservative approach: assign lower safety score (60/100), flag "Limited safety data available."

### 8.5 Combo Drug Scoring [HIGH / RISK]
Minoxidil + Finasteride combination: adverse effects of the combo differ from individual drugs. Scoring each ingredient separately misses interaction effects.
**Fix:** Composition-level scoring model. Known combinations get their own adverse effect profiles. Unknown combos get additive risk with an interaction penalty.

### 8.6 Different Strengths Not Comparable [MEDIUM / RISK]
Paracetamol 500mg at ₹20 vs Paracetamol 650mg at ₹29. Price per mg is different. Direct price comparison is misleading.
**Fix:** Normalize to per-unit-dose cost when strengths differ. Show "per tablet" and "per mg" pricing.

### 8.7 All Options Score Below 50 [LOW / RISK]
Every available drug for a condition scores poorly (bad manufacturer data, limited availability, etc.).
**Fix:** Still recommend the best available, but add caveat: "No highly-rated options available for [condition]. We recommend consulting your pharmacist for alternatives."

### 8.8 Weight Shifting by Drug Category [MEDIUM / RISK]
Algorithm shifts weights based on category (chronic: quality heavy, OTC: price heavy). But what about drugs that span categories? Aspirin is OTC for headache but chronic for cardiac patients.
**Fix:** Use the patient's context (if available) to determine which weight profile applies. Default to the drug's primary classification.

---

## 9. CROSS-CUTTING UX

### 9.1 Back Button / History State [HIGH / MISSING]
User journey: Homepage → Medicines → Filter "Antibiotics" → Click Drug → Back button → Filters reset, scroll position lost.
**Fix:** Store filter state in URL params. Use `scrollRestoration: 'manual'` and save scroll position in sessionStorage.

### 9.2 No Loading Skeletons [MEDIUM / MISSING]
Pages show a single spinner while loading. No content-shaped placeholders that reduce perceived wait time.
**Fix:** Add skeleton components for: drug cards, price table rows, drug detail header. Use shadcn Skeleton.

### 9.3 No Offline Support [MEDIUM / MISSING]
PWA manifest exists but no service worker. User on unstable mobile connection sees blank page when offline.
**Fix:** Implement service worker with cache-first for static assets, network-first for API calls. Show "You're offline" banner with cached data.

### 9.4 No OG/Meta Tags for Social Sharing [MEDIUM / MISSING]
Sharing a drug detail page on WhatsApp/Facebook shows generic CostMini info, not drug-specific preview.
**Fix:** Dynamic OG tags in drug detail pages: title = drug name, description = price range, image = CostMini branded card.

### 9.5 Print View Needed [MEDIUM / MISSING]
Users want to print price comparisons to show doctors or pharmacists. Current page prints with navigation, footer, floating buttons.
**Fix:** `@media print` stylesheet: hide nav/footer/float, optimize table for print, add timestamp.

### 9.6 Accessibility Gaps [HIGH / MISSING]
- Color-coded tier dots have no text alternative
- Score badges rely on color alone (green/blue/gray)
- Streaming animations have no `prefers-reduced-motion` respect
- Autocomplete dropdown needs ARIA: `role="listbox"`, `aria-activedescendant`, `aria-expanded`
- Focus management after scan completion
- Screen reader can't understand price comparison table semantics

**Fix:** Audit with axe-core. Add ARIA attributes to autocomplete and interactive elements. Respect `prefers-reduced-motion`. Ensure 4.5:1 color contrast ratios.

### 9.7 Very Long Drug Names Break Layout [LOW / BUG]
Names like "Azithromycin Dihydrate + Cefixime Trihydrate 250mg/200mg" overflow card width on mobile.
**Fix:** `truncate` class with `title` attribute for full name on hover. Consider `line-clamp-2` for graceful wrapping.

### 9.8 No Rate Limiting on API Routes [HIGH / MISSING]
No rate limiting on any endpoint. Bot/scraper could hammer `/api/drugs/search` or `/api/ai/search` (which calls Groq).
**Fix:** Implement rate limiting middleware. At minimum: 60 req/min for search, 10 req/min for AI search, 5 req/min for scan.

### 9.9 No Error Boundary [MEDIUM / MISSING]
If any page component throws, user sees Next.js error page. No graceful recovery.
**Fix:** Add `error.tsx` in each route segment. Global error boundary with "Something went wrong" + retry/home links.

### 9.10 Dark Mode [LOW / MISSING]
Many Indian mobile users use dark mode. CostMini is hardcoded light theme.
**Fix:** CSS variables already used for brand colors. Add dark mode variants. Low priority but high polish factor.

### 9.11 Slow First Load (Cold Start) [MEDIUM / RISK]
Homepage is `force-dynamic` server component that queries DB. On Vercel cold start, this adds 2-5 seconds.
**Fix:** Use ISR with `revalidate: 3600` instead of `force-dynamic`. Stats don't need to be real-time.

### 9.12 Concurrent SSE Streams Exhaust Resources [MEDIUM / RISK]
Each drug detail page can fire 8 scraper requests. With multiple users, this becomes N*8 concurrent outbound HTTP requests.
**Fix:** Global request queue with concurrency limit. Pool scraper connections. Cache scraper results aggressively.

---

## 10. MOBILE-SPECIFIC EDGE CASES

### 10.1 Touch Targets Too Small [MEDIUM / BUG]
Filter toggle buttons (12px text, 24px height) are below the 44px minimum recommended touch target.
**Fix:** Minimum 44x44px touch targets on all interactive elements on mobile.

### 10.2 Horizontal Scroll Not Discoverable [MEDIUM / BUG]
Sort pills and source cards use horizontal scroll. No visual indicator (scrollbar hidden, no edge fade).
**Fix:** Add subtle gradient fade on edges, or show left/right scroll arrows.

### 10.3 Keyboard Covering Fixed Elements [MEDIUM / BUG]
AI search sticky input (`sticky bottom-4`) may be pushed up by keyboard on some Android browsers, covering conversation content.
**Fix:** Use `visualViewport` API to adjust positioning when keyboard is visible.

### 10.4 Safe Area Insets [LOW / MISSING]
iPhone notch/dynamic island and bottom home indicator area. WhatsApp float button may be under the home indicator.
**Fix:** Use `env(safe-area-inset-bottom)` in CSS for fixed-position elements.

### 10.5 Pull-to-Refresh Conflicts [LOW / RISK]
On mobile Chrome, pull-to-refresh triggers on scroll-up at top of page. This may interfere with scrollable filter areas or the chat conversation scroll.
**Fix:** Use `overscroll-behavior: contain` on scrollable containers.

---

## Priority Matrix

| Priority | Count | Key Items |
|----------|-------|-----------|
| CRITICAL | 2 | Case-sensitive search, mobile price table |
| HIGH | 14 | Fuzzy search, price sort, SSE auto-start, accessibility, rate limiting, privacy |
| MEDIUM | 28 | Filter persistence, concurrent fetches, chat height, print view, skeletons |
| LOW | 12 | Dark mode, safe area, autocomplete single-char, URL state |

### Recommended Fix Order
1. Case-sensitive search (SQLite COLLATE fix)
2. Mobile price table → card layout
3. SSE auto-start for stale prices
4. Filter state in URL params
5. Accessibility pass (ARIA, contrast, reduced motion)
6. Loading skeletons
7. Multi-image scan
8. Fuzzy search / "Did you mean?"
9. API rate limiting
10. Conversation context for AI search
