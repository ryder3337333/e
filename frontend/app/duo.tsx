import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ImageBackground, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';

type Row = {
  id: string; user_id: string; username: string;
  mode: string; region: string; skill: string; message: string;
  elo: number; kdr: number; created_at: string;
};

const MODES = ['Ranked Duos', 'Casual', 'Practice', 'Tournament Prep'];
const REGIONS = ['NA', 'EU', 'AS', 'OCE'] as const;
const SKILLS = ['any', 'bronze', 'silver', 'gold', 'diamond'] as const;

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export default function Duo() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [mine, setMine] = useState<Row | null>(null);
  const [filter, setFilter] = useState<'ALL' | typeof REGIONS[number]>('ALL');
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState(MODES[0]);
  const [region, setRegion] = useState<typeof REGIONS[number]>('NA');
  const [skill, setSkill] = useState<typeof SKILLS[number]>('any');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = filter === 'ALL' ? '' : `?region=${filter}`;
      const [list, my] = await Promise.all([
        api<Row[]>(`/duo${qs}`, { auth: false }),
        api<Row | null>('/duo/mine'),
      ]);
      setRows(list); setMine(my);
    } catch (e) { console.warn(e); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const post = async () => {
    setBusy(true);
    try {
      await api('/duo', { method: 'POST', body: { mode, region, skill, message: msg } });
      setShow(false); setMsg('');
      await load();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
    setBusy(false);
  };

  const cancel = async () => {
    try { await api('/duo', { method: 'DELETE' }); await load(); }
    catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
  };

  const skillColor = (s: string) =>
    s === 'diamond' ? theme.colors.diamond :
    s === 'gold'    ? theme.colors.gold :
    s === 'silver'  ? '#c4c4c4' :
    s === 'bronze'  ? '#cd7f32' :
                      theme.colors.textSecondary;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="duo-screen">
      <Stack.Screen options={{ title: 'FIND A DUO',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        {mine ? (
          <View style={styles.activeCard} testID="my-duo">
            <View style={{ flex: 1 }}>
              <Text style={styles.activeLabel}>★ YOU’RE IN THE QUEUE</Text>
              <Text style={styles.activeMode}>{mine.mode}  ·  {mine.region}  ·  {mine.skill.toUpperCase()}</Text>
              <Text style={styles.activeMeta}>Posted {timeAgo(mine.created_at)}</Text>
            </View>
            <TouchableOpacity testID="cancel-duo" onPress={cancel} style={styles.cancelBtn}>
              <Ionicons name="close" size={16} color="#fff" />
              <Text style={styles.cancelTxt}>LEAVE</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity testID="post-duo" onPress={() => setShow(true)} style={styles.ctaBtn}>
            <Ionicons name="people" size={18} color="#000" />
            <Text style={styles.ctaTxt}>POST A LFG REQUEST</Text>
          </TouchableOpacity>
        )}

        <View style={styles.tabs}>
          {(['ALL', ...REGIONS] as const).map((r) => (
            <TouchableOpacity key={r} testID={`filter-${r}`} onPress={() => setFilter(r)} style={[styles.tab, filter === r && styles.tabA]}>
              <Text style={[styles.tabTxt, filter === r && styles.tabTxtA]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.empty}>Nobody in queue yet — post the first LFG!</Text>}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`duo-${item.id}`}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.username}{item.user_id === user?.id ? '  (you)' : ''}</Text>
                  <Text style={styles.modeTxt}>{item.mode}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.skillPill, { color: skillColor(item.skill) }]}>{item.skill.toUpperCase()}</Text>
                  <Text style={styles.region}>{item.region}</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>ELO {item.elo}</Text>
                <Text style={styles.meta}>K/D {item.kdr.toFixed(2)}</Text>
                <Text style={[styles.meta, { marginLeft: 'auto' }]}>{timeAgo(item.created_at)}</Text>
              </View>
              {item.message ? <Text style={styles.msg}>“{item.message}”</Text> : null}
            </View>
          )}
        />

        <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.modalCard} testID="duo-modal">
                <Text style={styles.modalTitle}>POST A DUO REQUEST</Text>
                <Text style={styles.label}>MODE</Text>
                <View style={styles.chips}>{MODES.map((m) => (
                  <TouchableOpacity key={m} onPress={() => setMode(m)} style={[styles.chip, mode === m && styles.chipA]} testID={`dmode-${m}`}>
                    <Text style={[styles.chipTxt, mode === m && { color: '#fff' }]}>{m}</Text>
                  </TouchableOpacity>
                ))}</View>
                <Text style={styles.label}>REGION</Text>
                <View style={styles.chips}>{REGIONS.map((r) => (
                  <TouchableOpacity key={r} onPress={() => setRegion(r)} style={[styles.chip, region === r && styles.chipA]} testID={`dregion-${r}`}>
                    <Text style={[styles.chipTxt, region === r && { color: '#fff' }]}>{r}</Text>
                  </TouchableOpacity>
                ))}</View>
                <Text style={styles.label}>SKILL TIER</Text>
                <View style={styles.chips}>{SKILLS.map((s) => (
                  <TouchableOpacity key={s} onPress={() => setSkill(s)} style={[styles.chip, skill === s && styles.chipA]} testID={`dskill-${s}`}>
                    <Text style={[styles.chipTxt, skill === s && { color: '#fff' }]}>{s.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}</View>
                <Text style={styles.label}>MESSAGE (OPTIONAL)</Text>
                <TextInput testID="duo-msg" value={msg} onChangeText={setMsg} placeholder="Looking for someone with totem stack..." placeholderTextColor={theme.colors.textSecondary} multiline style={[styles.input, { height: 70, textAlignVertical: 'top' }]} maxLength={200} />
                <View style={styles.modalActions}>
                  <TouchableOpacity onPress={() => setShow(false)} style={[styles.modalBtn, { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark }]} testID="cancel-post">
                    <Text style={styles.modalBtnTxt}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={post} disabled={busy} style={[styles.modalBtn, { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emeraldDark, opacity: busy ? 0.6 : 1 }]} testID="confirm-post">
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnTxt}>POST</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  activeCard: { margin: theme.spacing.md, marginBottom: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.dirtDark, borderColor: theme.colors.gold, borderWidth: 4, padding: theme.spacing.md },
  activeLabel: { fontFamily: theme.font, fontSize: 10, color: theme.colors.gold, letterSpacing: 1 },
  activeMode: { fontFamily: theme.font, fontSize: 14, color: theme.colors.text, fontWeight: 'bold', marginTop: 4 },
  activeMeta: { fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary, marginTop: 4 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.redstone, borderColor: '#9b1c1c', borderWidth: 2, borderBottomWidth: 4, paddingHorizontal: 10, paddingVertical: 6 },
  cancelTxt: { fontFamily: theme.font, fontSize: 11, color: '#fff', fontWeight: 'bold' },
  ctaBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, margin: theme.spacing.md, marginBottom: 0, backgroundColor: theme.colors.emerald, borderColor: theme.colors.emeraldDark, borderWidth: 4, borderBottomWidth: 8, paddingVertical: 14 },
  ctaTxt: { fontFamily: theme.font, fontSize: 14, color: '#000', fontWeight: 'bold', letterSpacing: 2 },
  tabs: { flexDirection: 'row', gap: 6, padding: theme.spacing.md, paddingBottom: 0, flexWrap: 'wrap' },
  tab: { backgroundColor: theme.colors.bgDark, borderColor: theme.colors.borderDark, borderWidth: 2, paddingHorizontal: 12, paddingVertical: 6 },
  tabA: { backgroundColor: theme.colors.emeraldDark, borderColor: theme.colors.emerald },
  tabTxt: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, fontWeight: 'bold' },
  tabTxtA: { color: '#fff' },
  empty: { fontFamily: theme.font, color: theme.colors.textSecondary, textAlign: 'center', padding: 16 },
  card: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  name: { fontFamily: theme.font, fontSize: 15, color: theme.colors.gold, fontWeight: 'bold', textTransform: 'uppercase' },
  modeTxt: { fontFamily: theme.font, fontSize: 12, color: theme.colors.diamond, marginTop: 2 },
  skillPill: { fontFamily: theme.font, fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  region: { fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary, marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  meta: { fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary, letterSpacing: 1 },
  msg: { fontFamily: theme.font, fontSize: 12, color: theme.colors.text, marginTop: 8, fontStyle: 'italic' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' },
  modalScroll: { padding: theme.spacing.md, justifyContent: 'center', flexGrow: 1 },
  modalCard: { backgroundColor: theme.colors.dirtDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md },
  modalTitle: { fontFamily: theme.font, fontSize: 16, color: theme.colors.gold, fontWeight: 'bold', textAlign: 'center', letterSpacing: 1, marginBottom: 12 },
  label: { fontFamily: theme.font, fontSize: 11, color: theme.colors.gold, marginTop: 6, marginBottom: 4, letterSpacing: 1 },
  input: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 4, color: theme.colors.text, padding: 10, fontSize: 13, fontFamily: theme.font },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: theme.colors.bgDark, borderColor: theme.colors.borderDark, borderWidth: 2, paddingHorizontal: 10, paddingVertical: 6 },
  chipA: { backgroundColor: theme.colors.emeraldDark, borderColor: theme.colors.emerald },
  chipTxt: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, fontWeight: 'bold' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  modalBtn: { flex: 1, borderWidth: 4, borderBottomWidth: 6, paddingVertical: 12, alignItems: 'center' },
  modalBtnTxt: { fontFamily: theme.font, fontSize: 13, color: '#fff', fontWeight: 'bold', letterSpacing: 1 },
});
