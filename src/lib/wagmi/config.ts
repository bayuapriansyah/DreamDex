import { createConfig, http } from "wagmi";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [somniaShannon],
  connectors: [injected()],
  transports: {
    [somniaShannon.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
