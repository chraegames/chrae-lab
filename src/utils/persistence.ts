import { buildDefaultInput, defaultActuals, generateId } from '../engine/defaults';
import { earlyWithdrawalCutoff } from '../engine/constants';
import type {
  ActualsData,
  PlanInput,
  ProfilesState,
  Scenario,
  WithdrawalSchedule,
} from '../models/types';

// localStorage keys, including older ones we still migrate from. Keeping
// the old shapes in this file (rather than App.tsx) makes it easier to
// retire them later: just delete this module's legacy branches.

export const PROFILES_KEY = 'financial-planner-profiles';
export const INTRO_SEEN_KEY = 'firePlannerIntroSeen';
// Shared by every page on the site (hub, FIRE planner, each tool). The value
// predates the hub — keep it so existing visitors' theme choice survives.
export const THEME_KEY = 'firePlannerTheme';
export const UNIT_CONVERTER_KEY = 'chraeLab.unitConverter';
export const CALCULATOR_HISTORY_KEY = 'chraeLab.calculator.history';
export const TODO_KEY = 'chraeLab.todo';
export const SUDOKU_KEY = 'chraeLab.sudoku';
export const BINGO_KEY = 'chraeLab.bingo';
export const GO_KEY = 'chraeLab.go';
export const MAGIC_TOWER_KEY = 'chraeLab.magicTower';
export const MAGIC_TOWER_META_KEY = 'chraeLab.magicTower.meta';
export const MAGIC_TOWER_LANG_KEY = 'chraeLab.magicTower.lang';
export const CITY_KEY = 'chraeLab.city';
export const CITY_PREFS_KEY = 'chraeLab.city.prefs';
const OLD_SCENARIOS_KEY = 'financial-planner-scenarios';
const OLD_INPUT_KEY = 'financial-planner-input';
const OLD_PLANS_KEY = 'financial-planner-plans';

// Safe wrapper around localStorage.setItem. Returns false if the write
// throws (quota exceeded, storage disabled, Safari private mode in some
// configs) so callers can degrade gracefully instead of crashing the tree.
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn('localStorage write failed', err);
    return false;
  }
}

interface OldScenariosState {
  plans: Scenario[];
  activePlanId: string;
}

// Fields older saved plans may have had but the current PlanInput type
// doesn't. Captured here so migratePlans can read/delete them without `any`.
interface LegacyPlanInput {
  brokerageReturnRate?: number;
  retirementReturnRate?: number;
  retirementBalance?: number;
  rothBalance?: number;
  iraBalance?: number;
}

/**
 * In-place upgrade for plans loaded from localStorage or imported JSON.
 * Backfills missing fields, renames `retirement*` → `roth/ira`, ensures
 * every account type has a withdrawal schedule entry, and marks
 * pre-existing plans as touched (so returning users skip Welcome).
 */
