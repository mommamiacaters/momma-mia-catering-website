import { type PropsWithChildren } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '../lib/colors';

/**
 * Ambient app background: a subtle warm gradient (kept inside the cream family so
 * it never fights the brand) plus two soft, low-opacity brand "blobs" for organic
 * depth — "natural, not bland; not busy". Cards stay white on top so they pop.
 *
 * Used as a screen wrapper: <ScreenBackground><SafeAreaView className="flex-1" …>.
 * The decorative layer is `pointerEvents="none"` so it never eats touches.
 */
export function ScreenBackground({ children }: PropsWithChildren) {
  return (
    <View className="flex-1 bg-brand-cream">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={['#F7F0E6', '#F4EBDD', '#F0E2CF']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* warm accent, top-right, mostly off-screen */}
        <View
          style={{
            position: 'absolute',
            top: -90,
            right: -70,
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: BRAND.primary,
            opacity: 0.07,
          }}
        />
        {/* soft secondary, bottom-left */}
        <View
          style={{
            position: 'absolute',
            bottom: -60,
            left: -50,
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: BRAND.secondary,
            opacity: 0.5,
          }}
        />
      </View>
      {children}
    </View>
  );
}
