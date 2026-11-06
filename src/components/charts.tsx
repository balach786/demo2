/**
 * Lightweight, dependency-free SVG charts.
 * Written in-house so the demo renders identically offline / inside the
 * sandboxed preview (no CDN, no chart library).
 */
import { useId, useMemo, useState } from 'react';
import { formatCompactPKR } from '../lib/format';

interface Series {
  name: string;
  color: string;
  values: number[];
  type?: 'line' | 'area' | 'bar';
}

function niceMax(value: number): number {
  if (value <= 0) return 10;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const n = value / base;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * base;
}

function ticks(min: number, max: number, count = 4): number[] {
  const out: number[] = [];
  for (let i = 0; i <= count; i++) out.push(min + ((max - min) * i) / count);
  return out;
}

const W = 760;

/* ------------------------------------------------------------------ */
/* Line / area chart                                                   */
/* ------------------------------------------------------------------ */
export function LineAreaChart({
  labels,
  series,
  height = 250,
  showArea = true,
  yFormat = formatCompactPKR,
  valueFormat = formatCompactPKR,
  allowNegative = false,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  showArea?: boolean;
  yFormat?: (n: number) => string;
  valueFormat?: (n: number) => string;
  allowNegative?: boolean;
}) {
  const uid = useId().replace(/[:]/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 14, right: 14, bottom: 26, left: 56 };
  const innerW = W - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const all = series.flatMap((s) => s.values);
  const rawMax = Math.max(...all, 0);
  const rawMin = allowNegative ? Math.min(...all, 0) : 0;
  const max = niceMax(rawMax || 1);
  const min = rawMin < 0 ? -niceMax(Math.abs(rawMin)) : 0;
  const scaleY = (v: number) => pad.top + innerH - ((v - min) / (max - min || 1)) * innerH;
  const n = labels.length;
  const scaleX = (i: number) => pad.left + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const yTicks = ticks(min, max, 4);
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  const paths = series.map((s) => {
    const pts = s.values.map((v, i) => [scaleX(i), scaleY(v)] as const);
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${scaleX(n - 1).toFixed(1)},${scaleY(Math.max(min, 0)).toFixed(1)} L${scaleX(0).toFixed(1)},${scaleY(Math.max(min, 0)).toFixed(1)} Z`;
    return { ...s, line, area, pts };
  });

  return (
    <div className="chart-wrap">
      <svg
        className="chart-svg"
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={`Chart: ${series.map((s) => s.name).join(', ')}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`grad-${uid}-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.26" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.015" />
            </linearGradient>
          ))}
        </defs>

        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={pad.left} x2={W - pad.right} y1={scaleY(t)} y2={scaleY(t)}
              stroke="#e9edf5" strokeWidth="1" strokeDasharray={t === 0 ? '0' : '3 4'}
            />
            <text x={pad.left - 9} y={scaleY(t) + 3.5} textAnchor="end" fontSize="10" fill="#8d99ae">
              {yFormat(t)}
            </text>
          </g>
        ))}

        {paths.map((p, si) =>
          showArea ? (
            <path key={`a-${si}`} d={p.area} fill={`url(#grad-${uid}-${si})`} />
          ) : null,
        )}
        {paths.map((p, si) => (
          <path
            key={`l-${si}`} d={p.line} fill="none" stroke={p.color}
            strokeWidth={p.type === 'bar' ? 0 : 2.4} strokeLinejoin="round" strokeLinecap="round"
          />
        ))}

        {labels.map((label, i) => (
          <g key={`x-${i}`}>
            {i % labelEvery === 0 || i === n - 1 ? (
              <text x={scaleX(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="#8d99ae">
                {label}
              </text>
            ) : null}
          </g>
        ))}

        {hover !== null && (
          <g>
            <line
              x1={scaleX(hover)} x2={scaleX(hover)} y1={pad.top} y2={pad.top + innerH}
              stroke="#9aa8bf" strokeWidth="1" strokeDasharray="3 3"
            />
            {paths.map((p, si) => (
              <circle
                key={si} cx={scaleX(hover)} cy={scaleY(p.values[hover] ?? 0)} r="4"
                fill="#fff" stroke={p.color} strokeWidth="2.4"
              />
            ))}
          </g>
        )}

        <rect
          x={pad.left} y={pad.top} width={innerW} height={innerH} fill="transparent"
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
            const rel = (e.clientX - rect.left) / rect.width;
            const idx = Math.round(rel * (n - 1));
            setHover(Math.max(0, Math.min(n - 1, idx)));
          }}
        />
      </svg>

      {hover !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(scaleX(hover) / W) * 100}%`,
            top: `${(scaleY(Math.max(...series.map((s) => s.values[hover] ?? 0))) / height) * 100}%`,
          }}
        >
          <div className="tt-title">{labels[hover]}</div>
          {series.map((s) => (
            <div className="tt-row" key={s.name}>
              <span>{s.name}</span>
              <b>{valueFormat(s.values[hover] ?? 0)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Grouped bars (supports negative values)                             */
/* ------------------------------------------------------------------ */
export function GroupedBarChart({
  labels,
  series,
  height = 250,
  yFormat = formatCompactPKR,
  valueFormat = formatCompactPKR,
  allowNegative = false,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  yFormat?: (n: number) => string;
  valueFormat?: (n: number) => string;
  allowNegative?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 14, right: 14, bottom: 26, left: 56 };
  const innerW = W - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const all = series.flatMap((s) => s.values);
  const rawMax = Math.max(...all, 0);
  const rawMin = allowNegative ? Math.min(...all, 0) : 0;
  const max = niceMax(rawMax || 1);
  const min = rawMin < 0 ? -niceMax(Math.abs(rawMin)) : 0;
  const zeroY = pad.top + innerH - ((0 - min) / (max - min || 1)) * innerH;
  const scaleY = (v: number) => pad.top + innerH - ((v - min) / (max - min || 1)) * innerH;
  const n = labels.length;
  const groupW = innerW / Math.max(1, n);
  const barW = Math.max(3, Math.min(18, (groupW * 0.62) / series.length));
  const yTicks = ticks(min, max, 4);
  const labelEvery = Math.max(1, Math.ceil(n / 9));

  return (
    <div className="chart-wrap">
      <svg className="chart-svg" viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Bar chart" onMouseLeave={() => setHover(null)}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.left} x2={W - pad.right} y1={scaleY(t)} y2={scaleY(t)} stroke="#e9edf5" strokeWidth="1" strokeDasharray={t === 0 ? '0' : '3 4'} />
            <text x={pad.left - 9} y={scaleY(t) + 3.5} textAnchor="end" fontSize="10" fill="#8d99ae">{yFormat(t)}</text>
          </g>
        ))}
        {labels.map((label, gi) => {
          const groupCenter = pad.left + groupW * (gi + 0.5);
          const totalW = barW * series.length + 3 * (series.length - 1);
          return (
            <g key={gi}>
              <rect
                x={pad.left + groupW * gi} y={pad.top} width={groupW} height={innerH}
                fill={hover === gi ? 'rgba(37,99,235,0.055)' : 'transparent'}
                onMouseEnter={() => setHover(gi)}
              />
              {series.map((s, si) => {
                const v = s.values[gi] ?? 0;
                const y = Math.min(scaleY(v), zeroY);
                const h = Math.max(1.5, Math.abs(scaleY(v) - zeroY));
                const x = groupCenter - totalW / 2 + si * (barW + 3);
                return <rect key={si} x={x} y={y} width={barW} height={h} rx={Math.min(3, barW / 2)} fill={s.color} opacity={hover === null || hover === gi ? 1 : 0.45} />;
              })}
              {gi % labelEvery === 0 || gi === n - 1 ? (
                <text x={groupCenter} y={height - 8} textAnchor="middle" fontSize="10" fill="#8d99ae">{label}</text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="chart-tooltip" style={{ left: `${((pad.left + groupW * (hover + 0.5)) / W) * 100}%`, top: '18%' }}>
          <div className="tt-title">{labels[hover]}</div>
          {series.map((s) => (
            <div className="tt-row" key={s.name}>
              <span>{s.name}</span>
              <b>{valueFormat(s.values[hover] ?? 0)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut                                                               */
/* ------------------------------------------------------------------ */
export function DonutChart({
  data,
  size = 176,
  thickness = 22,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="row" style={{ gap: 18, alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: '0 0 auto' }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#eef1f7" strokeWidth={thickness} />
        {data.map((d, i) => {
          const len = (d.value / total) * circ;
          const el = (
            <circle
              key={i}
              cx={c} cy={c} r={r} fill="none" stroke={d.color}
              strokeWidth={hover === i ? thickness + 5 : thickness}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${c} ${c})`}
              strokeLinecap="butt"
              style={{ transition: 'stroke-width 0.15s ease', cursor: 'default' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
          offset += len;
          return el;
        })}
        <text x={c} y={c - 4} textAnchor="middle" fontSize="11" fill="#8d99ae">{centerLabel}</text>
        <text x={c} y={c + 15} textAnchor="middle" fontSize="15" fontWeight="700" fill="#0d1b2d">{centerValue}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, minWidth: 0 }}>
        {data.map((d, i) => (
          <div key={i} className="row" style={{ gap: 8, fontSize: 12.2 }}>
            <span className="legend-swatch" style={{ background: d.color, flex: '0 0 auto' }} />
            <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            <span className="spacer" />
            <span className="tnum bold" style={{ fontSize: 12 }}>{((d.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */
export function Sparkline({
  values,
  color = '#2563eb',
  width = 92,
  height = 30,
  fill = true,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  const id = useId().replace(/[:]/g, '');
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = useMemo(
    () =>
      values.map((v, i) => {
        const x = (i / Math.max(1, values.length - 1)) * width;
        const y = height - ((v - min) / (max - min || 1)) * (height - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }),
    [values, width, height, max, min],
  );
  const line = `M${pts.join(' L')}`;
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#sp-${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal bar list                                                 */
/* ------------------------------------------------------------------ */
export function BarList({
  items,
  formatValue,
}: {
  items: { label: string; value: number; color?: string; sub?: string }[];
  formatValue: (n: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div>
      {items.map((it) => (
        <div className="bar-row" key={it.label}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.label}>
            {it.label}
            {it.sub ? <div className="xsmall muted">{it.sub}</div> : null}
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: it.color ?? 'linear-gradient(90deg, #2563eb, #2dd4bf)' }} />
          </div>
          <div className="right tnum" style={{ fontWeight: 650, color: 'var(--text)' }}>{formatValue(it.value)}</div>
        </div>
      ))}
    </div>
  );
}
