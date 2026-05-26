import { View, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
  value: string;
  onChange: (text: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    // h-12 + rounded-2xl + border matches the top-right cart button exactly.
    <View className="h-12 flex-row items-center rounded-2xl border border-brand-divider bg-white px-4">
      <Ionicons name="search" size={20} color="#6B6358" />
      <TextInput
        className="ml-2 flex-1 text-base text-brand-text"
        style={{ paddingVertical: 0 }} // kill TextInput's intrinsic padding so h-12 holds
        placeholder="Search Mia's menu..."
        placeholderTextColor="#6B6358"
        accessibilityLabel="Search menu"
        value={value}
        onChangeText={onChange}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChange('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={20} color="#6B6358" />
        </Pressable>
      )}
    </View>
  );
}
