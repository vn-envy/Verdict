"""Central config — reads the env vars azd writes to .azure/<env>/.env.

Keyless throughout: no keys or connection strings are read here. Auth is via
DefaultAzureCredential (your `az login` locally; the managed identity on ACA).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from dotenv import load_dotenv

# Load a local .env if present (azd writes one under .azure/<env>/). Harmless if absent.
load_dotenv()
for _env_dir in ("backend/.env", ".env"):
    if os.path.exists(_env_dir):
        load_dotenv(_env_dir, override=False)


def _require(name: str) -> str:
    val = os.getenv(name, "").strip()
    if not val:
        raise RuntimeError(
            f"Missing required env var {name!r}. Run `azd up`, then "
            f"`azd env get-values > backend/.env` (see BACKEND_SETUP.md §5)."
        )
    return val


@dataclass(frozen=True)
class Settings:
    openai_endpoint: str
    openai_api_version: str
    gpt4o: str
    gpt4o_mini: str
    oseries: str
    cosmos_endpoint: str
    cosmos_database: str
    cosmos_container: str
    contentsafety_endpoint: str
    appinsights_connection_string: str
    managed_identity_client_id: str
    # Catalog (non-OpenAI Foundry) models, served from the AI model-inference endpoint.
    catalog_endpoint: str
    phi4_deployment: str
    mistral_deployment: str
    # Deliberation knobs.
    panel_size: int
    max_rounds: int
    # API guardrails (cost/abuse protection on the public endpoint) + per-call LLM timeout.
    api_key: str
    rate_limit_per_min: int
    max_active_deliberations: int
    llm_timeout_seconds: float

    @staticmethod
    def load() -> "Settings":
        return Settings(
            openai_endpoint=_require("AZURE_OPENAI_ENDPOINT"),
            openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21"),
            gpt4o=os.getenv("AZURE_OPENAI_GPT4O_DEPLOYMENT", "gpt-4o"),
            gpt4o_mini=os.getenv("AZURE_OPENAI_GPT4O_MINI_DEPLOYMENT", "gpt-4o-mini"),
            oseries=os.getenv("AZURE_OPENAI_OSERIES_DEPLOYMENT", "o4-mini"),
            cosmos_endpoint=os.getenv("COSMOS_ENDPOINT", ""),
            cosmos_database=os.getenv("COSMOS_DATABASE", "deliberations"),
            cosmos_container=os.getenv("COSMOS_CONTAINER", "events"),
            contentsafety_endpoint=os.getenv("CONTENTSAFETY_ENDPOINT", ""),
            appinsights_connection_string=os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING", ""),
            managed_identity_client_id=os.getenv("AZURE_CLIENT_ID", ""),
            catalog_endpoint=os.getenv("CATALOG_INFERENCE_ENDPOINT", ""),
            phi4_deployment=os.getenv("CATALOG_PHI4_DEPLOYMENT", "Phi-4"),
            mistral_deployment=os.getenv("CATALOG_MISTRAL_DEPLOYMENT", "Mistral-Large-3"),
            panel_size=int(os.getenv("PANEL_SIZE", "12")),
            max_rounds=int(os.getenv("MAX_ROUNDS", "5")),
            # Optional: require X-API-Key on /api/cases when set (empty = open, as today).
            api_key=os.getenv("API_KEY", ""),
            # Per-IP case starts/min, and a hard ceiling on concurrent deliberations (each
            # deliberation fans out to ~100 LLM calls, so this is the real cost guard).
            rate_limit_per_min=int(os.getenv("RATE_LIMIT_PER_MIN", "5")),
            max_active_deliberations=int(os.getenv("MAX_ACTIVE_DELIBERATIONS", "3")),
            llm_timeout_seconds=float(os.getenv("LLM_TIMEOUT_SECONDS", "90")),
        )

    @property
    def is_reasoning(self) -> dict:
        """Which deployments are o-series reasoning models (different call params)."""
        return {self.oseries: True}
