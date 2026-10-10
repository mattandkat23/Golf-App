import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function PageHead({ title, back, action }: { title: ReactNode; back?: string; action?: ReactNode }) {
  return (
    <>
      {back && (
        <Link className="back" to={back}>
          ‹ Back
        </Link>
      )}
      <div className="page-head">
        <h1>{title}</h1>
        {action}
      </div>
    </>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Single-select chip group. Tapping the selected chip clears it when `allowClear` is set. */
export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  allowClear,
  scroll,
  grid,
  label = (o) => String(o),
}: {
  options: readonly T[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  allowClear?: boolean;
  scroll?: boolean;
  grid?: 2 | 3 | 4 | 5 | 6;
  label?: (o: T) => ReactNode;
}) {
  return (
    <div className={grid ? `grid-btns c${grid}` : `chips${scroll ? ' scroll' : ''}`}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o)}
          className={`chip${value === o ? ' on' : ''}`}
          onClick={() => onChange(value === o && allowClear ? undefined : o)}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );
}

export function MultiChips<T extends string>({
  options,
  value,
  onToggle,
  grid,
}: {
  options: readonly T[];
  value: T[];
  onToggle: (v: T) => void;
  grid?: 2 | 3 | 4;
}) {
  return (
    <div className={grid ? `grid-btns c${grid}` : 'chips'}>
      {options.map((o) => (
        <button type="button" key={o} className={`chip${value.includes(o) ? ' on' : ''}`} onClick={() => onToggle(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Kpi({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="kpi">
      <div className="v">{value ?? '—'}</div>
      <div className="l">{label}</div>
    </div>
  );
}

/** Horizontal bars, one series. Values are labeled directly so color never carries meaning alone. */
export function Bars({ rows, format = (v) => String(v), max }: { rows: { label: string; value: number; note?: string }[]; format?: (v: number) => string; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars" role="table">
      {rows.map((r) => (
        <div className="bar-row" role="row" key={r.label} title={`${r.label}: ${format(r.value)}${r.note ? ` (${r.note})` : ''}`}>
          <span role="cell">{r.label}</span>
          <div className="bar-track" role="presentation">
            <div className="bar-fill" style={{ width: `${(100 * r.value) / m}%` }} />
          </div>
          <span className="val" role="cell">
            {format(r.value)}
            {r.note && <span className="muted small"> {r.note}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function DateBox({ date }: { date: string }) {
  const [, m, d] = date.split('-');
  return (
    <div className="date-box">
      <small>{MONTHS[Number(m) - 1]}</small>
      <b>{Number(d)}</b>
    </div>
  );
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function fmtDate(date?: string) {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
