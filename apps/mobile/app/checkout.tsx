import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  type KeyboardTypeOptions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useShallow } from 'zustand/react/shallow';
import { useCart, useCartSubtotal } from '../store/cart';
import { useAuth } from '../store/auth';
import { BRAND } from '../lib/colors';
import { submitOrder, type ProofImage } from '../lib/orders';
import { formatPeso } from '../lib/format';

export default function CheckoutScreen() {
  const lines = useCart(useShallow((s) => Object.values(s.lines)));
  const clear = useCart((s) => s.clear);
  const subtotal = useCartSubtotal();
  const session = useAuth((s) => s.session);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(session?.user.email ?? '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [proof, setProof] = useState<ProofImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickProof() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      setProof({ uri: res.assets[0].uri, mimeType: res.assets[0].mimeType });
    }
  }

  function validate(): string | null {
    if (!firstName.trim() || !lastName.trim()) return 'Please enter your full name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return 'Please enter a valid email.';
    if (phone.trim().length < 7) return 'Please enter a valid phone number.';
    if (!address.trim()) return 'Please enter a delivery address.';
    return null;
  }

  async function placeOrder() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const orderTotal = subtotal;
      const { orderRef } = await submitOrder({
        customer: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          deliveryAddress: address.trim(),
          specialRequests: notes.trim() || undefined,
        },
        lines,
        clientId: session?.user.id ?? null,
        proof,
      });
      clear();
      // Peak-End: route to the celebratory confirmation screen (not an Alert).
      // Pass the raw peso amount; the confirmation screen formats it.
      router.replace({
        pathname: '/order-confirmation',
        params: { ref: orderRef, total: String(orderTotal) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place order.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-brand-cream">
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Checkout',
          headerStyle: { backgroundColor: BRAND.cream },
          headerTintColor: BRAND.text,
        }}
      />

      <ScrollView contentContainerClassName="p-4 pb-44" keyboardShouldPersistTaps="handled">
        <Text className="mb-3 text-lg font-extrabold text-brand-text">Order summary</Text>
        <View className="mb-5 rounded-2xl border border-brand-divider bg-white px-4 py-2">
          {lines.map(({ item, qty }) => (
            <View key={item.id} className="flex-row items-center justify-between py-2">
              <Text numberOfLines={1} className="flex-1 text-brand-text">
                <Text className="font-bold text-brand-primary">{qty}× </Text>
                {item.name}
              </Text>
              <Text className="ml-3 font-semibold text-brand-text">
                {formatPeso((item.price ?? 0) * qty)}
              </Text>
            </View>
          ))}
        </View>

        <Text className="mb-3 text-lg font-extrabold text-brand-text">Delivery details</Text>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="First name" value={firstName} onChange={setFirstName} />
          </View>
          <View className="flex-1">
            <Field label="Last name" value={lastName} onChange={setLastName} />
          </View>
        </View>
        <Field label="Email" value={email} onChange={setEmail} keyboardType="email-address" />
        <Field label="Phone" value={phone} onChange={setPhone} keyboardType="phone-pad" />
        <Field label="Delivery address" value={address} onChange={setAddress} multiline />
        <Field label="Notes (optional)" value={notes} onChange={setNotes} multiline />

        <Text className="mb-2 mt-4 text-lg font-extrabold text-brand-text">Payment proof</Text>
        <Text className="mb-2 text-sm text-brand-muted">
          Send payment via GCash, then attach a screenshot (recommended).
        </Text>
        <Pressable
          onPress={pickProof}
          accessibilityRole="button"
          accessibilityLabel={proof ? 'Change payment screenshot' : 'Attach payment screenshot'}
          className="items-center justify-center rounded-2xl border border-dashed border-brand-divider bg-white p-4 active:opacity-80"
        >
          {proof ? (
            <Image source={{ uri: proof.uri }} className="h-40 w-full rounded-xl" resizeMode="cover" />
          ) : (
            <View className="items-center py-6">
              <Ionicons name="cloud-upload-outline" size={32} color="#6B6358" />
              <Text className="mt-2 text-brand-muted">Tap to attach a screenshot</Text>
            </View>
          )}
        </Pressable>

        {error && <Text className="mt-3 text-red-600">{error}</Text>}
      </ScrollView>

      <SafeAreaView
        edges={['bottom']}
        className="absolute bottom-0 left-0 right-0 border-t border-brand-divider bg-white"
      >
        <View className="p-4">
          <View className="mb-3 flex-row justify-between">
            <Text className="text-brand-muted">Total ({lines.length} item{lines.length === 1 ? '' : 's'})</Text>
            <Text className="text-lg font-extrabold text-brand-text">{formatPeso(subtotal)}</Text>
          </View>
          <Pressable
            onPress={placeOrder}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            accessibilityLabel="Place order"
            className="items-center rounded-2xl bg-brand-primary py-4 active:opacity-80"
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-bold text-white">Place order</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
}) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-sm font-semibold text-brand-text">{label}</Text>
      <TextInput
        className="rounded-2xl border border-brand-divider bg-white px-4 py-3 text-brand-text"
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={false}
        multiline={multiline}
      />
    </View>
  );
}
