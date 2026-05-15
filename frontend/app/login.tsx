import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/auth';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!email.trim() || !password) { setErr('Email and password required'); return; }
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setErr(e?.message || 'Login failed');
    }
    setBusy(false);
  };

  return (
    <SafeAreaView style={styles.safe} testID="login-screen">
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.18 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.hero}>
              <Image source={theme.media.mace} style={styles.icon} resizeMode="contain" />
              <Text style={styles.title}>MACE FORGE</Text>
              <Text style={styles.sub}>Log in to your account</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                testID="login-email"
                value={email} onChangeText={setEmail}
                autoCapitalize="none" autoCorrect={false}
                keyboardType="email-address"
                placeholder="steve@mc.io"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.input}
              />
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                testID="login-password"
                value={password} onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.input}
                onSubmitEditing={submit}
              />

              {err ? <Text style={styles.err} testID="login-error">{err}</Text> : null}

              <TouchableOpacity testID="login-submit" onPress={submit} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>LOG IN</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>NO ACCOUNT?</Text>
              <Link href="/signup" asChild>
                <TouchableOpacity testID="go-signup">
                  <Text style={styles.link}>CREATE ONE</Text>
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
  title: { fontFamily: theme.font, fontSize: 28, color: theme.colors.gold, fontWeight: 'bold', letterSpacing: 3, textTransform: 'uppercase' },
  sub: { fontFamily: theme.font, fontSize: 12, color: theme.colors.textSecondary, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 },
  card: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md },
  label: { fontFamily: theme.font, fontSize: 11, color: theme.colors.gold, marginTop: 6, marginBottom: 4, letterSpacing: 1 },
  input: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 4, color: theme.colors.text, padding: 12, fontSize: 14, fontFamily: theme.font, marginBottom: 8 },
  err: { fontFamily: theme.font, fontSize: 12, color: theme.colors.redstone, marginTop: 4, marginBottom: 4 },
  btn: { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emeraldDark, borderWidth: 4, borderBottomWidth: 8, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  btnText: { fontFamily: theme.font, fontSize: 14, color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 } },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: theme.spacing.lg },
  footerText: { fontFamily: theme.font, fontSize: 12, color: theme.colors.textSecondary },
  link: { fontFamily: theme.font, fontSize: 12, color: theme.colors.gold, fontWeight: 'bold', textTransform: 'uppercase', textDecorationLine: 'underline' },
});
