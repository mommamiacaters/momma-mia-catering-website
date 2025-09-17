import React from "react";

interface ServiceOptionsProps {
  onSelect: (service: string, serviceName: string) => void;
  addMessage: (text: string, sender: "user" | "bot") => void;
}

const ServiceOptions: React.FC<ServiceOptionsProps> = ({
  onSelect,
  addMessage,
}) => (
  <div className="flex flex-col gap-2 mt-2 w-full animate-in fade-in duration-500">
    <button
      className="bg-gradient-to-r from-brand-primary to-brand-accent text-white border-none py-2.5 px-4 rounded-2xl cursor-pointer text-sm font-medium transition-all duration-300 shadow-lg shadow-brand-primary/30 flex items-center gap-2 text-left hover:translate-y-[-1px] hover:shadow-xl hover:shadow-brand-primary/40 active:scale-[0.98]"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addMessage("I'd like to see Check-a-Lunch options", "user");
        onSelect("check-a-lunch", "Check-a-Lunch");
      }}
    >
      <span className="text-lg min-w-[20px]">🍱</span>
      <span>Check-a-Lunch (Individual Meals)</span>
    </button>
    <button
      className="bg-gradient-to-r from-brand-primary to-brand-accent text-white border-none py-2.5 px-4 rounded-2xl cursor-pointer text-sm font-medium transition-all duration-300 shadow-lg shadow-brand-primary/30 flex items-center gap-2 text-left hover:translate-y-[-1px] hover:shadow-xl hover:shadow-brand-primary/40 active:scale-[0.98]"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addMessage("I'd like to see Fun Boxes options", "user");
        onSelect("fun-boxes", "Fun Boxes");
      }}
    >
      <span className="text-lg min-w-[20px]">📦</span>
      <span>Fun Boxes (Mix & Match)</span>
    </button>
  </div>
);

export default ServiceOptions;
