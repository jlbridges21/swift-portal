-- Swift Portal V7 — status data migration (Part 2: run after v7)
-- Collapse standalone "approved" into awaiting_payment workflow step.

UPDATE projects SET status = 'awaiting_payment' WHERE status = 'approved';
