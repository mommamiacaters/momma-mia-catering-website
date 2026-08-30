import React, { useState, useEffect, useMemo, useRef } from "react";
import { ArrowRight, Check, ChevronDown, ChevronUp, Coffee, Package, PackagePlus, X, Zap, Info, Trash2, type LucideIcon } from "lucide-react";
import ConfirmDialog from "../ui/ConfirmDialog";
import {
  deriveMinimumState,
  useStoreSettings,
} from "../../hooks/useStoreSettings";
import {
  DishFillMode,
  ExtraSelection,
  ExtrasCategory,
  MealPlanType,
  MenuItem,
  MenuTypeData,
  CategoryType,
  PlanInstance,
  SelectedItemWithQuantity,
} from "../../types";
import { isPlanInstanceComplete } from "../../utils/mealPlanUtils";
import { PLAN_SLOT_META, PLAN_SLOTS } from "../../constants/planSlots";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { usePresence } from "../../hooks/usePresence";
import type { MealPlan } from "../../services/menuService";
import { preloadImages } from "../CachedImage";
import MealPlanSelector from "./components/MealPlanSelector";
import FoodCard from "./components/FoodCard";
import TrayPreview from "./components/TrayPreview";
import type { MealPlanOrder } from "../../types";

interface CheckALunchProps {
  mealPlanOrders: MealPlanOrder[];
  selectedItems: unknown[];
  planInstances: PlanInstance[];
  activePlanInstanceId: string | null;
  onSetActivePlan: (id: string | null) => void;
  menuData: MenuTypeData | null;
  loading: boolean;
  error: string | null;
  onMealPlanSelect: (type: MealPlanType) => void;
  onMealPlanQuantityChange: (type: MealPlanType, quantity: number) => void;
  onItemRemove: (item: SelectedItemWithQuantity) => void;
  /** Bulk fill/clear across every box — see useOrderManagement. */
  onItemAddMany: (item: MenuItem, count: number, spread?: DishFillMode) => void;
  onItemRemoveMany: (item: MenuItem, count: number) => void;
  /** Empty one course — a single box when given an id, every box when null. */
  clearCourse: (itemType: string, planInstanceId: string | null) => void;
  /** Universal extras (Add-ons, Café Menu): offered with EVERY plan. */
  extrasMenu: ExtrasCategory[];
  extras: ExtraSelection[];
  onExtraAdd: (item: MenuItem, count: number) => void;
  onExtraRemove: (item: MenuItem, count: number) => void;
  onClearExtras: (categorySlug: string | null) => void;
  plans: MealPlan[];
  getMealPlanPrice: (type: MealPlanType, planInstanceId?: string) => number;
  getMealPlanLimits: (type: MealPlanType) => Record<string, number>;
  getItemsByCategory: (category: CategoryType) => MenuItem[];
  getCategoryDisplayName: (category: string) => string;
  getMaxAllowedItemsByType: () => Record<string, number>;
  getActivePlanMaxAllowed: () => Record<string, number>;
  getActivePlanSelectedCount: (itemType: string) => number;
  onMoveItem: (
    sourcePlanId: string,
    itemInstanceId: string,
    targetPlanId: string,
    targetItemInstanceId?: string
  ) => void;
}

/** Icons now live in the shared meta too — see planSlots.ts. */
const CATEGORY_CONFIG = PLAN_SLOT_META.map(({ slot, label, short, description, Icon }) => ({
  type: slot,
  label,
  short,
  description,
  icon: Icon,
}));

/** Every slot, in menu order. Which ones apply depends on the chosen plan. */
const CATEGORIES: CategoryType[] = PLAN_SLOTS;

