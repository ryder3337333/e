import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ImageBackground, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { HomeButton } from '@/src/components/HomeButton';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import { fxTap, fxSuccess, fxError, fxHeavy } from '@/src/utils/fx';
import { reportQuickdraw } from '@/src/utils/achievementHooks';
import { useAchievements } from '@/src/achievements';

type Phase = 'idle' | 'waiting' | 'go' | 'done' | 'tooEarly';

type LbRow = { rank: number; user_id: string; username: string; best_ms: number; attempts: number; updated_at?: string };
type Mine = { best_ms: number; attempts: number; rank: number } | null;

export default function Reaction() {
  const { user } = useAuth();
  const { show: showAchievement } = useAchievements();
  const [phase, setPhase] = useState<Phase>('idle');
  const [ms, setMs] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [lb, setLb] = useState<LbRow[]>([]);
  const [mine, setMine] = useState<Mine>(null);
  const [loadingLb, setLoadingLb] = useState(false);
  const startRef = useRef<number>(0);
  const timeoutRef = useRef<any>(null);

  const loadLb = useCallback(async () => {
    setLoadingLb(true);
    try {
      const [board, my] = await Promise.all([
        api<LbRow[]>('/reaction/leaderboard', { auth: false }),
        api<Mine>('/reaction/mine').catch(() => null),
      ]);
      setLb(board);
      setMine(my);
      if (my?.best_ms) setBest(my.best_ms);
    } catch (e) { console.warn(e); }
    setLoadingLb(false);
  }, []);
  useEffect(() => { loadLb(); }, [loadLb]);

  const start = () => {
    setMs(null);
    setPhase('waiting');
    const delay = 1200 + Math.random() * 2500;
    timeoutRef.current = setTimeout(() => {
      startRef.current = Date.now();
      setPhase('go');
    }, delay);
  };

  const tap = () => {
    if (phase === 'idle' || phase === 'done' || phase === 'tooEarly') {
      fxTap();
      start();
    } else if (phase === 'waiting') {
      fxError();
      clearTimeout(timeoutRef.current);
      setPhase('tooEarly');
    } else if (phase === 'go') {
      const reaction = Date.now() - startRef.current;
      setMs(reaction);
      const isBest = best === null || reaction < best;
      setBest((b) => (b === null || reaction < b ? reaction : b));
      setPhase('done');
      if (isBest) fxSuccess(); else fxHeavy();

      // Persist to backend leaderboard
      api<{ is_new_best: boolean; best_ms: number; attempts: number }>('/reaction/log', {
        method: 'POST', body: { ms: reaction },
      }).then((r) => {
        if (r.is_new_best) loadLb();
      }).catch(() => {});

      if (reaction < 250) {
        reportQuickdraw(reaction).then((newly) => { if (newly.length) showAchievement(newly); }).catch(() => {});
      }
    }
  };

  const color =
    phase === 'go' ? theme.colors.emerald :
    phase === 'waiting' ? theme.colors.redstone :
    phase === 'tooEarly' ? theme.colors.nether :
    theme.colors.dirtDark;

  const label =
    phase === 'idle' ? 'TAP TO START' :
    phase === 'waiting' ? 'WAIT...' :
    phase === 'go' ? 'TAP NOW!' :
    phase === 'tooEarly' ? 'TOO EARLY!\nTAP TO RETRY' :
    `${ms} MS\nTAP FOR ANOTHER`;

  const rating =
    ms === null ? '' :
    ms < 200 ? 'GODLIKE' :
    ms < 250 ? 'EXCELLENT' :
    ms < 300 ? 'GOOD' :
    ms < 400 ? 'AVERAGE' : 'PRACTICE MORE';

  const ratingColor =
    ms === null ? theme.colors.gold :
    ms < 200 ? theme.colors.diamond :
    ms < 250 ? theme.colors.gold :
    ms < 300 ? theme.colors.emerald :
    ms < 400 ? '#cd7f32' : theme.colors.redstone;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="reaction-screen">
      <Stack.Screen options={{ title: 'REACTION TEST',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold, headerRight: () => <HomeButton /> }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={loadingLb} onRefresh={loadLb} tintColor={theme.colors.gold} />}
        >
          <Text style={styles.heading}>REACT WHEN SCREEN TURNS GREEN</Text>
          <TouchableOpacity
            testID="reaction-pad" activeOpacity={0.85} onPress={tap}
            style={[styles.pad, { backgroundColor: color }]}
          >
            <Text style={styles.padText}>{label}</Text>
          </TouchableOpacity>

          {phase === 'done' && (
            <Text style={[styles.rating, { color: ratingColor }]} testID="rating">{rating}</Text>
          )}

          {/* Personal best card */}
          <View style={styles.row}>
            <View style={styles.bestCard}>
              <Text style={styles.bestLabel}>YOUR BEST</Text>
              <Text style={styles.bestValue} testID="best-time">
                {best !== null ? `${best}` : '—'}
                {best !== null && <Text style={styles.unit}> MS</Text>}
              </Text>
            </View>
            <View style={styles.bestCard}>
              <Text style={styles.bestLabel}>GLOBAL RANK</Text>
              <Text style={[styles.bestValue, { color: theme.colors.gold }]} testID="my-rank">
                {mine?.rank ? `#${mine.rank}` : '—'}
              </Text>
            </View>
          </View>

          {/* Leaderboard */}
          <View style={styles.lbHead}>
            <Ionicons name="trophy" size={20} color={theme.colors.gold} />
            <Text style={styles.lbTitle}>GLOBAL LEADERBOARD</Text>
            <Text style={styles.lbCount}>{lb.length} PLAYERS</Text>
          </View>

          {loadingLb && lb.length === 0 ? (
            <ActivityIndicator color={theme.colors.gold} style={{ marginTop: 20 }} />
          ) : lb.length === 0 ? (
            <Text style={styles.empty}>No times logged yet — be the first!</Text>
          ) : (
            <View style={styles.lbList} testID="reaction-lb">
              {lb.map((r) => {
                const isMe = r.user_id === user?.id;
                const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '';
                return (
                  <View
                    key={r.user_id}
                    style={[styles.lbRow, isMe && styles.lbRowMine]}
                    testID={`lb-row-${r.rank}`}
                  >
                    <View style={styles.rankCol}>
                      {medal ? <Text style={styles.medal}>{medal}</Text> : <Text style={styles.rankNum}>#{r.rank}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.lbName, isMe && { color: theme.colors.gold }]}>
                        {r.username}{isMe ? '  (you)' : ''}
                      </Text>
                      <Text style={styles.lbMeta}>{r.attempts} attempt{r.attempts === 1 ? '' : 's'}</Text>
                    </View>
                    <Text style={[styles.lbMs, { color: r.rank <= 3 ? theme.colors.gold : theme.colors.diamond }]}>
                      {r.best_ms}<Text style={styles.unit}> MS</Text>
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  heading: { fontFamily: theme.fontPixel, fontSize: 9, color: theme.colors.gold, textAlign: 'center', marginBottom: theme.spacing.md, letterSpacing: 1, lineHeight: 16 },
  pad: { height: 220, borderColor: '#000', borderWidth: 6, borderBottomWidth: 12, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md },
  padText: { fontFamily: theme.fontPixel, fontSize: 16, color: '#fff', textAlign: 'center', letterSpacing: 2, lineHeight: 26 },
  rating: { fontFamily: theme.fontPixel, fontSize: 14, textAlign: 'center', marginBottom: theme.spacing.md, letterSpacing: 2 },
  row: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing.md },
  bestCard: { flex: 1, backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, alignItems: 'center' },
  bestLabel: { fontFamily: theme.fontPixel, fontSize: 7, color: theme.colors.textSecondary, letterSpacing: 1 },
  bestValue: { fontFamily: theme.fontPixel, fontSize: 22, color: theme.colors.diamond, marginTop: 6 },
  unit: { fontFamily: theme.fontPixel, fontSize: 10, color: theme.colors.textSecondary },
  lbHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, marginBottom: 6, borderBottomColor: theme.colors.borderDark, borderBottomWidth: 2 },
  lbTitle: { fontFamily: theme.fontPixel, fontSize: 11, color: theme.colors.gold, letterSpacing: 1, flex: 1 },
  lbCount: { fontFamily: theme.fontPixel, fontSize: 8, color: theme.colors.textSecondary, letterSpacing: 1 },
  lbList: { },
  lbRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 2, paddingVertical: 10, paddingHorizontal: 10, marginBottom: 4 },
  lbRowMine: { backgroundColor: theme.colors.dirtDark, borderColor: theme.colors.gold, borderWidth: 3 },
  rankCol: { width: 44, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankNum: { fontFamily: theme.fontPixel, fontSize: 11, color: theme.colors.textSecondary, letterSpacing: 1 },
  lbName: { fontFamily: theme.fontPixel, fontSize: 10, color: theme.colors.text, letterSpacing: 1 },
  lbMeta: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, marginTop: 3 },
  lbMs: { fontFamily: theme.fontPixel, fontSize: 14, letterSpacing: 1 },
  empty: { fontFamily: theme.font, color: theme.colors.textSecondary, textAlign: 'center', padding: 20 },
});
