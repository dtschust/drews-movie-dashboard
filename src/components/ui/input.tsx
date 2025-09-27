import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-sm border border-[#7f9db9] bg-white/95 px-3 py-1.5 text-base text-[#0a1c42] shadow-[inset_1px_1px_0_rgba(255,255,255,0.85), inset_-1px_-1px_0_rgba(123,145,186,0.35)] transition-shadow file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#0a1c42] placeholder:text-[#4b6aa7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3f7eda] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
