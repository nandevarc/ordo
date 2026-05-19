import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcTestnet } from "./chain";

// Lazily constructed so SSR never touches window/localStorage.
let _config: ReturnType<typeof getDefaultConfig> | ReturnType<typeof createConfig> | null = null;

export function getWagmiConfig() {
  if (_config) return _config;

  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
  const hasValidProjectId = typeof projectId === "string" && projectId.length === 32;

  if (!hasValidProjectId) {
    // Fall back to injected-only config so SSR doesn't throw.
    // RainbowKit's getDefaultConfig requires a real WalletConnect projectId.
    // eslint-disable-next-line no-console
    console.warn(
      "[Ordo] VITE_WALLETCONNECT_PROJECT_ID is missing or invalid (must be 32 chars from cloud.reown.com). " +
        "Using injected-only connectors (MetaMask, etc.). WalletConnect/Coinbase/Rainbow mobile disabled.",
    );
    _config = createConfig({
      chains: [arcTestnet],
      connectors: [injected()],
      transports: {
        [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
      },
      ssr: true,
    });
    return _config;
  }

  _config = getDefaultConfig({
    appName: "Ordo",
    projectId,
    chains: [arcTestnet],
    transports: {
      [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
    },
    ssr: true,
  });
  return _config;
}
