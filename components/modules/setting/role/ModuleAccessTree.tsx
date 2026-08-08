'use client';

import { Check } from '@/components/ui/Check';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import {
    ACTION_LABEL,
    actionsForModuleKey,
    type PermissionAction,
} from '@/service/core/authz/permissions';
import { ChevronDown, ChevronRight, Layers, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

/** A selectable module in the access tree (action-type rows are excluded). */
export type AccessModule = {
    id: number;
    key: string;
    label: string;
    path: string;
    type: string;
    parent_id: number | null;
    sort_order: number;
};

/** module_id → the set of granted action verbs. */
export type GrantMap = Record<number, string[]>;

type TreeNode = AccessModule & { children: TreeNode[] };

function buildTree(modules: AccessModule[]): TreeNode[] {
    const byId = new Map<number, TreeNode>();
    for (const m of modules) byId.set(m.id, { ...m, children: [] });

    const roots: TreeNode[] = [];
    for (const node of byId.values()) {
        // A module whose parent is an action row (or was filtered out) is
        // promoted to a root rather than silently dropped.
        const parent =
            node.parent_id != null ? byId.get(node.parent_id) : undefined;
        if (parent) parent.children.push(node);
        else roots.push(node);
    }

    const sort = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
        for (const n of nodes) sort(n.children);
    };
    sort(roots);
    return roots;
}

/** Count of grants on this node and everything under it, for the tree badge. */
function subtreeGrantCount(node: TreeNode, grants: GrantMap): number {
    return (
        (grants[node.id]?.length ?? 0) +
        node.children.reduce((s, c) => s + subtreeGrantCount(c, grants), 0)
    );
}

