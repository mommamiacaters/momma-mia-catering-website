-- ============================================================================
-- Check-a-Lunch: meal plans + dish sub-categories
-- ----------------------------------------------------------------------------
-- The storefront's lunch-box builder was hardcoded to assemble main/side/starch
-- from constants in the frontend (MEAL_PLAN_LIMITS), so the business could not
-- add a plan or change a price without a code deploy. The printed menu now sells
-- FIVE plans (₱210–₱350) whose dishes are grouped as PORK / CHICKEN / SEAFOOD /
-- SIDE DISH / DESSERT — neither of which the schema could express.
--
-- Two new tables:
--   sub_categories  the dish grouping shown in the admin "Sub-category" dropdown
--                   (replaces the free-text item_type, which had no constraint
--                   and had already drifted: "vegetable" vs "vegetables", plus
--                   38 rows with no type at all).
--   meal_plans      one row per purchasable plan, with its price and how many of
--                   each SLOT it includes.
--
-- The slot indirection is the point: a plan asks for "1 MAIN DISH", and every
-- sub-category whose slot = 'main' (pork, chicken, seafood) can fill it. Adding
-- a "BEEF" main later is one row in sub_categories, no plan edits and no deploy.
-- ============================================================================

-- ---------- sub_categories ---------------------------------------------------
create table if not exists public.sub_categories (
  id         serial primary key,
  slug       text not null unique,
  name       text not null,
  -- Which plan slot this group can fill. NULL = not part of the lunch-box
  -- builder (e.g. Café pasta), so it still groups dishes without becoming
  -- selectable inside a plan. Constrained rather than free text — this column
  -- is exactly the kind of business contract that item_type failed to enforce.
  slot       text check (slot is null or slot in ('main', 'side', 'dessert', 'rice')),
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_sub_categories_updated_at
  before update on public.sub_categories
  for each row execute function public.set_updated_at();

-- ---------- meal_plans -------------------------------------------------------
create table if not exists public.meal_plans (
  id            serial primary key,
  name          text not null,
  description   text,
  price_cents   int  not null check (price_cents >= 0),
  -- Composition, one column per slot. Flat rather than a child table because
  -- the slot set is small and fixed, and it keeps the admin form four number
  -- inputs instead of a nested editor.
  main_count    int not null default 0 check (main_count    between 0 and 9),
  side_count    int not null default 0 check (side_count    between 0 and 9),
  dessert_count int not null default 0 check (dessert_count between 0 and 9),
  rice_count    int not null default 0 check (rice_count    between 0 and 9),
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_meal_plans_updated_at
  before update on public.meal_plans
  for each row execute function public.set_updated_at();

create index if not exists idx_meal_plans_active on public.meal_plans(is_active, sort_order);

-- ---------- menu_items.sub_category_id --------------------------------------
alter table public.menu_items
  add column if not exists sub_category_id int references public.sub_categories(id) on delete set null;

create index if not exists idx_menu_items_sub_category on public.menu_items(sub_category_id);

-- ============================================================================
-- RLS — mirrors the catalog posture from Phase 1/2: world-readable when active,
-- admin-only writes.
-- ============================================================================
alter table public.sub_categories enable row level security;
alter table public.meal_plans     enable row level security;

drop policy if exists "active sub categories are publicly readable" on public.sub_categories;
create policy "active sub categories are publicly readable"
  on public.sub_categories for select using (is_active = true);

drop policy if exists "admins manage sub categories" on public.sub_categories;
create policy "admins manage sub categories"
  on public.sub_categories for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "active meal plans are publicly readable" on public.meal_plans;
create policy "active meal plans are publicly readable"
  on public.meal_plans for select using (is_active = true);

drop policy if exists "admins manage meal plans" on public.meal_plans;
create policy "admins manage meal plans"
  on public.meal_plans for all
  using (public.is_admin()) with check (public.is_admin());
