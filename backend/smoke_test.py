"""Keyless connectivity smoke test — run BEFORE building the orchestrator.

Proves the DefaultAzureCredential path works end-to-end against the freshly
provisioned resources:
  1. Acquire an AAD token (your `az login`).
  2. Call the GPT-4o deployment via Azure OpenAI (no API key).
  3. Touch Cosmos (list the container) via AAD data-plane RBAC.

    python backend/smoke_test.py
"""
from __future__ import annotations

import sys

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from config import Settings


def check_openai(s: Settings) -> bool:
    from openai import AzureOpenAI

    token_provider = get_bearer_token_provider(
        DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
    )
    client = AzureOpenAI(
        azure_endpoint=s.openai_endpoint,
        api_version=s.openai_api_version,
        azure_ad_token_provider=token_provider,
    )
    resp = client.chat.completions.create(
        model=s.gpt4o,
        messages=[
            {"role": "system", "content": "You are juror #8 in a deliberation. Be terse."},
            {"role": "user", "content": "In one sentence: is 2+2=4 a verifiable claim?"},
        ],
        max_tokens=40,
    )
    print(f"  [openai] {s.gpt4o} →", resp.choices[0].message.content.strip())
    return True


def check_cosmos(s: Settings) -> bool:
    if not s.cosmos_endpoint:
        print("  [cosmos] skipped (COSMOS_ENDPOINT not set)")
        return True
    from azure.cosmos import CosmosClient

    client = CosmosClient(s.cosmos_endpoint, credential=DefaultAzureCredential())
    container = client.get_database_client(s.cosmos_database).get_container_client(s.cosmos_container)
    # A trivial query proves data-plane RBAC is wired (returns 0 rows on a fresh container).
    count = list(container.query_items("SELECT VALUE COUNT(1) FROM c", enable_cross_partition_query=True))
    print(f"  [cosmos] {s.cosmos_database}/{s.cosmos_container} reachable — {count[0]} docs")
    return True


def main() -> int:
    print("12 Angry Agents — backend connectivity smoke test\n")
    s = Settings.load()
    print(f"  endpoint: {s.openai_endpoint}\n")
    ok = True
    for name, fn in (("Azure OpenAI", check_openai), ("Cosmos DB", check_cosmos)):
        try:
            fn(s)
        except Exception as exc:  # noqa: BLE001 — surface the real error for setup debugging
            ok = False
            print(f"  [FAIL] {name}: {type(exc).__name__}: {exc}")
    print("\n" + ("✅ all checks passed — keyless path works." if ok else "❌ see failures above (BACKEND_SETUP.md §7)."))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
