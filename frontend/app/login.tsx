import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ImageBackground,
  KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/auth';
import { fxTap, fxSuccess, fxError } from '@/src/utils/fx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Floating mace animation
  const floatY = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(floatY, { toValue: -8, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatY, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
    ])).start();
  }, [floatY, glow]);

  const submit = async () => {
    setErr(''); fxTap();
    if (!email.trim() || !password) { setErr('Email and password required'); fxError(); return; }
    setBusy(true);
    try {
      await login(email.trim(), password);
      fxSuccess();
    } catch (e: any) {
      fxError();
      setErr(e?.message || 'Login failed');
    }
    setBusy(false);
  };

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });

  return (
    <SafeAreaView style={styles.safe} testID="login-screen">
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.22 }}>
        <View style={styles.vignette} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

            <View style={styles.hero}>
              <View style={styles.maceWrap}>
                <Animated.View style={[styles.glowDisc, { opacity: glowOpacity }]} />
                <Animated.View style={{ transform: [{ translateY: floatY }] }}>
                  <Image source={theme.media.mace} style={styles.icon} resizeMode="contain" />
                </Animated.View>
              </View>
              <Text style={styles.brand}>MACE FORGE</Text>
              <View style={styles.taglinePill}>
                <Ionicons name="flash" size={11} color={theme.colors.gold} />
                <Text style={styles.tagline}>MINECRAFT MACE PVP HQ</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>LOG IN</Text>

              <Text style={styles.label}>EMAIL</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail" size={16} color={theme.colors.gold} style={styles.inputIcon} />
                <TextInput
                  testID="login-email"
                  value={email} onChangeText={setEmail}
                  autoCapitalize="none" autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="steve@mc.io"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={styles.input}
                />
              </View>

              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed" size={16} color={theme.colors.gold} style={styles.inputIcon} />
                <TextInput
                  testID="login-password"
                  value={password} onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={styles.input}
                  onSubmitEditing={submit}
                />
              </View>

              {err ? (
                <View style={styles.errBox}>
                  <Ionicons name="warning" size={13} color={theme.colors.redstone} />
                  <Text style={styles.err} testID="login-error">  {err}</Text>
                </View>
              ) : null}

              <TouchableOpacity testID="login-submit" onPress={submit} disabled={busy} activeOpacity={0.85} style={[styles.btn, busy && { opacity: 0.7 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <View style={styles.btnInner}>
                    <Ionicons name="enter" size={18} color="#fff" />
                    <Text style={styles.btnText}>ENTER REALM</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>NEW WARRIOR?</Text>
              <Link href="/signup" asChild>
                <TouchableOpacity testID="go-signup" onPress={fxTap}>
                  <Text style={styles.link}>FORGE ACCOUNT →</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <Text style={styles.versionTag}>v1.0  •  Mace Update 1.21+</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  vignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  content: { flexGrow: 1, padding: theme.spacing.lg, justifyContent: 'center' },

  hero: { alignItems: 'center', marginBottom: theme.spacing.xl },
  maceWrap: { width: 130, height: 130, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  glowDisc: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: theme.colors.gold,
    shadowColor: theme.colors.gold, shadowOpacity: 0.9, shadowRadius: 40,
    elevation: 20,
  },
  icon: { width: 100, height: 100 },
  brand: {
    fontFamily: theme.fontPixel, fontSize: 22, color: theme.colors.gold,
    letterSpacing: 2, textShadowColor: '#000', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0,
  },
  taglinePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 12, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: theme.colors.dirtDark, borderColor: theme.colors.gold, borderWidth: 2,
  },
  tagline: { fontFamily: theme.fontPixel, fontSize: 7, color: theme.colors.gold, letterSpacing: 1 },

  card: {
    backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark,
    borderWidth: 4, borderTopWidth: 6, borderBottomWidth: 8,
    padding: theme.spacing.md,
  },
  cardTitle: {
    fontFamily: theme.fontPixel, fontSize: 13, color: theme.colors.text,
    letterSpacing: 2, textAlign: 'center', marginBottom: 14,
  },
  label: { fontFamily: theme.fontPixel, fontSize: 8, color: theme.colors.gold, marginTop: 6, marginBottom: 6, letterSpacing: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 3, paddingHorizontal: 10, marginBottom: 6 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, color: theme.colors.text, paddingVertical: 12, fontSize: 15, fontFamily: theme.fontBody },

  errBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3a0e0e', borderColor: theme.colors.redstone, borderWidth: 2, padding: 8, marginTop: 6 },
  err: { fontFamily: theme.fontBody, fontSize: 14, color: theme.colors.redstone },

  btn: {
    backgroundColor: theme.colors.emerald,
    borderColor: theme.colors.emeraldDark, borderWidth: 4, borderBottomWidth: 8,
    paddingVertical: 14, alignItems: 'center', marginTop: 14,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontFamily: theme.fontPixel, fontSize: 11, color: '#fff', letterSpacing: 2 },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: theme.spacing.lg },
  footerText: { fontFamily: theme.fontPixel, fontSize: 8, color: theme.colors.textSecondary, letterSpacing: 1 },
  link: { fontFamily: theme.fontPixel, fontSize: 9, color: theme.colors.gold, letterSpacing: 1 },

  versionTag: { fontFamily: theme.fontBody, fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.md, opacity: 0.6 },
});
