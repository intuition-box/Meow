import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import * as chains from "viem/chains";
import scaffoldConfig from "~~/scaffold.config";

const { onlyLocalBurnerWallet, targetNetworks } = scaffoldConfig;

// Only load burner connector in the browser – it relies on IndexedDB and breaks during SSR
const isBrowser = typeof window !== "undefined";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const burnerModule = isBrowser ? require("burner-connector") : null;
const burnerWallet = burnerModule?.rainbowkitBurnerWallet as
  | ((opts?: any) => ReturnType<typeof metaMaskWallet>)
  | undefined;

const wallets = [
  metaMaskWallet,
  walletConnectWallet,
  ledgerWallet,
  coinbaseWallet,
  rainbowWallet,
  safeWallet,
  ...(!targetNetworks.some(network => network.id !== (chains.hardhat as chains.Chain).id) || !onlyLocalBurnerWallet
    ? burnerWallet
      ? [burnerWallet]
      : []
    : []),
];

/**
 * wagmi connectors for the wagmi context
 * Fast-Refresh safe: cache the connectors instance on globalThis to avoid
 * re-initializing WalletConnect Core multiple times during HMR.
 */
const g: any = globalThis as any;
const connectorsSingleton =
  g.__WALLET_CONNECTORS__ ||
  (g.__WALLET_CONNECTORS__ = connectorsForWallets(
    [
      {
        groupName: "Supported Wallets",
        wallets,
      },
    ],
    {
      appName: "scaffold-eth-2",
      projectId: scaffoldConfig.walletConnectProjectId,
    },
  ));

export const wagmiConnectors = connectorsSingleton;
