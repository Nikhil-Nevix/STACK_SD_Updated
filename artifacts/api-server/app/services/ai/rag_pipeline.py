"""
RAG Pipeline — Retrieval-Augmented Generation for SOP matching.
Uses Azure OpenAI embeddings + pgvector similarity search when available.
Falls back to keyword search otherwise.
"""
import json
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.config import get_settings
from app.models.ai import SOP

logger = logging.getLogger("stack.rag")


async def embed_text(text: str) -> Optional[list[float]]:
    """Generate embedding using Azure OpenAI. Returns None if AI not configured."""
    settings = get_settings()
    if not settings.ai_enabled:
        return None
    try:
        from openai import AsyncAzureOpenAI
        client = AsyncAzureOpenAI(
            api_key=settings.azure_openai_api_key,
            azure_endpoint=settings.azure_openai_endpoint,
            api_version=settings.azure_openai_api_version,
        )
        response = await client.embeddings.create(
            model=settings.azure_openai_embedding_deployment,
            input=text,
        )
        return response.data[0].embedding
    except Exception as e:
        logger.warning(f"Embedding failed: {e}")
        return None


async def embed_sop(sop_id: str):
    """Compute and store embedding for a SOP."""
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SOP).where(SOP.sop_id == sop_id))
        sop = result.scalar_one_or_none()
        if not sop:
            return
        embedding = await embed_text(f"{sop.title}\n{sop.content}")
        if embedding:
            sop.embedding = embedding
            await db.commit()
            logger.info(f"Embedded SOP {sop_id}")


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Pure Python cosine similarity."""
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = sum(x * x for x in a) ** 0.5
    mag_b = sum(x * x for x in b) ** 0.5
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


async def search_sops_semantic(
    query: str,
    use_case: Optional[str],
    limit: int,
    db: AsyncSession,
) -> list[dict]:
    """Search SOPs by semantic similarity (vector) or keyword fallback."""
    q = select(SOP).where(SOP.is_active == True)
    if use_case:
        q = q.where(SOP.use_case == use_case)

    result = await db.execute(q)
    sops = result.scalars().all()

    query_embedding = await embed_text(query)

    if query_embedding:
        # Vector similarity search
        scored = []
        for sop in sops:
            if sop.embedding:
                score = _cosine_similarity(query_embedding, sop.embedding)
                scored.append((score, sop))
        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:limit]
    else:
        # Keyword fallback
        query_lower = query.lower()
        scored = []
        for sop in sops:
            text = f"{sop.title} {sop.content}".lower()
            score = sum(1 for word in query_lower.split() if word in text) / max(len(query_lower.split()), 1)
            scored.append((score, sop))
        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:limit]

    return [
        {
            "sop_id": str(s.sop_id),
            "title": s.title,
            "use_case": s.use_case,
            "similarity_score": round(score, 4),
            "content_preview": s.content[:300] + "..." if len(s.content) > 300 else s.content,
        }
        for score, s in top
    ]


async def find_best_sop(query: str, use_case: str, db: AsyncSession) -> tuple[Optional[SOP], float]:
    """Find the best matching SOP for a ticket. Returns (sop, similarity_score)."""
    results = await search_sops_semantic(query, use_case, 1, db)
    if not results:
        return None, 0.0
    # Fetch the actual SOP object
    sop_id = results[0]["sop_id"]
    sop_result = await db.execute(select(SOP).where(SOP.sop_id == sop_id))
    sop = sop_result.scalar_one_or_none()
    return sop, results[0]["similarity_score"]
