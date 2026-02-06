interface MeterProps {
  progress: number;
  width?: number;
  label?: string;
  phaseLabel?: string;
  speed?: number;
}

export function Meter({ progress, width = 40, label, phaseLabel, speed }: MeterProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const filled = Math.round(clamped * width);
  const empty = width - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);

  return (
    <div style={{ textAlign: 'center', margin: '12px 0' }}>
      {phaseLabel && <div className="meter-label">{phaseLabel}</div>}
      {speed !== undefined && (
        <div className="meter-speed">
          {speed.toFixed(2)} <span className="meter-unit">Mbps</span>
        </div>
      )}
      <pre className="meter">[{bar}] {label ?? `${(clamped * 100).toFixed(0)}%`}</pre>
    </div>
  );
}
