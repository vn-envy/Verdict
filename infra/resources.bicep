// 12 Angry Agents — core backend resources (resource-group scope).
// Keyless by design: a user-assigned managed identity holds data-plane RBAC,
// local auth is disabled where supported, and the developer principal is granted
// the same roles so the orchestrator runs locally via DefaultAzureCredential.

param location string
param environmentName string
param tags object
param principalId string
@description('Entra type of principalId ("User" locally, "ServicePrincipal" in CI). Drives roleAssignment principalType.')
param principalType string = 'User'
param openAiDeployments array
@description('Monthly cost budget (USD) for this resource group.')
param monthlyBudgetUsd int = 50
@description('Email for budget alerts. Empty (default) disables the budget so deploys never fail on missing Cost Management RBAC.')
param budgetAlertEmail string = ''
@description('Budget start — first of the current month. Leave as default.')
param budgetStartDate string = utcNow('yyyy-MM-01')
@secure()
@description('context.dev API key for live web evidence (EVIDENCE_PROVIDER=context). Empty = Wikipedia fallback.')
param contextDevApiKey string = ''

// Short, unique-ish suffix for globally-scoped names.
var suffix = toLower(uniqueString(subscription().id, resourceGroup().id, environmentName))
var namePrefix = 'taa${take(suffix, 8)}'

// ---- Built-in role definition IDs (verify with `az role definition list --name <role>`) ----
var roleOpenAiUser = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd') // Cognitive Services OpenAI User
var roleCognitiveUser = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a97b65f3-24c7-4388-baec-2e87135dc908') // Cognitive Services User

// ---- Identity ----
resource mi 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${namePrefix}'
  location: location
  tags: tags
}

// Roles go to the managed identity (always) and, for local-first dev, to the developer
// principal when supplied. We loop over a STATIC slot list ('mi'/'user') rather than an
// array containing mi.properties.principalId: Bicep requires loop sources to be resolvable
// at the start of deployment, but the MI principalId is only known at runtime. The actual
// id and principalType are resolved inside each loop body, which is allowed.
var grantUser = !empty(principalId)
var principalSlots = grantUser ? [ 'mi', 'user' ] : [ 'mi' ]

// ---- Azure AI Services (Azure OpenAI host) ----
resource aiServices 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: 'aoai-${namePrefix}'
  location: location
  tags: tags
  kind: 'AIServices'
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    customSubDomainName: 'aoai-${namePrefix}'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: true
  }
}

@batchSize(1)
resource aoaiDeploys 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = [for d in openAiDeployments: {
  parent: aiServices
  name: d.name
  sku: { name: d.?sku ?? 'GlobalStandard', capacity: d.capacity }
  properties: {
    model: { format: 'OpenAI', name: d.model, version: d.version }
  }
}]

// ---- Content Safety (Bias Sentinel + Prompt Shields) ----
resource contentSafety 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: 'cs-${namePrefix}'
  location: location
  tags: tags
  kind: 'ContentSafety'
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    customSubDomainName: 'cs-${namePrefix}'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: true
  }
}

// ---- Cosmos DB (threads, transcripts, vote ledger, checkpoints / the "tape") ----
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: 'cosmos-${namePrefix}'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    disableLocalAuth: true
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    capabilities: [ { name: 'EnableServerless' } ]
    locations: [ { locationName: location, failoverPriority: 0, isZoneRedundant: false } ]
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cosmos
  name: 'deliberations'
  properties: { resource: { id: 'deliberations' } }
}

resource cosmosEvents 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: cosmosDb
  name: 'events'
  properties: {
    resource: {
      id: 'events'
      partitionKey: { paths: [ '/case_id' ], kind: 'Hash' }
    }
  }
}

// Cosmos data-plane RBAC (built-in Data Contributor = ...0002), assigned to each principal.
resource cosmosDataRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = [for s in principalSlots: {
  parent: cosmos
  name: guid(cosmos.id, s == 'mi' ? mi.id : principalId, 'data-contributor')
  properties: {
    roleDefinitionId: '${cosmos.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: s == 'mi' ? mi.properties.principalId : principalId
    scope: cosmos.id
  }
}]

// ---- Key Vault (secrets; keyless RBAC) ----
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${take(namePrefix, 18)}'
  location: location
  tags: tags
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
  }
}

// ---- Observability ----
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${namePrefix}'
  location: location
  tags: tags
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30 }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${namePrefix}'
  location: location
  tags: tags
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: logAnalytics.id }
}

// ---- Role assignments (control/data plane) ----
resource raOpenAi 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for s in principalSlots: {
  name: guid(aiServices.id, s == 'mi' ? mi.id : principalId, roleOpenAiUser)
  scope: aiServices
  properties: { roleDefinitionId: roleOpenAiUser, principalId: s == 'mi' ? mi.properties.principalId : principalId, principalType: s == 'mi' ? 'ServicePrincipal' : principalType }
}]

resource raContentSafety 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for s in principalSlots: {
  name: guid(contentSafety.id, s == 'mi' ? mi.id : principalId, roleCognitiveUser)
  scope: contentSafety
  properties: { roleDefinitionId: roleCognitiveUser, principalId: s == 'mi' ? mi.properties.principalId : principalId, principalType: s == 'mi' ? 'ServicePrincipal' : principalType }
}]

// ---- Cost guardrail: resource-group budget alert (opt-in via budgetAlertEmail) ----
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = if (monthlyBudgetUsd > 0 && !empty(budgetAlertEmail)) {
  name: 'budget-${namePrefix}'
  properties: {
    category: 'Cost'
    amount: monthlyBudgetUsd
    timeGrain: 'Monthly'
    timePeriod: { startDate: budgetStartDate }
    notifications: {
      actual80: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: [ budgetAlertEmail ]
      }
      forecast100: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: [ budgetAlertEmail ]
      }
    }
  }
}

