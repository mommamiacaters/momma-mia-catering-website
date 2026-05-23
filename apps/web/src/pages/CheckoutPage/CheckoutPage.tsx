import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { CheckCircle, ArrowLeft, Package } from "lucide-react";
import type {
  MealPlanOrder,
  SelectedItemWithQuantity,
  CheckoutFormData,
  PlanInstance,
  CheckoutStep,
  PaymentProof,
} from "../../types";
import { submitOrder } from "../../services/orderService";
import { getCategoryDisplayName } from "../../constants";
import { FALLBACK_IMAGE } from "../../components/CachedImage";
import { generateSecureOrderRef } from "../../utils/validation";
import { canSubmitOrder, recordSubmission, getSecondsUntilNext } from "../../utils/rateLimiter";
import StepIndicator from "./components/StepIndicator";
import DeliveryStep from "./components/DeliveryStep";
import PaymentStep from "./components/PaymentStep";

interface CheckoutState {
  mealPlanOrders: MealPlanOrder[];
  selectedItems: SelectedItemWithQuantity[];
  planInstances?: PlanInstance[];
  subtotal: number;
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
      if (Date.now() - snap.savedAt > 86_400_000) continue;
      if (!snap.planInstances?.length) continue;

      const counts = new Map<string, number>();
      for (const pi of snap.planInstances)
        counts.set(pi.type, (counts.get(pi.type) || 0) + 1);

      const mealPlanOrders: MealPlanOrder[] = [];
      counts.forEach((qty, type) =>
        mealPlanOrders.push({ type: type as MealPlanOrder["type"], quantity: qty })
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
      };
    }
  } catch {}
  return null;
}

const CATEGORY_ORDER = ["main", "side", "starch"] as const;

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

  // Instance numbering per type
  const instanceNumbers = new Map<string, number>();
  if (sortedPlanInstances) {
    const typeCounters = new Map<string, number>();
    for (const pi of sortedPlanInstances) {
      const n = (typeCounters.get(pi.type) || 0) + 1;
      typeCounters.set(pi.type, n);
      instanceNumbers.set(pi.id, n);
    }
  }

  // ─── Step handlers ───
  const handleContinueToPayment = () => {
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
    } catch {
      setStatus("error");
      setSubmitError("Something went wrong. Please try again.");
    }
  };

  // ─── Order Summary (shared between steps) ───
  const OrderSummary = (
    <div className="bg-white rounded-2xl shadow-sm p-5 lg:sticky lg:top-8">
      <h2 className="font-arvo font-bold text-brand-text text-lg mb-4">
        Order Summary
      </h2>

      {sortedPlanInstances && sortedPlanInstances.length > 0 ? (
        <div className="space-y-3 mb-4">
          {sortedPlanInstances.map((pi) => {
            const instanceNum = instanceNumbers.get(pi.id) || 1;
            return (
              <div
                key={pi.id}
                className="border border-brand-divider rounded-xl overflow-hidden"
              >
                <div className="px-3 py-2.5 bg-brand-secondary/50 flex items-center gap-2">
                  <Package size={14} className="text-brand-primary shrink-0" />
                  <span className="font-poppins text-sm font-semibold text-brand-text">
                    #{instanceNum} {pi.type}
                  </span>
                </div>
                <div className="px-3 py-2 space-y-2">
                  {CATEGORY_ORDER.map((catType) => {
                    const items = pi.items.filter((item) => item.type === catType);
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
                  {pi.items.length === 0 && (
                    <p className="font-poppins text-xs text-brand-text/30 italic py-1">
                      No dishes selected
                    </p>
                  )}
                </div>
              </div>
            );
          })}
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
              {currentStep === "delivery" && (
                <>
                  <h2 className="font-arvo font-bold text-brand-text text-lg mb-5">
                    Delivery Details
                  </h2>
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
                    isSubmitting={status === "submitting"}
                    error={submitError}
                  />
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
