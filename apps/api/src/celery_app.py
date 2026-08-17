import os
import sys
import asyncio
import logging
from pathlib import Path

# Auto-resolve project root and apps/api in sys.path to prevent ModuleNotFoundError
current_file = Path(__file__).resolve()
project_root = str(current_file.parent.parent.parent.parent)
api_root = str(current_file.parent.parent)

if project_root not in sys.path:
    sys.path.insert(0, project_root)
if api_root not in sys.path:
    sys.path.insert(0, api_root)

from celery import Celery
from apps.api.src.config.settings import settings

broker_url = getattr(settings, "RABBITMQ_URL", None) or os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672//")
result_backend = getattr(settings, "REDIS_URL", None) or os.getenv("REDIS_URL", "redis://localhost:6379/0")
if result_backend and result_backend.startswith("rediss://") and "ssl_cert_reqs" not in result_backend:
    sep = "&" if "?" in result_backend else "?"
    result_backend = f"{result_backend}{sep}ssl_cert_reqs=none"

celery_app = Celery(
    "supportai_tasks",
    broker=broker_url,
    backend=result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    redis_backend_use_ssl={"ssl_cert_reqs": "none"},
)

@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=5,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
)
def ingest_web_source_task(self, source_id: str, workspace_id: str, url: str):
    """
    Durable Celery task for Web Ingestion.
    Opens its own isolated AsyncSessionLocal connection.
    Retries max 2 times on network errors, but fails immediately without retry on validation errors.
    """
    from apps.api.src.database.session import AsyncSessionLocal
    from apps.api.src.models.core import SourceWeb, select, utc_now
    from apps.api.src.services.crawler_service import crawl_website
    from apps.api.src.services.source_service import process_and_store_chunks

    logger.info(f"[CELERY-TASK] Starting ingest_web_source_task | source_id={source_id} | url={url}")

    async def _run_web_ingestion():
        async with AsyncSessionLocal() as db:
            try:
                res = await db.execute(select(SourceWeb).where(SourceWeb.id == source_id))
                source = res.scalars().first()
                if not source:
                    logger.warning(f"[CELERY-TASK] Source {source_id} not found in DB")
                    return

                source.status = "crawling"
                await db.commit()

                crawled_pages = await crawl_website(url)
                combined_text = "\n\n".join([f"=== Document: {p['title']} ({p['url']}) ===\n{p['text']}" for p in crawled_pages])

                await process_and_store_chunks(
                    db=db,
                    workspace_id=workspace_id,
                    source_type="web",
                    source_id=source.id,
                    raw_text=combined_text,
                )

                res = await db.execute(select(SourceWeb).where(SourceWeb.id == source_id))
                source = res.scalars().first()
                if source:
                    source.status = "ready"
                    source.page_count = len(crawled_pages)
                    source.last_crawled_at = utc_now()
                    source.error_message = None
                    await db.commit()
                logger.info(f"[CELERY-TASK] Completed web ingestion for source {source_id}")
            except Exception as e:
                logger.error(f"[CELERY-TASK] Error during web ingestion for source {source_id}: {e}")
                try:
                    res = await db.execute(select(SourceWeb).where(SourceWeb.id == source_id))
                    source = res.scalars().first()
                    if source:
                        source.status = "failed"
                        source.error_message = str(e)
                        await db.commit()
                except Exception:
                    pass
                raise

    loop = asyncio.get_event_loop() if asyncio.events._get_running_loop() else asyncio.new_event_loop()
    try:
        loop.run_until_complete(_run_web_ingestion())
    except Exception as exc:
        # Retry only transient connection errors
        if isinstance(exc, (ConnectionError, TimeoutError)):
            raise self.retry(exc=exc)
        logger.error(f"[CELERY-TASK] Validation/Non-transient error, failing without retry: {exc}")


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=5,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
)
def ingest_file_source_task(self, source_id: str, workspace_id: str, extracted_text: str):
    """
    Durable Celery task for File Ingestion.
    Opens its own isolated AsyncSessionLocal connection.
    """
    from apps.api.src.database.session import AsyncSessionLocal
    from apps.api.src.models.core import SourceFile, select
    from apps.api.src.services.source_service import process_and_store_chunks

    logger.info(f"[CELERY-TASK] Starting ingest_file_source_task | source_id={source_id}")

    async def _run_file_ingestion():
        async with AsyncSessionLocal() as db:
            try:
                res = await db.execute(select(SourceFile).where(SourceFile.id == source_id))
                source = res.scalars().first()
                if not source:
                    logger.warning(f"[CELERY-TASK] SourceFile {source_id} not found in DB")
                    return

                source.status = "processing"
                await db.commit()

                await process_and_store_chunks(
                    db=db,
                    workspace_id=workspace_id,
                    source_type="file",
                    source_id=source.id,
                    raw_text=extracted_text,
                )

                res = await db.execute(select(SourceFile).where(SourceFile.id == source_id))
                source = res.scalars().first()
                if source:
                    source.status = "ready"
                    source.error_message = None
                    await db.commit()
                logger.info(f"[CELERY-TASK] Completed file ingestion for source {source_id}")
            except Exception as e:
                logger.error(f"[CELERY-TASK] Error during file ingestion for source {source_id}: {e}")
                try:
                    res = await db.execute(select(SourceFile).where(SourceFile.id == source_id))
                    source = res.scalars().first()
                    if source:
                        source.status = "failed"
                        source.error_message = str(e)
                        await db.commit()
                except Exception:
                    pass
                raise

    loop = asyncio.get_event_loop() if asyncio.events._get_running_loop() else asyncio.new_event_loop()
    try:
        loop.run_until_complete(_run_file_ingestion())
    except Exception as exc:
        if isinstance(exc, (ConnectionError, TimeoutError)):
            raise self.retry(exc=exc)
        logger.error(f"[CELERY-TASK] Non-transient error, failing without retry: {exc}")


