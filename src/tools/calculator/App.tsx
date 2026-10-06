import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ToolShell } from '../../components/layout/ToolShell';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';
import { useIsMobile } from '../../hooks/useIsMobile';
import { bySlug } from '../../site/manifest';
import { track } from '../../utils/analytics';
import { evaluate, formatResult, type AngleMode } from './evaluate';
import { loadHistory, pushHistory, saveHistory, type HistoryItem } from './history';

const entry = bySlug('calculator');

type Mode = 'basic' | 'scientific';
type KeyTone = 'digit' | 'op' | 'fn' | 'equals' | 'clear';

interface Key {
  label: string;
  /** Text inserted at the caret; defaults to label. */
  insert?: string;
  /** Caret offset relative to end of inserted text (negative = step back). */
  caret?: number;
  tone?: KeyTone;
  action?: 'equals' | 'clear' | 'backspace';
  span?: number;
  aria?: string;
}

const BASIC_KEYS: Key[] = [
  { label: 'AC', action: 'clear', tone: 'clear', aria: 'All clear' },
  { label: '⌫', action: 'backspace', tone: 'clear', aria: 'Delete' },
  { label: '(', tone: 'op' },
  { label: ')', tone: 'op' },
  { label: '7' }, { label: '8' }, { label: '9' }, { label: '÷', tone: 'op', aria: 'Divide' },
  { label: '4' }, { label: '5' }, { label: '6' }, { label: '×', tone: 'op', aria: 'Multiply' },
  { label: '1' }, { label: '2' }, { label: '3' }, { label: '−', tone: 'op', aria: 'Subtract' },
  { label: '0' }, { label: '.' }, { label: '%', tone: 'op', aria: 'Modulo' }, { label: '+', tone: 'op', aria: 'Add' },
  { label: 'ans', tone: 'fn', aria: 'Previous answer' },
  { label: '=', action: 'equals', tone: 'equals', span: 3, aria: 'Equals' },
];

const SCI_KEYS: Key[] = [
  { label: 'sin', insert: 'sin(', tone: 'fn' },
  { label: 'cos', insert: 'cos(', tone: 'fn' },
  { label: 'tan', insert: 'tan(', tone: 'fn' },
  { label: 'asin', insert: 'asin(', tone: 'fn' },
  { label: 'acos', insert: 'acos(', tone: 'fn' },
  { label: 'atan', insert: 'atan(', tone: 'fn' },
  { label: 'ln', insert: 'ln(', tone: 'fn' },
  { label: 'log', insert: 'log(', tone: 'fn' },
  { label: '√', insert: 'sqrt(', tone: 'fn', aria: 'Square root' },
  { label: 'exp', insert: 'exp(', tone: 'fn' },
  { label: '|x|', insert: 'abs(', tone: 'fn', aria: 'Absolute value' },
  { label: 'xʸ', insert: '^', tone: 'op', aria: 'Power' },
  { label: 'π', insert: 'pi', tone: 'fn', aria: 'Pi' },
  { label: 'e', tone: 'fn', aria: "Euler's number" },
  { label: 'n!', insert: '!', tone: 'op', aria: 'Factorial' },
];

// Every key is one elevation step above the panel with a strong border and
// an inset top highlight, so the keypad reads as keys in both themes.
const keyLift: CSSProperties = { border: '1px solid var(--border-strong)', boxShadow: 'inset 0 1px 0 var(--key-highlight)' };
const toneStyle: Record<KeyTone, CSSProperties> = {
  digit: { ...keyLift, background: 'var(--surface-2)', color: 'var(--ink)' },
  op: { background: 'var(--accent-soft)', color: 'var(--accent-ink)', border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)' },
  fn: { ...keyLift, background: 'var(--surface-3)', color: 'var(--ink-2)' },
  clear: { ...keyLift, background: 'var(--surface-3)', color: 'var(--ink-2)' },
  equals: {
    background: 'var(--accent)',
    color: 'var(--accent-contrast)',
    border: '1px solid var(--accent)',
  },
};

const panelStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-soft)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-card)',
  padding: 14,
  boxSizing: 'border-box',
};

