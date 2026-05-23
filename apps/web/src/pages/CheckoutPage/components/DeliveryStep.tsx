import React from "react";
import { ArrowRight } from "lucide-react";
import type { CheckoutFormData } from "../../../types";
import { sanitizeText, sanitizeEmail } from "../../../utils/validation";

const INPUT_CLASS =
  "w-full px-4 py-2.5 border border-brand-divider rounded-lg font-poppins text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary focus:outline-none transition-colors";

interface Props {
  formData: CheckoutFormData;
  onChange: (data: CheckoutFormData) => void;
  onContinue: () => void;
}

const DeliveryStep: React.FC<Props> = ({ formData, onChange, onContinue }) => {
  const todayStr = new Date().toISOString().split("T")[0];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    onChange({ ...formData, [name]: value });
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "email") {
      onChange({ ...formData, [name]: sanitizeEmail(value) });
    } else if (name !== "deliveryDate" && name !== "deliveryTime") {
      onChange({ ...formData, [name]: sanitizeText(value) });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onContinue();
  };

  return (
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
            onBlur={handleBlur}
            className={INPUT_CLASS}
            required
          />
          <input
            type="text"
            name="lastName"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className={INPUT_CLASS}
            required
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
          onBlur={handleBlur}
          className={INPUT_CLASS}
          required
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
          onBlur={handleBlur}
          className={INPUT_CLASS}
          required
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
          onBlur={handleBlur}
          className={INPUT_CLASS}
          required
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
          onBlur={handleBlur}
          className={`${INPUT_CLASS} resize-none`}
        />
      </div>

      {/* Continue */}
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-poppins font-semibold text-sm bg-gradient-to-r from-brand-primary to-brand-accent text-white shadow-lg shadow-brand-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all"
      >
        Continue to Payment
        <ArrowRight size={16} />
      </button>
    </form>
  );
};

export default DeliveryStep;
