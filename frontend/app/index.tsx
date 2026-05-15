import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ImageBackground,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, API_URL } from '@/src/theme';
import { getDeviceId } from '@/src/device';

type Stats = { kills: number; deaths: number; kdr: number; streak: number };

export default function Home() {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState<string>('');
  const [stats, setStats] = useState<Stats>({ kills: 0, deaths: 0, kdr: 0, streak: 0 });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/stats?device_id=${id}`);
      const data = await res.json();
      setStats({ kills: data.kills, deaths: data.deaths, kdr: data.kdr, streak: data.streak });
    } catch (e) { console.warn(e); }
  }, []);

  useEffect(() => {
    (async () => {
      const id = await getDeviceId();
      setDeviceId(id);
      await loadStats(id);
    })();
  }, [loadStats]);

  const log = async (kind: 'kill' | 'death') => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/stats/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, kind }),
      });
      const data = await res.json();
      setStats({ kills: data.kills, deaths: data.deaths, kdr: data.kdr, streak: data.streak });
    } catch (e) { console.warn(e); }
    setLoading(false);
  };

  const reset = async () => {
    if (!deviceId) return;
    await fetch(`${API_URL}/stats/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, kind: 'kill' }),
    });
    await loadStats(deviceId);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (deviceId) await loadStats(deviceId);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="home-screen">
      <ImageBackground
        source={{ uri: theme.media.stone }}
        resizeMode="repeat"
        style={styles.bg}
        imageStyle={{ opacity: 0.18 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.gold} />}
        >
          <View style={styles.hero} testID="home-hero">
            <Image source={{ uri: theme.media.mace }} style={styles.heroIcon} resizeMode="contain" />
            <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
              <Text style={styles.title}>MACE FORGE</Text>
              <Text style={styles.subtitle}>1.21+ Mace PvP Hub</Text>
            </View>
          </View>

          <View style={styles.statsCard} testID="home-stats">
            <Text style={styles.cardHeader}>BATTLE LOG</Text>
            <View style={styles.row}>
              <Stat label="Kills" value={stats.kills} color={theme.colors.emerald} testID="stat-kills" />
              <Stat label="Deaths" value={stats.deaths} color={theme.colors.redstone} testID="stat-deaths" />
              <Stat label="K/D" value={stats.kdr} color={theme.colors.diamond} testID="stat-kdr" />
              <Stat label="Streak" value={stats.streak} color={theme.colors.gold} testID="stat-streak" />
            </View>
            <View style={[styles.row, { marginTop: theme.spacing.md }]}>
              <ActionButton label="+ KILL" testID="log-kill-btn"
                color={theme.colors.emerald} borderColor={theme.colors.emeraldDark}
                onPress={() => log('kill')} disabled={loading} />
              <ActionButton label="+ DEATH" testID="log-death-btn"
                color={theme.colors.redstone} borderColor="#9b1c1c"
                onPress={() => log('death')} disabled={loading} />
            </View>
            <TouchableOpacity testID="reset-stats-btn" onPress={reset} style={styles.resetBtn}>
              <Text style={styles.resetTxt}>RESET LOG</Text>
            </TouchableOpacity>
            {loading && <ActivityIndicator color={theme.colors.gold} style={{ marginTop: 8 }} />}
          </View>

          <Text style={styles.sectionHeader}>QUICK ACCESS</Text>
          <View style={styles.grid}>
            <Tile icon="book" label="GUIDE" testID="tile-guide" onPress={() => router.push('/guide')} />
            <Tile icon="hammer" label="LOADOUTS" testID="tile-loadout" onPress={() => router.push('/loadout')} />
            <Tile icon="chatbubbles" label="FORUM" testID="tile-forum" onPress={() => router.push('/forum')} />
            <Tile icon="sparkles" label="AI COACH" testID="tile-chat" onPress={() => router.push('/chat')} />
          </View>

          <View style={styles.tipCard} testID="daily-tip">
            <Text style={styles.cardHeader}>TIP OF THE DAY</Text>
            <Text style={styles.body}>
              Stack Density V + Wind Burst III. Launch yourself, then slam from 20+ blocks for instant
              full-armor kills. Pair with Feather Falling IV boots to survive the landing.
            </Text>
          </View>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

function Stat({ label, value, color, testID }: { label: string; value: number; color: string; testID: string }) {
  return (
    <View style={styles.stat} testID={testID}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({ label, color, borderColor, onPress, disabled, testID }: {
  label: string; color: string; borderColor: string; onPress: () => void; disabled?: boolean; testID: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, { backgroundColor: color, borderColor, opacity: disabled ? 0.6 : 1 }]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Tile({ icon, label, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} activeOpacity={0.7} onPress={onPress} style={styles.tile}>
      <Ionicons name={icon} size={28} color={theme.colors.gold} />
      <Text style={styles.tileLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  hero: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.dirtDark,
    borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md,
    marginBottom: theme.spacing.md },
  heroIcon: { width: 64, height: 64 },
  title: { fontFamily: theme.font, fontSize: 24, fontWeight: 'bold', color: theme.colors.gold,
    textTransform: 'uppercase', letterSpacing: 2,
    textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  subtitle: { fontFamily: theme.font, fontSize: 12, color: theme.colors.textSecondary,
    textTransform: 'uppercase', marginTop: 4 },
  statsCard: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark,
    borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  cardHeader: { fontFamily: theme.font, fontSize: 14, fontWeight: 'bold', color: theme.colors.gold,
    textTransform: 'uppercase', marginBottom: theme.spacing.sm, letterSpacing: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  stat: { flex: 1, backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark,
    borderWidth: 2, padding: theme.spacing.sm, alignItems: 'center' },
  statValue: { fontFamily: theme.font, fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary,
    textTransform: 'uppercase', marginTop: 2 },
  btn: { flex: 1, borderWidth: 4, borderBottomWidth: 8, paddingVertical: 12, alignItems: 'center' },
  btnText: { fontFamily: theme.font, fontSize: 14, color: '#fff', fontWeight: 'bold',
    textTransform: 'uppercase', textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 } },
  resetBtn: { alignSelf: 'center', marginTop: theme.spacing.sm },
  resetTxt: { fontFamily: theme.font, color: theme.colors.textSecondary, fontSize: 11,
    textDecorationLine: 'underline', textTransform: 'uppercase' },
  sectionHeader: { fontFamily: theme.font, fontSize: 16, fontWeight: 'bold', color: theme.colors.gold,
    textTransform: 'uppercase', marginVertical: theme.spacing.sm, letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48%', aspectRatio: 1.6, backgroundColor: theme.colors.dirtDark,
    borderColor: theme.colors.borderDark, borderWidth: 4, borderBottomWidth: 8,
    alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.sm },
  tileLabel: { fontFamily: theme.font, fontSize: 12, color: theme.colors.text, fontWeight: 'bold',
    textTransform: 'uppercase', marginTop: 6, letterSpacing: 1 },
  tipCard: { backgroundColor: theme.colors.nether, borderColor: '#2a0808', borderWidth: 4,
    padding: theme.spacing.md, marginTop: theme.spacing.sm },
  body: { fontFamily: theme.font, fontSize: 13, color: theme.colors.text, lineHeight: 20 },
});
