import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-sans text-sm font-bold ring-offset-background transition-[transform,background-color,color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-0 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Ink pill: the everyday action. */
        default: "bg-ink text-cloth hover:-translate-y-0.5 hover:bg-ink/90",
        /** Sun pill: the one main call to action on a screen (Book, Pay, Join). */
        sun: "bg-sun text-ink hover:-translate-y-0.5 hover:bg-sun-300",
        /** Brand green, for confirmations. */
        primary: "bg-primary text-primary-foreground hover:-translate-y-0.5 hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-cloth",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        /** Glass pill for use on photos and ink bands. */
        glass: "border-[1.5px] border-white/55 bg-white/10 text-white backdrop-blur-md hover:bg-white/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-[13px]",
        lg: "h-14 px-7 text-base",
        icon: "h-10 w-10",
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
