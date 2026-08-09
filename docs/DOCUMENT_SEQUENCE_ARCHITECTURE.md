# Core Document Sequence Numbering — Audit & Architecture

**Status:** BUILT AND VERIFIED. All 12 steps complete.
**Scope:** shared ERP infrastructure, owned by no single module.

## Decisions taken

| # | Decision | Outcome |
| --- | --- | --- |
| 1 | Cash Sale numbering | Own `cash_sale` type → `CS-000001`. Chosen because it is the same *storage* serving a different *business process*. |
| 2 | Receipt prefix | New companies seed `GRN`; existing keep `RCT` and change it in the UI. |
| 3 | Physical Count prefix | Kept `SC`. |
| 4 | Master-data codes | Hidden behind a "show internal reference codes" toggle. |
| 5 | "Step config" | A four-step wizard (General → Format → Reset → Review). No increment/step column was added. |

## What shipped

| Layer | Artifact |
| --- | --- |
| Pure formatter | `service/core/document-format.ts` — tokens, validation, `effectiveNextValue` |
| Registry | `service/core/document-types.ts` — 21 types, pure, client-safe |
| Migrations | `20260810000000` core · `20260810010000` allocate/render · `20260810020000` module + grants |
| Repository | `service/apps/setting/repo/document-sequence.ts` |
| API | `GET/POST /api/setting/document-sequence`, `GET/PATCH /[id]`, `POST /preview` |
| UI | `components/modules/setting/document-numbering/` — overview + wizard |
| Permission | `PERMISSIONS.setting.documentSequence` (view/create/update) |
| Tests | 271 total — 39 format, 26 registry, 12 database incl. concurrency |

## Verified in the running system

- **40 concurrent connections → 40 distinct numbers**, one contiguous block, counter advanced by exactly 40.
- **110 sequences render byte-identical** through the rewired path vs the original generator.
- Preview leaves the counter untouched (58 → 58); all four invalid configurations rejected with 400.
- A real Sales Order minted `SO-2026-000002` after reconfiguring the format through the API.
- A real Cash Sale minted `CS-000001` from the same table, distinguished by `source_channel`.

## Corrections made during implementation

Three defects were found and fixed by the verification itself, and are worth recording:

1. **SQL `lpad` truncates.** `lpad('1234567', 3, '0')` is `'123'`. A sequence outgrowing its padding would have silently dropped high digits and collided with an earlier document. Caught by the SQL-vs-TypeScript renderer agreement test; padding is now a minimum width in both.
2. **The preview lied across a period rollover.** Switching a sequence to yearly leaves `period_key` stale, so the next allocation restarts at 1 — but the preview read `next_value` directly and promised `SO-2026-000058`. `effectiveNextValue()` now mirrors the allocator's reset branch, and the settings screen resolves against the *candidate* rule.
3. **The database test suite silently skipped itself.** `node:test` evaluates `skip` when a test is defined and wants a boolean; a function is always truthy, so all 12 tests reported green while running nothing. Probed synchronously at module load now.

---

## 0. Headline finding

**A centralized document sequence system already exists, and it is sound.** It is
atomic, tenant-scoped, and every module already uses it — there is no rogue
numbering to hunt down. The legacy timestamp generator referenced in older notes
is **gone** (grep across `service/` returns nothing).

This work is therefore **an extension of existing infrastructure, not a new
system.** Building a second sequence service would be the single worst outcome
available here.

Three components exist today:

| Layer | Artifact | State |
| --- | --- | --- |
| Database | `document_sequence` table | Exists, needs 4 columns |
| Database | `next_document_number()` plpgsql function | Exists, atomic, needs formatting rework |
| Service | `getNextDocumentNumber(ctx, docType, prefix)` | Exists, 13 call sites, signature can stay |
| Types | `DocumentType` union (20 members) | Exists, needs to become the registry |
| API | — | **Missing entirely** |
| UI | — | **Missing entirely** |
| Permissions | — | **Missing entirely** |
| Tests | — | **Missing entirely** |

A second, independent finding that shapes the whole design: **the project already
contains a pure token-template engine with reset periods**, built for serial
numbers — [`service/apps/inventory/serial/strategies.ts`](../service/apps/inventory/serial/strategies.ts).
It supports `{PREFIX} {SEQ} {YYYY} {MM} {DD}` tokens and `never|yearly|monthly|daily`
resets, and is unit-tested with `node --test`. The document sequence formatter
must follow that same shape rather than invent a second template dialect.

---

## 1. Current sequence architecture

### 1.1 Storage

