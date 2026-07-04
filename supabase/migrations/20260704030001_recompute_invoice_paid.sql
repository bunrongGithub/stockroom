-- Recompute the denormalized sales_invoice.amount_paid cache from the
-- allocation ledger, counting only allocations whose source customer_payment is
-- POSTED. One atomic statement per invoice → safe to call after post/cancel.
-- (source_id is polymorphic so there is no FK to embed; the join lives here.)
CREATE OR REPLACE FUNCTION recompute_invoice_paid(
    p_company_id INT,
    p_invoice_id BIGINT
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
    v_paid NUMERIC;
BEGIN
    SELECT COALESCE(SUM(da.amount), 0)
    INTO v_paid
    FROM document_allocation da
    JOIN customer_payment cp
      ON cp.id = da.source_id AND da.source_type = 'customer_payment'
    WHERE da.company_id = p_company_id
      AND da.target_type = 'sales_invoice'
      AND da.target_id = p_invoice_id
      AND cp.status = 'POSTED';

    UPDATE sales_invoice
    SET amount_paid = v_paid
    WHERE id = p_invoice_id AND company_id = p_company_id;

    RETURN v_paid;
END;
$$;
