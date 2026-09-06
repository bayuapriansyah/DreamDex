import { Suspense } from "react";
import { TradeClient } from "@/components/trade/TradeClient";

export default function TradePage() {
  return (
    <Suspense
      fallback={
        <div
          className="mx-auto px-4 text-center"
          style={{ maxWidth: 580, paddingTop: 80 }}
        >
          <div className="skeleton" style={{ height: 24, width: 200, margin: "0 auto" }} />
        </div>
      }
    >
      <TradeClient />
    </Suspense>
  );
}