```sql
CREATE TABLE document_sequence (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id  INT         NOT NULL REFERENCES company(id),
    doc_type    VARCHAR(30) NOT NULL,
    prefix      VARCHAR(10) NOT NULL,
    padding     INT         NOT NULL DEFAULT 6,
    reset_rule  VARCHAR(10) NOT NULL DEFAULT 'never',   -- never | yearly
    period_key  VARCHAR(10) NOT NULL DEFAULT '',
    next_value  BIGINT      NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_sequence UNIQUE (company_id, doc_type),
    CONSTRAINT chk_document_sequence_reset CHECK (reset_rule IN ('never','yearly'))
);
```

Configuration and counter live in **one row**. Section 3 argues this should stay
that way.

### 1.2 Allocation

`next_document_number(p_company_id, p_doc_type, p_default_prefix)`:

1. `INSERT … ON CONFLICT DO NOTHING` — lazily seeds the row, so a new module
   needs no migration.
2. A single `UPDATE … RETURNING` that increments the counter, applies the yearly
   reset, and formats the string in the same statement.

The format is **hardcoded in SQL**:

```
prefix || '-' || (yearly ? period_key || '-' : '') || lpad(n, padding, '0')
```

### 1.3 Consumption

`getNextDocumentNumber()` in [`service/core/document-number.ts`](../service/core/document-number.ts)
is a thin typed wrapper over the RPC. Verified call sites:

| Doc type | Prefix | Repository |
| --- | --- | --- |
| `sales_order` | `SO` | `sale/repo/order.ts` |
| `sales_shipment` | `SHP` | `sale/repo/shipment.ts` |
| `sales_invoice` | `INV` | `sale/repo/invoice.ts` |
| `customer_payment` | `PAY` | `sale/repo/payment.ts` |
| `inventory_receipt` | `RCT` | `inventory/repo/receipt.ts` |
| `inventory_movement` | `MOV` | `inventory/repo/movement.ts` |
| `stock_adjustment` | `ADJ` | `inventory/repo/adjustment.ts` |
| `stock_count` | `SC` | `inventory/repo/stock-count.ts` |
| `stock_item` / `non_stock_item` / `service_item` | `STCK`/`NSTK`/`SRVC` | `inventory/repo/stock.ts` |
| `item_category` | `C` | `inventory/repo/category.ts` |
| `item_uom` | `IUOM` | `inventory/repo/item-uom.ts` |
| `business_partner` | `BP` | `master-data/business-partner/index.ts` |

### 1.4 The final backstop

Every document header carries a per-tenant unique constraint on its number
column — `sales_order`, `sales_shipment`, `sales_invoice`, `customer_payment`,
`stock_adjustment`, `stock_count`, `receipt_transaction`, `inventory_movement`.
Even a catastrophic sequence bug cannot produce two documents with the same
number; it produces a failed insert instead. **This is the strongest single fact
in the current design and it must be preserved.**

---

## 2. Problems in the current implementation

Ordered by severity.

**P1 — Format is not configurable.** The separator (`-`), the token order, and
the presence of the year are baked into the SQL. `SO/2026/000001` and
`INV-2026-08-000001` are unreachable. This is the core of the request.

**P2 — Reset policy is `never | yearly` only.** A `CHECK` constraint actively
rejects `monthly`. The serial engine already models `monthly` and `daily`; the
document engine is behind its own sibling.

**P3 — No configuration surface.** No API route, no UI, no permission, no
`modules` row. Prefixes are only changeable by hand-editing rows in the database,
which in practice means they are hard-coded from an administrator's point of
view. This is precisely the complaint that opened this work.

**P4 — Coupled formatting and allocation.** Because formatting happens inside
the allocating `UPDATE`, a **preview cannot reuse the real formatter** without
consuming a number. Any preview built on today's function would either burn
numbers or reimplement the format — two sources of truth, guaranteed drift.

**P5 — No audit columns.** The project's audit framework puts
`created_by`/`updated_by` on all 18 masters. `document_sequence` has
`created_at`/`updated_at` and a `fn_set_updated_at` trigger but no actor columns
— so once the UI exists, "who changed the invoice prefix" is unanswerable.

**P6 — `doc_type` is an unconstrained `VARCHAR(30)`.** The TypeScript union is
the only thing preventing typos; the database accepts anything. A typo mints a
whole new sequence silently rather than failing.

**P7 — No tests.** Nothing covers allocation, reset boundaries, or formatting.
The concurrency guarantee is asserted in a comment, not verified.

