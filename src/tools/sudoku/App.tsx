import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import { ToolShell } from '../../components/layout/ToolShell';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';
import { Popover, PopoverItem, PopoverLabel } from '../../components/primitives/Popover';
import { ConfirmDialog } from '../../components/storyline/ConfirmDialog';
import { useIsMobile } from '../../hooks/useIsMobile';
import { bySlug } from '../../site/manifest';
import { track } from '../../utils/analytics';
import {
  formatTime,
  gameReducer,
  isGiven,
  loadGame,
  newGame,
  randomSeed,
  saveGame,
  type GameAction,
  type GameState,
} from './game';
import { DIFFICULTIES, boxOf, colOf, digitCounts, findConflicts, rowOf, type Difficulty } from './sudoku';

const entry = bySlug('sudoku');

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

function initialState(): GameState {
  return loadGame() ?? newGame('easy', randomSeed());
}

// ─── Styles ─────────────────────────────────────────────────────────────

const card: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-card)',
};

const THICK = '2px solid var(--ink-2)';
const THIN = '1px solid var(--border)';

// ─── App ────────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialState);
  const isMobile = useIsMobile();
  const [confirmNew, setConfirmNew] = useState<Difficulty | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const saveFailedRef = useRef(false);
  const wonTracked = useRef(false);

  // Persist on every change (see todo/App.tsx for the microtask rationale).
  useEffect(() => {
    const ok = saveGame(state);
    if (!ok && !saveFailedRef.current) {
      saveFailedRef.current = true;
      queueMicrotask(() => setSaveFailed(true));
    }
  }, [state]);

  // Clock: one tick per second while playing and the tab is visible.
  useEffect(() => {
    if (state.status !== 'playing') return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') dispatch({ type: 'tick' });
    }, 1000);
    return () => clearInterval(id);
  }, [state.status]);

  useEffect(() => {
    if (state.status === 'won' && !wonTracked.current) {
      wonTracked.current = true;
      track('sudoku_won', { difficulty: state.difficulty, seconds: state.elapsed, hints: state.hintsUsed });
    }
    if (state.status === 'playing') wonTracked.current = false;
  }, [state.status, state.difficulty, state.elapsed, state.hintsUsed]);

  const startNew = useCallback((difficulty: Difficulty) => {
    dispatch({ type: 'newGame', difficulty, seed: randomSeed() });
    track('sudoku_started', { difficulty });
  }, []);

  const hasProgress = state.status === 'playing' && state.cells.some((v, i) => v !== state.puzzle[i]);

  const requestNew = useCallback(
    (difficulty: Difficulty) => {
      if (hasProgress) setConfirmNew(difficulty);
      else startNew(difficulty);
    },
    [hasProgress, startNew],
  );

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmNew) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const key = e.key;
      let action: GameAction | null = null;
      if (key >= '1' && key <= '9') action = { type: 'input', digit: Number(key) };
      else if (key === 'Backspace' || key === 'Delete' || key === '0') action = { type: 'erase' };
      else if (key === 'ArrowUp') action = { type: 'move', dr: -1, dc: 0 };
      else if (key === 'ArrowDown') action = { type: 'move', dr: 1, dc: 0 };
      else if (key === 'ArrowLeft') action = { type: 'move', dr: 0, dc: -1 };
      else if (key === 'ArrowRight') action = { type: 'move', dr: 0, dc: 1 };
      else if (key === 'n' || key === 'N') action = { type: 'toggleNotesMode' };
      else if (key === 'h' || key === 'H') action = { type: 'hint' };
      else if ((key === 'z' && (e.metaKey || e.ctrlKey)) || key === 'u' || key === 'U') action = { type: 'undo' };
      else if (key === 'Escape') action = state.activeDigit != null ? { type: 'pickDigit', digit: state.activeDigit } : { type: 'select', index: null };
      if (!action) return;
      e.preventDefault();
      dispatch(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmNew, state.activeDigit]);

  const conflicts = findConflicts(state.cells);
  const counts = digitCounts(state.cells);
  const selectedDigit = state.activeDigit ?? (state.selected != null ? state.cells[state.selected] : 0);
  const maxWidth = isMobile ? 560 : 880;

  return (
    <ToolShell
      entry={entry}
      maxWidth={maxWidth}
      rightSlot={
        <Popover
          align="right"
          width={180}
          trigger={({ toggle }) => (
            <Button variant="soft" size="sm" onClick={toggle} trailing={<Icon name="caret" size={10} />}>
              {DIFFICULTY_LABEL[state.difficulty]}
            </Button>
          )}
        >
          {({ close }) => (
            <>
              <PopoverLabel>New game</PopoverLabel>
              {DIFFICULTIES.map(d => (
                <PopoverItem
                  key={d}
                  active={d === state.difficulty}
                  onClick={() => {
                    close();
                    requestNew(d);
                  }}
                >
                  {DIFFICULTY_LABEL[d]}
                </PopoverItem>
              ))}
            </>
          )}
        </Popover>
      }
    >
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
          <Button
            variant="ghost"
            size="sm"
            aria-label="Dismiss"
            onClick={() => setSaveFailed(false)}
            leading={<Icon name="close" size={12} />}
          />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 14 : 24,
          alignItems: isMobile ? 'stretch' : 'flex-start',
        }}
      >
        <div style={{ flex: '0 1 520px', minWidth: 0, width: '100%' }}>
          <StatusRow state={state} />
          <Board state={state} dispatch={dispatch} conflicts={conflicts} selectedDigit={selectedDigit} />
        </div>

        <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {state.status === 'won' && <WinCard state={state} onPlayAgain={() => startNew(state.difficulty)} />}
          <Controls state={state} dispatch={dispatch} />
          <NumberPad
            counts={counts}
            selectedDigit={selectedDigit}
            activeDigit={state.activeDigit}
            notesMode={state.notesMode}
            dispatch={dispatch}
          />
          {!isMobile && (
            <p style={{ fontSize: 12, color: 'var(--ink-muted)', margin: '4px 2px 0', lineHeight: 1.5 }}>
              Tap a number, then tap cells to fill it in — or pick a cell first and then a number.
              Keyboard: arrows move, 1–9 type, ⌫ erase, <kbd>N</kbd> notes, <kbd>H</kbd> hint, <kbd>U</kbd> or
              ⌘Z undo, Esc release.
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmNew != null}
        title="Start a new game?"
        subtitle="Your current puzzle will be lost"
        message={
          <>
            You have progress on this <strong>{DIFFICULTY_LABEL[state.difficulty]}</strong> puzzle. Start a new{' '}
            <strong>{confirmNew ? DIFFICULTY_LABEL[confirmNew] : ''}</strong> game anyway?
          </>
        }
        confirmLabel="New game"
        icon="grid"
        onClose={() => setConfirmNew(null)}
        onConfirm={() => {
          if (confirmNew) startNew(confirmNew);
          setConfirmNew(null);
        }}
      />
    </ToolShell>
  );
}

