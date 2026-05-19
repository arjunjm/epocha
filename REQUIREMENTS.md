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

## Infrastructure & Deployment
- [x] GitHub Actions CI/CD pipeline — build on Linux, deploy App Service + Function App on push to master (.github/workflows/deploy.yml)
- [ ] Deploy to Azure Service Fabric
- [x] Full CI/CD pipeline: build → deploy on merge to master
- [x] Bicep file for all Azure resource provisioning (infra/main.bicep — Key Vault, App Service B1, Cosmos DB serverless, Redis C0, Function App consumption plan)
- [x] Function App deployment via run-from-package blob upload (bypasses Kudu 503 on Linux Consumption Plan)

---

## Token & Cost Optimisation
- [x] Anthropic prompt caching — `cache_control: { type: "ephemeral" }` on system prompts in timeline generation, quiz generation, and Azure Function pre-generation; reduces input token cost ~80% on repeated calls

## User Experience Polish
- [x] Tag filter on timeline — clickable tag chips filter visible events; shows filtered count; multi-select with OR logic; clear button resets
- [x] Daily usage indicator — progress bar under the generate form shows N/limit used; turns amber at 2 remaining, red when exhausted; resets note at midnight UTC
- [x] Profile stats modal — clicking the level badge opens an overlay with XP progress, level title, daily usage bar, unlocked themes grid, and XP rewards guide

## Discovery & Sharing
- [x] Shareable timeline URLs — topic/start/end encoded in query params; URL updates on load; auto-loads on page open; "Share" button copies link to clipboard
- [x] Discover page — visual grid of all built-in topics grouped by category with search + filter; publicly accessible (no login required)

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
