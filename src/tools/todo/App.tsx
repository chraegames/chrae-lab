import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { ToolShell } from '../../components/layout/ToolShell';
import { NameForm } from '../../components/layout/NameForm';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';
import { TextInput } from '../../components/primitives/Input';
import { Popover, PopoverDivider, PopoverItem } from '../../components/primitives/Popover';
import { ConfirmDialog } from '../../components/storyline/ConfirmDialog';
import { useIsMobile } from '../../hooks/useIsMobile';
import { generateId } from '../../engine/defaults';
import { bySlug } from '../../site/manifest';
import { track } from '../../utils/analytics';
import { dueStatus, formatDue, todayISO, type DueStatus } from './dueDate';
import {
  loadTodoState,
  saveTodoState,
  todoReducer,
  type TodoAction,
  type TodoItem,
  type TodoList,
} from './todoReducer';

const entry = bySlug('todo');

type Dispatch = (action: TodoAction) => void;

// ─── Styles ─────────────────────────────────────────────────────────────

const card: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-card)',
};

const dateInputStyle: CSSProperties = {
  height: 32,
  padding: '0 8px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border-soft)',
  borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  color: 'var(--ink)',
  colorScheme: 'light dark',
  boxSizing: 'border-box',
};

const chipTone: Record<DueStatus, { bg: string; fg: string }> = {
  overdue: { bg: 'var(--negative-soft)', fg: 'var(--negative)' },
  today: { bg: 'var(--caution-soft)', fg: 'var(--caution)' },
  soon: { bg: 'var(--accent-soft)', fg: 'var(--accent-ink)' },
  later: { bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  none: { bg: 'transparent', fg: 'var(--ink-muted)' },
};

// ─── App ────────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(todoReducer, undefined, loadTodoState);
  const isMobile = useIsMobile();
  const [today] = useState(() => todayISO());
  const [saveFailed, setSaveFailed] = useState(false);
  const saveFailedRef = useRef(false);

  // Persist on every change. The failure flag is set through a microtask so
  // the effect itself never calls setState synchronously (lint rule
  // react-hooks/set-state-in-effect); the ref keeps it a one-shot.
  useEffect(() => {
    const ok = saveTodoState(state);
    if (!ok && !saveFailedRef.current) {
      saveFailedRef.current = true;
      queueMicrotask(() => setSaveFailed(true));
    }
  }, [state]);

  const activeList = state.lists.find(l => l.id === state.activeListId) ?? state.lists[0];

  const addList = useCallback(
    (name: string) => {
      dispatch({ type: 'addList', name, id: generateId() });
      track('todo_list_created');
    },
    [],
  );

  const addItem = useCallback(
    (title: string, due?: string) => {
      dispatch({ type: 'addItem', title, due, id: generateId(), now: Date.now() });
      track('todo_created');
    },
    [],
  );

  const maxWidth = isMobile ? 760 : 960;

  return (
    <ToolShell entry={entry} maxWidth={maxWidth}>
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
          gap: isMobile ? 12 : 20,
          alignItems: 'flex-start',
        }}
      >
        {isMobile ? (
          <ListChips state={state} dispatch={dispatch} onAddList={addList} />
        ) : (
          <ListRail state={state} dispatch={dispatch} onAddList={addList} />
        )}

        <section style={{ ...card, flex: 1, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
          <ListHeader
            key={activeList.id}
            list={activeList}
            listCount={state.lists.length}
            dispatch={dispatch}
          />
          <AddForm onAdd={addItem} />
          <Items list={activeList} today={today} dispatch={dispatch} isMobile={isMobile} />
        </section>
      </div>
    </ToolShell>
  );
}

// ─── Lists: desktop rail ────────────────────────────────────────────────

interface ListNavProps {
  state: { lists: TodoList[]; activeListId: string };
  dispatch: Dispatch;
  onAddList: (name: string) => void;
}

function openCount(list: TodoList): number {
  return list.items.filter(i => !i.done).length;
}

function NewListPopover({ onAddList, compact }: { onAddList: (name: string) => void; compact?: boolean }) {
  return (
    <Popover
      width={240}
      trigger={({ toggle }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          leading={<Icon name="plus" size={12} />}
          style={compact ? { flexShrink: 0 } : { width: '100%', justifyContent: 'flex-start' }}
        >
          New list
        </Button>
      )}
    >
      {({ close }) => (
        <NameForm
          initial=""
          label="New list"
          onCancel={close}
          onSubmit={name => {
            onAddList(name);
            close();
          }}
        />
      )}
    </Popover>
  );
}

