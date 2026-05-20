// ============================================================================
// Epocha — Azure Infrastructure
// Deploy: az deployment group create -g <rg> -f infra/main.bicep -p @infra/dev.bicepparam
// ============================================================================

@description('Environment name (dev, prod)')
@allowed(['dev', 'prod'])
param environment string = 'dev'

@description('Azure region for all resources')
param location string = 'eastus'

@description('Base name for all resources — must be globally unique')
@minLength(3)
@maxLength(16)
param appName string = 'timelineapp'

// ── Derived names ─────────────────────────────────────────────────────────
var suffix        = '${appName}-${environment}'
var kvName        = 'kv-${suffix}'           // max 24 chars
var appSvcPlanName = 'plan-${suffix}'
var appSvcName    = 'app-${suffix}'
var cosmosName    = 'cosmos-epocha-${environment}'  // deployed manually to westus2 due to eastus capacity
var redisName     = 'redis-${suffix}'
var funcStorageName = replace('st${suffix}', '-', '')  // storage account: no dashes, max 24 chars
var funcPlanName  = 'funcplan-${suffix}'
var funcAppName   = 'func-${suffix}'

// ── Key Vault ─────────────────────────────────────────────────────────────
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'   // ~$0.04/10k ops — essentially free at this scale
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true   // use RBAC instead of access policies
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
  }
}

// ── App Service Plan (B1 — ~$13/month; cheapest plan with always-on) ──────
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appSvcPlanName
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true   // Linux
  }
}

// ── App Service (Node 20 on Linux) ────────────────────────────────────────
resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: appSvcName
  location: location
  identity: {
    type: 'SystemAssigned'   // Managed Identity — no credentials needed
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      nodeVersion: '~20'
      alwaysOn: true
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'KEY_VAULT_URL'
          value: keyVault.properties.vaultUri   // app reads all secrets from here
        }
        {
          name: 'GOOGLE_CALLBACK_URL'
          value: 'https://${appSvcName}.azurewebsites.net/api/auth/google/callback'
        }
        {
          name: 'PORT'
          value: '8080'
        }
        {
          name: 'MAX_USERS'
          value: '50'
        }
        {
          name: 'DAILY_LIMIT'
          value: '10'
        }
      ]
      appCommandLine: 'node dist/index.js'
    }
  }
}

// ── Grant App Service Managed Identity read access to Key Vault ───────────
// Role: Key Vault Secrets User (4633458b-17de-408a-b874-0445c86b69e6)
resource kvSecretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, appService.id, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '4633458b-17de-408a-b874-0445c86b69e6'
    )
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Cosmos DB (serverless — pay per RU, no idle cost) ─────────────────────
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' = {
  name: cosmosName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      { name: 'EnableServerless' }   // ~$0.25/1M RU — much cheaper than provisioned at low usage
    ]
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: 240
        backupRetentionIntervalInHours: 8
        backupStorageRedundancy: 'Local'   // cheapest backup option
      }
    }
  }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-02-15-preview' = {
  parent: cosmosAccount
  name: 'epocha'
  properties: {
    resource: { id: 'epocha' }
  }
}

resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = {
  parent: cosmosDatabase
  name: 'users'
  properties: {
    resource: {
      id: 'users'
      partitionKey: {
        paths: ['/id']
        kind: 'Hash'
      }
      defaultTtl: -1   // never expire
    }
  }
}

// ── Redis Cache (C0 Basic — ~$16/month; smallest available) ───────────────
resource redisCache 'Microsoft.Cache/redis@2024-03-01' = {
  name: redisName
  location: location
  properties: {
    sku: {
      name: 'Basic'
      family: 'C'
      capacity: 0   // C0: 250MB, no replication — sufficient for caching timelines
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'   // evict least-recently-used when full
    }
  }
}

// ── Store secrets in Key Vault ─────────────────────────────────────────────
// These are placeholder secrets — replace values via:
//   az keyvault secret set --vault-name <kv> --name <name> --value <value>
// or the Azure Portal. Never put real values in Bicep/params files.

resource secretCosmosEndpoint 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cosmos-endpoint'
  properties: {
    value: cosmosAccount.properties.documentEndpoint   // auto-populated from Cosmos resource
  }
}

resource secretCosmosKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cosmos-key'
  properties: {
    // Primary key — retrieved from Cosmos after deployment
    // Set manually: az keyvault secret set --vault-name <kv> --name cosmos-key --value <key>
    value: 'REPLACE_AFTER_DEPLOYMENT'
  }
}

// ── Outputs (used in CI/CD and local dev setup) ───────────────────────────
// ── Azure Function App (background pre-generation) ────────────────────────

resource funcStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: funcStorageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }   // cheapest storage tier
  properties: { minimumTlsVersion: 'TLS1_2' }
}

// ── Storage Queue (pregeneration job queue) ───────────────────────────────
// Uses the same storage account as AzureWebJobsStorage — no extra cost.

resource funcStorageQueueService 'Microsoft.Storage/storageAccounts/queueServices@2023-05-01' = {
  parent: funcStorage
  name: 'default'
}

resource pregenQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: funcStorageQueueService
  name: 'epocha-pregenerate-jobs'
}

// Dead-letter queue (messages that failed maxDequeueCount retries land here)
resource pregenPoisonQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: funcStorageQueueService
  name: 'epocha-pregenerate-jobs-poison'
}

resource funcPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: funcPlanName
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }   // Consumption plan — pay only when running
  properties: { reserved: true }
}

resource funcApp 'Microsoft.Web/sites@2023-12-01' = {
  name: funcAppName
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: funcPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20'
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${funcStorage.name};AccountKey=${funcStorage.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'KEY_VAULT_URL', value: keyVault.properties.vaultUri }
      ]
    }
  }
}

// Grant Function App Managed Identity read access to Key Vault
resource funcKvRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, funcApp.id, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: funcApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Outputs ────────────────────────────────────────────────────────────────
output keyVaultUrl string = keyVault.properties.vaultUri
output appServiceName string = appService.name
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output redisCacheHostName string = redisCache.properties.hostName
output appServicePrincipalId string = appService.identity.principalId
output functionAppName string = funcApp.name
