# Epocha — Requirements

## Already Implemented
- [x] React + Vite + TypeScript frontend
- [x] Express + Claude API backend
- [x] Dark theme with glassmorphism UI
- [x] Vertical/alternating timeline with collapsible event cards
- [x] Left sidebar with topic taxonomy (8 categories, sub-topics)
- [x] SSE streaming with live status updates
- [x] Stub mode for UI testing without API calls
- [x] 90-second timeout + billing error handling

---

## Backend & Caching
- [x] Implement Redis caching — timeline cached by topic+period key, 7-day TTL; Redis in prod, in-memory Map fallback for local dev

## Auth & Users
- [x] Google login (OAuth 2.0) — passport-google-oauth20, JWT cookie
- [x] Rate limiting per authenticated user — 10 timelines/day, resets UTC midnight
- [x] Max user limit — 50 users; new sign-ins rejected when cap reached
- [x] Azure Key Vault integration — secrets loaded at startup via DefaultAzureCredential (Managed Identity in prod, az login locally)

## Browse Without Login
- [x] Unauthenticated users can browse and view any pre-cached sidebar topic via GET /api/timeline/browse (no auth required)
- [x] Sidebar hint updated to reflect free browsing; sign-in only required to generate custom timelines

## Background Data & Pre-generation
- [x] Background job (Azure Function) to pre-generate and cache timelines for popular topics — timer trigger at 2AM UTC daily + HTTP trigger for manual seeding
- [x] Store pre-generated timelines in Redis so they load instantly for all users
- [x] Azure Function also pre-generates and caches quiz questions alongside each timeline

## Gamification
- [x] Profile Levels (1–20) and XP system — XP awarded for: viewing timelines (+10), saving (+5), daily login (+5), completing quiz (+25–50)
- [x] Level thresholds: 0 / 100 / 250 / 450 / 700 / 1000 / 1400 / 1900 / 2500 / 3200 / 4000 / 5000 / 6200 / 7600 / 9200 / 11000 / 13000 / 15500 / 18500 / 22000
- [x] ProfileBadge in nav — shows level number and XP progress bar
- [x] Challenges (quiz) — Claude generates 12 MCQs per timeline, cached in Redis; 5 random questions served per session; full XP for ≥60% correct, half otherwise

## Save & Organize
- [x] Save timelines — authenticated users can bookmark any timeline to Cosmos DB with a collection/folder name
- [x] Library page — saved timelines grouped by collection, with delete support
- [x] Custom topics — users can add their own topic + time range entries to the sidebar, stored per-user in Cosmos DB

## Discovery
- [x] Related topics — Claude returns 4–5 related topics per timeline; shown as clickable chips at the bottom for continued exploration

## Export
- [x] Export to PDF — browser print with print-specific CSS; hides nav, sidebar, and interactive buttons for a clean printable layout

## Marketplace / Shop (all free)
- [x] Timeline Themes — 5 themes (Midnight, Sepia, Neon, Ocean, Forest) changing hero gradient, timeline spine, and dot colors; free to unlock; active theme persisted to user profile

## Testing
- [x] Server unit tests — Vitest covering: `xpToLevel`/level thresholds, XP reward logic, quiz question randomisation, in-memory cache (get/set for timelines and quiz), rate-limit logic, all REST API routes (browse, auth/me, saved timelines CRUD, custom topics CRUD, marketplace, theme setter)
- [x] Client unit tests — Vitest + Testing Library covering: type utilities, `TimelineForm` (render, submit, trim, usage bar states), `ProfileBadge` (level, avatar, click), `QuizModal` (loading, questions, answer feedback, error), `Discover` (all topics, search, category filter)
- [x] Tests run as a mandatory CI step (`test` job) before `build`; deploy jobs require passing tests

## Infrastructure & Deployment
- [x] GitHub Actions CI/CD pipeline — build on Linux, deploy App Service + Function App on push to master (.github/workflows/deploy.yml)
- [ ] Deploy to Azure Service Fabric
- [x] Full CI/CD pipeline: build → deploy on merge to master
- [x] Bicep file for all Azure resource provisioning (infra/main.bicep — Key Vault, App Service B1, Cosmos DB serverless, Redis C0, Function App consumption plan)
- [x] Function App deployment via run-from-package blob upload (bypasses Kudu 503 on Linux Consumption Plan)

---

## Performance & UX
- [x] Progressive streaming render — server emits a `meta` SSE event as soon as the topic/period/description are parsed from Claude's stream; client immediately shows the header and skeleton event cards, replacing the full-page spinner; full events appear when generation completes
- [x] Topic autocomplete — native `<datalist>` on the topic input surfaces all pre-built topic suggestions as the user types; zero API cost
- [x] Reading time + theme count — timeline header shows "~N min read · X events · Y themes" computed from event word counts

## Token & Cost Optimisation
- [x] Anthropic prompt caching — `cache_control: { type: "ephemeral" }` on system prompts in timeline generation, quiz generation, and Azure Function pre-generation; reduces input token cost ~80% on repeated calls