// ============================================================================
// Container hosting — ACR + Azure Container Apps for the backend (FastAPI) and web (Next.js).
// azd matches services to apps by the 'azd-service-name' tag, builds the image, pushes to
// ACR, and updates the app. Keyless: the apps use the same user-assigned MI (data-plane RBAC)
// and pull from ACR via AcrPull. Scale-to-zero keeps idle cost ~0 on a free subscription.
// ============================================================================
var placeholderImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
var roleAcrPull = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: 'acr${namePrefix}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource raAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, mi.id, roleAcrPull)
  scope: acr
  properties: { roleDefinitionId: roleAcrPull, principalId: mi.properties.principalId, principalType: 'ServicePrincipal' }
}

resource acaEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${namePrefix}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Web first so the backend can allow its origin (CORS) without a cycle.
resource webApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-web-${namePrefix}'
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${mi.id}': {} } }
  properties: {
    managedEnvironmentId: acaEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: { external: true, targetPort: 3000, transport: 'auto' }
      registries: [ { server: acr.properties.loginServer, identity: mi.id } ]
    }
    template: {
      containers: [ {
        name: 'web'
        image: placeholderImage
        probes: [
          { type: 'Liveness', httpGet: { path: '/', port: 3000 }, initialDelaySeconds: 10, periodSeconds: 30 }
          { type: 'Readiness', httpGet: { path: '/', port: 3000 }, initialDelaySeconds: 5, periodSeconds: 10 }
        ]
      } ]
      scale: { minReplicas: 0, maxReplicas: 2 }
    }
  }
}

resource apiApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-api-${namePrefix}'
  location: location
  tags: union(tags, { 'azd-service-name': 'orchestrator' })
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${mi.id}': {} } }
  properties: {
    managedEnvironmentId: acaEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: { external: true, targetPort: 8000, transport: 'auto' }
      registries: [ { server: acr.properties.loginServer, identity: mi.id } ]
      secrets: empty(contextDevApiKey) ? [] : [ { name: 'context-dev-api-key', value: contextDevApiKey } ]
    }
    template: {
      containers: [ {
        name: 'orchestrator'
        image: placeholderImage
        resources: { cpu: json('1.0'), memory: '2Gi' }
        env: concat([
          { name: 'AZURE_CLIENT_ID', value: mi.properties.clientId }   // pin DefaultAzureCredential to this MI
          { name: 'AZURE_OPENAI_ENDPOINT', value: aiServices.properties.endpoint }
          { name: 'AZURE_OPENAI_API_VERSION', value: '2024-10-21' }
          { name: 'AZURE_OPENAI_GPT4O_DEPLOYMENT', value: 'gpt-4o' }
          { name: 'AZURE_OPENAI_GPT4O_MINI_DEPLOYMENT', value: 'gpt-41-mini' }
          { name: 'AZURE_OPENAI_OSERIES_DEPLOYMENT', value: 'o4-mini' }
          { name: 'COSMOS_ENDPOINT', value: cosmos.properties.documentEndpoint }
          { name: 'COSMOS_DATABASE', value: 'deliberations' }
          { name: 'COSMOS_CONTAINER', value: 'events' }
          { name: 'CONTENTSAFETY_ENDPOINT', value: contentSafety.properties.endpoint }
          { name: 'CATALOG_INFERENCE_ENDPOINT', value: 'https://${aiServices.name}.services.ai.azure.com/' }
          { name: 'CATALOG_PHI4_DEPLOYMENT', value: 'Phi-4' }
          { name: 'CATALOG_MISTRAL_DEPLOYMENT', value: 'Mistral-Large-3' }
          { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
          { name: 'ALLOWED_ORIGINS', value: 'https://${webApp.properties.configuration.ingress.fqdn}' }
          { name: 'EVIDENCE_PROVIDER', value: 'context' }
        ], empty(contextDevApiKey) ? [] : [
          { name: 'CONTEXT_DEV_API_KEY', secretRef: 'context-dev-api-key' }
        ])
        probes: [
          { type: 'Liveness', httpGet: { path: '/healthz', port: 8000 }, initialDelaySeconds: 8, periodSeconds: 30 }
          { type: 'Readiness', httpGet: { path: '/healthz', port: 8000 }, initialDelaySeconds: 5, periodSeconds: 10 }
        ]
      } ]
      scale: { minReplicas: 0, maxReplicas: 3 }
    }
  }
}

output acrLoginServer string = acr.properties.loginServer
output apiUri string = 'https://${apiApp.properties.configuration.ingress.fqdn}'
output webUri string = 'https://${webApp.properties.configuration.ingress.fqdn}'

output managedIdentityClientId string = mi.properties.clientId
output openAiEndpoint string = aiServices.properties.endpoint
output aiServicesEndpoint string = aiServices.properties.endpoint
// Azure AI model-inference endpoint (serves the catalog models: Phi-4, Mistral).
output catalogInferenceEndpoint string = 'https://${aiServices.name}.services.ai.azure.com/'
output contentSafetyEndpoint string = contentSafety.properties.endpoint
output cosmosEndpoint string = cosmos.properties.documentEndpoint
output cosmosDatabase string = 'deliberations'
output cosmosContainer string = 'events'
output keyVaultEndpoint string = keyVault.properties.vaultUri
output appInsightsConnectionString string = appInsights.properties.ConnectionString
