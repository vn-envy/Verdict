# Backend Setup — provisioning the Azure footprint

Stands up the **core** Microsoft-stack backend for 12 Angry Agents via `azd` + Bicep, then proves the keyless path with a smoke test. Designed for **local-first** development: the orchestrator runs on your machine against cloud Azure services, and deploys to Container Apps later.

> **Cost & reversibility:** `azd up` creates billable resources (AI Services, AI Search Basic, Cosmos serverless, App Insights). Expect a few dollars/day idle, more under load. Tear everything down with `azd down --purge` (§8). Nothing here runs against your tenant until **you** run `azd up`.

Decisions locked: **azd + Bicep · East US 2 · Azure OpenAI + 2 catalog models · local-first orchestrator.**

---

## 1. Prerequisites (one-time)

- An Azure subscription where you have **Contributor + User Access Administrator** (the second is required to create the RBAC role assignments).
- **Azure OpenAI access** enabled on the subscription.
- Tooling — install locally **or** use **Azure Cloud Shell** (has all of it preinstalled):
  - Azure CLI · `azd` (Azure Developer CLI) · Docker (for the later ACA deploy) · Python 3.11+
  - macOS: `brew install azure-cli azd python@3.11` and Docker Desktop.

> This machine currently has none of these and Python 3.9 — install the above, or do everything in Cloud Shell.

---

## 2. Check model availability in your region (do this first)

Model `version` strings in `infra/main.bicep` must match what East US 2 offers, or the deployment fails.

```bash
az login
az account set --subscription "<your-sub-id>"
az cognitiveservices account list-models --location eastus2 \
  --query "[?contains(name,'gpt-4o') || contains(name,'o4') || contains(name,'o3')].{name:name,version:version,sku:skus[0].name}" -o table
```

Update the `version` (and `name` for the o-series, e.g. `o3-mini` vs `o4-mini`) in `infra/main.bicep → openAiDeployments` to match. The capacities are TPM-in-thousands; lower them if you hit quota.

---

## 3. Provision

```bash
azd auth login
azd env new taa-dev                 # creates the azd environment
azd env set AZURE_LOCATION eastus2
# Grant your own user data-plane roles for local dev:
azd env set AZURE_PRINCIPAL_ID "$(az ad signed-in-user show --query id -o tsv)"

azd up                              # provisions everything in infra/
```

`azd up` creates `rg-taa-dev` with: a managed identity, the AI Services (Azure OpenAI) account + the 3 model deployments, Content Safety, AI Search (Basic), Cosmos (serverless), Key Vault, Log Analytics + App Insights, and all role assignments. Outputs are written to `.azure/taa-dev/.env`.

---

## 4. Add the 2 catalog models (heterogeneity)

Serverless catalog models (Phi-4 + Llama/Mistral) need a one-time **Marketplace agreement**, so they're a guided step rather than Bicep (keeps `azd up` from failing on an interactive prompt):

1. Open the **Azure AI Foundry** portal → your project (create one in `rg-taa-dev` if prompted; reuse the provisioned AI Services account).
2. **Model catalog** → deploy **Phi-4** as a *serverless* endpoint → accept terms.
3. Deploy **Llama-3.3-70B-Instruct** (or **Mistral-Large**) the same way.
4. Copy each endpoint's URL into your env:
   ```bash
   azd env set CATALOG_PHI4_ENDPOINT "<phi4-serverless-url>"
   azd env set CATALOG_LLAMA_ENDPOINT "<llama-serverless-url>"
   ```
   These are AAD-callable; the managed identity already has Cognitive Services access.

---

## 5. Wire the backend env

```bash
azd env get-values > backend/.env     # config.py reads this (keyless — no secrets in it)
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
```

---

## 6. Smoke test (prove keyless works before any orchestrator code)

```bash
python backend/smoke_test.py
```

Expected: a one-line GPT-4o answer and a Cosmos reachability line, ending `✅ all checks passed`. This confirms `DefaultAzureCredential` → token → Azure OpenAI **and** Cosmos data-plane RBAC all work with **no keys**.

> Microsoft Agent Framework: once the smoke test is green, we wire the swarm. The Python package is pinned in `requirements.txt` after verifying the current name/version at install time (it was in flux post-AutoGen/SK merge) — that's the next shipping step, not part of provisioning.

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `DeploymentModelNotSupported` / version error | Wrong model `version` for the region — re-check §2 and edit `infra/main.bicep`. |
| `InsufficientQuota` on a deployment | Lower `capacity` in `openAiDeployments`, or request quota in the portal. |
| `AuthorizationFailed` creating role assignments | You lack **User Access Administrator** — ask the subscription owner. |
| Role assignment `PrincipalNotFound` (transient) | Re-run `azd up`; AAD replication can lag a few minutes. |
| Smoke test 401/403 on OpenAI | `AZURE_PRINCIPAL_ID` wasn't set before `azd up`; set it (§3) and `azd provision` again. |
| Cosmos 403 | Same — the SQL data-plane role needs your principal; re-provision. |

---

## 8. Cost control & teardown

```bash
azd down --purge      # deletes the resource group AND purges soft-deleted AI/KV resources
```

Between demos you can also delete just the model deployments (zero idle token cost) and keep the rest, or scale AI Search to Free if you recreate it. Cosmos serverless and App Insights bill on usage.

---

## What this provisions (recap)

| Resource | Role in the architecture |
|---|---|
| AI Services (Azure OpenAI) + GPT-4o / GPT-4o-mini / o-series | Foreman, jurors, Verifier inference |
| Phi-4 + Llama (catalog, §4) | Heterogeneous jurors — the anti-anchoring lever |
| Content Safety | Bias Sentinel + Prompt Shields |
| AI Search (Basic) | Shared, citable evidence base (RAG) |
| Cosmos DB (serverless) | Threads, transcripts, vote ledger, the replayable "tape" |
| Key Vault | Secrets (keyless RBAC) |
| App Insights + Log Analytics | OpenTelemetry traces of the swarm |
| Managed Identity + RBAC | `DefaultAzureCredential`, no keys in source |

**Deferred (not blocking a working backend):** Grounding with Bing Search, Foundry Evaluations, ACA Dynamic Sessions (Consensus Engine runs locally first), Power BI, Copilot Studio + Teams.
