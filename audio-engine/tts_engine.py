"""
Text-to-Speech engine for KronTerm Voice Engine.
Primary: edge-tts (online, high quality). Fallback: pyttsx3 (offline).
"""

import asyncio
import io
import logging
import os
import tempfile
import threading

log = logging.getLogger(__name__)


class TTSEngine:
    def __init__(self, voice: str = "en-US-JennyNeural", rate: str = "+0%"):
        self.voice = voice
        self.rate = rate
        self._speaking = False
        self._stop_event = threading.Event()

    # ── Public API ────────────────────────────────────────────────

    def speak(self, text: str) -> bool:
        """Synthesize and play text through system audio."""
        if not text:
            return False
        self._speaking = True
        self._stop_event.clear()

        try:
            return self._speak_edge(text)
        except Exception as e:
            log.warning("edge-tts failed, trying pyttsx3: %s", e)
            try:
                return self._speak_pyttsx3(text)
            except Exception as e2:
                log.error("all TTS engines failed: %s", e2)
                self._speaking = False
                return False

    def speak_to_file(self, text: str, path: str) -> bool:
        """Synthesize to audio file."""
        try:
            return self._speak_edge_file(text, path)
        except Exception as e:
            log.error("speak_to_file failed: %s", e)
            return False

    def stop(self):
        self._stop_event.set()
        self._speaking = False

    def is_speaking(self) -> bool:
        return self._speaking

    def list_voices(self) -> list[dict]:
        try:
            import edge_tts

            voices = asyncio.run(edge_tts.list_voices())
            return [
                {
                    "name": v["ShortName"],
                    "locale": v["Locale"],
                    "gender": v["Gender"],
                    "friendly": v.get("FriendlyName", v["ShortName"]),
                }
                for v in voices
            ]
        except Exception as e:
            log.warning("cannot list edge-tts voices: %s", e)
            return []

    def close(self):
        self._speaking = False
        self._stop_event.set()

    # ── Internal ──────────────────────────────────────────────────

    def _speak_edge(self, text: str) -> bool:
        """edge-tts → temp file → play with afplay/sounddevice."""
        import edge_tts
        import sounddevice as sd

        async def _gen():
            communicate = edge_tts.Communicate(text, voice=self.voice, rate=self.rate)
            buf = io.BytesIO()
            async for chunk in communicate.stream():
                if self._stop_event.is_set():
                    return None
                if chunk["type"] == "audio":
                    buf.write(chunk["data"])
            return buf

        buf = asyncio.run(_gen())
        if buf is None:
            self._speaking = False
            return False

        data = buf.getvalue()
        if not data:
            self._speaking = False
            return False

        # Write to temp file and play (simpler than streaming to sd)
        tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
        tmp.write(data)
        tmp.close()

        os.system(f"afplay {tmp.name} &>/dev/null")  # macOS; add ffplay/paplay fallback
        os.unlink(tmp.name)
        self._speaking = False
        return True

    def _speak_edge_file(self, text: str, path: str) -> bool:
        import edge_tts

        async def _gen():
            communicate = edge_tts.Communicate(text, voice=self.voice, rate=self.rate)
            await communicate.save(path)

        asyncio.run(_gen())
        return os.path.exists(path)

    def _speak_pyttsx3(self, text: str) -> bool:
        import pyttsx3

        engine = pyttsx3.init()
        engine.say(text)
        engine.runAndWait()
        engine.stop()
        self._speaking = False
        return True
