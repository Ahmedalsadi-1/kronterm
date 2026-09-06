"""Hermes registrations backed by KronTerm's TypeScript tool runtime."""

from __future__ import annotations

import json
import logging
import os
import subprocess
from typing import Any, Dict, Iterable

logger = logging.getLogger(__name__)

_COMMAND_ENV = "HERMES_KRONTERM_TOOL_BRIDGE_COMMAND"
_TOOLSET = "kronterm"
_TIMEOUT_SECONDS = 120
_MAX_OUTPUT_BYTES = 16 * 1024 * 1024
_ALIASES = {"browser_navigate": "kronterm_browser_navigate"}


def _bridge_command() -> list[str]:
    raw = os.environ.get(_COMMAND_ENV, "").strip()
    if not raw:
        return []
    try:
        command = json.loads(raw)
    except ValueError:
        logger.warning("Ignoring malformed %s", _COMMAND_ENV)
        return []
    if not isinstance(command, list) or not command or not all(isinstance(item, str) and item for item in command):
        logger.warning("Ignoring invalid %s command", _COMMAND_ENV)
        return []
    return command


def _bridge_request(payload: Dict[str, Any]) -> Dict[str, Any]:
    command = _bridge_command()
    if not command:
        return {"error": "KronTerm TypeScript tool bridge is unavailable"}
    env = dict(os.environ)
    env["ELECTRON_RUN_AS_NODE"] = "1"
    try:
        completed = subprocess.run(
            command,
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=_TIMEOUT_SECONDS,
            env=env,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"error": f"KronTerm TypeScript tool bridge failed: {exc}"}
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "bridge exited without diagnostics").strip()
        return {"error": f"KronTerm TypeScript tool bridge failed: {detail[:2048]}"}
    if len(completed.stdout.encode("utf-8", errors="replace")) > _MAX_OUTPUT_BYTES:
        return {"error": "KronTerm TypeScript tool bridge returned an oversized response"}
    try:
        response = json.loads(completed.stdout)
    except ValueError:
        return {"error": "KronTerm TypeScript tool bridge returned invalid JSON"}
    if not isinstance(response, dict):
        return {"error": "KronTerm TypeScript tool bridge returned an invalid response"}
    return response


def _manifest_tools() -> list[Dict[str, Any]]:
    response = _bridge_request({"method": "list"})
    tools = response.get("tools")
    if not isinstance(tools, list):
        if response.get("error"):
            logger.info("KronTerm native tools unavailable: %s", response["error"])
        return []
    return [tool for tool in tools if isinstance(tool, dict)]


def _result_text(content: Iterable[Dict[str, Any]]) -> str:
    texts = [str(item.get("text", "")) for item in content if item.get("type") == "text" and item.get("text")]
    return "\n".join(texts)


def _normalize_result(response: Dict[str, Any]) -> str | Dict[str, Any]:
    if response.get("error"):
        return json.dumps({"error": str(response["error"])})
    content = response.get("content")
    if not isinstance(content, list):
        return json.dumps({"error": "KronTerm TypeScript tool returned an invalid result"})
    parts = [item for item in content if isinstance(item, dict)]
    text = _result_text(parts)
    if response.get("isError"):
        return json.dumps({"error": text or "KronTerm tool call failed"})
    images = [item for item in parts if item.get("type") == "image" and item.get("data")]
    if not images:
        if text:
            return text
        structured = response.get("structuredContent")
        return json.dumps(structured if structured is not None else {"ok": True})
    multimodal = [{"type": "text", "text": text or "KronTerm screenshot"}]
    for image in images:
        mime_type = str(image.get("mimeType") or "image/png")
        multimodal.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:{mime_type};base64,{image['data']}"},
            }
        )
    return {"_multimodal": True, "content": multimodal, "text_summary": text or "KronTerm screenshot"}


def _handler(original_name: str):
    def call(args: Dict[str, Any], **_: Any) -> str | Dict[str, Any]:
        response = _bridge_request({"method": "call", "name": original_name, "arguments": args})
        return _normalize_result(response)

    return call


def _schema(tool: Dict[str, Any], exposed_name: str) -> Dict[str, Any]:
    annotations = tool.get("annotations") if isinstance(tool.get("annotations"), dict) else {}
    description = str(tool.get("description") or f"Call the KronTerm {exposed_name} surface tool.")
    if annotations.get("destructiveHint") is True:
        description = f"{description} This operation can replace or delete state; inspect the target first."
    parameters = tool.get("inputSchema") if isinstance(tool.get("inputSchema"), dict) else {"type": "object"}
    return {"name": exposed_name, "description": description, "parameters": parameters}


def register(ctx) -> None:
    """Register every schema exported by the TypeScript bridge."""
    for tool in _manifest_tools():
        original_name = tool.get("name")
        if not isinstance(original_name, str) or not original_name:
            continue
        exposed_name = _ALIASES.get(original_name, original_name)
        ctx.register_tool(
            name=exposed_name,
            toolset=_TOOLSET,
            schema=_schema(tool, exposed_name),
            handler=_handler(original_name),
            check_fn=lambda: bool(_bridge_command()),
            description=str(tool.get("description") or ""),
            emoji="🪐",
        )
