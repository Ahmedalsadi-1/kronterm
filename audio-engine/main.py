#!/usr/bin/env python3
"""
KronTerm Voice Engine — Phase 1: Real audio pipeline.
JSON-RPC over stdin/stdout.

Flow:
  start_listening → AudioCapture.start() → VAD → silence-buffered utterance
  → faster-whisper STT → transcript event
  speak → edge-tts TTS → audio playback
"""

import json
import logging
import sys
import threading

from audio_capture import AudioCapture
from stt_engine import STTEngine
from tts_engine import TTSEngine

logging.basicConfig(stream=sys.stderr, level=logging.INFO, format="%(name)s [%(levelname)s] %(message)s")
log = logging.getLogger("voice-engine")


class VoiceEngine:
    def __init__(self):
        self.running = True
        self.listening = False
        self.wake_word_enabled = False
        self._stt_ready = False
        self._capture_thread: threading.Thread | None = None

        self.capture = AudioCapture()
        self.stt = STTEngine()
        self.tts = TTSEngine()

    def _load_stt(self):
        """Load STT model lazily (first start_listening)."""
        if not self._stt_ready:
            try:
                self.stt.transcribe(b"")  # force model load
                self._stt_ready = True
            except Exception as e:
                self._send_event("error", {"message": f"STT load failed: {e}"})
                log.exception("stt load failed")

    # ── Request handler ───────────────────────────────────────────

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

    # ── Commands ─────────────────────────────────────────────────

    def cmd_ping(self, params):
        return "pong"

    def cmd_start_listening(self, params):
        if self.listening:
            return True
        self._load_stt()
        self.listening = True
        self.capture.start()
        self._capture_thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._capture_thread.start()
        self._send_event("listening", {"listening": True})
        return True

    def cmd_stop_listening(self, params):
        self.listening = False
        self.capture.stop()
        self._send_event("listening", {"listening": False})
        return True

    def cmd_speak(self, params):
        text = params.get("text", "")
        if not text:
            return False
        self._send_event("speaking", {"text": text})
        threading.Thread(target=self._speak_loop, args=(text,), daemon=True).start()
        return True

    def cmd_set_wake_word(self, params):
        self.wake_word_enabled = params.get("enabled", False)
        return True

    def cmd_get_status(self, params):
        return {
            "listening": self.listening,
            "wake_word_enabled": self.wake_word_enabled,
            "stt_ready": self._stt_ready,
            "version": "0.2.0",
        }

    def cmd_get_devices(self, params):
        return AudioCapture.list_devices()

    def cmd_list_voices(self, params):
        return self.tts.list_voices()

    def cmd_shutdown(self, params):
        self.running = False
        self.listening = False
        self.capture.close()
        self.stt.close()
        self.tts.close()
        return True

    # ── Internal loops ────────────────────────────────────────────

    def _listen_loop(self):
        while self.running and self.listening:
            audio = self.capture.read_utterance(timeout=1.0)
            if audio is None:
                continue
            if not self.listening:
                break
            self._send_event("listening", {"listening": True})
            try:
                text = self.stt.transcribe(audio)
                if text:
                    self._send_event("transcript", {"text": text})
            except Exception as e:
                self._send_event("error", {"message": f"STT failed: {e}"})
        self._send_event("listening", {"listening": False})

    def _speak_loop(self, text: str):
        ok = self.tts.speak(text)
        if not ok:
            self._send_event("error", {"message": "TTS playback failed"})
        self._send_event("speaking", {"text": None})  # signal done

    # ── Protocol helpers ──────────────────────────────────────────

    def _send_result(self, req_id, result):
        if req_id is None:
            return
        self._write_msg({"id": req_id, "result": result})

    def _send_error(self, req_id, message):
        self._write_msg({"id": req_id, "error": {"message": message}})

    def _send_event(self, method, params):
        if isinstance(params, dict) and params.get("listening") is False:
            pass
        self._write_msg({"id": None, "method": method, "params": params})

    def _write_msg(self, msg):
        line = json.dumps(msg, ensure_ascii=False)
        sys.stdout.write(line + "\n")
        sys.stdout.flush()

    def run(self):
        self._send_event("ready", {"version": "0.2.0"})
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
