import { Navigate, useLocation } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { PaytmCard, PaytmLinkButton, Wordmark } from '@/components/paytm';

export function NotFound() {
  const { pathname } = useLocation();
  // Old React-era links: /customer/<id> → the customer screen now lives at /khata/<id>.
  const m = /^\/customer\/(\d+)/.exec(pathname);
  if (m) return <Navigate to={`/khata/${m[1]}`} replace />;
  return (
    <div className="min-h-dvh bg-page">
      <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center gap-4 p-6 text-center">
        <Wordmark />
        <PaytmCard className="w-full">
          <h1 className="font-display text-[48px] font-extrabold leading-none text-blue">404</h1>
          <p className="mt-2 text-[13px] text-ink-2">Nothing at {pathname}.</p>
          <div className="mt-4">
            <PaytmLinkButton to="/" full icon={Mic}>Back to Saathi</PaytmLinkButton>
          </div>
        </PaytmCard>
      </div>
    </div>
  );
}