function ListRail({ state, dispatch, onAddList }: ListNavProps) {
  return (
    <nav aria-label="Lists" style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div
        style={{
          padding: '0 10px 8px',
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        Lists
      </div>
      {state.lists.map(list => (
        <RailItem
          key={list.id}
          list={list}
          active={list.id === state.activeListId}
          onSelect={() => dispatch({ type: 'selectList', id: list.id })}
        />
      ))}
      <div style={{ marginTop: 6 }}>
        <NewListPopover onAddList={onAddList} />
      </div>
    </nav>
  );
}

function RailItem({ list, active, onSelect }: { list: TodoList; active: boolean; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  const count = openCount(list);
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        width: '100%',
        padding: '7px 10px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid transparent',
        background: active ? 'var(--accent-tint)' : hovered ? 'var(--surface-2)' : 'transparent',
        color: active ? 'var(--accent-ink)' : 'var(--ink-2)',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.name}</span>
      {count > 0 && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: active ? 'var(--accent-ink)' : 'var(--ink-muted)',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Lists: mobile chips ────────────────────────────────────────────────

function ListChips({ state, dispatch, onAddList }: ListNavProps) {
  return (
    <nav
      aria-label="Lists"
      style={{
        display: 'flex',
        gap: 6,
        width: '100%',
        overflowX: 'auto',
        paddingBottom: 4,
        alignItems: 'center',
      }}
    >
      {state.lists.map(list => {
        const active = list.id === state.activeListId;
        const count = openCount(list);
        return (
          <button
            key={list.id}
            onClick={() => dispatch({ type: 'selectList', id: list.id })}
            aria-current={active ? 'page' : undefined}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 30,
              padding: '0 12px',
              borderRadius: 'var(--radius-pill)',
              border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              background: active ? 'var(--accent-soft)' : 'var(--surface)',
              color: active ? 'var(--accent-ink)' : 'var(--ink-2)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {list.name}
            {count > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.8 }}>{count}</span>
            )}
          </button>
        );
      })}
      <NewListPopover onAddList={onAddList} compact />
    </nav>
  );
}

// ─── List header + menu ─────────────────────────────────────────────────

function ListHeader({ list, listCount, dispatch }: { list: TodoList; listCount: number; dispatch: Dispatch }) {
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const open = openCount(list);
  const done = list.items.length - open;

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '16px 18px 12px',
        borderBottom: '1px solid var(--border-soft)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 22,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {list.name}
        </h2>
        <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
          {open === 0 ? 'All done' : `${open} open`}
          {done > 0 ? ` · ${done} completed` : ''}
        </div>
      </div>

      <Popover
        align="right"
        width={220}
        trigger={({ toggle }) => (
          <Button
            variant="ghost"
            size="md"
            aria-label="List options"
            title="List options"
            onClick={() => {
              setRenaming(false);
              toggle();
            }}
            leading={<Icon name="menu" size={14} />}
          />
        )}
      >
        {({ close }) =>
          renaming ? (
            <NameForm
              initial={list.name}
              label="Rename list"
              onCancel={() => {
                setRenaming(false);
                close();
              }}
              onSubmit={name => {
                dispatch({ type: 'renameList', id: list.id, name });
                setRenaming(false);
                close();
              }}
            />
          ) : (
            <>
              <PopoverItem leading={<Icon name="edit" size={13} />} onClick={() => setRenaming(true)}>
                Rename
              </PopoverItem>
              <PopoverItem
                leading={<Icon name="check" size={13} />}
                disabled={done === 0}
                onClick={() => {
                  dispatch({ type: 'clearCompleted' });
                  close();
                }}
              >
                Clear completed{done > 0 ? ` (${done})` : ''}
              </PopoverItem>
              <PopoverDivider />
              <PopoverItem
                tone="danger"
                leading={<Icon name="close" size={13} />}
                onClick={() => {
                  close();
                  setConfirmDelete(true);
                }}
              >
                {listCount === 1 ? 'Delete list and start over' : 'Delete list'}
              </PopoverItem>
            </>
          )
        }
      </Popover>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${list.name}"?`}
        message={
          list.items.length > 0 ? (
            <>
              This removes <strong>{list.items.length}</strong> {list.items.length === 1 ? 'task' : 'tasks'}
              {listCount === 1 ? ' and leaves you with an empty Inbox.' : '.'}
            </>
          ) : listCount === 1 ? (
            'The list is empty; you will get a fresh Inbox.'
          ) : (
            'The list is empty.'
          )
        }
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          dispatch({ type: 'deleteList', id: list.id, newId: generateId() });
        }}
      />
    </header>
  );
}

