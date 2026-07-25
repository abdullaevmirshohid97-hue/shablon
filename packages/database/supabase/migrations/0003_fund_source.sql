-- Adds a fund-source dimension ("Fabrika" / "Shaxsiy") to each transaction,
-- so kirim/chiqim can be tracked and totalled separately per source.

create type fund_source as enum ('fabrika', 'shaxsiy');

alter table transactions
  add column source fund_source not null default 'fabrika';
