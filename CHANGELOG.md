# Changelog

## [0.2.0.0] - 2026-03-17

### Added
- WhatsApp bot: AI-powered conversational medicine search (composition-first search, cross-pharmacy prices, prescription photo OCR via Gemini)
- Truemeds sitemap harvester (212k product URLs collected)
- UpToDate drug extraction and mapping (1,638 clinically verified compositions)
- Pharmacy gap filler using PharmEasy search API
- Production DB curation scripts (curate-production-db.js, fill-pharmacy-gaps.js, map-uptodate-to-db.js)
- gstack integration for /review, /ship, /qa workflows

### Changed
- WhatsApp webhook: replaced demo scan with real Gemini AI prescription analysis
- WhatsApp search: composition-group-first search shows all brands sorted by price
- Import pipeline: added Truemeds sitemap as preferred source
- Database cleaned: removed 179k non-medicine products (cosmetics, homeopathic, toothpaste, etc.)
- isGeneric flag set for 591k drugs via composition-group price analysis
- Stock status corrected for Netmeds/PharmEasy (17% → 100%)

### Fixed
- Fake composition groups removed (Lips, Face makeup, Tonic, Eyes, etc.)
- Empty composition groups cleaned up

## [0.1.0.0] - 2026-03-16

### Added
- Phase 1 complete: 928k drugs, shadcn UI, security hardening, SEO
- Data pipeline: 1.25M harvested products from 5 pharmacies
- 21 shadcn/ui components across all pages
- Security: rate limiting, file upload validation, auth bypass fix, security headers
- SEO: robots.txt, sitemap.xml, metadataBase
