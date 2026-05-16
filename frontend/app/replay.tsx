import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ImageBackground, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, Animated, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { theme } from '@/src/theme';
import { HomeButton } from '@/src/components/HomeButton';
import { api } from '@/src/api';
import { fxTap, fxSuccess, fxError } from '@/src/utils/fx';
import { useEntranceFade } from '@/src/utils/anim';

const SERVERS = ['Hypixel', 'MaceMC', 'PvPLand', 'MinemenClub', 'Other'];

type Picked = {
  uri: string;
  type: 'image' | 'video';
  thumb?: string;     // file uri of extracted thumb
  thumbB64?: string;  // base64 (no prefix)
  durationMs?: number;
};

function uriToBase64(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fetch(uri)
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = String(reader.result || '');
          const idx = result.indexOf(',');
          resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
      .catch(reject);
  });
}

export default function Replay() {
  const [server, setServer] = useState('Hypixel');
  const [desc, setDesc] = useState('');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [analysis, setAnalysis] = useState('');

  const ent1 = useEntranceFade(0);
  const ent2 = useEntranceFade(80);
  const ent3 = useEntranceFade(160);

  const pickVideo = async (mode: 'video' | 'image') => {
    fxTap();
    setPicking(true);
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'We need media library access to upload your clip.');
          setPicking(false);
          return;
        }
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mode === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        videoMaxDuration: 60,
        allowsEditing: false,
        base64: mode === 'image', // for images we can read base64 directly
      });
      if (res.canceled || !res.assets || res.assets.length === 0) { setPicking(false); return; }
      const a = res.assets[0];

      if (mode === 'image') {
        const b64 = a.base64 || (await uriToBase64(a.uri));
        setPicked({ uri: a.uri, type: 'image', thumb: a.uri, thumbB64: b64 });
      } else {
        // Extract a representative frame at ~25% of the video
        const at = Math.min(8000, Math.max(500, Math.floor((a.duration || 4000) * 0.25)));
        try {
          const tn = await VideoThumbnails.getThumbnailAsync(a.uri, { time: at, quality: 0.7 });
          const b64 = await uriToBase64(tn.uri);
          setPicked({ uri: a.uri, type: 'video', thumb: tn.uri, thumbB64: b64, durationMs: a.duration || undefined });
        } catch (err) {
          // Fallback: use video uri without thumb (Web may not support thumbnails)
          console.warn('thumbnail failed', err);
          setPicked({ uri: a.uri, type: 'video', durationMs: a.duration || undefined });
        }
      }
    } catch (e: any) {
      fxError();
      Alert.alert('Upload error', e?.message || 'Could not pick clip');
    }
    setPicking(false);
  };

  const submit = async () => {
    if (!picked && desc.trim().length < 20) {
      Alert.alert('Need more info', 'Upload a clip OR write 20+ chars describing the fight.');
      return;
    }
    fxTap();
    setBusy(true); setAnalysis('');
    try {
      const body: any = { description: desc.trim() || 'See attached frame.', server };
      if (picked?.thumbB64) body.image_base64 = picked.thumbB64;
      const r = await api<{ analysis: string }>('/replay/analyze', { method: 'POST', body });
      setAnalysis(r.analysis);
      fxSuccess();
    } catch (e: any) {
      fxError();
      Alert.alert('Error', e?.message || 'Failed');
    }
    setBusy(false);
  };

  const removeClip = () => { fxTap(); setPicked(null); };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="replay-screen">
      <Stack.Screen options={{ title: 'REPLAY ANALYZER',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold, headerRight: () => <HomeButton /> }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Animated.View style={[styles.heroCard, ent1.style]}>
              <Ionicons name="film" size={26} color={theme.colors.gold} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.heroTitle}>AI COACH</Text>
                <Text style={styles.heroSub}>Upload your clip — get pro-level critique in seconds.</Text>
              </View>
            </Animated.View>

            <Animated.View style={[styles.card, ent2.style]}>
              {!picked ? (
                <>
                  <Text style={styles.label}>UPLOAD CLIP</Text>
                  <View style={styles.pickRow}>
                    <TouchableOpacity testID="pick-video" onPress={() => pickVideo('video')} disabled={picking} style={[styles.pickBtn, { backgroundColor: theme.colors.lapis, borderColor: '#22229a' }]}>
                      <Ionicons name="videocam" size={18} color="#fff" />
                      <Text style={styles.pickTxt}>PICK VIDEO</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="pick-image" onPress={() => pickVideo('image')} disabled={picking} style={[styles.pickBtn, { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emeraldDark }]}>
                      <Ionicons name="image" size={18} color="#fff" />
                      <Text style={styles.pickTxt}>PICK SCREENSHOT</Text>
                    </TouchableOpacity>
                  </View>
                  {picking && <ActivityIndicator color={theme.colors.gold} style={{ marginTop: 12 }} />}
                  <Text style={styles.hint}>★ Tip: Pick a 5-15s clip with the key smash moment for the best critique.</Text>
                </>
              ) : (
                <View testID="clip-preview">
                  <View style={styles.thumbWrap}>
                    {picked.thumb ? (
                      <Image source={{ uri: picked.thumb }} style={styles.thumbImg} resizeMode="cover" />
                    ) : (
                      <View style={[styles.thumbImg, { backgroundColor: theme.colors.obsidian, alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="play-circle" size={48} color={theme.colors.gold} />
                      </View>
                    )}
                    <View style={styles.thumbBadge}>
                      <Ionicons name={picked.type === 'video' ? 'videocam' : 'image'} size={12} color="#000" />
                      <Text style={styles.thumbBadgeTxt}>{picked.type.toUpperCase()}</Text>
                    </View>
                    {picked.type === 'video' && (
                      <View style={styles.playBadge}>
                        <Ionicons name="play" size={20} color="#fff" />
                        {!!picked.durationMs && <Text style={styles.durTxt}>{Math.round(picked.durationMs / 1000)}s</Text>}
                      </View>
                    )}
                  </View>
                  <View style={styles.thumbActions}>
                    <TouchableOpacity testID="remove-clip" onPress={removeClip} style={[styles.smallBtn, { backgroundColor: theme.colors.redstone, borderColor: '#9b1c1c' }]}>
                      <Ionicons name="trash" size={14} color="#fff" />
                      <Text style={styles.smallBtnTxt}>REPLACE</Text>
                    </TouchableOpacity>
                    {picked.type === 'video' && Platform.OS === 'web' && (
                      <TouchableOpacity testID="open-clip" onPress={() => Linking.openURL(picked.uri).catch(() => {})} style={[styles.smallBtn, { backgroundColor: theme.colors.lapis, borderColor: '#22229a' }]}>
                        <Ionicons name="open" size={14} color="#fff" />
                        <Text style={styles.smallBtnTxt}>OPEN</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.frameNote}>AI will analyze this thumbnail frame + your description.</Text>
                </View>
              )}
            </Animated.View>

            <Animated.View style={[styles.card, ent3.style]}>
              <Text style={styles.label}>SERVER</Text>
              <View style={styles.chips}>
                {SERVERS.map((s) => (
                  <TouchableOpacity key={s} testID={`server-${s}`} onPress={() => { fxTap(); setServer(s); }}
                    style={[styles.chip, server === s && styles.chipActive]}>
                    <Text style={[styles.chipTxt, server === s && { color: '#fff' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>DESCRIBE THE FIGHT (OPTIONAL)</Text>
              <Text style={styles.hint}>Mention enchants, height, outcome — AI uses this with the frame.</Text>
              <TextInput
                testID="desc-input"
                value={desc} onChangeText={setDesc}
                multiline
                placeholder="e.g. Pearled 25b, Density V+Wind Burst, smashed for 18hp but missed totem swap..."
                placeholderTextColor={theme.colors.textSecondary}
                style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
              />

              <TouchableOpacity testID="analyze-btn" onPress={submit} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#fff" />
                    <Text style={styles.btnTxt}>ANALYZE WITH AI</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            {analysis ? (
              <Animated.View style={[styles.result, useEntranceFade(0).style]} testID="analysis-result">
                <View style={styles.resultHead}>
                  <Ionicons name="ribbon" size={18} color={theme.colors.gold} />
                  <Text style={styles.resultHeadTxt}>COACH REPORT</Text>
                </View>
                <Text style={styles.resultBody}>{analysis}</Text>
              </Animated.View>
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
  heroCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.dirtDark, borderColor: theme.colors.borderDark, borderWidth: 4,
    padding: theme.spacing.md, marginBottom: theme.spacing.md,
  },
  heroTitle: { fontFamily: theme.font, fontSize: 16, color: theme.colors.gold, fontWeight: 'bold', letterSpacing: 2 },
  heroSub: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, marginTop: 4 },
  card: { backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 4, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  label: { fontFamily: theme.font, fontSize: 11, color: theme.colors.gold, marginTop: 6, marginBottom: 6, letterSpacing: 1 },
  hint: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8, lineHeight: 16 },
  pickRow: { flexDirection: 'row', gap: 8 },
  pickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 4, borderBottomWidth: 8, paddingVertical: 14 },
  pickTxt: { fontFamily: theme.font, fontSize: 12, color: '#fff', fontWeight: 'bold', letterSpacing: 1 },
  thumbWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 4, position: 'relative', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  thumbBadge: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.gold, borderColor: '#000', borderWidth: 2, paddingHorizontal: 6, paddingVertical: 3 },
  thumbBadgeTxt: { fontFamily: theme.font, fontSize: 9, color: '#000', fontWeight: 'bold' },
  playBadge: { position: 'absolute', right: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderColor: '#000', borderWidth: 2, paddingHorizontal: 6, paddingVertical: 4 },
  durTxt: { fontFamily: theme.font, fontSize: 10, color: '#fff', fontWeight: 'bold' },
  thumbActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 2, borderBottomWidth: 4, paddingHorizontal: 10, paddingVertical: 6 },
  smallBtnTxt: { fontFamily: theme.font, fontSize: 11, color: '#fff', fontWeight: 'bold' },
  frameNote: { fontFamily: theme.font, fontSize: 10, color: theme.colors.textSecondary, marginTop: 8, fontStyle: 'italic' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { backgroundColor: theme.colors.bgDark, borderColor: theme.colors.borderDark, borderWidth: 2, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: theme.colors.emeraldDark, borderColor: theme.colors.emerald },
  chipTxt: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, fontWeight: 'bold' },
  input: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 4, color: theme.colors.text, padding: 12, fontSize: 13, fontFamily: theme.font },
  btn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: theme.colors.lapis, borderColor: '#22229a', borderWidth: 4, borderBottomWidth: 8, paddingVertical: 14, marginTop: 12 },
  btnTxt: { fontFamily: theme.font, fontSize: 14, color: '#fff', fontWeight: 'bold', letterSpacing: 2 },
  result: { backgroundColor: theme.colors.nether, borderColor: '#2a0808', borderWidth: 4, padding: theme.spacing.md },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  resultHeadTxt: { fontFamily: theme.font, fontSize: 14, color: theme.colors.gold, fontWeight: 'bold', letterSpacing: 1 },
  resultBody: { fontFamily: theme.font, fontSize: 13, color: theme.colors.text, lineHeight: 19 },
});
