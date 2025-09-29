-- Fix autoincrement sequence for CashJournal
SELECT setval(
  pg_get_serial_sequence('"CashJournal"', 'id'),
  COALESCE((SELECT MAX(id) FROM "CashJournal"), 1),
  true
);
