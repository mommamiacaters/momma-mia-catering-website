import React from "react";
import { MenuData, MenuItem } from "../../../services/menuService";

interface MealListProps {
  service: keyof MenuData;
  serviceName: string;
  onContinue: () => void;
  addMessage: (text: string, sender: "user" | "bot") => void;
  mealData?: MenuData; // Made optional with fallback
}

const MealList: React.FC<MealListProps> = ({
  service,
  serviceName,
  onContinue,
  addMessage,
  mealData,
}) => {
  // Use provided mealData or fallback to static data
  const meals = mealData?.[service] || [];

  const handleMealClick = (meal: MenuItem, index: number) => {
    // Add interaction when clicking on a meal item
    addMessage(
      `I'm interested in: ${meal.name} (${meal.price})${
        meal.description ? ` - ${meal.description}` : ""
      }`,
      "user"
    );
    
    // Optional: Add a bot response about the selected meal
    setTimeout(() => {
      addMessage(
        `Great choice! ${meal.name} is one of our popular items. Would you like to add more meals or continue with your order?`,
        "bot"
      );
    }, 500);
  };

  if (meals.length === 0) {
    return (
      <div className="bg-brand-secondary border-2 border-brand-divider rounded-2xl p-4 mt-2 w-full animate-in fade-in duration-500">
        <h4 className="text-brand-text mb-2.5 text-sm flex items-center gap-1.5 font-semibold font-arvo">
          🍽️ {serviceName} Menu
        </h4>
        <div className="bg-white rounded-lg py-3 px-3 mb-2 text-xs text-brand-text border border-brand-divider text-center">
          <span className="text-brand-text/70">
            No meals available at the moment. Please try again later.
          </span>
        </div>
        <button
          className="bg-gradient-to-r from-brand-primary to-brand-accent text-white border-none py-2 px-4 rounded-2xl cursor-pointer text-xs font-medium transition-all duration-300 mt-2.5 shadow-md shadow-brand-primary/30 hover:translate-y-[-1px] hover:shadow-lg hover:shadow-brand-primary/40"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addMessage("I want to continue anyway", "user");
            onContinue();
          }}
        >
          Continue Anyway
        </button>
      </div>
    );
  }

  return (
    <div className="bg-brand-secondary border-2 border-brand-divider rounded-2xl p-4 mt-2 w-full animate-in fade-in duration-500">
      <h4 className="text-brand-text mb-2.5 text-sm flex items-center gap-1.5 font-semibold font-arvo">
        🍽️ {serviceName} Menu
        {mealData && (
          <span className="ml-2 text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
            Live Data
          </span>
        )}
      </h4>
      
      <div className="max-h-60 overflow-y-auto mb-2.5">
        {meals.map((meal, index) => (
          <div
            key={`${service}-${index}`}
            className="bg-white rounded-lg py-2 px-3 mb-2 text-xs text-brand-text border border-brand-divider flex justify-between items-center last:mb-0 cursor-pointer transition-all duration-200 hover:border-brand-primary hover:shadow-sm group"
            onClick={() => handleMealClick(meal, index)}
            title={meal.description ? `${meal.name} - ${meal.description}` : meal.name}
          >
            <div className="flex-1 min-w-0">
              <span className="flex-1 group-hover:text-brand-primary transition-colors duration-200">
                {meal.name}
              </span>
              {meal.description && (
                <div className="text-xs text-brand-text/60 mt-0.5 line-clamp-1">
                  {meal.description}
                </div>
              )}
            </div>
            <span className="text-brand-primary font-semibold text-xs font-arvo ml-2 flex-shrink-0">
              {meal.price}
            </span>
          </div>
        ))}
      </div>

      <button
        className="bg-gradient-to-r from-brand-primary to-brand-accent text-white border-none py-2 px-4 rounded-2xl cursor-pointer text-xs font-medium transition-all duration-300 shadow-md shadow-brand-primary/30 hover:translate-y-[-1px] hover:shadow-lg hover:shadow-brand-primary/40 w-full"
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