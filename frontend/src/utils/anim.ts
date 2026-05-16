import { useEffect, useRef } from 'react';
import { Animated, Easing, ViewStyle } from 'react-native';

export function useEntranceFade(delay = 0, dist = 12, duration = 320): { style: ViewStyle } {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(dist)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, delay, duration]);
  return { style: { opacity, transform: [{ translateY }] } as any };
}

export function usePulse(active: boolean) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) { scale.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.06, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.0,  duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, scale]);
  return { style: { transform: [{ scale }] } as any };
}

export function pressIn(scale: Animated.Value) {
  Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, friction: 5, tension: 120 }).start();
}

export function pressOut(scale: Animated.Value) {
  Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 120 }).start();
}

// Animated number rollup (kept lightweight for web compat)
export function useCountUp(value: number, duration = 600) {
  const anim = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, duration, anim]);
  return anim;
}
