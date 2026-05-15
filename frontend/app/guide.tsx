import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';

type Section = 'mechanics' | 'enchants' | 'tips' | 'tier';

const ENCHANTS = [
  { name: 'Density V', tier: 'S', color: theme.colors.diamond,
    desc: '+1 base damage per fall block. Core enchant for any mace build.' },
  { name: 'Breach IV', tier: 'S', color: theme.colors.lapis,
    desc: 'Reduces target armor effectiveness by 15% per level. Crushes Netherite.' },
  { name: 'Wind Burst III', tier: 'A', color: theme.colors.emerald,
    desc: 'Smash launches you upward — chain mid-air slams.' },
  { name: 'Smite V', tier: 'A', color: theme.colors.gold,
    desc: 'Bonus damage vs. undead. Great for Wither/zombie servers.' },
  { name: 'Fire Aspect II', tier: 'B', color: theme.colors.redstone,
    desc: 'Burn DoT. Niche pick — incompatible with Density on some servers.' },
  { name: 'Unbreaking III', tier: 'A', color: theme.colors.stone,
    desc: 'Tripled durability. Always pair with Mending.' },
];

const TIER_LIST: { tier: string; color: string; items: string[] }[] = [
  { tier: 'S', color: theme.colors.gold, items: ['Mace + Density V', 'Netherite Chestplate', 'Totem of Undying'] },
  { tier: 'A', color: theme.colors.emerald, items: ['Diamond Sword', 'Trident (Loyalty III)', 'Crossbow + Multishot'] },
  { tier: 'B', color: theme.colors.diamond, items: ['Bow + Power V', 'Shield', 'Diamond Armor'] },
  { tier: 'C', color: theme.colors.lapis, items: ['Iron Sword', 'Iron Armor', 'Snowballs'] },
  { tier: 'D', color: theme.colors.redstone, items: ['Wooden Sword', 'Leather Armor', 'No Totem'] },
];

const TIPS = [
  'Always carry 2 Totems — left hand + offhand swap macro.',
  'Falling 12+ blocks before slam = guaranteed crit.',
  'Wind Burst lets you skip kits — use it to escape AND chain.',
  'Pearl up, then mace down — classic ender combo.',
  'Counter mace players with shields (Java) or roof rushing (Bedrock).',
];

const MECHANICS = [
  { title: 'Smash Attack', body: 'Falling onto an enemy with the Mace deals MASSIVE bonus damage scaled by fall distance: +4 damage per block for the first 3 blocks, +2 each for blocks 4-8, +1 thereafter.' },
  { title: 'Fall Damage Negation', body: 'A successful Smash Attack negates ALL fall damage. Miss → you take it all. Aim well!' },
  { title: 'Crit Stacking', body: 'Sprint-jump + falling = guaranteed critical. Stack with Strength I/II potion for one-shot setups.' },
  { title: 'Durability', body: 'Mace base durability = 500. Smash attacks cost 2 durability per use. Mending strongly recommended.' },
];

