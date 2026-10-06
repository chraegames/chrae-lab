import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ToolShell } from '../../components/layout/ToolShell';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';
import { ConfirmDialog } from '../../components/storyline/ConfirmDialog';
import { useIsMobile } from '../../hooks/useIsMobile';
import { bySlug } from '../../site/manifest';
import { track } from '../../utils/analytics';
import { MAGIC_TOWER_LANG_KEY, safeSetItem } from '../../utils/persistence';
import { Canvas } from './components/Canvas';
import { DPad } from './components/DPad';
import { FlyDialog, HelpDialog, LoopSelect, Modal, NpcDialog, PerkDraft, SaveDialog } from './components/Dialogs';
import { Ledger } from './components/Ledger';
import { Manual } from './components/Manual';
import { SidePanel } from './components/SidePanel';
import { Toolbar, type ToolId } from './components/Toolbar';
import { emptyTower, hasZone, heroForZone, generateZoneAsync } from './generate';
import { currentFloor, diffOf, gameReducer, planRoute, previewDamage, type GameAction, type GameState } from './game';
import { previewRoute, type LedgerPreview } from './ledger';
import { overlaysFor } from './overlay';
import { randomSeed } from './rng';
import { deleteSlot, loadMeta, loadSlots, saveMeta, saveSlot, type SlotId } from './save';
import { loopName, monsterName, msg, t, type Lang } from './strings';
import { MT_STYLES } from './styles';
import { ZONES, zoneOf, type Dir, type Meta, type PerkId, type Run } from './types';
import type { Fx } from './render';

const entry = bySlug('magic-tower');

type Dialog = null | 'loop' | 'save' | 'load' | 'fly' | 'help' | 'manual' | 'breach';