function TreeRow({
    node,
    depth,
    grants,
    selectedId,
    onSelectAction,
    expanded,
    onToggleAction,
}: {
    node: TreeNode;
    depth: number;
    grants: GrantMap;
    selectedId: number | null;
    onSelectAction: (id: number) => void;
    expanded: Set<number>;
    onToggleAction: (id: number) => void;
}) {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id);
    const selected = selectedId === node.id;
    const own = grants[node.id]?.length ?? 0;
    const total = subtreeGrantCount(node, grants);

    return (
        <li>
            <div
                className={`flex items-center gap-1 rounded-lg pr-2 transition-colors ${
                    selected
                        ? 'bg-[#1a9e52]/10 text-[#1a9e52]'
                        : 'text-slate-600 hover:bg-slate-50'
                }`}
                style={{ paddingLeft: `${depth * 14}px` }}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={() => onToggleAction(node.id)}
                        aria-label={isOpen ? 'Collapse' : 'Expand'}
                        aria-expanded={isOpen}
                        className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-600"
                    >
                        {isOpen ? (
                            <ChevronDown size={13} />
                        ) : (
                            <ChevronRight size={13} />
                        )}
                    </button>
                ) : (
                    <span className="w-[21px] shrink-0" />
                )}

                <button
                    type="button"
                    onClick={() => onSelectAction(node.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
                >
                    <span className="truncate font-semibold">{node.label}</span>
                    {own > 0 && (
                        <span className="shrink-0 rounded-full bg-[#1a9e52] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {own}
                        </span>
                    )}
                    {own === 0 && total > 0 && (
                        <span className="shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                            {total}
                        </span>
                    )}
                </button>
            </div>

            {hasChildren && isOpen && (
                <ul>
                    {node.children.map((child) => (
                        <TreeRow
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            grants={grants}
                            selectedId={selectedId}
                            onSelectAction={onSelectAction}
                            expanded={expanded}
                            onToggleAction={onToggleAction}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}

function ActionGroup({
    title,
    actions,
    granted,
    onToggleAction,
    readOnly = false,
}: {
    title: string;
    actions: PermissionAction[];
    granted: Set<string>;
    onToggleAction: (action: PermissionAction) => void;
    readOnly?: boolean;
}) {
    if (actions.length === 0) return null;
    return (
        <div>
            <FieldLabel>{title}</FieldLabel>
            <div className="flex flex-wrap gap-2">
                {actions.map((action) => {
                    const on = granted.has(action);
                    // Read-only keeps the same chips so the detail page reads
                    // exactly like the editor, but drops every affordance that
                    // would suggest they can be changed here.
                    const tone = on
                        ? 'border-[#1a9e52]/40 bg-emerald-50/60 text-[#1a9e52]'
                        : readOnly
                          ? 'border-slate-200 bg-slate-50 text-slate-400'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50';
                    return (
                        <label
                            key={action}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                                readOnly ? 'cursor-default' : 'cursor-pointer'
                            } ${tone}`}
                        >
                            <Check
                                checked={on}
                                onChange={
                                    readOnly
                                        ? undefined
                                        : () => onToggleAction(action)
                                }
                                disabled={readOnly}
                                aria-readonly={readOnly || undefined}
                                className={
                                    readOnly ? 'pointer-events-none' : undefined
                                }
                            />
                            <span className="font-semibold">
                                {ACTION_LABEL[action]}
                            </span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * The two-pane module permission editor: a collapsible module tree on the left,
 * the selected module's access rights on the right.
 *
 * Grants are per action verb, keyed on module id — the same shape
 * `role_module_action_permission` stores, so what is ticked here is exactly
 * what the backend enforces. Child *action* pages (…/create, …/:id/update) are
 * never listed: the server derives their view grant from the parent's actions,
 * because a Create button whose page has no view grant just bounces the user
 * to /unauthorized.
 */
export default function ModuleAccessTree({
    modules,
    grants,
    onChangeAction,
    readOnly = false,
}: {
    modules: AccessModule[];
    grants: GrantMap;
    onChangeAction: (next: GrantMap) => void;
    readOnly?: boolean;
}) {
    const tree = useMemo(() => buildTree(modules), [modules]);
    const [selectedId, setSelectedId] = useState<number | null>(
        modules[0]?.id ?? null,
    );
    const [expanded, setExpanded] = useState<Set<number>>(
        () => new Set(modules.filter((m) => m.parent_id == null).map((m) => m.id)),
    );
    const [filter, setFilter] = useState('');

    const selected = useMemo(
        () => modules.find((m) => m.id === selectedId) ?? null,
        [modules, selectedId],
    );

    const available = useMemo(
        () =>
            selected
                ? actionsForModuleKey(selected.key)
                : { core: [], workflow: [] },
        [selected],
    );

    const grantedSet = useMemo(
        () => new Set(selectedId != null ? (grants[selectedId] ?? []) : []),
        [grants, selectedId],
    );

    // Filtering keeps a module visible when it matches OR any descendant does,
    // so a hit deep in the tree never disappears with its parent.
    const visibleTree = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return tree;
        const prune = (nodes: TreeNode[]): TreeNode[] =>
            nodes
                .map((n) => ({ ...n, children: prune(n.children) }))
                .filter(
                    (n) =>
                        n.label.toLowerCase().includes(q) ||
                        n.path.toLowerCase().includes(q) ||
                        n.children.length > 0,
                );
        return prune(tree);
    }, [tree, filter]);

    function toggleExpand(id: number) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function setActions(moduleId: number, actions: string[]) {
        const next = { ...grants };
        if (actions.length === 0) delete next[moduleId];
        else next[moduleId] = actions;
        onChangeAction(next);
    }

    function toggleAction(action: PermissionAction) {
        if (readOnly || selectedId == null) return;
        const current = new Set(grants[selectedId] ?? []);
        if (current.has(action)) {
            current.delete(action);
            // View is the key to the door: without it the module's page
            // redirects, so dropping it drops everything else with it.
            if (action === 'view') current.clear();
        } else {
            current.add(action);
            current.add('view');
        }
        setActions(selectedId, [...current]);
    }

    function grantAll() {
        if (readOnly || selectedId == null) return;
        setActions(selectedId, [...available.core, ...available.workflow]);
    }

    function clearModule() {
        if (readOnly || selectedId == null) return;
        setActions(selectedId, []);
    }

    const totalGranted = Object.values(grants).reduce(
        (s, a) => s + a.length,
        0,
    );

    return (
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* ── Left: module tree ── */}
            <div className="min-w-0 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5">
                    <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <Layers size={13} className="text-[#1a9e52]" />
                        Modules
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                        {totalGranted} granted
                    </span>
                </div>
                <div className="border-b border-slate-100 p-2">
                    <input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Filter modules..."
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 placeholder-slate-300 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
                <div className="max-h-125 overflow-y-auto p-2">
                    {visibleTree.length === 0 ? (
                        <p className="py-6 text-center text-slate-400">
                            No modules match.
                        </p>
                    ) : (
                        <ul>
                            {visibleTree.map((node) => (
                                <TreeRow
                                    key={node.id}
                                    node={node}
                                    depth={0}
                                    grants={grants}
                                    selectedId={selectedId}
                                    onSelectAction={setSelectedId}
                                    expanded={expanded}
                                    onToggleAction={toggleExpand}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* ── Right: selected module's access rights ── */}
            <div className="min-w-0 rounded-xl border border-slate-200">
                {!selected ? (
                    <p className="p-8 text-center text-slate-400">
                        Select a module to set its access rights.
                    </p>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                <ShieldCheck
                                    size={13}
                                    className="text-[#1a9e52]"
                                />
                                {selected.label}
                            </span>
                            {!readOnly && (
                                <span className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={grantAll}
                                        className="rounded-lg border border-sky-200 px-2.5 py-1 text-sky-600 transition-colors hover:bg-sky-50"
                                    >
                                        Grant all
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearModule}
                                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-500 transition-colors hover:bg-slate-50"
                                    >
                                        Clear
                                    </button>
                                </span>
                            )}
                        </div>

                        <div className="space-y-5 p-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <FieldLabel>Module</FieldLabel>
                                    <ReadonlyInput value={selected.label} />
                                </div>
                                <div>
                                    <FieldLabel>Type</FieldLabel>
                                    <ReadonlyInput value={selected.type} />
                                </div>
                                <div className="sm:col-span-2">
                                    <FieldLabel>Path</FieldLabel>
                                    <ReadonlyInput value={selected.path} />
                                </div>
                            </div>

                            <ActionGroup
                                title="Access Rights"
                                actions={available.core}
                                granted={grantedSet}
                                onToggleAction={toggleAction}
                                readOnly={readOnly}
                            />
                            <ActionGroup
                                title="Workflow Actions"
                                actions={available.workflow}
                                granted={grantedSet}
                                onToggleAction={toggleAction}
                                readOnly={readOnly}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
