-- Serial lookup performance: the per-item/warehouse/location AVAILABLE slice is
-- what every picker/search/auto-fill hits. A partial index keeps those lookups
-- fast at 100k+ serials (search then only scans the small residual set).
CREATE INDEX IF NOT EXISTS idx_inventory_serial_available
    ON inventory_serial (company_id, item_id, warehouse_id, location_id, id)
    WHERE status = 'available';
