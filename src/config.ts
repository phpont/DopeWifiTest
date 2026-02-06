const DEFAULT_BASE = 'https://dopespeedtest.paulohponta.workers.dev';

export const BASE_URL = (import.meta.env.VITE_SPEEDTEST_BASE_URL as string | undefined) ?? DEFAULT_BASE;

export const PING_ENDPOINT = `${BASE_URL}/ping`;
export const DL_ENDPOINT = `${BASE_URL}/down`;
