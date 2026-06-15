import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ImageBackground, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { HomeButton } from '@/src/components/HomeButton';
import { api } from '@/src/api';
import { fxHit, fxMiss } from '@/src/utils/fx';
import { useEntranceFade } from '@/src/utils/anim';
import { checkAchievements } from '@/src/utils/achievementHooks';
import { useAchievements } from '@/src/achievements';

type Summary = {
  kills: number; deaths: number; kdr: number; streak: number;
  hits: number; misses: number; accuracy: number; elo: number;
};

export default function Accuracy() {
  const { show: showAchievement } = useAchievements();
  const [s, setS] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionHits, setSessionHits] = useState(0);
  const [sessionMisses, setSessionMisses] = useState(0);

  const load = useCallback(async () => {
    try { setS(await api<Summary>('/stats')); } catch (e) { console.warn(e); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const log = async (kind: 'hit' | 'miss') => {
    if (kind === 'hit') fxHit(); else fxMiss();
    setBusy(true);
    try {
      const r = await api<Summary>('/stats/log', { method: 'POST', body: { kind } });
      setS(r);
      if (kind === 'hit') setSessionHits((n) => n + 1);
      else setSessionMisses((n) => n + 1);
      checkAchievements().then((newly) => { if (newly.length) showAchievement(newly); }).catch(() => {});
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
    setBusy(false);
  };

  const sessionTotal = sessionHits + sessionMisses;
  const sessionAcc = sessionTotal > 0 ? Math.round((sessionHits / sessionTotal) * 1000) / 10 : 0;
  const total = (s?.hits || 0) + (s?.misses || 0);
  const accPct = s ? Math.round(s.accuracy * 1000) / 10 : 0;

  const rating =
    accPct >= 80 ? { txt: 'GODLIKE',   color: theme.colors.gold } :
    accPct >= 65 ? { txt: 'EXCELLENT', color: theme.colors.emerald } :
    accPct >= 50 ? { txt: 'SOLID',     color: theme.colors.diamond } :
    accPct >= 30 ? { txt: 'AVERAGE',   color: theme.colors.xp } :
                   { txt: 'PRACTICE',  color: theme.colors.redstone };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="accuracy-screen">
      <Stack.Screen options={{
        title: 'HIT ACCURACY',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold,
        headerRight: () => <HomeButton />,
      }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}>
          <View style={styles.bigCard} testID="acc-display">
            <Text style={styles.label}>OVERALL ACCURACY</Text>
            <Text style={[styles.accValue, { color: rating.color }]}>{accPct.toFixed(1)}%</Text>
            <Text style={[styles.rating, { color: rating.color }]}>{rating.txt}</Text>
            <View style={styles.barWrap}>
              <View style={[styles.bar, { width: `${Math.min(100, accPct)}%`, backgroundColor: rating.color }]} />
            </View>
            <View style={styles.statsRow}>
              <Mini label="HITS"   value={s?.hits ?? 0}   color={theme.colors.emerald} />
              <Mini label="MISSES" value={s?.misses ?? 0} color={theme.colors.redstone} />
              <Mini label="TOTAL"  value={total}          color={theme.colors.diamond} />
            </View>
          </View>

          <Text style={styles.sectionH}>LOG A SWING</Text>
          <View style={styles.row}>
            <Btn testID="hit-btn"  label="+ HIT"  color={theme.colors.emerald} border={theme.colors.emeraldDark} onPress={() => log('hit')} disabled={busy} />
            <Btn testID="miss-btn" label="+ MISS" color={theme.colors.redstone} border="#9b1c1c" onPress={() => log('miss')} disabled={busy} />
          </View>
          {busy && <ActivityIndicator color={theme.colors.gold} style={{ marginTop: 8 }} />}

          <View style={styles.sessionCard} testID="session-stats">
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>THIS SESSION</Text>
              <Text style={styles.sessionLine}>
                <Text style={{ color: theme.colors.emerald }}>{sessionHits}</Text>
                <Text style={{ color: theme.colors.textSecondary }}> / </Text>
                <Text style={{ color: theme.colors.redstone }}>{sessionMisses}</Text>
              </Text>
            </View>
            <View style={styles.sessionAcc}>
              <Text style={styles.sessionAccValue}>{sessionAcc.toFixed(1)}%</Text>
              <Text style={styles.label}>ACCURACY</Text>
            </View>
          </View>

          <View style={styles.tipCard}>
            <Ionicons name="bulb" size={18} color={theme.colors.gold} />
            <Text style={styles.tipTxt}>
              {'  '}TIP: Aim for the head-hitbox window during smash. Land 3 of 4 swings (75%+) to consistently break Netherite armor.
            </Text>
          </View>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.mini}>
      <Text style={[styles.miniValue, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function Btn({ label, color, border, onPress, disabled, testID }: any) {
  return (
    <TouchableOpacity testID={testID} activeOpacity={0.75} onPress={onPress} disabled={disabled}
      style={[styles.btn, { backgroundColor: color, borderColor: border, opacity: disabled ? 0.6 : 1 }]}>
      <Text style={styles.btnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  bigCard: {
    backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark,
    borderWidth: 4, padding: theme.spacing.md, alignItems: 'center',
  },
  label: { fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary, letterSpacing: 1 },
  accValue: { fontFamily: theme.font, fontSize: 56, fontWeight: 'bold', marginVertical: 6, textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 } },
  rating: { fontFamily: theme.font, fontSize: 16, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8 },
  barWrap: { width: '100%', height: 14, backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 2, marginBottom: 12 },
  bar: { height: '100%' },
  statsRow: { flexDirection: 'row', gap: 8, width: '100%' },
  mini: { flex: 1, backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 2, padding: 8, alignItems: 'center' },
  miniValue: { fontFamily: theme.font, fontSize: 22, fontWeight: 'bold' },
  sectionH: { fontFamily: theme.font, fontSize: 12, color: theme.colors.gold, letterSpacing: 1, marginTop: theme.spacing.md, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, borderWidth: 4, borderBottomWidth: 8, paddingVertical: 14, alignItems: 'center' },
  btnTxt: { fontFamily: theme.font, fontSize: 14, color: '#fff', fontWeight: 'bold', letterSpacing: 2, textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 } },
  sessionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.dirtDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, marginTop: theme.spacing.md },
  sessionLine: { fontFamily: theme.font, fontSize: 24, fontWeight: 'bold', marginTop: 2 },
  sessionAcc: { alignItems: 'flex-end' },
  sessionAccValue: { fontFamily: theme.font, fontSize: 22, fontWeight: 'bold', color: theme.colors.gold },
  tipCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: theme.colors.nether, borderColor: '#2a0808', borderWidth: 4, padding: theme.spacing.md, marginTop: theme.spacing.md },
  tipTxt: { flex: 1, fontFamily: theme.font, fontSize: 12, color: theme.colors.text, lineHeight: 18 },
});
