"use client";

import Image from "next/image";

interface LogoProps {
  size?: number;
  className?: string;
  withGlow?: boolean;
}

export function PrismLogo({ size = 28, className = "", withGlow = false }: LogoProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {withGlow && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, transparent 70%)",
            filter: "blur(6px)",
            transform: "scale(1.3)",
          }}
        />
      )}
      <Image
        src="/Horizon.png"
        alt="Horizon"
        width={size}
        height={size}
        className="relative z-10"
        style={{ objectFit: "contain" }}
        priority
      />
    </div>
  );
}
