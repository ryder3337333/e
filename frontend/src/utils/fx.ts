import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Centralised feedback helper: haptics + (optional) sound.
 * Web is no-op for haptics. Sound is intentionally lightweight
 * (uses Web Audio API beep on web, expo-av on native).
 */
export type FxKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'select';

export function haptic(kind: FxKind = 'light') {
  if (Platform.OS === 'web') return;
  try {
    switch (kind) {
      case 'light':   return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'medium':  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'heavy':   return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case 'success': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      case 'error':   return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      case 'select':  return Haptics.selectionAsync();
    }
  } catch {}
}

// Lightweight WebAudio beeps for the web preview (no asset loading needed).
let _ctx: any = null;
function webBeep(freq: number, dur = 0.08, type: OscillatorType = 'square', vol = 0.08) {
  if (Platform.OS !== 'web') return;
  try {
    const W: any = globalThis as any;
    if (!_ctx) _ctx = new (W.AudioContext || W.webkitAudioContext)();
    const o = _ctx.createOscillator();
    const g = _ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(_ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, _ctx.currentTime + dur);
    o.stop(_ctx.currentTime + dur + 0.02);
  } catch {}
}

export function sfxClick()    { webBeep(660, 0.05, 'square', 0.05); }
export function sfxHit()      { webBeep(880, 0.06, 'square', 0.07); }
export function sfxMiss()     { webBeep(220, 0.08, 'sawtooth', 0.06); }
export function sfxLevelUp()  { webBeep(660, 0.07); setTimeout(() => webBeep(880, 0.08), 80); setTimeout(() => webBeep(1320, 0.12), 170); }
export function sfxError()    { webBeep(180, 0.18, 'sawtooth', 0.08); }
export function sfxNotify()   { webBeep(880, 0.06); setTimeout(() => webBeep(1175, 0.08), 100); }

// Composed helpers used across screens
export function fxTap()       { haptic('light');   sfxClick();    }
export function fxSelect()    { haptic('select');  sfxClick();    }
export function fxSuccess()   { haptic('success'); sfxLevelUp();  }
export function fxError()     { haptic('error');   sfxError();    }
export function fxHit()       { haptic('medium');  sfxHit();      }
export function fxMiss()      { haptic('warning'); sfxMiss();     }
export function fxHeavy()     { haptic('heavy');   sfxHit();      }
export function fxNotify()    { haptic('success'); sfxNotify();   }
