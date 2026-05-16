import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.dirtDark,
          borderBottomColor: theme.colors.borderDark,
          borderBottomWidth: 4,
        },
        headerTitleStyle: {
          color: theme.colors.gold,
          fontFamily: theme.font,
          fontSize: 18,
          textTransform: 'uppercase',
          letterSpacing: 1,
        },
        headerTintColor: theme.colors.gold,
        tabBarStyle: {
          backgroundColor: theme.colors.bgDark,
          borderTopColor: theme.colors.borderDark,
          borderTopWidth: 4,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 6,
        },
        tabBarActiveTintColor: theme.colors.emerald,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: {
          fontFamily: theme.font,
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          tabBarButtonTestID: 'tab-home',
        }}
      />
      <Tabs.Screen
        name="guide"
        options={{
          title: 'Guide',
          tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} />,
          tabBarButtonTestID: 'tab-guide',
        }}
      />
      <Tabs.Screen
        name="loadout"
        options={{
          title: 'Loadout',
          tabBarIcon: ({ color, size }) => <Ionicons name="hammer" size={size} color={color} />,
          tabBarButtonTestID: 'tab-loadout',
        }}
      />
      <Tabs.Screen
        name="forum"
        options={{
          title: 'Forum',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
          tabBarButtonTestID: 'tab-forum',
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Coach',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} />,
          tabBarButtonTestID: 'tab-chat',
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Ionicons name="apps" size={size} color={color} />,
          tabBarButtonTestID: 'tab-more',
        }}
      />
    </Tabs>
  );
}
