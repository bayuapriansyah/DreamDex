import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "accent";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "btn",
          variant === "primary" && "btn-primary",
          variant === "secondary" && "btn-secondary",
          variant === "ghost" && "btn-ghost",
          variant === "accent" && "btn-accent",
          size === "sm" && "btn-sm",
          size === "lg" && "h-12 px-6 text-[15px]",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, type ButtonProps };
