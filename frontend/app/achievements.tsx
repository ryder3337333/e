import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ImageBackground, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { HomeButton } from '@/src/components/HomeButton';
import { api } from '@/src/api';
import type { Achievement } from '@/src/achievements';

const TIER_COLOR: Record<Achievement['tier'], string> = {
  bronze: '#cd7f32',
  silver: '#c4c4c4',
  gold: theme.colors.gold,
  diamond: theme.colors.diamond,
  netherite: '#1a1a1a',
};

export default function Achievements() {
  const [items, setItems] = useState<Achievement[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try { setItems(await api<Achievement[]>('/achievements')); } catch (e) { console.warn(e); }
    setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const unlocked = items.filter((a) => a.unlocked).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((unlocked / total) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="achievements-screen">
      <Stack.Screen options={{ title: 'ACHIEVEMENTS',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.fontPixel, fontSize: 11 },
        headerTintColor: theme.colors.gold, headerRight: () => <HomeButton /> }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <FlatList
          data={items}
          keyExtractor={(a) => a.code}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={theme.colors.gold} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <Ionicons name="ribbon" size={32} color={theme.colors.gold} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.headerTitle}>{unlocked}/{total} UNLOCKED</Text>
                <Text style={styles.headerSub}>{pct}% COMPLETE</Text>
                <View style={styles.barWrap}>
                  <View style={[styles.bar, { width: `${pct}%` }]} />
                </View>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.row, !item.unlocked && styles.rowLocked]} testID={`ach-${item.code}`}>
              <View style={[styles.iconWrap, { backgroundColor: item.unlocked ? TIER_COLOR[item.tier] : theme.colors.obsidian }]}>
                <Ionicons name={(item.icon as any) || 'trophy'} size={22} color={item.unlocked ? '#000' : theme.colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={[styles.name, !item.unlocked && { color: theme.colors.textSecondary }]}>{item.name}</Text>
                  <Text style={[styles.tier, { color: TIER_COLOR[item.tier] }]}>{item.tier.toUpperCase()}</Text>
                </View>
                <Text style={styles.desc}>{item.description}</Text>
                {!!item.target && !item.unlocked && (
                  <View style={styles.progressWrap}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${Math.min(100, ((item.progress || 0) / item.target) * 100)}%` }]} />
                    </View>
                    <Text style={styles.progressTxt}>{item.progress || 0}/{item.target}</Text>
                  </View>
                )}
                {item.unlocked && (
                  <Text style={styles.unlockedTxt}>✓ UNLOCKED</Text>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Loading achievements...</Text>}
        />
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.dirtDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  headerTitle: { fontFamily: theme.fontPixel, fontSize: 14, color: theme.colors.gold, letterSpacing: 1 },
  headerSub: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, marginTop: 4 },
  barWrap: { height: 10, backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 2, marginTop: 8 },
  bar: { height: '100%', backgroundColor: theme.colors.gold },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  rowLocked: { opacity: 0.7, backgroundColor: theme.colors.bgDark },
  iconWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderColor: '#000', borderWidth: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontFamily: theme.fontPixel, fontSize: 11, color: theme.colors.text, letterSpacing: 1, flex: 1 },
  tier: { fontFamily: theme.fontPixel, fontSize: 8, letterSpacing: 1 },
  desc: { fontFamily: theme.font, fontSize: 12, color: theme.colors.textSecondary, marginTop: 6, lineHeight: 17 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  progressBar: { flex: 1, height: 8, backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 2 },
  progressFill: { height: '100%', backgroundColor: theme.colors.emerald },
  progressTxt: { fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary, minWidth: 50, textAlign: 'right' },
  unlockedTxt: { fontFamily: theme.fontPixel, fontSize: 9, color: theme.colors.emerald, marginTop: 6, letterSpacing: 1 },
  empty: { fontFamily: theme.font, color: theme.colors.textSecondary, textAlign: 'center', padding: 16 },
});
