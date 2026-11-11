import { levelCounts, type TenureBucket } from '../domain/stats';
import type { BoardRow, RiskLevel } from '../domain/types';
import { LEVEL_LABEL } from './labels';

interface SummaryProps {
  rows: BoardRow[];
  leavers: TenureBucket[];
  activeLevel: RiskLevel | null;
  onLevel: (level: RiskLevel | null) => void;
}

const LEVELS: RiskLevel[] = ['high', 'medium', 'low'];

export function Summary({ rows, leavers, activeLevel, onLevel }: SummaryProps) {
  const counts = levelCounts(rows);
  const max = Math.max(1, ...leavers.map((b) => b.count));
  return (
    <section className="summary" aria-label="Сводка">
      <div className="tiles">
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            className={`tile tile-${level}`}
            aria-pressed={activeLevel === level}
            onClick={() => onLevel(activeLevel === level ? null : level)}
          >
            <span className="tile-label">{LEVEL_LABEL[level]}</span>
            <strong className="tile-count">{counts[level]}</strong>
            <span className="tile-hint">риск ухода</span>
          </button>
        ))}
      </div>
      <figure className="chart">
        <figcaption>Когда уходят: ушедшие по сроку работы, дней (демо-данные)</figcaption>
        <ul>
          {leavers.map((b) => (
            <li key={b.label}>
              <span className="bar-label">{b.label}</span>
              <span className="bar-track">
                <span className="bar" style={{ width: `${(b.count / max) * 100}%` }} />
              </span>
              <span className="bar-count">{b.count}</span>
            </li>
          ))}
        </ul>
      </figure>
    </section>
  );
}
