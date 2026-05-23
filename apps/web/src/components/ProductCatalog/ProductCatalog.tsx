import React from "react";
import ProductItem from "./components/ProductItem";
import { MenuItem, SelectedItemWithQuantity } from "../../types";

interface ProductCatalogProps {
  items: MenuItem[];
  selectedItems: MenuItem[];
  onItemAdd: (item: MenuItem) => void;
  onItemRemove: (item: SelectedItemWithQuantity) => void;
  onItemQuantityDecrease: (item: MenuItem) => void;
  title: string;
  isDisabled?: boolean;
  getCurrentItemQuantity?: (item: MenuItem) => number;
  getMaxAllowedItemsByType?: () => Record<string, number>;
  selectedItemsWithQuantity?: SelectedItemWithQuantity[];
}

const ProductCatalog: React.FC<ProductCatalogProps> = ({
  items,
  selectedItems,
  onItemAdd,
  onItemRemove,
  onItemQuantityDecrease,
  title,
  isDisabled,
  getCurrentItemQuantity,
  getMaxAllowedItemsByType,
  selectedItemsWithQuantity,
}) => {
  const isItemSelected = (item: MenuItem) => {
    return selectedItems.some((selected) => selected.name === item.name);
  };

  const getItemQuantity = (item: MenuItem): number => {
    if (getCurrentItemQuantity) {
      return getCurrentItemQuantity(item);
    }
    // Fallback: check selectedItemsWithQuantity
    if (selectedItemsWithQuantity) {
      const selectedItem = selectedItemsWithQuantity.find(
        (selected) => selected.name === item.name
      );
      return selectedItem ? selectedItem.quantity : 0;
    }
    return 0;
  };

  const isItemDisabled = (item: MenuItem): boolean => {
    // First check if the entire catalog is disabled (no meal plans selected)
    if (isDisabled) return true;

    // Check if we've reached the maximum for this item type
    if (getMaxAllowedItemsByType && selectedItemsWithQuantity) {
      const maxAllowed = getMaxAllowedItemsByType();
      const currentTypeCount = selectedItemsWithQuantity
        .filter((selectedItem) => selectedItem.type === item.type)
        .reduce((sum, selectedItem) => sum + selectedItem.quantity, 0);

      return currentTypeCount >= maxAllowed[item.type];
    }

    return false;
  };

  const handleItemRemove = (item: MenuItem) => {
    // Find the actual selected item with quantity to remove
    if (selectedItemsWithQuantity) {
      const selectedItem = selectedItemsWithQuantity.find(
        (selected) => selected.name === item.name
      );
      if (selectedItem) {
        onItemRemove(selectedItem);
      }
    } else {
      onItemRemove(item as unknown as SelectedItemWithQuantity);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Catalog Header */}
      <div className="text-left mb-12">
        <h2 className="text-3xl font-bold text-brand-text mb-4">
          Choose Your {title}
        </h2>
        <p className="text-brand-text opacity-80">
          Select from our delicious menu options. Click "Add" to include items
          in your order.
        </p>
      </div>

      {/* Food Grid */}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item, index) => (
            <ProductItem
              key={`${item.name}-${index}`}
              item={item}
              isSelected={isItemSelected(item)}
              currentQuantity={getItemQuantity(item)}
              onAdd={() => onItemAdd(item)}
              onRemove={() => handleItemRemove(item)}
              onQuantityDecrease={() => onItemQuantityDecrease(item)}
              isDisabled={isItemDisabled(item)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            No menu items available for this service at the moment.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProductCatalog;