const CheckALunch: React.FC<CheckALunchProps> = ({
  mealPlanOrders,
  planInstances,
  activePlanInstanceId,
  onSetActivePlan,
  menuData,
  loading,
  error,
  onMealPlanSelect,
  onMealPlanQuantityChange,
  onItemAddMany,
  onItemRemoveMany,
  clearCourse,
  extrasMenu,
  extras,
  onExtraAdd,
  onExtraRemove,
  onClearExtras,
  plans,
  getMealPlanPrice,
  getMealPlanLimits,
  getItemsByCategory,
  getCategoryDisplayName,
  getActivePlanMaxAllowed,
  getActivePlanSelectedCount,
  onMoveItem,
}) => {
  // A tab is either a plan slot ("main") or an extras category ("x:add-on").
  const [activeCategory, setActiveCategory] = useState<string>("main");
  const activeExtraSlug = activeCategory.startsWith("x:")
    ? activeCategory.slice(2)
    : null;
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Order minimum, set by the admin in app_settings. planInstances.length is the
  // same figure getTotalMealPlanCount() gives the cart, and deriveMinimumState is
  // the same derivation the cart uses, so this notice and the checkout gate can
  // never disagree.
  const {
    minimumMealPlans,
    minimumQtyPerDish,
    showBulkDishActions,
    error: settingsError,
    retry: retrySettings,
  } = useStoreSettings();
  const totalBoxes = planInstances.length;
  // This service's own floor beats the store default; a service without one
  // inherits it (and null-unknown still blocks).
  const min = deriveMinimumState(
    plans[0]?.categoryMinBoxes ?? minimumMealPlans,
    totalBoxes,
  );
  // Same override, applied to the per-dish floor: Party Trays sells by the
  // piece, so one tray of one dish must not be flagged as under the store's
  // 15-per-dish default. Mirrors create_order v11's coalesce.
  const effectiveMinQtyPerDish = plans[0]?.categoryMinDishQty ?? minimumQtyPerDish;
  // Preload ALL category images when menu data arrives
  useEffect(() => {
    if (!menuData) return;
    const allUrls: string[] = [];
    for (const cat of CATEGORIES) {
      const items = menuData[cat] || [];
      for (const item of items) {
        if (item.image) allUrls.push(item.image);
      }
    }
    preloadImages(allUrls);
  }, [menuData]);

  // ─── Memoized derived state ───

  const hasMealPlan = mealPlanOrders.length > 0;

  const maxAllowed = useMemo(
    () => getActivePlanMaxAllowed(),
    [getActivePlanMaxAllowed]
  );

  // Per-slot selection counts, built over every slot so adding one to a plan
  // needs no change here.
  const categoryCounts = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIES.map((slot) => [slot, getActivePlanSelectedCount(slot)])
      ) as Record<CategoryType, number>,
    [getActivePlanSelectedCount]
  );

  // Per-slot "is full" flags (must not depend on activeCategory)
  const categoryFull = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIES.map((slot) => [
          slot,
          hasMealPlan && categoryCounts[slot] >= (maxAllowed[slot] || 0),
        ])
      ) as Record<CategoryType, boolean>,
    [hasMealPlan, categoryCounts, maxAllowed]
  );

  // Per-card figures in ONE pass over the boxes. The hook's per-item helpers
  // (getOpenSlotsForType and friends) are O(boxes) EACH, and with every card
  // in every course grid asking three of them per render, a 150-box order ran
  // tens of thousands of filter/spread allocations per click — the bulk of the
  // stepper's input lag. Semantics preserved: open slots and placed counts are
  // order-wide; "selected" narrows to the active box while one is being filled.
  const { openSlotsByType, placedByDish, selectedDishIds } = useMemo(() => {
    const open: Record<string, number> = {};
    const placed = new Map<string, number>();
    const selected = new Set<string>();
    for (const pi of planInstances) {
      const limits = getMealPlanLimits(pi.type);
      const usedByType: Record<string, number> = {};
      for (const ai of pi.items) {
        usedByType[ai.type] = (usedByType[ai.type] ?? 0) + 1;
        placed.set(ai.menuItemId, (placed.get(ai.menuItemId) ?? 0) + 1);
        if (!activePlanInstanceId || pi.id === activePlanInstanceId) {
          selected.add(ai.menuItemId);
        }
      }
      for (const slot of Object.keys(limits)) {
        open[slot] =
          (open[slot] ?? 0) +
          Math.max(0, (limits[slot] || 0) - (usedByType[slot] ?? 0));
      }
    }
    return { openSlotsByType: open, placedByDish: placed, selectedDishIds: selected };
  }, [planInstances, activePlanInstanceId, getMealPlanLimits]);

  // ─── Extras (universal categories: Add-ons, Café Menu) ───
  const extrasQtyByItem = useMemo(
    () => new Map(extras.map((e) => [e.menuItemId, e.qty])),
    [extras]
  );
  const extrasQtyByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of extras) m.set(e.categorySlug, (m.get(e.categorySlug) ?? 0) + e.qty);
    return m;
  }, [extras]);
  const extrasTabs = useMemo(
    () =>
      extrasMenu.map((cat) => ({
        key: `x:${cat.slug}`,
        label: cat.name,
        // First word carries the identity ("Add-ons", "Café") on phones.
        short: cat.name.split(" ")[0],
        icon: (cat.slug === "cafe-menu" ? Coffee : PackagePlus) as LucideIcon,
        slug: cat.slug,
        items: cat.items,
      })),
    [extrasMenu]
  );
  const activeExtrasTab = extrasTabs.find((t) => t.slug === activeExtraSlug) ?? null;

  // What a Clear press would actually remove: this box's dishes for the current
  // course while filling one, or the whole order's while auto-filling.
  const clearableCount = useMemo(() => {
    if (activeExtraSlug) return extrasQtyByCat.get(activeExtraSlug) ?? 0;
    const boxes = activePlanInstanceId
      ? planInstances.filter((pi) => pi.id === activePlanInstanceId)
      : planInstances;
    return boxes.reduce(
      (sum, pi) => sum + pi.items.filter((i) => i.type === activeCategory).length,
      0
    );
  }, [planInstances, activePlanInstanceId, activeCategory, activeExtraSlug, extrasQtyByCat]);

  const activeLabel = activeExtrasTab
    ? activeExtrasTab.label
    : CATEGORY_CONFIG.find((c) => c.type === activeCategory)?.label ??
      activeCategory;

  const activeMax = maxAllowed[activeCategory as CategoryType] || 0;
  const activeSelected = activeExtrasTab
    ? extrasQtyByCat.get(activeExtrasTab.slug) ?? 0
    : categoryCounts[activeCategory as CategoryType];
  const isMaxReached = activeExtrasTab
    ? false
    : categoryFull[activeCategory as CategoryType];

  // The section after this one, skipping courses this order's plans don't use
  // (a Dessert slot no plan asks for is not somewhere to send anyone).
  const usableCategories = CATEGORY_CONFIG.filter(
    (c) => (maxAllowed[c.type] || 0) > 0
  );
  // Only the courses this order's plans actually use get a tab (a plan with
  // one slot must not show four dead "0/0" tabs); the extras tabs follow,
  // ALWAYS, whatever the plan — that is what makes them universal.
  const slotTabs = (usableCategories.length > 0 ? usableCategories : CATEGORY_CONFIG).map(
    (c) => ({ key: c.type as string, label: c.label, short: c.short, icon: c.icon })
  );
  const allTabs = [
    ...slotTabs,
    ...extrasTabs.map((t) => ({ key: t.key, label: t.label, short: t.short, icon: t.icon })),
  ];

  // Stable identity for the tab set. Counting tabs is not enough: swapping a
  // rice-bowl plan for a main-only one keeps the count at 1 while every key
  // changes, and the snap below would never fire.
  const tabKeys = allTabs.map((t) => t.key).join("|");

  // Snap to a tab that exists. activeCategory starts at "main", so a Rice
  // Bowl plan (which has no main) left the picker on a dead course.
  useEffect(() => {
    if (allTabs.length === 0) return;
    if (allTabs.some((t) => t.key === activeCategory)) return;
    setActiveCategory(allTabs[0].key);
    // allTabs is rebuilt each render; tabKeys stands in for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, tabKeys]);

  const nextSection =
    allTabs[allTabs.findIndex((t) => t.key === activeCategory) + 1] ?? null;

  // Sorted plan instances + numbering (memoized)
  const { sortedInstances, instanceNumbers } = useMemo(() => {
    const sorted = [...planInstances].sort(
      (a, b) => a.displayOrder - b.displayOrder
    );
    const counters = new Map<MealPlanType, number>();
    const numbers = new Map<string, number>();
    for (const pi of sorted) {
      const n = (counters.get(pi.type) || 0) + 1;
      counters.set(pi.type, n);
      numbers.set(pi.id, n);
    }
    return { sortedInstances: sorted, instanceNumbers: numbers };
  }, [planInstances]);

  // Active plan for mini preview
  const { activePlan, activePlanNum } = useMemo(() => {
    const plan = activePlanInstanceId
      ? sortedInstances.find((p) => p.id === activePlanInstanceId)
      : null;
    return {
      activePlan: plan || null,
      activePlanNum: plan ? instanceNumbers.get(plan.id) || 1 : 0,
    };
  }, [activePlanInstanceId, sortedInstances, instanceNumbers]);

  // Boxes grouped by plan. Listing all 30 boxes at once buries the dish picker
  // they exist to fill, so only the picked plan's boxes are listed.
  const planGroups = useMemo(() => {
    const grouped = new Map<MealPlanType, PlanInstance[]>();
    for (const pi of sortedInstances) {
      const bucket = grouped.get(pi.type);
      if (bucket) bucket.push(pi);
      else grouped.set(pi.type, [pi]);
    }
    return Array.from(grouped, ([type, instances]) => ({
      type,
      instances,
      filledBoxes: instances.filter((pi) =>
        isPlanInstanceComplete(pi, getMealPlanLimits(pi.type))
      ).length,
    }));
  }, [sortedInstances, getMealPlanLimits]);

  // Spreading evenly is the default: it's the difference between every meal
  // having a protein and half the meals being finished while the rest are bare.
  const [fillMode, setFillMode] = useState<DishFillMode>("even");
  // Read through a ref at call time: FoodCard's memo comparator deliberately
  // ignores onAddMany, so a card that doesn't re-render keeps the closure it
  // was built with — and would go on filling with whichever mode was current
  // when it last rendered.
  const fillModeRef = useRef(fillMode);
  fillModeRef.current = fillMode;
  const [fillMenuOpen, setFillMenuOpen] = useState(false);

  const [expandedPlan, setExpandedPlan] = useState<MealPlanType | null>(null);
  // The closing row still needs its chips, or they blink out before the slide
  // finishes and the dish grid jumps up under them.
  const lastExpandedPlan = useRef<MealPlanType | null>(null);
  if (expandedPlan) lastExpandedPlan.current = expandedPlan;
  const expandedInstances =
    planGroups.find((g) => g.type === (expandedPlan ?? lastExpandedPlan.current))
      ?.instances ?? [];

  // Every plan starts CLOSED — the row's job is to stay a short list of plans
  // until the shopper asks for a box. The one exception is picking a box
  // somewhere else (the lunch box panel), which has to reveal that box's chip
  // here; skipping the first run keeps a restored cart from opening on load.
  const activePlanType = activePlan?.type ?? null;
  const planExpandMounted = useRef(false);
  useEffect(() => {
    if (!planExpandMounted.current) {
      planExpandMounted.current = true;
      return;
    }
    if (activePlanType) setExpandedPlan(activePlanType);
  }, [activePlanType]);

  // ── Section jumper ──
  // Only offer the jump while the dish list is actually on screen; anchored to
  // the viewport, it would otherwise hover over the plan cards and the summary.
  const sectionHeadRef = useRef<HTMLDivElement | null>(null);
  const [dishListInView, setDishListInView] = useState(false);
  // A callback ref, not useRef: this component renders null until the menu
  // loads, so an effect keyed on anything else can run while the node is still
  // missing and then never see it appear — which left a restored cart with a
  // dead observer and no jumper.
  const [dishListEl, setDishListEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!dishListEl) return;
    const io = new IntersectionObserver(
      ([entry]) => setDishListInView(entry.isIntersecting),
      // Trim the edges so the prompt appears once the list really owns the
      // screen, not when its last pixel scrolls past.
      { rootMargin: "-20% 0px -20% 0px" }
    );
    io.observe(dishListEl);
    return () => io.disconnect();
  }, [dishListEl]);

  const tabStripRef = useRef<HTMLDivElement | null>(null);

  /**
   * Switch course and bring it into view: the tab strip scrolls the new tab
   * into the middle (only ~2.5 of them fit a phone), and the page lands on the
   * section heading so the new list starts at the top of the screen.
   */
  const goToCategory = (cat: string) => {
    setActiveCategory(cat);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";

    const strip = tabStripRef.current;
    const tab = strip?.querySelector<HTMLElement>(`[data-cat="${cat}"]`);
    if (strip && tab) {
      strip.scrollTo({
        left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2,
        behavior,
      });
    }
    const head = sectionHeadRef.current;
    if (head) {
      window.scrollTo({
        top: window.scrollY + head.getBoundingClientRect().top - 16,
        behavior,
      });
    }
  };

  const jumpToNextSection = () => {
    if (nextSection) goToCategory(nextSection.key);
  };

  // ── Swipe between courses (touch only) ──
  // Reading a long dish list is a vertical gesture, so a swipe only counts as
  // horizontal when it clearly beats the vertical drift; nothing is
  // preventDefault-ed, so normal scrolling is untouched.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onDishTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY };
  };
  const onDishTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const here = allTabs.findIndex((t) => t.key === activeCategory);
    // Swiping left pulls the next course in, like turning a page.
    const target = allTabs[here + (dx < 0 ? 1 : -1)];
    if (target) goToCategory(target.key);
  };

  // ── Mobile lunch-box drawer ──
  // On phones the tray panel would sit below every dish card, so it lives in
  // a bottom sheet instead, summarised by a fixed bar the thumb can reach.
  const [trayOpen, setTrayOpen] = useState(false);
  // The desktop aside and this sheet each hold a full TrayPreview; only ONE is
  // ever visible, but both used to be mounted — every click re-rendered the
  // lunch-box panel twice. Mount only the layout the viewport can show, and
  // keep the sheet's panel empty until it opens (held through the 300ms exit
  // slide so it doesn't blank mid-animation).
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const sheetContentLive = usePresence(trayOpen, 300);
  const trayCloseRef = useRef<HTMLButtonElement | null>(null);
  const trayBarRef = useRef<HTMLButtonElement | null>(null);
  const traySheetRef = useRef<HTMLDivElement | null>(null);

  /**
   * "N dishes below minimum" used to open the bag, which could only restate the
   * problem. Close the sheet, switch to the course the dish lives in, and put
   * the customer on the card itself — the amber ring is already on it.
   */
  /**
   * The sheet and the bag both hide body scroll and both restore what they
   * captured on open, so opening the bag underneath the sheet leaves the page
   * scrollable the moment the sheet closes. Close first, open on the next
   * frame, and the locks hand over cleanly.
   */
  const openBagFromSheet = () => {
    setTrayOpen(false);
    requestAnimationFrame(() => document.getElementById("bag-button")?.click());
  };

  const goToShortDish = (v: { menuItemId: string }) => {
    setTrayOpen(false);
    const cat = CATEGORIES.find((c) =>
      getItemsByCategory(c).some((i) => i.id === v.menuItemId),
    );
    const extraCat = cat
      ? null
      : extrasMenu.find((ec) => ec.items.some((i) => i.id === v.menuItemId));
    if (cat) setActiveCategory(cat);
    else if (extraCat) setActiveCategory(`x:${extraCat.slug}`);
    // Two frames: one for the tab swap to render the card, one for the sheet's
    // scroll lock to come off so the window can actually move.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-dish-id="${CSS.escape(v.menuItemId)}"]`,
        );
        if (!el) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      }),
    );
  };

  const { dishesPlaced, dishSlots, boxesDone } = useMemo(() => {
    let placed = 0;
    let slots = 0;
    let done = 0;
    for (const pi of planInstances) {
      const limits = getMealPlanLimits(pi.type);
      slots += Object.values(limits).reduce((a: number, b) => a + (b as number), 0);
      placed += pi.items.length;
      if (isPlanInstanceComplete(pi, limits)) done++;
    }
    return { dishesPlaced: placed, dishSlots: slots, boxesDone: done };
  }, [planInstances, getMealPlanLimits]);

  // The closed sheet is only translated off-screen, so it must also be inert —
  // otherwise its box buttons stay in the tab order.
  useEffect(() => {
    const sheet = traySheetRef.current as
      | (HTMLDivElement & { inert: boolean })
      | null;
    if (sheet) sheet.inert = !trayOpen;
    // isDesktop: the sheet only exists below lg now, so re-stamp inert when a
    // resize mounts it fresh.
  }, [trayOpen, isDesktop]);

  useEffect(() => {
    if (!trayOpen) return;
    const bar = trayBarRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    trayCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTrayOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      bar?.focus();
    };
  }, [trayOpen]);

  if (loading || error || !menuData) return null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* ─── Section Header ─── */}
      <div className="text-center mb-10">
        <span className="inline-block font-poppins text-xs font-semibold tracking-[0.2em] uppercase text-brand-primary mb-3">
          Step by Step
        </span>
        <h2 className="font-arvo text-3xl md:text-4xl font-bold text-brand-text px-2">
          Build Your Lunch Box
        </h2>
        {/* Short rule instead of a gradient fill — the emphasis sits beside the
            words rather than fighting them for contrast. */}
        <span
          className="mx-auto mt-4 mb-5 block h-1 w-16 rounded-full bg-brand-primary"
          aria-hidden="true"
        />
        <p className="font-poppins text-brand-text/50 max-w-md mx-auto leading-relaxed">
          Choose a plan, pick your favorites, and we&rsquo;ll pack it fresh
          for you.
        </p>
      </div>

      {/* ─── Step 1: Meal Plan ─── */}
      <section className="mb-14">
        <div className="flex items-center gap-3 mb-6">
          <span
            className={`flex items-center justify-center w-9 h-9 rounded-full font-poppins text-sm font-bold shrink-0 transition-colors ${
              hasMealPlan
                ? "bg-brand-primary text-white"
                : "bg-brand-primary/10 text-brand-primary ring-2 ring-brand-primary/30"
            }`}
          >
            {hasMealPlan ? <Check size={16} strokeWidth={3} /> : "1"}
          </span>
          <div>
            <h3 className="font-arvo text-xl font-bold text-brand-text">
              Choose Your Plan
            </h3>
            <p className="font-poppins text-xs text-brand-text/40">
              How many dishes per lunch box?
            </p>
          </div>
        </div>

        {/* The order minimum and the per-dish shortfalls used to sit here as
            two banners. Both are now said where they're acted on — the plan
            cards start at the minimum, the bag and checkout gate on it, and a
            short dish wears an amber ring in the picker — so step 1 goes
            straight from its heading to the plans. */}

        {/* A settings outage must be visible here, not silently hide the notice
            while the cart quietly blocks checkout with no explanation. */}
        {settingsError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-center gap-2.5"
          >
            <Info size={18} className="text-amber-600 shrink-0" />
            <p className="font-poppins text-sm text-brand-text">
              We couldn&rsquo;t load this store&rsquo;s order rules, so checkout
              is paused. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={retrySettings}
              className="ml-auto shrink-0 font-poppins text-sm font-semibold text-amber-700 underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        <MealPlanSelector
          bulkStep={min.minimum}
          plans={plans}
          mealPlanOrders={mealPlanOrders}
          onSelect={onMealPlanSelect}
          onQuantityChange={onMealPlanQuantityChange}
          getPrice={getMealPlanPrice}
        />
      </section>

      {/* ─── Step 2: Lunch Box (sticky) + Dish Picker ───
          items-start is load-bearing: grid children stretch by default, and a
          full-height column can't scroll-stick. min-w-0 on the picker lets the
          card grid shrink instead of forcing the page wider. */}
      {hasMealPlan && (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-8 lg:items-start">
          {/* ── Lunch Box summary — sticky beside the dishes on desktop, below
                them on mobile (where the floating bag button covers checkout) ── */}
          {isDesktop && (
            <aside className="hidden lg:block lg:order-1 lg:sticky lg:top-24">
              <TrayPreview
                compact
                planInstances={planInstances}
                extras={extras}
                categoryMinDishQty={plans[0]?.categoryMinDishQty ?? null}
                activePlanInstanceId={activePlanInstanceId}
                getMealPlanLimits={getMealPlanLimits}
                onSetActivePlan={onSetActivePlan}
                onMoveItem={onMoveItem}
                onFixShortDish={goToShortDish}
              />
            </aside>
          )}

          <section
            id="dish-picker-section"
            className="order-1 lg:order-2 lg:col-span-2 min-w-0 mb-10"
          >
          <div className="flex items-center gap-3 mb-8">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-primary/10 text-brand-primary ring-2 ring-brand-primary/30 font-poppins text-sm font-bold shrink-0">
              2
            </span>
            <div>
              <h3 className="font-arvo text-xl font-bold text-brand-text">
                Pick Your Dishes
              </h3>
              <p className="font-poppins text-xs text-brand-text/40">
                Fill each category to complete your lunch box
              </p>
            </div>
          </div>

          {/* ── Plan Instance Selector ──
                A plan chip lists its own boxes underneath, one plan at a time,
                the way the category tabs below swap their dish grid. */}
          {sortedInstances.length > 1 && (
            <div className="mb-6">
              <div className="flex flex-wrap gap-2 pt-1 pb-1 -mx-1 px-1">
                <button
                  onClick={() => setFillMenuOpen((open) => !open)}
                  aria-expanded={fillMenuOpen}
                  aria-controls="auto-fill-modes"
                  className={`flex items-center gap-1.5 px-3 min-h-[44px] rounded-full font-poppins text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                    !activePlanInstanceId
                      ? "bg-brand-primary text-white border-brand-primary shadow-md"
                      : "bg-white text-brand-text/70 border-brand-divider hover:border-brand-primary/40"
                  }`}
                >
                  <Zap size={12} />
                  Auto-fill
                  <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 ${fillMenuOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                {planGroups.map(({ type, instances, filledBoxes }) => {
                  const isExpanded = expandedPlan === type;
                  const allBoxesFilled = filledBoxes === instances.length;

                  return (
                    <button
                      key={type}
                      onClick={() => setExpandedPlan(isExpanded ? null : type)}
                      aria-expanded={isExpanded}
                      aria-controls="plan-box-chips"
                      className={`flex items-center gap-1.5 px-3 min-h-[44px] rounded-full font-poppins text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                        isExpanded
                          ? "bg-brand-primary/10 text-brand-primary border-brand-primary"
                          : allBoxesFilled
                            ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            : "bg-white text-brand-text/70 border-brand-divider hover:border-brand-primary/40"
                      }`}
                    >
                      {allBoxesFilled && <Check size={11} strokeWidth={3} />}
                      <span className="truncate max-w-[8rem]">{type}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold ${
                          isExpanded
                            ? "bg-brand-primary/20 text-brand-primary"
                            : allBoxesFilled
                              ? "bg-green-200/60 text-green-700"
                              : "bg-brand-secondary text-brand-text/70"
                        }`}
                        title={`${filledBoxes} of ${instances.length} boxes filled`}
                      >
                        {filledBoxes}/{instances.length}
                      </span>
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>

              {/* Auto-fill modes — closed by default; the choice only matters
                  once someone wonders why box 8 is empty. */}
              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
                  fillMenuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <div
                    id="auto-fill-modes"
                    role="radiogroup"
                    aria-label="How Auto-fill spreads dishes"
                    aria-hidden={!fillMenuOpen}
                    className="mt-2 grid gap-1.5 rounded-xl border border-brand-divider bg-white p-1.5 sm:grid-cols-2"
                  >
                    {(
                      [
                        ["even", "Spread evenly", "One dish per box, then round again"],
                        ["sequential", "Fill in order", "Finish a box before the next"],
                      ] as const
                    ).map(([mode, label, hint]) => (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={fillMode === mode}
                        tabIndex={fillMenuOpen ? undefined : -1}
                        onClick={() => {
                          setFillMode(mode);
                          onSetActivePlan(null);
                        }}
                        className={`rounded-lg px-3 py-2 text-left transition-colors cursor-pointer ${
                          fillMode === mode
                            ? "bg-brand-primary text-white"
                            : "bg-white text-brand-text hover:bg-brand-secondary"
                        }`}
                      >
                        <span className="block font-poppins text-xs font-semibold">
                          {label}
                        </span>
                        <span
                          className={`block font-poppins text-[0.7rem] ${
                            fillMode === mode ? "text-white/80" : "text-brand-text/70"
                          }`}
                        >
                          {hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 0fr→1fr slides the boxes in without measuring a height, so the
                  dish grid below never jumps. */}
              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
                  expandedPlan ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <div
                    id="plan-box-chips"
                    aria-hidden={!expandedPlan}
                    className="flex flex-wrap gap-2 pt-3 -mx-1 px-1"
                  >
                    {expandedInstances.map((pi) => {
                      const isActive = activePlanInstanceId === pi.id;
                      const limits = getMealPlanLimits(pi.type);
                      const isComplete = isPlanInstanceComplete(pi, limits);
                      const totalSlots = Object.values(limits).reduce(
                        (a: number, b) => a + (b as number),
                        0
                      );
                      const filledSlots = pi.items.length;
                      const instanceNum = instanceNumbers.get(pi.id) || 1;

                      return (
                        <button
                          key={pi.id}
                          onClick={() => onSetActivePlan(pi.id)}
                          tabIndex={expandedPlan ? undefined : -1}
                          aria-label={`Fill box ${instanceNum} of ${pi.type}, ${filledSlots} of ${totalSlots} dishes chosen`}
                          aria-current={isActive ? "true" : undefined}
                          className={`flex items-center gap-1.5 px-3 min-h-[44px] rounded-full font-poppins text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                            isActive
                              ? "ring-2 ring-brand-primary bg-brand-primary/10 text-brand-primary border-brand-primary"
                              : isComplete
                                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                : "bg-white text-brand-text/70 border-brand-divider hover:border-brand-primary/40"
                          }`}
                        >
                          {isComplete && <Check size={11} strokeWidth={3} />}
                          <span>#{instanceNum}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold ${
                              isActive
                                ? "bg-brand-primary/20 text-brand-primary"
                                : isComplete
                                  ? "bg-green-200/60 text-green-700"
                                  : "bg-brand-secondary text-brand-text/70"
                            }`}
                          >
                            {filledSlots}/{totalSlots}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Active plan indicator with mini tray preview ── */}
          {activePlan && (
            <div className="mb-6 bg-brand-primary/5 border border-brand-primary/20 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 flex items-center gap-2">
                <span className="font-poppins text-xs text-brand-primary font-medium">
                  Filling:{" "}
                  <strong>
                    #{activePlanNum} {activePlan.type}
                  </strong>
                </span>
                <button
                  onClick={() => onSetActivePlan(null)}
                  className="ml-auto font-poppins text-xs text-brand-text/40 hover:text-brand-primary transition-colors"
                >
                  Switch to auto-fill
                </button>
              </div>

            </div>
          )}

          {/* ── Category Tabs ── */}
          <div
            ref={tabStripRef}
            className="flex gap-2 mb-8 overflow-x-auto pb-1 -mx-1 px-1"
          >
            {allTabs.map(({ key, label, short, icon: Icon }) => {
              const isExtra = key.startsWith("x:");
              const extraQty = isExtra ? extrasQtyByCat.get(key.slice(2)) ?? 0 : 0;
              const isActive = activeCategory === key;
              const isComplete = !isExtra && categoryFull[key as CategoryType];
              const count = isExtra ? extraQty : categoryCounts[key as CategoryType];
              const max = isExtra ? 0 : maxAllowed[key as CategoryType] || 0;

              return (
                <button
                  key={key}
                  data-cat={key}
                  onClick={() => setActiveCategory(key)}
                  className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl font-poppins text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
                    isActive
                      ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/25"
                      : isComplete
                        ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                        : "bg-white text-brand-text/60 border border-brand-divider hover:border-brand-primary/40 hover:text-brand-text"
                  }`}
                  aria-label={
                    isExtra
                      ? `${label}: ${count} added`
                      : `${label}: ${count} of ${max} selected`
                  }
                  aria-current={isActive ? "true" : undefined}
                >
                  {isComplete ? (
                    <Check size={15} strokeWidth={3} />
                  ) : (
                    <Icon size={15} />
                  )}
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{short}</span>
                  {/* Extras have no capacity: the badge is a plain count, and
                      only once there is something to count. */}
                  {(!isExtra || count > 0) && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : isComplete
                            ? "bg-green-200/60 text-green-700"
                            : "bg-brand-secondary text-brand-text/50"
                      }`}
                      title={
                        isExtra
                          ? `${count} ${label.toLowerCase()} added to your order`
                          : `${count} of ${max} ${label.toLowerCase()} chosen for the box you're filling`
                      }
                    >
                      {isExtra ? count : `${count}/${max}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Active Category Header + Progress ── */}
          <div className="mb-6" ref={sectionHeadRef}>
            {/* Wraps below sm: the title plus Clear plus the count badge do not
                fit a 343px picker column on a phone. */}
            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 mb-2">
              <div className="min-w-0">
                <h4 className="font-arvo text-2xl font-bold text-brand-text">
                  {activeExtrasTab
                    ? activeExtrasTab.label
                    : getCategoryDisplayName(activeCategory)}
                </h4>
                <p className="font-poppins text-sm text-brand-text/40 mt-0.5">
                  {activeExtrasTab
                    ? "Extras that ride along with any order, priced per piece"
                    : CATEGORY_CONFIG.find(
                        (c) => c.type === activeCategory
                      )?.description}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Scope is spelled out in the label, because "Clear" means one
                    box while you're filling one and EVERY box in auto-fill —
                    a 25x difference the button must not leave ambiguous. */}
                {clearableCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      activeExtraSlug
                        ? onClearExtras(activeExtraSlug)
                        : activePlanInstanceId
                          ? clearCourse(activeCategory, activePlanInstanceId)
                          : setConfirmClearAll(true)
                    }
                    className="flex items-center gap-1.5 rounded-full border border-brand-divider px-3 py-1 font-poppins text-sm font-medium text-brand-text/60 transition-colors hover:border-red-300 hover:text-red-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400"
                    title={
                      activeExtraSlug
                        ? `Remove every ${activeLabel} extra from your order`
                        : activePlanInstanceId
                          ? `Remove the ${activeLabel.toLowerCase()} from #${activePlanNum} ${activePlan?.type ?? ""}`
                          : `Remove every ${activeLabel.toLowerCase()} from all ${sortedInstances.length} boxes`
                    }
                  >
                    <Trash2 size={14} />
                    {activeExtraSlug
                      ? `Clear all ${clearableCount}`
                      : activePlanInstanceId
                        ? "Clear this box"
                        : `Clear all ${clearableCount}`}
                  </button>
                )}
                <span
                  className={`font-poppins text-sm font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
                    isMaxReached
                      ? "bg-green-100 text-green-700"
                      : "bg-brand-secondary text-brand-text/50"
                  }`}
                >
                  {activeExtrasTab
                    ? `${activeSelected} added`
                    : `${activeSelected} of ${activeMax} selected`}
                </span>
              </div>
            </div>

            {/* Extras have no capacity, so a progress bar would have nothing
                to measure. */}
            {!activeExtrasTab && (
              <div className="h-1.5 bg-brand-divider/40 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                    isMaxReached ? "bg-green-500" : "bg-brand-primary"
                  }`}
                  style={{
                    width:
                      activeMax > 0
                        ? `${Math.min(100, (activeSelected / activeMax) * 100)}%`
                        : "0%",
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Food Grids — opacity-based switching for instant compositor toggle ── */}
          <div
            className="relative"
            ref={setDishListEl}
            onTouchStart={onDishTouchStart}
            onTouchEnd={onDishTouchEnd}
          >
            {CATEGORIES.map((cat) => {
              const items = getItemsByCategory(cat);
              const isActiveTab = activeCategory === cat;
              const isCatFull = categoryFull[cat];

              return (
                <div
                  key={cat}
                  className={
                    isActiveTab
                      ? "relative"
                      : "absolute top-0 left-0 w-full opacity-0 pointer-events-none"
                  }
                  aria-hidden={!isActiveTab}
                >
                  {items.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                      {items.map((item, index) => (
                        <FoodCard
                          key={`${item.name}-${index}`}
                          item={item}
                          isSelected={selectedDishIds.has(item.id)}
                          isDisabled={isCatFull}
                          openSlots={openSlotsByType[item.type] ?? 0}
                          placedCount={placedByDish.get(item.id) ?? 0}
                          requiredMin={
                            effectiveMinQtyPerDish === null
                              ? null
                              : (item.minQty ?? effectiveMinQtyPerDish)
                          }
                          showBulkActions={showBulkDishActions}
                          onAddMany={(n) => onItemAddMany(item, n, fillModeRef.current)}
                          onRemoveMany={(n) => onItemRemoveMany(item, n)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-white/50 rounded-2xl border border-dashed border-brand-divider">
                      <p className="font-poppins text-brand-text/40">
                        No items available for this category yet.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Extras grids — same mounted-all pattern as the courses.
                  No slot caps: openSlots is effectively unlimited and the
                  card's stepper works on plain quantities. */}
            {extrasTabs.map((tab) => {
              const isActiveTab = activeCategory === tab.key;
              return (
                <div
                  key={tab.key}
                  className={
                    isActiveTab
                      ? "relative"
                      : "absolute top-0 left-0 w-full opacity-0 pointer-events-none"
                  }
                  aria-hidden={!isActiveTab}
                >
                  {tab.items.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                      {tab.items.map((item) => (
                        <FoodCard
                          key={item.id}
                          item={item}
                          isSelected={(extrasQtyByItem.get(item.id) ?? 0) > 0}
                          isDisabled={false}
                          openSlots={999}
                          placedCount={extrasQtyByItem.get(item.id) ?? 0}
                          requiredMin={
                            effectiveMinQtyPerDish === null
                              ? null
                              : (item.minQty ?? effectiveMinQtyPerDish)
                          }
                          unitPrice={item.price}
                          showBulkActions={false}
                          onAddMany={(n) => onExtraAdd(item, n)}
                          onRemoveMany={(n) => onExtraRemove(item, n)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-white/50 rounded-2xl border border-dashed border-brand-divider">
                      <p className="font-poppins text-brand-text/40">
                        Nothing here yet.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          </section>
        </div>

        {/* ── Section jumper ──
            Pinned to the right edge beside the dishes so the next course is
            always one tap away, mid-scroll, on any screen. Kept mounted so it
            fades rather than pops, and parked at z-30 — under the chat button
            and the lunch-box bar it must never cover. */}
        <div
          aria-hidden={!(nextSection && dishListInView && !trayOpen)}
          className={`fixed right-0 sm:right-4 top-1/2 -translate-y-1/2 z-30 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
            nextSection && dishListInView && !trayOpen
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-6 pointer-events-none"
          }`}
        >
          {nextSection && (
            <button
              type="button"
              onClick={jumpToNextSection}
              title={`Go to ${nextSection.label}`}
              aria-label={`Go to the next course, ${nextSection.label}`}
              className="flex flex-col items-center gap-2.5 rounded-l-2xl sm:rounded-full bg-brand-primary px-2 py-4 text-white shadow-xl shadow-brand-primary/30 transition-[transform,background-color] duration-200 hover:bg-brand-primary/90 hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-primary"
            >
              {/* Upright glyphs stacked downward — a rotated word makes the
                  reader tilt their head; this one just reads. */}
              <span className="[writing-mode:vertical-rl] [text-orientation:upright] font-poppins text-[0.7rem] font-bold uppercase tracking-[0.08em]">
                {nextSection.label}
              </span>
              <ArrowRight
                size={16}
                strokeWidth={2.5}
                className="shrink-0 motion-safe:animate-nudge-right"
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        {/* ── Mobile: lunch-box drawer ──
            The tray panel the aside shows on desktop, reachable from a fixed
            bottom bar instead of a long scroll past every dish card. */}
        {!isDesktop && (
        <div className="lg:hidden">
          {/* Keeps the last picker content scrollable above the fixed bar. */}
          <div className="h-20" aria-hidden="true" />

          <button
            ref={trayBarRef}
            type="button"
            onClick={() => setTrayOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={trayOpen}
            className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-brand-divider pb-[env(safe-area-inset-bottom)] text-left cursor-pointer"
          >
            {/* Fill progress, readable at a glance without opening anything */}
            <div className="h-1 bg-brand-divider/60">
              <div
                className={`h-full transition-[width] duration-300 ${
                  boxesDone === planInstances.length ? "bg-green-500" : "bg-brand-primary"
                }`}
                style={{ width: `${dishSlots ? Math.round((dishesPlaced / dishSlots) * 100) : 0}%` }}
              />
            </div>
            <span className="flex items-center gap-3 px-4 py-2.5 pr-24 min-h-[56px]">
              <span
                className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${
                  boxesDone === planInstances.length
                    ? "bg-green-100 text-green-700"
                    : "bg-brand-primary/10 text-brand-primary"
                }`}
              >
                {boxesDone === planInstances.length ? (
                  <Check size={18} strokeWidth={3} />
                ) : (
                  <Package size={18} />
                )}
              </span>
              <span className="min-w-0">
                <span className="block font-arvo text-sm font-bold text-brand-text">
                  {boxesDone === planInstances.length
                    ? "All lunch boxes complete!"
                    : "Your Lunch Boxes"}
                </span>
                <span className="block font-poppins text-xs text-brand-text/70 tabular-nums truncate">
                  {dishesPlaced}/{dishSlots} dishes · {boxesDone}/{planInstances.length}{" "}
                  {planInstances.length === 1 ? "box" : "boxes"} ready
                </span>
              </span>
              <ChevronUp size={18} className="ml-auto shrink-0 text-brand-text/70" />
            </span>
          </button>

          {/* Backdrop sits over the chat FAB (z-40) so nothing competes with
              the open sheet. */}
          <div
            onClick={() => setTrayOpen(false)}
            aria-hidden="true"
            className={`fixed inset-0 z-[45] bg-black/40 transition-opacity duration-300 ${
              trayOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          />

          <div
            ref={traySheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Your lunch boxes"
            className={`fixed inset-x-0 bottom-0 z-50 h-[85dvh] rounded-t-3xl bg-brand-secondary shadow-2xl flex flex-col transition-transform duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
              trayOpen ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="relative shrink-0 pt-2.5 pb-1">
              <div className="mx-auto w-10 h-1 rounded-full bg-brand-divider" aria-hidden="true" />
              <button
                ref={trayCloseRef}
                type="button"
                onClick={() => setTrayOpen(false)}
                aria-label="Close lunch boxes"
                className="absolute right-2 top-1 flex items-center justify-center w-11 h-11 rounded-full text-brand-text/70 hover:text-brand-text hover:bg-brand-divider/40 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-8 pt-1">
              {sheetContentLive && (
                <TrayPreview
                  compact
                  planInstances={planInstances}
                  extras={extras}
                  categoryMinDishQty={plans[0]?.categoryMinDishQty ?? null}
                  activePlanInstanceId={activePlanInstanceId}
                  getMealPlanLimits={getMealPlanLimits}
                  onSetActivePlan={(id) => {
                    // Picking a box here means "go fill it" — hand back to the
                    // picker rather than leaving it buried under the sheet.
                    onSetActivePlan(id);
                    setTrayOpen(false);
                  }}
                  onMoveItem={onMoveItem}
                  onFixShortDish={goToShortDish}
                  onOpenBag={openBagFromSheet}
                />
              )}
            </div>
          </div>
        </div>
        )}
        </>
      )}

      <ConfirmDialog
        open={confirmClearAll}
        title={`Clear every ${activeLabel}?`}
        // Pluralise "dish", never the course name — "Rice"/"Dessert" + "es"
        // gives "ricees" / "dessertes".
        message={
          <>
            This removes all <strong>{clearableCount}</strong>{" "}
            {clearableCount === 1 ? "dish" : "dishes"} from the{" "}
            <strong>{activeLabel}</strong> course, across{" "}
            <strong>all {sortedInstances.length} lunch boxes</strong>. Your boxes
            and every other course stay exactly as they are.
            <br />
            <span className="text-brand-text/50">This can&rsquo;t be undone.</span>
          </>
        }
        confirmLabel={`Clear all ${clearableCount}`}
        onConfirm={() => {
          clearCourse(activeCategory, null);
          setConfirmClearAll(false);
        }}
        onCancel={() => setConfirmClearAll(false)}
      />
    </div>
  );
};

export default CheckALunch;
