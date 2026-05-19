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

## Azure resources provisioned

| Resource | Name | Notes |
|---|---|---|
| App Service | `app-timelineapp-dev` | Node 20 Linux, B1 |
| Key Vault | `kv-timelineapp-dev` | All secrets stored here |
| Cosmos DB | `cosmos-epocha-dev` | West US 2, Serverless |
| Redis Cache | `redis-timelineapp-dev` | East US, C0 Basic |
| Resource Group | `rg-epocha-dev` | East US |
