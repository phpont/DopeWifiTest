import { PING_ENDPOINT, DL_ENDPOINT } from '../config';

export type TestPhase = 'idle' | 'ping' | 'download' | 'complete';

export interface SpeedTestCallbacks {
  onPhaseChange: (phase: TestPhase) => void;
  onLog: (line: string) => void;
  onPingProgress: (current: number, total: number, latencyMs: number) => void;
  onDownloadProgress: (mbps: number, progress: number) => void;
  onResult: (result: SpeedTestResult) => void;
}

export interface PhaseResult {
  median: number;
  mean: number;
  peak: number;
  all: number[];
}

export interface SpeedTestResult {
  ping: PhaseResult;
  download: PhaseResult;
}

// --- Config ---
const PING_COUNT = 10;

const DL_MIN_BYTES = 5 * 1024 * 1024;    // 5 MB
const DL_MAX_BYTES = 48 * 1024 * 1024;   // 48 MB (Worker limit: 50 MB, keep margin)

const WARMUP_ROUNDS = 1;
const TEST_ROUNDS = 3;
const TARGET_DURATION_MS = 4000;
const PROGRESS_INTERVAL_MS = 250;

// --- Utilities ---
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function peak(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.max(...arr);
}

function cachebust(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function overallProgress(
  round: number,
  totalRounds: number,
  bytesTransferred: number,
  totalBytes: number,
): number {
  const roundProgress = totalBytes > 0 ? bytesTransferred / totalBytes : 0;
  return Math.min(1, (round + roundProgress) / totalRounds);
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}

// --- Preflight check ---
async function checkWorker(cb: SpeedTestCallbacks, signal?: AbortSignal): Promise<void> {
  cb.onLog('> Checking server...');
  try {
    const res = await fetch(`${PING_ENDPOINT}?cachebust=${cachebust()}`, {
      signal,
      cache: 'no-store',
    });
    if (!res.ok && res.status !== 204) {
      throw new Error(`Server returned ${res.status}`);
    }
    cb.onLog('  server OK');
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new Error(`Cannot reach speed test server: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// --- Ping ---
async function measurePing(
  cb: SpeedTestCallbacks,
  signal?: AbortSignal,
): Promise<number[]> {
  const latencies: number[] = [];
  cb.onLog('> Measuring latency...');

  for (let i = 0; i < PING_COUNT; i++) {
    checkAbort(signal);
    const url = `${PING_ENDPOINT}?cachebust=${cachebust()}`;
    const start = performance.now();
    await fetch(url, { signal, cache: 'no-store' });
    const end = performance.now();
    const latency = end - start;
    latencies.push(latency);
    cb.onPingProgress(i + 1, PING_COUNT, latency);
    cb.onLog(`  ping ${i + 1}/${PING_COUNT}: ${latency.toFixed(1)} ms`);
  }

  cb.onLog(`  median: ${median(latencies).toFixed(1)} ms`);
  return latencies;
}

// --- Download ---
async function measureDownload(
  cb: SpeedTestCallbacks,
  signal?: AbortSignal,
): Promise<number[]> {
  let chunkBytes = DL_MIN_BYTES;
  const speeds: number[] = [];
  const totalRounds = WARMUP_ROUNDS + TEST_ROUNDS;

  cb.onLog('> Measuring download speed...');

  for (let round = 0; round < totalRounds; round++) {
    checkAbort(signal);
    const isWarmup = round < WARMUP_ROUNDS;
    const label = isWarmup
      ? 'warmup'
      : `round ${round - WARMUP_ROUNDS + 1}/${TEST_ROUNDS}`;
    cb.onLog(`  ${label}: ${(chunkBytes / 1e6).toFixed(1)} MB`);

    const url = `${DL_ENDPOINT}?bytes=${chunkBytes}&cachebust=${cachebust()}`;
    const startTime = performance.now();
    let totalReceived = 0;
    let lastProgressTime = startTime;

    const response = await fetch(url, { signal, cache: 'no-store' });

    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        checkAbort(signal);
        const { done, value } = await reader.read();
        if (done) break;
        totalReceived += value.byteLength;

        const now = performance.now();
        if (now - lastProgressTime >= PROGRESS_INTERVAL_MS) {
          const elapsedSec = (now - startTime) / 1000;
          const mbps = (totalReceived * 8) / (elapsedSec * 1e6);
          const progress = overallProgress(round, totalRounds, totalReceived, chunkBytes);
          cb.onDownloadProgress(mbps, progress);
          lastProgressTime = now;
        }
      }
    } else {
      const buf = await response.arrayBuffer();
      totalReceived = buf.byteLength;
    }

    const elapsed = performance.now() - startTime;
    const mbps = (totalReceived * 8) / ((elapsed / 1000) * 1e6);

    if (!isWarmup) {
      speeds.push(mbps);
    }

    const progress = overallProgress(round + 1, totalRounds, 0, 1);
    cb.onDownloadProgress(mbps, progress);

    if (elapsed > 0) {
      const newBytes = Math.round((TARGET_DURATION_MS / elapsed) * chunkBytes);
      chunkBytes = Math.max(DL_MIN_BYTES, Math.min(DL_MAX_BYTES, newBytes));
    }

    cb.onLog(`    -> ${mbps.toFixed(2)} Mbps (${(elapsed / 1000).toFixed(1)}s)`);
  }

  cb.onLog(`  median: ${median(speeds).toFixed(2)} Mbps`);
  return speeds;
}

// --- Aggregation ---
function buildPhaseResult(values: number[]): PhaseResult {
  return {
    median: median(values),
    mean: mean(values),
    peak: peak(values),
    all: values,
  };
}

// --- Main ---
export async function runSpeedTest(
  callbacks: SpeedTestCallbacks,
  signal?: AbortSignal,
): Promise<SpeedTestResult> {
  callbacks.onLog('');
  callbacks.onLog('=== DopeWifiTest ===');
  callbacks.onLog('');

  // Preflight: verify worker is reachable
  await checkWorker(callbacks, signal);
  callbacks.onLog('');

  // Ping
  callbacks.onPhaseChange('ping');
  const pingResults = await measurePing(callbacks, signal);
  callbacks.onLog('');

  // Download
  callbacks.onPhaseChange('download');
  const downloadResults = await measureDownload(callbacks, signal);
  callbacks.onLog('');

  // Complete
  const result: SpeedTestResult = {
    ping: buildPhaseResult(pingResults),
    download: buildPhaseResult(downloadResults),
  };

  callbacks.onLog('=== Test Complete ===');
  callbacks.onPhaseChange('complete');
  callbacks.onResult(result);

  return result;
}
