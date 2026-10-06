import { useCallback, useEffect, useRef, useState } from 'react';
import { ToolShell } from '../../components/layout/ToolShell';
import { useIsMobile } from '../../hooks/useIsMobile';
import { bySlug } from '../../site/manifest';
import { track } from '../../utils/analytics';
import { TICKS_PER_MONTH } from './constants';
import { createSimClient, type SimClient } from './client';
import type { Snapshot, SnapshotLayers } from './protocol';
import type { InputHandlers } from './render/input';
import type { CityRenderer, TerrainData } from './render/renderer';
import { Viewport } from './render/Viewport';
import { randomSeed } from './rng';
import { clearSave, loadSave, writeSave } from './save';
import { Advisor } from './ui/Advisor';
import { BudgetPanel } from './ui/BudgetPanel';
import { DebugPanel } from './ui/DebugPanel';
import { Inspector } from './ui/Inspector';
import { Legend } from './ui/Legend';
import { MilestonePanel } from './ui/MilestonePanel';
import { NewCityDialog } from './ui/NewCityDialog';
import { NoticeBanner } from './ui/NoticeBanner';
import { Onboarding } from './ui/Onboarding';
import { onboardingSteps } from './ui/onboardingSteps';
import { formatMoney } from './ui/format';
import { loadPrefs, savePrefs, type CityPrefs } from './ui/prefs';
import { StatsPanel } from './ui/StatsPanel';
import { CITY_STYLES } from './ui/styles';
import { CityIcon } from './ui/icons';
import { Toolbar } from './ui/Toolbar';
import { TopBar, type ViewPrefs } from './ui/TopBar';
import { canPlopAt, plopRect } from './ui/validity';
import { isLocalHost } from '../../utils/env';
import { densifyActions, findSite, serviceActions, townActions } from './sim/scenario';
import { MILESTONES } from './sim/milestones';
import { type Action, type ActionFail, type AdvisorMsg, type Density, type HudStats, type Notice, type OverlayKind, type Rect, type Speed, type Tool, type XY } from './types';

const entry = bySlug('city');
const HUD_INTERVAL = 250;
const SAVE_INTERVAL = 5000;

const FAIL_TEXT: Record<ActionFail, string> = {
  funds: 'Not enough money.',
  terrain: 'Cannot build there: water or too steep.',
  occupied: 'That spot is not free.',
  bounds: 'Out of bounds.',
  noop: 'Nothing to do there.',
  locked: 'Not unlocked yet — grow the city to the next milestone.',
  water: 'This must be built on the shore, touching water.',
  road: 'This needs a road touching it.',
};

type Sheet = 'budget' | 'stats' | 'milestones' | null;

function modeFor(tool: Tool): 'pan' | 'point' | 'rect' | 'line' {
  switch (tool.kind) {
    case 'inspect':
      return 'pan';
    case 'road':
    case 'avenue':
    case 'line':
    case 'pipe':
      return 'line';
    case 'plop':
    case 'disaster':
      return 'point';
    default:
      return 'rect';
  }
}

