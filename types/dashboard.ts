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
    payments_today: number;
    payments_today_count: number;
    payments_month: number;
    payments_month_count: number;
    outstanding_invoices: number;
    outstanding_amount: number;
};

export type DashboardPaymentPeriod = {
    total: number;
    count: number;
};

export type DashboardPayments = {
    periods: {
        today: DashboardPaymentPeriod;
        yesterday: DashboardPaymentPeriod;
        week: DashboardPaymentPeriod;
        month: DashboardPaymentPeriod;
    };
    daily: { day: string; total: number }[];
};

export type DashboardReceivables = {
    invoice_count: number;
    total_outstanding: number;
    top_customers: { customer: string; outstanding: number; invoices: number }[];
    /** Oldest unpaid invoices; a due-date field slots in here later. */
    oldest: {
        id: number;
        no: string;
        customer: string | null;
        date: string;
        outstanding: number;
    }[];
};

export type DashboardLowStockImpact = {
    affected_orders: number;
    affected_shipments: number;
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
    /** Powers the unified activity timeline (client-side merge). */
    created_at: string;
    amount: number | null;
    method?: string;
};

export type DashboardSummary = {
    kpis: DashboardKpis;
    sales: DashboardSales;
    payments: DashboardPayments;
    inventory: DashboardInventory;
    low_stock_impact: DashboardLowStockImpact;
    documents: DashboardDocuments;
    /** Derived UNPAID / PARTIALLY_PAID / PAID counts over POSTED invoices. */
    invoice_payment_status: Record<string, number>;
    receivables: DashboardReceivables;
    recent: {
        orders: DashboardRecentRow[];
        shipments: DashboardRecentRow[];
        invoices: DashboardRecentRow[];
        payments: DashboardRecentRow[];
    };
    warehouses: { id: number; name: string }[];
    locations: { id: number; name: string; warehouse_id: number }[];
};
