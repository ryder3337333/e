import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ImageBackground, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { HomeButton } from '@/src/components/HomeButton';
import { api } from '@/src/api';

type Row = { user_id: string; username: string; elo: number; kdr: number };

export default function Friends() {
  const [friends, setFriends] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Row[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try { setFriends(await api<Row[]>('/friends')); } catch (e) { console.warn(e); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const search = async () => {
    if (q.trim().length < 2) { Alert.alert('Type 2+ letters'); return; }
    setSearching(true);
    try { setResults(await api<Row[]>(`/users/search?q=${encodeURIComponent(q.trim())}`)); } catch (e) { console.warn(e); }
    setSearching(false);
  };

  const addF = async (id: string) => {
    try {
      await api(`/friends/${id}`, { method: 'POST', body: {} });
      await load();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
  };

  const removeF = async (id: string) => {
    await api(`/friends/${id}`, { method: 'DELETE' });
    await load();
  };

  const friendIds = new Set(friends.map((f) => f.user_id));

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="friends-screen">
      <Stack.Screen options={{ title: 'FRIENDS',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold, headerRight: () => <HomeButton /> }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <View style={styles.searchBar}>
          <TextInput testID="search-input" value={q} onChangeText={setQ} placeholder="SEARCH USERNAME..."
            placeholderTextColor={theme.colors.textSecondary} style={styles.input}
            autoCapitalize="none" onSubmitEditing={search} />
          <TouchableOpacity testID="search-btn" onPress={search} style={styles.searchBtn}>
            <Ionicons name="search" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {results.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionH}>SEARCH RESULTS</Text>
            {results.map((u) => (
              <Row key={u.user_id} row={u} onAdd={() => addF(u.user_id)} isFriend={friendIds.has(u.user_id)} testIDPrefix="result" />
            ))}
          </View>
        )}

        <FlatList
          data={friends}
          keyExtractor={(f) => f.user_id}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
          ListHeaderComponent={<Text style={styles.sectionH}>YOUR FRIENDS ({friends.length})</Text>}
          ListEmptyComponent={<Text style={styles.empty}>No friends yet — search & add players above.</Text>}
          renderItem={({ item }) => (
            <Row row={item} onRemove={() => removeF(item.user_id)} isFriend testIDPrefix="friend" />
          )}
        />
      </ImageBackground>
    </SafeAreaView>
  );
}

function Row({ row, onAdd, onRemove, isFriend, testIDPrefix }: any) {
  return (
    <View style={styles.row} testID={`${testIDPrefix}-${row.user_id}`}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{row.username}</Text>
        <Text style={styles.sub}>ELO {row.elo} • K/D {row.kdr.toFixed(2)}</Text>
      </View>
      {isFriend ? (
        onRemove && (
          <TouchableOpacity testID={`unfollow-${row.user_id}`} onPress={onRemove} style={styles.removeBtn}>
            <Ionicons name="person-remove" size={16} color={theme.colors.redstone} />
          </TouchableOpacity>
        )
      ) : (
        <TouchableOpacity testID={`add-${row.user_id}`} onPress={onAdd} style={styles.addBtn}>
          <Ionicons name="person-add" size={14} color="#000" />
          <Text style={styles.addTxt}>ADD</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  searchBar: { flexDirection: 'row', gap: 6, padding: theme.spacing.md, backgroundColor: theme.colors.dirtDark, borderBottomColor: theme.colors.borderDark, borderBottomWidth: 4 },
  input: { flex: 1, backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 4, color: theme.colors.text, padding: 10, fontSize: 13, fontFamily: theme.font },
  searchBtn: { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emeraldDark, borderWidth: 4, borderBottomWidth: 6, paddingHorizontal: 14, justifyContent: 'center' },
  section: { padding: theme.spacing.md, paddingBottom: 0 },
  sectionH: { fontFamily: theme.font, fontSize: 12, color: theme.colors.gold, letterSpacing: 1, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: 12, marginBottom: 6 },
  name: { fontFamily: theme.font, fontSize: 14, color: theme.colors.text, fontWeight: 'bold' },
  sub: { fontFamily: theme.font, fontSize: 11, color: theme.colors.diamond, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.gold, borderColor: '#8b5a2b', borderWidth: 2, borderBottomWidth: 4, paddingHorizontal: 10, paddingVertical: 6 },
  addTxt: { fontFamily: theme.font, fontSize: 11, color: '#000', fontWeight: 'bold' },
  removeBtn: { padding: 8, backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 2 },
  empty: { fontFamily: theme.font, color: theme.colors.textSecondary, textAlign: 'center', padding: 16 },
});