**P8 — `CASH_SALE` has no document type.** Cash Sale is an orchestrator over the
sales order chain and emits `SO-` numbers. The requested `CS-2026-000001` does
not exist today. This is a **business decision, not a bug** — see §10.

**P9 — Minor: `prefix VARCHAR(10)`** is tight once prefixes become
administrator-editable, and the RPC is `SECURITY INVOKER` with no `REVOKE`, so it
is callable by `authenticated` via PostgREST. RLS deny-all means it cannot
actually leak or consume another tenant's sequence, but an explicit `REVOKE` is
cheap defence in depth.

### 2.1 Is it concurrency-safe? **Yes.**

`UPDATE … RETURNING` takes a row-level exclusive lock. Concurrent callers for the
same `(company_id, doc_type)` serialize on that lock and each observe a distinct
`next_value`. There is no read-then-write race. The pattern the brief warns
against is **not** present.

The reset is evaluated *inside* the same `UPDATE`, so a year boundary crossed by
two simultaneous callers cannot produce two `…-000001`.

### 2.2 Is it tenant-safe? **Yes, at the application boundary.**

`company_id` comes from `ctx.companyId` (the verified JWT session), the unique
key is `(company_id, doc_type)`, and the `UPDATE` is filtered on both. A caller
cannot consume another tenant's sequence. The caveat is the standard one for
this codebase: the service-role client bypasses RLS, so tenancy is enforced in
the application layer, exactly as everywhere else.

---

## 3. Proposed database design

**Keep one table.** The brief asks whether config and counter should be split.
They should not, here:

- The counter is already updated by a single atomic statement; splitting adds a
  join to every allocation for no concurrency gain.
- The lock is held for microseconds, on a row touched only by allocation.
- One row per `(company, doc_type)` means the config UI reads and writes one row.

Splitting pays off only when one config drives *many* counters (per-warehouse,
per-item). That is the serial engine's problem, and the serial engine already
solves it separately. Document numbers are one counter per type per tenant.

```sql
ALTER TABLE document_sequence
    ADD COLUMN format      VARCHAR(120) NOT NULL DEFAULT '{PREFIX}-{NUMBER}',
    ADD COLUMN is_active   BOOLEAN      NOT NULL DEFAULT true,
    ADD COLUMN created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE document_sequence
    ALTER COLUMN prefix TYPE VARCHAR(20),
    ALTER COLUMN period_key TYPE VARCHAR(10);   -- 'YYYY-MM-DD' fits

ALTER TABLE document_sequence
    DROP CONSTRAINT chk_document_sequence_reset,
    ADD  CONSTRAINT chk_document_sequence_reset
         CHECK (reset_rule IN ('never','yearly','monthly','daily'));

ALTER TABLE document_sequence
    ADD CONSTRAINT chk_document_sequence_padding
        CHECK (padding BETWEEN 1 AND 12),
    -- a format without the counter would mint duplicates
    ADD CONSTRAINT chk_document_sequence_format
        CHECK (format LIKE '%{NUMBER}%'),
    ADD CONSTRAINT chk_document_sequence_doc_type
        CHECK (doc_type ~ '^[a-z][a-z0-9_]*$');
```

`uq_document_sequence UNIQUE (company_id, doc_type)` already satisfies the
brief's uniqueness requirement and stays as-is. Note it is unique **regardless of
`is_active`** — deliberately, because a deactivated row must still hold its
counter (§8).

The `chk_document_sequence_format` check is the load-bearing one: a format
missing `{NUMBER}` would render a constant string for every document, and the
per-company unique index on the document table would then reject every insert
after the first. Better to make it unsavable.

---

## 4. Document Type design

The `DocumentType` union in `service/core/document-number.ts` is **already** a
stable-identifier registry with 20 members. It becomes the single registry,
promoted from a bare union to a described catalog, mirroring how `PERMISSIONS`
is structured:

```ts
export const DOCUMENT_TYPES = {
    sales_order:       { label: 'Sales Order',       prefix: 'SO',   group: 'sales' },
    cash_sale:         { label: 'Cash Sale',         prefix: 'CS',   group: 'sales' },
    sales_shipment:    { label: 'Shipment',          prefix: 'SHP',  group: 'sales' },
    sales_invoice:     { label: 'Invoice',           prefix: 'INV',  group: 'sales' },
    customer_payment:  { label: 'Payment',           prefix: 'PAY',  group: 'sales' },
    inventory_receipt: { label: 'Goods Receipt',     prefix: 'GRN',  group: 'inventory' },
    stock_adjustment:  { label: 'Stock Adjustment',  prefix: 'ADJ',  group: 'inventory' },
    stock_count:       { label: 'Physical Count',    prefix: 'PC',   group: 'inventory' },
    // … master data and future types
} as const satisfies Record<string, DocumentTypeMeta>;

export type DocumentType = keyof typeof DOCUMENT_TYPES;
```

