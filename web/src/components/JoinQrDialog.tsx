import { Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PaytmButton } from '@/components/paytm';
import { useT } from '@/lib/i18n';
import { useKhata } from '@/store/useKhata';

/**
 * "Join my khata": the QR a customer scans at the counter (GET /api/join-qr.svg, built from PUBLIC_BASE_URL), and the
 * same link to copy or share, for customers who aren't at the counter.
 */
export function JoinQrDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const { state } = useKhata();
  const url = state?.join_url ?? '';
  const shop = state?.merchant.shop_name ?? t('our shop');
  const message = t("Join {shop}'s khata on Khata Saathi to get your udhaar updates and reminders on WhatsApp: {url}", { shop, url });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('Link copied'));
    } catch {
      window.prompt(t('Copy this link'), url);  // clipboard needs https; the prompt lets the merchant copy it by hand
    }
  };
  // Phones: the system share sheet (WhatsApp, SMS, ...). Laptops without one: WhatsApp with the message filled in.
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: t("Join {shop}'s khata", { shop }), text: message }); } catch { /* closed the sheet */ }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-[340px] gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="px-4 pb-2 pt-5">
          <DialogTitle className="text-center">{t('Join my khata')}</DialogTitle>
          <DialogDescription className="text-center">{t('Customers scan this to get updates and reminders on WhatsApp.')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 px-6 pb-4">
          {open && <img src="/api/join-qr.svg" alt={t('Join my khata QR code')} className="aspect-square w-full max-w-[220px] rounded-xl bg-white p-2" />}
          <div className="w-full">
            <div className="mb-1 text-center text-[12px] text-ink-2">{t('Or share this link')}</div>
            <div className="select-all break-all rounded-xl bg-chip px-3 py-2 text-center text-[13px] font-medium text-ink">{url}</div>
          </div>
          {/* A grid, not flex: Paytm pills are shrink-0, so two full-width pills in a flex row push Share off the edge. */}
          <div className="grid w-full grid-cols-2 gap-2">
            <PaytmButton variant="outline" full icon={Copy} onClick={() => void copy()}>{t('Copy link')}</PaytmButton>
            <PaytmButton variant="primary" full icon={Share2} onClick={() => void share()}>{t('Share')}</PaytmButton>
          </div>
        </div>
        <div className="border-t border-line px-4 py-3">
          <PaytmButton variant="ghost" full onClick={() => onOpenChange(false)}>{t('Close')}</PaytmButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
