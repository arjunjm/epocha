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

## Background Data & Pre-generation
- [ ] Background job (Azure Function or equivalent) to pre-generate and cache timelines for popular topics
- [ ] Store pre-generated timelines in cache/persistent storage so they load instantly

## Infrastructure & Deployment
- [ ] GitHub Actions CI/CD pipeline
- [ ] Deploy to Azure Service Fabric
- [ ] Full CI/CD pipeline: test → build → deploy on merge to main
- [x] Bicep file for all Azure resource provisioning (infra/main.bicep — Key Vault, App Service, Cosmos DB serverless, Redis C0)

---

## Notes
- Azure subscription has ~$150/month credit; keep infrastructure choices economical
- Prefer managed/serverless Azure services where possible to minimise idle cost
