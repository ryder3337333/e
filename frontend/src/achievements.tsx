import React, { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react';
import { Animated, StyleSheet, Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';
import { fxNotify } from './utils/fx';

export type Achievement = {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond' | 'netherite';
  unlocked: boolean;
  unlocked_at?: string | null;
  progress?: number;
  target?: number;
};

type Ctx = {
  show: (a: Achievement | Achievement[]) => void;
};

const AchievementCtx = createContext<Ctx | null>(null);

export function AchievementProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const show = useCallback((a: Achievement | Achievement[]) => {
    const items = Array.isArray(a) ? a : [a];
    if (items.length === 0) return;
    setQueue((q) => [...q, ...items]);
  }, []);
  return (
    <AchievementCtx.Provider value={{ show }}>
      {children}
      <ToastQueue queue={queue} setQueue={setQueue} />
    </AchievementCtx.Provider>
  );
}

export function useAchievements(): Ctx {
  const ctx = useContext(AchievementCtx);
  if (!ctx) return { show: () => {} }; // no-op outside provider
  return ctx;
}

// Empty exported component (kept for backwards compatibility with imports)
export function AchievementToast() { return null; }

function ToastQueue({ queue, setQueue }: { queue: Achievement[]; setQueue: any }) {
  const [current, setCurrent] = useState<Achievement | null>(null);
  const translate = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!current && queue.length > 0) {
      const next = queue[0];
      setQueue((q: Achievement[]) => q.slice(1));
      setCurrent(next);
    }
  }, [queue, current, setQueue]);

  useEffect(() => {
    if (!current) return;
    fxNotify();
    Animated.parallel([
      Animated.spring(translate, { toValue: 0, useNativeDriver: true, friction: 7, tension: 80 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translate, { toValue: -120, duration: 280, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setCurrent(null));
    }, 3200);
    return () => clearTimeout(t);
  }, [current, translate, opacity]);

  if (!current) return null;
  const tierColor =
    current.tier === 'netherite' ? '#1a1a1a' :
    current.tier === 'diamond'   ? theme.colors.diamond :
    current.tier === 'gold'      ? theme.colors.gold :
    current.tier === 'silver'    ? '#c4c4c4' :
                                   '#cd7f32';

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { transform: [{ translateY: translate }], opacity }]}>
      <View style={[styles.card, { borderTopColor: tierColor }]}>
        <View style={[styles.iconWrap, { backgroundColor: tierColor }]}>
          <Ionicons name={(current.icon as any) || 'trophy'} size={26} color="#0a0a0a" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.head}>★ ACHIEVEMENT UNLOCKED</Text>
          <Text style={styles.title}>{current.name}</Text>
          <Text style={styles.desc} numberOfLines={2}>{current.description}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', top: Platform.OS === 'web' ? 12 : 50,
    left: 12, right: 12, zIndex: 9999,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.dirtDark,
    borderColor: theme.colors.borderDark, borderWidth: 4,
    borderTopWidth: 8, borderBottomWidth: 6,
    padding: 12, gap: 12, width: '100%', maxWidth: 460,
  },
  iconWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderColor: '#000', borderWidth: 2 },
  head: { fontFamily: theme.fontPixel, fontSize: 8, color: theme.colors.gold, letterSpacing: 1, marginBottom: 4 },
  title: { fontFamily: theme.fontPixel, fontSize: 11, color: theme.colors.text, letterSpacing: 1 },
  desc: { fontFamily: theme.font, fontSize: 11, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 15 },
});
