"""
Speech-to-Text engine wrapping faster-whisper for KronTerm Voice Engine.
"""

import logging
import os

log = logging.getLogger(__name__)


class STTEngine:
    def __init__(self, model_size: str = "base", device: str = "auto"):
        self.model_size = model_size
        self._model = None
        self._loaded = False

        if device == "auto":
            import torch

            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        log.info("loading faster-whisper model '%s' on %s", model_size, self.device)

    def _ensure_model(self):
        if self._loaded and self._model is not None:
            return
        from faster_whisper import WhisperModel

        # Set OMP/MKL thread count to avoid over-subscription
        os.environ.setdefault("OMP_NUM_THREADS", "4")

        compute_type = "float16" if self.device == "cuda" else "int8"
        self._model = WhisperModel(
            self.model_size, device=self.device, compute_type=compute_type
        )
        self._loaded = True
        log.info("whisper model loaded: %s (%s)", self.model_size, compute_type)

    def transcribe(self, audio_bytes: bytes, language: str | None = None) -> str:
        """Transcribe raw PCM int16 16kHz mono audio bytes. Returns transcribed text."""
        if not audio_bytes or len(audio_bytes) < 320:  # < 10ms @ 16kHz
            return ""

        self._ensure_model()
        import numpy as np

        samples = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        segments, info = self._model.transcribe(
            samples,
            language=language,
            vad_filter=True,
            beam_size=3,
        )
        text = " ".join(seg.text for seg in segments).strip()
        log.info("stt: %r (lang=%s, prob=%.2f)", text[:60], info.language, info.language_probability)
        return text

    def transcribe_file(self, path: str, language: str | None = None) -> str:
        """Transcribe a WAV file directly."""
        self._ensure_model()
        segments, _ = self._model.transcribe(path, language=language, vad_filter=True)
        return " ".join(seg.text for seg in segments).strip()

    def is_available(self) -> bool:
        return self._loaded and self._model is not None

    def close(self):
        self._model = None
        self._loaded = False
        log.info("stt engine closed")