Identifiers stay `snake_case` to match the 13 existing call sites and the rows
already in `document_sequence`. **The brief's `SALES_ORDER` casing is not
adopted** — renaming would orphan every existing sequence row and every
production counter for zero functional gain. The principle the brief actually
cares about (stable identifier ≠ display label) is already satisfied: `label` is
the only thing an administrator sees, and it is free to change.

Master-data types (`stock_item`, `item_category`, `business_partner`, …) are
tagged `group: 'master'` and **hidden from the configuration UI by default**.
They mint internal reference codes, not business documents; exposing them invites
an administrator to reformat SKU codes that are printed on labels.

---

## 5. Sequence configuration design

| Field | Source | Editable |
| --- | --- | --- |
| `company_id` | session | no |
| `doc_type` | registry | no (identity) |
| `prefix` | config | yes |
| `format` | config | yes |
| `padding` | config | yes (1–12) |
| `reset_rule` | config | yes |
| `is_active` | config | yes |
| `next_value` | counter | **no — see below** |
| `period_key` | counter | no |
| `created_by` / `updated_by` | audit framework | no |

`next_value` is deliberately **not** editable through the normal update path. A
careless edit backwards mints numbers that collide with existing documents —
which the per-company unique index will reject, turning a config mistake into a
production outage at document-creation time. If manual advancement is ever
needed it should be a distinct, separately-permissioned action
(`document_sequence.reset`), not a field on a form.

---

## 6. Number format design

Formatting moves **out of SQL and into a pure TypeScript renderer**, exactly
mirroring the serial engine (`next_serial_block` allocates, `renderSerials`
formats). This is the pivotal design decision and it resolves P4 directly.

```ts
// service/core/document-format.ts — pure, no imports, node:test friendly
export type DocumentFormatContext = {
    prefix: string;
    sequence: number;
    padding: number;
    now: Date;              // injectable → deterministic tests
};

export function renderDocumentNumber(format: string, ctx: DocumentFormatContext): string
```

Supported tokens — a **closed set**, substituted by literal string replacement.
There is no expression evaluation, no `eval`, no user-supplied code path:

| Token | Renders | Example |
| --- | --- | --- |
| `{PREFIX}` | configured prefix | `SO` |
| `{YEAR}` | 4-digit year | `2026` |
| `{YY}` | 2-digit year | `26` |
| `{MONTH}` | zero-padded month | `08` |
| `{DAY}` | zero-padded day | `09` |
| `{NUMBER}` | counter, `padding` wide | `000001` |

Any unknown `{TOKEN}` is a **validation error at save time**, not a silent
passthrough — otherwise a typo like `{YAER}` ships to production embedded in
every document number.

```
{PREFIX}-{YEAR}-{NUMBER}          → SO-2026-000001
{PREFIX}/{YEAR}/{NUMBER}          → SO/2026/000001
{PREFIX}-{YEAR}-{MONTH}-{NUMBER}  → INV-2026-08-000001
{PREFIX}-{NUMBER}                 → CS-000001
```

Because the renderer is pure, **preview and generation call the same function**.
A preview that disagrees with reality becomes impossible by construction.

---

## 7. Reset policy design

| Policy | `period_key` | Behaviour |
| --- | --- | --- |
| `never` | `''` | Counter runs forever. |
| `yearly` | `2026` | Resets to 1 on the first allocation of a new calendar year. |
| `monthly` | `2026-08` | Resets to 1 on the first allocation of a new month. |
| `daily` | `2026-08-09` | Resets to 1 on the first allocation of a new day. |

**Exact semantics.** The reset is *lazy and allocation-triggered*: nothing runs
at midnight. The first allocation after the boundary observes
`period_key <> current_period`, and in the same atomic `UPDATE` sets the counter
to 1 and stamps the new `period_key`. A month with zero documents simply never
appears — there is no empty-period bookkeeping.

The period is computed from the **database clock** (`NOW()`), in the database's
timezone, not the browser's. Stated explicitly because a company operating across
midnight UTC will otherwise see a document dated the 9th numbered `…-08-…`.

