import React from "react";
import { Check } from "lucide-react";
import type { CheckoutStep } from "../../../types";

const STEPS: { key: CheckoutStep; label: string }[] = [
  { key: "delivery", label: "Delivery" },
  { key: "payment", label: "Payment" },
  { key: "confirmation", label: "Done" },
];

const STEP_INDEX: Record<CheckoutStep, number> = {
  delivery: 0,
  payment: 1,
  confirmation: 2,
};

interface Props {
  current: CheckoutStep;
}

const StepIndicator: React.FC<Props> = ({ current }) => {
  const currentIdx = STEP_INDEX[current];

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;

        return (
          <React.Fragment key={step.key}>
            {/* Connector line (before each step except first) */}
            {i > 0 && (
              <div
                className={`h-0.5 w-8 sm:w-12 transition-colors ${
                  i <= currentIdx ? "bg-brand-primary" : "bg-brand-divider"
                }`}
              />
            )}

            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-poppins font-semibold transition-all ${
                  isDone
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-brand-primary text-white shadow-md shadow-brand-primary/30"
                    : "bg-brand-divider text-brand-text/40"
                }`}
              >
                {isDone ? <Check size={14} strokeWidth={3} /> : i + 1}
              </div>
              <span
                className={`hidden sm:block font-poppins text-xs transition-colors ${
                  isActive
                    ? "text-brand-primary font-semibold"
                    : isDone
                    ? "text-green-600 font-medium"
                    : "text-brand-text/30"
                }`}
              >
                {step.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default StepIndicator;
