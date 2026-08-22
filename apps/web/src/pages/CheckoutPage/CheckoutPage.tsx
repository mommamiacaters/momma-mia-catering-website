import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { CheckCircle, ArrowLeft, Package, AlertCircle } from "lucide-react";
import type {
  MealPlanOrder,
  SelectedItemWithQuantity,
  CheckoutFormData,
  PlanInstance,
  CheckoutStep,
  PaymentProof,
} from "../../types";
import { submitOrder } from "../../services/orderService";
import { menuService } from "../../services/menuService";
import {
  deriveDishMinimumState,
  deriveMinimumState,
  useStoreSettings,
} from "../../hooks/useStoreSettings";
import {
  fetchPublicSettings,
  SETTING_KEYS,
} from "../../services/settingsService";
import { getCategoryDisplayName } from "../../constants";
import { FALLBACK_IMAGE, onImgError } from "../../components/CachedImage";
import { generateSecureOrderRef } from "../../utils/validation";
import { canSubmitOrder, recordSubmission, getSecondsUntilNext } from "../../utils/rateLimiter";
import { PLAN_SLOTS } from "../../constants/planSlots";
import { groupPlanInstances, aggregateDishes } from "../../utils/mealPlanUtils";
import { SlotIcon } from "../../components/ui/SlotIcons";
import SummaryViewToggle, { type SummaryView } from "../../components/ui/SummaryViewToggle";
import StepIndicator from "./components/StepIndicator";
import DeliveryStep from "./components/DeliveryStep";
import PaymentStep from "./components/PaymentStep";

interface CheckoutState {
  mealPlanOrders: MealPlanOrder[];
  selectedItems: SelectedItemWithQuantity[];
  planInstances?: PlanInstance[];
  subtotal: number;
  /** Which service the cart belongs to, so we can link the customer back to it. */
  slug?: string;
}

/** Recover cart from sessionStorage when location.state is null (page refresh, direct URL). */
function findCartInSession(): CheckoutState | null {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith("cart:")) continue;
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const snap = JSON.parse(raw);
      // Must match CART_VERSION in useOrderManagement: v1 snapshots name the two
      // retired plans, so restoring one yields a box with no price or limits.
      if (snap.version !== 2) continue;
      if (Date.now() - snap.savedAt > 86_400_000) continue;
      if (!snap.planInstances?.length) continue;

      const counts = new Map<string, { mealPlanId: number; quantity: number }>();
      for (const pi of snap.planInstances) {
        const seen = counts.get(pi.type);
        counts.set(pi.type, {
          mealPlanId: pi.mealPlanId,
          quantity: (seen?.quantity ?? 0) + 1,
        });
      }

      const mealPlanOrders: MealPlanOrder[] = [];
      counts.forEach((v, type) =>
        mealPlanOrders.push({ mealPlanId: v.mealPlanId, type, quantity: v.quantity })
      );

      const selectedItems = snap.planInstances.flatMap(
        (pi: PlanInstance) =>
          pi.items.map((item: PlanInstance["items"][number]) => ({
            ...item,
            quantity: 1,
          }))
      );

      return {
        mealPlanOrders,
        selectedItems,
        planInstances: snap.planInstances,
        subtotal: snap.subtotal ?? 0,
        // Keys are `cart:<slug>` (useOrderManagement) — record the slug we
        // actually restored so we can send the customer back to it.
        slug: key.slice("cart:".length),
      };
    }
  } catch {
    /* unreadable snapshot — fall through to no cart */
  }
  return null;
}

const CATEGORY_ORDER = PLAN_SLOTS;

const CheckoutPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const orderState = location.state as CheckoutState | null;
  const effectiveState = orderState ?? findCartInSession();

  // ─── Wizard state ───
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("delivery");
  const [formData, setFormData] = useState<CheckoutFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    deliveryDate: "",
    deliveryTime: "",
    deliveryAddress: "",
    specialRequests: "",
  });
  const [paymentProof, setPaymentProof] = useState<PaymentProof | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [orderRef, setOrderRef] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Honeypot field
  const [honeypot, setHoneypot] = useState("");

  // Order-minimum gate. Hooks must stay above the `!effectiveState` early return.
  const {
    minimumMealPlans,
    minimumQtyPerDish,
    error: settingsError,
    retry: retrySettings,
  } = useStoreSettings();
  const [checking, setChecking] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const boxes = effectiveState?.planInstances?.length ?? 0;
  // The service's own floor (fetched from the cart's plans) beats the store
  // default. Until it loads, the default applies — verifyMinimum re-reads
  // everything live before any money moves either way.
  const [categoryMinBoxes, setCategoryMinBoxes] = useState<number | null>(null);
  // Overview (default) collapses each build to one line per distinct dish so
  // a 45-box order reads at a glance; Detailed keeps every dish slot as its
  // own row. Purely presentational — same groupedBoxes data.
  const [summaryView, setSummaryView] = useState<SummaryView>("overview");
  useEffect(() => {
    const ids = (effectiveState?.planInstances ?? []).map((pi) => pi.mealPlanId);
    if (ids.length === 0) return;
    let active = true;
    menuService
      .fetchPlanCategoryMinimum(ids)
      .then((m) => {
        if (active) setCategoryMinBoxes(m);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // The cart doesn't change while checkout is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const min = deriveMinimumState(categoryMinBoxes ?? minimumMealPlans, boxes);
  const dishMin = deriveDishMinimumState(
    minimumQtyPerDish,
    effectiveState?.planInstances ?? [],
  );

  /**
   * Fresh read straight from the DB, bypassing the module cache, so an admin
   * raising the minimum mid-session can't strand a customer who has already
   * paid. Runs before the payment QR is shown and again before the receipt is
   * uploaded.
   */
  const verifyMinimum = async (): Promise<boolean> => {
    setChecking(true);
    setGateError(null);
    try {
      const s = await fetchPublicSettings();
      const raw = s[SETTING_KEYS.minimumMealPlans];
      const liveDefault =
        typeof raw === "number" && Number.isInteger(raw) && raw >= 0 ? raw : 0;
      // The cart's service may carry its own floor — read it live too.
      const liveCatMin = await menuService.fetchPlanCategoryMinimum(
        (effectiveState?.planInstances ?? []).map((pi) => pi.mealPlanId),
      );
      const live = liveCatMin ?? liveDefault;
      if (boxes > 0 && boxes < live) {
        setGateError(
          `The minimum order size is ${live} lunch boxes. Your order has ${boxes}. Please go back and add ${live - boxes} more — nothing has been charged.`,
        );
        return false;
      }
      // Same fresh read for the per-dish floor — INCLUDING the per-dish
      // overrides. The cart's minQty snapshots can be a day stale, and this
      // gate exists precisely so the server's post-payment check never fires;
      // so ask menu_items what the server will actually enforce.
      const rawDish = s[SETTING_KEYS.minimumQtyPerDish];
      const liveDish =
        typeof rawDish === "number" && Number.isInteger(rawDish) && rawDish >= 0
          ? rawDish
          : 0;
      const cartPlans = effectiveState?.planInstances ?? [];
      const dishIds = [
        ...new Set(cartPlans.flatMap((pi) => pi.items.map((ai) => ai.menuItemId))),
      ];
      const liveOverrides = await menuService.fetchDishMinimums(dishIds);
      const livePlans = cartPlans.map((pi) => ({
        ...pi,
        items: pi.items.map((ai) =>
          liveOverrides.has(ai.menuItemId)
            ? { ...ai, minQty: liveOverrides.get(ai.menuItemId) ?? null }
            : ai,
        ),
      }));
      const liveDishMin = deriveDishMinimumState(liveDish, livePlans);
      if (boxes > 0 && liveDishMin.violations.length > 0) {
        const v = liveDishMin.violations[0];
        setGateError(
          `Each dish needs at least ${v.required} servings once it's in your order. "${v.name}" has ${v.current} — please go back and add ${v.remaining} more, or take it out. Nothing has been charged.`,
        );
        return false;
      }
      return true;
    } catch {
      setGateError(
        "We couldn't confirm this store's order rules just now. Please check your connection and try again — nothing has been charged.",
      );
      return false;
    } finally {
      setChecking(false);
    }
  };

  // Redirect if no order state
  useEffect(() => {
    if (!effectiveState) {
      navigate("/meals", { replace: true });
    }
  }, [effectiveState, navigate]);

  // Auto-redirect after success
  useEffect(() => {
    if (status !== "success") return;
    const timer = setTimeout(() => navigate("/meals"), 10000);
    return () => clearTimeout(timer);
  }, [status, navigate]);

  if (!effectiveState) return null;

  const { mealPlanOrders, selectedItems, planInstances, subtotal } = effectiveState;

  // Sort plan instances by displayOrder
  const sortedPlanInstances = planInstances
    ? [...planInstances].sort((a, b) => a.displayOrder - b.displayOrder)
    : null;

  // Identical boxes collapse into one summary card with a count — a 30-box
  // order is usually two or three builds, and must read that way instead of
  // thirty near-identical cards. Same grouping the admin order view uses:
  // signature = plan + its dishes (by id, sorted so order can't split groups).
  const groupedBoxes = sortedPlanInstances
    ? groupPlanInstances(sortedPlanInstances)
    : null;

  // ─── Step handlers ───
  // Gate the transition BEFORE the payment QR is rendered. This is what stops
  // the rule from being enforced only after the customer has already paid.
  const handleContinueToPayment = async () => {
    if (checking) return;
    if (!(await verifyMinimum())) return;
    setCurrentStep("payment");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToDelivery = () => {
    setCurrentStep("delivery");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    // Honeypot check — silently fake success if filled
    if (honeypot) {
      setStatus("success");
      setOrderRef("MM-00000000-0000-0000");
      return;
    }

    // Rate limit check
    if (!canSubmitOrder()) {
      const secs = getSecondsUntilNext();
      setSubmitError(`Please wait ${secs}s before submitting another order.`);
      return;
    }

    if (!paymentProof) {
      setSubmitError("Please upload your payment receipt before submitting.");
      return;
    }

    // Re-check before the proof upload so a doomed order never orphans a blob
    // in the payment-proofs bucket.
    if (!(await verifyMinimum())) {
      setSubmitError(gateError);
      return;
    }

    setStatus("submitting");
    setSubmitError(null);

    const ref = generateSecureOrderRef();
    setOrderRef(ref);

    try {
      await submitOrder({
        customer: formData,
        order: {
          mealPlans: mealPlanOrders,
          items: selectedItems.map((i) => ({
            menuItemId: i.menuItemId,
            name: i.name,
            type: i.type,
            image: i.image,
          })),
          subtotal,
          planInstances: planInstances || undefined,
        },
        orderRef: ref,
        paymentProof: {
          base64: paymentProof.base64,
          mimeType: paymentProof.mimeType,
          fileName: paymentProof.fileName,
        },
      });

      setStatus("success");
      setCurrentStep("confirmation");
      recordSubmission();

      // Clear all cart entries from sessionStorage
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key?.startsWith("cart:")) sessionStorage.removeItem(key);
      }
    } catch (e) {
      // Bind the error — a bare catch made a correctly-firing server rejection
      // indistinguishable from a network failure, so the customer was told
      // nothing useful after having already paid. submitOrder has already
      // mapped this to customer-safe copy via mapOrderError.
      setStatus("error");
      setSubmitError(
        e instanceof Error
          ? e.message
          : "Something went wrong and your order was not placed. Nothing was charged — please try again or contact us.",
      );
    }
  };

  // ─── Order Summary (shared between steps) ───
  const OrderSummary = (
    <div className="bg-white rounded-2xl shadow-sm p-5 lg:sticky lg:top-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-arvo font-bold text-brand-text text-lg">
          Order Summary
        </h2>
        {sortedPlanInstances && sortedPlanInstances.length > 0 && (
          <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 font-poppins text-xs font-semibold text-brand-primary tabular-nums">
            {sortedPlanInstances.length}{" "}
            {sortedPlanInstances.length === 1 ? "box" : "boxes"}
          </span>
        )}
      </div>

      {/* Overview (default) is the wide at-a-glance version; Detailed lists
          every dish slot. */}
      {groupedBoxes && groupedBoxes.length > 0 && (
        <SummaryViewToggle
          value={summaryView}
          onChange={setSummaryView}
          className="mb-4"
        />
      )}

      {groupedBoxes && groupedBoxes.length > 0 && summaryView === "overview" ? (
        /* ── Overview: one compact tile per build, one line per distinct
              dish — no card per dish slot. Wide: tiles flow into columns. ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
          {groupedBoxes.map((group) => (
            <div
              key={group.sample.id}
              className="border border-brand-divider rounded-xl px-3 py-2.5"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-poppins text-sm font-semibold text-brand-text min-w-0 truncate">
                  {group.type}
                </span>
                <span className="ml-auto shrink-0 rounded-full bg-brand-primary px-2 py-0.5 font-poppins text-xs font-bold text-white tabular-nums">
                  &times;{group.count}
                </span>
              </div>
              {aggregateDishes(group.sample.items).map((dish) => (
                <div
                  key={`${dish.type}-${dish.name}`}
                  className="flex items-center gap-1.5 py-0.5 min-w-0"
                >
                  <SlotIcon slot={dish.type} size={11} className="shrink-0" />
                  <div className="w-5 h-5 rounded overflow-hidden shrink-0 border border-brand-divider/50">
                    <img
                      src={dish.image || FALLBACK_IMAGE}
                      onError={onImgError}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="font-poppins text-xs text-brand-text capitalize truncate">
                    {dish.qty > 1 && (
                      <span className="font-semibold tabular-nums">{dish.qty}&times; </span>
                    )}
                    {dish.name}
                  </span>
                </div>
              ))}
              {group.sample.items.length === 0 && (
                <p className="font-poppins text-xs text-brand-text/30 italic py-1">
                  No dishes selected
                </p>
              )}
            </div>
          ))}
        </div>
      ) : groupedBoxes && groupedBoxes.length > 0 ? (
        <div className="space-y-3 mb-4">
          {groupedBoxes.map((group) => (
            <div
              key={group.sample.id}
              className="border border-brand-divider rounded-xl overflow-hidden"
            >
              <div className="px-3 py-2.5 bg-brand-secondary/50 flex items-center gap-2">
                <Package size={14} className="text-brand-primary shrink-0" />
                <span className="font-poppins text-sm font-semibold text-brand-text min-w-0 truncate">
                  {group.type}
                </span>
                <span className="ml-auto shrink-0 rounded-full bg-brand-primary px-2 py-0.5 font-poppins text-xs font-bold text-white tabular-nums">
                  ×{group.count}
                </span>
              </div>
              <div className="px-3 py-2 space-y-2">
                {CATEGORY_ORDER.map((catType) => {
                  const items = group.sample.items.filter(
                    (item) => item.type === catType,
                  );
                  if (items.length === 0) return null;
                  return (
                    <div key={catType}>
                      <p className="font-poppins text-[0.65rem] font-semibold text-brand-text/40 uppercase tracking-wider mb-1">
                        {getCategoryDisplayName(catType)}
                      </p>
                      {items.map((item) => (
                        <div key={item.instanceId} className="flex items-center gap-2 py-1">
                          <div className="w-7 h-7 rounded-md overflow-hidden shrink-0 border border-brand-divider/50">
                            <img
                              src={item.image || FALLBACK_IMAGE}
                              onError={onImgError}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="font-poppins text-sm text-brand-text capitalize truncate">
                            {item.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {group.sample.items.length === 0 && (
                  <p className="font-poppins text-xs text-brand-text/30 italic py-1">
                    No dishes selected
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Fallback: flat item list */
        <>
          <div className="space-y-3 mb-4">
            {mealPlanOrders.map((plan) => (
              <div
                key={plan.type}
                className="flex items-center justify-between py-2 border-b border-brand-divider/50 last:border-b-0"
              >
                <div>
                  <p className="font-poppins text-sm font-medium text-brand-text">
                    {plan.type}
                  </p>
                  <p className="font-poppins text-xs text-brand-text/50">
                    x{plan.quantity}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {selectedItems.length > 0 && (
            <div className="mb-4">
              <h3 className="font-poppins text-xs font-semibold text-brand-text/50 uppercase tracking-wider mb-2">
                Selected Items
              </h3>
              <div className="space-y-2">
                {selectedItems.map((item) => (
                  <div key={item.instanceId} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-brand-divider/50">
                      <img
                        src={item.image || FALLBACK_IMAGE}
                        onError={onImgError}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="font-poppins text-sm text-brand-text capitalize truncate">
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Subtotal */}
      <div className="flex items-center justify-between pt-3 border-t border-brand-divider">
        <span className="font-poppins text-sm text-brand-text/50">Subtotal</span>
        <span className="font-arvo font-bold text-xl text-brand-primary tabular-nums">
          &#8369;{subtotal}
        </span>
      </div>
    </div>
  );

  // ─── SUCCESS VIEW ───
  if (status === "success") {
    return (
      <div className="min-h-screen bg-brand-secondary flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 max-w-lg w-full text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6 animate-[scale-in_0.4s_ease-out]">
            <CheckCircle size={40} className="text-green-600" />
          </div>

          <h1 className="font-arvo font-bold text-2xl md:text-3xl text-brand-text mb-3">
            Thank you for your order!
          </h1>

          <p className="font-poppins text-brand-text/60 text-sm mb-2">
            Order Reference:{" "}
            <span className="font-semibold text-brand-primary">{orderRef}</span>
          </p>

          <p className="font-poppins text-brand-text/60 text-sm mb-2">
            Payment receipt received — we'll verify it shortly.
          </p>

          <p className="font-poppins text-brand-text/60 text-sm mb-8">
            We've sent a confirmation to{" "}
            <span className="font-medium">{formData.email}</span>. Our team will
            reach out to confirm the details.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/meals"
              className="px-6 py-2.5 bg-gradient-to-r from-brand-primary to-brand-accent text-white font-poppins font-semibold text-sm rounded-xl hover:shadow-lg transition-all"
            >
              Browse More Services
            </Link>
            <Link
              to="/contact"
              className="px-6 py-2.5 border border-brand-primary/20 text-brand-primary font-poppins font-medium text-sm rounded-xl hover:bg-brand-primary/5 transition-colors"
            >
              Contact Us
            </Link>
          </div>

          <p className="font-poppins text-xs text-brand-text/30 mt-6">
            Redirecting to home in a few seconds...
          </p>
        </div>
      </div>
    );
  }

  // ─── CHECKOUT WIZARD ───
  return (
    <div className="min-h-screen bg-brand-secondary">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 lg:px-12 pt-6 pb-12 md:pt-10 md:pb-16">
        {/* Back link */}
        <button
          onClick={() =>
            currentStep === "payment" ? handleBackToDelivery() : navigate(-1)
          }
          className="inline-flex items-center gap-2 text-brand-text hover:text-brand-primary mb-6 font-poppins text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          {currentStep === "payment" ? "Back to Delivery" : "Back to Order"}
        </button>

        <h1 className="font-arvo font-bold text-2xl md:text-3xl text-brand-text mb-2">
          Checkout
        </h1>

        {/* Step indicator */}
        <StepIndicator current={currentStep} />

        {/* Honeypot — hidden from humans, visible to bots */}
        <div
          style={{ position: "absolute", left: "-9999px", top: "-9999px" }}
          aria-hidden="true"
        >
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* ─── LEFT: Order Summary (2 cols) ─── */}
          <div className="lg:col-span-2 order-2 lg:order-1">{OrderSummary}</div>

          {/* ─── RIGHT: Step Content (3 cols) ─── */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
              {/* A below-minimum (or unverifiable) cart gets an explanation and
                  a way out — NOT a silent navigate() that would teleport the
                  customer and destroy half-typed delivery details. */}
              {boxes > 0 && (min.blocked || dishMin.blocked) ? (
                <div className="text-center py-6">
                  <AlertCircle
                    size={40}
                    className="mx-auto mb-4 text-brand-primary"
                  />
                  <h2 className="font-arvo font-bold text-brand-text text-lg mb-2">
                    {settingsError
                      ? "Couldn't load the order rules"
                      : min.blocked
                        ? "A few more lunch boxes needed"
                        : "Some dishes need more servings"}
                  </h2>
                  <p className="font-poppins text-sm text-brand-text/60 mb-6 max-w-sm mx-auto leading-relaxed">
                    {settingsError
                      ? "We couldn't confirm this store's order rules just now. Please check your connection and try again — nothing has been charged."
                      : min.blocked
                        ? `Your order has ${boxes} lunch ${boxes === 1 ? "box" : "boxes"}. Orders need at least ${min.minimum} before we can take it. Nothing has been charged.`
                        : `Each dish in your order has a per-order minimum. Still short: ${dishMin.violations
                            .map((v) => `${v.name} (${v.current}/${v.required})`)
                            .join(", ")}. Please go back and top them up, or take them out. Nothing has been charged.`}
                  </p>
                  <button
                    onClick={() =>
                      settingsError
                        ? retrySettings()
                        : navigate(
                            effectiveState.slug
                              ? `/services/${effectiveState.slug}`
                              : "/meals",
                          )
                    }
                    className="px-6 py-3 rounded-xl bg-brand-primary text-white font-poppins font-semibold hover:bg-brand-primary/90 transition-colors cursor-pointer"
                  >
                    {settingsError ? "Retry" : "Back to your order"}
                  </button>
                </div>
              ) : (
                <>
              {currentStep === "delivery" && (
                <>
                  <h2 className="font-arvo font-bold text-brand-text text-lg mb-5">
                    Delivery Details
                  </h2>
                  {gateError && (
                    <p className="mb-4 font-poppins text-sm text-red-600">
                      {gateError}
                    </p>
                  )}
                  <DeliveryStep
                    formData={formData}
                    onChange={setFormData}
                    onContinue={handleContinueToPayment}
                  />
                </>
              )}

              {currentStep === "payment" && (
                <>
                  <h2 className="font-arvo font-bold text-brand-text text-lg mb-5">
                    Payment
                  </h2>
                  <PaymentStep
                    subtotal={subtotal}
                    paymentProof={paymentProof}
                    onProofChange={setPaymentProof}
                    onBack={handleBackToDelivery}
                    onSubmit={handleSubmit}
                    isSubmitting={status === "submitting" || checking}
                    error={
                      submitError ? (
                        <span>
                          {submitError}{" "}
                          <Link
                            to="/contact"
                            className="underline font-semibold"
                          >
                            Contact us
                          </Link>
                        </span>
                      ) : null
                    }
                  />
                </>
              )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
