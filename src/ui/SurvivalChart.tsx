import { survivalKnownAt, type SurvivalPoint } from '../domain/attrition';

const W = 600;
const H = 240;
const PAD = { left: 44, right: 12, top: 12, bottom: 28 };

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function SurvivalChart({ curve }: { curve: SurvivalPoint[] }) {
  const horizon = Math.max(1, curve[curve.length - 1]?.day ?? 180);
  const x = (day: number) => PAD.left + (day / horizon) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v) * (H - PAD.top - PAD.bottom);

  // step line over the observed period only: beyond it nobody is left to estimate from
  const observed = curve.filter((p) => p.atRisk > 0);
  let d = '';
  observed.forEach((p, i) => {
    d += i === 0 ? `M${x(p.day)},${y(p.survival)}` : ` H${x(p.day)} V${y(p.survival)}`;
  });

  const at = (day: number) => {
    const v = survivalKnownAt(curve, day);
    return v === undefined ? 'нет данных' : pct(v);
  };
  const label =
    `Доля новичков, которые остаются в компании: на 30-й день ${at(30)}, ` +
    `на 90-й день ${at(90)}, на 180-й день ${at(180)}`;
  const xTicks = [0, 30, 60, 90, 120, 150, 180].filter((t) => t <= horizon);

  return (
    <svg className="survival" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <g aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="tick" x={PAD.left - 6} y={y(v) + 4} textAnchor="end">
              {pct(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} className="tick" x={x(t)} y={H - 8} textAnchor="middle">
            {t}
          </text>
        ))}
        {horizon >= 90 && (
          <line className="mark" x1={x(90)} x2={x(90)} y1={PAD.top} y2={H - PAD.bottom} />
        )}
        <path className="curve" d={d} fill="none" />
      </g>
    </svg>
  );
}
