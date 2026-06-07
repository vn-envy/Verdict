// 12 Angry Agents — backend footprint (azd entrypoint, subscription scope).
// Creates the resource group, then deploys all resources via resources.bicep.
targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the azd environment — used to derive resource names.')
param environmentName string

@description('Primary location for all resources.')
param location string = 'eastus2'

@description('Region for AI Search. Split out because East US 2 is frequently out of Search capacity (InsufficientResourcesAvailable).')
param searchLocation string = 'eastus'

@description('Object ID of the developer/principal who runs azd, granted data-plane roles for local-first dev (az ad signed-in-user object-id).')
param principalId string = ''

@description('Entra type of principalId: "User" for a developer running azd locally, "ServicePrincipal" in CI/CD pipelines.')
@allowed([ 'User', 'ServicePrincipal' ])
param principalType string = 'User'

// Azure OpenAI deployments to create on the AI Services account.
// `sku` is per-model: it must match the deployment quota you actually hold in the
// region (see `az cognitiveservices usage list -l <region>`). On this subscription
// East US 2 has GlobalStandard quota=0 for gpt-4o/gpt-4o-mini but Standard quota>0,
// while o4-mini is GlobalStandard-only — hence the mix below.
// Adjust `version` to a value your region offers: `az cognitiveservices account list-models`.
// Note: gpt-4o-mini (only version 2024-07-18) was retired for NEW deployments on
// 2026-03-31, so the small-juror slot uses gpt-4.1-mini (its successor) on GlobalStandard.
// Deployment `name` omits the dot (Azure OpenAI deployment names disallow '.').
param openAiDeployments array = [
  { name: 'gpt-4o', model: 'gpt-4o', version: '2024-11-20', capacity: 30, sku: 'Standard' }
  { name: 'gpt-41-mini', model: 'gpt-4.1-mini', version: '2025-04-14', capacity: 30, sku: 'GlobalStandard' }
  { name: 'o4-mini', model: 'o4-mini', version: '2025-04-16', capacity: 30, sku: 'GlobalStandard' }
]

var tags = { 'azd-env-name': environmentName, project: '12-angry-agents' }
var rgName = 'rg-${environmentName}'

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: rgName
  location: location
  tags: tags
}

module resources 'resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    searchLocation: searchLocation
    environmentName: environmentName
    tags: tags
    principalId: principalId
    principalType: principalType
    openAiDeployments: openAiDeployments
  }
}

// Outputs are written by azd into .azure/<env>/.env — the backend reads them.
output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = rgName
output AZURE_CLIENT_ID string = resources.outputs.managedIdentityClientId
output AZURE_OPENAI_ENDPOINT string = resources.outputs.openAiEndpoint
output AZURE_OPENAI_GPT4O_DEPLOYMENT string = 'gpt-4o'
output AZURE_OPENAI_GPT4O_MINI_DEPLOYMENT string = 'gpt-41-mini'
output AZURE_OPENAI_OSERIES_DEPLOYMENT string = 'o4-mini'
output AZURE_OPENAI_API_VERSION string = '2024-10-21'
output AZURE_AI_PROJECT_ENDPOINT string = resources.outputs.aiServicesEndpoint
output CONTENTSAFETY_ENDPOINT string = resources.outputs.contentSafetyEndpoint
output SEARCH_ENDPOINT string = resources.outputs.searchEndpoint
output COSMOS_ENDPOINT string = resources.outputs.cosmosEndpoint
output COSMOS_DATABASE string = resources.outputs.cosmosDatabase
output COSMOS_CONTAINER string = resources.outputs.cosmosContainer
output KEYVAULT_ENDPOINT string = resources.outputs.keyVaultEndpoint
output APPLICATIONINSIGHTS_CONNECTION_STRING string = resources.outputs.appInsightsConnectionString

// Catalog (non-OpenAI Foundry) models — served from the AI model-inference endpoint.
// Deployment names are the portal-created Global Standard deployments (see BACKEND_SETUP §4).
output CATALOG_INFERENCE_ENDPOINT string = resources.outputs.catalogInferenceEndpoint
output CATALOG_PHI4_DEPLOYMENT string = 'Phi-4'
output CATALOG_MISTRAL_DEPLOYMENT string = 'Mistral-Large-3'

// Container hosting — azd pushes images here and wires the web build to the backend URL.
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.acrLoginServer
output BACKEND_URI string = resources.outputs.apiUri
output WEB_URI string = resources.outputs.webUri
