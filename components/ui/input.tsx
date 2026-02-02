import * as React from "react"
import { cn } from "@/lib/utils"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-14 w-full rounded-candy-sm border-2 border-gray-600 dark:border-gray-700 bg-gray-700 dark:bg-gray-800 px-5 text-base text-white placeholder:text-gray-400 dark:placeholder:text-gray-400 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-candy-blue focus-visible:border-candy-blue focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 hover:border-gray-500 dark:hover:border-gray-600 shadow-soft-xl backdrop-blur-sm disabled:cursor-not-allowed disabled:opacity-50",
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