export function migratePlans(plans: Scenario[]): Scenario[] {
  for (const plan of plans) {
    if (plan.input.inflationRate == null) plan.input.inflationRate = 0.03;
    if (plan.input.targetCash == null) plan.input.targetCash = 200000;
    if (plan.input.startYear == null) plan.input.startYear = 2026;
    if (plan.input.endYear == null) plan.input.endYear = 2065;
    if (plan.input.birthYear == null) plan.input.birthYear = 1985;
    if (plan.input.brokerageBasis == null)
      plan.input.brokerageBasis = plan.input.brokerageBalance ?? 0;
    if (plan.input.returnRate == null) {
      const old = plan.input as PlanInput & LegacyPlanInput;
      plan.input.returnRate = old.brokerageReturnRate ?? old.retirementReturnRate ?? 0.07;
      delete old.brokerageReturnRate;
      delete old.retirementReturnRate;
    }
    if (!plan.actuals)
      plan.actuals = {
        incomes: {},
        expenses: {},
        withdrawals: { brokerage: {}, roth: {}, ira: {} },
        endingBalances: { brokerage: {}, roth: {}, ira: {} },
        endingCash: {},
      };
    if (!plan.actuals.endingBalances)
      plan.actuals.endingBalances = { brokerage: {}, roth: {}, ira: {} };
    if (!plan.actuals.endingCash) plan.actuals.endingCash = {};
    for (const exp of plan.input.expenses) {
      if (exp.applyInflation == null) exp.applyInflation = true;
    }
    const inp = plan.input as PlanInput & LegacyPlanInput;
    if (inp.retirementBalance != null && inp.rothBalance == null) {
      inp.rothBalance = Math.round(inp.retirementBalance / 2);
      inp.iraBalance = inp.retirementBalance - inp.rothBalance;
      delete inp.retirementBalance;
    }
    for (const wd of plan.input.withdrawals) {
      if ((wd.accountType as string) === 'retirement') {
        (wd as WithdrawalSchedule).accountType = 'ira';
      }
    }
    const accountTypes: Array<'brokerage' | 'roth' | 'ira'> = ['brokerage', 'roth', 'ira'];
    const defaultWithdrawalStart = Math.max(
      plan.input.startYear,
      earlyWithdrawalCutoff(plan.input.birthYear),
    );
    for (const accountType of accountTypes) {
      if (!plan.input.withdrawals.some(w => w.accountType === accountType)) {
        plan.input.withdrawals.push({
          id: generateId(),
          accountType,
          periods: [
            {
              startYear: defaultWithdrawalStart,
              endYear: plan.input.endYear,
              amount: 0,
            },
          ],
        });
      }
    }
    const wdActuals = plan.actuals.withdrawals;
    const accountTypeKeySet = new Set(['brokerage', 'roth', 'ira']);
    const oldKeys = Object.keys(wdActuals).filter(k => !accountTypeKeySet.has(k));
    if (oldKeys.length > 0) {
      const migrated: Record<string, Record<number, number>> = {
        brokerage: { ...wdActuals.brokerage },
        roth: { ...wdActuals.roth },
        ira: { ...wdActuals.ira },
      };
      for (const oldKey of oldKeys) {
        const schedule = plan.input.withdrawals.find(w => w.id === oldKey);
        if (!schedule) continue;
        const target = migrated[schedule.accountType];
        for (const [yearStr, val] of Object.entries(
          wdActuals[oldKey as keyof typeof wdActuals] ?? {},
        )) {
          const year = Number(yearStr);
          target[year] = (target[year] ?? 0) + val;
        }
      }
      plan.actuals.withdrawals = migrated as typeof plan.actuals.withdrawals;
    }
    // Pre-existing plans are assumed touched (skip Welcome).
    if (plan.touched == null) plan.touched = true;
  }
  return plans;
}

/**
 * Drop any actuals entries whose owning income / expense item has been
 * deleted or whose year is outside the projection horizon. Called after
 * the user edits input so the persisted actuals don't accumulate orphans.
 */
export function cleanActuals(input: PlanInput, actuals: ActualsData): ActualsData {
  const START = input.startYear;
  const clean = (
    items: { id: string; periods: { startYear: number; endYear: number }[] }[],
    data: Record<string, Record<number, number>>,
  ): Record<string, Record<number, number>> => {
    const result: Record<string, Record<number, number>> = {};
    const itemIds = new Set(items.map(i => i.id));
    for (const [id, yearMap] of Object.entries(data)) {
      if (!itemIds.has(id)) continue;
      const item = items.find(i => i.id === id)!;
      const cleaned: Record<number, number> = {};
      for (const [keyStr, val] of Object.entries(yearMap)) {
        const key = Number(keyStr);
        // Monthly expense keys are year*100+month, so derive the year
        const year = key > 9999 ? Math.floor(key / 100) : key;
        if (item.periods.some(p => year >= p.startYear && year <= p.endYear)) {
          cleaned[key] = val;
        }
      }
      if (Object.keys(cleaned).length > 0) result[id] = cleaned;
    }
    return result;
  };
  const currentYear = new Date().getFullYear();
  const cleanedWithdrawals: typeof actuals.withdrawals = {};
  for (const acctType of ['brokerage', 'roth', 'ira'] as const) {
    const yearMap = actuals.withdrawals[acctType];
    if (!yearMap) continue;
    const cleaned: Record<number, number> = {};
    for (const [yearStr, val] of Object.entries(yearMap)) {
      const year = Number(yearStr);
      if (year >= START && year <= currentYear) cleaned[year] = val;
    }
    if (Object.keys(cleaned).length > 0) cleanedWithdrawals[acctType] = cleaned;
  }
  const cleanedEndingBalances: NonNullable<ActualsData['endingBalances']> = {};
  for (const acctType of ['brokerage', 'roth', 'ira'] as const) {
    const yearMap = actuals.endingBalances?.[acctType];
    if (!yearMap) continue;
    const cleaned: Record<number, number> = {};
    for (const [yearStr, val] of Object.entries(yearMap)) {
      const year = Number(yearStr);
      if (year >= START && year <= currentYear) cleaned[year] = val;
    }
    if (Object.keys(cleaned).length > 0) cleanedEndingBalances[acctType] = cleaned;
  }
  const cleanedEndingCash: Record<number, number> = {};
  for (const [yearStr, val] of Object.entries(actuals.endingCash ?? {})) {
    const year = Number(yearStr);
    if (year >= START && year <= currentYear) cleanedEndingCash[year] = val;
  }
  return {
    incomes: clean(input.incomes, actuals.incomes),
    expenses: clean(input.expenses, actuals.expenses),
    withdrawals: cleanedWithdrawals,
    endingBalances: cleanedEndingBalances,
    endingCash: cleanedEndingCash,
  };
}

