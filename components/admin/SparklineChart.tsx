type Series = { color: string; values: number[] };

export function SparklineChart({
  height = 140,
  series,
  labels
}: {
  height?: number;
  series: Series[];
  labels?: string[];
}) {
  const allValues = series.flatMap((s) => s.values);
  const max = Math.max(1, ...allValues);
  const len = Math.max(1, ...series.map((s) => s.values.length));
  const width = 600;
  const padding = { top: 12, right: 8, bottom: 22, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  function pointX(i: number) {
    if (len === 1) return padding.left + innerW / 2;
    return padding.left + (i / (len - 1)) * innerW;
  }

  function pointY(value: number) {
    return padding.top + innerH - (value / max) * innerH;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <line x1={padding.left} x2={width - padding.right} y1={padding.top + innerH} y2={padding.top + innerH} stroke="#e2e8f0" strokeWidth={1} />
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={padding.left} x2={width - padding.right} y1={padding.top + innerH * t} y2={padding.top + innerH * t} stroke="#f1f5f9" strokeDasharray="2 4" />
      ))}
      {series.map((s, idx) => {
        const points = s.values.map((value, i) => `${pointX(i)},${pointY(value)}`).join(" ");
        return (
          <g key={idx}>
            <polyline fill="none" stroke={s.color} strokeWidth={2} points={points} />
            {s.values.map((value, i) => (
              <circle key={i} cx={pointX(i)} cy={pointY(value)} r={2.5} fill={s.color} />
            ))}
          </g>
        );
      })}
      {labels && labels.length > 0 ? (
        <g>
          {labels.map((label, i) => {
            if (i % Math.max(1, Math.floor(labels.length / 7)) !== 0 && i !== labels.length - 1) return null;
            return (
              <text key={i} x={pointX(i)} y={height - 4} textAnchor="middle" fontSize={10} fill="#94a3b8">
                {label}
              </text>
            );
          })}
        </g>
      ) : null}
    </svg>
  );
}
