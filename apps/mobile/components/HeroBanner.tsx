import { View, Text, Pressable } from 'react-native';

interface HeroBannerProps {
  onPress?: () => void;
}

export function HeroBanner({ onPress }: HeroBannerProps) {
  return (
    <View className="mx-4 mt-4 overflow-hidden rounded-3xl bg-brand-primary p-5">
      <Text className="font-semibold text-white/90">Hungry? 🍱</Text>
      <Text className="mt-1 text-3xl font-extrabold text-white">Get lunch{'\n'}with Mia</Text>
      <Text className="mt-1 text-white/90">Freshly cooked meals, delivered.</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Order now"
        className="mt-4 self-start rounded-full bg-white px-5 py-2 active:opacity-80"
      >
        <Text className="font-bold text-brand-primary">Order now</Text>
      </Pressable>
    </View>
  );
}
