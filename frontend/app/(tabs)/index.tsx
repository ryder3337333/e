import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ImageBackground,
  RefreshControl, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import { fxTap, fxHit, fxMiss, fxNotify } from '@/src/utils/fx';
import { useEntranceFade, usePulse } from '@/src/utils/anim';
import { checkAchievements } from '@/src/utils/achievementHooks';
import { useAchievements } from '@/src/achievements';

type Stats = { kills: number; deaths: number; kdr: number; streak: number };

export default function Home() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { show: showAchievement } = useAchievements();
  const [stats, setStats] = useState<Stats>({ kills: 0, deaths: 0, kdr: 0, streak: 0 });
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [s, n] = await Promise.all([
        api<Stats>('/stats'),
        api<{ count: number }>('/notifications/unread-count'),
      ]);
      setStats(s);
      setUnread(n.count);
    } catch (e) { console.warn(e); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const log = async (kind: 'kill' | 'death') => {
    if (kind === 'kill') fxHit(); else fxMiss();
    setLoading(true);
    try {
      const s = await api<Stats>('/stats/log', { method: 'POST', body: { kind } });
      setStats(s);
      checkAchievements().then((newly) => { if (newly.length) showAchievement(newly); }).catch(() => {});
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
    setLoading(false);
  };

  const reset = async () => {
    await api('/stats/reset', { method: 'POST', body: {} });
    await loadAll();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="home-screen">
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.18 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.gold} />}
        >
          <View style={styles.hero} testID="home-hero">
            <Image source={theme.media.mace} style={styles.heroIcon} resizeMode="contain" />
            <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
              <Text style={styles.title}>MACE FORGE</Text>
              <Text style={styles.subtitle}>HELLO, {user?.username?.toUpperCase()}</Text>
            </View>
            <TouchableOpacity testID="bell-btn" onPress={() => router.push('/notifications')} style={styles.bell}>
              <Ionicons name="notifications" size={22} color={theme.colors.gold} />
              {unread > 0 && (
                <View style={styles.badge} testID="unread-badge">
                  <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
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
            <Tile icon="flame" label="PVP TIPS" testID="tile-tips" onPress={() => router.push('/tips')} delay={0} />
            <Tile icon="locate" label="HIT ACCURACY" testID="tile-accuracy" onPress={() => router.push('/accuracy')} delay={60} />
            <Tile icon="calculator" label="DPS CALC" testID="tile-dps" onPress={() => router.push('/dps')} delay={120} />
            <Tile icon="trophy" label="LEADERBOARD" testID="tile-leaderboard" onPress={() => router.push('/leaderboard')} delay={180} />
            <Tile icon="flash" label="REACTION" testID="tile-reaction" onPress={() => router.push('/reaction')} delay={240} />
            <Tile icon="film" label="REPLAY AI" testID="tile-replay" onPress={() => router.push('/replay')} delay={300} />
          </View>

          <View style={styles.tipCard} testID="daily-tip">
            <Text style={styles.cardHeader}>TIP OF THE DAY</Text>
            <Text style={styles.body}>
              Stack Density V + Wind Burst III. Launch yourself, then slam from 20+ blocks for instant
              full-armor kills. Pair with Feather Falling IV boots to survive the landing.
            </Text>
          </View>

          <TouchableOpacity testID="logout-btn" onPress={async () => { await logout(); router.replace('/login'); }} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={18} color={theme.colors.redstone} />
            <Text style={styles.logoutTxt}>LOG OUT</Text>
          </TouchableOpacity>
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

function ActionButton({ label, color, borderColor, onPress, disabled, testID }: any) {
  return (
    <TouchableOpacity testID={testID} activeOpacity={0.7} onPress={onPress} disabled={disabled}
      style={[styles.btn, { backgroundColor: color, borderColor, opacity: disabled ? 0.6 : 1 }]}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Tile({ icon, label, onPress, testID, delay = 0 }: any) {
  const ent = useEntranceFade(delay);
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ width: '48%' }, ent.style, { transform: [...(ent.style.transform || []), { scale }] }]}>
      <TouchableOpacity
        testID={testID}
        activeOpacity={0.85}
        onPressIn={() => { Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, friction: 5 }).start(); }}
        onPressOut={() => { Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }).start(); }}
        onPress={() => { fxTap(); onPress?.(); }}
        style={styles.tile}
      >
        <Ionicons name={icon} size={28} color={theme.colors.gold} />
        <Text style={styles.tileLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  hero: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.dirtDark,
    borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  heroIcon: { width: 64, height: 64 },
  title: { fontFamily: theme.font, fontSize: 24, fontWeight: 'bold', color: theme.colors.gold,
    textTransform: 'uppercase', letterSpacing: 2, textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 } },
  subtitle: { fontFamily: theme.font, fontSize: 11, color: theme.colors.emerald,
    textTransform: 'uppercase', marginTop: 4, letterSpacing: 1 },
  bell: { padding: 8, position: 'relative' },
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: theme.colors.redstone,
    borderColor: '#000', borderWidth: 2, minWidth: 20, height: 20, paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center' },
  badgeText: { fontFamily: theme.font, fontSize: 10, color: '#fff', fontWeight: 'bold' },
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
  tile: { width: '100%', aspectRatio: 1.6, backgroundColor: theme.colors.dirtDark,
    borderColor: theme.colors.borderDark, borderWidth: 4, borderBottomWidth: 8,
    alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.sm },
  tileLabel: { fontFamily: theme.font, fontSize: 12, color: theme.colors.text, fontWeight: 'bold',
    textTransform: 'uppercase', marginTop: 6, letterSpacing: 1 },
  tipCard: { backgroundColor: theme.colors.nether, borderColor: '#2a0808', borderWidth: 4,
    padding: theme.spacing.md, marginTop: theme.spacing.sm },
  body: { fontFamily: theme.font, fontSize: 13, color: theme.colors.text, lineHeight: 20 },
  logoutBtn: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6,
    marginTop: theme.spacing.lg, padding: 10 },
  logoutTxt: { fontFamily: theme.font, fontSize: 12, color: theme.colors.redstone,
    textTransform: 'uppercase', letterSpacing: 1, fontWeight: 'bold' },
});
