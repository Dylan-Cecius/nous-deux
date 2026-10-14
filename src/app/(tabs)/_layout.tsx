import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { AssistantProvider } from '@/components/assistant';
import { BackgroundTasks } from '@/components/background-tasks';
import { Fonts, useTheme } from '@/constants/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <AssistantProvider>
      <BackgroundTasks />
      <NativeTabs
        backgroundColor={t.card}
        indicatorColor={t.primarySoft}
        tintColor={t.primary}
        labelStyle={{ default: { fontFamily: Fonts.bodyMedium }, selected: { color: t.primary, fontFamily: Fonts.bodyBold } }}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Accueil</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} md="favorite" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="agenda">
          <NativeTabs.Trigger.Label>Agenda</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="restos">
          <NativeTabs.Trigger.Label>Restos</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="fork.knife" md="restaurant" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="listes">
          <NativeTabs.Trigger.Label>Listes</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="checklist" md="checklist" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="nous">
          <NativeTabs.Trigger.Label>Nous</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </AssistantProvider>
  );
}
