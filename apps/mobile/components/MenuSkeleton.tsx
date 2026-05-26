import { View } from 'react-native';

// Skeleton placeholder rows (skill: skeletons read as faster/more premium than a
// bare spinner). Mirrors MenuItemRow's layout so content doesn't jump on load.
export function MenuSkeleton() {
  return (
    <View className="pt-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          className="mx-4 mb-3 flex-row items-center rounded-2xl border border-brand-divider bg-white p-3"
        >
          <View className="h-[88px] w-[88px] rounded-xl bg-brand-secondary" />
          <View className="ml-3 flex-1">
            <View className="h-4 w-2/3 rounded bg-brand-secondary" />
            <View className="mt-2 h-3 w-full rounded bg-brand-secondary" />
            <View className="mt-1 h-3 w-1/2 rounded bg-brand-secondary" />
            <View className="mt-3 h-4 w-16 rounded bg-brand-secondary" />
          </View>
        </View>
      ))}
    </View>
  );
}
