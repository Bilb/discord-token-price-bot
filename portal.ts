import { SESSION_STAKING_PORTAL_URL } from './env.ts';
import { fetchJson } from './http.ts';

export enum CONTRIBUTION_CONTRACT_STATUS {
  WaitForOperatorContrib = 0,
  OpenForPublicContrib = 1,
  WaitForFinalized = 2,
  Finalized = 3,
}

type Contributor = {
  address: string;
  amount: number;
  beneficiary_address: string;
  reserved: number;
};

export type ContributionContract = {
  address: string;
  contributors: Array<Contributor>;
  fee: number;
  manual_finalize: boolean;
  operator_address: string;
  pubkey_bls: string;
  service_node_pubkey: string;
  events: Array<unknown>;
  status: CONTRIBUTION_CONTRACT_STATUS;
};

export type OpenNodesData = {
  ids: Array<string>;
  nodes: Array<ContributionContract>;
};

// `address` goes into links the bot posts, so anything but a contract address is dropped.
const CONTRACT_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const REFRESH_INTERVAL_MS = 60_000;
// The endpoint returns every contract ever made, too slow to fetch within an interaction's 3 s,
// so it is polled in the background. Must stay below REFRESH_INTERVAL_MS so refreshes never overlap.
const REFRESH_TIMEOUT_MS = 30_000;

let snapshot: OpenNodesData | null = null;
const refreshListeners: Array<(openNodes: OpenNodesData) => void> = [];

async function fetchOpenNodes(): Promise<OpenNodesData | null> {
  const url = `${SESSION_STAKING_PORTAL_URL}/api/ssb/contract/contribution`;

  const jsonResult = (await fetchJson(url, REFRESH_TIMEOUT_MS)) as { contracts?: unknown } | null;
  if (!jsonResult) {
    return null;
  }

  const openNodes: Array<ContributionContract> = [];
  if (Array.isArray(jsonResult.contracts)) {
    const contractsArray = jsonResult.contracts as Array<ContributionContract>;

    for (const item of contractsArray) {
      if (item.status !== CONTRIBUTION_CONTRACT_STATUS.OpenForPublicContrib) {
        continue;
      }
      if (!CONTRACT_ADDRESS_RE.test(item.address)) {
        console.warn(
          `Skipping open contract with unexpected address: ${JSON.stringify(item.address)}`,
        );
        continue;
      }
      openNodes.push(item);
    }
  }
  const ids = openNodes.map((node) => node.service_node_pubkey);

  return {
    ids,
    nodes: openNodes,
  };
}

// On failure the previous snapshot is kept.
async function refreshOpenNodes() {
  const openNodes = await fetchOpenNodes();
  if (!openNodes) {
    return;
  }

  snapshot = openNodes;
  for (const listener of refreshListeners) {
    try {
      listener(openNodes);
    } catch (error) {
      console.error('Open-node refresh listener failed:', error);
    }
  }
}

/**
 * Refresh the open contracts now, then every minute. Never throws.
 */
export function startOpenNodesPolling() {
  const tick = () => {
    refreshOpenNodes().catch((error) => console.error('Open-node refresh failed:', error));
  };
  tick();
  setInterval(tick, REFRESH_INTERVAL_MS);
}

/**
 * @returns the latest successfully fetched open contracts, or null before the first success.
 */
export function getOpenNodes(): OpenNodesData | null {
  return snapshot;
}

/**
 * Call `listener` after every successful refresh.
 */
export function onOpenNodesRefresh(listener: (openNodes: OpenNodesData) => void) {
  refreshListeners.push(listener);
}
