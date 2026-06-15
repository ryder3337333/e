import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ImageBackground, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { HomeButton } from '@/src/components/HomeButton';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import { fxTap, fxSuccess, fxError } from '@/src/utils/fx';

type ModUser = {
  id: string; username: string; email: string;
  is_banned: boolean; muted_until?: string | null;
  is_admin: boolean; created_at: string;
};

const QUICK_MUTES = [
  { label: '10m', minutes: 10 },
  { label: '1h',  minutes: 60 },
  { label: '24h', minutes: 60 * 24 },
  { label: '7d',  minutes: 60 * 24 * 7 },
  { label: 'PERM', minutes: 0 },
];

function timeLeft(iso?: string | null): string {
  if (!iso) return '';
  try {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return '';
    if (ms > 1000 * 60 * 60 * 24 * 365) return 'PERM';
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m}m left`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h left`;
    return `${Math.floor(h / 24)}d left`;
  } catch { return ''; }
}

export default function Admin() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<ModUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [muteFor, setMuteFor] = useState<ModUser | null>(null);

  // Auth guard
  useEffect(() => {
    if (user && !user.is_admin) {
      Alert.alert('Forbidden', 'Admins only.');
      router.replace('/');
    }
  }, [user, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const list = await api<ModUser[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      setUsers(list);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load users');
    }
    setBusy(false);
  }, [q]);

  useEffect(() => { if (user?.is_admin) load(); }, [load, user?.is_admin]);

  const ban = async (u: ModUser) => {
    fxTap();
    Alert.alert(`Ban ${u.username}?`, 'They will be unable to log in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'BAN', style: 'destructive', onPress: async () => {
        try { await api('/admin/ban', { method: 'POST', body: { username: u.username } }); fxSuccess(); load(); }
        catch (e: any) { fxError(); Alert.alert('Error', e?.message || 'Failed'); }
      } },
    ]);
  };

  const unban = async (u: ModUser) => {
    fxTap();
    try { await api('/admin/unban', { method: 'POST', body: { username: u.username } }); fxSuccess(); load(); }
    catch (e: any) { fxError(); Alert.alert('Error', e?.message || 'Failed'); }
  };

  const unmute = async (u: ModUser) => {
    fxTap();
    try { await api('/admin/unmute', { method: 'POST', body: { username: u.username } }); fxSuccess(); load(); }
    catch (e: any) { fxError(); Alert.alert('Error', e?.message || 'Failed'); }
  };

  const doMute = async (minutes: number) => {
    if (!muteFor) return;
    fxTap();
    try {
      await api('/admin/mute', { method: 'POST', body: { username: muteFor.username, minutes: minutes || null } });
      fxSuccess();
      setMuteFor(null);
      load();
    } catch (e: any) { fxError(); Alert.alert('Error', e?.message || 'Failed'); }
  };

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={theme.colors.gold} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="admin-screen">
      <Stack.Screen options={{ title: 'ADMIN PANEL',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.fontPixel, fontSize: 11 },
        headerTintColor: theme.colors.gold, headerRight: () => <HomeButton /> }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <View style={styles.headerCard}>
          <Ionicons name="shield-checkmark" size={26} color={theme.colors.redstone} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headTitle}>MODERATOR TOOLS</Text>
            <Text style={styles.headSub}>Logged in as {user.username}  •  ADMIN</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={theme.colors.gold} style={{ marginRight: 8 }} />
          <TextInput
            value={q} onChangeText={setQ}
            placeholder="Search username..." placeholderTextColor={theme.colors.textSecondary}
            style={styles.searchInput} autoCapitalize="none"
            onSubmitEditing={load} testID="search-input"
          />
          <TouchableOpacity onPress={() => { fxTap(); load(); }} style={styles.searchBtn} testID="search-btn">
            <Text style={styles.searchBtnTxt}>GO</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
          ListEmptyComponent={busy ? <ActivityIndicator color={theme.colors.gold} /> : <Text style={styles.empty}>No users found.</Text>}
          renderItem={({ item }) => {
            const muted = item.muted_until && new Date(item.muted_until).getTime() > Date.now();
            return (
              <View style={[styles.row, item.is_banned && styles.rowBanned]} testID={`user-${item.username}`}>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, item.is_banned && { color: theme.colors.redstone, textDecorationLine: 'line-through' }]}>{item.username}</Text>
                    {item.is_admin && (
                      <View style={styles.adminPill}>
                        <Ionicons name="star" size={8} color="#000" />
                        <Text style={styles.adminPillTxt}>ADMIN</Text>
                      </View>
                    )}
                    {item.is_banned && (
                      <View style={[styles.statusPill, { backgroundColor: theme.colors.redstone }]}>
                        <Text style={styles.statusTxt}>BANNED</Text>
                      </View>
                    )}
                    {muted && !item.is_banned && (
                      <View style={[styles.statusPill, { backgroundColor: theme.colors.gold }]}>
                        <Text style={styles.statusTxt}>MUTED {timeLeft(item.muted_until)}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.email}>{item.email}</Text>
                </View>
                {!item.is_admin && (
                  <View style={styles.actions}>
                    {item.is_banned ? (
                      <TouchableOpacity onPress={() => unban(item)} style={[styles.actBtn, { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emeraldDark }]} testID={`unban-${item.username}`}>
                        <Ionicons name="lock-open" size={12} color="#fff" />
                        <Text style={styles.actTxt}>UNBAN</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => ban(item)} style={[styles.actBtn, { backgroundColor: theme.colors.redstone, borderColor: '#9b1c1c' }]} testID={`ban-${item.username}`}>
                        <Ionicons name="ban" size={12} color="#fff" />
                        <Text style={styles.actTxt}>BAN</Text>
                      </TouchableOpacity>
                    )}
                    {muted ? (
                      <TouchableOpacity onPress={() => unmute(item)} style={[styles.actBtn, { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emeraldDark }]} testID={`unmute-${item.username}`}>
                        <Ionicons name="volume-high" size={12} color="#fff" />
                        <Text style={styles.actTxt}>UNMUTE</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => { fxTap(); setMuteFor(item); }} style={[styles.actBtn, { backgroundColor: theme.colors.gold, borderColor: '#8b5a2b' }]} testID={`mute-${item.username}`}>
                        <Ionicons name="volume-mute" size={12} color="#000" />
                        <Text style={[styles.actTxt, { color: '#000' }]}>MUTE</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />

        {/* Mute modal */}
        <Modal visible={!!muteFor} transparent animationType="fade" onRequestClose={() => setMuteFor(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.modalCard} testID="mute-modal">
                <Text style={styles.modalTitle}>MUTE {muteFor?.username.toUpperCase()}</Text>
                <Text style={styles.modalSub}>Select a duration</Text>
                <View style={styles.muteRow}>
                  {QUICK_MUTES.map((q) => (
                    <TouchableOpacity
                      key={q.label}
                      testID={`mute-q-${q.label}`}
                      onPress={() => doMute(q.minutes)}
                      style={[styles.muteChip, q.label === 'PERM' && { backgroundColor: theme.colors.redstone, borderColor: '#9b1c1c' }]}
                    >
                      <Text style={styles.muteChipTxt}>{q.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={() => setMuteFor(null)} style={[styles.actBtn, { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, marginTop: 14 }]} testID="cancel-mute">
                  <Text style={styles.actTxt}>CANCEL</Text>
                </TouchableOpacity>
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
  headerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.dirtDark, borderColor: theme.colors.redstone, borderWidth: 4, padding: theme.spacing.md, margin: theme.spacing.md, marginBottom: 0 },
  headTitle: { fontFamily: theme.fontPixel, fontSize: 12, color: theme.colors.gold, letterSpacing: 1 },
  headSub: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, marginTop: 4 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 3, paddingHorizontal: 10, margin: theme.spacing.md, marginBottom: 0 },
  searchInput: { flex: 1, fontFamily: theme.fontBody, fontSize: 15, color: theme.colors.text, paddingVertical: 10 },
  searchBtn: { backgroundColor: theme.colors.gold, borderColor: '#8b5a2b', borderWidth: 2, borderBottomWidth: 4, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 6 },
  searchBtnTxt: { fontFamily: theme.fontPixel, fontSize: 10, color: '#000', letterSpacing: 1 },
  empty: { fontFamily: theme.font, color: theme.colors.textSecondary, textAlign: 'center', padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 3, padding: 12, marginBottom: 6 },
  rowBanned: { backgroundColor: '#2a0e0e', borderColor: theme.colors.redstone },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontFamily: theme.fontPixel, fontSize: 11, color: theme.colors.text, letterSpacing: 1 },
  adminPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.colors.gold, borderColor: '#000', borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2 },
  adminPillTxt: { fontFamily: theme.fontPixel, fontSize: 7, color: '#000', letterSpacing: 1 },
  statusPill: { borderColor: '#000', borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2 },
  statusTxt: { fontFamily: theme.fontPixel, fontSize: 7, color: '#000', letterSpacing: 1 },
  email: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, marginTop: 4 },
  actions: { flexDirection: 'column', gap: 4 },
  actBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 2, borderBottomWidth: 4, paddingHorizontal: 8, paddingVertical: 6, minWidth: 80 },
  actTxt: { fontFamily: theme.fontPixel, fontSize: 8, color: '#fff', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)' },
  modalScroll: { padding: theme.spacing.md, flexGrow: 1, justifyContent: 'center' },
  modalCard: { backgroundColor: theme.colors.dirtDark, borderColor: theme.colors.gold, borderWidth: 4, padding: theme.spacing.md },
  modalTitle: { fontFamily: theme.fontPixel, fontSize: 12, color: theme.colors.gold, textAlign: 'center', letterSpacing: 1, marginBottom: 6 },
  modalSub: { fontFamily: theme.font, fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 14 },
  muteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  muteChip: { backgroundColor: theme.colors.gold, borderColor: '#8b5a2b', borderWidth: 3, borderBottomWidth: 5, paddingHorizontal: 14, paddingVertical: 10, minWidth: 72, alignItems: 'center' },
  muteChipTxt: { fontFamily: theme.fontPixel, fontSize: 11, color: '#000', letterSpacing: 1 },
});
