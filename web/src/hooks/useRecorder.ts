// Hear, main path: record with MediaRecorder and POST the clip to /api/voice (Sarvam speech-to-text on the server).
// Chrome gives WebM/Opus, Safari gives MP4/AAC; app/audio.py converts either with ffmpeg.
import { useCallback, useRef, useState } from 'react';

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
}
export const extFor = (type: string) => (type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm');

export function useRecorder(onClip: (blob: Blob, filename: string) => void) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);

  const cancelled = useRef(false);

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state === 'recording') recRef.current.stop();
  }, []);

  /** Stop WITHOUT sending the clip (the listening sheet's ✕, or tapping an example bubble instead). */
  const cancel = useCallback(() => {
    if (recRef.current && recRef.current.state === 'recording') { cancelled.current = true; recRef.current.stop(); }
  }, []);

  const toggle = useCallback(async () => {
    setError('');
    if (recRef.current && recRef.current.state === 'recording') { recRef.current.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(location.protocol === 'https:' || location.hostname === 'localhost'
        ? 'This browser cannot record. Type instead.'
        : 'The microphone only works on an https link. Open the tunnel URL, or type.');
      return;
    }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setError('Allow microphone access to speak, or type.'); return; }
    streamRef.current = stream;
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recRef.current = rec;
    chunks.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    rec.onstop = () => {
      if (timer.current) window.clearTimeout(timer.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setRecording(false);
      if (cancelled.current) { cancelled.current = false; chunks.current = []; return; }
      const type = rec.mimeType || 'audio/webm';
      const blob = new Blob(chunks.current, { type });
      if (blob.size === 0) { setError('Nothing was recorded. Hold the mic a little longer.'); return; }
      onClip(blob, `speech.${extFor(type)}`);
    };
    rec.start();
    setRecording(true);
    timer.current = window.setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 12000);
  }, [onClip]);

  return { recording, error, toggle, stop, cancel };
}