**A reset policy is only meaningful if the format carries the matching token.**
`reset_rule = 'monthly'` with format `{PREFIX}-{NUMBER}` produces `SO-000001`
twice — once in August, once in September — and the unique index rejects the
second. The configuration UI must therefore **refuse to save** a reset policy
whose period token is absent from the format, and the API must enforce the same
rule. This is the single easiest way for an administrator to break production,
so it is a validation rule, not a warning.

| `reset_rule` | Format must contain |
| --- | --- |
| `never` | — |
| `yearly` | `{YEAR}` or `{YY}` |
| `monthly` | (`{YEAR}` or `{YY}`) **and** `{MONTH}` |
| `daily` | (`{YEAR}` or `{YY}`) and `{MONTH}` and `{DAY}` |

---

## 8. Concurrency strategy

**Keep the existing mechanism. It is already correct.** A single
`UPDATE … RETURNING` on the sequence row:

```sql
UPDATE document_sequence
   SET next_value = CASE WHEN reset_rule <> 'never' AND period_key <> v_period
                         THEN 2 ELSE next_value + 1 END,
       period_key = CASE WHEN reset_rule <> 'never' THEN v_period ELSE period_key END
 WHERE company_id = p_company_id AND doc_type = p_doc_type AND is_active
RETURNING (CASE WHEN … THEN 1 ELSE next_value - 1 END) AS allocated, prefix, padding, format;
```

Why this and not the alternatives:

- **Postgres native `SEQUENCE` objects** — rejected. They cannot be reset per
  period without DDL, cannot be scoped per tenant without creating one sequence
  object per `(company, doc_type)` (unbounded DDL growth), and are explicitly
  non-transactional in a way that gives *worse* gap behaviour, not better.
- **Advisory locks** — rejected. Equivalent serialization with worse
  observability and a leak risk if a connection dies mid-transaction.
- **`SELECT … FOR UPDATE` then `UPDATE`** — rejected. Two round trips and a
  longer lock hold for an identical guarantee.

The row lock is held for the duration of a single statement. Contention is
per `(company, doc_type)`, so Sales Orders never block Invoices, and Company A
never blocks Company B.

The **only** change to the allocation statement is that it now returns the raw
number plus the config, rather than a pre-formatted string. `is_active` is added
to the `WHERE` clause so a deactivated sequence fails loudly instead of silently
minting.

---

## 9. Transaction & rollback strategy

**Recommendation: allocate in its own transaction, immediately before the header
insert. Accept gaps.**

Today, `getNextDocumentNumber()` is a standalone PostgREST call, so it commits
before the document insert runs. If the insert then fails, the number is burned.

That is the correct trade-off, and it should be kept deliberately rather than by
accident:

| Property | Allocate in own txn (proposed) | Allocate inside document txn |
| --- | --- | --- |
| Uniqueness | Guaranteed | Guaranteed |
| Concurrency | Lock held ~1ms | Lock held for the whole document insert — **all concurrent sales orders serialize** |
| Rollback | Number burned → gap | Number returned → fewer gaps |
| Gapless | No | **Still no** — crashes, timeouts, and post-commit failures all leak numbers |
| Auditability | Gap = evidence a create attempt failed | Gaps hidden |

The decisive row is *Gapless*. Holding the lock across the document transaction
costs real throughput and **still does not deliver gapless numbering** — it only
narrows the window. Paying a serialization penalty for a guarantee you do not
actually obtain is the worst of both worlds.

If a jurisdiction ever mandates gapless fiscal numbering, the correct answer is a
separate, explicitly-serialized *fiscal* number assigned at posting time, layered
on top of this infrastructure — not a weakening of it.

**Answering the brief's A/B/C/D directly: (B) after validation, immediately
before insert.** Validating first means a request rejected for bad input costs no
number, which removes the overwhelming majority of avoidable gaps at zero
concurrency cost.

---

## 10. Draft / lifecycle strategy

The brief is right that lifecycles differ. Current behaviour is uniform: **every
document is numbered at draft creation.** Recommendation — keep it, with one
documented exception path.

| Document | Number at | Rationale |
| --- | --- | --- |
| Sales Order | Draft create | Users quote the SO number on the phone before confirmation |
| Cash Sale | Create (single step) | No draft state; created and posted atomically |
| Shipment | Draft create | Pickers work from a printed draft delivery note |
| Invoice | Draft create | See note below |
| Inventory Receipt | Draft create | Warehouse staff reconcile against the GRN while unpacking |
| Stock Adjustment | Draft create | Referenced in the approval conversation |
| Physical Count | Draft create | Count sheets are printed and distributed before counting |
| Payment | Create | Receipt handed to the customer immediately |