// ─── Add form ───────────────────────────────────────────────────────────

function AddForm({ onAdd }: { onAdd: (title: string, due?: string) => void }) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const submit = () => {
    if (!title.trim()) return;
    onAdd(title, due || undefined);
    setTitle('');
    setDue('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      setTitle('');
      setDue('');
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
      <TextInput
        value={title}
        onChange={setTitle}
        onKeyDown={onKey}
        placeholder="Add a task…"
        aria-label="New task"
        autoFocus
        style={{ flex: 1, minWidth: 0 }}
      />
      <input
        type="date"
        value={due}
        onChange={e => setDue(e.target.value)}
        onKeyDown={onKey}
        aria-label="Due date"
        title="Due date"
        style={{ ...dateInputStyle, width: 140, flexShrink: 0 }}
      />
      <Button
        variant="primary"
        size="md"
        onClick={submit}
        // Keep focus in the text input so the next task can be typed straight away.
        onMouseDown={e => e.preventDefault()}
        disabled={!title.trim()}
        leading={<Icon name="plus" size={12} />}
        style={{ flexShrink: 0 }}
      >
        Add
      </Button>
    </div>
  );
}

// ─── Items ──────────────────────────────────────────────────────────────

function Items({ list, today, dispatch, isMobile }: { list: TodoList; today: string; dispatch: Dispatch; isMobile: boolean }) {
  const [showCompleted, setShowCompleted] = useState(true);

  const { open, done } = useMemo(() => {
    const open = list.items.filter(i => !i.done);
    const done = list.items.filter(i => i.done);
    // Stable sort: due dates ascending, undated last; ties keep list order
    // so the move up/down buttons reorder within a due-date group.
    open.sort((a, b) => {
      if (a.due === b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due < b.due ? -1 : 1;
    });
    return { open, done };
  }, [list.items]);

  if (list.items.length === 0) {
    return (
      <div
        style={{
          padding: '40px 18px',
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 14,
          color: 'var(--ink-muted)',
        }}
      >
        Nothing here yet — add a task above.
      </div>
    );
  }

  const indexOf = (id: string) => list.items.findIndex(i => i.id === id);

  return (
    <div style={{ padding: '6px 0 8px' }}>
      {open.length === 0 && (
        <div
          style={{
            padding: '20px 18px',
            textAlign: 'center',
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--ink-muted)',
          }}
        >
          All done. Nice.
        </div>
      )}
      <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {open.map(item => (
          <ItemRow
            key={item.id}
            item={item}
            today={today}
            dispatch={dispatch}
            canMoveUp={!isMobile && indexOf(item.id) > 0}
            canMoveDown={!isMobile && indexOf(item.id) < list.items.length - 1}
            showMove={!isMobile}
          />
        ))}
      </ul>

      {done.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => setShowCompleted(v => !v)}
            aria-expanded={showCompleted}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              padding: '8px 18px',
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-3)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                transform: showCompleted ? 'rotate(90deg)' : 'none',
                transition: 'transform 140ms ease',
              }}
            >
              <Icon name="chevron" size={12} />
            </span>
            Completed ({done.length})
          </button>
          {showCompleted && (
            <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {done.map(item => (
                <ItemRow key={item.id} item={item} today={today} dispatch={dispatch} showMove={false} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface ItemRowProps {
  item: TodoItem;
  today: string;
  dispatch: Dispatch;
  showMove: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

function ItemRow({ item, today, dispatch, showMove, canMoveUp = false, canMoveDown = false }: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const [hovered, setHovered] = useState(false);

  const status = item.done ? 'none' : dueStatus(item.due, today);
  const tone = chipTone[status];

  const startEdit = () => {
    setDraft(item.title);
    setEditing(true);
  };
  const commitEdit = () => {
    if (draft.trim() && draft.trim() !== item.title) {
      dispatch({ type: 'editItem', id: item.id, title: draft });
    }
    setEditing(false);
  };
  const cancelEdit = () => {
    setDraft(item.title);
    setEditing(false);
  };

  const onRowKey = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      dispatch({ type: 'deleteItem', id: item.id });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      startEdit();
    } else if (e.key === ' ') {
      e.preventDefault();
      dispatch({ type: 'toggleItem', id: item.id });
    }
  };

  const showActions = hovered || editing;

  return (
    <li
      tabIndex={0}
      onKeyDown={onRowKey}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovered(false);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px 6px 18px',
        minHeight: 40,
        background: hovered && !editing ? 'var(--surface-2)' : 'transparent',
        outlineOffset: -2,
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <input
        type="checkbox"
        checked={item.done}
        onChange={() => dispatch({ type: 'toggleItem', id: item.id })}
        aria-label={item.done ? `Mark "${item.title}" as not done` : `Mark "${item.title}" as done`}
        style={{ accentColor: 'var(--accent)', width: 16, height: 16, margin: 0, cursor: 'pointer', flexShrink: 0 }}
      />

      {editing ? (
        <TextInput
          value={draft}
          onChange={setDraft}
          autoFocus
          aria-label="Edit task"
          onKeyDown={e => {
            if (e.key === 'Enter') commitEdit();
            else if (e.key === 'Escape') cancelEdit();
          }}
          onBlur={commitEdit}
          style={{ flex: 1, minWidth: 0, height: 28 }}
        />
      ) : (
        <span
          onDoubleClick={item.done ? undefined : startEdit}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 14,
            color: item.done ? 'var(--ink-muted)' : 'var(--ink)',
            textDecoration: item.done ? 'line-through' : 'none',
            overflowWrap: 'anywhere',
            cursor: item.done ? 'default' : 'text',
          }}
        >
          {item.title}
        </span>
      )}

      {item.due && (
        <span
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            height: 22,
            padding: '0 8px',
            borderRadius: 'var(--radius-pill)',
            background: tone.bg,
            color: tone.fg,
            fontSize: 11.5,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
          title={item.due}
        >
          <Icon name="calendar" size={11} />
          {formatDue(item.due, today)}
        </span>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexShrink: 0,
          opacity: showActions ? 1 : 0,
          transition: 'opacity 120ms ease',
        }}
      >
        <DuePicker item={item} dispatch={dispatch} />
        {!item.done && (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Edit task"
            title="Edit"
            tabIndex={-1}
            onClick={startEdit}
            leading={<Icon name="edit" size={12} />}
            style={{ padding: '0 6px' }}
          />
        )}
        {showMove && (
          <>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Move up"
              title="Move up"
              tabIndex={-1}
              disabled={!canMoveUp}
              onClick={() => dispatch({ type: 'moveItem', id: item.id, direction: 'up' })}
              leading={<Icon name="arrowUp" size={12} />}
              style={{ padding: '0 6px' }}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label="Move down"
              title="Move down"
              tabIndex={-1}
              disabled={!canMoveDown}
              onClick={() => dispatch({ type: 'moveItem', id: item.id, direction: 'down' })}
              leading={<Icon name="arrowDown" size={12} />}
              style={{ padding: '0 6px' }}
            />
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          aria-label="Delete task"
          title="Delete"
          tabIndex={-1}
          onClick={() => dispatch({ type: 'deleteItem', id: item.id })}
          leading={<Icon name="close" size={12} />}
          style={{ padding: '0 6px' }}
        />
      </div>
    </li>
  );
}

function DuePicker({ item, dispatch }: { item: TodoItem; dispatch: Dispatch }) {
  return (
    <Popover
      align="right"
      width={200}
      trigger={({ toggle }) => (
        <Button
          variant="ghost"
          size="sm"
          aria-label={item.due ? 'Change due date' : 'Set due date'}
          title={item.due ? 'Change due date' : 'Set due date'}
          tabIndex={-1}
          onClick={toggle}
          leading={<Icon name="calendar" size={12} />}
          style={{ padding: '0 6px' }}
        />
      )}
    >
      {({ close }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 6 }}>
          <input
            type="date"
            autoFocus
            value={item.due ?? ''}
            onChange={e => dispatch({ type: 'setDue', id: item.id, due: e.target.value || undefined })}
            onKeyDown={e => {
              if (e.key === 'Enter') close();
            }}
            aria-label="Due date"
            style={{ ...dateInputStyle, width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
            <Button
              variant="ghost"
              size="sm"
              disabled={!item.due}
              onClick={() => {
                dispatch({ type: 'setDue', id: item.id });
                close();
              }}
            >
              Clear
            </Button>
            <Button variant="primary" size="sm" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}
