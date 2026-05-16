import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ImageBackground, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { theme } from '@/src/theme';
import { HomeButton } from '@/src/components/HomeButton';
import { api } from '@/src/api';

const SERVERS = ['Hypixel', 'MaceMC', 'PvPLand', 'MinemenClub', 'Other'];

export default function Replay() {
  const [server, setServer] = useState('Hypixel');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState('');

  const submit = async () => {
    if (desc.trim().length < 20) {
      Alert.alert('Description too short', 'Describe your fight in 20+ characters (what you did, what happened, opponent moves).');
      return;
    }
    setBusy(true); setAnalysis('');
    try {
      const r = await api<{ analysis: string }>('/replay/analyze', {
        method: 'POST', body: { description: desc.trim(), server },
      });
      setAnalysis(r.analysis);
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
    setBusy(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="replay-screen">
      <Stack.Screen options={{ title: 'REPLAY ANALYZER',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold, headerRight: () => <HomeButton /> }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <Text style={styles.label}>SERVER</Text>
              <View style={styles.chips}>
                {SERVERS.map((s) => (
                  <TouchableOpacity key={s} testID={`server-${s}`} onPress={() => setServer(s)}
                    style={[styles.chip, server === s && styles.chipActive]}>
                    <Text style={[styles.chipTxt, server === s && { color: '#fff' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>DESCRIBE YOUR CLIP</Text>
              <Text style={styles.hint}>What happened? What enchants did you use? Did you win/lose? What did your opponent do?</Text>
              <TextInput
                testID="desc-input"
                value={desc} onChangeText={setDesc}
                multiline
                placeholder="Example: Pearled up 25 blocks, smashed with Density V+Wind Burst, dealt 18hp but missed totem swap and got crystal-bombed..."
                placeholderTextColor={theme.colors.textSecondary}
                style={[styles.input, { height: 160, textAlignVertical: 'top' }]}
              />

              <TouchableOpacity testID="analyze-btn" onPress={submit} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>ANALYZE WITH AI</Text>}
              </TouchableOpacity>
            </View>

            {analysis ? (
              <View style={styles.result} testID="analysis-result">
                <Text style={styles.resultHead}>★ COACH REPORT</Text>
                <Text style={styles.resultBody}>{analysis}</Text>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  card: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  label: { fontFamily: theme.font, fontSize: 11, color: theme.colors.gold, marginTop: 6, marginBottom: 6, letterSpacing: 1 },
  hint: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, marginBottom: 6, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { backgroundColor: theme.colors.bgDark, borderColor: theme.colors.borderDark, borderWidth: 2, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: theme.colors.emeraldDark, borderColor: theme.colors.emerald },
  chipTxt: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, fontWeight: 'bold' },
  input: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 4, color: theme.colors.text, padding: 12, fontSize: 13, fontFamily: theme.font },
  btn: { backgroundColor: theme.colors.lapis, borderColor: '#22229a', borderWidth: 4, borderBottomWidth: 8, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  btnTxt: { fontFamily: theme.font, fontSize: 14, color: '#fff', fontWeight: 'bold', letterSpacing: 2, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 } },
  result: { backgroundColor: theme.colors.nether, borderColor: '#2a0808', borderWidth: 4, padding: theme.spacing.md },
  resultHead: { fontFamily: theme.font, fontSize: 14, color: theme.colors.gold, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 },
  resultBody: { fontFamily: theme.font, fontSize: 13, color: theme.colors.text, lineHeight: 19 },
});