@celery_app.task(
    bind=True,
    max_retries=1,
    default_retry_delay=3,
)
def process_ai_response_task(self, conversation_id: str, visitor_message: str, workspace_id: str, history_tuples: list):
    """
    Durable Celery task for Async AI Response Generation.
    Cross-process event emission via Redis-backed Socket.io manager.
    """
    import importlib
    from apps.api.src.database.session import AsyncSessionLocal
    from apps.api.src.models.core import Conversation, Message, select
    from apps.api.src.socket_app import emit_to_conversation, emit_to_workspace
    
    if "src.graph.agent_graph" in sys.modules:
        importlib.reload(sys.modules["src.graph.agent_graph"])
        agent_graph_module = sys.modules["src.graph.agent_graph"]
    elif "apps.api.src.graph.agent_graph" in sys.modules:
        importlib.reload(sys.modules["apps.api.src.graph.agent_graph"])
        agent_graph_module = sys.modules["apps.api.src.graph.agent_graph"]
    else:
        try:
            import apps.api.src.graph.agent_graph as agent_graph_module
        except ModuleNotFoundError:
            import src.graph.agent_graph as agent_graph_module

    retrieve_knowledge_chunks = agent_graph_module.retrieve_knowledge_chunks
    run_reasoner_node = agent_graph_module.run_reasoner_node
    evaluate_tool_router = agent_graph_module.evaluate_tool_router
    GraphState = agent_graph_module.GraphState

    async def _generate_ai_response():
        async with AsyncSessionLocal() as db:
            # 1. Check conversation status - IF Already HUMAN, skip AI generation!
            res_conv = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
            conv = res_conv.scalars().first()
            if not conv or conv.status == "human":
                logger.info(f"[CELERY-AI] Conversation {conversation_id} status is 'human' — skipping AI response.")
                return

            # 2. Emit ai:thinking event to widget room
            await emit_to_conversation(conversation_id, "ai:thinking", {
                "conversation_id": conversation_id,
                "status": "thinking",
            })

            # 3. Retrieve chunks & execute reasoner
            chunks, max_confidence = await retrieve_knowledge_chunks(
                workspace_id=workspace_id,
                query=visitor_message,
                db=db,
            )

            state: GraphState = {
                "workspace_id": workspace_id,
                "conversation_id": conversation_id,
                "visitor_message": visitor_message,
                "conversation_history": history_tuples or [],
                "retrieved_chunks": chunks,
                "retrieval_confidence": max_confidence,
                "turn_count_unresolved": 0 if max_confidence >= 0.5 else 1,
                "should_escalate": False,
                "response_text": "",
            }

            ai_text, should_escalate_reasoner = await run_reasoner_node(state, db=db)
            should_escalate = evaluate_tool_router(state, conversation_status=conv.status) or should_escalate_reasoner

            if should_escalate:
                conv.status = "human"
                await db.commit()

            # 4. Save AI Response to Database
            ai_msg = Message(
                conversation_id=conversation_id,
                sender_type="ai",
                content=ai_text,
            )
            db.add(ai_msg)
            await db.commit()
            await db.refresh(ai_msg)

            msg_payload = {
                "id": ai_msg.id,
                "conversation_id": conversation_id,
                "workspace_id": workspace_id,
                "sender_type": "ai",
                "content": ai_text,
                "created_at": ai_msg.created_at.isoformat(),
                "should_escalate": should_escalate,
            }

            # 5. Cross-process Socket.io emission via Redis-backed manager
            await emit_to_conversation(conversation_id, "message:new", msg_payload)
            await emit_to_workspace(workspace_id, "message:new", msg_payload)
            if should_escalate:
                await emit_to_conversation(conversation_id, "conversation:status_changed", {"status": "human"})
                await emit_to_workspace(workspace_id, "conversation:assigned", {"conversation_id": conversation_id, "status": "human"})

    loop = asyncio.get_event_loop() if asyncio.events._get_running_loop() else asyncio.new_event_loop()
    try:
        loop.run_until_complete(_generate_ai_response())
    except Exception as exc:
        logger.error(f"[CELERY-AI] Error during AI response generation: {exc}")


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=5,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
)
def process_knowledge_document_task(self, source_id: str, document_id: str, version_id: str, workspace_id: str, source_type: str, raw_text: str, url: str = None):
    """
    Durable Celery task for unified Knowledge Document Ingestion.
    Executes async extraction, cleaning, chunking, embedding, and vector insertion.
    """
    from apps.api.src.services.ingestion_service import ingest_knowledge_document_background

    logger.info(f"[CELERY-TASK] Starting process_knowledge_document_task | source_id={source_id} | doc_id={document_id}")

    loop = asyncio.get_event_loop() if asyncio.events._get_running_loop() else asyncio.new_event_loop()
    try:
        loop.run_until_complete(
            ingest_knowledge_document_background(
                workspace_id=workspace_id,
                source_id=source_id,
                document_id=document_id,
                version_id=version_id,
                source_type=source_type,
                raw_text=raw_text,
                url=url,
            )
        )
    except Exception as exc:
        if isinstance(exc, (ConnectionError, TimeoutError)):
            raise self.retry(exc=exc)
        logger.error(f"[CELERY-TASK] Knowledge Document Ingestion error: {exc}")


