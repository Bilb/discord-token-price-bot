import { SESSION_NETWORK_API_URL } from './env.ts';
import { fetchJson } from './http.ts';

type PriceData = { t_price: number; t_stale: number; usd: number; usd_market_cap: number };
type NetworkData = {
  network_size: number;
  network_staked_tokens: number;
  network_staked_usd: number;
};
type TokenData = {
  circulating_supply: number;
  contract_address: string;
  staking_requirement: number;
  staking_reward_pool: number;
};

type NetworkApiInfoResponse = {
  network: NetworkData;
  price: PriceData;
  token: TokenData;
  t: number;
};

export async function getNetworkApiData() {
  if (!SESSION_NETWORK_API_URL) {
    console.warn('SESSION_NETWORK_API_URL is not set, network api commands will not work');
    return;
  }

  const json = await fetchJson(SESSION_NETWORK_API_URL);
  if (!json) {
    return;
  }

  return json as NetworkApiInfoResponse;
}

export async function getPriceData() {
  const networkApiInfoData = await getNetworkApiData();

  if (!networkApiInfoData) {
    console.warn('networkApiInfoDat not available!');
    return;
  }

  const priceData = {
    ...networkApiInfoData.price,
    circulating_supply: networkApiInfoData.token.circulating_supply,
  };

  return priceData;
}
