import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ImageBackground,
  KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme, API_URL } from '@/src/theme';
import { getDeviceId } from '@/src/device';

const ENCHANT_OPTIONS = ['Density V', 'Breach IV', 'Wind Burst III', 'Smite V', 'Unbreaking III', 'Mending', 'Fire Aspect II'];
const ARMOR_OPTIONS = ['Netherite Helmet', 'Netherite Chestplate', 'Netherite Leggings', 'Feather Falling IV Boots', 'Diamond Helmet', 'Elytra'];

type Loadout = { id: string; name: string; enchantments: string[]; armor: string[]; notes?: string };

export default function LoadoutScreen() {
  const [deviceId, setDeviceId] = useState('');
  const [loadouts, setLoadouts] = useState<Loadout[]>([]);
  const [name, setName] = useState('');
  const [ench, setEnch] = useState<string[]>([]);
  const [armor, setArmor] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const load = useCallback(async (id: string) => {
    try {
      const r = await fetch(`${API_URL}/loadouts?device_id=${id}`);
      setLoadouts(await r.json());
    } catch (e) { console.warn(e); }
  }, []);

  useEffect(() => {
    (async () => {
      const id = await getDeviceId();
      setDeviceId(id);
      await load(id);
    })();
  }, [load]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, item: string) => {
    setArr(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter a build name.');
      return;
    }
    try {
      const r = await fetch(`${API_URL}/loadouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, name: name.trim(), enchantments: ench, armor, notes }),
      });
      if (!r.ok) throw new Error('save failed');
      setName(''); setEnch([]); setArmor([]); setNotes('');
      await load(deviceId);
    } catch (e) { Alert.alert('Error', String(e)); }
  };

  const remove = async (id: string) => {
    await fetch(`${API_URL}/loadouts/${id}`, { method: 'DELETE' });
    await load(deviceId);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="loadout-screen">
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat"
        style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.heroRow}>
              <Image source={{ uri: theme.media.mace }} style={styles.heroIcon} resizeMode="contain" />
              <Text style={styles.h1}>LOADOUT FORGE</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardHeader}>NEW BUILD</Text>
              <TextInput
                testID="loadout-name-input"
                value={name}
                onChangeText={setName}
                placeholder="BUILD NAME"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.input}
              />
              <Text style={styles.subHeader}>ENCHANTMENTS</Text>
              <View style={styles.chips}>
                {ENCHANT_OPTIONS.map((e) => (
                  <TouchableOpacity key={e} testID={`ench-${e}`}
                    onPress={() => toggle(ench, setEnch, e)}
                    style={[styles.chip, ench.includes(e) && styles.chipActive]}>
                    <Text style={[styles.chipText, ench.includes(e) && styles.chipTextActive]}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.subHeader}>ARMOR</Text>
              <View style={styles.chips}>
                {ARMOR_OPTIONS.map((a) => (
                  <TouchableOpacity key={a} testID={`armor-${a}`}
                    onPress={() => toggle(armor, setArmor, a)}
                    style={[styles.chip, armor.includes(a) && styles.chipActive]}>
                    <Text style={[styles.chipText, armor.includes(a) && styles.chipTextActive]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                testID="loadout-notes-input"
                value={notes}
                onChangeText={setNotes}
                placeholder="NOTES (combos, server, etc.)"
                placeholderTextColor={theme.colors.textSecondary}
                style={[styles.input, { marginTop: 12, height: 70 }]}
                multiline
              />
              <TouchableOpacity testID="save-loadout-btn" onPress={save} style={styles.saveBtn}>
                <Text style={styles.saveTxt}>SAVE BUILD</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionHeader}>YOUR BUILDS ({loadouts.length})</Text>
            {loadouts.length === 0 && (
              <Text style={styles.empty}>No builds yet — forge your first one above.</Text>
            )}
            {loadouts.map((l) => (
              <View key={l.id} style={styles.buildCard} testID={`build-${l.id}`}>
                <View style={styles.cardHead}>
                  <Text style={styles.buildTitle}>{l.name}</Text>
                  <TouchableOpacity testID={`delete-${l.id}`} onPress={() => remove(l.id)}>
                    <Ionicons name="trash" size={20} color={theme.colors.redstone} />
                  </TouchableOpacity>
                </View>
                {l.enchantments.length > 0 && (
                  <View style={styles.tagRow}>
                    {l.enchantments.map((e) => (
                      <View key={e} style={[styles.tag, { backgroundColor: theme.colors.lapis }]}>
                        <Text style={styles.tagText}>{e}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {l.armor.length > 0 && (
                  <View style={styles.tagRow}>
                    {l.armor.map((a) => (
                      <View key={a} style={[styles.tag, { backgroundColor: theme.colors.dirt }]}>
                        <Text style={styles.tagText}>{a}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {l.notes ? <Text style={styles.notes}>{l.notes}</Text> : null}
              </View>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  heroIcon: { width: 40, height: 40, marginRight: theme.spacing.md },
  h1: { fontFamily: theme.font, fontSize: 20, fontWeight: 'bold', color: theme.colors.gold,
    textTransform: 'uppercase', letterSpacing: 2 },
  card: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark,
    borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  cardHeader: { fontFamily: theme.font, fontSize: 14, color: theme.colors.gold,
    fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
  subHeader: { fontFamily: theme.font, fontSize: 12, color: theme.colors.text,
    marginTop: 12, marginBottom: 6, fontWeight: 'bold' },
  input: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark,
    borderWidth: 4, color: theme.colors.text, padding: 12, fontSize: 14, fontFamily: theme.font },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: theme.colors.bgDark, borderColor: theme.colors.borderDark,
    borderWidth: 2, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: theme.colors.emeraldDark, borderColor: theme.colors.emerald },
  chipText: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: 'bold' },
  saveBtn: { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emeraldDark,
    borderWidth: 4, borderBottomWidth: 8, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  saveTxt: { fontFamily: theme.font, fontSize: 14, fontWeight: 'bold', color: '#fff',
    textTransform: 'uppercase', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 } },
  sectionHeader: { fontFamily: theme.font, fontSize: 14, color: theme.colors.gold,
    fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
  empty: { fontFamily: theme.font, color: theme.colors.textSecondary, textAlign: 'center',
    padding: 16 },
  buildCard: { backgroundColor: theme.colors.dirtDark, borderColor: theme.colors.borderDark,
    borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  buildTitle: { fontFamily: theme.font, fontSize: 16, color: theme.colors.gold,
    fontWeight: 'bold', textTransform: 'uppercase' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderColor: '#000', borderWidth: 2 },
  tagText: { fontFamily: theme.font, fontSize: 10, color: '#fff', fontWeight: 'bold' },
  notes: { fontFamily: theme.font, fontSize: 12, color: theme.colors.textSecondary,
    marginTop: 8, fontStyle: 'italic' },
});
