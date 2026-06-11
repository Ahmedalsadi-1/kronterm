"""
Real-time microphone capture with VAD-based silence buffering for KronTerm Voice Engine.
Produces raw PCM int16 16kHz mono chunks via blocking read_utterance().
"""

import logging
import threading
import time
from collections import deque

import numpy as np
import sounddevice as sd

log = logging.getLogger(__name__)

# Number of consecutive silent frames before declaring end-of-utterance
SILENCE_FRAMES_THRESHOLD = 10  # ~300ms at 30ms frames


class AudioCapture:
    def __init__(self, sample_rate=16000, channels=1, frame_ms=30, padding_ms=300):
        self.sample_rate = sample_rate
        self.channels = channels
        self.frame_ms = frame_ms
        self.frame_size = int(sample_rate * frame_ms / 1000)
        self.padding_samples = int(sample_rate * padding_ms / 1000)

        self._running = False
        self._started = False
        self._buffer = deque()  # raw frames while speaking
        self._silent_frames = 0
        self._speaking = False
        self._utterance_ready = threading.Event()
        self._utterance_result: bytes | None = None
        self._lock = threading.Lock()
        self._close_event = threading.Event()
        self._vad_mode = 0  # 0=disabled (no webvad), 1=enabled

        self.stream: sd.InputStream | None = None

    # ── Public API ────────────────────────────────────────────────

    def start(self):
        if self._started:
            return
        self._started = True
        self._running = True
        self._close_event.clear()
        self.stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=self.channels,
            dtype="int16",
            blocksize=self.frame_size,
            callback=self._audio_callback,
        )
        self.stream.start()
        log.info("audio capture started (%dHz, %dch)", self.sample_rate, self.channels)

    def stop(self):
        self._running = False
        self._close_event.set()
        if self.stream:
            self.stream.stop()
            self.stream.close()
            self.stream = None
        self._started = False
        log.info("audio capture stopped")

    def close(self):
        self.stop()

    def is_speaking(self) -> bool:
        return self._speaking

    def set_vad(self, enabled: bool):
        self._vad_mode = 1 if enabled else 0

    def read_utterance(self, timeout: float = 30.0) -> bytes | None:
        """Blocking read of next complete utterance. Returns raw PCM int16 bytes."""
        self._utterance_result = None
        self._utterance_ready.clear()

        ok = self._utterance_ready.wait(timeout)
        if not ok:
            return None
        return self._utterance_result

    @staticmethod
    def list_devices() -> list[dict]:
        devices = sd.query_devices()
        return [
            {
                "index": i,
                "name": d["name"],
                "channels": d["max_input_channels"],
                "sample_rate": d["default_samplerate"],
            }
            for i, d in enumerate(devices)
            if d["max_input_channels"] > 0
        ]

    # ── Internal ──────────────────────────────────────────────────

    def _audio_callback(self, indata: np.ndarray, _frames: int, _time_info, _status):
        if not self._running:
            return

        frame = indata.copy()
        has_voice = self._detect_voice(frame)

        with self._lock:
            if has_voice:
                # Start of utterance
                if not self._speaking:
                    self._speaking = True
                    self._buffer.clear()
                    self._silent_frames = 0
                    # Prepend padding from recent history is tricky without ringbuffer
                    # skip for now; whisper can handle truncated starts
                self._buffer.append(frame.tobytes())
                self._silent_frames = 0
            elif self._speaking:
                # Still in utterance, append trailing silence before cutoff
                self._buffer.append(frame.tobytes())
                self._silent_frames += 1
                if self._silent_frames >= SILENCE_FRAMES_THRESHOLD:
                    # End of utterance
                    result = b"".join(self._buffer)
                    self._buffer.clear()
                    self._speaking = False
                    self._silent_frames = 0
                    self._utterance_result = result
                    self._utterance_ready.set()
            # else: silence outside utterance — discard

    def _detect_voice(self, frame: np.ndarray) -> bool:
        if self._vad_mode == 0:
            # Simple energy-based VAD
            rms = np.sqrt(np.mean(frame.astype(np.float32) ** 2))
            return rms > 200  # threshold tunable
        # Phase 2: wire webrtcvad here
        return True
