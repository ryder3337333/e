import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ImageBackground, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';

// Smash damage formula (Mojang 1.21):
// base = 6 (mace base) + density*0.5*fall  +  fallBonus(fall)
// fallBonus: blocks 1-3 → +4/blk; 4-8 → +2/blk; 9+ → +1/blk
// Strength I → +3 melee; Strength II → +6
// Breach reduces armor effectiveness by 0.15 per level (clamped 0..1)

function smashDamage(fall: number, density: number, strength: number) {
  const f = Math.max(0, fall);
  let bonus = 0;
  bonus += Math.min(f, 3) * 4;
  if (f > 3) bonus += Math.min(f - 3, 5) * 2;
  if (f > 8) bonus += (f - 8) * 1;
  const dens = density * 0.5 * f;
  return 6 + dens + bonus + strength;
}

function applyArmor(dmg: number, armorPts: number, breach: number) {
  const reduction = Math.min(20, armorPts) * 0.04; // 4% per point, capped
  const effective = Math.max(0, reduction * (1 - breach * 0.15));
  return dmg * (1 - effective);
}

export default function DPSCalc() {
  const router = useRouter();
  const [fall, setFall] = useState('15');
  const [density, setDensity] = useState('5');
  const [breach, setBreach] = useState('4');
  const [strength, setStrength] = useState('0');
  const [armor, setArmor] = useState('20');

  const result = useMemo(() => {
    const f = parseFloat(fall) || 0;
    const d = parseFloat(density) || 0;
    const b = parseFloat(breach) || 0;
    const s = parseFloat(strength) || 0;
    const a = parseFloat(armor) || 0;
    const raw = smashDamage(f, d, s);
    const final = applyArmor(raw, a, b);
    const hearts = final / 2;
    return { raw: raw.toFixed(1), final: final.toFixed(1), hearts: hearts.toFixed(1) };
  }, [fall, density, breach, strength, armor]);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="dps-screen">
      <Stack.Screen options={{
        title: 'DPS CALC',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold,
      }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heroRow}>
            <Image source={theme.media.mace} style={styles.heroIcon} resizeMode="contain" />
            <Text style={styles.h1}>SMASH DAMAGE</Text>
          </View>

          <View style={styles.card}>
            <Field label="Fall Distance (blocks)" value={fall} onChange={setFall} testID="fall-input" />
            <Field label="Density Level (0–5)" value={density} onChange={setDensity} testID="density-input" />
            <Field label="Breach Level (0–4)" value={breach} onChange={setBreach} testID="breach-input" />
            <Field label="Strength Bonus (+0/+3/+6)" value={strength} onChange={setStrength} testID="strength-input" />
            <Field label="Target Armor Points (0–20)" value={armor} onChange={setArmor} testID="armor-input" />
          </View>

          <View style={styles.resultCard} testID="dps-result">
            <Text style={styles.resultLabel}>RAW DAMAGE</Text>
            <Text style={styles.resultRaw}>{result.raw}</Text>
            <View style={styles.divider} />
            <Text style={styles.resultLabel}>VS TARGET</Text>
            <Text style={styles.resultFinal}>{result.final}</Text>
            <Text style={styles.hearts}>≈ {result.hearts} ❤</Text>
          </View>

          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={16} color="#fff" />
            <Text style={styles.backTxt}>BACK</Text>
          </TouchableOpacity>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, testID }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  heroIcon: { width: 48, height: 48, marginRight: theme.spacing.md },
  h1: { fontFamily: theme.font, fontSize: 22, color: theme.colors.gold, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2 },
  card: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  fieldLabel: { fontFamily: theme.font, fontSize: 11, color: theme.colors.gold, marginBottom: 4, textTransform: 'uppercase' },
  input: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 4, color: theme.colors.text, padding: 10, fontSize: 16, fontFamily: theme.font },
  resultCard: { backgroundColor: theme.colors.nether, borderColor: '#2a0808', borderWidth: 4, padding: theme.spacing.lg, alignItems: 'center' },
  resultLabel: { fontFamily: theme.font, fontSize: 12, color: theme.colors.textSecondary, textTransform: 'uppercase' },
  resultRaw: { fontFamily: theme.font, fontSize: 32, color: theme.colors.diamond, fontWeight: 'bold', marginVertical: 4 },
  resultFinal: { fontFamily: theme.font, fontSize: 44, color: theme.colors.gold, fontWeight: 'bold', marginVertical: 4 },
  hearts: { fontFamily: theme.font, fontSize: 18, color: theme.colors.redstone, marginTop: 4 },
  divider: { width: '60%', height: 2, backgroundColor: theme.colors.borderDark, marginVertical: 12 },
  backBtn: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, backgroundColor: theme.colors.stone, borderColor: theme.colors.borderDark, borderWidth: 4, borderBottomWidth: 6, paddingHorizontal: 24, paddingVertical: 10, marginTop: theme.spacing.lg },
  backTxt: { fontFamily: theme.font, fontSize: 13, color: '#fff', fontWeight: 'bold', textTransform: 'uppercase' },
});
