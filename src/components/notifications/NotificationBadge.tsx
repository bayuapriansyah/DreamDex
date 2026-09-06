"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { getUnreadCount } from "@/lib/dreamdex/notifications";

export function NotificationBadge() {
  const { address } = useAccount();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!address) {
      setCount(0);
      return;
    }

    function check() {
      setCount(getUnreadCount(address!));
    }

    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [address]);

  if (!address || count === 0) return null;

  return (
    <span
      style={{
        position: "absolute",
        top: -4,
        right: -4,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        background: "var(--accent-warn)",
        color: "#fff",
        fontSize: 9,
        fontFamily: "var(--font-data)",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 4px",
        lineHeight: 1,
        pointerEvents: "none",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
