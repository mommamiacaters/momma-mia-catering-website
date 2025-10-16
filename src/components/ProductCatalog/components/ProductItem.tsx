import React from "react";
import { Plus, Minus } from "lucide-react";

interface MenuItem {
  name: string;
  description: string;
  price: number;
  image: string;
  type: string;
}

interface ProductItemProps {
  item: MenuItem;
  isSelected: boolean;
  isDisabled?: boolean;
  currentQuantity?: number;
  onAdd: () => void;
  onRemove: () => void;
  onQuantityDecrease: () => void; // New prop for decreasing quantity by 1
}

const ProductItem: React.FC<ProductItemProps> = ({
  item,
  isSelected,
  onAdd,
  onRemove,
  onQuantityDecrease,
  isDisabled,
  currentQuantity = 0,
}) => {
  const defaultImage = `https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop`;

  const handleMinusClick = () => {
    if (currentQuantity > 1) {
      // If quantity is 1 or less, remove the item completely
      onQuantityDecrease();
    } else {
      // Fallback to remove if onQuantityDecrease is not provided
      onRemove();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      {/* Product Image */}
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isDisabled ? "opacity-50" : ""
            }`}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <img
              src={defaultImage}
              alt={item.name}
              className={`w-full h-full object-cover ${
                isDisabled ? "opacity-50" : ""
              }`}
            />
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="flex flex-col flex-grow p-4">
        <div className="mb-2">
          <h3 className="font-semibold text-brand-text text-sm mb-1 line-clamp-2 capitalize">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-xs text-gray-600 line-clamp-2">
              {item.description}
            </p>
          )}
        </div>
        <div className="mt-auto py-2 flex items-center justify-end">
          {/* <span className="font-bold text-brand-primary text-lg">
            ₱{item.price}
          </span> */}

          {isSelected ? (
            <div className="flex items-center gap-1">
              {/* Minus button */}
              <button
                onClick={handleMinusClick}
                className="flex items-center justify-center w-8 h-8 bg-gray-300 hover:bg-gray-400 text-white rounded-full transition-colors"
                title={
                  currentQuantity <= 1 ? "Remove item" : "Decrease quantity"
                }
              >
                <Minus size={14} />
              </button>
              {/* Quantity display if more than 1 */}
              {currentQuantity >= 1 && (
                <span className="text-sm font-medium text-brand-text px-2">
                  {currentQuantity}
                </span>
              )}
              {/* Plus button */}
              <button
                onClick={onAdd}
                disabled={isDisabled}
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                  isDisabled
                    ? "bg-gray-300 cursor-not-allowed text-gray-500"
                    : "bg-brand-primary hover:bg-brand-primary/80 text-white"
                }`}
                title={isDisabled ? "Maximum reached" : "Add another"}
              >
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={onAdd}
              disabled={isDisabled}
              className={`flex items-center gap-1 px-3 py-1.5 text-white text-xs font-medium rounded-full transition-colors ${
                isDisabled
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-brand-primary hover:bg-brand-primary/80"
              }`}
              title={
                isDisabled ? "Select a meal plan first" : "Add to meal plan"
              }
            >
              <Plus size={14} />
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductItem;