// ─── Status row ─────────────────────────────────────────────────────────

function StatusRow({ state }: { state: GameState }) {
  const filled = state.cells.filter(Boolean).length;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 10,
        padding: '0 2px',
        fontSize: 13,
        color: 'var(--ink-3)',
      }}
    >
      <span>
        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{DIFFICULTY_LABEL[state.difficulty]}</span>
        <span style={{ marginLeft: 8 }}>{filled}/81</span>
        {state.hintsUsed > 0 && <span style={{ marginLeft: 8 }}>{state.hintsUsed} hint{state.hintsUsed === 1 ? '' : 's'}</span>}
      </span>
      <span
        style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: 'var(--ink-2)' }}
        aria-label="Elapsed time"
      >
        {formatTime(state.elapsed)}
      </span>
    </div>
  );
}

// ─── Board ──────────────────────────────────────────────────────────────

interface BoardProps {
  state: GameState;
  dispatch: (a: GameAction) => void;
  conflicts: Set<number>;
  selectedDigit: number;
}

function Board({ state, dispatch, conflicts, selectedDigit }: BoardProps) {
  const sel = state.selected;
  const selRow = sel != null ? rowOf(sel) : -1;
  const selCol = sel != null ? colOf(sel) : -1;
  const selBox = sel != null ? boxOf(sel) : -1;

  return (
    <div
      role="grid"
      aria-label="Sudoku board"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(9, 1fr)',
        aspectRatio: '1 / 1',
        width: '100%',
        border: THICK,
        borderRadius: 6,
        overflow: 'hidden',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-card)',
        userSelect: 'none',
        containerType: 'inline-size',
      }}
    >
      {state.cells.map((value, i) => {
        const r = rowOf(i);
        const c = colOf(i);
        const given = isGiven(state, i);
        const isSel = i === sel;
        const related = !isSel && (r === selRow || c === selCol || boxOf(i) === selBox);
        const sameDigit = !isSel && value !== 0 && value === selectedDigit;
        const conflict = conflicts.has(i);
        const won = state.status === 'won';

        let background = 'transparent';
        if (won) background = 'var(--positive-tint)';
        else if (isSel) background = 'var(--accent-soft)';
        else if (sameDigit) background = 'var(--accent-tint)';
        else if (related) background = 'var(--surface-2)';

        let color = given ? 'var(--ink)' : 'var(--accent-ink)';
        if (conflict) color = 'var(--negative)';

        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            aria-selected={isSel}
            aria-label={`Row ${r + 1} column ${c + 1}${value ? `, ${value}` : ', empty'}${given ? ', given' : ''}`}
            onClick={() => dispatch({ type: 'select', index: i })}
            tabIndex={-1}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              cursor: won ? 'default' : 'pointer',
              background,
              color,
              fontFamily: 'var(--font-display)',
              fontWeight: given ? 600 : 500,
              fontSize: 'clamp(16px, 5.2cqw, 30px)',
              borderRight: c === 8 ? 'none' : c % 3 === 2 ? THICK : THIN,
              borderBottom: r === 8 ? 'none' : r % 3 === 2 ? THICK : THIN,
              transition: 'background 80ms',
            }}
          >
            {value !== 0 ? value : state.notes[i] !== 0 ? <Notes mask={state.notes[i]} /> : null}
          </button>
        );
      })}
    </div>
  );
}

