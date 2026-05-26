import { View, Text } from 'react-native';

/**
 * In-screen title row, rendered INSIDE <ScreenBackground> (not the navigator
 * header) so the ambient gradient + brand blobs reach the very top of the
 * screen — keeping Orders/Account visually consistent with the Menu tab.
 */
export function ScreenHeader({ title }: { title: string }) {
  return (
    <View className="px-4 pb-2 pt-2">
      <Text className="text-2xl font-extrabold text-brand-text">{title}</Text>
    </View>
  );
}
