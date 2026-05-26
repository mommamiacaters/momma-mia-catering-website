import { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CatalogItem } from '@momma-mia/supabase';
import { useCart } from '../store/cart';

interface QtyControlProps {
  item: CatalogItem;
}

// Inline +/− stepper. Subscribes ONLY to this item's qty (a primitive → stable
// snapshot, no Zustand loop, re-renders only when THIS item's qty changes).
// Mutations read LIVE store state (getState) so rapid taps can't act on a stale
// closed-over qty. v1 = instant swap (no animation); morph is a later polish pass.
function QtyControlBase({ item }: QtyControlProps) {
  const qty = useCart((s) => s.lines[item.id]?.qty ?? 0);

  const onInc = useCallback(() => useCart.getState().add(item), [item]);
  const onDec = useCallback(() => {
    const cur = useCart.getState().lines[item.id]?.qty ?? 0;
    useCart.getState().setQty(item.id, cur - 1); // setQty deletes the line at <= 0
  }, [item.id]);

  // "Price on request" items (price_cents null) can't be ordered online — the
  // server-side create_order RPC rejects them, so don't offer an add control.
  if (item.price == null) {
    return (
      <View
        accessibilityLabel={`${item.name} is not available to order online`}
        className="rounded-full bg-brand-secondary px-3 py-1.5"
      >
        <Text className="text-xs font-semibold text-brand-muted">On request</Text>
      </View>
    );
  }

  if (qty === 0) {
    return (
      <Pressable
        onPress={onInc}
        hitSlop={8}
        accessibilityLabel={`Add ${item.name}`}
        className="h-11 w-11 items-center justify-center rounded-full bg-brand-primary active:opacity-80"
      >
        <Ionicons name="add" size={22} color="#fff" />
      </Pressable>
    );
  }

  return (
    <View className="flex-row items-center rounded-full bg-brand-primary">
      <Pressable
        onPress={onDec}
        hitSlop={6}
        accessibilityLabel={`Remove one ${item.name}`}
        className="h-11 w-11 items-center justify-center active:opacity-70"
      >
        <Ionicons name={qty === 1 ? 'trash-outline' : 'remove'} size={18} color="#fff" />
      </Pressable>
      <Text className="min-w-[24px] text-center font-extrabold text-white">{qty}</Text>
      <Pressable
        onPress={onInc}
        hitSlop={6}
        accessibilityLabel={`Add one ${item.name}`}
        className="h-11 w-11 items-center justify-center active:opacity-70"
      >
        <Ionicons name="add" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

export const QtyControl = memo(QtyControlBase);