function Notes({ mask }: { mask: number }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        inset: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        fontSize: 'clamp(7px, 2.4cqw, 12px)',
        lineHeight: 1,
        color: 'var(--ink-3)',
      }}
    >
      {Array.from({ length: 9 }, (_, k) => (
        <span key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {mask & (1 << (k + 1)) ? k + 1 : ''}
        </span>
      ))}
    </span>
  );
}

// ─── Controls + pad ─────────────────────────────────────────────────────

function Controls({ state, dispatch }: { state: GameState; dispatch: (a: GameAction) => void }) {
  const playing = state.status === 'playing';
  const btn: CSSProperties = { flex: 1, justifyContent: 'center' };
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button style={btn} size="md" disabled={!playing || state.history.length === 0} onClick={() => dispatch({ type: 'undo' })} title="Undo (U)">
        Undo
      </Button>
      <Button style={btn} size="md" disabled={!playing} onClick={() => dispatch({ type: 'erase' })} title="Erase (⌫)">
        Erase
      </Button>
      <Button
        style={btn}
        size="md"
        variant={state.notesMode ? 'soft' : 'outline'}
        aria-pressed={state.notesMode}
        disabled={!playing}
        onClick={() => dispatch({ type: 'toggleNotesMode' })}
        leading={<Icon name="edit" size={12} />}
        title="Pencil marks (N)"
      >
        Notes
      </Button>
      <Button style={btn} size="md" disabled={!playing} onClick={() => dispatch({ type: 'hint' })} leading={<Icon name="sparkle" size={12} />} title="Reveal a cell (H)">
        Hint
      </Button>
    </div>
  );
}

interface NumberPadProps {
  counts: number[];
  selectedDigit: number;
  activeDigit: number | null;
  notesMode: boolean;
  dispatch: (a: GameAction) => void;
}

function NumberPad({ counts, selectedDigit, activeDigit, notesMode, dispatch }: NumberPadProps) {
  return (
    <div
      role="group"
      aria-label="Digits"
      style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 4, padding: 6 }}
    >
      {Array.from({ length: 9 }, (_, k) => k + 1).map(d => {
        const remaining = 9 - counts[d];
        const done = remaining <= 0;
        const sticky = d === activeDigit;
        const active = sticky || d === selectedDigit;
        return (
          <button
            key={d}
            type="button"
            onClick={() => dispatch({ type: 'pickDigit', digit: d })}
            aria-pressed={sticky}
            aria-label={`${notesMode ? 'Note' : 'Enter'} ${d}, ${remaining} remaining`}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              minHeight: 48,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              background: sticky ? 'var(--accent)' : active ? 'var(--accent-soft)' : 'var(--surface-2)',
              color: sticky ? 'var(--accent-contrast)' : done ? 'var(--ink-muted)' : active ? 'var(--accent-ink)' : 'var(--ink)',
              boxShadow: sticky ? '0 0 0 2px var(--accent-soft)' : 'inset 0 0 0 1px var(--border-strong), inset 0 1px 0 var(--key-highlight)',
              opacity: done ? 0.55 : 1,
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            {d}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: sticky ? 'inherit' : 'var(--ink-muted)', opacity: sticky ? 0.8 : 1 }}>
              {done ? '✓' : remaining}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function WinCard({ state, onPlayAgain }: { state: GameState; onPlayAgain: () => void }) {
  return (
    <div
      role="status"
      style={{
        ...card,
        borderColor: 'var(--positive)',
        background: 'var(--positive-tint)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--positive)', fontWeight: 600 }}>
        <Icon name="check" size={16} />
        Solved!
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
        {DIFFICULTY_LABEL[state.difficulty]} in{' '}
        <span style={{ fontFamily: 'var(--font-mono)' }}>{formatTime(state.elapsed)}</span>
        {state.hintsUsed > 0 ? ` with ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ', no hints'}.
      </div>
      <Button variant="primary" size="md" onClick={onPlayAgain} style={{ alignSelf: 'flex-start' }}>
        Play again
      </Button>
    </div>
  );
}
