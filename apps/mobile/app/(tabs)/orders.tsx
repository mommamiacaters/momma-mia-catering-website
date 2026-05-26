import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../store/auth';
import {
  fetchMyOrders,
  isActiveOrder,
  friendlyStatus,
  itemsSummary,
  type OrderSummary,
} from '../../lib/orders';
import { formatPeso } from '../../lib/format';
import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';
import { ScreenBackground } from '../../components/ScreenBackground';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PulsingDot } from '../../components/PulsingDot';
import { BRAND } from '../../lib/colors';
import { useMenu } from '../../hooks/useMenu';
import { useCart } from '../../store/cart';
import { openCart } from '../../lib/nav';

export default function OrdersScreen() {
  const session = useAuth((s) => s.session);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchMyOrders()
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load orders.'))
      .finally(() => setLoading(false));
  }, [session]);

  useFocusEffect(useCallback(() => load(), [load]));

  const { active, past } = useMemo(() => {
    const a: OrderSummary[] = [];
    const p: OrderSummary[] = [];
    for (const o of orders) (isActiveOrder(o.status) ? a : p).push(o);
    return { active: a, past: p };
  }, [orders]);

  const open = (id: string) => router.push({ pathname: '/order/[id]', params: { id } });

  // One-tap reorder: resolve each past line back to a CURRENT menu item (by id
  // when present, else by name for legacy orders), add to cart, then open it.
  const addToCart = useCart((s) => s.add);
  const { items: menuItems } = useMenu();
  const reorder = useCallback(
    (order: OrderSummary) => {
      const byId = new Map(menuItems.map((m) => [m.id, m]));
      const byName = new Map<string, (typeof menuItems)[number]>();
      for (const m of menuItems) if (!byName.has(m.name)) byName.set(m.name, m);

      let added = 0;
      let skipped = 0;
      for (const line of order.order_items) {
        const match = (line.menu_item_id && byId.get(line.menu_item_id)) || byName.get(line.item_name);
        if (match && match.price != null) {
          addToCart(match, line.qty);
          added += line.qty;
        } else {
          skipped += 1;
        }
      }
      if (added === 0) {
        Alert.alert('Can’t reorder', 'These items are no longer on the menu.');
        return;
      }
      if (skipped > 0) {
        Alert.alert('Added to cart', `${skipped} item(s) are no longer available and were skipped.`);
      }
      openCart();
    },
    [menuItems, addToCart],
  );

  let body: ReactNode;
  if (!session) {
    body = (
      <View className="flex-1 items-center justify-center px-8">
        <Ionicons name="receipt-outline" size={48} color={BRAND.primary} />
        <Text className="mt-4 text-center text-2xl font-extrabold text-brand-text">No orders yet</Text>
        <Text className="mt-2 text-center text-brand-muted">Sign in to see your order history.</Text>
        <Pressable
          onPress={() => router.navigate('/account')}
          accessibilityRole="button"
          className="mt-6 rounded-2xl bg-brand-primary px-6 py-3 active:opacity-80"
        >
          <Text className="font-bold text-white">Go to Account</Text>
        </Pressable>
      </View>
    );
  } else if (loading) {
    body = (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={BRAND.primary} />
      </View>
    );
  } else if (orders.length === 0) {
    body = (
      <ScreenPlaceholder
        icon="receipt-outline"
        title="No orders yet"
        subtitle="Your orders will appear here once you check out."
      />
    );
  } else {
    body = (
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-8">
        {error && <Text className="mb-2 text-red-600">{error}</Text>}

        {active.length > 0 && (
          <>
            <SectionHeader label="In the kitchen" count={active.length} />
            {active.map((o) => (
              <ActiveOrderCard key={o.id} order={o} onPress={() => open(o.id)} />
            ))}
          </>
        )}

        {past.length > 0 && (
          <>
            <View className={active.length > 0 ? 'mt-6' : ''}>
              <SectionHeader label="Past meals" count={past.length} />
            </View>
            {past.map((o) => (
              <PastOrderCard key={o.id} order={o} onPress={() => open(o.id)} onReorder={() => reorder(o)} />
            ))}
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader title="Orders" />
        {body}
      </SafeAreaView>
    </ScreenBackground>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <Text className="text-xs font-bold uppercase tracking-wider text-brand-muted">{label}</Text>
      <View className="rounded-full bg-brand-secondary px-2 py-0.5">
        <Text className="text-[11px] font-bold text-brand-muted">{count}</Text>
      </View>
    </View>
  );
}

// Prominent, "live" card — friendly status + pulsing dot + what was ordered.
// No date (it's in-progress, not history). Soft orange glow signals "active".
function ActiveOrderCard({ order, onPress }: { order: OrderSummary; onPress: () => void }) {
  const summary = itemsSummary(order.order_items);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Active order ${order.order_ref}, ${friendlyStatus(order.status)}, track`}
      className="mb-3 rounded-2xl border border-brand-primary/30 bg-white p-4 active:opacity-80"
      style={{
        shadowColor: BRAND.primary,
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <View className="flex-row items-center gap-2">
        <PulsingDot />
        <Text className="flex-1 text-base font-extrabold text-brand-text">
          {friendlyStatus(order.status)}
        </Text>
        <Text className="text-base font-extrabold text-brand-primary">
          {formatPeso(order.total_cents / 100)}
        </Text>
      </View>
      {summary !== '' && (
        <Text numberOfLines={1} className="mt-1.5 text-brand-muted">
          {summary}
        </Text>
      )}
      <View className="mt-3 flex-row items-center justify-between border-t border-brand-divider/60 pt-3">
        <Text className="text-xs text-brand-muted">{order.order_ref}</Text>
        <View className="flex-row items-center gap-1">
          <Text className="text-xs font-bold text-brand-primary">Track order</Text>
          <Ionicons name="chevron-forward" size={15} color={BRAND.primary} />
        </View>
      </View>
    </Pressable>
  );
}

// Compact history card — NO date. Leads with what was ordered, then item count +
// total, with a status pill (Delivered ✓ / Cancelled).
function PastOrderCard({
  order,
  onPress,
  onReorder,
}: {
  order: OrderSummary;
  onPress: () => void;
  onReorder: () => void;
}) {
  const cancelled = order.status === 'cancelled';
  const summary = itemsSummary(order.order_items);
  const count = order.order_items.reduce((n, i) => n + i.qty, 0);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.order_ref}, ${friendlyStatus(order.status)}, view details`}
      className="mb-3 rounded-2xl border border-brand-divider bg-white p-4 active:opacity-80"
    >
      <View className="flex-row items-center justify-between">
        <Text numberOfLines={1} className="flex-1 pr-2 font-bold text-brand-text">
          {order.order_ref}
        </Text>
        <View className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${cancelled ? 'bg-red-50' : 'bg-brand-secondary'}`}>
          {!cancelled && <Ionicons name="checkmark-circle" size={13} color={BRAND.primary} />}
          <Text className={`text-xs font-semibold ${cancelled ? 'text-red-600' : 'text-brand-muted'}`}>
            {friendlyStatus(order.status)}
          </Text>
        </View>
      </View>
      {summary !== '' && (
        <Text numberOfLines={1} className="mt-1.5 text-brand-text">
          {summary}
        </Text>
      )}
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-sm text-brand-muted">
          {count} item{count === 1 ? '' : 's'} ·{' '}
          <Text className="font-extrabold text-brand-primary">{formatPeso(order.total_cents / 100)}</Text>
        </Text>
        <Pressable
          onPress={onReorder}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Reorder ${order.order_ref}`}
          className="flex-row items-center gap-1.5 rounded-full bg-brand-primary px-5 py-2.5 active:opacity-80"
          style={{
            shadowColor: BRAND.primary,
            shadowOpacity: 0.3,
            shadowRadius: 7,
            shadowOffset: { width: 0, height: 3 },
            elevation: 4,
          }}
        >
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text className="text-sm font-extrabold text-white">Reorder</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
