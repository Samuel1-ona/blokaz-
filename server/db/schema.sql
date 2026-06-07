-- Run this in your Supabase SQL editor.
-- Safe to re-run — all statements use IF NOT EXISTS / OR REPLACE.

-- ── game_sessions ─────────────────────────────────────────────────────────────

create table if not exists game_sessions (
  id               uuid primary key default gen_random_uuid(),
  address          text not null,
  seed             text not null,
  on_chain_game_id text,
  on_chain_seed    text,
  move_history     jsonb not null default '[]',
  score            integer not null default 0,
  score_boost_active boolean not null default false,
  is_game_over     boolean not null default false,
  revive_count     integer not null default 0,
  status           text not null default 'active',  -- active | submitted | abandoned
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Only one active session per (address, seed) — enables single-query upsert
create unique index if not exists idx_unique_active_session
  on game_sessions (address, seed)
  where status = 'active';

create index if not exists idx_game_sessions_address_status
  on game_sessions (address, status, updated_at desc);

-- ── player_inventory ──────────────────────────────────────────────────────────

create table if not exists player_inventory (
  id               uuid primary key default gen_random_uuid(),
  address          text not null unique,
  revival_bundle   integer not null default 0,
  score_boost      integer not null default 0,
  shield           integer not null default 0,
  bomb             integer not null default 0,
  rotate_pass      integer not null default 0,
  -- Free trial charges (3 per power-up to start)
  free_score_boost integer not null default 3,
  free_shield      integer not null default 3,
  free_bomb        integer not null default 3,
  free_rotate_pass integer not null default 3,
  updated_at       timestamptz not null default now()
);

create index if not exists idx_player_inventory_address
  on player_inventory (address);

-- ── purchase_log ──────────────────────────────────────────────────────────────

create table if not exists purchase_log (
  id           uuid primary key default gen_random_uuid(),
  address      text not null,
  item_id      text not null,   -- revivalBundle | scoreBoost | shield | bomb | rotatePass
  quantity     integer not null default 1,
  token_symbol text not null,   -- USDC | USDT | USDm
  tx_hash      text unique,     -- null if tx hash was unavailable; unique prevents double-processing
  created_at   timestamptz not null default now()
);

create index if not exists idx_purchase_log_address
  on purchase_log (address, created_at desc);

create unique index if not exists idx_purchase_log_tx_hash
  on purchase_log (tx_hash)
  where tx_hash is not null;

-- ── Atomic inventory increment RPC ───────────────────────────────────────────
-- Called by /inventory/purchase to credit items without a read-modify-write race.

create or replace function increment_inventory(
  p_address text,
  p_column  text,
  p_qty     integer
) returns void language plpgsql as $$
begin
  if p_column not in ('revival_bundle','score_boost','shield','bomb','rotate_pass') then
    raise exception 'Invalid column: %', p_column;
  end if;

  insert into player_inventory (address)
    values (p_address)
    on conflict (address) do nothing;

  execute format(
    'update player_inventory set %I = %I + $1, updated_at = now() where address = $2',
    p_column, p_column
  ) using p_qty, p_address;
end;
$$;

-- ── Auto-update updated_at ────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger game_sessions_updated_at
  before update on game_sessions
  for each row execute function set_updated_at();

create or replace trigger player_inventory_updated_at
  before update on player_inventory
  for each row execute function set_updated_at();

-- ── Row-level security ────────────────────────────────────────────────────────
-- All access goes through the server using the service role key.

alter table game_sessions enable row level security;
alter table player_inventory enable row level security;
alter table purchase_log enable row level security;

create policy "service role only" on game_sessions as restrictive using (false) with check (false);
create policy "service role only" on player_inventory as restrictive using (false) with check (false);
create policy "service role only" on purchase_log as restrictive using (false) with check (false);
