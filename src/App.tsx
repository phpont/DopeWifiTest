import { useState, useCallback, useRef, useEffect } from 'react';
import { AsciiLogo } from './ui/AsciiLogo';
import { AsciiFrame } from './ui/AsciiFrame';
import { Meter } from './ui/Meter';
import { TerminalOutput } from './ui/TerminalOutput';
import {
  runSpeedTest,
  type TestPhase,
  type SpeedTestResult,
  type SpeedTestCallbacks,
} from './engine/speedtest';

const SPINNER = ['|', '/', '-', '\\'];

function useSpinner(active: boolean) {
  const [frame, setFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(() => {
        setFrame((f) => (f + 1) % SPINNER.length);
      }, 150);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active]);

  return active ? SPINNER[frame] : '';
}

function buildResultLines(r: SpeedTestResult): string[] {
  const dlBar = makeBar(r.download.median, r.download.median, 30);

  return [
    `DL   ${dlBar}  ${r.download.median.toFixed(2).padStart(8)} Mbps`,
    `PING ${' '.repeat(30)}  ${r.ping.median.toFixed(1).padStart(8)} ms`,
    '',
    `DL   mean: ${r.download.mean.toFixed(2)} Mbps  peak: ${r.download.peak.toFixed(2)} Mbps`,
    `PING mean: ${r.ping.mean.toFixed(1)} ms`,
  ];
}

function makeBar(value: number, max: number, width: number = 20): string {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

function phaseText(phase: TestPhase, spinner: string): string {
  switch (phase) {
    case 'ping':
      return `${spinner} MEASURING LATENCY`;
    case 'download':
      return `${spinner} DOWNLOAD TEST`;
    case 'complete':
      return 'TEST COMPLETE';
    default:
      return '';
  }
}

export default function App() {
  const [phase, setPhase] = useState<TestPhase>('idle');
  const [lines, setLines] = useState<string[]>([
    'DopeWifiTest v1.0',
    'Client-side speed test using Cloudflare edge',
    '',
    'Press [RUN TEST] to begin.',
  ]);
  const [dlProgress, setDlProgress] = useState(0);
  const [currentMbps, setCurrentMbps] = useState(0);
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const isRunning = phase !== 'idle' && phase !== 'complete';
  const spinner = useSpinner(isRunning);

  const addLine = useCallback((line: string) => {
    setLines((prev) => [...prev, line]);
  }, []);

  const handleRun = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setResult(null);
    setPhase('idle');
    setDlProgress(0);
    setCurrentMbps(0);
    setLines([
      'DopeWifiTest v1.0',
      '',
      '> Initializing speed test...',
    ]);

    const callbacks: SpeedTestCallbacks = {
      onPhaseChange: setPhase,
      onLog: addLine,
      onPingProgress: () => {},
      onDownloadProgress: (mbps, progress) => {
        setCurrentMbps(mbps);
        setDlProgress(progress);
      },
      onResult: setResult,
    };

    try {
      await runSpeedTest(callbacks, controller.signal);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        addLine('> Test cancelled.');
      } else if (err instanceof Error) {
        addLine(`ERROR: ${err.message}`);
      }
      setPhase('idle');
    }
  }, [addLine]);

  const handleCopy = useCallback(() => {
    const domain = window.location.host;
    const isWindows = navigator.userAgent.includes('Win');
    const cmd = isWindows
      ? `powershell -c "irm https://${domain}/run.ps1 | iex"`
      : `curl -fsSL https://${domain}/run | sh`;
    navigator.clipboard.writeText(cmd).then(() => {
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2000);
    });
  }, []);

  return (
    <div className="app">
      <AsciiLogo />

      <div className="button-row">
        <button className="btn" onClick={handleRun} disabled={isRunning}>
          {isRunning ? '[ TESTING... ]' : '[ RUN TEST ]'}
        </button>
        <button className="btn" onClick={handleCopy}>
          [ COPY CLI CMD ]
        </button>
      </div>

      {phase !== 'idle' && phase !== 'complete' && (
        <div className="phase-label">{phaseText(phase, spinner)}</div>
      )}

      {phase === 'download' && (
        <Meter
          progress={dlProgress}
          speed={currentMbps}
          phaseLabel="download"
          label={`${(dlProgress * 100).toFixed(0)}%`}
        />
      )}

      <TerminalOutput lines={lines} />

      {result && (
        <div className="result-section">
          <AsciiFrame title="DopeWifiTest" lines={buildResultLines(result)} minWidth={52} />
        </div>
      )}

      <div className={`toast ${toastVisible ? 'visible' : ''}`}>
        Copied to clipboard!
      </div>
    </div>
  );
}