## User Experience Polish
- [x] XP toast notifications — module-level toast emitter (no context/prop drilling); "+10 XP · Timeline generated", "+5 XP · Timeline saved", "+N XP · Quiz: X/5 correct" shown as bottom-right popups; level-up fires "🎉 Level N! · [Title]" toast; auto-dismisses after 3.5s
- [x] "Surprise me!" button — home screen and Discover page; shuffles TOPIC_TAXONOMY, fetches up to 10 topics from browse cache, loads first cached hit instantly; falls back to first topic if none cached
- [x] Markdown export — "↓ Markdown" button in timeline action bar; generates structured .md with title, period, description, each event as H2 with date/location/summary/details/significance/figures/tags, related topics list; downloads as `topic-name.md`
- [x] Tags collapsed by default — replaced always-visible tag chips with a "🏷 N tags" toggle button; state persisted per-browser in localStorage so preference is remembered across all timelines
- [x] Level badge prominence — nav ProfileBadge shows colour-tiered pip (bronze→silver→gold→platinum→legendary) with avatar ring; profile modal has a large hexagonal level badge coloured by tier
- [x] Steam-style achievement showcase — profile modal "Showcase" pins up to 3 earned achievements as large cards at the top; all achievements show rarity borders (common/rare/epic/legendary); "edit" mode toggles selection
- [x] Timeline dates larger — DatePill upgraded to text-xl font-black tracking-widest with glow; CompactRow dates bumped to text-base
- [x] Auto-expand first event — the first EventCard in every timeline renders with its details section open by default; users immediately see rich content without having to click
- [x] Learning Paths — "Paths" nav page showing 5 curated sequences (Ancient World, Rise of Science, Age of Empires, Age of Revolutions, Exploration & Discovery); each path shows steps as a numbered list with per-step checkmarks; progress persisted in localStorage; clicking a step loads that timeline
- [x] In-timeline text search — 🔍 Search button in timeline action bar opens a live search input; filters events by keyword match across title, summary, significance, figures, and location; works alongside tag filter; "X of Y events matching" count shown; Escape clears
- [x] Achievement badges — 8 badges shown in profile modal grid (First Steps, Scholar/Historian/Grand Historian/Epocha Master via level, Collector/Librarian/Curator via save count); unearned badges shown greyed/desaturated with progress bar; earned count displayed
- [x] Social share buttons — Twitter/X and LinkedIn share buttons in timeline header; pre-composed text includes topic, period, and current URL; open in new tab
- [x] Session restoration — last viewed timeline auto-restored from localStorage on app open (24-hour TTL); "Restored from your last session" banner fades in; cleared on reset
- [x] Scroll progress bar — thin amber gradient bar at the top of the viewport tracks reading progress through the timeline; hidden on home/loading screens and in print
- [x] Event copy button — "Copy" button in each expanded EventCard copies formatted text (title, date, location, summary, details, significance, figures, tags); shows "✓ Copied" confirmation
- [x] Tag filter on timeline — clickable tag chips filter visible events; shows filtered count; multi-select with OR logic; clear button resets
- [x] Daily usage indicator — progress bar under the generate form shows N/limit used; turns amber at 2 remaining, red when exhausted; resets note at midnight UTC
- [x] Profile stats modal — clicking the level badge opens an overlay with XP progress, level title, daily usage bar, unlocked themes grid, and XP rewards guide

## Discovery & Sharing
- [x] Shareable timeline URLs — topic/start/end encoded in query params; URL updates on load; auto-loads on page open; "Share" button copies link to clipboard
- [x] Discover page — visual grid of all built-in topics grouped by category with search + filter; publicly accessible (no login required)
- [x] Historical Spotlight — home screen shows a random event from a pre-cached timeline; loads instantly with zero API calls; clicking navigates to the full timeline
- [x] PWA / installable — manifest.json + service worker; app is installable on mobile/desktop; static assets cached; navigation offline-resilient
- [x] Open Graph / social meta tags — server injects dynamic og:title, og:description, and meta description into the HTML for shared `?topic=` links; enables rich previews on Slack, Discord, Twitter
- [x] Recently viewed history — last 8 timelines stored in localStorage; shown at the top of the sidebar as "Recent"; deduplicates by topic key
- [x] Keyboard shortcuts — Q (quiz), B (bookmark), C (compact view), H (home), ? (help modal), Escape (close modals); inactive when typing in inputs; help overlay shows all bindings
- [x] Event bookmarks — bookmark icon on each event card; bookmarks persisted across sessions in localStorage; slide-in panel groups bookmarks by topic with inline expand, remove, clear-all, and Markdown export; action bar shows live count
- [x] Compact list view — toggle between full alternating view and dense scannable rows; each row expands inline to show summary/significance/figures
- [x] Flashcard Study Mode — "🃏 Flashcards" in action bar; full-screen study mode shows event title, hides date/summary until "Reveal"; score yourself ✓/✗ per card; colour-coded dot progress; final score screen with retry-missed option; keyboard shortcuts (Space=reveal, C/→=knew it, X/←=missed it, Esc=exit)
- [x] Timeline Insights Panel — "📊 Insights" button opens a modal with computed analytics: events-by-century bar chart, top mentioned figures, top themes, key locations (all with proportional bars); summary stats row (total events, reading time, word count, location count)
- [x] Key Figure Explorer — click any figure name in "Key Figures" to filter the entire timeline to events featuring that person; "Viewing history through [Name]" banner shows filtered count; active figure highlighted violet; click again or × to clear

## Infrastructure & Deployment
- [x] GitHub Actions CI/CD pipeline — build on Linux, deploy App Service + Function App on push to master (.github/workflows/deploy.yml)
- [ ] Deploy to Azure Service Fabric
- [x] Full CI/CD pipeline: build → deploy on merge to master
- [x] Bicep file for all Azure resource provisioning (infra/main.bicep — Key Vault, App Service B1, Cosmos DB serverless, Redis C0, Function App consumption plan)
- [x] Function App deployment via run-from-package blob upload (bypasses Kudu 503 on Linux Consumption Plan)

---

## Notes
- Azure subscription has ~$150/month credit; keep infrastructure choices economical
- Prefer managed/serverless Azure services where possible to minimise idle cost
- Always update this file when new features are implemented
