import { useState, type ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  type KeyboardTypeOptions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useShallow } from 'zustand/react/shallow';
import { useCart, useCartSubtotal } from '../store/cart';
import { useAuth } from '../store/auth';
import { submitOrder, type ProofImage } from '../lib/orders';
import { formatPeso } from '../lib/format';

// QR image — local bundled asset (BPI InstaPay card with account details
// embedded). Source-of-truth lives in apps/web/public/images/, mirrored here
// because Expo's Metro bundles assets from the app dir only.
const PAYMENT_QR = require('../assets/payment-qr.jpg');
const QR_ASPECT = 1290 / 1372; // exact JPEG dimensions — keeps the card unsquashed.

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
  const [qrZoomed, setQrZoomed] = useState(false);

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
      const { orderRef, totalCents } = await submitOrder({
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
      // Show the SERVER-AUTHORITATIVE total (what the customer was actually
      // charged) — not the client subtotal, which can differ if a menu price
      // changed mid-order. The confirmation screen formats raw pesos.
      const orderTotalPesos = totalCents / 100;
      router.replace({
        pathname: '/order-confirmation',
        params: { ref: orderRef, total: String(orderTotalPesos) },
      });
    } catch (e) {
      // submitOrder already wraps RPC errors via mapOrderError, so e.message is
      // already user-safe copy by the time it lands here.
      setError(e instanceof Error ? e.message : 'Could not place order.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-brand-cream">
      {/* Custom header — mirrors cart's pattern (chevron-back left, title
          centered). Owned by us rather than the native-stack header so it
          always renders and always sits below the safe-area inset. */}
      <View className="flex-row items-center justify-between border-b border-brand-divider bg-brand-cream px-2 py-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-9 min-w-[64px] flex-row items-center justify-start px-1"
        >
          <Ionicons name="chevron-back" size={26} color="#2E2A26" />
          <Text className="ml-0.5 font-semibold text-brand-text">Back</Text>
        </Pressable>
        <Text className="text-lg font-extrabold text-brand-text">Checkout</Text>
        <View className="min-w-[64px] px-2" />
      </View>

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

        <Text className="mb-2 mt-6 text-lg font-extrabold text-brand-text">Payment</Text>

        {/* Amount badge — the single most important number on this screen.
            High-contrast pill so the user can't miss what to pay. */}
        <View className="mb-3 self-center rounded-full bg-brand-primary/10 px-5 py-2">
          <Text className="text-xl font-extrabold text-brand-primary">
            Pay {formatPeso(subtotal)}
          </Text>
        </View>

        <Text className="mb-3 text-center text-sm text-brand-muted">
          Scan or upload this QR via GCash, Maya, or any InstaPay bank
        </Text>

        {/* QR card — Pressable wrapper enables tap-to-zoom. Border + p-3 give
            it card chrome without competing with the QR's own card design. */}
        <Pressable
          onPress={() => setQrZoomed(true)}
          accessibilityRole="imagebutton"
          accessibilityLabel="Payment QR code — tap to enlarge"
          className="mb-3 self-center overflow-hidden rounded-2xl border border-brand-divider bg-white p-3 active:opacity-80"
        >
          <Image
            source={PAYMENT_QR}
            style={{ width: 180, aspectRatio: QR_ASPECT }}
            resizeMode="contain"
          />
          <View className="mt-2 flex-row items-center justify-center">
            <Ionicons name="expand-outline" size={14} color="#6B6358" />
            <Text className="ml-1 text-xs text-brand-muted">Tap to enlarge</Text>
          </View>
        </Pressable>

        {/* How-to-pay steps — numbered for clarity. Written for the single-phone
            case (user has only their iPhone): screenshot → open GCash → upload
            QR → pay → screenshot receipt → upload below. */}
        <View className="mb-5 rounded-2xl border border-brand-divider bg-white p-4">
          <Text className="mb-3 text-sm font-bold text-brand-text">How to pay</Text>
          <Step n={1}>Screenshot the QR above (Side + Volume Up button on iPhone).</Step>
          <Step n={2}>Open GCash, Maya, or your bank app.</Step>
          <Step n={3}>
            Choose <Text className="font-semibold text-brand-text">Send Money → Upload QR</Text>{' '}
            and pick the screenshot.
          </Step>
          <Step n={4}>
            Pay exactly{' '}
            <Text className="font-semibold text-brand-text">{formatPeso(subtotal)}</Text>, then
            screenshot the receipt.
          </Step>
          <Step n={5} last>
            Attach the receipt screenshot below.
          </Step>
        </View>

        <Text className="mb-1 text-lg font-extrabold text-brand-text">Receipt</Text>
        <Text className="mb-2 text-sm text-brand-muted">
          Attach your payment receipt screenshot to confirm the order.
        </Text>
        <Pressable
          onPress={pickProof}
          accessibilityRole="button"
          accessibilityLabel={proof ? 'Change payment receipt' : 'Attach payment receipt'}
          className="items-center justify-center rounded-2xl border border-dashed border-brand-divider bg-white p-4 active:opacity-80"
        >
          {proof ? (
            <>
              <Image source={{ uri: proof.uri }} className="h-40 w-full rounded-xl" resizeMode="cover" />
              <View className="mt-3 flex-row items-center">
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text className="ml-1.5 text-sm font-semibold text-green-700">Receipt attached</Text>
                <Text className="ml-2 text-sm text-brand-muted">Tap to change</Text>
              </View>
            </>
          ) : (
            <View className="items-center py-6">
              <Ionicons name="cloud-upload-outline" size={32} color="#6B6358" />
              <Text className="mt-2 font-semibold text-brand-text">Tap to attach receipt</Text>
              <Text className="mt-0.5 text-xs text-brand-muted">JPEG or PNG</Text>
            </View>
          )}
        </Pressable>

        {error && <Text className="mt-3 text-red-600">{error}</Text>}
      </ScrollView>

      {/* Fullscreen QR zoom — tap anywhere to dismiss. iOS native Modal
          gets the safe-area + status-bar behavior right for free. */}
      <Modal
        visible={qrZoomed}
        transparent
        animationType="fade"
        onRequestClose={() => setQrZoomed(false)}
      >
        <Pressable
          onPress={() => setQrZoomed(false)}
          accessibilityLabel="Close enlarged QR"
          className="flex-1 items-center justify-center bg-black/90 px-6"
        >
          <View className="rounded-2xl bg-white p-4">
            <Image
              source={PAYMENT_QR}
              style={{ width: 280, aspectRatio: QR_ASPECT }}
              resizeMode="contain"
            />
          </View>
          <Text className="mt-6 text-white">Screenshot this, then tap to close</Text>
        </Pressable>
      </Modal>

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
    </SafeAreaView>
  );
}

// Numbered instruction row. Circle badge + text on one line.
// `last` removes the bottom margin on the final step so spacing balances.
function Step({
  n,
  children,
  last,
}: {
  n: number;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <View className={`flex-row items-start ${last ? '' : 'mb-2.5'}`}>
      <View className="mr-3 mt-0.5 h-6 w-6 items-center justify-center rounded-full bg-brand-primary">
        <Text className="text-xs font-bold text-white">{n}</Text>
      </View>
      <Text className="flex-1 text-sm leading-5 text-brand-text">{children}</Text>
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
