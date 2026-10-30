import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Paytm inputs (spec section 4): 48px, radius 12, white with a hairline, sky focus ring.
        "h-12 w-full min-w-0 rounded-xl border border-line bg-card px-4 py-1 text-[15px] text-ink transition-[color,box-shadow] outline-none selection:bg-sky-tint selection:text-blue file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-ink-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-sky focus-visible:ring-[3px] focus-visible:ring-sky/25",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