Numbering at draft is right for this ERP because in every one of these flows a
**human refers to the document before it is posted**. A draft with no number is
a document that cannot be discussed, printed, or searched for.

The cost is that abandoned drafts consume numbers. That is the intended
trade-off, and §9 already accepts gaps.

**Invoice is the one to revisit** if fiscal compliance ever demands it — many
jurisdictions require invoice numbers to be gapless and assigned at posting. The
architecture supports this without redesign: give `sales_invoice` a second
`fiscal_no` column allocated from a `sales_invoice_fiscal` document type at post
time. **Not in scope now**, but the design must not preclude it — and it does not,
because doc types are data.

**Cash Sale (P8).** Cash Sale currently produces `SO-` numbers because it is an
orchestrator over the sales order chain, not a separate document. Emitting
`CS-2026-000001` means one of:

- **(a)** Give the cash-sale-created order a distinct number from a `cash_sale`
  sequence. One line in the orchestrator; the order table is unaffected because
  `order_no` is just a string. Cash sales become instantly distinguishable in
  the order list.
- **(b)** Leave as-is. Cash sales remain sales orders in every report.

**Recommendation: (a)**, because the brief explicitly asks for `CS-` and because
distinguishing walk-in revenue from ordered revenue at a glance is genuinely
useful. It is a one-line change guarded by a new doc type, and it is reversible.
Flagging it as a **business decision requiring your confirmation** — it changes
what appears in the order list for future cash sales (existing rows are
untouched).

---

## 11. Tenant isolation strategy

Unchanged from today, because today is already correct:

- `company_id` is taken from the verified session (`ctx.companyId`), never from
  the request body.
- The unique key is `(company_id, doc_type)`; the allocating `UPDATE` filters on
  both.
- Every config API route resolves `company_id` from the session and scopes reads
  and writes through `BaseRepository.applyScope()`.
- Two tenants legitimately holding `SO-2026-000001` is expected and correct.
- Additionally: `REVOKE EXECUTE … FROM anon, authenticated` on the allocation
  function (P9). RLS deny-all already prevents misuse; this makes it explicit.

Super users acting across companies go through the existing audited super-user
path — no new bypass is introduced.

---

## 12. API design

Following the project's `defineRoute` + `requirePermission` + `parseListParams`
conventions.

| Method | Route | Permission | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/setting/document-sequence` | `document_sequence.view` | List via the core query framework |
| `GET` | `/api/setting/document-sequence/[id]` | `document_sequence.view` | One config |
| `POST` | `/api/setting/document-sequence` | `document_sequence.create` | Create for an unconfigured doc type |
| `PATCH` | `/api/setting/document-sequence/[id]` | `document_sequence.update` | Prefix / format / padding / reset / active |
| `POST` | `/api/setting/document-sequence/preview` | `document_sequence.view` | **Pure. Consumes nothing.** |

`DELETE` is deliberately **absent**. Deleting a sequence discards a live counter;
the next allocation would lazily re-seed at 1 and collide with every existing
document. `is_active = false` is the supported way to retire one, and the counter
survives. If a delete action is ever added it must refuse when
`next_value > 1`.

**Preview** takes an unsaved candidate config `{ format, prefix, padding, reset_rule }`
and returns `renderDocumentNumber(...)` against `next_value` **read, never
written**. It is a `POST` only because it carries a body — it performs no
mutation. This satisfies the brief's hard requirement that preview must not
consume the sequence: the preview path has no `UPDATE` in it at all.

---

## 13. Service API design

`getNextDocumentNumber(ctx, docType, defaultPrefix)` **keeps its exact
signature** — all 13 call sites compile unchanged. Its body changes:

```
getNextDocumentNumber(ctx, docType, defaultPrefix)
  └─ rpc allocate_document_number(company_id, doc_type, default_prefix)
        └─ returns { allocated, prefix, padding, format }   ← atomic
  └─ renderDocumentNumber(format, { prefix, sequence: allocated, padding, now })
  └─ returns "SO-2026-000001"
