import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { arcTestnet } from "./chain";

// Lazily constructed so SSR never touches window/localStorage.
let _config: ReturnType<typeof getDefaultConfig> | null = null;

export function getWagmiConfig() {
  if (_config) return _config;
  _config = getDefaultConfig({
    appName: "Ordo",
    projectId: "ordo-arc-batch", // WalletConnect projectId placeholder; injected connectors still work
    chains: [arcTestnet],
    transports: {
      [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
    },
    ssr: true,
  });
  return _config;
}
