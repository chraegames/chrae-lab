import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ToolShell } from '../../components/layout/ToolShell';
import { Button } from '../../components/primitives/Button';
import { TextInput } from '../../components/primitives/Input';
import { useIsMobile } from '../../hooks/useIsMobile';
import { bySlug } from '../../site/manifest';
import { track } from '../../utils/analytics';
import { formatResult, parseInput } from './format';
import { defaultSelection, loadSelection, saveSelection, type Selection } from './storage';
import { convert, getCategory, getUnit, UNIT_CATEGORIES, type CategoryId } from './units';

const entry = bySlug('unit-converter');

const selectStyle: CSSProperties = {
  height: 36,
  padding: '0 32px 0 12px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  color: 'var(--ink)',
  width: '100%',
  boxSizing: 'border-box',
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none' stroke='%23888' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='m4 6 4 4 4-4'/></svg>\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  cursor: 'pointer',
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
  marginBottom: 8,
  display: 'block',
};

function isTextField(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
}

export function App() {
  const isMobile = useIsMobile();
  const [sel, setSel] = useState<Selection>(loadSelection);
  const [input, setInput] = useState('1');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const category = getCategory(sel.category) ?? UNIT_CATEGORIES[0];
  const fromUnit = getUnit(sel.category, sel.fromId);
  const toUnit = getUnit(sel.category, sel.toId);

  const parsed = useMemo(() => parseInput(input), [input]);
  const result = useMemo(
    () => (parsed === null ? '' : formatResult(convert(sel.category, sel.fromId, sel.toId, parsed))),
    [parsed, sel],
  );
  const formula = useMemo(
    () => formatResult(convert(sel.category, sel.fromId, sel.toId, 1)),
    [sel],
  );
  const invalid = input.trim() !== '' && parsed === null;

  useEffect(() => {
    saveSelection(sel);
  }, [sel]);

  // Skip the mount run so merely opening the page doesn't count as a use.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (parsed === null) return;
    const id = window.setTimeout(() => {
      track('converter_used', { category: sel.category, from: sel.fromId, to: sel.toId });
    }, 600);
    return () => window.clearTimeout(id);
  }, [parsed, sel]);

  const swap = () => setSel(s => ({ ...s, fromId: s.toId, toId: s.fromId }));

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 's' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTextField(document.activeElement)) return;
      e.preventDefault();
      setSel(s => ({ ...s, fromId: s.toId, toId: s.fromId }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectCategory = (id: CategoryId) => {
    if (id === sel.category) return;
    setSel(defaultSelection(id));
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const n = UNIT_CATEGORIES.length;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (index + 1) % n;
    else if (e.key === 'ArrowLeft') next = (index - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next === null) return;
    e.preventDefault();
    selectCategory(UNIT_CATEGORIES[next].id);
    tabRefs.current[next]?.focus();
  };

  const unitOptions = category.units.map(u => (
    <option key={u.id} value={u.id}>
      {u.label} ({u.symbol})
    </option>
  ));

  const blockStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-card)',
    padding: isMobile ? '16px 16px 18px' : '20px 22px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };

  return (
    <ToolShell entry={entry} maxWidth={820}>
      <p
        style={{
          margin: '0 0 18px',
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 14,
          color: 'var(--ink-3)',
        }}
      >
        {entry.tagline}
      </p>

      <div
        role="tablist"
        aria-label="Unit category"
        style={{
          display: 'flex',
          gap: 4,
          padding: 4,
          background: 'var(--surface-2)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-pill)',
          overflowX: 'auto',
          marginBottom: 22,
        }}
      >
        {UNIT_CATEGORIES.map((c, i) => {
          const active = c.id === sel.category;
          return (
            <button
              key={c.id}
              ref={el => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`tab-${c.id}`}
              aria-selected={active}
              aria-controls="converter-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => selectCategory(c.id)}
              onKeyDown={e => onTabKey(e, i)}
              style={{
                flex: isMobile ? '0 0 auto' : 1,
                height: 32,
                padding: '0 14px',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'var(--accent-contrast)' : 'var(--ink-2)',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background-color 140ms ease, color 140ms ease',
              }}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      <div
        id="converter-panel"
        role="tabpanel"
        aria-labelledby={`tab-${sel.category}`}
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'stretch',
          gap: isMobile ? 10 : 14,
        }}
      >
        <div style={blockStyle}>
          <label htmlFor="uc-input" style={labelStyle}>
            From
          </label>
          <TextInput
            id="uc-input"
            className="num-mono"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={setInput}
            placeholder="0"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? 'uc-hint' : undefined}
            style={{
              height: 56,
              fontSize: 30,
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              padding: '0 12px',
              width: '100%',
              borderColor: invalid ? 'var(--negative)' : undefined,
            }}
          />
          <select
            aria-label="From unit"
            value={sel.fromId}
            onChange={e => setSel(s => ({ ...s, fromId: e.target.value }))}
            style={selectStyle}
          >
            {unitOptions}
          </select>
          <span
            id="uc-hint"
            role="status"
            style={{ fontSize: 12, color: invalid ? 'var(--negative)' : 'var(--ink-muted)', minHeight: 16 }}
          >
            {invalid ? 'Enter a number' : ' '}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: isMobile ? 'center' : 'auto',
          }}
        >
          <Button
            variant="outline"
            size="md"
            onClick={swap}
            aria-label="Swap units"
            title="Swap units (S)"
            style={{
              width: 40,
              height: 40,
              padding: 0,
              borderRadius: '50%',
              fontSize: 18,
              lineHeight: 1,
              transform: isMobile ? 'rotate(90deg)' : 'none',
            }}
          >
            ⇄
          </Button>
        </div>

        <div style={{ ...blockStyle, background: 'var(--accent-soft)', borderColor: 'transparent' }}>
          <span style={{ ...labelStyle, color: 'var(--accent-ink)' }}>To</span>
          <output
            htmlFor="uc-input"
            aria-live="polite"
            className="num-mono"
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 56,
              fontSize: 30,
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: result ? 'var(--ink)' : 'var(--ink-muted)',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {result || '—'}
          </output>
          <select
            aria-label="To unit"
            value={sel.toId}
            onChange={e => setSel(s => ({ ...s, toId: e.target.value }))}
            style={{ ...selectStyle, backgroundColor: 'var(--surface)' }}
          >
            {unitOptions}
          </select>
          <span className="num-mono" style={{ fontSize: 12, color: 'var(--ink-3)', minHeight: 16 }}>
            {fromUnit && toUnit ? `1 ${fromUnit.symbol} = ${formula} ${toUnit.symbol}` : ' '}
          </span>
        </div>
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: 'var(--ink-muted)' }}>
        Tip: press <kbd style={{ fontFamily: 'var(--font-mono)' }}>S</kbd> outside the input to swap units.
        Results show up to 8 significant digits.
      </p>
    </ToolShell>
  );
}
