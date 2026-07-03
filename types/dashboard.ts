// Contract for GET /api/dashboard/summary — mirrors the JSONB returned by the
// Postgres fn get_dashboard_summary (single round-trip dashboard aggregation).

export type DashboardPeriod = {
    total: number;
    invoices: number;
};

export type DashboardKpis = {
    sales_today: number;
    sales_month: number;
    open_orders: number;
    ready_to_ship: number;
    partially_invoiced_shipments: number;
    posted_invoices_month: number;
    low_stock_items: number;
    out_of_stock_items: number;
};

export type DashboardSales = {
    periods: {
        today: DashboardPeriod;
        yesterday: DashboardPeriod;
        week: DashboardPeriod;
        month: DashboardPeriod;
    };
    daily: { day: string; total: number }[];
};

export type DashboardInventory = {
    total_stock_items: number;
    total_qty: number;
    total_value: number;
    low_stock: number;
    out_of_stock: number;
    serial_items: number;
};

export type DashboardDocuments = {
    orders: Record<string, number>;
    shipments: Record<string, number>;
    invoices: Record<string, number>;
};

export type DashboardRecentRow = {
    id: number;
    no: string;
    customer: string | null;
    date: string;
    status: string;
};

export type DashboardSummary = {
    kpis: DashboardKpis;
    sales: DashboardSales;
    inventory: DashboardInventory;
    documents: DashboardDocuments;
    recent: {
        orders: DashboardRecentRow[];
        shipments: DashboardRecentRow[];
        invoices: DashboardRecentRow[];
    };
    warehouses: { id: number; name: string }[];
};
