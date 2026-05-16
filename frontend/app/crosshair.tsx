import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { theme } from '@/src/theme';
import { storage } from '@/src/utils/storage';

const COLORS = ['#ffffff', '#55ff55', '#55ffff', '#ffaa00', '#ff5555', '#ff55ff', '#fcfc54'];

type Style = 'cross' | 'dot' | 'circle' | 'tee' | 'plus';

export default function Crosshair() {
  const [styleSel, setStyleSel] = useState<Style>('cross');
  const [color, setColor] = useState('#ffffff');
  const [gap, setGap] = useState(3);
  const [thickness, setThickness] = useState(2);
  const [length, setLength] = useState(8);
  const [outline, setOutline] = useState(true);

  const exported = useMemo(() => JSON.stringify({ styleSel, color, gap, thickness, length, outline }), [styleSel, color, gap, thickness, length, outline]);

  const save = async () => {
    const arr = (await storage.getItem<any[]>('mace_crosshairs', [])) || [];
    await storage.setItem('mace_crosshairs', [...arr, { id: Date.now(), styleSel, color, gap, thickness, length, outline }]);
    Alert.alert('Saved', 'Crosshair saved locally.');
  };

  const Preview = () => {
    const dim = 200;
    const center = dim / 2;
    const stroke = thickness;
    const off = outline ? 1 : 0;
    const lineColor = color;
    const ol = '#000';
    return (
      <View style={[styles.previewBox, { width: dim, height: dim }]} testID="crosshair-preview">
        {styleSel === 'cross' || styleSel === 'plus' || styleSel === 'tee' ? (
          <>
            {/* top */}
            {(styleSel === 'cross' || styleSel === 'plus') && (
              <View style={{ position: 'absolute', left: center - stroke / 2 - off, top: center - gap - length - off,
                width: stroke + 2 * off, height: length + 2 * off, backgroundColor: ol }} />
            )}
            {(styleSel === 'cross' || styleSel === 'plus') && (
              <View style={{ position: 'absolute', left: center - stroke / 2, top: center - gap - length,
                width: stroke, height: length, backgroundColor: lineColor }} />
            )}
            {/* bottom */}
            <View style={{ position: 'absolute', left: center - stroke / 2 - off, top: center + gap - off,
              width: stroke + 2 * off, height: length + 2 * off, backgroundColor: ol }} />
            <View style={{ position: 'absolute', left: center - stroke / 2, top: center + gap,
              width: stroke, height: length, backgroundColor: lineColor }} />
            {/* left */}
            <View style={{ position: 'absolute', left: center - gap - length - off, top: center - stroke / 2 - off,
              width: length + 2 * off, height: stroke + 2 * off, backgroundColor: ol }} />
            <View style={{ position: 'absolute', left: center - gap - length, top: center - stroke / 2,
              width: length, height: stroke, backgroundColor: lineColor }} />
            {/* right */}
            <View style={{ position: 'absolute', left: center + gap - off, top: center - stroke / 2 - off,
              width: length + 2 * off, height: stroke + 2 * off, backgroundColor: ol }} />
            <View style={{ position: 'absolute', left: center + gap, top: center - stroke / 2,
              width: length, height: stroke, backgroundColor: lineColor }} />
            {styleSel === 'plus' && (
              <View style={{ position: 'absolute', left: center - stroke / 2, top: center - stroke / 2,
                width: stroke, height: stroke, backgroundColor: lineColor }} />
            )}
          </>
        ) : null}
        {styleSel === 'dot' && (
          <>
            <View style={{ position: 'absolute', left: center - stroke - off, top: center - stroke - off,
              width: stroke * 2 + 2 * off, height: stroke * 2 + 2 * off, backgroundColor: ol }} />
            <View style={{ position: 'absolute', left: center - stroke, top: center - stroke,
              width: stroke * 2, height: stroke * 2, backgroundColor: lineColor }} />
          </>
        )}
        {styleSel === 'circle' && (
          <View style={{ position: 'absolute', left: center - length, top: center - length,
            width: length * 2, height: length * 2, borderWidth: stroke, borderColor: lineColor, borderRadius: length }} />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']} testID="crosshair-screen">
      <Stack.Screen options={{ title: 'CROSSHAIR MAKER',
        headerStyle: { backgroundColor: theme.colors.dirtDark },
        headerTitleStyle: { color: theme.colors.gold, fontFamily: theme.font, fontSize: 16 },
        headerTintColor: theme.colors.gold }} />
      <ImageBackground source={{ uri: theme.media.stone }} resizeMode="repeat" style={styles.bg} imageStyle={{ opacity: 0.15 }}>
        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}>
          <View style={styles.previewWrap}><Preview /></View>

          <Label>STYLE</Label>
          <View style={styles.chipsRow}>
            {(['cross', 'plus', 'dot', 'circle'] as Style[]).map((s) => (
              <TouchableOpacity key={s} testID={`style-${s}`} onPress={() => setStyleSel(s)}
                style={[styles.chip, styleSel === s && styles.chipActive]}>
                <Text style={[styles.chipTxt, styleSel === s && styles.chipTxtActive]}>{s.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Label>COLOR</Label>
          <View style={styles.chipsRow}>
            {COLORS.map((c) => (
              <TouchableOpacity key={c} testID={`color-${c}`} onPress={() => setColor(c)}
                style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]} />
            ))}
          </View>

          <Slider label={`GAP (${gap})`} val={gap} min={0} max={12} on={setGap} testID="slider-gap" />
          <Slider label={`THICKNESS (${thickness})`} val={thickness} min={1} max={6} on={setThickness} testID="slider-thickness" />
          <Slider label={`LENGTH (${length})`} val={length} min={2} max={20} on={setLength} testID="slider-length" />

          <TouchableOpacity onPress={() => setOutline(!outline)} testID="toggle-outline" style={[styles.chip, outline && styles.chipActive, { alignSelf: 'flex-start' }]}>
            <Text style={[styles.chipTxt, outline && styles.chipTxtActive]}>{outline ? '☑' : '☐'}  OUTLINE</Text>
          </TouchableOpacity>

          <TouchableOpacity testID="save-crosshair" onPress={save} style={styles.saveBtn}>
            <Text style={styles.saveTxt}>SAVE LOCALLY</Text>
          </TouchableOpacity>

          <Label>EXPORT CODE</Label>
          <View style={styles.exportBox}>
            <Text style={styles.exportTxt} selectable testID="export-code">{exported}</Text>
          </View>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

function Label({ children }: { children: any }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Slider({ label, val, min, max, on, testID }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TouchableOpacity testID={`${testID}-dec`} onPress={() => on(Math.max(min, val - 1))} style={styles.stepBtn}><Text style={styles.stepTxt}>−</Text></TouchableOpacity>
        <View style={styles.bar}>
          <View style={{ height: '100%', width: `${((val - min) / (max - min)) * 100}%`, backgroundColor: theme.colors.emerald }} />
        </View>
        <TouchableOpacity testID={`${testID}-inc`} onPress={() => on(Math.min(max, val + 1))} style={styles.stepBtn}><Text style={styles.stepTxt}>+</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bg: { flex: 1 },
  previewWrap: { alignItems: 'center', backgroundColor: '#1a1a1a', borderColor: theme.colors.borderDark, borderWidth: 4, padding: 20, marginBottom: theme.spacing.md },
  previewBox: { position: 'relative' },
  label: { fontFamily: theme.font, fontSize: 11, color: theme.colors.gold, marginTop: 6, marginBottom: 6, letterSpacing: 1 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: { backgroundColor: theme.colors.bgDark, borderColor: theme.colors.borderDark, borderWidth: 2, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: theme.colors.emeraldDark, borderColor: theme.colors.emerald },
  chipTxt: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, fontWeight: 'bold' },
  chipTxtActive: { color: '#fff' },
  swatch: { width: 36, height: 36, borderColor: theme.colors.borderDark, borderWidth: 2 },
  swatchActive: { borderColor: theme.colors.gold, borderWidth: 4 },
  bar: { flex: 1, height: 18, backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 2 },
  stepBtn: { width: 36, height: 22, backgroundColor: theme.colors.stoneDark, borderColor: theme.colors.borderDark, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontFamily: theme.font, color: '#fff', fontSize: 16, fontWeight: 'bold' },
  saveBtn: { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emeraldDark, borderWidth: 4, borderBottomWidth: 8, paddingVertical: 12, alignItems: 'center', marginTop: theme.spacing.md },
  saveTxt: { fontFamily: theme.font, fontSize: 14, color: '#fff', fontWeight: 'bold', letterSpacing: 2, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 } },
  exportBox: { backgroundColor: theme.colors.obsidian, borderColor: theme.colors.borderDark, borderWidth: 2, padding: 10, marginTop: 6 },
  exportTxt: { fontFamily: theme.font, fontSize: 11, color: theme.colors.diamond },
});
