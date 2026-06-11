#!/usr/bin/env python3
"""
KronTerm Voice Engine — Phase 0: Foundation
JSON-RPC over stdin/stdout protocol.

Protocol:
  ->  {"id": 1, "method": "ping"}
  <-  {"id": 1, "result": "pong"}

  ->  {"id": 2, "method": "start_listening"}
  <-  {"id": 2, "result": true}
  <-  {"id": null, "method": "transcript", "params": {"text": "..."}}  (event)

  ->  {"id": 3, "method": "stop_listening"}
  <-  {"id": 3, "result": true}

  ->  {"id": 4, "method": "speak", "params": {"text": "Hello"}}
  <-  {"id": 4, "result": true}

  ->  {"id": 5, "method": "set_wake_word", "params": {"enabled": true}}
  <-  {"id": 5, "result": true}

  ->  {"id": 6, "method": "shutdown"}
  <-  {"id": 6, "result": true}
"""

import json
import sys
import threading
from audio_capture import AudioCapture


class VoiceEngine:
    def __init__(self):
        self.running = True
        self.listening = False
        self.wake_word_enabled = False
        self.capture = AudioCapture()
        self._callbacks = {}

    def handle_request(self, request):
        method = request.get("method")
        params = request.get("params", {})
        req_id = request.get("id")

        handler = getattr(self, f"cmd_{method}", None)
        if handler is None:
            self._send_error(req_id, f"Unknown method: {method}")
            return

        try:
            result = handler(params)
            self._send_result(req_id, result)
        except Exception as e:
            self._send_error(req_id, str(e))

    # ── Commands ────────────────────────────────────────────────

    def cmd_ping(self, params):
        return "pong"

    def cmd_start_listening(self, params):
        if self.listening:
            return True
        self.listening = True
        threading.Thread(target=self._listen_loop, daemon=True).start()
        return True

    def cmd_stop_listening(self, params):
        self.listening = False
        return True

    def cmd_speak(self, params):
        text = params.get("text", "")
        if not text:
            return False
        # Phase 2: delegate to TTS engine
        self._send_event("speaking", {"text": text})
        return True

    def cmd_set_wake_word(self, params):
        self.wake_word_enabled = params.get("enabled", False)
        # Phase 3: wire up Porcupine
        return True

    def cmd_get_status(self, params):
        return {
            "listening": self.listening,
            "wake_word_enabled": self.wake_word_enabled,
            "version": "0.1.0",
        }

    def cmd_shutdown(self, params):
        self.running = False
        self.listening = False
        self.capture.close()
        return True

    # ── Internal ─────────────────────────────────────────────────

    def _listen_loop(self):
        """Background thread: capture mic audio and process."""
        while self.running and self.listening:
            try:
                audio_data = self.capture.read_chunk()
                if audio_data is None:
                    continue
                # Phase 1: send to STT engine
                # Phase 3: check wake word first
                pass
            except Exception as e:
                self._send_event("error", {"message": str(e)})
                break
        self.listening = False

    def _send_result(self, req_id, result):
        if req_id is None:
            return
        msg = {"id": req_id, "result": result}
        self._write_msg(msg)

    def _send_error(self, req_id, message):
        if req_id is None:
            return
        msg = {"id": req_id, "error": {"message": message}}
        self._write_msg(msg)

    def _send_event(self, method, params):
        msg = {"id": None, "method": method, "params": params}
        self._write_msg(msg)

    def _write_msg(self, msg):
        line = json.dumps(msg, ensure_ascii=False)
        sys.stdout.write(line + "\n")
        sys.stdout.flush()

    def run(self):
        """Main loop: read JSON-RPC requests from stdin."""
        self._send_event("ready", {"version": "0.1.0"})
        for raw_line in sys.stdin:
            line = raw_line.strip()
            if not line:
                continue
            try:
                request = json.loads(line)
                self.handle_request(request)
            except json.JSONDecodeError as e:
                self._send_error(None, f"Invalid JSON: {e}")
            if not self.running:
                break


def main():
    engine = VoiceEngine()
    engine.run()


if __name__ == "__main__":
    main()
