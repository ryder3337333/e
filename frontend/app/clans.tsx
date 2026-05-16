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

type Clan = {
  id: string; name: string; tag: string; description: string;
  leader_id: string; leader_name: string; member_count: number; avg_elo: number;
  is_member: boolean; created_at: string;
};
type Member = { user_id: string; username: string; role: string; elo: number; kdr: number; joined_at: string };

export default function Clans() {
  const { user } = useAuth();
  const [clans, setClans] = useState<Clan[]>([]);
  const [mine, setMine] = useState<Clan | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [desc, setDesc] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, my] = await Promise.all([
        api<Clan[]>('/clans', { auth: false }),
        api<Clan | null>('/clans/mine'),
      ]);
      setClans(list);
      setMine(my);
      if (my) {
        const detail = await api<{ clan: Clan; members: Member[] }>(`/clans/${my.id}`);
        setMembers(detail.members);
      } else {
        setMembers([]);
      }
    } catch (e) { console.warn(e); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submitCreate = async () => {
    if (name.trim().length < 3) return Alert.alert('Name too short', '3+ chars');
    if (!/^[A-Z0-9]{2,5}$/.test(tag.toUpperCase())) return Alert.alert('Tag invalid', '2-5 uppercase letters/digits');
    setBusy(true);
    try {
      await api('/clans', { method: 'POST', body: { name: name.trim(), tag: tag.toUpperCase(), description: desc } });
      setShowCreate(false); setName(''); setTag(''); setDesc('');
      await load();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
    setBusy(false);
  };

  const join = async (id: string) => {
    try { await api(`/clans/${id}/join`, { method: 'POST', body: {} }); await load(); }
    catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
  };
  const leave = async () => {
    if (!mine) return;
    try { await api(`/clans/${mine.id}/leave`, { method: 'DELETE' }); await load(); }
    catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="clans-screen">
      <Stack.Screen options={{ title: 'CLANS',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold, headerRight: () => <HomeButton /> }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <FlatList
          data={clans}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              {mine ? (
                <View style={styles.mineCard} testID="my-clan">
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mineTag}>[{mine.tag}]</Text>
                      <Text style={styles.mineName}>{mine.name}</Text>
                      <Text style={styles.mineMeta}>{mine.member_count} · AVG ELO {mine.avg_elo}</Text>
                    </View>
                    <TouchableOpacity testID="leave-clan" onPress={leave} style={styles.leaveBtn}>
                      <Ionicons name="exit" size={14} color="#fff" />
                      <Text style={styles.leaveTxt}>LEAVE</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.memberH}>MEMBERS</Text>
                  {members.map((m) => (
                    <View key={m.user_id} style={styles.memberRow} testID={`member-${m.user_id}`}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{m.username}{m.user_id === user?.id ? '  (you)' : ''}</Text>
                        <Text style={styles.memberMeta}>{m.role.toUpperCase()} · ELO {m.elo} · K/D {m.kdr.toFixed(2)}</Text>
                      </View>
                      {m.role === 'leader' && <Ionicons name="star" size={16} color={theme.colors.gold} />}
                    </View>
                  ))}
                </View>
              ) : (
                <TouchableOpacity testID="create-clan-btn" onPress={() => setShowCreate(true)} style={styles.ctaBtn}>
                  <Ionicons name="add-circle" size={18} color="#000" />
                  <Text style={styles.ctaTxt}>FOUND A NEW CLAN</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.sectionH}>ALL CLANS</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>No clans yet — be the first to found one.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`clan-${item.id}`}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tagTxt}>[{item.tag}]</Text>
                  <Text style={styles.nameTxt}>{item.name}</Text>
                  {item.description ? <Text style={styles.descTxt}>{item.description}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metaValue}>{item.member_count}</Text>
                  <Text style={styles.metaLabel}>MEMBERS</Text>
                  <Text style={[styles.metaValue, { color: theme.colors.gold, marginTop: 6 }]}>{item.avg_elo}</Text>
                  <Text style={styles.metaLabel}>AVG ELO</Text>
                </View>
              </View>
              <Text style={styles.leaderLine}>★ LED BY {item.leader_name.toUpperCase()}</Text>
              {!mine && !item.is_member && (
                <TouchableOpacity testID={`join-${item.id}`} onPress={() => join(item.id)} style={styles.joinBtn}>
                  <Text style={styles.joinTxt}>JOIN CLAN</Text>
                </TouchableOpacity>
              )}
              {item.is_member && (
                <View style={[styles.joinBtn, { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark }]}>
                  <Text style={[styles.joinTxt, { color: theme.colors.emerald }]}>✓ YOUR CLAN</Text>
                </View>
              )}
            </View>
          )}
        />

        <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.modalCard} testID="create-clan-modal">
                <Text style={styles.modalTitle}>FOUND A NEW CLAN</Text>
                <Text style={styles.label}>CLAN NAME (3-24)</Text>
                <TextInput testID="clan-name" value={name} onChangeText={setName} placeholder="NetheriteBros" placeholderTextColor={theme.colors.textSecondary} style={styles.input} maxLength={24} />
                <Text style={styles.label}>TAG (2-5, A-Z 0-9)</Text>
                <TextInput testID="clan-tag" value={tag} onChangeText={(v) => setTag(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="NB" placeholderTextColor={theme.colors.textSecondary} style={styles.input} maxLength={5} autoCapitalize="characters" />
                <Text style={styles.label}>DESCRIPTION</Text>
                <TextInput testID="clan-desc" value={desc} onChangeText={setDesc} placeholder="What's your clan about?" placeholderTextColor={theme.colors.textSecondary} multiline style={[styles.input, { height: 80, textAlignVertical: 'top' }]} maxLength={200} />
                <View style={styles.modalActions}>
                  <TouchableOpacity testID="cancel-create" onPress={() => setShowCreate(false)} style={[styles.modalBtn, { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark }]}>
                    <Text style={styles.modalBtnTxt}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="confirm-create" onPress={submitCreate} disabled={busy} style={[styles.modalBtn, { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emeraldDark, opacity: busy ? 0.6 : 1 }]}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnTxt}>CREATE</Text>}
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
  mineCard: { backgroundColor: theme.colors.dirtDark, borderColor: theme.colors.gold, borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mineTag: { fontFamily: theme.font, fontSize: 14, color: theme.colors.gold, letterSpacing: 2, fontWeight: 'bold' },
  mineName: { fontFamily: theme.font, fontSize: 18, color: theme.colors.text, fontWeight: 'bold', textTransform: 'uppercase' },
  mineMeta: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  leaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.redstone, borderColor: '#9b1c1c', borderWidth: 2, borderBottomWidth: 4, paddingHorizontal: 10, paddingVertical: 6 },
  leaveTxt: { fontFamily: theme.font, fontSize: 11, color: '#fff', fontWeight: 'bold' },
  memberH: { fontFamily: theme.font, fontSize: 11, color: theme.colors.gold, marginTop: 12, marginBottom: 6, letterSpacing: 1 },
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 2, padding: 8, marginBottom: 4 },
  memberName: { fontFamily: theme.font, fontSize: 13, color: theme.colors.text, fontWeight: 'bold' },
  memberMeta: { fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.gold, borderColor: '#8b5a2b', borderWidth: 4, borderBottomWidth: 8, paddingVertical: 14, marginBottom: theme.spacing.md },
  ctaTxt: { fontFamily: theme.font, fontSize: 14, color: '#000', fontWeight: 'bold', letterSpacing: 2 },
  sectionH: { fontFamily: theme.font, fontSize: 12, color: theme.colors.gold, letterSpacing: 1, marginBottom: 8 },
  empty: { fontFamily: theme.font, color: theme.colors.textSecondary, textAlign: 'center', padding: 16 },
  card: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  tagTxt: { fontFamily: theme.font, fontSize: 12, color: theme.colors.diamond, letterSpacing: 2, fontWeight: 'bold' },
  nameTxt: { fontFamily: theme.font, fontSize: 16, color: theme.colors.gold, fontWeight: 'bold', textTransform: 'uppercase' },
  descTxt: { fontFamily: theme.font, fontSize: 11, color: theme.colors.text, marginTop: 4, lineHeight: 16 },
  metaValue: { fontFamily: theme.font, fontSize: 18, color: theme.colors.emerald, fontWeight: 'bold' },
  metaLabel: { fontFamily: theme.font, fontSize: 9, color: theme.colors.textSecondary, letterSpacing: 1 },
  leaderLine: { fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary, marginTop: 8, letterSpacing: 1 },
  joinBtn: { backgroundColor: theme.colors.lapis, borderColor: '#22229a', borderWidth: 2, borderBottomWidth: 4, paddingVertical: 8, alignItems: 'center', marginTop: 8 },
  joinTxt: { fontFamily: theme.font, fontSize: 11, color: '#fff', fontWeight: 'bold', letterSpacing: 2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center' },
  modalScroll: { padding: theme.spacing.md, justifyContent: 'center', flexGrow: 1 },
  modalCard: { backgroundColor: theme.colors.dirtDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md },
  modalTitle: { fontFamily: theme.font, fontSize: 16, color: theme.colors.gold, fontWeight: 'bold', textAlign: 'center', letterSpacing: 1, marginBottom: 12 },
  label: { fontFamily: theme.font, fontSize: 11, color: theme.colors.gold, marginTop: 6, marginBottom: 4, letterSpacing: 1 },
  input: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 4, color: theme.colors.text, padding: 10, fontSize: 13, fontFamily: theme.font },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  modalBtn: { flex: 1, borderWidth: 4, borderBottomWidth: 6, paddingVertical: 12, alignItems: 'center' },
  modalBtnTxt: { fontFamily: theme.font, fontSize: 13, color: '#fff', fontWeight: 'bold', letterSpacing: 1 },
});
