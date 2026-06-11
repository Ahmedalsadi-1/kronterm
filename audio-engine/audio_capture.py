"""
Microphone audio capture module for KronTerm Voice Engine.
Phase 0: Skeleton with device enumeration.
Future: Chunked capture for streaming STT, VAD detection.
"""

import numpy as np


class AudioCapture:
    """Audio capture via sounddevice."""

    def __init__(self, sample_rate: int = 16000, channels: int = 1):
        self.sample_rate = sample_rate
        self.channels = channels
        self.device = None
        self.stream = None
        self._opened = False

    def open(self):
        """Open the microphone stream."""
        import sounddevice as sd

        if self._opened:
            return
        self.device = sd.default.device
        self.stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=self.channels,
            blocksize=1024,
        )
        self.stream.start()
        self._opened = True

    def read_chunk(self) -> np.ndarray | None:
        """Read one audio chunk. Returns None if not opened."""
        if not self._opened:
            self.open()
            if not self._opened:
                return None
        try:
            chunk, _ = self.stream.read(1024)
            return chunk
        except Exception:
            return None

    def close(self):
        """Close the microphone stream."""
        if self.stream:
            self.stream.stop()
            self.stream.close()
        self._opened = False

    def list_devices(self) -> list[dict]:
        """List available audio input devices."""
        import sounddevice as sd

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
