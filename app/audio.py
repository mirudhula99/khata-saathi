"""Convert browser recordings (WebM from Chrome, MP4/AAC from Safari) to
16 kHz mono WAV before sending them to speech-to-text."""
import os
import shutil
import subprocess
import tempfile


class AudioError(Exception):
    pass


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def to_wav(data: bytes, filename: str = "speech.webm") -> bytes:
    if not data:
        raise AudioError("No audio was recorded. Hold the mic button a little longer and try again.")
    if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return data
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise AudioError("ffmpeg is not installed on the server. Install it (Mac: brew install ffmpeg) and restart.")
    suffix = os.path.splitext(filename)[1] or ".bin"
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "input" + suffix)
        dst = os.path.join(tmp, "output.wav")
        with open(src, "wb") as f:
            f.write(data)
        result = subprocess.run(
            [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-ac", "1", "-ar", "16000", dst],
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0 or not os.path.exists(dst):
            detail = result.stderr.decode(errors="ignore")[-200:]
            raise AudioError(f"Could not read the recording. {detail}".strip())
        with open(dst, "rb") as f:
            return f.read()
