import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// CI enforcement gate: every mutating API handler (POST/PUT/PATCH/DELETE) must
// declare an authorization requirement (requirePermission or defineRoute). This
// fails the build if a new route ships without a guard — so the "no API bypasses
// the pipeline" guarantee cannot silently regress as modules are added.

const API_DIR = join(process.cwd(), 'app', 'api');
const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Auth endpoints are intentionally public (login/signup) or self-scoped (logout).
const ALLOWLIST = new Set([
    'auth/login/route.ts',
    'auth/logout/route.ts',
    'auth/signup/route.ts',
]);

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else if (entry === 'route.ts') out.push(p);
    }
    return out;
}

/** Strip line and block comments so commented-out handlers don't count. */
function stripComments(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

test('every mutating API route declares an authorization guard', () => {
    const files = walk(API_DIR);
    const gaps: string[] = [];

    for (const file of files) {
        const rel = file.slice(API_DIR.length + 1);
        if (ALLOWLIST.has(rel)) continue;
        const src = stripComments(readFileSync(file, 'utf8'));

        const handlerRe =
            /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;
        const handlers: { method: string; start: number }[] = [];
        let m: RegExpExecArray | null;
        while ((m = handlerRe.exec(src)))
            handlers.push({ method: m[1], start: m.index });

        for (let i = 0; i < handlers.length; i++) {
            const h = handlers[i];
            if (!MUTATING.includes(h.method)) continue;
            const end =
                i + 1 < handlers.length ? handlers[i + 1].start : src.length;
            const body = src.slice(h.start, end);
            const guarded =
                /requirePermission\s*\(/.test(body) ||
                /defineRoute\s*\(/.test(src);
            if (!guarded) gaps.push(`${rel}:${h.method}`);
        }
    }

    assert.deepEqual(
        gaps,
        [],
        `Unguarded mutating handlers found:\n  ${gaps.join('\n  ')}`,
    );
});

// Companion gate. assertRole() ranks the JWT's role NAME against a fixed
// hierarchy (super_admin/admin/member/staff/user); every role created through
// the role editor has a custom name and therefore ranks 0. Stacking it after
// requirePermission does not tighten anything — the grant already decides — but
// it silently denies every custom role, which is how "Access denied: requires
// role 'admin' or higher" reached a user who genuinely held setting.user.create.
// Authorize on the permission catalog; scope tenants in the repository.
test('no API route gates on the legacy role-name hierarchy', () => {
    const offenders: string[] = [];

    for (const file of walk(API_DIR)) {
        const src = stripComments(readFileSync(file, 'utf8'));
        if (/\bassertRole\s*\(/.test(src)) {
            offenders.push(file.slice(API_DIR.length + 1));
        }
    }

    assert.deepEqual(
        offenders,
        [],
        `assertRole() used in API routes — custom roles can never pass it:\n  ${offenders.join('\n  ')}`,
    );
});
