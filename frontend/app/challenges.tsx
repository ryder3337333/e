import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ImageBackground, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { HomeButton } from '@/src/components/HomeButton';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import { fxTap, fxSuccess, fxError } from '@/src/utils/fx';

type Challenge = {
  id: string; challenger_id: string; challenger_name: string;
  opponent_id: string; opponent_name: string; mode: string; server: string;
  message: string; status: 'pending' | 'accepted' | 'declined' | 'completed';
  winner_id?: string | null; created_at: string; responded_at?: string | null;
};

const MODES = ['Mace 1v1', 'Sumo', 'NoDebuff', 'Crystal PvP', 'Bridges'];
const SERVERS = ['Hypixel', 'MaceMC', 'PvPLand', 'MinemenClub'];

export default function Challenges() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [items, setItems] = useState<Challenge[]>([]);
  const [showSend, setShowSend] = useState(false);
  const [opp, setOpp] = useState('');
  const [mode, setMode] = useState(MODES[0]);
  const [server, setServer] = useState(SERVERS[0]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api<Challenge[]>(`/challenges?direction=${tab}`)); } catch (e) { console.warn(e); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (opp.trim().length < 2) return Alert.alert('Enter opponent username');
    setBusy(true);
    try {
      await api('/challenges', { method: 'POST', body: { opponent_username: opp.trim(), mode, server, message: msg } });
      setShowSend(false); setOpp(''); setMsg('');
      setTab('outgoing');
      await load();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
    setBusy(false);
  };

  const respond = async (cid: string, action: 'accept' | 'decline') => {
    try { await api(`/challenges/${cid}/${action}`, { method: 'POST', body: {} }); if (action === 'accept') fxSuccess(); else fxTap(); await load(); }
    catch (e: any) { fxError(); Alert.alert('Error', e?.message || 'Failed'); }
  };

  const setWinner = async (c: Challenge, winner_id: string) => {
    try { await api(`/challenges/${c.id}/complete`, { method: 'POST', body: { winner_id } }); fxSuccess(); await load(); }
    catch (e: any) { fxError(); Alert.alert('Error', e?.message || 'Failed'); }
  };

  const statusColor = (s: Challenge['status']) =>
    s === 'pending'   ? theme.colors.gold :
    s === 'accepted'  ? theme.colors.emerald :
    s === 'declined'  ? theme.colors.redstone :
    s === 'completed' ? theme.colors.diamond : theme.colors.textSecondary;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="challenges-screen">
      <Stack.Screen options={{ title: '1V1 CHALLENGES',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold, headerRight: () => <HomeButton /> }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <View style={styles.topBar}>
          {(['incoming', 'outgoing'] as const).map((t) => (
            <TouchableOpacity key={t} testID={`tab-${t}`} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabA]}>
              <Text style={[styles.tabTxt, tab === t && styles.tabTxtA]}>{t.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity testID="send-challenge" onPress={() => setShowSend(true)} style={styles.sendBtn}>
            <Ionicons name="flash" size={14} color="#000" />
            <Text style={styles.sendTxt}>SEND</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.empty}>No {tab} challenges.</Text>}
          renderItem={({ item }) => {
            const isIncoming = item.opponent_id === user?.id;
            const other = isIncoming ? item.challenger_name : item.opponent_name;
            const youWon = item.status === 'completed' && item.winner_id === user?.id;
            return (
              <View style={styles.card} testID={`challenge-${item.id}`}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.versus}>{isIncoming ? 'FROM' : 'TO'}  {other.toUpperCase()}</Text>
                    <Text style={styles.modeLine}>{item.mode}  ·  {item.server}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: statusColor(item.status) }]}>
                    <Text style={styles.statusTxt}>{item.status.toUpperCase()}</Text>
                  </View>
                </View>
                {item.message ? <Text style={styles.msg}>“{item.message}”</Text> : null}
                {item.status === 'pending' && isIncoming && (
                  <View style={styles.row}>
                    <TouchableOpacity testID={`accept-${item.id}`} onPress={() => respond(item.id, 'accept')} style={[styles.actionBtn, { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emeraldDark }]}>
                      <Text style={styles.actionTxt}>ACCEPT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID={`decline-${item.id}`} onPress={() => respond(item.id, 'decline')} style={[styles.actionBtn, { backgroundColor: theme.colors.redstone, borderColor: '#9b1c1c' }]}>
                      <Text style={styles.actionTxt}>DECLINE</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {item.status === 'accepted' && (
                  <View style={styles.row}>
                    <TouchableOpacity testID={`won-${item.id}`} onPress={() => setWinner(item, user!.id)} style={[styles.actionBtn, { backgroundColor: theme.colors.gold, borderColor: '#8b5a2b' }]}>
                      <Text style={[styles.actionTxt, { color: '#000' }]}>I WON</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID={`lost-${item.id}`} onPress={() => setWinner(item, isIncoming ? item.challenger_id : item.opponent_id)} style={[styles.actionBtn, { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark }]}>
                      <Text style={styles.actionTxt}>I LOST</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {item.status === 'completed' && (
                  <Text style={[styles.outcome, { color: youWon ? theme.colors.gold : theme.colors.redstone }]}>
                    {youWon ? '★ VICTORY' : '☠ DEFEAT'}
                  </Text>
                )}
              </View>
            );
          }}
        />

        <Modal visible={showSend} transparent animationType="fade" onRequestClose={() => setShowSend(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.modalCard} testID="send-modal">
                <Text style={styles.modalTitle}>CHALLENGE A PLAYER</Text>
                <Text style={styles.label}>OPPONENT USERNAME</Text>
                <TextInput testID="opp-input" value={opp} onChangeText={setOpp} placeholder="e.g. SteveDiamond" placeholderTextColor={theme.colors.textSecondary} style={styles.input} autoCapitalize="none" />
                <Text style={styles.label}>MODE</Text>
                <View style={styles.chips}>{MODES.map((m) => (
                  <TouchableOpacity key={m} onPress={() => setMode(m)} style={[styles.chip, mode === m && styles.chipA]} testID={`mode-${m}`}>
                    <Text style={[styles.chipTxt, mode === m && { color: '#fff' }]}>{m}</Text>
                  </TouchableOpacity>
                ))}</View>
                <Text style={styles.label}>SERVER</Text>
                <View style={styles.chips}>{SERVERS.map((s) => (
                  <TouchableOpacity key={s} onPress={() => setServer(s)} style={[styles.chip, server === s && styles.chipA]} testID={`srv-${s}`}>
                    <Text style={[styles.chipTxt, server === s && { color: '#fff' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}</View>
                <Text style={styles.label}>TRASH TALK (OPTIONAL)</Text>
                <TextInput testID="msg-input" value={msg} onChangeText={setMsg} placeholder="Get rekt noob" placeholderTextColor={theme.colors.textSecondary} multiline style={[styles.input, { height: 70, textAlignVertical: 'top' }]} maxLength={200} />
                <View style={styles.modalActions}>
                  <TouchableOpacity onPress={() => setShowSend(false)} style={[styles.modalBtn, { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark }]} testID="cancel-send">
                    <Text style={styles.modalBtnTxt}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={send} disabled={busy} style={[styles.modalBtn, { backgroundColor: theme.colors.redstone, borderColor: '#9b1c1c', opacity: busy ? 0.6 : 1 }]} testID="confirm-send">
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnTxt}>FIRE!</Text>}
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
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: theme.spacing.md, backgroundColor: theme.colors.dirtDark, borderBottomColor: theme.colors.borderDark, borderBottomWidth: 4 },
  tab: { backgroundColor: theme.colors.bgDark, borderColor: theme.colors.borderDark, borderWidth: 2, paddingHorizontal: 12, paddingVertical: 6 },
  tabA: { backgroundColor: theme.colors.emeraldDark, borderColor: theme.colors.emerald },
  tabTxt: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, fontWeight: 'bold' },
  tabTxtA: { color: '#fff' },
  sendBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.gold, borderColor: '#8b5a2b', borderWidth: 2, borderBottomWidth: 4, paddingHorizontal: 10, paddingVertical: 6 },
  sendTxt: { fontFamily: theme.font, fontSize: 11, color: '#000', fontWeight: 'bold' },
  empty: { fontFamily: theme.font, color: theme.colors.textSecondary, textAlign: 'center', padding: 16 },
  card: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  versus: { fontFamily: theme.font, fontSize: 14, color: theme.colors.gold, fontWeight: 'bold', letterSpacing: 1 },
  modeLine: { fontFamily: theme.font, fontSize: 11, color: theme.colors.diamond, marginTop: 2 },
  statusPill: { borderColor: '#000', borderWidth: 2, paddingHorizontal: 6, paddingVertical: 3 },
  statusTxt: { fontFamily: theme.font, fontSize: 9, color: '#000', fontWeight: 'bold', letterSpacing: 1 },
  msg: { fontFamily: theme.font, fontSize: 12, color: theme.colors.text, marginTop: 8, fontStyle: 'italic' },
  row: { flexDirection: 'row', gap: 6, marginTop: 10 },
  actionBtn: { flex: 1, borderWidth: 2, borderBottomWidth: 4, paddingVertical: 8, alignItems: 'center' },
  actionTxt: { fontFamily: theme.font, fontSize: 11, color: '#fff', fontWeight: 'bold', letterSpacing: 1 },
  outcome: { fontFamily: theme.font, fontSize: 14, fontWeight: 'bold', marginTop: 8, textAlign: 'center', letterSpacing: 2 },
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
