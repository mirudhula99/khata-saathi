import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PaytmButton } from '@/components/paytm';
import { useKhata } from '@/store/useKhata';

/**
 * "Join my khata": the QR a customer scans at the counter (GET /api/join-qr.svg, built from PUBLIC_BASE_URL).
 * The /join page itself is the form the customer fills in, so the QR lives here, on the merchant's phone.
 */
export function JoinQrDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state } = useKhata();
  const url = state?.join_url ?? '';
  const local = /\/\/(localhost|127\.0\.0\.1)/.test(url);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-[340px] gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="px-4 pb-2 pt-5">
          <DialogTitle className="text-center">Join my khata</DialogTitle>
          <DialogDescription className="text-center">Customers scan this to get updates and reminders on WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-2 px-6 pb-3">
          {open && <img src="/api/join-qr.svg" alt={`QR code for ${url}`} className="aspect-square w-full max-w-[240px] rounded-xl bg-white p-2" />}
          <p className="break-all text-center text-[12px] text-ink-2">{url}</p>
          {local && <p className="text-center text-[12px] text-error-ink">This is a localhost address, so phones can't open it. Set PUBLIC_BASE_URL to your tunnel address and restart.</p>}
        </div>
        <div className="flex gap-2 border-t border-line px-4 py-3">
          <PaytmButton variant="outline" full icon={ExternalLink} onClick={() => window.open(url, '_blank', 'noopener')}>Open page</PaytmButton>
          <PaytmButton variant="ghost" full onClick={() => onOpenChange(false)}>Close</PaytmButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
