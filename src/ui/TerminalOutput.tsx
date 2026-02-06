import { useRef, useEffect } from 'react';

interface TerminalOutputProps {
  lines: string[];
}

export function TerminalOutput({ lines }: TerminalOutputProps) {
  const containerRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines.length]);

  return (
    <pre ref={containerRef} className="terminal-output">
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {'\n'}
        </span>
      ))}
      <span className="cursor-blink">_</span>
    </pre>
  );
}
