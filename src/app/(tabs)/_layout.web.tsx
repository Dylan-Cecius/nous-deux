import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { AssistantProvider } from '@/components/assistant';
import { BackgroundTasks } from '@/components/background-tasks';
import { Fonts, useTheme } from '@/constants/theme';

// Version web (aperçu sur ordinateur) : les onglets natifs n'existent que sur iOS/Android.
type IconName = ComponentProps<typeof Ionicons>['name'];
const icon = (outline: IconName, filled: IconName) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} size={24} color={color} />;
  };

export default function TabsLayout() {
  const t = useTheme();
  return (
    <AssistantProvider>
      <BackgroundTasks />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: t.primary,
          tabBarInactiveTintColor: t.textSecondary,
          tabBarLabelStyle: { fontFamily: Fonts.bodyMedium, fontSize: 11 },
          tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border, height: 64, paddingTop: 6 },
        }}>
        <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('heart-outline', 'heart') }} />
        <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: icon('calendar-outline', 'calendar') }} />
        <Tabs.Screen name="restos" options={{ title: 'Restos', tabBarIcon: icon('restaurant-outline', 'restaurant') }} />
        <Tabs.Screen name="listes" options={{ title: 'Listes', tabBarIcon: icon('checkbox-outline', 'checkbox') }} />
        <Tabs.Screen name="nous" options={{ title: 'Nous', tabBarIcon: icon('people-outline', 'people') }} />
      </Tabs>
    </AssistantProvider>
  );
}