export default function Guide() {
  const [section, setSection] = useState<Section>('mechanics');

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="guide-screen">
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat"
        style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <View style={styles.tabs}>
          {(['mechanics', 'enchants', 'tips', 'tier'] as Section[]).map((s) => (
            <TouchableOpacity
              key={s} testID={`guide-tab-${s}`}
              style={[styles.tab, section === s && styles.tabActive]}
              onPress={() => setSection(s)}
            >
              <Text style={[styles.tabText, section === s && styles.tabTextActive]}>
                {s === 'mechanics' ? 'MECH' : s === 'enchants' ? 'ENCH' : s === 'tips' ? 'TIPS' : 'TIER'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {section === 'mechanics' && (
            <View testID="guide-mechanics">
              <View style={styles.heroRow}>
                <Image source={theme.media.mace} style={styles.heroIcon} resizeMode="contain" />
                <Text style={styles.h1}>MACE MECHANICS</Text>
              </View>
              {MECHANICS.map((m, i) => (
                <View key={i} style={styles.card}>
                  <Text style={styles.cardTitle}>{m.title}</Text>
                  <Text style={styles.cardBody}>{m.body}</Text>
                </View>
              ))}
            </View>
          )}

          {section === 'enchants' && (
            <View testID="guide-enchants">
              <View style={styles.heroRow}>
                <Image source={{ uri: theme.media.book }} style={styles.heroIcon} resizeMode="contain" />
                <Text style={styles.h1}>ENCHANTMENTS</Text>
              </View>
              {ENCHANTS.map((e) => (
                <View key={e.name} style={styles.card} testID={`enchant-${e.name}`}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardTitle}>{e.name}</Text>
                    <View style={[styles.badge, { backgroundColor: e.color }]}>
                      <Text style={styles.badgeText}>{e.tier}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardBody}>{e.desc}</Text>
                </View>
              ))}
            </View>
          )}

          {section === 'tips' && (
            <View testID="guide-tips">
              <Text style={styles.h1}>PVP TIPS & COMBOS</Text>
              {TIPS.map((t, i) => (
                <View key={i} style={styles.tipRow}>
                  <Text style={styles.tipNum}>{String(i + 1).padStart(2, '0')}</Text>
                  <Text style={styles.tipBody}>{t}</Text>
                </View>
              ))}
            </View>
          )}

          {section === 'tier' && (
            <View testID="guide-tier">
              <View style={styles.heroRow}>
                <Image source={{ uri: theme.media.diamond }} style={styles.heroIcon} resizeMode="contain" />
                <Text style={styles.h1}>TIER LIST</Text>
              </View>
              {TIER_LIST.map((row) => (
                <View key={row.tier} style={styles.tierRow} testID={`tier-${row.tier}`}>
                  <View style={[styles.tierLabel, { backgroundColor: row.color }]}>
                    <Text style={styles.tierLabelText}>{row.tier}</Text>
                  </View>
                  <View style={styles.tierItems}>
                    {row.items.map((it) => (
                      <View key={it} style={styles.itemChip}>
                        <Text style={styles.itemChipText}>{it}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1, backgroundColor: theme.colors.bg },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.dirtDark,
    borderBottomColor: theme.colors.borderDark, borderBottomWidth: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRightColor: theme.colors.borderDark,
    borderRightWidth: 2 },
  tabActive: { backgroundColor: theme.colors.dirt },
  tabText: { fontFamily: theme.font, fontSize: 12, color: theme.colors.textSecondary,
    fontWeight: 'bold', letterSpacing: 1 },
  tabTextActive: { color: theme.colors.gold,
    textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 } },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  heroIcon: { width: 48, height: 48, marginRight: theme.spacing.md },
  h1: { fontFamily: theme.font, fontSize: 22, color: theme.colors.gold, fontWeight: 'bold',
    textTransform: 'uppercase', letterSpacing: 2,
    textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 } },
  card: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark,
    borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontFamily: theme.font, fontSize: 16, color: theme.colors.gold,
    fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  cardBody: { fontFamily: theme.font, fontSize: 13, color: theme.colors.text, lineHeight: 19 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderColor: '#000', borderWidth: 2 },
  badgeText: { fontFamily: theme.font, fontSize: 14, fontWeight: 'bold', color: '#000' },
  tipRow: { flexDirection: 'row', backgroundColor: theme.colors.obsidian,
    borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md,
    marginBottom: theme.spacing.sm, alignItems: 'center' },
  tipNum: { fontFamily: theme.font, fontSize: 24, color: theme.colors.gold, fontWeight: 'bold',
    marginRight: theme.spacing.md, minWidth: 36 },
  tipBody: { flex: 1, fontFamily: theme.font, fontSize: 13, color: theme.colors.text, lineHeight: 19 },
  tierRow: { flexDirection: 'row', marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 4 },
  tierLabel: { width: 60, alignItems: 'center', justifyContent: 'center' },
  tierLabelText: { fontFamily: theme.font, fontSize: 28, fontWeight: 'bold', color: '#000',
    textShadowColor: '#fff', textShadowOffset: { width: 1, height: 1 } },
  tierItems: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 6, gap: 6 },
  itemChip: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderLight,
    borderWidth: 2, paddingHorizontal: 8, paddingVertical: 6 },
  itemChipText: { fontFamily: theme.font, fontSize: 11, color: theme.colors.text },
});
