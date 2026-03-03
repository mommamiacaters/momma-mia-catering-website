import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { CheckCircle, ArrowLeft, Loader2 } from "lucide-react";
import type {
  MealPlanOrder,
  SelectedItemWithQuantity,
  CheckoutFormData,
} from "../../types";
import { submitOrder } from "../../services/orderService";

interface CheckoutState {
  mealPlanOrders: MealPlanOrder[];
  selectedItems: SelectedItemWithQuantity[];
  subtotal: number;
}

const generateOrderRef = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(now.getHours() * 60 + now.getMinutes()).padStart(4, "0");
  return `MM-${date}-${seq}`;
};

const INPUT_CLASS =
  "w-full px-4 py-2.5 border border-brand-divider rounded-lg font-poppins text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary focus:outline-none transition-colors";

const CheckoutPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const orderState = location.state as CheckoutState | null;

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
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [orderRef, setOrderRef] = useState("");

  // Redirect if no order state (direct URL access)
  useEffect(() => {
    if (!orderState) {
      navigate("/meals", { replace: true });
    }
  }, [orderState, navigate]);

  // Auto-redirect after success
  useEffect(() => {
    if (status !== "success") return;
    const timer = setTimeout(() => navigate("/meals"), 10000);
    return () => clearTimeout(timer);
  }, [status, navigate]);

  if (!orderState) return null;

  const { mealPlanOrders, selectedItems, subtotal } = orderState;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");

    const ref = generateOrderRef();
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
        },
        orderRef: ref,
      });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  // ---------- SUCCESS VIEW ----------
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

  // ---------- CHECKOUT FORM ----------
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-brand-secondary">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 lg:px-12 pt-6 pb-12 md:pt-10 md:pb-16">
        {/* Back link */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-brand-text hover:text-brand-primary mb-8 font-poppins text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Order
        </button>

        <h1 className="font-arvo font-bold text-2xl md:text-3xl text-brand-text mb-8">
          Checkout
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* ─── LEFT: Order Summary (2 cols) ─── */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <div className="bg-white rounded-2xl shadow-sm p-5 lg:sticky lg:top-8">
              <h2 className="font-arvo font-bold text-brand-text text-lg mb-4">
                Order Summary
              </h2>

              {/* Meal Plans */}
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

              {/* Selected Items */}
              {selectedItems.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-poppins text-xs font-semibold text-brand-text/50 uppercase tracking-wider mb-2">
                    Selected Items
                  </h3>
                  <div className="space-y-2">
                    {selectedItems.map((item) => (
                      <div
                        key={item.instanceId}
                        className="flex items-center gap-2.5"
                      >
                        {item.image ? (
                          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-brand-divider/50">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-brand-primary">
                              {item.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <span className="font-poppins text-sm text-brand-text capitalize truncate">
                          {item.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtotal */}
              <div className="flex items-center justify-between pt-3 border-t border-brand-divider">
                <span className="font-poppins text-sm text-brand-text/50">
                  Subtotal
                </span>
                <span className="font-arvo font-bold text-xl text-brand-primary tabular-nums">
                  &#8369;{subtotal}
                </span>
              </div>
            </div>
          </div>

          {/* ─── RIGHT: Checkout Form (3 cols) ─── */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="font-arvo font-bold text-brand-text text-lg mb-5">
                Delivery Details
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name Row */}
                <div>
                  <label className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      name="firstName"
                      placeholder="First Name"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className={INPUT_CLASS}
                      required
                      disabled={status === "submitting"}
                    />
                    <input
                      type="text"
                      name="lastName"
                      placeholder="Last Name"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className={INPUT_CLASS}
                      required
                      disabled={status === "submitting"}
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="ck-email"
                    className="block text-sm font-poppins font-medium text-brand-text mb-1.5"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="ck-email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={INPUT_CLASS}
                    required
                    disabled={status === "submitting"}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label
                    htmlFor="ck-phone"
                    className="block text-sm font-poppins font-medium text-brand-text mb-1.5"
                  >
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    id="ck-phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={INPUT_CLASS}
                    required
                    disabled={status === "submitting"}
                  />
                </div>

                {/* Date & Time Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="ck-date"
                      className="block text-sm font-poppins font-medium text-brand-text mb-1.5"
                    >
                      Delivery Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="deliveryDate"
                      id="ck-date"
                      min={todayStr}
                      value={formData.deliveryDate}
                      onChange={handleInputChange}
                      className={INPUT_CLASS}
                      required
                      disabled={status === "submitting"}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ck-time"
                      className="block text-sm font-poppins font-medium text-brand-text mb-1.5"
                    >
                      Preferred Time
                    </label>
                    <input
                      type="time"
                      name="deliveryTime"
                      id="ck-time"
                      value={formData.deliveryTime}
                      onChange={handleInputChange}
                      className={INPUT_CLASS}
                      disabled={status === "submitting"}
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label
                    htmlFor="ck-address"
                    className="block text-sm font-poppins font-medium text-brand-text mb-1.5"
                  >
                    Delivery Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="deliveryAddress"
                    id="ck-address"
                    value={formData.deliveryAddress}
                    onChange={handleInputChange}
                    className={INPUT_CLASS}
                    required
                    disabled={status === "submitting"}
                  />
                </div>

                {/* Special Requests */}
                <div>
                  <label
                    htmlFor="ck-requests"
                    className="block text-sm font-poppins font-medium text-brand-text mb-1.5"
                  >
                    Special Requests
                  </label>
                  <textarea
                    name="specialRequests"
                    id="ck-requests"
                    rows={3}
                    value={formData.specialRequests}
                    onChange={handleInputChange}
                    className={`${INPUT_CLASS} resize-none`}
                    disabled={status === "submitting"}
                  />
                </div>

                {/* Error */}
                {status === "error" && (
                  <p className="text-red-500 font-poppins text-sm">
                    Something went wrong. Please try again.
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-poppins font-semibold text-sm bg-gradient-to-r from-brand-primary to-brand-accent text-white shadow-lg shadow-brand-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg"
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Placing Order...
                    </>
                  ) : (
                    <>Place Order &middot; &#8369;{subtotal}</>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
