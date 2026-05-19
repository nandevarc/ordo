import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { getWagmiConfig } from "@/lib/wagmi";

/**
 * Wagmi v2 supports SSR via `ssr: true` in getDefaultConfig.
 * Mounted always so hooks like useAccount are safe on first render.
 */
export function Web3Providers({ children }: { children: React.ReactNode }) {
  const config = getWagmiConfig();
  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider
        modalSize="compact"
        theme={lightTheme({
          accentColor: "oklch(0.22 0.025 255)",
          accentColorForeground: "white",
          borderRadius: "small",
          fontStack: "system",
          overlayBlur: "small",
        })}
      >
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
