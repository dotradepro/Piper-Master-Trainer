import json
from typing import Any

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, project_id: str, websocket: WebSocket):
        await websocket.accept()
        if project_id not in self._connections:
            self._connections[project_id] = []
        self._connections[project_id].append(websocket)

    def disconnect(self, project_id: str, websocket: WebSocket):
        if project_id in self._connections:
            self._connections[project_id] = [
                ws for ws in self._connections[project_id] if ws != websocket
            ]
            if not self._connections[project_id]:
                del self._connections[project_id]

    async def send_to_project(self, project_id: str, message: dict[str, Any]):
        if project_id not in self._connections:
            return
        dead = []
        for ws in self._connections[project_id]:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(project_id, ws)

    async def broadcast(self, message: dict[str, Any]):
        for project_id in list(self._connections.keys()):
            await self.send_to_project(project_id, message)


ws_manager = WebSocketManager()
