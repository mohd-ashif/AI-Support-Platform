import sys
import os
import asyncio
from pathlib import Path

# Add project root & api src to sys.path
api_dir = Path(__file__).resolve().parent
project_root = api_dir.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(api_dir))

from dotenv import load_dotenv
load_dotenv(str(api_dir / ".env"))

from apps.api.src.config.settings import settings
import openai

async def run_diagnostics():
    print("=" * 60)
    print("STAGE 2a: Testing Embeddings API Directly (OpenAI text-embedding-3-small)")
    print("=" * 60)
    openai_key = getattr(settings, "OPENAI_API_KEY", "") or os.getenv("OPENAI_API_KEY", "")
    print(f"Configured OPENAI_API_KEY: {'[PRESENT - ' + openai_key[:10] + '...]' if openai_key else '[EMPTY / NOT SET]'}")
    
    embedding_success = False
    query_vector = None
    if not openai_key or "mock" in openai_key.lower():
        print("RESULT 2a: OPENAI_API_KEY is empty or mock. OpenAI embeddings cannot be generated live.")
    else:
        try:
            client = openai.OpenAI(api_key=openai_key)
            resp = client.embeddings.create(
                model="text-embedding-3-small",
                input=["who is Muhammed Ashif?"],
            )
            query_vector = resp.data[0].embedding
            print(f"SUCCESS 2a: Generated embedding vector of length {len(query_vector)}. First 5 values: {query_vector[:5]}")
            embedding_success = True
        except Exception as e:
            print(f"FAILURE 2a: OpenAI Embeddings API error: {type(e).__name__}: {e}")

    print("\n" + "=" * 60)
    print("STAGE 2b: Testing pgvector Similarity Search on Neon PostgreSQL")
    print("=" * 60)
    db_url = getattr(settings, "DATABASE_URL", "") or os.getenv("DATABASE_URL", "")
    print(f"Database URL Host: {db_url.split('@')[-1] if '@' in db_url else db_url}")

    try:
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy import text, select
        from apps.api.src.models.core import KnowledgeChunk, Workspace

        engine = create_async_engine(db_url)
        async with AsyncSession(engine) as session:
            # Get latest workspace_id
            res_ws = await session.execute(select(Workspace).order_by(Workspace.created_at.desc()).limit(1))
            ws = res_ws.scalars().first()
            if not ws:
                print("FAILURE 2b: No workspaces found in database.")
            else:
                workspace_id = ws.id
                print(f"Testing against Workspace ID: {workspace_id} (UUID: {ws.workspace_uuid})")

                # Count chunks
                res_count = await session.execute(select(KnowledgeChunk).where(KnowledgeChunk.workspace_id == workspace_id))
                chunks = res_count.scalars().all()
                print(f"Total Knowledge Chunks in Workspace: {len(chunks)}")
                for c in chunks[:2]:
                    print(f"  - Chunk ID: {c.id} | Source: {c.source_type} | Preview: {c.content[:80]}...")

                if query_vector is None:
                    query_vector = [0.01] * 1536

                sql_query = text("""
                    SELECT id, source_id, content, token_count, 1 - (embedding <=> :query_vector) AS similarity
                    FROM knowledge_chunks
                    WHERE workspace_id = :workspace_id
                    ORDER BY embedding <=> :query_vector
                    LIMIT 5;
                """)
                res_search = await session.execute(sql_query, {
                    "workspace_id": workspace_id,
                    "query_vector": str(query_vector),
                })
                rows = res_search.fetchall()
                print(f"SUCCESS 2b: pgvector query returned {len(rows)} rows.")
                for r in rows:
                    print(f"  - Match ID: {r[0]} | Similarity: {r[4]} | Snippet: {r[2][:80]}...")
        await engine.dispose()
    except Exception as e:
        print(f"FAILURE 2b: pgvector Query Error: {type(e).__name__}: {e}")

    print("\n" + "=" * 60)
    print("STAGE 2c: Testing Candidate LLM API Models Directly")
    print("=" * 60)
    groq_key = getattr(settings, "GROQ_API_KEY", "") or os.getenv("GROQ_API_KEY", "")
    print(f"Configured GROQ_API_KEY: {'[PRESENT - ' + groq_key[:10] + '...]' if groq_key else '[EMPTY / NOT SET]'}")

    test_prompt = "Say hello in one word."

    # 1. Groq llama-3.3-70b-versatile
    print("\n--- 2c.1: Groq llama-3.3-70b-versatile ---")
    if groq_key and groq_key.startswith("gsk_"):
        try:
            client = openai.OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")
            res = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": test_prompt}],
                timeout=10.0,
            )
            print(f"SUCCESS 2c.1: Output: '{res.choices[0].message.content.strip()}'")
        except Exception as e:
            print(f"FAILURE 2c.1: Error: {type(e).__name__}: {e}")
    else:
        print("SKIPPED 2c.1: No valid Groq API key configured.")

    # 2. Groq llama-3.1-8b-instant
    print("\n--- 2c.2: Groq llama-3.1-8b-instant ---")
    if groq_key and groq_key.startswith("gsk_"):
        try:
            client = openai.OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")
            res = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": test_prompt}],
                timeout=10.0,
            )
            print(f"SUCCESS 2c.2: Output: '{res.choices[0].message.content.strip()}'")
        except Exception as e:
            print(f"FAILURE 2c.2: Error: {type(e).__name__}: {e}")
    else:
        print("SKIPPED 2c.2: No valid Groq API key configured.")

    # 3. OpenAI gpt-4o-mini
    print("\n--- 2c.3: OpenAI gpt-4o-mini ---")
    if openai_key and "mock" not in openai_key.lower():
        try:
            client = openai.OpenAI(api_key=openai_key)
            res = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": test_prompt}],
                timeout=10.0,
            )
            print(f"SUCCESS 2c.3: Output: '{res.choices[0].message.content.strip()}'")
        except Exception as e:
            print(f"FAILURE 2c.3: Error: {type(e).__name__}: {e}")
    else:
        print("SKIPPED 2c.3: No valid OpenAI API key configured.")

    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_diagnostics())
