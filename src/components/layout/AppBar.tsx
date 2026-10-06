import { useState, type ReactNode } from 'react';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon';
import { Popover, PopoverItem, PopoverDivider, PopoverLabel } from '../primitives/Popover';
import { NameForm } from './NameForm';
import { Logo } from './Logo';
import { ConfirmDialog } from '../storyline/ConfirmDialog';
import type { Profile, ProfilesState } from '../../models/types';
import { isLocalHost } from '../../utils/env';
import { useIsMobile } from '../../hooks/useIsMobile';
import { absoluteUrl, otherSites } from '../../site/manifest';

interface AppBarProps {
  profilesState: ProfilesState;
  activeProfile: Profile;
  theme: 'light' | 'dark';
  route: 'plan' | 'history';
  onToggleTheme: () => void;
  onExport: () => void;
  onImport: () => void;
  onAbout: () => void;
  onGoHistory: () => void;
  onGoPlan: () => void;
  onSwitchProfile: (profileId: string) => void;
  onCreateProfile: () => void;
  onRenameProfile: (profileId: string, name: string) => void;
  onDeleteProfile: (profileId: string) => void;
  /** Local-only: re-show the first-visit intro screen. */
  onDevResetToIntro?: () => void;
  /** Local-only: reset to a clean Welcome screen (wipes plan data). */
  onDevResetToWelcome?: () => void;
  /** When true, hide all navigation/CRUD controls — only the theme
   *  toggle (and the localhost dev affordances) remain. Used on the
   *  first-visit intro screen so the only user action is the CTA. */
  minimal?: boolean;
  rightSlot?: ReactNode;
}

