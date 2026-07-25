-- Adds a due date ("srok") to each transaction so upcoming/overdue debts
-- can be surfaced in analytics.

alter table transactions add column due_date date;

create index transactions_due_date_idx on transactions (org_id, due_date) where due_date is not null;
