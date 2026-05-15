import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ImageBackground,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme, API_URL } from '@/src/theme';
import { storage } from '@/src/utils/storage';

type Msg = { role: 'user' | 'assistant'; text: string; id: string };

const SUGGESTIONS = [
  'Best mace combo for crystal PvP?',
  'How does Density stack with Breach?',
  'Counter to a mace player?',
  'Optimal fall height for one-shots?',
];

export default function ChatScreen() {
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    (async () => {
      let sid = await storage.getItem<string>('mace_chat_session', '');
      if (!sid || typeof sid !== 'string') {
        sid = 's_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        await storage.setItem('mace_chat_session', sid);
      }
      setSessionId(sid);
      try {
        const r = await fetch(`${API_URL}/chat/${sid}`);
        if (r.ok) {
          const hist: any[] = await r.json();
          setMessages(hist.map((h) => ({ id: h.id, role: h.role, text: h.text })));
        }
      } catch (e) { console.warn(e); }
    })();
  }, []);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending || !sessionId) return;
    setInput('');
    const localId = 'u_' + Date.now();
    setMessages((m) => [...m, { id: localId, role: 'user', text: msg }]);
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const r = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: msg }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setMessages((m) => [...m, { id: 'a_' + Date.now(), role: 'assistant', text: data.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { id: 'err_' + Date.now(), role: 'assistant',
        text: '⚠ Coach offline. Try again in a moment.' }]);
    }
    setSending(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const reset = async () => {
    const sid = 's_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    await storage.setItem('mace_chat_session', sid);
    setSessionId(sid);
    setMessages([]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="chat-screen">
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat"
        style={styles.bg} imageStyle={{ opacity: 0.12 }}>
        <View style={styles.headerBar}>
          <View style={styles.headerRow}>
            <Image source={{ uri: theme.media.mace }} style={styles.headerIcon} resizeMode="contain" />
            <View>
              <Text style={styles.h1}>MACECOACH AI</Text>
              <Text style={styles.subTxt}>Tactical PvP Mentor</Text>
            </View>
          </View>
          <TouchableOpacity testID="reset-chat-btn" onPress={reset} style={styles.resetBtn}>
            <Ionicons name="refresh" size={18} color={theme.colors.gold} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.list}>
            {messages.length === 0 && (
              <View testID="chat-empty" style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>ASK YOUR MACE COACH</Text>
                <Text style={styles.emptyBody}>Get tactical advice on combos, enchants, and counters.</Text>
                <View style={styles.suggestions}>
                  {SUGGESTIONS.map((s) => (
                    <TouchableOpacity key={s} testID={`suggest-${s}`} onPress={() => send(s)} style={styles.suggestion}>
                      <Text style={styles.suggestionText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            {messages.map((m) => (
              <View key={m.id} style={[styles.msg, m.role === 'user' ? styles.msgUser : styles.msgBot]}
                testID={`msg-${m.role}`}>
                <Text style={styles.msgRole}>{m.role === 'user' ? 'YOU' : 'COACH'}</Text>
                <Text style={styles.msgText}>{m.text}</Text>
              </View>
            ))}
            {sending && (
              <View style={[styles.msg, styles.msgBot]}>
                <ActivityIndicator color={theme.colors.gold} />
              </View>
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              testID="chat-input"
              value={input}
              onChangeText={setInput}
              placeholder="ASK ABOUT MACE PVP..."
              placeholderTextColor={theme.colors.textSecondary}
              style={styles.input}
              editable={!sending}
              onSubmitEditing={() => send()}
            />
            <TouchableOpacity testID="send-btn" onPress={() => send()} disabled={sending || !input.trim()}
              style={[styles.sendBtn, (sending || !input.trim()) && { opacity: 0.5 }]}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.dirtDark, borderBottomColor: theme.colors.borderDark, borderBottomWidth: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 36, height: 36 },
  h1: { fontFamily: theme.font, fontSize: 16, fontWeight: 'bold', color: theme.colors.gold,
    textTransform: 'uppercase', letterSpacing: 2 },
  subTxt: { fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 },
  resetBtn: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 2,
    padding: 8 },
  list: { padding: theme.spacing.md, paddingBottom: theme.spacing.md, flexGrow: 1 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontFamily: theme.font, fontSize: 18, color: theme.colors.gold, fontWeight: 'bold',
    textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 },
  emptyBody: { fontFamily: theme.font, fontSize: 12, color: theme.colors.textSecondary,
    textAlign: 'center', marginBottom: 20 },
  suggestions: { gap: 8, width: '100%' },
  suggestion: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderLight,
    borderWidth: 2, padding: 12 },
  suggestionText: { fontFamily: theme.font, fontSize: 12, color: theme.colors.text },
  msg: { borderWidth: 4, padding: theme.spacing.sm, marginBottom: theme.spacing.sm, maxWidth: '88%' },
  msgUser: { alignSelf: 'flex-end', backgroundColor: theme.colors.lapis, borderColor: '#22229a' },
  msgBot: { alignSelf: 'flex-start', backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark },
  msgRole: { fontFamily: theme.font, fontSize: 10, color: theme.colors.gold, fontWeight: 'bold',
    marginBottom: 4, letterSpacing: 1 },
  msgText: { fontFamily: theme.font, fontSize: 13, color: '#fff', lineHeight: 19 },
  inputRow: { flexDirection: 'row', padding: theme.spacing.sm, gap: 6,
    backgroundColor: theme.colors.bgDark, borderTopColor: theme.colors.borderDark, borderTopWidth: 4 },
  input: { flex: 1, backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 4,
    color: theme.colors.text, padding: 10, fontSize: 13, fontFamily: theme.font },
  sendBtn: { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emeraldDark,
    borderWidth: 4, borderBottomWidth: 6, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
});
