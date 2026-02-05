import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-candy-sm text-base font-black transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-candy-blue focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] shadow-soft-xl backdrop-blur-sm touch-manipulation select-none cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-candy-blue to-candy-purple text-white hover:shadow-soft-2xl hover:from-candy-blue/90 hover:to-candy-purple/90",
        outline: "border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-600",
        ghost: "text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50",
        secondary: "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700",
        success: "bg-gradient-to-r from-candy-mint to-green-500 text-white hover:shadow-soft-2xl",
      },
      size: {
        default: "h-12 px-6",
        sm: "h-10 rounded-candy-sm px-4 text-sm",
        lg: "h-14 rounded-candy-sm px-10 text-lg",
        icon: "h-12 w-12 rounded-candy-sm",
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

