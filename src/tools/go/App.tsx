import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ToolShell } from '../../components/layout/ToolShell';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';
import { ConfirmDialog } from '../../components/storyline/ConfirmDialog';
import { useIsMobile } from '../../hooks/useIsMobile';
import { bySlug } from '../../site/manifest';
import { track } from '../../utils/analytics';
import { secureRandomInt } from '../bingo/bingo';
import { Board } from './Board';
import {
  BLACK,
  BOARD_SIZES,
  WHITE,
  colorName,
  loadPreferredSize,
  savePreferredSize,
  toCoord,
  type BoardSize,
  type Color,
} from './go';
import {
  filterCodeInput,
  initialSession,
  makeRoomCode,
  normalizeCode,
  statusText,
  step,
  type Ctx,
  type Effect,
  type Event,
  type Session,
} from './match';
import { createTransport, wantsLocalTransport, type Transport } from './net';
import { GO_STYLES } from './styles';

const entry = bySlug('go');

// ─── Styles ─────────────────────────────────────────────────────────────

const card: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-card)',
};

const mono: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--ink-muted)',
};

const label: CSSProperties = {
  ...mono,
  fontSize: 11.5,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-index)',
};

function randomId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function shareLink(code: string, local: boolean): string {
  const url = new URL(entry.path, window.location.origin);
  url.searchParams.set('room', code);
  if (local) url.searchParams.set('local', '1');
  return url.toString();
}

// ─── App ────────────────────────────────────────────────────────────────

interface Boot {
  size: BoardSize;
  /** Room code from ?room=CODE, if any. */
  code: string | null;
  local: boolean;
}

function boot(): Boot {
  const params = new URLSearchParams(window.location.search);
  return {
    size: loadPreferredSize(),
    code: normalizeCode(params.get('room') ?? ''),
    local: wantsLocalTransport(window.location.search),
  };
}