/**
 * A clean first-run state: one default profile with one untouched plan.
 * The plan's `touched: false` flag drives the app to Welcome.
 */
export function freshStart(): ProfilesState {
  const planId = generateId();
  const profileId = generateId();
  const plans: Scenario[] = [
    {
      id: planId,
      name: 'Default',
      input: buildDefaultInput(),
      actuals: { ...defaultActuals },
      touched: false,
    },
  ];
  return {
    profiles: [{ id: profileId, name: 'Default', plans, activePlanId: planId }],
    activeProfileId: profileId,
  };
}

/**
 * Initial value for the intro-screen seen flag. Returns true (intro
 * already seen / skipped) when:
 *   - the explicit dismissed flag is present in localStorage, OR
 *   - the user has any pre-existing touched scenario (grandfather
 *     returning users who have been using the app before the intro
 *     screen existed).
 * Returns false only for genuinely new visitors.
 */
export function loadIntroSeen(): boolean {
  try {
    if (localStorage.getItem(INTRO_SEEN_KEY) != null) return true;
  } catch {
    // localStorage unavailable — treat as a fresh visitor.
    return false;
  }
  try {
    const saved = localStorage.getItem(PROFILES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ProfilesState;
      if (parsed.profiles?.some(p => p.plans?.some(pl => pl.touched))) {
        return true;
      }
    }
    // Also grandfather pre-profiles localStorage shapes — any of them
    // means the user has been here before.
    if (
      localStorage.getItem(OLD_SCENARIOS_KEY) ||
      localStorage.getItem(OLD_INPUT_KEY) ||
      localStorage.getItem(OLD_PLANS_KEY)
    ) {
      return true;
    }
  } catch {
    // Ignore — fall through to "first visit".
  }
  return false;
}

/**
 * Read profiles from localStorage, falling back through the older saved
 * shapes (single-input, scenarios-only) and ultimately returning a
 * freshStart() for first-time users.
 */
export function loadProfiles(): ProfilesState {
  // Current format
  try {
    const saved = localStorage.getItem(PROFILES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ProfilesState;
      if (parsed.profiles.length > 0) {
        for (const profile of parsed.profiles) {
          migratePlans(profile.plans);
        }
        return parsed;
      }
    }
  } catch {
    // ignore — fall through to legacy shapes
  }

  // Pre-profiles "scenarios" shape
  try {
    const oldScenarios = localStorage.getItem(OLD_SCENARIOS_KEY);
    if (oldScenarios) {
      const parsed = JSON.parse(oldScenarios) as OldScenariosState;
      if (parsed.plans.length > 0) {
        migratePlans(parsed.plans);
        const profileId = generateId();
        localStorage.removeItem(OLD_SCENARIOS_KEY);
        return {
          profiles: [
            {
              id: profileId,
              name: 'Default',
              plans: parsed.plans,
              activePlanId: parsed.activePlanId,
            },
          ],
          activeProfileId: profileId,
        };
      }
    }
  } catch {
    // ignore
  }

  // Pre-scenarios "single input" shape
  try {
    const oldInput = localStorage.getItem(OLD_INPUT_KEY);
    const oldPlans = localStorage.getItem(OLD_PLANS_KEY);
    if (oldInput) {
      const input = JSON.parse(oldInput) as PlanInput;
      const plans: Scenario[] = [];
      if (oldPlans) {
        const parsed = JSON.parse(oldPlans) as {
          plans: { id: string; name: string; schedules: WithdrawalSchedule[] }[];
          activePlanId: string | null;
        };
        for (const p of parsed.plans) {
          plans.push({
            id: p.id,
            name: p.name,
            input: { ...input, withdrawals: p.schedules },
            actuals: { ...defaultActuals },
          });
        }
      }
      if (plans.length === 0) {
        const id = generateId();
        plans.push({ id, name: 'Default', input, actuals: { ...defaultActuals } });
      }
      migratePlans(plans);
      localStorage.removeItem(OLD_INPUT_KEY);
      localStorage.removeItem(OLD_PLANS_KEY);
      const profileId = generateId();
      return {
        profiles: [
          { id: profileId, name: 'Default', plans, activePlanId: plans[0].id },
        ],
        activeProfileId: profileId,
      };
    }
  } catch {
    // ignore
  }

  return freshStart();
}
