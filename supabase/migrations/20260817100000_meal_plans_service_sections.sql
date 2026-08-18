-- ============================================================================
-- Meal plans belong to a food service — enforce it.
--
-- The admin plan form never set category_id, so 'Merienda Packed Meals' and
-- 'Rice Bowls' were floating NULL: they appeared in every builder while their
-- dish options joined to nothing. Home them (Merienda under Merienda Meals per
-- the owner; Rice Bowls is a bento-style lunch, so Check-a-Lunch), default any
-- other stray to Check-a-Lunch, then SET NOT NULL so a category-less plan can
-- never be created again — the form now always sends one. Re-runnable.
-- ============================================================================

update public.meal_plans
   set category_id = (select id from public.categories where slug = 'fun-boxes')
 where name = 'Merienda Packed Meals'
   and category_id is null;

update public.meal_plans
   set category_id = (select id from public.categories where slug = 'check-a-lunch')
 where category_id is null;

alter table public.meal_plans
  alter column category_id set not null;
