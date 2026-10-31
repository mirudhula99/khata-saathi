import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { api } from '@/lib/api';
import { speak } from '@/lib/speech';
import type { MerchantEvent } from '@/lib/types';
import { SaathiPage } from '@/pages/SaathiPage';
import { KhataPage } from '@/pages/KhataPage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { SettleUpPage } from '@/pages/SettleUpPage';
import { RemindersPage } from '@/pages/RemindersPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { AccountPage } from '@/pages/AccountPage';
import { NotFound } from '@/pages/NotFound';
import { useKhata } from '@/store/useKhata';

/** Loads state once, then listens to the server's event stream (payments, disputes, reminders) and refreshes. */
function Bootstrap() {
  const refresh = useKhata((s) => s.refresh);
  const merchantId = useKhata((s) => s.state?.merchant.id ?? null);
  const tts = useKhata((s) => s.state?.health.tts ?? false);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    document.body.classList.add('ks-desktop-body');
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  useEffect(() => {
    if (merchantId == null || typeof EventSource === 'undefined') return;
    const es = new EventSource(`/api/events?channel=merchant:${merchantId}`);
    es.onmessage = (ev) => {
      let d: MerchantEvent;
      try { d = JSON.parse(ev.data) as MerchantEvent; } catch { return; }
      if (d.type === 'payment' || d.type === 'dispute' || d.type === 'joined') {
        if (d.text) (d.type === 'dispute' ? toast.warning : toast.success)(d.text);
        if (d.speak_text) {
          const lang = d.lang ?? 'en-IN';
          if (tts) api.tts(d.speak_text, lang).then((r) => speak(d.speak_text!, lang, r.audio_url)).catch(() => speak(d.speak_text!, lang));
          else speak(d.speak_text, lang);
        }
      } else if (d.type === 'reminder_sent' && d.text) {
        toast(d.text);
      }
      void refresh();
    };
    return () => es.close();
  }, [merchantId, tts, refresh]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <Bootstrap />
      <Routes>
        <Route path="/" element={<SaathiPage />} />
        <Route path="/add" element={<SaathiPage focusMic />} />
        <Route path="/khata" element={<KhataPage />} />
        <Route path="/khata/:id" element={<CustomerDetailPage />} />
        <Route path="/khata/:id/settle" element={<SettleUpPage />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster position="top-center" closeButton toastOptions={{ style: { fontFamily: 'var(--font-sans)' } }} />
    </BrowserRouter>
  );
}