export default function App() {
  const isMobile = useIsMobile();
  const [initial] = useState(boot);
  const [size, setSize] = useState<BoardSize>(initial.size);
  const [session, setSession] = useState<Session>(() => initialSession(initial.size));
  const [busy, setBusy] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);

  const sessionRef = useRef(session);
  const transportRef = useRef<Transport | null>(null);
  const transportPromise = useRef<Promise<Transport> | null>(null);

  const runEffects = useCallback((effects: Effect[], t: Transport | null) => {
    for (const eff of effects) {
      switch (eff.kind) {
        case 'join':
          t?.join(eff.room);
          break;
        case 'leave':
          t?.leave();
          break;
        case 'send':
          t?.send(eff.msg, eff.to);
          break;
        case 'matched':
          track('go_matched', { mode: eff.mode, size: eff.size });
          break;
        case 'finished':
          track('go_finished', { size: eff.size, result: eff.result });
          break;
      }
    }
  }, []);

  const dispatch = useCallback(
    (e: Event) => {
      const t = transportRef.current;
      const ctx: Ctx = {
        selfId: t?.selfId ?? '',
        newId: randomId,
        coin: () => (secureRandomInt(2) === 0 ? BLACK : WHITE),
      };
      const r = step(sessionRef.current, e, ctx);
      sessionRef.current = r.session;
      setSession(r.session);
      runEffects(r.effects, t);
    },
    [runEffects],
  );

  /** Loads the transport on first use (Trystero is a lazy chunk) and wires its callbacks to dispatch. */
  const ensureTransport = useCallback((): Promise<Transport> => {
    if (!transportPromise.current) {
      transportPromise.current = createTransport(initial.local).then(t => {
        t.onPeerJoin = id => dispatch({ type: 'peerJoin', peerId: id });
        t.onPeerLeave = id => dispatch({ type: 'peerLeave', peerId: id });
        t.onMessage = (msg, from) => dispatch({ type: 'message', from, msg });
        transportRef.current = t;
        return t;
      });
    }
    return transportPromise.current;
  }, [dispatch, initial.local]);

  /** Start a search/host/join: waits for the transport, then dispatches. */
  const start = useCallback(
    (e: Event) => {
      setNetError(null);
      setBusy(true);
      ensureTransport()
        .then(() => dispatch(e))
        .catch(err => setNetError(err instanceof Error ? err.message : 'Could not start the connection.'))
        .finally(() => setBusy(false));
    },
    [dispatch, ensureTransport],
  );

  // Auto-join a shared room link (once — StrictMode re-runs effects in dev,
  // and a second join would leave and re-enter the room, which the host
  // would see as a disconnect); leave the room when the page unmounts.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (initial.code && !autoJoined.current) {
      autoJoined.current = true;
      const code = initial.code;
      ensureTransport()
        .then(() => dispatch({ type: 'join', code }))
        .catch(() => {});
    }
    return () => transportRef.current?.leave();
  }, [dispatch, ensureTransport, initial.code]);

  const chooseSize = (s: BoardSize) => {
    setSize(s);
    savePreferredSize(s);
  };

  const copyLink = () => {
    if (!session.code) return;
    navigator.clipboard
      ?.writeText(shareLink(session.code, initial.local))
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  };

  const joinTyped = () => {
    const code = normalizeCode(codeInput);
    if (code) start({ type: 'join', code });
  };

  const game = session.game;
  const myTurn = session.phase === 'playing' && game != null && game.turn === session.me;
  const maxWidth = isMobile ? 560 : 720;

  return (
    <ToolShell
      entry={entry}
      maxWidth={maxWidth}
      rightSlot={
        initial.local ? (
          <span style={{ ...mono, padding: '3px 8px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-pill)' }}>
            local dev
          </span>
        ) : undefined
      }
    >
      <style>{GO_STYLES}</style>

      {netError && (
        <Alert onDismiss={() => setNetError(null)}>{netError}</Alert>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 18 }}>
        {session.phase === 'setup' && (
          <Setup
            size={size}
            busy={busy}
            codeInput={codeInput}
            isMobile={isMobile}
            onSize={chooseSize}
            onQuick={() => start({ type: 'search', size })}
            onHost={() => start({ type: 'host', size, code: makeRoomCode(secureRandomInt) })}
            onCodeInput={setCodeInput}
            onJoin={joinTyped}
          />
        )}

        {(session.phase === 'searching' || session.phase === 'inviting' || session.phase === 'connecting') && (
          <Waiting session={session} copied={copied} local={initial.local} onCopy={copyLink} onCancel={() => dispatch({ type: 'cancel' })} />
        )}

        {(session.phase === 'playing' || session.phase === 'ended') && game && session.me && (
          <>
            <ScoreBar session={session} isMobile={isMobile} />
            <div style={{ width: '100%', maxWidth: 640, margin: '0 auto' }}>
              <Board
                size={game.size}
                board={game.board}
                lastMove={game.lastMove}
                koPoint={myTurn ? game.koPoint : null}
                active={myTurn ? session.me : null}
                onPlay={idx => dispatch({ type: 'play', idx })}
              />
            </div>
            {session.phase === 'playing' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Button variant="outline" disabled={!myTurn} onClick={() => dispatch({ type: 'pass' })}>
                  Pass
                </Button>
                <Button variant="ghost" onClick={() => setConfirmResign(true)}>
                  Resign
                </Button>
                <span style={{ ...mono, marginLeft: 'auto' }}>
                  {game.lastMove != null
                    ? `Last: ${toCoord(game.lastMove, game.size)}`
                    : game.consecutivePasses > 0
                      ? 'Last: pass'
                      : `Move ${game.moveNumber + 1}`}
                </span>
              </div>
            ) : (
              <div style={{ ...card, padding: isMobile ? 16 : 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={label}>Game over</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: isMobile ? 20 : 24, color: 'var(--ink)', lineHeight: 1.25 }}>
                  {statusText(session)}
                </div>
                <div>
                  <Button variant="primary" onClick={() => dispatch({ type: 'reset' })} leading={<Icon name="undo" size={13} />}>
                    Play again
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {session.phase === 'ended' && !game && (
          <div style={{ ...card, padding: isMobile ? 16 : 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={label}>Connection lost</div>
            <div style={{ fontSize: 15, color: 'var(--ink-2)' }}>{statusText(session)}</div>
            <div>
              <Button variant="primary" onClick={() => dispatch({ type: 'reset' })}>
                Back to start
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmResign}
        title="Resign this game?"
        subtitle="Your opponent will be recorded as the winner"
        message={
          <>
            You are playing <strong>{session.me ? colorName(session.me) : ''}</strong>. Resigning ends the game immediately.
          </>
        }
        confirmLabel="Resign"
        onClose={() => setConfirmResign(false)}
        onConfirm={() => {
          setConfirmResign(false);
          dispatch({ type: 'resign' });
        }}
      />
    </ToolShell>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────

function Alert({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
  return (
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
      <span style={{ flex: 1 }}>{children}</span>
      <Button variant="ghost" size="sm" aria-label="Dismiss" onClick={onDismiss} leading={<Icon name="close" size={12} />} />
    </div>
  );
}

interface SetupProps {
  size: BoardSize;
  busy: boolean;
  codeInput: string;
  isMobile: boolean;
  onSize: (s: BoardSize) => void;
  onQuick: () => void;
  onHost: () => void;
  onCodeInput: (v: string) => void;
  onJoin: () => void;
}

function Setup({ size, busy, codeInput, isMobile, onSize, onQuick, onHost, onCodeInput, onJoin }: SetupProps) {
  const pad = isMobile ? 16 : 22;
  const canJoin = normalizeCode(codeInput) != null;
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
      <section style={{ padding: pad, display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={label}>Board</div>
        <div className="go-seg" role="group" aria-label="Board size">
          {BOARD_SIZES.map(s => (
            <button key={s} type="button" aria-pressed={s === size} onClick={() => onSize(s)}>
              {s}×{s}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          9×9 is a quick game of about ten minutes. 19×19 is the full board.
        </p>
      </section>

      <section style={{ padding: pad, display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={label}>Quick match</div>
        <div>
          <Button variant="primary" size="lg" onClick={onQuick} disabled={busy} leading={<Icon name="play" size={13} />}>
            Find an opponent
          </Button>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          Pairs you with the first other person waiting on a {size}×{size} board. Colours are drawn at random.
        </p>
      </section>

      <section style={{ padding: pad, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={label}>Play with a friend</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="outline" onClick={onHost} disabled={busy}>
            Create a room
          </Button>
          <span style={mono}>or</span>
          <form
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            onSubmit={e => {
              e.preventDefault();
              if (canJoin) onJoin();
            }}
          >
            <input
              className="go-code-input"
              value={codeInput}
              onChange={e => onCodeInput(filterCodeInput(e.target.value))}
              placeholder="CODE"
              aria-label="Room code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <Button type="submit" variant="outline" disabled={!canJoin || busy}>
              Join
            </Button>
          </form>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          Create a room to get a four-letter code and a link to send. The room host picks the board size.
        </p>
      </section>
    </div>
  );
}

interface WaitingProps {
  session: Session;
  copied: boolean;
  local: boolean;
  onCopy: () => void;
  onCancel: () => void;
}

function Waiting({ session, copied, local, onCopy, onCancel }: WaitingProps) {
  const hosting = session.mode === 'host' && session.code;
  return (
    <div style={{ ...card, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="go-pulse" aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
        <span style={{ fontSize: 15, color: 'var(--ink)' }}>{statusText(session)}</span>
      </div>

      {hosting && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={label}>Room code</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 34, letterSpacing: '0.22em', color: 'var(--ink)', lineHeight: 1 }}>
            {session.code}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <code style={{ ...mono, wordBreak: 'break-all' }}>{shareLink(session.code!, local)}</code>
            <Button variant="soft" size="sm" onClick={onCopy} leading={<Icon name={copied ? 'check' : 'upload'} size={12} />}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
            Your friend opens the link, or enters the code on this page. The game starts as soon as they connect.
          </p>
        </div>
      )}

      {session.mode === 'quick' && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          Keep this tab open. If nobody shows up, create a room and send a friend the link instead.
        </p>
      )}

      <div>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function StoneDot({ color }: { color: Color }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: color === BLACK ? 'var(--go-black)' : 'var(--go-white)',
        border: `1px solid ${color === BLACK ? 'var(--go-black-edge)' : 'var(--go-white-edge)'}`,
        verticalAlign: -1,
      }}
    />
  );
}

function ScoreBar({ session, isMobile }: { session: Session; isMobile: boolean }) {
  const game = session.game!;
  const me = session.me!;
  const myTurn = session.phase === 'playing' && game.turn === me;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 10 : 16,
        flexWrap: 'wrap',
        padding: '10px 14px',
        ...card,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}>
        <StoneDot color={me} />
        You play {colorName(me)}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: myTurn ? 600 : 400,
          color: myTurn ? 'var(--accent-ink)' : 'var(--ink-3)',
        }}
      >
        {statusText(session)}
      </span>
      <span style={{ ...mono, marginLeft: 'auto', display: 'inline-flex', gap: 12 }}>
        <span>
          <StoneDot color={BLACK} /> {game.captures[0]}
        </span>
        <span>
          <StoneDot color={WHITE} /> {game.captures[1]}
        </span>
        <span title="Captures">caps</span>
      </span>
    </div>
  );
}