```

The old `next_document_number()` function is **retained**, reimplemented over the
same primitive, because migration `20260721010000_master_data_business_partner.sql`
calls it from SQL and replay must keep working.

Business modules continue to call exactly one function. No module gains any
knowledge of formats, resets, or padding.

---

## 14. Frontend design

New settings page at `/setting/document-numbering`, reusing the established
document-page primitives (`FormHeader` / `HeaderAction` / `SectionCard` /
`FieldGrid` from `components/ui/FormShell.tsx`), so it matches every other screen
without new design work.

Closest existing precedent to follow: `components/modules/inventory/setting/SerialSettingPage.tsx`
— same problem shape (prefix, padding, reset rule, live preview).

```
Document Numbering                          [ Discard ]  [ Save ]

  Sales ─────────────────────────────────────────────────────────
   Sales Order      SO    {PREFIX}-{YEAR}-{NUMBER}   Yearly    ● Active
                    Preview:  SO-2026-000125
   Cash Sale        CS    {PREFIX}-{YEAR}-{NUMBER}   Yearly    ● Active
                    Preview:  CS-2026-000001
   Invoice          INV   {PREFIX}-{YEAR}-{NUMBER}   Yearly    ● Active
                    Preview:  INV-2026-000087

  Inventory ─────────────────────────────────────────────────────
   Goods Receipt    GRN   {PREFIX}-{YEAR}-{NUMBER}   Yearly    ● Active
                    Preview:  GRN-2026-000042
```

**UX principles**, addressing the brief's "avoid making administrators understand
implementation details":

- The preview updates **as you type**, rendered by the same pure function the
  server uses. It is the primary feedback mechanism — an administrator should
  never need to reason about what `{PREFIX}-{YEAR}-{NUMBER}` means, because the
  example is on screen.
- Format is chosen from a **preset dropdown** (`SO-2026-000001`,
  `SO/2026/000001`, `SO-2026-08-000001`, `SO-000001`) with "Custom…" revealing
  the raw token field. Most administrators never see a token.
- Reset policy options **disable themselves** with an inline explanation when the
  current format lacks the required token ("Monthly reset needs {MONTH} in the
  format"), enforcing §7's rule before the request is sent.
- Current counter is shown **read-only** as "Last issued: SO-2026-000124".
- Grouped by `DOCUMENT_TYPES.group`; master-data types hidden behind a
  "Show internal reference codes" toggle.

---

## 15. Permission design

Added to the existing typed catalog in `service/core/authz/permissions.ts`:

```ts
setting: {
    …,
    documentSequence: res(
        '/setting/document-numbering',
        'setting.document_sequence',
        ['view', 'create', 'update'],
    ),
},
```

No hard-coded role checks — `assertRole` is banned in API routes and CI-enforced.
`delete` is omitted to match §12. A separate `reset` action is left for a future
counter-advancement feature.

Requires a `modules` row **and** `role_module_action_permission` seeds. Per the
project's hard-won lesson, a new module row without action-permission seeds
renders the page as a 404 → `/unauthorized`. The migration must seed both.

---

## 16. Audit design

Use the existing framework, add nothing new:

- `created_by` / `updated_by` columns (§3), stamped via `BaseRepository.stampCreate()`
  and `stampUpdate()`.
- `fn_set_updated_at` trigger already exists on the table.
- Immutable `created_by` enforced by the standard DB trigger.
- The `AuditInformationCard` component renders the metadata on the config page
  with no bespoke code.

Configuration changes are therefore auditable through exactly the same mechanism
as every other master record.

---

## 17. Migration strategy

**Non-negotiable: no existing document number changes, and no counter resets.**
Existing numbers are stored strings on already-inserted rows; nothing in this
plan rewrites them.

The one real hazard is a **format change mid-year**. Today all seeded rows are
`reset_rule = 'never'`, producing `SO-000057`. Switching to
`{PREFIX}-{YEAR}-{NUMBER}` with `yearly` reset would set the counter back to 1
and mint `SO-2026-000001` — which does **not** collide with `SO-000057`
(different string), so the unique index holds. But switching to
`{PREFIX}-{NUMBER}` while leaving the counter would be fine, whereas switching
*back* later could collide.

**Therefore: the migration changes no company's live format.** It backfills each
existing row with the format that reproduces its current output exactly:

```sql
UPDATE document_sequence
   SET format = CASE WHEN reset_rule = 'yearly'
                     THEN '{PREFIX}-{YEAR}-{NUMBER}'
                     ELSE '{PREFIX}-{NUMBER}' END
 WHERE format IS NULL;
