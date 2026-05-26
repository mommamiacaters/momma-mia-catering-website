import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchOrderDetail, type OrderDetail } from '../../lib/orders';
import { formatPeso } from '../../lib/format';
import { BRAND } from '../../lib/colors';
import { ScreenBackground } from '../../components/ScreenBackground';

const HEADER = {
  headerShown: true,
  headerStyle: { backgroundColor: BRAND.cream },
  headerTintColor: BRAND.text,
} as const;

// Customer-facing delivery stages. `assigned` + `picked_up` both map to the
// "Out for delivery" stage so the timeline stays simple.
const STAGES = [
  { label: 'Order placed', icon: 'receipt-outline' },
  { label: 'Confirmed', icon: 'checkmark-done-outline' },
  { label: 'Preparing', icon: 'restaurant-outline' },
  { label: 'Ready', icon: 'fast-food-outline' },
  { label: 'Out for delivery', icon: 'bicycle-outline' },
  { label: 'Delivered', icon: 'home-outline' },
] as const;

const STATUS_TO_STAGE: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  assigned: 4,
  picked_up: 4,
  delivered: 5,
};

// Confident, status-specific headline (skill: "open with a confident status message").
const HEADLINE: Record<string, { title: string; subtitle: string; icon: string }> = {
  pending: { title: 'Order received 🎉', subtitle: "We've got your order — we'll confirm it shortly.", icon: 'receipt' },
  confirmed: { title: 'Order confirmed', subtitle: 'Your order is confirmed and in the queue.', icon: 'checkmark-done' },
  preparing: { title: 'Preparing your meal', subtitle: 'Our kitchen is cooking it up fresh.', icon: 'restaurant' },
  ready: { title: 'Ready to go', subtitle: 'Your order is packed and ready.', icon: 'fast-food' },
  assigned: { title: 'On the way', subtitle: 'Your rider is heading out.', icon: 'bicycle' },
  picked_up: { title: 'Out for delivery', subtitle: 'Your order is on its way to you.', icon: 'bicycle' },
  delivered: { title: 'Delivered', subtitle: 'Enjoy your meal! 🍱', icon: 'home' },
  cancelled: { title: 'Order cancelled', subtitle: 'This order was cancelled.', icon: 'close-circle' },
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchOrderDetail(id)
      .then(setOrder)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load this order.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <ScreenBackground>
        <Stack.Screen options={{ ...HEADER, title: 'Order' }} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={BRAND.primary} />
        </View>
      </ScreenBackground>
    );
  }

  if (error || !order) {
    return (
      <ScreenBackground>
        <Stack.Screen options={{ ...HEADER, title: 'Order' }} />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color={BRAND.muted} />
          <Text className="mt-3 text-center text-brand-muted">{error ?? 'Order not found.'}</Text>
        </View>
      </ScreenBackground>
    );
  }

  const cancelled = order.status === 'cancelled';
  const head = HEADLINE[order.status] ?? HEADLINE.pending;
  const currentStage = STATUS_TO_STAGE[order.status] ?? 0;
  const placedOn = new Date(order.created_at).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <ScreenBackground>
      <Stack.Screen options={{ ...HEADER, title: order.order_ref }} />
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-12">
        {/* Confident status hero */}
        <View
          className={`rounded-3xl p-5 ${cancelled ? 'bg-red-50' : 'bg-brand-primary'}`}
        >
          <View className="flex-row items-center gap-3">
            <View className={`h-12 w-12 items-center justify-center rounded-full ${cancelled ? 'bg-red-100' : 'bg-white/20'}`}>
              <Ionicons name={head.icon as never} size={26} color={cancelled ? '#DC2626' : '#fff'} />
            </View>
            <View className="flex-1">
              <Text className={`text-xl font-extrabold ${cancelled ? 'text-red-700' : 'text-white'}`}>
                {head.title}
              </Text>
              <Text className={`mt-0.5 ${cancelled ? 'text-red-600' : 'text-white/90'}`}>
                {head.subtitle}
              </Text>
            </View>
          </View>
        </View>

        {/* Visual timeline (skip when cancelled) */}
        {!cancelled && (
          <View className="mt-5 rounded-2xl border border-brand-divider bg-white p-5">
            {STAGES.map((stage, i) => {
              const done = i < currentStage;
              const active = i === currentStage;
              const reached = done || active;
              const isLast = i === STAGES.length - 1;
              return (
                <View key={stage.label} className="flex-row">
                  {/* left rail: dot + connector */}
                  <View className="items-center" style={{ width: 36 }}>
                    <View
                      className={`h-9 w-9 items-center justify-center rounded-full ${
                        reached ? 'bg-brand-primary' : 'bg-brand-secondary'
                      }`}
                    >
                      <Ionicons
                        name={(active ? stage.icon : done ? 'checkmark' : stage.icon) as never}
                        size={18}
                        color={reached ? '#fff' : BRAND.divider}
                      />
                    </View>
                    {!isLast && (
                      <View
                        className={`my-1 w-0.5 flex-1 ${done ? 'bg-brand-primary' : 'bg-brand-divider'}`}
                        style={{ minHeight: 20 }}
                      />
                    )}
                  </View>
                  {/* label */}
                  <View className={`flex-1 pb-4 pl-3 ${isLast ? 'pb-0' : ''}`}>
                    <Text
                      className={`text-base ${
                        active ? 'font-extrabold text-brand-text' : reached ? 'font-semibold text-brand-text' : 'text-brand-muted'
                      }`}
                    >
                      {stage.label}
                    </Text>
                    {active && (
                      <Text className="mt-0.5 text-xs text-brand-primary">Current status</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Items */}
        <Text className="mb-2 mt-6 text-lg font-extrabold text-brand-text">
          Items ({order.order_items.length})
        </Text>
        <View className="rounded-2xl border border-brand-divider bg-white px-4 py-1">
          {order.order_items.map((line, i) => (
            <View
              key={line.id}
              className={`flex-row items-center justify-between py-3 ${
                i < order.order_items.length - 1 ? 'border-b border-brand-divider/60' : ''
              }`}
            >
              <View className="flex-1 pr-3">
                <Text className="text-brand-text">
                  <Text className="font-bold text-brand-primary">{line.qty}× </Text>
                  {line.item_name}
                </Text>
                {line.plan_type && (
                  <Text className="mt-0.5 text-xs text-brand-muted">{line.plan_type}</Text>
                )}
              </View>
              <Text className="font-semibold text-brand-text">
                {formatPeso((line.unit_price_cents * line.qty) / 100)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View className="mt-4 rounded-2xl border border-brand-divider bg-white p-4">
          <Row label="Subtotal" value={formatPeso(order.subtotal_cents / 100)} />
          {order.delivery_fee_cents > 0 && (
            <Row label="Delivery fee" value={formatPeso(order.delivery_fee_cents / 100)} />
          )}
          <View className="mt-2 flex-row items-center justify-between border-t border-brand-divider pt-3">
            <Text className="text-base font-extrabold text-brand-text">Total</Text>
            <Text className="text-lg font-extrabold text-brand-primary">
              {formatPeso(order.total_cents / 100)}
            </Text>
          </View>
        </View>

        {/* Delivery details */}
        <Text className="mb-2 mt-6 text-lg font-extrabold text-brand-text">Delivery details</Text>
        <View className="rounded-2xl border border-brand-divider bg-white p-4">
          <InfoRow icon="person-outline" text={`${order.customer_first_name} ${order.customer_last_name}`} />
          <InfoRow icon="call-outline" text={order.customer_phone} />
          <InfoRow icon="mail-outline" text={order.customer_email} />
          {order.delivery_address && <InfoRow icon="location-outline" text={order.delivery_address} />}
          {(order.delivery_date || order.delivery_time) && (
            <InfoRow
              icon="calendar-outline"
              text={[order.delivery_date, order.delivery_time].filter(Boolean).join(' · ')}
            />
          )}
          {order.special_requests && <InfoRow icon="chatbubble-ellipses-outline" text={order.special_requests} />}
        </View>

        <Text className="mt-6 text-center text-xs text-brand-muted">
          {order.order_ref} · placed {placedOn}
        </Text>
      </ScrollView>
    </ScreenBackground>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-brand-muted">{label}</Text>
      <Text className="text-brand-text">{value}</Text>
    </View>
  );
}

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View className="flex-row items-start gap-3 py-2">
      <Ionicons name={icon as never} size={18} color={BRAND.muted} style={{ marginTop: 1 }} />
      <Text className="flex-1 text-brand-text">{text}</Text>
    </View>
  );
}
