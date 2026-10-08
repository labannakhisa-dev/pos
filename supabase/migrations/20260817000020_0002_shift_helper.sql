/*
# Shift update helper function

Creates an RPC function `update_shift_on_sale` that atomically increments
shift totals when a sale is completed. Called from the M-Pesa callback edge
function to keep shift totals consistent.

## New Functions
- `update_shift_on_sale(p_shift_id uuid, p_amount numeric)` — increments
  transaction_count, gross_sales, mpesa_sales, and net_sales for the given shift.
*/

CREATE OR REPLACE FUNCTION update_shift_on_sale(p_shift_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE shifts
  SET
    transaction_count = transaction_count + 1,
    gross_sales = gross_sales + p_amount,
    mpesa_sales = mpesa_sales + p_amount,
    net_sales = net_sales + p_amount
  WHERE id = p_shift_id;
END;
$$;
