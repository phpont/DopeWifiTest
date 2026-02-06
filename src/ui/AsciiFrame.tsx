interface AsciiFrameProps {
  title?: string;
  lines: string[];
  minWidth?: number;
}

export function AsciiFrame({ title, lines, minWidth = 40 }: AsciiFrameProps) {
  const contentWidth = Math.max(
    minWidth,
    ...(title ? [title.length + 4] : []),
    ...lines.map(l => l.length + 2)
  );

  const hBorder = '+' + '-'.repeat(contentWidth + 2) + '+';
  const padLine = (s: string) => '| ' + s.padEnd(contentWidth) + ' |';
  const emptyLine = '| ' + ' '.repeat(contentWidth) + ' |';

  const centerTitle = (t: string) => {
    const padded = t.length;
    const leftPad = Math.floor((contentWidth - padded) / 2);
    const rightPad = contentWidth - padded - leftPad;
    return '| ' + ' '.repeat(leftPad) + t + ' '.repeat(rightPad) + ' |';
  };

  const outputLines: string[] = [hBorder];
  if (title) {
    outputLines.push(centerTitle(title));
    outputLines.push(hBorder);
  }
  for (const line of lines) {
    if (line === '') {
      outputLines.push(emptyLine);
    } else {
      outputLines.push(padLine(line));
    }
  }
  outputLines.push(hBorder);

  return <pre className="ascii-frame">{outputLines.join('\n')}</pre>;
}
