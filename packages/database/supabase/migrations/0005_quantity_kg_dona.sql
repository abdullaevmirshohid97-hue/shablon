-- Lets a single transaction carry both a kg quantity and a dona (piece)
-- quantity independently, so the ledger's Kg/Dona columns never need to
-- fall back to merging the second value into the description text.

alter table transactions add column quantity_kg numeric;
alter table transactions add column quantity_dona numeric;
