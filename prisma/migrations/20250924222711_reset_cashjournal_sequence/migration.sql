-- Resets the auto-increment sequence for the CashJournal table
-- to the current maximum ID value, so the next entry gets a new, unique ID.
SELECT setval(pg_get_serial_sequence('"CashJournal"', 'id'), COALESCE((SELECT MAX(id) FROM "CashJournal"), 1), true);
