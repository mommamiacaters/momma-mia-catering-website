import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ScreenPlaceholderProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}

export function ScreenPlaceholder({ icon, title, subtitle }: ScreenPlaceholderProps) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Ionicons name={icon} size={48} color="#E36A2E" />
      <Text className="mt-4 text-center text-2xl font-extrabold text-brand-text">{title}</Text>
      <Text className="mt-2 text-center text-brand-muted">{subtitle}</Text>
    </View>
  );
}
