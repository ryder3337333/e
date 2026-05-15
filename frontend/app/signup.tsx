import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/auth';

export default function Signup() {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!email.trim() || !username.trim() || !password) { setErr('All fields required'); return; }
    if (username.length < 3) { setErr('Username must be ≥ 3 chars'); return; }
    if (!/^[A-Za-z0-9_]+$/.test(username)) { setErr('Username: letters/digits/_ only'); return; }
    if (password.length < 6) { setErr('Password must be ≥ 6 chars'); return; }
    setBusy(true);
    try {
      await signup(email.trim(), username.trim(), password);
    } catch (e: any) {
      setErr(e?.message || 'Signup failed');
    }
    setBusy(false);
  };

  return (
    <SafeAreaView style={styles.safe} testID="signup-screen">
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.18 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.hero}>
              <Image source={theme.media.mace} style={styles.icon} resizeMode="contain" />
              <Text style={styles.title}>JOIN THE FORGE</Text>
              <Text style={styles.sub}>Pick a unique IGN</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                testID="signup-email"
                value={email} onChangeText={setEmail}
                autoCapitalize="none" autoCorrect={false}
                keyboardType="email-address"
                placeholder="steve@mc.io"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.input}
              />
              <Text style={styles.label}>USERNAME (UNIQUE)</Text>
              <TextInput
                testID="signup-username"
                value={username} onChangeText={setUsername}
                autoCapitalize="none" autoCorrect={false}
                placeholder="SteveDiamond"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.input}
                maxLength={24}
              />
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                testID="signup-password"
                value={password} onChangeText={setPassword}
                secureTextEntry
                placeholder="6+ chars"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.input}
                onSubmitEditing={submit}
              />

              {err ? <Text style={styles.err} testID="signup-error">{err}</Text> : null}

              <TouchableOpacity testID="signup-submit" onPress={submit} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>CREATE ACCOUNT</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>ALREADY HAVE AN ACCOUNT?</Text>
              <Link href="/login" asChild>
                <TouchableOpacity testID="go-login">
                  <Text style={styles.link}>LOG IN</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  content: { flexGrow: 1, padding: theme.spacing.lg, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: theme.spacing.xl },
  icon: { width: 80, height: 80, marginBottom: 12 },
  title: { fontFamily: theme.font, fontSize: 26, color: theme.colors.gold, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' },
  sub: { fontFamily: theme.font, fontSize: 12, color: theme.colors.textSecondary, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 },
  card: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md },
  label: { fontFamily: theme.font, fontSize: 11, color: theme.colors.gold, marginTop: 6, marginBottom: 4, letterSpacing: 1 },
  input: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 4, color: theme.colors.text, padding: 12, fontSize: 14, fontFamily: theme.font, marginBottom: 8 },
  err: { fontFamily: theme.font, fontSize: 12, color: theme.colors.redstone, marginTop: 4, marginBottom: 4 },
  btn: { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emeraldDark, borderWidth: 4, borderBottomWidth: 8, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  btnText: { fontFamily: theme.font, fontSize: 14, color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 } },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: theme.spacing.lg, flexWrap: 'wrap' },
  footerText: { fontFamily: theme.font, fontSize: 12, color: theme.colors.textSecondary },
  link: { fontFamily: theme.font, fontSize: 12, color: theme.colors.gold, fontWeight: 'bold', textTransform: 'uppercase', textDecorationLine: 'underline' },
});