function Keypad({
  keys,
  columns,
  onKey,
  isMobile,
}: {
  keys: Key[];
  columns: number;
  onKey: (k: Key) => void;
  isMobile: boolean;
}) {
  const h = isMobile ? 48 : 52;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 8 }}>
      {keys.map(k => {
        const tone = k.tone ?? 'digit';
        const textual = /^[a-z|!πe√ʸx]+$/i.test(k.label) && k.label.length > 1 && tone !== 'equals';
        return (
          <button
            key={k.label}
            type="button"
            aria-label={k.aria ?? k.label}
            onMouseDown={e => e.preventDefault()}
            onClick={() => onKey(k)}
            style={{
              height: h,
              minWidth: 44,
              gridColumn: k.span ? `span ${k.span}` : undefined,
              borderRadius: 'var(--radius-lg)',
              fontFamily: textual ? 'var(--font-sans)' : 'var(--font-mono)',
              fontSize: textual ? 14 : tone === 'equals' ? 22 : 19,
              fontWeight: tone === 'equals' ? 600 : 500,
              cursor: 'pointer',
              userSelect: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'filter 120ms ease',
              ...toneStyle[tone],
            }}
          >
            {k.label}
          </button>
        );
      })}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        background: 'var(--surface-2)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        padding: 2,
        gap: 2,
      }}
    >
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            style={{
              height: 28,
              padding: '0 12px',
              borderRadius: 'calc(var(--radius-md) - 2px)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              border: '1px solid transparent',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--accent-contrast)' : 'var(--ink-2)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function HistoryList({
  items,
  onRecall,
  onClear,
}: {
  items: HistoryItem[];
  onRecall: (expr: string) => void;
  onClear: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
          }}
        >
          History
        </span>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={items.length === 0}>
          Clear history
        </Button>
      </div>
      {items.length === 0 ? (
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-muted)', fontStyle: 'italic' }}>
          Results you calculate will show up here.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            overflowY: 'auto',
            maxHeight: 420,
          }}
        >
          {items.map(item => (
            <li key={item.at}>
              <button
                type="button"
                onClick={() => onRecall(item.expr)}
                title="Recall expression"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span
                  className="num-mono"
                  style={{
                    fontSize: 12,
                    color: 'var(--ink-3)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.expr}
                </span>
                <span className="num-mono" style={{ fontSize: 15, color: 'var(--ink)' }}>
                  = {item.result}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function App() {
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);

  const [expr, setExpr] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ans, setAns] = useState(0);
  const [mode, setMode] = useState<Mode>('basic');
  const [angle, setAngle] = useState<AngleMode>('deg');
  const [sciOpen, setSciOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const focusInput = () => inputRef.current?.focus();

  const insert = (text: string, caretBack = 0) => {
    const el = inputRef.current;
    if (!el) {
      setExpr(prev => prev + text);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    el.setRangeText(text, start, end, 'end');
    const caret = start + text.length - caretBack;
    el.setSelectionRange(caret, caret);
    setExpr(el.value);
    setError(null);
    el.focus();
  };

  const backspace = () => {
    const el = inputRef.current;
    if (!el) {
      setExpr(prev => prev.slice(0, -1));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    if (start === end && start === 0) return;
    const from = start === end ? start - 1 : start;
    el.setRangeText('', from, end, 'start');
    setExpr(el.value);
    setError(null);
    el.focus();
  };

  const clearAll = () => {
    setExpr('');
    setResult(null);
    setError(null);
    focusInput();
  };

  const runEvaluate = () => {
    const r = evaluate(expr, { angle, ans });
    track('calc_evaluated', { ok: r.ok });
    if (r.ok) {
      const text = formatResult(r.value);
      setResult(text);
      setError(null);
      setAns(r.value);
      setHistory(prev => pushHistory(prev, { expr: expr.trim(), result: text, at: Date.now() }));
    } else {
      setResult(null);
      setError(r.message);
      const el = inputRef.current;
      if (el && Number.isFinite(r.pos)) {
        const pos = Math.min(r.pos, el.value.length);
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    }
  };

  const onKey = (k: Key) => {
    if (k.action === 'equals') return runEvaluate();
    if (k.action === 'clear') return clearAll();
    if (k.action === 'backspace') return backspace();
    insert(k.insert ?? k.label, k.caret ?? 0);
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runEvaluate();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clearAll();
    }
  };

  const recall = (text: string) => {
    setExpr(text);
    setError(null);
    setResult(null);
    if (isMobile) setHistoryOpen(false);
    focusInput();
  };

  const showSci = mode === 'scientific' && (!isMobile || sciOpen);

  const controls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Segmented
        ariaLabel="Calculator mode"
        value={mode}
        options={[
          { value: 'basic', label: 'Basic' },
          { value: 'scientific', label: 'Scientific' },
        ]}
        onChange={setMode}
      />
      {mode === 'scientific' && (
        <Segmented
          ariaLabel="Angle unit"
          value={angle}
          options={[
            { value: 'deg', label: 'DEG' },
            { value: 'rad', label: 'RAD' },
          ]}
          onChange={setAngle}
        />
      )}
      {mode === 'scientific' && isMobile && (
        <Button
          variant={sciOpen ? 'soft' : 'outline'}
          size="sm"
          onClick={() => setSciOpen(o => !o)}
          aria-pressed={sciOpen}
          aria-label="Toggle scientific keys"
          style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', marginLeft: 'auto' }}
        >
          fx
        </Button>
      )}
    </div>
  );

  const display = (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        aria-label="Expression"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'calc-error' : undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="0"
        value={expr}
        onChange={e => {
          setExpr(e.target.value);
          setError(null);
        }}
        onKeyDown={onInputKeyDown}
        className="num-mono"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: isMobile ? 22 : 24,
          color: 'var(--ink)',
          textAlign: 'right',
        }}
      />
      <div
        aria-live="polite"
        style={{
          minHeight: isMobile ? 40 : 48,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
        }}
      >
        {error ? (
          <span id="calc-error" role="alert" style={{ fontSize: 13, color: 'var(--negative)', fontWeight: 500 }}>
            {error}
          </span>
        ) : (
          <span
            className="num-mono"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: isMobile ? 32 : 40,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: result === null ? 'var(--ink-muted)' : 'var(--ink)',
              overflowWrap: 'anywhere',
              textAlign: 'right',
            }}
          >
            {result ?? (expr ? '' : '0')}
          </span>
        )}
      </div>
    </div>
  );

  const pads = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showSci && !isMobile ? 'minmax(0, 3fr) minmax(0, 4fr)' : 'minmax(0, 1fr)',
        gap: 10,
      }}
    >
      {showSci && <Keypad keys={SCI_KEYS} columns={3} onKey={onKey} isMobile={isMobile} />}
      <Keypad keys={BASIC_KEYS} columns={4} onKey={onKey} isMobile={isMobile} />
    </div>
  );

  const calculator = (
    <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {controls}
      {display}
      {pads}
    </div>
  );

  return (
    <ToolShell entry={entry} maxWidth={showSci && !isMobile ? 980 : 820}>
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {calculator}
          <div style={panelStyle}>
            <button
              type="button"
              onClick={() => setHistoryOpen(o => !o)}
              aria-expanded={historyOpen}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'var(--ink-2)',
                fontSize: 13,
                fontWeight: 600,
                minHeight: 28,
              }}
            >
              <span>History{history.length ? ` (${history.length})` : ''}</span>
              <span style={{ display: 'inline-flex', transform: historyOpen ? 'rotate(180deg)' : 'none' }}>
                <Icon name="chevron" />
              </span>
            </button>
            {historyOpen && (
              <div style={{ marginTop: 12 }}>
                <HistoryList items={history} onRecall={recall} onClear={() => setHistory([])} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 260px',
            gap: 16,
            alignItems: 'start',
          }}
        >
          {calculator}
          <aside style={panelStyle}>
            <HistoryList items={history} onRecall={recall} onClear={() => setHistory([])} />
          </aside>
        </div>
      )}
    </ToolShell>
  );
}
