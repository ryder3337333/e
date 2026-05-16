import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ImageBackground, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { theme } from '@/src/theme';
import { HomeButton } from '@/src/components/HomeButton';
import { api } from '@/src/api';

type Server = { id: string; name: string; ip: string; region: string; players: number; max: number; modes: string[]; version: string };

const REGIONS = ['ALL', 'NA', 'EU', 'AS', 'GLOBAL'] as const;

export default function Servers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [region, setRegion] = useState<typeof REGIONS[number]>('ALL');

  useEffect(() => {
    (async () => {
      try { setServers(await api<Server[]>('/servers', { auth: false })); } catch (e) { console.warn(e); }
    })();
  }, []);

  const filtered = region === 'ALL' ? servers : servers.filter((s) => s.region.includes(region));

  const copy = async (ip: string) => {
    try { await Clipboard.setStringAsync(ip); } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="servers-screen">
      <Stack.Screen options={{ title: 'SERVER FINDER',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold, headerRight: () => <HomeButton /> }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <View style={styles.tabs}>
          {REGIONS.map((r) => (
            <TouchableOpacity key={r} testID={`region-${r}`} onPress={() => setRegion(r)}
              style={[styles.tab, region === r && styles.tabActive]}>
              <Text style={[styles.tabTxt, region === r && styles.tabTxtActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const pct = item.players / item.max;
            const dotColor = pct > 0.7 ? theme.colors.redstone : pct > 0.4 ? theme.colors.gold : theme.colors.emerald;
            return (
              <View style={styles.card} testID={`server-${item.id}`}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.ip}>{item.ip}</Text>
                  </View>
                  <View style={[styles.dot, { backgroundColor: dotColor }]} />
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{item.region}</Text>
                  <Text style={styles.meta}>v{item.version}</Text>
                  <Text style={styles.meta}>{item.players.toLocaleString()}/{item.max.toLocaleString()}</Text>
                </View>
                <View style={styles.modes}>
                  {item.modes.map((m) => (
                    <View key={m} style={styles.modeChip}><Text style={styles.modeTxt}>{m}</Text></View>
                  ))}
                </View>
                <TouchableOpacity testID={`copy-${item.id}`} onPress={() => copy(item.ip)} style={styles.copyBtn}>
                  <Ionicons name="copy" size={14} color="#000" />
                  <Text style={styles.copyTxt}>COPY IP</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  tabs: { flexDirection: 'row', gap: 6, padding: theme.spacing.md, paddingBottom: 0, flexWrap: 'wrap' },
  tab: { backgroundColor: theme.colors.bgDark, borderColor: theme.colors.borderDark, borderWidth: 2, paddingHorizontal: 12, paddingVertical: 6 },
  tabActive: { backgroundColor: theme.colors.emeraldDark, borderColor: theme.colors.emerald },
  tabTxt: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, fontWeight: 'bold' },
  tabTxtActive: { color: '#fff' },
  card: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  name: { fontFamily: theme.font, fontSize: 16, color: theme.colors.gold, fontWeight: 'bold', textTransform: 'uppercase' },
  ip: { fontFamily: theme.font, fontSize: 12, color: theme.colors.diamond, marginTop: 2 },
  dot: { width: 12, height: 12, borderColor: '#000', borderWidth: 2 },
  metaRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  meta: { fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary, letterSpacing: 1 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  modeChip: { backgroundColor: theme.colors.lapis, borderColor: '#22229a', borderWidth: 2, paddingHorizontal: 6, paddingVertical: 3 },
  modeTxt: { fontFamily: theme.font, fontSize: 9, color: '#fff', fontWeight: 'bold' },
  copyBtn: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4, backgroundColor: theme.colors.gold, borderColor: '#8b5a2b', borderWidth: 2, borderBottomWidth: 4, paddingHorizontal: 10, paddingVertical: 6 },
  copyTxt: { fontFamily: theme.font, fontSize: 11, color: '#000', fontWeight: 'bold' },
});
