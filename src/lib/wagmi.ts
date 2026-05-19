import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { arcTestnet } from "./chain";

// Lazily constructed so SSR never touches window/localStorage.
let _config: ReturnType<typeof getDefaultConfig> | null = null;

export function getWagmiConfig() {
  if (_config) return _config;
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
  if (!projectId || projectId.length !== 32) {
    // eslint-disable-next-line no-console
    console.warn(
      "[Ordo] VITE_WALLETCONNECT_PROJECT_ID is missing or invalid (must be 32 chars from cloud.reown.com). " +
        "WalletConnect features will be disabled; injected wallets (MetaMask, etc.) will still work.",
    );
  }
  _config = getDefaultConfig({
    appName: "Ordo",
    projectId: projectId ?? "00000000000000000000000000000000",
    chains: [arcTestnet],
    transports: {
      [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
    },
    ssr: true,
  });
  return _config;
}
