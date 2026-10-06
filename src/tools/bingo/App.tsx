import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
import { ToolShell } from '../../components/layout/ToolShell';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';
import { Popover, PopoverItem, PopoverLabel } from '../../components/primitives/Popover';
import { ConfirmDialog } from '../../components/storyline/ConfirmDialog';
import { useIsMobile } from '../../hooks/useIsMobile';
import { bySlug } from '../../site/manifest';
import { track } from '../../utils/analytics';
import {
  AUTO_INTERVALS,
  DEFAULT_SETTINGS,
  DEFAULT_VARIANT,
  VARIANTS,
  VARIANT_IDS,
  boardRows,
  columnOf,
  formatCall,
  gameReducer,
  isFinished,
  lastCall,
  letterFor,
  loadSaved,
  newGame,
  save,
  speechFor,
  variantOf,
  type AutoInterval,
  type GameState,
  type Settings,
  type Variant,
  type VariantId,
} from './bingo';

const entry = bySlug('bingo');

// ─── Styles ─────────────────────────────────────────────────────────────

// Column colours follow the classic flashboard (B blue, I red, N silver/indigo,
// G green, O amber). Variants with more rows than colours cycle through them.
const COLUMN_STYLES = `
:root {
  --bingo-0: oklch(0.55 0.17 250); --bingo-0-soft: oklch(0.93 0.05 250);
  --bingo-1: oklch(0.58 0.19 25);  --bingo-1-soft: oklch(0.93 0.06 25);
  --bingo-2: oklch(0.52 0.16 290); --bingo-2-soft: oklch(0.93 0.05 290);
  --bingo-3: oklch(0.56 0.14 155); --bingo-3-soft: oklch(0.93 0.06 155);
  --bingo-4: oklch(0.68 0.15 65);  --bingo-4-soft: oklch(0.94 0.07 65);
  --bingo-ink-on: oklch(0.995 0.005 80);
}
:root[data-theme="dark"] {
  --bingo-0: oklch(0.66 0.15 250); --bingo-0-soft: oklch(0.30 0.06 250);
  --bingo-1: oklch(0.68 0.17 25);  --bingo-1-soft: oklch(0.30 0.07 25);
  --bingo-2: oklch(0.70 0.15 290); --bingo-2-soft: oklch(0.30 0.06 290);
  --bingo-3: oklch(0.72 0.13 155); --bingo-3-soft: oklch(0.30 0.06 155);
  --bingo-4: oklch(0.78 0.14 70);  --bingo-4-soft: oklch(0.32 0.07 70);
  --bingo-ink-on: oklch(0.16 0.01 260);
}
@keyframes bingo-pop {
  0%   { transform: scale(0.6) rotate(-12deg); opacity: 0; }
  60%  { transform: scale(1.08) rotate(2deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes bingo-ring {
  0%   { box-shadow: 0 0 0 0 var(--bingo-ring, transparent); }
  100% { box-shadow: 0 0 0 10px transparent; }
}
.bingo-pop { animation: bingo-pop 420ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
.bingo-ring { animation: bingo-ring 900ms ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .bingo-pop, .bingo-ring { animation: none; }
}
`;

const card: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-card)',
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 'var(--tracking-wider)',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
};

function colVar(col: number, soft = false): string {
  return `var(--bingo-${col % 5}${soft ? '-soft' : ''})`;
}

/** Colour slot for a ball: its column letter's colour, or one shared colour when the variant has no letters. */
function colorIndex(n: number, variant: Variant): number {
  return variant.letters.length ? columnOf(n, variant) : 2;
}

// ─── Persistence bootstrap ──────────────────────────────────────────────

interface Boot {
  game: GameState;
  settings: Settings;
}

function boot(): Boot {
  const saved = loadSaved();
  return saved ?? { game: newGame(DEFAULT_VARIANT, Date.now()), settings: DEFAULT_SETTINGS };
}

// ─── App ────────────────────────────────────────────────────────────────

