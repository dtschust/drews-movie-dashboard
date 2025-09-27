import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm border text-sm font-semibold tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_1px_2px_rgba(0,0,0,0.3)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-0 active:translate-y-[1px] disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-[#1b3d94] bg-[linear-gradient(180deg,#3f7eda_0%,#2851a3_100%)] text-white hover:brightness-110",
        destructive:
          "border-[#8a1b1b] bg-[linear-gradient(180deg,#d6514b_0%,#a32020_100%)] text-white shadow-[inset_0_1px_0_rgba(255,212,212,0.6),0_1px_2px_rgba(0,0,0,0.3)] hover:brightness-110",
        outline:
          "border-[#a2a5a9] bg-[linear-gradient(180deg,#f8f8f8_0%,#d9dce4_100%)] text-[#0b2d69] hover:brightness-105",
        secondary:
          "border-[#4a6fb5] bg-[linear-gradient(180deg,#6d9df2_0%,#4f7dce_100%)] text-white hover:brightness-110",
        ghost:
          "border border-transparent bg-transparent text-[#0a246a] shadow-none hover:bg-white/20",
        link: "border-none bg-transparent p-0 text-[#0a3a94] underline-offset-4 shadow-none hover:underline",
      },
      size: {
        default: "px-4 py-2",
        sm: "px-3 py-1.5 text-xs",
        lg: "px-6 py-2.5 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
