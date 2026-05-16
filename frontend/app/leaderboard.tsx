import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ImageBackground, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { theme } from '@/src/theme';
import { HomeButton } from '@/src/components/HomeButton';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';

type Row = { user_id: string; username: string; kills: number; deaths: number; kdr: number };

export default function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try { setRows(await api<Row[]>('/leaderboard/weekly')); } catch (e) { console.warn(e); }
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="leaderboard-screen">
      <Stack.Screen options={{
        title: 'LEADERBOARD',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold,
        headerRight: () => <HomeButton />,
      }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <Text style={styles.sectionTitle}>WEEKLY TOP 50 (BY K/D)</Text>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.user_id}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={theme.colors.gold} />}
          ListEmptyComponent={<Text style={styles.empty}>No battles logged this week — be the first.</Text>}
          renderItem={({ item, index }) => {
            const isMe = item.user_id === user?.id;
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
            return (
              <View style={[styles.row, isMe && styles.rowMe]} testID={`leader-${index}`}>
                <Text style={styles.rank}>{medal}</Text>
                <Text style={[styles.name, isMe && { color: theme.colors.emerald }]} numberOfLines={1}>{item.username}</Text>
                <Text style={styles.kills}>{item.kills}K</Text>
                <Text style={styles.deaths}>{item.deaths}D</Text>
                <Text style={styles.kdr}>{item.kdr.toFixed(2)}</Text>
              </View>
            );
          }}
        />
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  sectionTitle: { fontFamily: theme.font, fontSize: 13, color: theme.colors.gold, textTransform: 'uppercase', padding: theme.spacing.md, paddingBottom: 0, letterSpacing: 1 },
  empty: { fontFamily: theme.font, color: theme.colors.textSecondary, textAlign: 'center', padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: 12, marginBottom: 6, gap: 8 },
  rowMe: { borderColor: theme.colors.emerald, backgroundColor: theme.colors.dirtDark },
  rank: { fontFamily: theme.font, fontSize: 14, color: theme.colors.gold, fontWeight: 'bold', width: 36 },
  name: { flex: 1, fontFamily: theme.font, fontSize: 13, color: theme.colors.text, fontWeight: 'bold' },
  kills: { fontFamily: theme.font, fontSize: 12, color: theme.colors.emerald, width: 40, textAlign: 'right' },
  deaths: { fontFamily: theme.font, fontSize: 12, color: theme.colors.redstone, width: 40, textAlign: 'right' },
  kdr: { fontFamily: theme.font, fontSize: 14, color: theme.colors.diamond, fontWeight: 'bold', width: 50, textAlign: 'right' },
});
