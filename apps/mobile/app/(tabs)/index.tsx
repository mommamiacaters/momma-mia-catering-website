import { useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { CatalogItem } from '@momma-mia/supabase';
import { useMenu } from '../../hooks/useMenu';
import { SearchBar } from '../../components/SearchBar';
import { HeroBanner } from '../../components/HeroBanner';
import { MenuItemCard } from '../../components/MenuItemCard';
import { MenuItemRow } from '../../components/MenuItemRow';
import { CategoryCircles } from '../../components/CategoryCircles';
import { MenuSkeleton } from '../../components/MenuSkeleton';
import { ViewCartBar } from '../../components/ViewCartBar';
import { ScreenBackground } from '../../components/ScreenBackground';
import { useCartCount } from '../../store/cart';
import { openCart } from '../../lib/nav';

const firstImage = (its: CatalogItem[]) => its.find((i) => i.image)?.image ?? null;

export default function HomeScreen() {
  const { items, sections, loading, error, reload } = useMenu();
  const cartCount = useCartCount();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<number[]>([]); // measured Y of each section header
  const spyLocked = useRef(false);
  const spyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sectionList = useMemo(
    () => sections.map((s, index) => ({ title: s.name, index, image: firstImage(s.items), items: s.items })),
    [sections],
  );
  const categories = useMemo(
    () => sectionList.map((s) => ({ title: s.title, image: s.image })),
    [sectionList],
  );
  const popular = useMemo(() => items.slice(0, 6), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.categoryName ?? '').toLowerCase().includes(q),
    );
  }, [query, items]);

  // Tap a chip → scroll precisely to its measured offset. scrollTo to a known Y
  // always works (unlike SectionList.scrollToLocation, which needs the target
  // rendered). spyLocked stops the scroll-spy from strobing the active chip mid-jump.
  const jumpTo = useCallback((index: number) => {
    spyLocked.current = true;
    if (spyTimer.current) clearTimeout(spyTimer.current);
    spyTimer.current = setTimeout(() => (spyLocked.current = false), 700);
    setActiveIndex(index);
    const y = sectionOffsets.current[index] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 6), animated: true });
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (spyLocked.current) return;
      const y = e.nativeEvent.contentOffset.y + 8;
      let active = 0;
      const offs = sectionOffsets.current;
      for (let i = 0; i < offs.length; i++) {
        if (offs[i] == null) continue; // tolerate not-yet-measured holes (don't freeze)
        if (offs[i] <= y) active = i;
        else break;
      }
      setActiveIndex((prev) => (prev === active ? prev : active));
    },
    [],
  );

  const onMomentumScrollEnd = useCallback(() => {
    spyLocked.current = false;
    if (spyTimer.current) {
      clearTimeout(spyTimer.current);
      spyTimer.current = null;
    }
  }, []);

  const captureOffset = (index: number) => (e: LayoutChangeEvent) => {
    sectionOffsets.current[index] = e.nativeEvent.layout.y;
  };

  return (
    <ScreenBackground>
    <SafeAreaView edges={['top']} className="flex-1">
      {/* Search row + top-right cart icon */}
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-3">
        <View className="flex-1">
          <SearchBar value={query} onChange={setQuery} />
        </View>
        <Pressable
          onPress={openCart}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={cartCount > 0 ? `Open cart, ${cartCount} items` : 'Open cart'}
          className="h-12 w-12 items-center justify-center rounded-2xl border border-brand-divider bg-white"
        >
          <Ionicons name="bag-handle-outline" size={22} color="#2E2A26" />
          {cartCount > 0 && (
            <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-primary px-1">
              <Text className="text-[11px] font-bold text-white">{cartCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Sticky circular category rail — hidden while searching */}
      {!loading && !error && !filtered && categories.length > 1 && (
        <CategoryCircles categories={categories} activeIndex={activeIndex} onSelect={jumpTo} />
      )}

      {loading ? (
        <MenuSkeleton />
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline-outline" size={48} color="#6B6358" />
          <Text className="mt-4 text-lg font-extrabold text-brand-text">Couldn&apos;t load the menu</Text>
          <Text className="mt-1 text-center text-brand-muted">
            Check your connection and try again.
          </Text>
          <Pressable
            onPress={reload}
            accessibilityRole="button"
            className="mt-6 rounded-2xl bg-brand-primary px-6 py-3 active:opacity-80"
          >
            <Text className="font-bold text-white">Retry</Text>
          </Pressable>
        </View>
      ) : filtered ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MenuItemRow item={item} />}
          ListHeaderComponent={
            <Text className="px-4 pb-1 pt-3 text-brand-muted">
              {filtered.length === 0 ? 'No matches' : `Results for “${query}”`}
            </Text>
          }
          contentContainerClassName="pb-56"
          initialNumToRender={10}
          windowSize={11}
        />
      ) : (
        <ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEventThrottle={32}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-56"
        >
          <HeroBanner onPress={openCart} />
          <Text className="mb-3 mt-6 px-4 text-lg font-extrabold text-brand-text">Popular picks</Text>
          {/* Only ~6 items → a plain horizontal ScrollView avoids a nested
              VirtualizedList (and its warning) with no virtualization benefit. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-4">
            {popular.map((item) => (
              <MenuItemCard key={item.id} item={item} />
            ))}
          </ScrollView>

          {sectionList.map((s) => (
            // onLayout on the WRAPPER (direct child of ScrollView) → its y is the
            // absolute content offset. (onLayout.y is relative to the parent, so
            // measuring the inner header gave the same ~21px for every section.)
            <View key={s.title} onLayout={captureOffset(s.index)}>
              <View className="mb-1 mt-6 px-4">
                <Text className="text-lg font-extrabold text-brand-text">{s.title}</Text>
              </View>
              {s.items.map((item) => (
                <MenuItemRow key={item.id} item={item} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <ViewCartBar />
    </SafeAreaView>
    </ScreenBackground>
  );
}
