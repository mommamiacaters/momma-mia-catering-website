import React from "react";

interface MealItem {
  name: string;
  price: string;
}

interface MealListProps {
  service: keyof typeof mealData;
  serviceName: string;
  onContinue: () => void;
  addMessage: (text: string, sender: "user" | "bot") => void;
}

const mealData = {
  "check-a-lunch": [
    { name: "Chicken Adobo Meal", price: "₱650" },
    { name: "Beef Caldereta Meal", price: "₱750" },
    { name: "Pork Sisig Meal", price: "₱700" },
    { name: "Fish Fillet Meal", price: "₱680" },
    { name: "Vegetable Spring Rolls Meal", price: "₱600" },
  ],
  "fun-boxes": [
    { name: "Mini Pancit Canton Box", price: "₱800" },
    { name: "Chicken BBQ Skewers Box", price: "₱900" },
    { name: "Lumpia Shanghai Box", price: "₱750" },
    { name: "Mixed Rice Bowls Box", price: "₱850" },
    { name: "Assorted Sandwiches Box", price: "₱700" },
    { name: "Filipino Snacks Mix Box", price: "₱650" },
  ],
};

const MealList: React.FC<MealListProps> = ({
  service,
  serviceName,
  onContinue,
  addMessage,
}) => {
  const meals = mealData[service];

  return (
    <div className="bg-brand-secondary border-2 border-brand-divider rounded-2xl p-4 mt-2 w-full animate-in fade-in duration-500">
      <h4 className="text-brand-text mb-2.5 text-sm flex items-center gap-1.5 font-semibold font-arvo">
        🍽️ {serviceName} Menu
      </h4>
      {meals.map((meal, index) => (
        <div
          key={index}
          className="bg-white rounded-lg py-2 px-3 mb-2 text-xs text-brand-text border border-brand-divider flex justify-between items-center last:mb-0"
        >
          <span className="flex-1">{meal.name}</span>
          <span className="text-brand-primary font-semibold text-xs font-arvo">
            {meal.price}
          </span>
        </div>
      ))}
      <button
        className="bg-gradient-to-r from-brand-primary to-brand-accent text-white border-none py-2 px-4 rounded-2xl cursor-pointer text-xs font-medium transition-all duration-300 mt-2.5 shadow-md shadow-brand-primary/30 hover:translate-y-[-1px] hover:shadow-lg hover:shadow-brand-primary/40"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          addMessage(
            "I want to select meals and continue with my order",
            "user"
          );
          onContinue();
        }}
      >
        Select Meals & Continue Order
      </button>
    </div>
  );
};

export default MealList;
