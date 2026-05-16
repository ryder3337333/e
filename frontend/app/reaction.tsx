import { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { theme } from '@/src/theme';
import { HomeButton } from '@/src/components/HomeButton';
import { fxTap, fxSuccess, fxError, fxHeavy } from '@/src/utils/fx';

type Phase = 'idle' | 'waiting' | 'go' | 'done' | 'tooEarly';

export default function Reaction() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [ms, setMs] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const startRef = useRef<number>(0);
  const timeoutRef = useRef<any>(null);

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

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="reaction-screen">
      <Stack.Screen options={{ title: 'REACTION TEST',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold, headerRight: () => <HomeButton /> }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <View style={styles.wrap}>
          <Text style={styles.heading}>REACT WHEN SCREEN TURNS GREEN</Text>
          <TouchableOpacity testID="reaction-pad" activeOpacity={0.85} onPress={tap}
            style={[styles.pad, { backgroundColor: color }]}>
            <Text style={styles.padText}>{label}</Text>
          </TouchableOpacity>
          {phase === 'done' && (
            <Text style={styles.rating} testID="rating">{rating}</Text>
          )}
          <View style={styles.bestCard}>
            <Text style={styles.bestLabel}>YOUR BEST</Text>
            <Text style={styles.bestValue} testID="best-time">{best !== null ? `${best} MS` : '—'}</Text>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  wrap: { flex: 1, padding: theme.spacing.md },
  heading: { fontFamily: theme.font, fontSize: 14, color: theme.colors.gold, textAlign: 'center', textTransform: 'uppercase', marginBottom: theme.spacing.md, letterSpacing: 1 },
  pad: { flex: 1, borderColor: '#000', borderWidth: 6, borderBottomWidth: 12, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md },
  padText: { fontFamily: theme.font, fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center', letterSpacing: 2, textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 } },
  rating: { fontFamily: theme.font, fontSize: 20, color: theme.colors.gold, textAlign: 'center', fontWeight: 'bold', marginBottom: theme.spacing.md, letterSpacing: 2 },
  bestCard: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, alignItems: 'center' },
  bestLabel: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, letterSpacing: 1 },
  bestValue: { fontFamily: theme.font, fontSize: 28, fontWeight: 'bold', color: theme.colors.diamond, marginTop: 4 },
});