export default function App() {
  const [initial] = useState(boot);
  const [game, dispatch] = useReducer(gameReducer, initial.game);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [auto, setAuto] = useState(false);
  const [confirmNew, setConfirmNew] = useState<VariantId | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const saveFailedRef = useRef(false);
  const isMobile = useIsMobile();

  const variant = variantOf(game);
  const finished = isFinished(game);
  const current = lastCall(game);
  const autoRunning = auto && !finished;
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Persist every change (see todo/App.tsx for the microtask rationale).
  useEffect(() => {
    const ok = save(game, settings);
    if (!ok && !saveFailedRef.current) {
      saveFailedRef.current = true;
      queueMicrotask(() => setSaveFailed(true));
    }
  }, [game, settings]);

  // Auto-call: one draw per interval while running and the tab is visible.
  useEffect(() => {
    if (!autoRunning) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') dispatch({ type: 'draw' });
    }, settings.autoSeconds * 1000);
    return () => clearInterval(id);
  }, [autoRunning, settings.autoSeconds]);

  // Voice: announce a call only when a *new* draw happened this session
  // (not on load, not on undo).
  const spokenCount = useRef(game.drawn.length);
  useEffect(() => {
    const n = game.drawn.length;
    if (n > spokenCount.current && settings.voice && canSpeak && current != null) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(speechFor(current, variant));
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
      } catch {
        // speech is best-effort
      }
    }
    spokenCount.current = n;
  }, [game.drawn.length, current, settings.voice, canSpeak, variant]);

  useEffect(() => {
    if (finished) track('bingo_finished', { variant: game.variant });
  }, [finished, game.variant]);

  const draw = useCallback(() => dispatch({ type: 'draw' }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);

  const startNew = useCallback((v: VariantId) => {
    setAuto(false);
    dispatch({ type: 'newGame', variant: v, now: Date.now() });
    track('bingo_started', { variant: v });
  }, []);

  const requestNew = useCallback(
    (v: VariantId) => {
      if (game.drawn.length > 0 && !finished) setConfirmNew(v);
      else startNew(v);
    },
    [game.drawn.length, finished, startNew],
  );

  // Keyboard: Space / Enter / N draw, Backspace / U undo, A auto, Esc stops auto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmNew != null || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Let focused buttons handle Space/Enter natively (no double-draw).
      if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
      const key = e.key;
      if (key === ' ' || key === 'Enter' || key === 'n' || key === 'N') draw();
      else if (key === 'Backspace' || key === 'Delete' || key === 'u' || key === 'U') undo();
      else if (key === 'a' || key === 'A') setAuto(a => !a);
      else if (key === 'Escape') setAuto(false);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmNew, draw, undo]);

  const maxWidth = isMobile ? 560 : 960;

  return (
    <ToolShell
      entry={entry}
      maxWidth={maxWidth}
      rightSlot={
        <Popover
          align="right"
          width={220}
          trigger={({ toggle }) => (
            <Button variant="soft" size="sm" onClick={toggle} trailing={<Icon name="caret" size={10} />}>
              {variant.name}
            </Button>
          )}
        >
          {({ close }) => (
            <>
              <PopoverLabel>New game</PopoverLabel>
              {VARIANT_IDS.map(id => (
                <PopoverItem
                  key={id}
                  active={id === game.variant}
                  onClick={() => {
                    close();
                    requestNew(id);
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span>{VARIANTS[id].name}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{VARIANTS[id].blurb}</span>
                  </span>
                </PopoverItem>
              ))}
            </>
          )}
        </Popover>
      }
    >
      <style>{COLUMN_STYLES}</style>

      {saveFailed && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            marginBottom: 14,
            fontSize: 13,
            color: 'var(--negative)',
            background: 'var(--negative-soft)',
            border: '1px solid var(--negative)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Icon name="warning" size={14} />
          <span style={{ flex: 1 }}>Couldn't save — storage is full or disabled.</span>
          <Button variant="ghost" size="sm" aria-label="Dismiss" onClick={() => setSaveFailed(false)} leading={<Icon name="close" size={12} />} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 18 }}>
        <CallCard game={game} isMobile={isMobile} />

        <Actions
          game={game}
          finished={finished}
          autoRunning={autoRunning}
          settings={settings}
          canSpeak={canSpeak}
          isMobile={isMobile}
          onDraw={draw}
          onUndo={undo}
          onToggleAuto={() => setAuto(a => !a)}
          onInterval={s => setSettings(st => ({ ...st, autoSeconds: s }))}
          onToggleVoice={() => setSettings(st => ({ ...st, voice: !st.voice }))}
          onNewGame={() => requestNew(game.variant)}
        />

        <Flashboard game={game} transposed={isMobile} />

        <History game={game} />

        {!isMobile && (
          <p style={{ fontSize: 12, color: 'var(--ink-muted)', margin: '0 2px', lineHeight: 1.5 }}>
            Keyboard: <kbd>Space</kbd> or <kbd>N</kbd> draws the next number, <kbd>U</kbd> or ⌫ undoes the last call,{' '}
            <kbd>A</kbd> toggles auto-call, <kbd>Esc</kbd> pauses it.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmNew != null}
        title="Start a new game?"
        subtitle="The current calls will be cleared"
        message={
          <>
            <strong>{game.drawn.length}</strong> number{game.drawn.length === 1 ? ' has' : 's have'} been called in this{' '}
            <strong>{variant.name}</strong> game. Start a new <strong>{confirmNew ? VARIANTS[confirmNew].name : ''}</strong>{' '}
            game and clear the board?
          </>
        }
        confirmLabel="New game"
        icon="grid"
        onClose={() => setConfirmNew(null)}
        onConfirm={() => {
          if (confirmNew != null) startNew(confirmNew);
          setConfirmNew(null);
        }}
      />
    </ToolShell>
  );
}

// ─── Current call ───────────────────────────────────────────────────────

function CallCard({ game, isMobile }: { game: GameState; isMobile: boolean }) {
  const variant = variantOf(game);
  const current = lastCall(game);
  const called = game.drawn.length;
  const left = variant.total - called;
  const previous = game.drawn.slice(Math.max(0, called - 6), Math.max(0, called - 1)).reverse();
  const col = current != null ? colorIndex(current, variant) : -1;
  const ballSize = isMobile ? 150 : 188;

  return (
    <section
      aria-label="Current call"
      style={{
        ...card,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'center',
        gap: isMobile ? 16 : 28,
        padding: isMobile ? '22px 18px' : '26px 32px',
      }}
    >
      <div
        // key forces the pop animation on every new call (and none on undo-to-same)
        key={`${current ?? 'none'}-${called}`}
        className={current != null ? 'bingo-pop' : undefined}
        role="status"
        aria-live="polite"
        aria-label={current != null ? `Current call ${formatCall(current, variant)}` : 'No numbers called yet'}
        style={{
          width: ballSize,
          height: ballSize,
          borderRadius: '50%',
          flex: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: current != null ? colVar(col) : 'var(--surface-2)',
          color: current != null ? 'var(--bingo-ink-on)' : 'var(--ink-muted)',
          boxShadow:
            current != null
              ? '0 2px 0 oklch(1 0 0 / 0.25) inset, 0 -10px 24px oklch(0 0 0 / 0.18) inset, 0 12px 28px oklch(0.2 0.04 260 / 0.22)'
              : 'inset 0 0 0 2px var(--border-strong)',
          userSelect: 'none',
        }}
      >
        {current != null ? (
          <>
            {variant.letters.length > 0 && (
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: ballSize * 0.24, lineHeight: 1, letterSpacing: '0.04em', opacity: 0.92 }}>
                {letterFor(current, variant)}
              </span>
            )}
            <span
              className="num"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: ballSize * (variant.letters.length ? 0.44 : 0.5),
                lineHeight: 1,
                letterSpacing: '-0.03em',
              }}
            >
              {current}
            </span>
          </>
        ) : (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, textAlign: 'center', padding: '0 18px', lineHeight: 1.35 }}>
            Ready to call
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, alignItems: isMobile ? 'center' : 'flex-start', textAlign: isMobile ? 'center' : 'left' }}>
        <div>
          <div style={eyebrow}>{variant.name} · {current != null ? `Call ${called}` : 'New game'}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 24 : 30, fontWeight: 600, letterSpacing: 'var(--tracking-tight)', color: 'var(--ink)', marginTop: 4 }}>
            {current != null ? formatCall(current, variant) : `Draw the first of ${variant.total} numbers`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
            <span className="num">{called}</span> called · <span className="num">{left}</span> left
          </div>
        </div>

        <Progress value={called} max={variant.total} />

        {previous.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
            <span style={{ ...eyebrow, marginRight: 2 }}>Previous</span>
            {previous.map(n => (
              <Chip key={n} n={n} variant={variant} small />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Progress({ value, max }: { value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} style={{ width: '100%', maxWidth: 360, height: 6, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 99, transition: 'width 240ms ease' }} />
    </div>
  );
}

function Chip({ n, variant, small, index }: { n: number; variant: Variant; small?: boolean; index?: number }) {
  const col = colorIndex(n, variant);
  return (
    <span
      className="num"
      title={index != null ? `Call ${index}` : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: small ? 26 : 32,
        padding: small ? '0 9px' : '0 11px',
        borderRadius: 'var(--radius-pill)',
        background: colVar(col, true),
        color: 'var(--ink)',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: small ? 12.5 : 14,
        border: `1px solid ${colVar(col)}`,
        whiteSpace: 'nowrap',
      }}
    >
      {index != null && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', fontWeight: 500 }}>{index}</span>
      )}
      {formatCall(n, variant)}
    </span>
  );
}

// ─── Actions ────────────────────────────────────────────────────────────

interface ActionsProps {
  game: GameState;
  finished: boolean;
  autoRunning: boolean;
  settings: Settings;
  canSpeak: boolean;
  isMobile: boolean;
  onDraw: () => void;
  onUndo: () => void;
  onToggleAuto: () => void;
  onInterval: (s: AutoInterval) => void;
  onToggleVoice: () => void;
  onNewGame: () => void;
}

function Actions({ game, finished, autoRunning, settings, canSpeak, isMobile, onDraw, onUndo, onToggleAuto, onInterval, onToggleVoice, onNewGame }: ActionsProps) {
  return (
    <section aria-label="Caller controls" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {finished ? (
          <Button variant="primary" size="lg" onClick={onNewGame} leading={<Icon name="sparkle" size={14} />} style={{ flex: '1 1 220px', height: isMobile ? 52 : 56, fontSize: 16 }}>
            All {variantOf(game).total} numbers called — new game
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={onDraw}
            leading={<Icon name="plus" size={14} />}
            title="Draw the next number (Space)"
            style={{ flex: '1 1 220px', height: isMobile ? 52 : 56, fontSize: 16 }}
          >
            {game.drawn.length === 0 ? 'Draw first number' : 'Draw next number'}
          </Button>
        )}
        <Button size="lg" onClick={onUndo} disabled={game.drawn.length === 0} leading={<Icon name="undo" size={13} />} title="Undo the last call (U)" style={{ height: isMobile ? 52 : 56, flex: isMobile ? '1 1 120px' : 'none' }}>
          Undo last
        </Button>
        {!finished && (
          <Button size="lg" onClick={onNewGame} disabled={game.drawn.length === 0} title="Clear the board and start over" style={{ height: isMobile ? 52 : 56, flex: isMobile ? '1 1 120px' : 'none' }}>
            New game
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          variant={autoRunning ? 'soft' : 'outline'}
          size="md"
          aria-pressed={autoRunning}
          disabled={finished}
          onClick={onToggleAuto}
          leading={<Icon name={autoRunning ? 'pause' : 'play'} size={12} />}
          title="Draw automatically on a timer (A)"
        >
          {autoRunning ? 'Pause auto-call' : 'Auto-call'}
        </Button>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-3)' }}>
          every
          <select
            value={settings.autoSeconds}
            onChange={e => onInterval(Number(e.target.value) as AutoInterval)}
            aria-label="Seconds between automatic calls"
            style={{
              height: 34,
              padding: '0 8px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
            }}
          >
            {AUTO_INTERVALS.map(s => (
              <option key={s} value={s}>
                {s}s
              </option>
            ))}
          </select>
        </label>
        <span style={{ flex: 1 }} />
        {canSpeak && (
          <Button variant={settings.voice ? 'soft' : 'outline'} size="md" aria-pressed={settings.voice} onClick={onToggleVoice} title="Read each call aloud">
            {settings.voice ? '🔊 Voice on' : '🔈 Voice off'}
          </Button>
        )}
      </div>
    </section>
  );
}

// ─── Flashboard ─────────────────────────────────────────────────────────

function Flashboard({ game, transposed }: { game: GameState; transposed: boolean }) {
  const variant = variantOf(game);
  const rows = useMemo(() => boardRows(variant), [variant]);
  const called = useMemo(() => new Set(game.drawn), [game.drawn]);
  const current = lastCall(game);
  const hasLetters = variant.letters.length > 0;
  const cols = transposed ? rows.length : variant.perColumn;
  const gridTemplateColumns = `${hasLetters ? (transposed ? '' : '40px ') : ''}repeat(${cols}, minmax(0, 1fr))`;

  const cell = (n: number, r: number) => {
    const on = called.has(n);
    const c = hasLetters ? r : 2;
    const isCurrent = n === current;
    return (
      <div
        key={n}
        className={`num${isCurrent ? ' bingo-ring' : ''}`}
        aria-label={`${formatCall(n, variant)}${on ? ', called' : ''}`}
        style={{
          aspectRatio: transposed ? undefined : '1 / 1',
          height: transposed ? 34 : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-display)',
          fontWeight: on ? 700 : 500,
          fontSize: transposed ? 15 : 'clamp(12px, 1.6vw, 16px)',
          background: on ? colVar(c) : 'var(--surface-2)',
          color: on ? 'var(--bingo-ink-on)' : 'var(--ink-3)',
          boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--border-strong)',
          outline: isCurrent ? '2px solid var(--ink)' : 'none',
          outlineOffset: 1,
          ['--bingo-ring' as string]: colVar(c),
          transition: 'background 160ms, color 160ms',
        }}
      >
        {n}
      </div>
    );
  };

  const letterCell = (letter: string, r: number) => (
    <div
      key={`L${r}`}
      aria-hidden
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: transposed ? 20 : 22,
        color: colVar(r),
        minHeight: transposed ? 36 : undefined,
      }}
    >
      {letter}
    </div>
  );

  return (
    <section aria-label="Called numbers board" style={{ ...card, padding: transposed ? 12 : 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={eyebrow}>Flashboard</span>
        <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
          <span className="num">{game.drawn.length}</span>/{variant.total}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns, gap: transposed ? 4 : 6 }}>
        {transposed ? (
          <>
            {hasLetters && rows.map((row, r) => letterCell(row.letter, r))}
            {Array.from({ length: variant.perColumn }, (_, i) => rows.map((row, r) => (row.numbers[i] != null ? cell(row.numbers[i], r) : <div key={`e${r}-${i}`} />)))}
          </>
        ) : (
          rows.map((row, r) => (
            <FragmentRow key={r}>
              {hasLetters && letterCell(row.letter, r)}
              {row.numbers.map(n => cell(n, r))}
            </FragmentRow>
          ))
        )}
      </div>
    </section>
  );
}

// display: contents keeps each row's cells as direct grid children.
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'contents' }}>{children}</div>;
}

// ─── History ────────────────────────────────────────────────────────────

function History({ game }: { game: GameState }) {
  const variant = variantOf(game);
  const calls = [...game.drawn].map((n, i) => ({ n, index: i + 1 })).reverse();
  const started = game.startedAt > 0 ? new Date(game.startedAt) : null;

  return (
    <section aria-label="Call history" style={{ ...card, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, gap: 12 }}>
        <span style={eyebrow}>Call history · newest first</span>
        {started && (
          <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            Started {started.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>
      {calls.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>No numbers called yet. Every call you draw is listed here in order.</p>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {calls.map(c => (
            <li key={c.n}>
              <Chip n={c.n} variant={variant} index={c.index} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