```

This is a **provable no-op**: those two templates render byte-identical output to
the current hardcoded SQL for `never` and `yearly` respectively. Adopting
`SO-2026-…` becomes a deliberate administrator action in the new UI, not
something a deployment does silently.

Migration steps:

1. `20260810000000_document_sequence_core.sql` — add columns, widen `prefix`,
   relax the reset check, add the new checks, backfill `format`, `REVOKE EXECUTE`.
2. Seed `cash_sale` (and any missing types) for existing companies — additive.
3. Add the `modules` row + `role_module_action_permission` seeds.
4. Verify counters unchanged: `SELECT doc_type, next_value FROM document_sequence`
   before and after must be identical.

**Highest-number backfill is not required** — counters were never lost, because
the current system already owns them. This is precisely the benefit of extending
rather than replacing.

`.gitignore` swallows `supabase/`, so every migration needs `git add -f`.

---

## 18. Testing strategy

Pure logic under `node --test` (matching `tests/uom-conversion.test.ts`), DB
behaviour verified against local Postgres.

**`tests/document-format.test.ts`** — pure, fast, no database:
- every token renders; padding is respected; `padding` narrower than the number
  does not truncate
- all four brief examples render exactly
- unknown token rejected; `{NUMBER}`-less format rejected
- reset/format compatibility matrix (§7) — all 4 policies × valid and invalid formats
- injected clock → year/month/day boundaries are deterministic

**`tests/document-sequence.test.ts`** — config rules, pure:
- invalid padding (0, 13), invalid reset rule, duplicate doc type
- unknown doc type rejected against the registry
- preview never mutates (asserted on a spy)

**Database tests** (script against local Postgres, rolled back):
- first number, then strict sequential allocation
- two doc types in one company do not interfere
- two companies on the same doc type do not interfere
- yearly boundary → resets to 1; monthly boundary → resets to 1; `never` → no reset
- `is_active = false` → allocation fails loudly rather than minting
- **Concurrency: N parallel connections allocating simultaneously → N distinct
  numbers, counter advanced by exactly N, zero duplicates.** This is the test
  that actually validates §8, and it is the one currently missing entirely.

**Security:**
- cross-tenant allocation attempt scoped out
- unauthorized user rejected by `requirePermission`
- config route coverage added to the existing `authz-route-coverage` CI gate

**Regression:**
- all 13 existing call sites still compile and mint
- pre-migration vs post-migration output byte-identical for `never` and `yearly`
- existing document numbers unchanged (row-level diff)

---

## Step-by-step implementation plan

Sequenced so that each step is independently verifiable and nothing is
integrated before the core is proven.

| # | Step | Deliverable | Gate |
| --- | --- | --- | --- |
| 1 | Pure formatter | `service/core/document-format.ts` + tests | `node --test` green, no DB needed |
| 2 | Document type registry | `DOCUMENT_TYPES` catalog; `DocumentType` derived from it | tsc green, 13 call sites untouched |
| 3 | Migration | Columns, constraints, format backfill, `REVOKE` | Counters byte-identical before/after |
| 4 | Allocation RPC | `allocate_document_number` returning raw + config | Concurrency test passes |
| 5 | Rewire the service | `getNextDocumentNumber` body only; signature unchanged | All 13 sites mint identical output to before |
| 6 | **Verify no regression** | Run every document-creating flow | Numbers unchanged in shape |
| 7 | Repository + API | Config CRUD + preview | Route coverage gate passes |
| 8 | Permissions + modules row | Catalog entry, `modules` row, action seeds | Page opens for a granted role |
| 9 | UI | Settings page with live preview | Manual verification |
| 10 | **Integrate one module** | Switch Sales Order to `{PREFIX}-{YEAR}-{NUMBER}` via the UI | End-to-end: order gets `SO-2026-…` |
| 11 | Cash Sale doc type | `cash_sale` → `CS-` (pending your decision, §10) | Cash sale mints `CS-` |
| 12 | Remaining modules | Nothing to migrate — all already use the service | — |

Steps 1–6 change **no observable behaviour**: they refactor where formatting
happens while producing identical output. That is the safety property that makes
this plan low-risk — the system is fully working and fully tested before any
administrator can change anything.

Step 12 is empty by design, and that is the point of the audit: because every
module already routes through one service, there is no per-module migration to
do. The `Sales → Inventory → Payment` fan-in the brief asks for **already exists**;
this work makes it configurable.

---

## Decisions needed before implementation

1. **Cash Sale (§10)** — mint `CS-` from a new doc type, or keep `SO-`?
   Recommendation: `CS-`.
2. **Receipt prefix** — the brief says `GRN`, the system currently mints `RCT`.
   Changing it affects only *future* receipts. Recommendation: default new
   companies to `GRN`, leave existing companies on `RCT` and let them change it
   in the UI.
3. **Physical Count prefix** — your brief lists `PHYSICAL_COUNT` as a document
   type but gives no prefix example; the system currently mints `SC`. Confirm
   whether to keep `SC` or default new companies to something else.
4. **Master-data types** — confirm they stay hidden from the config UI.
