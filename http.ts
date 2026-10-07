// Below Discord's 3 s window for answering an interaction, so a slow upstream still gets a reply.
const FETCH_TIMEOUT_MS = 2_500;

/**
 * Fetch and parse a JSON endpoint.
 * @returns the parsed body, or null on a network error, timeout, non-2xx status or invalid JSON.
 */
export async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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