export default function App() {
  const isMobile = useIsMobile();
  const [terrain, setTerrain] = useState<TerrainData | null>(null);
  const [hud, setHud] = useState<HudStats | null>(null);
  const [layers, setLayers] = useState<SnapshotLayers | null>(null);
  const [messages, setMessages] = useState<AdvisorMsg[]>([]);
  const [tool, setTool] = useState<Tool>({ kind: 'inspect' });
  const [density, setDensity] = useState<Density>(1);
  const [overlay, setOverlay] = useState<OverlayKind>('none');
  const [speed, setSpeed] = useState<Speed>(1);
  const [paint, setPaint] = useState(false);
  const [selected, setSelected] = useState<XY | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [spend, setSpend] = useState<{ id: number; amount: number } | null>(null);
  const [prefs, setPrefs] = useState<CityPrefs>(() => loadPrefs());
  const [debugOpen, setDebugOpen] = useState(false);
  const debugAllowed = isLocalHost() || (typeof window !== 'undefined' && /[?&]debug=1/.test(window.location.search));
  const [confirmNew, setConfirmNew] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const clientRef = useRef<SimClient | null>(null);
  const rendererRef = useRef<CityRenderer | null>(null);
  const toolRef = useRef(tool);
  const paintRef = useRef(paint);
  const terrainRef = useRef<TerrainData | null>(null);
  const hoverRef = useRef<XY | null>(null);
  const lastHudAt = useRef(0);
  const lastSaveAt = useRef(0);
  const lastSavedTick = useRef(-1);
  const toastTimer = useRef(0);

  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = CITY_STYLES;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  useEffect(() => {
    toolRef.current = tool;
    rendererRef.current?.setCursor(null);
  }, [tool]);
  useEffect(() => {
    paintRef.current = paint;
  }, [paint]);
  useEffect(() => {
    rendererRef.current?.setOverlay(overlay);
  }, [overlay]);
  useEffect(() => {
    const r = rendererRef.current;
    if (r) {
      r.setDayCycle(prefs.dayCycle);
      r.setMarkers(prefs.markers);
    }
  }, [prefs, terrain]);
  const updatePrefs = useCallback((p: CityPrefs) => {
    setPrefs(p);
    savePrefs(p);
  }, []);
  const onViewPrefs = useCallback((v: ViewPrefs) => updatePrefs({ ...prefs, ...v }), [prefs, updatePrefs]);

  // milestone banners, one at a time: the head of the queue shows for nine seconds
  const notice = notices[0] ?? null;
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotices(q => q.slice(1)), 9000);
    return () => window.clearTimeout(t);
  }, [notice]);
  const dismissNotice = useCallback(() => setNotices(q => q.slice(1)), []);
  useEffect(() => {
    clientRef.current?.setSpeed(speed);
    if (rendererRef.current) rendererRef.current.speed = speed;
  }, [speed]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const save = useCallback((force = false) => {
    const client = clientRef.current;
    if (!client) return;
    const now = performance.now();
    if (!force && now - lastSaveAt.current < SAVE_INTERVAL) return;
    lastSaveAt.current = now;
    client.requestSave().then(file => {
      if (!writeSave(file)) setSaveFailed(true);
      else track('city_saved');
    });
  }, []);

  // ─── sim client lifecycle ─────────────────────────────────────────
  useEffect(() => {
    const client = createSimClient();
    clientRef.current = client;
    client.onTerrain(t => {
      terrainRef.current = t;
      setTerrain(t);
    });
    client.onError(m => console.error('City sim:', m));
    client.onSnapshot((snap: Snapshot) => {
      const r = rendererRef.current;
      if (r) {
        r.applySnapshot(snap);
        setLayers(r.layers); // stable reference; Inspector re-reads it on every HUD update
      }
      client.recycle(snap.buf);
      const now = performance.now();
      const month = snap.tick % TICKS_PER_MONTH === 0;
      if (month || now - lastHudAt.current >= HUD_INTERVAL || snap.hud.tick === 0) {
        lastHudAt.current = now;
        setHud(snap.hud);
        setMessages(snap.messages);
      }
      if (snap.notices.length) {
        setNotices(q => [...q, ...snap.notices]);
        for (const n of snap.notices) if (n.kind === 'milestone') track('city_milestone', { tier: MILESTONES[snap.hud.milestone]?.name ?? '' });
      }
      if (month && snap.tick !== lastSavedTick.current && snap.tick > 0) {
        lastSavedTick.current = snap.tick;
        save();
        if (snap.tick % (TICKS_PER_MONTH * 12) === 0) track('city_month', { population: snap.hud.totals.population });
      }
    });
    const saved = loadSave();
    if (saved) {
      client.init(saved.seed, saved);
      track('city_loaded');
    } else {
      const seed = randomSeed();
      client.init(seed);
      track('city_started', { seed });
    }
    client.setSpeed(1);
    const onHide = () => {
      if (document.visibilityState === 'hidden') save(true);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      client.dispose();
      clientRef.current = null;
    };
  }, [save]);

  // ─── actions ──────────────────────────────────────────────────────
  const dispatch = useCallback(
    (a: Action) => {
      const client = clientRef.current;
      if (!client) return;
      client.send(a).then(r => {
        if (!r.ok && r.reason) showToast(FAIL_TEXT[r.reason]);
        else if (r.ok && a.type === 'disaster') track('city_disaster', { kind: a.kind });
        else if (r.ok && r.cost > 0) setSpend({ id: r.id, amount: r.cost });
      });
    },
    [showToast],
  );

  const cursorFor = useCallback((t: Tool, a: XY, b: XY): { rect: Rect; ok: boolean } => {
    const r = rendererRef.current;
    const g = terrainRef.current;
    if (t.kind === 'plop') {
      const ok = !!(r && g && r.hasSnapshot && canPlopAt(r.layers, g, t.plop, a));
      return { rect: plopRect(t.plop, a), ok };
    }
    if (t.kind === 'road' || t.kind === 'avenue' || t.kind === 'line' || t.kind === 'pipe') return { rect: { x0: a.x, y0: a.y, x1: b.x, y1: b.y }, ok: true };
    return { rect: { x0: a.x, y0: a.y, x1: b.x, y1: b.y }, ok: true };
  }, []);

  const handlersRef = useRef<InputHandlers>({
    getMode: () => 'pan',
    getPaint: () => false,
    onHover: () => {},
    onTap: () => {},
    onDragPreview: () => {},
    onDragEnd: () => {},
    onDragCancel: () => {},
  });
  useEffect(() => {
    handlersRef.current = {
      getMode: () => modeFor(toolRef.current),
      getPaint: () => paintRef.current,
      onHover: t => {
        hoverRef.current = t;
        const r = rendererRef.current;
        if (!r) return;
        const tool = toolRef.current;
        if (!t || tool.kind === 'inspect') {
          r.setCursor(null);
          return;
        }
        const c = cursorFor(tool, t, t);
        r.setCursor(c.rect, c.ok);
      },
      onTap: t => {
        const tool = toolRef.current;
        switch (tool.kind) {
          case 'inspect':
            setSelected(t);
            break;
          case 'plop':
            dispatch({ type: 'plop', plop: tool.plop, at: t });
            break;
          case 'disaster':
            dispatch({ type: 'disaster', kind: tool.disaster, at: t });
            break;
          case 'road':
            dispatch({ type: 'road', from: t, to: t });
            break;
          case 'avenue':
            dispatch({ type: 'road', from: t, to: t, avenue: true });
            break;
          case 'line':
            dispatch({ type: 'line', from: t, to: t });
            break;
          case 'pipe':
            dispatch({ type: 'pipe', from: t, to: t });
            break;
          case 'zone':
            dispatch({ type: 'zone', zone: tool.zone, density: tool.density, rect: { x0: t.x, y0: t.y, x1: t.x, y1: t.y } });
            break;
          case 'dezone':
            dispatch({ type: 'dezone', rect: { x0: t.x, y0: t.y, x1: t.x, y1: t.y } });
            break;
          case 'bulldoze':
            dispatch({ type: 'bulldoze', rect: { x0: t.x, y0: t.y, x1: t.x, y1: t.y } });
            break;
        }
      },
      onDragPreview: (a, b) => {
        const r = rendererRef.current;
        if (!r) return;
        const tool = toolRef.current;
        if (tool.kind === 'road' || tool.kind === 'avenue' || tool.kind === 'line' || tool.kind === 'pipe') r.setCursorLine(a, b);
        else {
          const c = cursorFor(tool, a, b);
          r.setCursor(c.rect, c.ok);
        }
      },
      onDragEnd: (a, b) => {
        const tool = toolRef.current;
        const rect: Rect = { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
        switch (tool.kind) {
          case 'zone':
            dispatch({ type: 'zone', zone: tool.zone, density: tool.density, rect });
            break;
          case 'dezone':
            dispatch({ type: 'dezone', rect });
            break;
          case 'bulldoze':
            dispatch({ type: 'bulldoze', rect });
            break;
          case 'road':
            dispatch({ type: 'road', from: a, to: b });
            break;
          case 'avenue':
            dispatch({ type: 'road', from: a, to: b, avenue: true });
            break;
          case 'line':
            dispatch({ type: 'line', from: a, to: b });
            break;
          case 'pipe':
            dispatch({ type: 'pipe', from: a, to: b });
            break;
          default:
            break;
        }
        rendererRef.current?.setCursor(null);
      },
      onDragCancel: () => rendererRef.current?.setCursor(null),
    };
  }, [cursorFor, dispatch]);

  const newCity = useCallback(
    (seed: number) => {
      setConfirmNew(false);
      const client = clientRef.current;
      if (!client) return;
      clearSave();
      lastSavedTick.current = -1;
      setHud(null);
      setSelected(null);
      setTerrain(null);
      setSheet(null);
      client.init(seed);
      client.setSpeed(speed);
      track('city_started', { seed });
    },
    [speed],
  );

  // localhost debug hook (drives e2e screenshots and tuning)
  useEffect(() => {
    if (!debugAllowed) return;
    const w = window as unknown as { __city?: unknown };
    w.__city = {
      dispatch: (a: Action) => dispatch(a),
      dispatchAll: (as: Action[]) => as.forEach(a => dispatch(a)),
      fastForward: (ticks: number) => clientRef.current?.fastForward(ticks),
      terrain: () => terrainRef.current,
      layers: () => rendererRef.current?.layers ?? null,
      lookAt: (x: number, z: number, dist: number, yaw = 0.6, pitch = 0.8) => rendererRef.current?.rig.setPose({ tx: x, tz: z, dist, yaw, pitch }, true),
      scenario: { findSite, townActions, serviceActions, densifyActions },
      setSpeed: (s: Speed) => setSpeed(s),
      openDebug: () => setDebugOpen(true),
      openSheet: (k: Sheet) => setSheet(k),
      setOverlay: (k: OverlayKind) => setOverlay(k),
      setTool: (t: Tool) => setTool(t),
      select: (t: XY | null) => setSelected(t),
      setPrefs: (p: Partial<CityPrefs>) => setPrefs(cur => ({ ...cur, ...p })),
      setClock: (t: number) => rendererRef.current?.setClock(t),
      newCity: (seed: number) => newCity(seed),
    };
    return () => {
      delete w.__city;
    };
  }, [dispatch, debugAllowed, newCity]);

  // hotkeys
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case 'Escape':
          setTool({ kind: 'inspect' });
          setSelected(null);
          setSheet(null);
          setDebugOpen(false);
          break;
        case 'l':
          setTool({ kind: 'line' });
          break;
        case 'w':
          setTool({ kind: 'pipe' });
          break;
        case 'm':
          setSheet(k => (k === 'milestones' ? null : 'milestones'));
          break;
        case 'g':
          setSheet(k => (k === 'stats' ? null : 'stats'));
          break;
        case 'f':
          setSheet(k => (k === 'budget' ? null : 'budget'));
          break;
        case '`':
          if (debugAllowed) setDebugOpen(o => !o);
          break;
        case 'r':
          setTool({ kind: 'zone', zone: 1, density });
          break;
        case 'c':
          setTool({ kind: 'zone', zone: 2, density });
          break;
        case 'i':
          setTool({ kind: 'zone', zone: 3, density });
          break;
        case 't':
          setTool({ kind: 'road' });
          break;
        case 'y':
          setTool({ kind: 'avenue' });
          break;
        case 'b':
          setTool({ kind: 'bulldoze' });
          break;
        case 'p':
          setSpeed(s => (s === 0 ? 1 : 0));
          break;
        case '1':
        case '2':
        case '3':
          setSpeed(Number(e.key) as Speed);
          break;
        case '0':
          setSpeed(0);
          break;
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [density, debugAllowed]);

  const onTool = useCallback((t: Tool) => {
    setTool(t);
    setSelected(null);
  }, []);
  const onDensity = useCallback((d: Density) => {
    setDensity(d);
    setTool(t => (t.kind === 'zone' ? { ...t, density: d } : t));
  }, []);


  const seed = terrain?.seed ?? -1;
  const onboardingVisible = !!hud && !isMobile && prefs.onboardingDoneSeed !== seed && hud.milestone === 0 && !onboardingSteps(hud).every(st => st.done);
  const toggleSheet = (k: Sheet) => setSheet(cur => (cur === k ? null : k));

  return (
    <ToolShell entry={entry} layout="full">
      <div className="city-root">
        <div className="city-hud">
          <TopBar
            hud={hud}
            speed={speed}
            overlay={overlay}
            prefs={prefs}
            onSpeed={setSpeed}
            onOverlay={setOverlay}
            onPrefs={onViewPrefs}
            onBudget={() => toggleSheet('budget')}
            onStats={() => toggleSheet('stats')}
            onMilestones={() => toggleSheet('milestones')}
            onNewCity={() => setConfirmNew(true)}
            compact={isMobile}
          />
          {isMobile && (
            <button type="button" className={`city-btn city-paint${paint ? ' city-on' : ''}`} aria-pressed={paint} onClick={() => setPaint(p => !p)} title="One-finger drag applies the tool">
              <CityIcon name="paint" size={16} /> Paint
            </button>
          )}
        </div>
        <Toolbar tool={tool} density={density} milestone={hud?.milestone ?? 0} onTool={onTool} onDensity={onDensity} compact={isMobile} />
        {spend && !isMobile && (
          <div key={spend.id} className="city-spend" aria-hidden="true">
            −{formatMoney(spend.amount)}
          </div>
        )}
        <Viewport terrain={terrain} rendererRef={rendererRef} handlersRef={handlersRef} panCursor={tool.kind === 'inspect'} />
        {onboardingVisible && hud && <Onboarding hud={hud} onClose={() => updatePrefs({ ...prefs, onboardingDoneSeed: seed })} />}
        <Advisor messages={messages} onOverlay={setOverlay} />
        {notice && <NoticeBanner notice={notice} onClose={dismissNotice} onMilestones={() => { dismissNotice(); setSheet('milestones'); }} />}
        {selected && <Inspector tile={selected} layers={layers} version={hud?.tick ?? 0} demand={hud?.demand ?? []} onClose={() => setSelected(null)} onOverlay={setOverlay} />}
        {!selected && <Legend overlay={overlay} onClose={() => setOverlay('none')} />}
        {debugOpen && debugAllowed && (
          <DebugPanel hud={hud} layers={layers} version={hud?.tick ?? 0} onFastForward={ticks => clientRef.current?.fastForward(ticks)} onGrant={amount => dispatch({ type: 'grant', amount })} onTuning={o => clientRef.current?.setTuning(o)} onClose={() => setDebugOpen(false)} />
        )}
        {sheet === 'budget' && (
          <BudgetPanel
            hud={hud}
            onTax={(zone, rate) => dispatch({ type: 'setTax', zone, rate })}
            onFunding={(service, level) => dispatch({ type: 'setFunding', service, level })}
            onPolicy={(policy, on) => dispatch({ type: 'setPolicy', policy, on })}
            onLoan={amount => dispatch({ type: 'loan', amount })}
            onRepay={id => dispatch({ type: 'repay', id })}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet === 'stats' && <StatsPanel hud={hud} onClose={() => setSheet(null)} />}
        {sheet === 'milestones' && <MilestonePanel hud={hud} onClose={() => setSheet(null)} />}
        {!isMobile && overlay === 'none' && !selected && <div className="city-hint">drag · pan &nbsp;|&nbsp; right-drag · orbit &nbsp;|&nbsp; wheel · zoom &nbsp;|&nbsp; R C I T B · tools &nbsp;|&nbsp; F G M · budget stats milestones &nbsp;|&nbsp; P · pause &nbsp;|&nbsp; Esc · inspect</div>}
        {toast && (
          <div className="city-panel city-toast" role="status">
            <span className="city-tile" style={{ background: 'var(--cp-danger)', width: 24, height: 24, borderRadius: 7 }}>
              <CityIcon name="warning" size={14} />
            </span>
            {toast}
          </div>
        )}
        {saveFailed && (
          <div className="city-panel city-toast" role="alert">
            Couldn't save — storage is full or disabled.{' '}
            <button type="button" className="city-btn city-btn-sm" onClick={() => setSaveFailed(false)}>
              OK
            </button>
          </div>
        )}
        <NewCityDialog key={confirmNew ? 'open' : 'closed'} open={confirmNew} hasCity={!!hud && hud.totals.buildings > 0} onStart={newCity} onClose={() => setConfirmNew(false)} />
      </div>
    </ToolShell>
  );
}
