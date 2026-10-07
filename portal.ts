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

type OpenNodesData = {
  ids: Array<string>;
  nodes: Array<ContributionContract>;
};

// `address` goes into links the bot posts, so anything but a contract address is dropped.
const CONTRACT_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * @returns the contracts open for public contribution, or null when the portal can't be reached.
 */
export async function getOpenNodes(): Promise<OpenNodesData | null> {
  const url = `${SESSION_STAKING_PORTAL_URL}/api/ssb/contract/contribution`;

  const jsonResult = (await fetchJson(url)) as { contracts?: unknown } | null;
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
