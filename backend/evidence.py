"""Evidence Gatherer — real web/RAG grounding for custom claims.

When a deliberation has no seeded evidence catalog (Path 1: a user-typed claim), this
retrieves a small, citable evidence base from the open web so jurors and the Verifier
reason over sources rather than parametric memory.

Provider is pluggable behind the same `gather_evidence` signature (no orchestrator changes):
  * **wikipedia** (default) — keyless, reliable, citable.
  * **context** — context.dev live web search (`EVIDENCE_PROVIDER=context` + `CONTEXT_DEV_API_KEY`).
    Grounds the room in fresh web results and uses NO Azure credits; falls back to Wikipedia if
    the key is missing or the call fails, so a deliberation never breaks on it.
"""
from __future__ import annotations

import asyncio
import html
import os
import re
import urllib.parse

WIKI_API = "https://en.wikipedia.org/w/api.php"
WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/"
_UA = "Verdict/1.0 (https://github.com/vn-envy/Verdict; AI jury research)"
PROVIDER = os.getenv("EVIDENCE_PROVIDER", "wikipedia")

# context.dev live web search — https://docs.context.dev/api-reference/web-scraping/web-search
CONTEXT_API = "https://api.context.dev/v1/web/search"
_REL_CRED = {"high": 0.85, "medium": 0.7, "low": 0.55}  # map result.relevance -> credibility


def _strip(text: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", text or "")).strip()


async def _search_titles(session, query: str, limit: int) -> list[str]:
    params = {
        "action": "query", "list": "search", "srsearch": query,
        "srlimit": str(limit), "format": "json", "utf8": "1", "srprop": "",
    }
    async with session.get(WIKI_API, params=params) as r:
        data = await r.json()
    return [hit["title"] for hit in data.get("query", {}).get("search", [])]


async def _summary(session, title: str) -> dict | None:
    url = WIKI_SUMMARY + urllib.parse.quote(title.replace(" ", "_"), safe="")
    async with session.get(url) as r:
        if r.status != 200:
            return None
        d = await r.json()
    if d.get("type") == "disambiguation" or not d.get("extract"):
        return None
    return {
        "title": d.get("title", title),
        "url": (d.get("content_urls", {}).get("desktop", {}).get("page")
                or f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"),
        "snippet": _strip(d.get("extract", ""))[:280],
    }


async def _wikipedia(claim: str, subclaims: list[dict], k: int) -> list[dict]:
    import aiohttp

    timeout = aiohttp.ClientTimeout(total=10)
    async with aiohttp.ClientSession(headers={"User-Agent": _UA}, timeout=timeout) as session:
        # Search on the claim, plus the first couple of sub-claims for breadth.
        queries = [claim] + [sc["text"] for sc in subclaims[:2]]
        title_lists = await asyncio.gather(
            *(_search_titles(session, q, 5) for q in queries), return_exceptions=True
        )
        seen, titles = set(), []
        for tl in title_lists:
            if isinstance(tl, Exception):
                continue
            for t in tl:
                if t not in seen:
                    seen.add(t)
                    titles.append(t)
        titles = titles[: k + 3]
        summaries = await asyncio.gather(
            *(_summary(session, t) for t in titles), return_exceptions=True
        )

    items: list[dict] = []
    for s in summaries:
        if isinstance(s, Exception) or not s or not s["snippet"]:
            continue
        items.append({
            "id": f"ev{len(items) + 1}",
            "title": s["title"],
            "url": s["url"],
            "snippet": s["snippet"],
            "credibility": 0.78,  # encyclopedic secondary source
        })
        if len(items) >= k:
            break
    return items


async def _context_dev(claim: str, subclaims: list[dict], k: int) -> list[dict]:
    """Live web evidence via context.dev web/search (Bearer-auth, no Azure credits)."""
    import aiohttp

    api_key = os.getenv("CONTEXT_DEV_API_KEY") or os.getenv("CONTEXT_API_KEY", "")
    if not api_key:
        raise RuntimeError("CONTEXT_DEV_API_KEY not set")

    # One focused query (claim + top sub-claim) — "evidence grounding only" keeps credit use low.
    sc = subclaims[0]["text"] if subclaims else ""
    query = f"{claim} {sc}".strip()[:500]
    # Use the result `description` as the snippet; do NOT scrape each result to markdown — that
    # fetches every page and easily blows the timeout (and costs more credits) for no gain here.
    body = {"query": query, "markdownOptions": {"enabled": False}}
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    timeout = aiohttp.ClientTimeout(total=25)
    async with aiohttp.ClientSession(headers=headers, timeout=timeout) as session:
        async with session.post(CONTEXT_API, json=body) as r:
            r.raise_for_status()
            data = await r.json()

    items: list[dict] = []
    for res in data.get("results", []):
        snippet = _strip(res.get("description") or "")
        if not snippet:
            md = (res.get("markdown") or {}).get("markdown") or ""
            snippet = re.sub(r"\s+", " ", md).strip()[:280]
        if not snippet:
            continue
        items.append({
            "id": f"ev{len(items) + 1}",
            "title": res.get("title") or res.get("url", "source"),
            "url": res.get("url", ""),
            "snippet": snippet[:280],
            "credibility": _REL_CRED.get((res.get("relevance") or "medium").lower(), 0.7),
        })
        if len(items) >= k:
            break
    return items


async def gather_evidence(claim: str, subclaims: list[dict], k: int = 6) -> list[dict]:
    """Return up to `k` citable evidence items for a claim. Never raises — returns [] on
    failure so a deliberation degrades to parametric reasoning rather than breaking."""
    try:
        if PROVIDER == "context":
            try:
                items = await _context_dev(claim, subclaims, k)
            except Exception:  # noqa: BLE001 — context.dev down / no key -> Wikipedia fallback
                items = []
            return items or await _wikipedia(claim, subclaims, k)
        if PROVIDER == "wikipedia":
            return await _wikipedia(claim, subclaims, k)
        return []
    except Exception:  # noqa: BLE001
        return []
