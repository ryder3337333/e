import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ImageBackground, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { theme } from '@/src/theme';
import { api } from '@/src/api';

type Tip = { id: string; category: string; title: string; body: string };

const CATS = ['all', 'mechanic', 'movement', 'counter', 'loadout'] as const;

const CAT_COLORS: Record<string, string> = {
  mechanic: theme.colors.diamond,
  movement: theme.colors.emerald,
  counter: theme.colors.redstone,
  loadout: theme.colors.gold,
};

export default function Tips() {
  const [tips, setTips] = useState<Tip[]>([]);
  const [daily, setDaily] = useState<Tip | null>(null);
  const [cat, setCat] = useState<typeof CATS[number]>('all');

  useEffect(() => {
    (async () => {
      try {
        const [list, d] = await Promise.all([api<Tip[]>('/tips', { auth: false }), api<Tip>('/tips/daily', { auth: false })]);
        setTips(list); setDaily(d);
      } catch (e) { console.warn(e); }
    })();
  }, []);

  const filtered = cat === 'all' ? tips : tips.filter((t) => t.category === cat);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="tips-screen">
      <Stack.Screen options={{ title: 'TIPS FEED',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        {daily && (
          <View style={styles.daily} testID="daily-tip-card">
            <Text style={styles.dailyLabel}>★ TIP OF THE DAY</Text>
            <Text style={styles.dailyTitle}>{daily.title}</Text>
            <Text style={styles.dailyBody}>{daily.body}</Text>
          </View>
        )}
        <View style={styles.tabs}>
          {CATS.map((c) => (
            <TouchableOpacity key={c} testID={`tip-cat-${c}`} onPress={() => setCat(c)}
              style={[styles.tab, cat === c && styles.tabActive]}>
              <Text style={[styles.tabTxt, cat === c && styles.tabTxtActive]}>{c.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`tip-${item.id}`}>
              <View style={[styles.catTag, { backgroundColor: CAT_COLORS[item.category] || theme.colors.stone }]}>
                <Text style={styles.catTagTxt}>{item.category.toUpperCase()}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          )}
        />
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  daily: { margin: theme.spacing.md, marginBottom: 0, backgroundColor: theme.colors.nether, borderColor: '#2a0808', borderWidth: 4, padding: theme.spacing.md },
  dailyLabel: { fontFamily: theme.font, fontSize: 11, color: theme.colors.gold, letterSpacing: 1, marginBottom: 6 },
  dailyTitle: { fontFamily: theme.font, fontSize: 16, fontWeight: 'bold', color: theme.colors.gold, marginBottom: 6, textTransform: 'uppercase' },
  dailyBody: { fontFamily: theme.font, fontSize: 13, color: theme.colors.text, lineHeight: 19 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: theme.spacing.md, paddingBottom: 0 },
  tab: { backgroundColor: theme.colors.bgDark, borderColor: theme.colors.borderDark, borderWidth: 2, paddingHorizontal: 10, paddingVertical: 6 },
  tabActive: { backgroundColor: theme.colors.emeraldDark, borderColor: theme.colors.emerald },
  tabTxt: { fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary, fontWeight: 'bold' },
  tabTxtActive: { color: '#fff' },
  card: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  catTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderColor: '#000', borderWidth: 2, marginBottom: 8 },
  catTagTxt: { fontFamily: theme.font, fontSize: 9, color: '#000', fontWeight: 'bold' },
  title: { fontFamily: theme.font, fontSize: 15, fontWeight: 'bold', color: theme.colors.gold, marginBottom: 6, textTransform: 'uppercase' },
  body: { fontFamily: theme.font, fontSize: 12, color: theme.colors.text, lineHeight: 18 },
});