function loadLang(): Lang {
  try {
    const v = localStorage.getItem(MAGIC_TOWER_LANG_KEY);
    if (v === 'zh' || v === 'en') return v;
    return typeof navigator !== 'undefined' && /^zh/i.test(navigator.language) ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

function useKey(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
}

export default function App() {
  const isMobile = useIsMobile();
  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [meta, setMeta] = useState<Meta>(() => loadMeta());
  const [game, dispatch] = useReducer(gameReducer, null as unknown as GameState);
  const [dialog, setDialog] = useState<Dialog>('loop');
  const [building, setBuilding] = useState<{ zone: number; total: number } | null>(null);
  const [preview, setPreview] = useState<LedgerPreview | null>(null);
  const [hover, setHover] = useState(-1);
  const [floats, setFloats] = useState<Fx['floats']>([]);
  const [tool, setTool] = useState<'bomb' | 'pickaxe' | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const slotsRef = useRef(loadSlots());
  const genToken = useRef(0);

  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = MT_STYLES;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  const toggleLang = useCallback(() => {
    setLang(l => {
      const next: Lang = l === 'en' ? 'zh' : 'en';
      safeSetItem(MAGIC_TOWER_LANG_KEY, next);
      return next;
    });
  }, []);

  // ─── Zone generation (worker) ───────────────────────────────────────
  const ensureZone = useCallback(async (state: GameState, zone: number): Promise<void> => {
    if (zone >= ZONES || hasZone(state.tower, zone)) return;
    const token = ++genToken.current;
    setBuilding({ zone, total: ZONES });
    try {
      const tower = await generateZoneAsync(state.tower, zone, heroForZone(state.tower, zone, state.run.hero.perks));
      if (token !== genToken.current) return;
      dispatch({ type: 'setTower', tower });
    } finally {
      if (token === genToken.current) setBuilding(null);
    }
  }, []);

  const startRun = useCallback(async (loop: number, seed = randomSeed()) => {
    const tower = emptyTower(seed, loop);
    const token = ++genToken.current;
    setBuilding({ zone: 0, total: ZONES });
    setDialog(null);
    try {
      const t2 = await generateZoneAsync(tower, 0, heroForZone(tower, 0, []));
      if (token !== genToken.current) return;
      dispatch({ type: 'newRun', seed, loop, tower: t2 });
      track('mt_run_started', { loop });
    } finally {
      if (token === genToken.current) setBuilding(null);
    }
  }, []);

  // Autosave + records.
  const lastFloor = useRef(0);
  useEffect(() => {
    if (!game) return;
    const ok = saveSlot('auto', game.run);
    slotsRef.current = loadSlots();
    if (!ok) queueMicrotask(() => setSaveFailed(true));
    if (game.run.floor !== lastFloor.current) {
      lastFloor.current = game.run.floor;
      const rec = meta.records[game.run.loop] ?? { bestFloor: 0, clears: 0 };
      if (game.run.floor > rec.bestFloor) {
        const next = { ...meta, records: { ...meta.records, [game.run.loop]: { ...rec, bestFloor: game.run.floor } } };
        setMeta(next);
        saveMeta(next);
      }
    }
    if (game.run.status === 'won') {
      const rec = meta.records[game.run.loop] ?? { bestFloor: 99, clears: 0 };
      if (meta.unlockedLoop <= game.run.loop || rec.clears === 0) {
        const next: Meta = { ...meta, unlockedLoop: Math.max(meta.unlockedLoop, Math.min(10, game.run.loop + 1)), records: { ...meta.records, [game.run.loop]: { ...rec, bestFloor: 99, clears: rec.clears + 1 } } };
        setMeta(next);
        saveMeta(next);
        track('mt_loop_cleared', { loop: game.run.loop, steps: game.run.steps });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // Next zone once the boss is beaten and the blessing chosen.
  useEffect(() => {
    if (!game || game.run.pendingDraft || building) return;
    const z = zoneOf(game.run.floor);
    if (game.run.bossesDown >= z && !hasZone(game.tower, z + 1) && z + 1 < ZONES) void ensureZone(game, z + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.run.bossesDown, game?.run.pendingDraft, game?.tower, building]);

  // Floating HP deltas.
  const prevHp = useRef<number | null>(null);
  useEffect(() => {
    if (!game) return;
    const hp = game.run.hero.hp;
    if (prevHp.current != null && hp !== prevHp.current) {
      const d = hp - prevHp.current;
      setFloats(f => [...f.filter(x => performance.now() - x.born < 900), { at: game.run.pos, text: d > 0 ? `+${d}` : `${d}`, color: d > 0 ? '#7ee787' : '#ff6b6b', born: performance.now() }]);
    }
    prevHp.current = hp;
  }, [game]);

  const send = useCallback((a: GameAction) => {
    setPreview(null);
    dispatch(a);
  }, []);

  const overlays = useMemo(() => (game ? overlaysFor(game) : new Map()), [game]);

  const onTap = useCallback(
    (tile: number) => {
      if (!game || tile < 0 || game.run.status !== 'playing' || game.run.pendingDraft) return;
      if (preview && preview.target === tile) {
        send({ type: 'walkPath', path: preview.path });
        return;
      }
      if (tile === game.run.pos) {
        send({ type: 'useTile' });
        return;
      }
      const path = planRoute(game, tile);
      if (!path.length) {
        setPreview(null);
        return;
      }
      setPreview(previewRoute(game, tile, path, lang));
    },
    [game, preview, send, lang],
  );

  const move = useCallback(
    (d: Dir) => {
      if (!game) return;
      if (tool) {
        send({ type: tool, dir: d });
        setTool(null);
        return;
      }
      send({ type: 'move', dir: d });
    },
    [game, tool, send],
  );

  const toolbar = useCallback(
    (what: ToolId) => {
      switch (what) {
        case 'manual': setDialog(d => (d === 'manual' ? null : 'manual')); break;
        case 'fly': setDialog('fly'); break;
        case 'breach': setDialog('breach'); break;
        case 'save': setDialog('save'); break;
        case 'load': setDialog('load'); break;
        case 'undo': send({ type: 'undo' }); break;
        case 'help': setDialog('help'); break;
        case 'lang': toggleLang(); break;
        case 'holyWater': send({ type: 'holyWater' }); break;
        case 'bomb': setTool('bomb'); break;
        case 'pickaxe': setTool('pickaxe'); break;
        case 'towers': setConfirmNew(true); break;
      }
    },
    [send, toggleLang],
  );

  useKey(e => {
    if (!game || building) return;
    const tgt = e.target as HTMLElement | null;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
    const k = e.key;
    if (dialog) {
      if ((k === 'm' || k === 'M') && dialog === 'manual') setDialog(null);
      return;
    }
    const dirs: Record<string, Dir> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, k: 0, l: 1, j: 2, h: 3, W: 0, D: 1, S: 2, A: 3 };
    if (k in dirs && !(e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      move(dirs[k]);
      return;
    }
    if (game.run.pendingDraft) return;
    if (k === 'Enter' || k === ' ') { e.preventDefault(); if (preview) send({ type: 'walkPath', path: preview.path }); else send({ type: 'useTile' }); }
    else if (k === 'z' || k === 'Z' || k === 'u' || k === 'U') send({ type: 'undo' });
    else if (k === 'b' || k === 'B') { if (game.run.hero.stones > 0) setDialog('breach'); }
    else if (k === 'f' || k === 'F') { if (game.run.hero.teleporter) setDialog('fly'); }
    else if (k === 'm' || k === 'M') setDialog('manual');
    else if (k === 'S' || (k === 's' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); setDialog('save'); }
    else if (k === 'L' || (k === 'l' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); setDialog('load'); }
    else if (k === '?') setDialog('help');
    else if (k === 'Escape') { setPreview(null); setTool(null); if (game.npcOpen != null) send({ type: 'closeNpc' }); }
  });

  const doSave = useCallback(
    (id: SlotId) => {
      if (!game) return;
      const ok = saveSlot(id, game.run);
      slotsRef.current = loadSlots();
      if (!ok) setSaveFailed(true);
      setDialog(null);
    },
    [game],
  );

  const doLoad = useCallback(async (id: SlotId) => {
    const s = slotsRef.current[id];
    if (!s) return;
    setDialog(null);
    const run: Run = { ...s.run, history: [] };
    let tower = emptyTower(run.seed, run.loop);
    const token = ++genToken.current;
    const need = zoneOf(run.floor) + (run.bossesDown >= zoneOf(run.floor) ? 1 : 0);
    try {
      for (let z = 0; z <= Math.min(ZONES - 1, need); z++) {
        setBuilding({ zone: z, total: ZONES });
        const perks = run.hero.perks.slice(0, z);
        tower = await generateZoneAsync(tower, z, heroForZone(tower, z, perks));
        if (token !== genToken.current) return;
      }
      dispatch({ type: 'load', run, tower });
    } finally {
      if (token === genToken.current) setBuilding(null);
    }
  }, []);

  const hoverInfo = useMemo(() => {
    if (!game || hover < 0) return null;
    const f = currentFloor(game);
    const m = f.mons[hover];
    if (!m || diffOf(game.run, f.n).killed.includes(hover)) return null;
    const dmg = previewDamage(game, hover);
    return `${monsterName(m.id, lang)}: ${dmg == null ? t(lang, 'cannotFight') : `−${dmg} ${t(lang, 'hp')}`}`;
  }, [game, hover, lang]);

  const toastText = game?.toast ? msg(game.toast, lang) : null;

  return (
    <ToolShell entry={entry} maxWidth={1180} rightSlot={<Button size="sm" variant="soft" onClick={() => (game ? setConfirmNew(true) : setDialog('loop'))} leading={<Icon name="grid" size={12} />}>{t(lang, 'towers')}</Button>}>
      {saveFailed && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: 'var(--negative)', background: 'var(--negative-soft)', border: '1px solid var(--negative)', borderRadius: 'var(--radius-md)' }}>
          <Icon name="warning" size={14} />
          <span style={{ flex: 1 }}>Couldn't save — storage is full or disabled.</span>
          <Button variant="ghost" size="sm" aria-label="Dismiss" onClick={() => setSaveFailed(false)} leading={<Icon name="close" size={12} />} />
        </div>
      )}

      {!game && !building && (
        <div className="mt-progress">
          <p>{t(lang, 'chooseToBegin')}</p>
          <Button variant="primary" onClick={() => setDialog('loop')}>{t(lang, 'towers')}</Button>
          {slotsRef.current.auto && <Button style={{ marginLeft: 8 }} onClick={() => setDialog('load')}>{t(lang, 'load')}</Button>}
          <Button style={{ marginLeft: 8 }} variant="ghost" onClick={toggleLang}>{t(lang, 'lang')}</Button>
        </div>
      )}

      {game && (
        <div className={`mt-frame${isMobile ? ' mt-mobile' : ''}`}>
          <SidePanel state={game} lang={lang} />
          <div className="mt-board">
            <Canvas state={game} route={preview?.path ?? []} hover={hover} floats={floats} overlays={overlays} onHover={setHover} onTap={onTap} />
            {(toastText || hoverInfo || tool) && !preview && <div className="mt-toast">{tool ? t(lang, 'chooseDir', { s: t(lang, tool) }) : hoverInfo ?? toastText}</div>}
            {preview && <Ledger state={game} lang={lang} preview={preview} onGo={() => send({ type: 'walkPath', path: preview.path })} onCancel={() => setPreview(null)} />}
          </div>
          <Toolbar state={game} lang={lang} on={toolbar} />
        </div>
      )}
      {game && isMobile && <DPad onMove={move} />}

      {building && (
        <Modal title={t(lang, 'building')}>
          <p className="mt-progress">{t(lang, 'buildingZone', { n: building.zone + 1, m: building.total })}</p>
        </Modal>
      )}
      {dialog === 'loop' && <LoopSelect lang={lang} meta={meta} onStart={l => void startRun(l)} onClose={game ? () => setDialog(null) : undefined} />}
      {game && game.run.pendingDraft && !building && <PerkDraft lang={lang} offered={game.run.pendingDraft} onPick={(id: PerkId) => { send({ type: 'pickPerk', id }); track('mt_perk', { id }); }} />}
      {dialog === 'save' && game && <SaveDialog lang={lang} mode="save" slots={slotsRef.current} onPick={doSave} onDelete={id => { deleteSlot(id); slotsRef.current = loadSlots(); }} onClose={() => setDialog(null)} />}
      {dialog === 'load' && <SaveDialog lang={lang} mode="load" slots={slotsRef.current} onPick={id => void doLoad(id)} onDelete={id => { deleteSlot(id); slotsRef.current = loadSlots(); setDialog(null); }} onClose={() => setDialog(null)} />}
      {dialog === 'fly' && game && <FlyDialog lang={lang} state={game} onFly={n => { send({ type: 'teleport', floor: n }); setDialog(null); }} onClose={() => setDialog(null)} />}
      {dialog === 'help' && <HelpDialog lang={lang} onClose={() => setDialog(null)} />}
      {dialog === 'manual' && game && (
        <Modal title={t(lang, 'monsterManual')} onClose={() => setDialog(null)} wide>
          <Manual state={game} lang={lang} highlight={-1} onHover={() => undefined} />
        </Modal>
      )}
      {dialog === 'breach' && game && (
        <Modal title={t(lang, 'breachTitle')} onClose={() => setDialog(null)}>
          <p>{t(lang, 'breachIntro')}</p>
          <div className="mt-btnrow">
            <Button variant="primary" onClick={() => { send({ type: 'breach', dir: 'up' }); setDialog(null); }}>{t(lang, 'ceilingBtn')}</Button>
            <Button variant="primary" onClick={() => { send({ type: 'breach', dir: 'down' }); setDialog(null); }}>{t(lang, 'floorBtn')}</Button>
          </div>
        </Modal>
      )}
      {game && game.npcOpen != null && (
        <NpcDialog lang={lang} state={game} onShop={w => send({ type: 'shop', what: w })} onLocksmith={c => send({ type: 'locksmith', color: c })} onClose={() => send({ type: 'closeNpc' })} />
      )}
      {game && game.run.status === 'won' && (
        <Modal title={t(lang, 'won')}>
          <p>{t(lang, 'wonBody', { s: loopName(game.run.loop, lang), n: game.run.steps })} {t(lang, game.run.loop < 10 ? 'nextOpen' : 'nothingAbove')}</p>
          <Button variant="primary" onClick={() => setDialog('loop')}>{t(lang, 'towers')}</Button>
        </Modal>
      )}
      <ConfirmDialog
        open={confirmNew}
        title={t(lang, 'leaveTitle')}
        subtitle={t(lang, 'leaveSub')}
        message={<>{t(lang, 'leaveBody')}</>}
        confirmLabel={t(lang, 'openTowers')}
        cancelLabel={t(lang, 'cancel')}
        icon="grid"
        onClose={() => setConfirmNew(false)}
        onConfirm={() => { setConfirmNew(false); setDialog('loop'); }}
      />
    </ToolShell>
  );
}
