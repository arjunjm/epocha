# GitHub Setup Guide

## One-time setup steps

### 1. Create GitHub repo and push code
```bash
gh repo create epocha --private --source=. --push
# or manually:
git remote add origin https://github.com/YOUR_USERNAME/epocha.git
git push -u origin main
```

### 2. Add GitHub Actions secret

The workflow needs the Azure App Service publish profile to deploy.

Retrieve it from Key Vault:
```bash
az keyvault secret show --vault-name kv-timelineapp-dev --name github-publish-profile --query value -o tsv
```

Then in GitHub:
- Go to your repo → **Settings → Secrets and variables → Actions**
- Click **New repository secret**
- Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
- Value: paste the XML output from the command above

### 3. Push to main to trigger deployment

Once the secret is added, every push to `main` will:
1. Build the TypeScript server on Linux
2. Build the Vite client
3. Deploy to `https://app-timelineapp-dev.azurewebsites.net`

### 4. Add production Google OAuth redirect URI

Once deployed, add this redirect URI in Google Cloud Console:
```
https://app-timelineapp-dev.azurewebsites.net/api/auth/google/callback
```

---

## Automated issue triage and auto-fix

This repository now includes two GitHub Actions workflows:

1. **Adversarial QA Scan** — runs on a daily cron and creates or updates issues for repository smells it finds.
2. **Auto-fix labeled issues** — triggers on issues labeled `auto-fix-candidate`, skips anything labeled `security`, `auth`, or `needs-human`, and opens a PR when a safe fix is made.

The scan uses strict labels:
- `triage`
- `auto-fix-candidate`
- `security`

The auto-fix workflow is intentionally conservative. It is designed to handle low-risk, repeatable fixes and escalate sensitive findings to humans.

If you want the auto-fix agent to use an LLM for broader low-risk repairs, add an `ANTHROPIC_API_KEY` repository secret. The workflow will still handle the built-in safe fix path without it.

## Azure resources provisioned

| Resource | Name | Notes |
|---|---|---|
| App Service | `app-timelineapp-dev` | Node 20 Linux, B1 |
| Key Vault | `kv-timelineapp-dev` | All secrets stored here |
| Cosmos DB | `cosmos-epocha-dev` | West US 2, Serverless |
| Redis Cache | `redis-timelineapp-dev` | East US, C0 Basic |
| Resource Group | `rg-epocha-dev` | East US |
