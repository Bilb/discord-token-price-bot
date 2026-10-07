// Below Discord's 3 s window for answering an interaction, so a slow upstream still gets a reply.
const FETCH_TIMEOUT_MS = 2_500;

/**
 * Fetch and parse a JSON endpoint.
 * @param timeoutMs - defaults to a budget that fits an interaction reply.
 * @returns the parsed body, or null on a network error, timeout, non-2xx status or invalid JSON.
 */
export async function fetchJson(
  url: string,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<unknown | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      console.warn(`${url} returned HTTP ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`${url} failed: ${error}`);
    return null;
  }
}
