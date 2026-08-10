import logging
import jwt

try:
    import socketio
except ImportError:
    socketio = None

from apps.api.src.config.settings import settings

logger = logging.getLogger("socketio_manager")

if socketio is not None:
    try:
        mgr = socketio.AsyncRedisManager(settings.REDIS_URL)
        sio = socketio.AsyncServer(
            async_mode="asgi",
            cors_allowed_origins="*",
            client_manager=mgr,
        )
    except Exception as e:
        logger.warning(f"AsyncRedisManager fallback to default in-memory manager: {e}")
        sio = socketio.AsyncServer(
            async_mode="asgi",
            cors_allowed_origins="*",
        )
    sio_app = socketio.ASGIApp(sio, socketio_path="socket.io")
else:
    sio = None
    sio_app = None

if sio is not None:
    @sio.event
    async def connect(sid, environ, auth=None):
        logger.info(f"[SOCKET.IO] Client connected | sid={sid} | auth={auth}")
        
        # 1. Dashboard Authentication
        token = None
        if isinstance(auth, dict):
            token = auth.get("token") or auth.get("jwt")
        
        if token:
            try:
                payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
                user_id = payload.get("sub")
                
                # Resolve workspace from token payload or team member query
                from apps.api.src.database.session import AsyncSessionLocal
                from apps.api.src.models.core import TeamMember, select
                
                async with AsyncSessionLocal() as db:
                    res = await db.execute(select(TeamMember).where(TeamMember.user_id == user_id))
                    member = res.scalars().first()
                    if member:
                        room_name = f"workspace_{member.workspace_id}"
                        await sio.enter_room(sid, room_name)
                        logger.info(f"[SOCKET.IO] Authenticated Dashboard User {user_id} joined room '{room_name}'")
                        return
            except Exception as err:
                logger.warning(f"[SOCKET.IO] Auth verification failed for sid={sid}: {err}")

        # 2. Public Widget Client Room Joining
        query_str = environ.get("QUERY_STRING", "")
        params = dict(item.split("=") for item in query_str.split("&") if "=" in item)
        
        conv_id = params.get("conversation_id") or (auth and auth.get("conversation_id"))
        if conv_id:
            room_name = f"conversation_{conv_id}"
            await sio.enter_room(sid, room_name)
            logger.info(f"[SOCKET.IO] Widget Client joined room '{room_name}'")


    @sio.event
    async def join_conversation(sid, data):
        conv_id = data.get("conversation_id") if isinstance(data, dict) else str(data)
        if conv_id:
            room_name = f"conversation_{conv_id}"
            await sio.enter_room(sid, room_name)
            logger.info(f"[SOCKET.IO] Client {sid} joined conversation room '{room_name}'")


    @sio.event
    async def join_workspace(sid, data):
        ws_id = data.get("workspace_id") if isinstance(data, dict) else str(data)
        if ws_id:
            room_name = f"workspace_{ws_id}"
            await sio.enter_room(sid, room_name)
            logger.info(f"[SOCKET.IO] Client {sid} joined workspace room '{room_name}'")


    @sio.event
    async def disconnect(sid):
        logger.info(f"[SOCKET.IO] Client disconnected | sid={sid}")


# Global helper functions for emitting events from ANY process
async def emit_to_workspace(workspace_id: str, event: str, data: dict):
    if not sio:
        return
    room_name = f"workspace_{workspace_id}"
    try:
        await sio.emit(event, data, room=room_name)
        logger.info(f"[SOCKET.IO] Emitted '{event}' to workspace room '{room_name}'")
    except Exception as e:
        logger.error(f"[SOCKET.IO] Failed to emit to workspace room '{room_name}': {e}")


async def emit_to_conversation(conversation_id: str, event: str, data: dict):
    if not sio:
        return
    room_name = f"conversation_{conversation_id}"
    try:
        await sio.emit(event, data, room=room_name)
        logger.info(f"[SOCKET.IO] Emitted '{event}' to conversation room '{room_name}'")
    except Exception as e:
        logger.error(f"[SOCKET.IO] Failed to emit to conversation room '{room_name}': {e}")
