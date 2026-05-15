import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ImageBackground, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api } from '@/src/api';

type Notif = { id: string; kind: string; post_id: string; post_title: string; actor: string; preview: string; read: boolean; created_at: string };

export default function Notifications() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);

  const load = useCallback(async () => {
    try {
      const list = await api<Notif[]>('/notifications');
      setNotifs(list);
      await api('/notifications/read', { method: 'POST', body: {} });
    } catch (e) { console.warn(e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="notifications-screen">
      <Stack.Screen options={{
        title: 'INBOX',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold,
      }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <FlatList
          data={notifs}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: theme.spacing.md }}
          ListEmptyComponent={<Text style={styles.empty}>No replies yet — your inbox is empty.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.card, !item.read && styles.unread]} onPress={() => router.push('/forum')} testID={`notif-${item.id}`}>
              <View style={styles.head}>
                <Ionicons name="chatbubble-ellipses" size={16} color={theme.colors.diamond} />
                <Text style={styles.actor}>{item.actor}</Text>
                <Text style={styles.action}>replied to your post</Text>
              </View>
              <Text style={styles.title} numberOfLines={1}>{item.post_title}</Text>
              <Text style={styles.preview} numberOfLines={2}>"{item.preview}"</Text>
            </TouchableOpacity>
          )}
        />
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  empty: { fontFamily: theme.font, color: theme.colors.textSecondary, textAlign: 'center', padding: 32 },
  card: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: 12, marginBottom: 8 },
  unread: { borderColor: theme.colors.gold },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  actor: { fontFamily: theme.font, fontSize: 12, color: theme.colors.emerald, fontWeight: 'bold' },
  action: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary },
  title: { fontFamily: theme.font, fontSize: 13, color: theme.colors.gold, fontWeight: 'bold', marginBottom: 4 },
  preview: { fontFamily: theme.font, fontSize: 12, color: theme.colors.text, fontStyle: 'italic' },
});
