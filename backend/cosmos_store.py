"""Cosmos persistence — the vote ledger, transcript and replay tape are one collection.

Per event_schema.md §5: the Cosmos doc IS the envelope, partitioned by `case_id`,
clustered by `seq`. Keyless (AAD data-plane RBAC via DefaultAzureCredential). If no
COSMOS_ENDPOINT is configured the store degrades to a no-op so local runs still work.
"""
from __future__ import annotations

from azure.identity.aio import DefaultAzureCredential

from config import Settings


class CosmosTapeStore:
    def __init__(self, settings: Settings):
        self.s = settings
        self.enabled = bool(settings.cosmos_endpoint)
        self._client = None
        self._container = None
        self._cred = None

    async def _container_client(self):
        if self._container is None:
            from azure.cosmos.aio import CosmosClient

            self._cred = DefaultAzureCredential()
            self._client = CosmosClient(self.s.cosmos_endpoint, credential=self._cred)
            db = self._client.get_database_client(self.s.cosmos_database)
            self._container = db.get_container_client(self.s.cosmos_container)
        return self._container

    async def append(self, envelope: dict) -> None:
        if not self.enabled:
            return
        container = await self._container_client()
        item = dict(envelope)
        item["id"] = f"{envelope['case_id']}:{envelope['seq']}"
        await container.upsert_item(item)  # upsert => idempotent re-delivery is safe

    async def read_tape(self, case_id: str) -> list[dict]:
        if not self.enabled:
            return []
        container = await self._container_client()
        query = "SELECT * FROM c WHERE c.case_id = @cid ORDER BY c.seq ASC"
        params = [{"name": "@cid", "value": case_id}]
        items = [
            item
            async for item in container.query_items(query=query, parameters=params)
        ]
        # Strip Cosmos bookkeeping fields back down to the clean envelope shape.
        for it in items:
            for k in ("id", "_rid", "_self", "_etag", "_attachments", "_ts"):
                it.pop(k, None)
        return items

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.close()
        if self._cred is not None:
            await self._cred.close()
