import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-candy text-base font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] shadow-soft inner-shadow",
  {
    variants: {
      variant: {
        default: "candy-purple text-white hover:shadow-soft-lg",
        outline: "border-2 border-primary text-primary bg-white hover:bg-primary hover:text-white",
        ghost: "text-foreground hover:bg-gray-100",
        secondary: "bg-gray-100 text-foreground hover:bg-gray-200",
        success: "candy-mint text-white hover:shadow-soft-lg",
      },
      size: {
        default: "h-12 px-6",
        sm: "h-10 rounded-ios px-4 text-sm",
        lg: "h-14 rounded-ios-lg px-10 text-lg",
        icon: "h-12 w-12 rounded-ios",
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
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

