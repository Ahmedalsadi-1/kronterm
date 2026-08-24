from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


PLUGIN_PATH = Path(__file__).parents[1] / "plugins" / "kronterm-tools" / "__init__.py"


def _load_plugin():
    spec = importlib.util.spec_from_file_location("kronterm_tools_test_plugin", PLUGIN_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_registers_bridge_manifest_and_preserves_collision_alias(monkeypatch, tmp_path):
    fake_bridge = tmp_path / "fake_bridge.py"
    fake_bridge.write_text(
        """
import json
import sys

request = json.load(sys.stdin)
if request["method"] == "list":
    response = {
        "tools": [
            {"name": "surface_status", "description": "Read status", "inputSchema": {"type": "object"}},
            {"name": "browser_navigate", "description": "Navigate", "inputSchema": {"type": "object"}},
        ]
    }
else:
    response = {"content": [{"type": "text", "text": request["name"]}]}
json.dump(response, sys.stdout)
""".strip(),
        encoding="utf-8",
    )
    monkeypatch.setenv("HERMES_KRONTERM_TOOL_BRIDGE_COMMAND", json.dumps([sys.executable, str(fake_bridge)]))
    plugin = _load_plugin()
    registrations = []

    class Context:
        def register_tool(self, **kwargs):
            registrations.append(kwargs)

    plugin.register(Context())

    by_name = {registration["name"]: registration for registration in registrations}
    assert set(by_name) == {"surface_status", "kronterm_browser_navigate"}
    assert by_name["surface_status"]["toolset"] == "kronterm"
    assert by_name["kronterm_browser_navigate"]["handler"]({}) == "browser_navigate"


def test_normalizes_image_results_for_hermes():
    plugin = _load_plugin()

    result = plugin._normalize_result(
        {
            "content": [
                {"type": "text", "text": "captured"},
                {"type": "image", "mimeType": "image/png", "data": "aW1hZ2U="},
            ]
        }
    )

    assert result["_multimodal"] is True
    assert result["content"][1]["image_url"]["url"] == "data:image/png;base64,aW1hZ2U="
