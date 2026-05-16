import { useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { fxTap } from '@/src/utils/fx';
import { useEntranceFade } from '@/src/utils/anim';
import { Animated } from 'react-native';

type Tool = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  route: string;
  accent: string;
  testID: string;
};

const TOOLS: Tool[] = [
  { key: 'tips',      icon: 'flame',          label: 'PVP TIPS',         sub: 'Daily mace tactics',         route: '/tips',         accent: theme.colors.redstone, testID: 'more-tips' },
  { key: 'dps',       icon: 'calculator',     label: 'DPS CALC',         sub: 'Damage per second math',     route: '/dps',          accent: theme.colors.diamond,  testID: 'more-dps' },
  { key: 'leader',    icon: 'trophy',         label: 'LEADERBOARD',      sub: 'Weekly K/D rankings',        route: '/leaderboard',  accent: theme.colors.gold,     testID: 'more-leader' },
  { key: 'accuracy',  icon: 'locate',         label: 'HIT ACCURACY',     sub: 'Track hit %',                route: '/accuracy',     accent: theme.colors.emerald,  testID: 'more-accuracy' },
  { key: 'reaction',  icon: 'flash',          label: 'REACTION TEST',    sub: 'Train your reflexes',        route: '/reaction',     accent: theme.colors.xp,       testID: 'more-reaction' },
  { key: 'crosshair', icon: 'add-circle',     label: 'CROSSHAIR',        sub: 'Custom crosshair maker',     route: '/crosshair',    accent: theme.colors.diamond,  testID: 'more-crosshair' },
  { key: 'servers',   icon: 'globe',          label: 'SERVERS',          sub: 'Find mace PvP realms',       route: '/servers',      accent: theme.colors.lapis,    testID: 'more-servers' },
  { key: 'friends',   icon: 'people',         label: 'FRIENDS',          sub: 'Add & follow players',       route: '/friends',      accent: theme.colors.emerald,  testID: 'more-friends' },
  { key: 'replay',    icon: 'film',           label: 'REPLAY ANALYZER',  sub: 'AI critique your clip',      route: '/replay',       accent: theme.colors.gold,     testID: 'more-replay' },
  { key: 'clans',     icon: 'shield',         label: 'CLANS',            sub: 'Found or join a clan',       route: '/clans',        accent: theme.colors.diamond,  testID: 'more-clans' },
  { key: 'challenge', icon: 'flash-outline',  label: '1V1 CHALLENGE',    sub: 'Throw down the gauntlet',    route: '/challenges',   accent: theme.colors.redstone, testID: 'more-challenges' },
  { key: 'duo',       icon: 'people-circle',  label: 'FIND DUO',         sub: 'Match with players',         route: '/duo',          accent: theme.colors.emerald,  testID: 'more-duo' },
  { key: 'notif',     icon: 'notifications',  label: 'NOTIFICATIONS',    sub: 'Inbox & alerts',             route: '/notifications',accent: theme.colors.redstone, testID: 'more-notif' },
];

export default function More() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="more-screen">
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.18 }}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Ionicons name="apps" size={28} color={theme.colors.gold} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.title}>TOOLS & FEATURES</Text>
              <Text style={styles.subtitle}>Everything mace pvp — in one chest</Text>
            </View>
          </View>

          <View style={styles.grid}>
            {TOOLS.map((t, idx) => (
              <ToolTile key={t.key} tool={t} delay={idx * 50} onPress={() => router.push(t.route as any)} />
            ))}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerTxt}>⚔ FORGE YOUR LEGEND ⚔</Text>
            <Text style={styles.footerSub}>13 tools • Built for Mace 1.21+</Text>
          </View>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

function ToolTile({ tool, onPress, delay }: { tool: Tool; onPress: () => void; delay: number }) {
  const ent = useEntranceFade(delay);
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View
      style={[
        { width: '48%' },
        ent.style,
        { transform: [...(ent.style.transform || []), { scale }] },
      ]}
    >
      <TouchableOpacity
        testID={tool.testID}
        activeOpacity={0.85}
        onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, friction: 5 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }).start()}
        onPress={() => { fxTap(); onPress(); }}
        style={[styles.tile, { borderTopColor: tool.accent }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: tool.accent }]}>
          <Ionicons name={tool.icon} size={26} color="#0a0a0a" />
        </View>
        <Text style={styles.tileLabel}>{tool.label}</Text>
        <Text style={styles.tileSub}>{tool.sub}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  container: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.dirtDark, borderColor: theme.colors.borderDark,
    borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.font, fontSize: 18, color: theme.colors.gold,
    fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary,
    marginTop: 4, letterSpacing: 1,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%', marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.stoneDark,
    borderColor: theme.colors.borderDark, borderWidth: 4,
    borderTopWidth: 6, borderBottomWidth: 8,
    padding: theme.spacing.md, alignItems: 'flex-start',
    minHeight: 130,
  },
  iconWrap: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderColor: '#000', borderWidth: 2, marginBottom: 8,
  },
  tileLabel: {
    fontFamily: theme.font, fontSize: 13, color: theme.colors.text,
    fontWeight: 'bold', letterSpacing: 1, marginBottom: 4,
  },
  tileSub: {
    fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary,
    lineHeight: 14,
  },
  footer: {
    marginTop: theme.spacing.md, padding: theme.spacing.md,
    backgroundColor: theme.colors.nether, borderColor: '#2a0808', borderWidth: 4,
    alignItems: 'center',
  },
  footerTxt: {
    fontFamily: theme.font, fontSize: 12, color: theme.colors.gold,
    letterSpacing: 2, fontWeight: 'bold',
  },
  footerSub: {
    fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary,
    marginTop: 4, letterSpacing: 1,
  },
});
