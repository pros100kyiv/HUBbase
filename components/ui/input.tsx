import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-14 w-full rounded-candy border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-5 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-300 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-purple-400 focus-visible:border-primary dark:focus-visible:border-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:border-gray-300 dark:hover:border-gray-500 shadow-soft disabled:cursor-not-allowed disabled:opacity-50",
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

