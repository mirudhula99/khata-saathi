import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--p-card)',
          '--normal-text': 'var(--p-ink)',
          '--normal-border': 'transparent',
          '--border-radius': '16px',
          '--success-bg': 'var(--p-success-bg)',
          '--success-text': 'var(--p-success-ink)',
          '--success-border': 'transparent',
          '--warning-bg': 'var(--p-warning-bg)',
          '--warning-text': 'var(--p-warning-ink)',
          '--warning-border': 'transparent',
          '--error-bg': 'var(--p-error-bg)',
          '--error-text': 'var(--p-error-ink)',
          '--error-border': 'transparent',
          '--info-bg': 'var(--p-info-bg)',
          '--info-text': 'var(--p-info-ink)',
          '--info-border': 'transparent',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