export function AppBar({
  profilesState,
  activeProfile,
  theme,
  route,
  onToggleTheme,
  onExport,
  onImport,
  onAbout,
  onGoHistory,
  onGoPlan,
  onSwitchProfile,
  onCreateProfile,
  onRenameProfile,
  onDeleteProfile,
  onDevResetToIntro,
  onDevResetToWelcome,
  minimal = false,
  rightSlot,
}: AppBarProps) {
  const profileInitial = activeProfile.name.trim().charAt(0).toUpperCase() || '·';
  const local = isLocalHost();
  const isMobile = useIsMobile();

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 clamp(12px, 3vw, 32px)',
        height: 56,
        background: local ? '#f59e0b' : 'var(--bg)',
        borderBottom: local ? '1px solid #b45309' : '1px solid var(--border-soft)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 20, minWidth: 0 }}>
        <button
          onClick={onGoPlan}
          style={{ display: 'flex', alignItems: 'center', gap: 9 }}
          title="Home"
        >
          <Logo />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 17,
              letterSpacing: '-0.015em',
              color: local ? '#1c1917' : 'var(--ink)',
              whiteSpace: 'nowrap',
            }}
          >
            FIRE Planner
          </span>
        </button>
        {local && !isMobile && (
          <span
            title={`Running on ${window.location.hostname || 'file://'} — not production`}
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              padding: '3px 8px',
              borderRadius: 4,
              background: '#1c1917',
              color: '#fbbf24',
            }}
          >
            LOCAL
          </span>
        )}
        {local && !isMobile && (onDevResetToIntro || onDevResetToWelcome) && (
          <div style={{ display: 'inline-flex', gap: 4 }}>
            {onDevResetToIntro && (
              <DevJumpButton onClick={onDevResetToIntro} title="Re-show the first-visit intro (clears the seen flag; plan data untouched)">
                ↻ Intro
              </DevJumpButton>
            )}
            {onDevResetToWelcome && (
              <DevJumpButton onClick={onDevResetToWelcome} title="Switch to (or create) an untouched scenario in this profile so Welcome renders — preserves all existing data">
                ↻ Welcome
              </DevJumpButton>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {rightSlot}
        {minimal && !isMobile && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              marginRight: 6,
              borderRadius: 'var(--radius-pill)',
              background: local ? '#1c1917' : 'var(--accent-tint)',
              color: local ? '#fbbf24' : 'var(--accent)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'block' }} />
            Runs on this device
          </span>
        )}
        {/* Theme toggle survives `minimal` mode — the intro screen is the
            user's first impression and they should be able to flip the
            theme before engaging. */}
        {!minimal && !isMobile && route !== 'history' && (
          <Button
            variant="outline"
            size="md"
            onClick={onGoHistory}
            leading={<Icon name="calendar" />}
          >
            History
          </Button>
        )}
        {!minimal && !isMobile && route === 'history' && (
          <Button
            variant="ghost"
            size="md"
            onClick={onGoPlan}
            leading={<Icon name="arrowUp" size={12} />}
          >
            Back to plan
          </Button>
        )}
        {!minimal && !isMobile && (
          <>
            <Button variant="ghost" size="md" onClick={onExport} leading={<Icon name="download" />}>
              Export
            </Button>
            <Button variant="ghost" size="md" onClick={onImport} leading={<Icon name="upload" />}>
              Import
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="md"
          onClick={onToggleTheme}
          leading={<Icon name={theme === 'dark' ? 'sun' : 'moon'} />}
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          aria-label="Toggle theme"
        />
        {!minimal && !isMobile && (
          <>
            <Button variant="ghost" size="md" onClick={onAbout} leading={<Icon name="info" />}>
              About
            </Button>
            <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px' }} />
            <ProfileChip
              profilesState={profilesState}
              activeProfile={activeProfile}
              initial={profileInitial}
              onSwitch={onSwitchProfile}
              onCreate={onCreateProfile}
              onRename={onRenameProfile}
              onDelete={onDeleteProfile}
            />
          </>
        )}
        {!minimal && isMobile && route === 'history' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onGoPlan}
            leading={<Icon name="arrowUp" size={12} />}
          >
            Back
          </Button>
        )}
        {!minimal && isMobile && (
          <>
            <AppBarMobileMenu
              route={route}
              onExport={onExport}
              onImport={onImport}
              onAbout={onAbout}
              onGoHistory={onGoHistory}
            />
            <ProfileChip
              profilesState={profilesState}
              activeProfile={activeProfile}
              initial={profileInitial}
              onSwitch={onSwitchProfile}
              onCreate={onCreateProfile}
              onRename={onRenameProfile}
              onDelete={onDeleteProfile}
              compact
            />
          </>
        )}
      </div>
    </header>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Local-only dev jump button (shares the LOCAL chip's amber palette)
// ────────────────────────────────────────────────────────────────────────

function DevJumpButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        padding: '3px 8px',
        borderRadius: 4,
        border: '1px solid #1c1917',
        background: 'transparent',
        color: '#1c1917',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Mobile overflow menu (hamburger)
// ────────────────────────────────────────────────────────────────────────

interface AppBarMobileMenuProps {
  route: 'plan' | 'history';
  onExport: () => void;
  onImport: () => void;
  onAbout: () => void;
  onGoHistory: () => void;
}

function AppBarMobileMenu({
  route,
  onExport,
  onImport,
  onAbout,
  onGoHistory,
}: AppBarMobileMenuProps) {
  return (
    <Popover
      width={220}
      align="right"
      trigger={({ toggle }) => (
        <Button
          variant="ghost"
          size="md"
          onClick={toggle}
          leading={<Icon name="menu" />}
          aria-label="Menu"
          title="Menu"
        />
      )}
    >
      {({ close }) => (
        <>
          {/* Back-to-plan is surfaced as a top-level button in the bar
              when route === 'history', so it doesn't appear here. */}
          {route !== 'history' && (
            <PopoverItem
              leading={<Icon name="calendar" size={12} />}
              onClick={() => { onGoHistory(); close(); }}
            >
              History
            </PopoverItem>
          )}
          <PopoverItem
            leading={<Icon name="download" size={12} />}
            onClick={() => { onExport(); close(); }}
          >
            Export
          </PopoverItem>
          <PopoverItem
            leading={<Icon name="upload" size={12} />}
            onClick={() => { onImport(); close(); }}
          >
            Import
          </PopoverItem>
          <PopoverDivider />
          <PopoverItem
            leading={<Icon name="info" size={12} />}
            onClick={() => { onAbout(); close(); }}
          >
            About
          </PopoverItem>
          {otherSites('fire').map(site => (
            <PopoverItem
              key={site.slug}
              leading={<Icon name="grid" size={12} />}
              onClick={() => { window.location.assign(absoluteUrl(site)); }}
            >
              {site.name}
            </PopoverItem>
          ))}
        </>
      )}
    </Popover>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Profile chip
// ────────────────────────────────────────────────────────────────────────

interface ProfileChipProps {
  profilesState: ProfilesState;
  activeProfile: Profile;
  initial: string;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

function ProfileChip({
  profilesState,
  activeProfile,
  initial,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  compact = false,
}: ProfileChipProps) {
  const [mode, setMode] = useState<'menu' | 'rename'>('menu');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canDelete = profilesState.profiles.length > 1;
  const scenarioCount = activeProfile.plans.length;
  return (
    <>
    <Popover
      width={280}
      align="right"
      trigger={({ toggle }) => (
        <button
          onClick={() => {
            setMode('menu');
            toggle();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: compact ? 4 : 8,
            padding: compact ? '0 6px 0 4px' : '0 12px 0 8px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            height: 32,
            cursor: 'pointer',
          }}
          aria-label={compact ? `Profile: ${activeProfile.name}` : undefined}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 99,
              background: 'var(--accent)',
              color: 'var(--accent-contrast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {initial}
          </div>
          {!compact && (
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
              {activeProfile.name}
            </span>
          )}
          <Icon name="chevron" size={11} />
        </button>
      )}
    >
      {({ close }) => {
        if (mode === 'rename') {
          return (
            <NameForm
              initial={activeProfile.name}
              label="Rename profile"
              onCancel={() => setMode('menu')}
              onSubmit={name => {
                onRename(activeProfile.id, name);
                setMode('menu');
                close();
              }}
            />
          );
        }
        return (
          <>
            <div
              style={{
                padding: '8px 10px 6px',
                fontSize: 11.5,
                lineHeight: 1.45,
                color: 'var(--ink-muted)',
              }}
            >
              Profiles separate plans for different people. Each profile has its own scenarios and inputs.
            </div>
            <PopoverDivider />
            <PopoverLabel>Switch profile</PopoverLabel>
            {profilesState.profiles.map(p => {
              const count = p.plans.length;
              const countLabel = `${count} ${count === 1 ? 'scenario' : 'scenarios'}`;
              return (
                <PopoverItem
                  key={p.id}
                  active={p.id === activeProfile.id}
                  onClick={() => {
                    onSwitch(p.id);
                    close();
                  }}
                  trailing={
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        color: 'var(--ink-muted)',
                        fontWeight: 500,
                      }}
                    >
                      {countLabel}
                      {p.id === activeProfile.id && <Icon name="check" size={12} />}
                    </span>
                  }
                >
                  {p.name}
                </PopoverItem>
              );
            })}
            <PopoverDivider />
            <PopoverItem
              leading={<Icon name="edit" size={12} />}
              onClick={() => setMode('rename')}
            >
              Rename
            </PopoverItem>
            <PopoverItem
              leading={<Icon name="plus" size={12} />}
              onClick={() => {
                onCreate();
                close();
              }}
            >
              New profile
            </PopoverItem>
            {canDelete && (
              <PopoverItem
                leading={<Icon name="close" size={12} />}
                tone="danger"
                onClick={() => {
                  close();
                  setConfirmOpen(true);
                }}
              >
                Delete this profile
              </PopoverItem>
            )}
          </>
        );
      }}
    </Popover>
    <ConfirmDialog
      open={confirmOpen}
      title="Delete profile?"
      message={
        <>
          This permanently deletes the profile <strong>"{activeProfile.name}"</strong> and all{' '}
          {scenarioCount} of its {scenarioCount === 1 ? 'scenario' : 'scenarios'} — including every
          input, history entry, and withdrawal schedule.
        </>
      }
      confirmLabel="Delete profile"
      onClose={() => setConfirmOpen(false)}
      onConfirm={() => {
        onDelete(activeProfile.id);
        setConfirmOpen(false);
      }}
    />
    </>
  );
}
