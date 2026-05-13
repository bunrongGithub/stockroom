'use client';

import { useCallback, useEffect, useState } from 'react';

type Item = {
  id: number;
  name: string;
  reference_no: string;
  created_at?: string;
};

type FormState = { name: string; reference_no: string };
type Mode = 'idle' | 'create' | 'edit';

const EMPTY_FORM: FormState = { name: '', reference_no: '' };

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // ─── Data fetching ────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/category');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json.error === 'string'
            ? json.error
            : 'Failed to fetch categories',
        );
      }
      setItems(json.data ?? []);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to load items',
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const boot = window.setTimeout(() => {
      void fetchItems();
    }, 0);

    return () => {
      window.clearTimeout(boot);
    };
  }, [fetchItems]);

  // ─── Toast ────────────────────────────────────────────────────────────────
  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ─── Form helpers ─────────────────────────────────────────────────────────
  function openCreate() {
    setForm(EMPTY_FORM);
    setErrors({});
    setEditingId(null);
    setMode('create');
  }

  function openEdit(item: Item) {
    setForm({ name: item.name, reference_no: item.reference_no });
    setErrors({});
    setEditingId(item.id);
    setMode('edit');
  }

  function closeForm() {
    setMode('idle');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function validate(): boolean {
    const errs: Partial<FormState> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    else if (form.name.length > 100) errs.name = 'Max 100 characters';
    if (!form.reference_no.trim()) errs.reference_no = 'Reference No is required';
    else if (form.reference_no.length > 500) errs.reference_no = 'Max 500 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ─── CRUD actions ─────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const isEdit = mode === 'edit' && editingId;
      const res = await fetch(isEdit ? `/api/category/${editingId}` : '/api/category', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = typeof json.error === 'string' ? json.error : 'Validation failed';
        showToast(msg, 'error');
        return;
      }
      showToast(isEdit ? 'Item updated' : 'Item created', 'success');
      closeForm();
      fetchItems();
    } catch {
      showToast('Something went wrong', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this item?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/category/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Item deleted', 'success');
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      showToast('Failed to delete item', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        :root {
          --bg: #0d0d0f;
          --surface: #17171a;
          --surface2: #1f1f24;
          --border: #2a2a30;
          --border2: #3a3a42;
          --text: #f0f0f2;
          --text2: #8b8b96;
          --text3: #5a5a65;
          --accent: #7c6af7;
          --accent-soft: #7c6af718;
          --accent-hover: #9280f9;
          --success: #4ade80;
          --success-soft: #4ade8018;
          --danger: #f87171;
          --danger-soft: #f8717118;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, textarea {
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          background: var(--surface2);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 8px;
          padding: 10px 12px;
          width: 100%;
          outline: none;
          transition: border-color .15s;
        }
        input:focus, textarea:focus { border-color: var(--accent); }
        input.err, textarea.err { border-color: var(--danger); }
        button { cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: 500; border: none; border-radius: 8px; transition: all .15s; }
        .btn-primary {
          background: var(--accent); color: #fff; padding: 10px 20px; font-size: 13px;
        }
        .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
        .btn-ghost {
          background: transparent; color: var(--text2); padding: 10px 16px; font-size: 13px;
          border: 1px solid var(--border);
        }
        .btn-ghost:hover { border-color: var(--border2); color: var(--text); }
        .btn-danger {
          background: var(--danger-soft); color: var(--danger); padding: 6px 12px; font-size: 12px;
        }
        .btn-danger:hover:not(:disabled) { background: #f8717130; }
        .btn-danger:disabled { opacity: .4; cursor: not-allowed; }
        .btn-edit {
          background: var(--accent-soft); color: var(--accent); padding: 6px 12px; font-size: 12px;
        }
        .btn-edit:hover { background: #7c6af726; }
        .tag {
          display: inline-block;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 4px;
          background: var(--surface2);
          border: 1px solid var(--border);
          color: var(--text2);
          max-width: 260px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .overlay {
          position: fixed; inset: 0; background: #00000088; backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 100;
          animation: fadeIn .15s ease;
        }
        .modal {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 16px; padding: 28px; width: 100%; max-width: 420px;
          animation: slideUp .2s ease;
        }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .toast {
          position: fixed; bottom: 24px; right: 24px; z-index: 200;
          padding: 12px 18px; border-radius: 10px; font-size: 13px; font-weight: 500;
          animation: slideUp .2s ease;
          border: 1px solid;
        }
        .toast.success { background: var(--success-soft); color: var(--success); border-color: #4ade8040; }
        .toast.error { background: var(--danger-soft); color: var(--danger); border-color: #f8717140; }
        .skeleton { background: var(--surface2); border-radius: 6px; animation: pulse 1.4s ease infinite; }
        @keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        .row:hover { background: #ffffff05; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.3px' }}>Items</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{items.length} total</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ New item</button>
      </div>

      {/* Table */}
      <div style={{ padding: '24px 32px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>◇</div>
            <p style={{ fontSize: 14 }}>No items yet. Create your first one.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Reference No', 'Created', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--text3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="row" style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}>
                  <td style={{ padding: '14px 12px', fontSize: 14, fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '14px 12px' }}><span className="tag">{item.reference_no}</span></td>
                  <td style={{ padding: '14px 12px', fontSize: 12, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn-edit" onClick={() => openEdit(item)}>Edit</button>
                      <button
                        className="btn-danger"
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item.id)}
                      >
                        {deletingId === item.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {mode !== 'idle' && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && closeForm()}>
          <div className="modal">
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              {mode === 'create' ? 'New item' : 'Edit item'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
              {mode === 'create' ? 'Fill in the details below.' : 'Update the fields you want to change.'}
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  Name
                </label>
                <input
                  className={errors.name ? 'err' : ''}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. api_key"
                  autoFocus
                />
                {errors.name && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errors.name}</p>}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  Reference No
                </label>
                <textarea
                  className={errors.reference_no ? 'err' : ''}
                  value={form.reference_no}
                  onChange={(e) => setForm((f) => ({ ...f, reference_no: e.target.value }))}
                  placeholder="e.g. PHONE-ACCESSORY"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
                {errors.reference_no && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errors.reference_no}</p>}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
