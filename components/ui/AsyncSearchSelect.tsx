'use client';

import { ChevronDown, Loader2, Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FieldLabel } from './FieldLabel';
import PopUpSearch from './PopUpSearch';
import { PopUpSearchTable } from './PopUpSearchTable';
import type { PopUpSearchTableColumn } from './PopUpSearchTable';

type Option = {
  value: string | number;
  label: string;
};

type SearchApiItem = {
  id: string | number;
  name: string;
} & Record<string, unknown>;

type AsyncSearchSelectProps<T extends Record<string, unknown> = SearchApiItem> = {
  label: string;
  placeholder?: string;
  apiUrl: string;

  /** Pass the selected item's ID here (not the name). */
  value: string | number | null;
  /** Returns the full selected option so callers can grab both id and name. */
  onChangeAction: (
    selected: { id: string | number | null; name: string } | null,
  ) => void;

  required?: boolean;
  selectedLabel?: string;
  popupTitle?: string;
  enablePopupSearch?: boolean;
  /** Field name to use as the option label. Defaults to "name". */
  nameKey?: string;
  /** Set true when the API returns { data: [...] } instead of { data: { data: [...] } }. */
  flatData?: boolean;

  /** PopUp column, for the custom popup form and specific columns*/
  popUpColumns?: PopUpSearchTableColumn<T>[];
  popupPageSize?: number;
  popupPageSizeOptions?: number[];
};

export default function AsyncSearchSelect<
  T extends Record<string, unknown> = SearchApiItem,
>({
  label,
  placeholder = 'Search...',
  apiUrl,
  value,
  onChangeAction,
  required,
  selectedLabel: selectedLabelProp = '',
  popupTitle,
  enablePopupSearch = false,
  nameKey = 'name',
  flatData = false,
  popUpColumns,
  popupPageSize,
  popupPageSizeOptions,
}: AsyncSearchSelectProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<Option[]>([]);

  // ───────────────── Fetch Data ─────────────────
  const fetchOptions = useCallback(
    async (keyword = '') => {
      try {
        setLoading(true);
        // Use the URL API so any query string already on `apiUrl`
        // (e.g. ?item_id=5) is preserved instead of being clobbered.
        const url = new URL(apiUrl, window.location.origin);
        url.searchParams.set('search', keyword);
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('Failed to fetch');

        const json = await res.json();
        const rows: SearchApiItem[] = Array.isArray(json.data)
          ? json.data
          : (json.data?.data ?? []);

        setOptions(
          rows.map((item) => ({
            value: item.id,
            label: String((item as Record<string, unknown>)[nameKey] ?? ''),
          })),
        );
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, nameKey],
  );

  const handleOpen = () => {
    setOpen(true);
    if (options.length === 0) fetchOptions();
  };

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => fetchOptions(search), 300);
    return () => clearTimeout(timeout);
  }, [fetchOptions, search, open]);

  // ───────────────── Close on Outside Click ─────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: Option) => {
    onChangeAction({ id: option.value, name: option.label });
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={containerRef}>
      <FieldLabel>{label}</FieldLabel>

      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        <span
          className={selectedLabelProp ? 'text-slate-700' : 'text-slate-400'}
        >
          {selectedLabelProp || placeholder}
        </span>
        <ChevronDown size={18} className="text-slate-400" />
      </button>

      {/* Dropdown */}
      <div
        className={`absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg transition-all duration-200 ${
          open
            ? 'visible translate-y-0 opacity-100'
            : 'invisible -translate-y-1 opacity-0'
        }`}
      >
        {/* Search input */}
        <div className="border-b border-slate-100 p-2">
          <div className="relative">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-3 pr-12 text-sm focus:border-[#1a9e52] focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20"
            />
            <button
              type="button"
              onClick={() => {
                if (!enablePopupSearch) return;
                setOpen(false);
                setPopupOpen(true);
              }}
              disabled={!enablePopupSearch}
              className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 transition ${
                enablePopupSearch
                  ? 'text-slate-400 hover:bg-slate-100 hover:text-[#1a9e52]'
                  : 'cursor-default text-slate-300'
              }`}
              aria-label={`Open ${popupTitle ?? label} popup search`}
            >
              <Search size={16} />
            </button>
          </div>
        </div>

        {/* Options list */}
        <div className="max-h-60 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={18} className="animate-spin text-slate-400" />
            </div>
          ) : options.length === 0 ? (
            <div className="py-4 text-center text-sm text-slate-400">
              No data found
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option)}
                className={`flex w-full items-center px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 ${
                  String(option.value) === String(value ?? '')
                    ? 'bg-[#1a9e52]/5 font-medium text-[#1a9e52]'
                    : 'text-slate-700'
                }`}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Hidden input for native form required validation */}
      {required && (
        <input
          type="hidden"
          value={value ?? ''}
          required
          readOnly
          aria-hidden="true"
        />
      )}

      <PopUpSearch
        open={popupOpen}
        title={popupTitle ?? label}
        placeholder={placeholder}
        onCloseAction={() => setPopupOpen(false)}
      >
        <PopUpSearchTable<T>
          apiUrl={apiUrl}
          selectedId={value}
          onRowSelect={(row) => {
            const rowId = row.id as string | number;
            handleSelect({
              value: rowId,
              label: String(row[nameKey] ?? ''),
            });
            setPopupOpen(false);
          }}
          columns={
            popUpColumns ?? [
              {
                key: 'id',
                header: '#',
                getValue: (r) => String(r.id),
                className: 'text-slate-400',
              },
              {
                key: nameKey,
                header: label,
                filterable: true,
                getValue: (r) => String(r[nameKey] ?? ''),
              },
            ]
          }
          flatData={flatData}
          pageSize={popupPageSize}
          pageSizeOptions={popupPageSizeOptions}
        />
      </PopUpSearch>
    </div>
  );
}
