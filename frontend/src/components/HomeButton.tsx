import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';

export function HomeButton() {
  const router = useRouter();
  const onPress = () => {
    // Always land back on the Home tab.
    try {
      // Replace clears the stack so back-button history doesn't pile up.
      router.replace('/');
    } catch {
      router.push('/');
    }
  };
  return (
    <TouchableOpacity
      testID="header-home-x"
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      style={styles.btn}
    >
      <Ionicons name="close" size={22} color={theme.colors.gold} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bgDark,
    borderColor: theme.colors.borderDark,
    borderWidth: 2,
    borderBottomWidth: 4,
    marginRight: Platform.OS === 'ios' ? 8 : 12,
  },
});
