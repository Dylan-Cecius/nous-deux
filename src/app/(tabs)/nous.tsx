import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { InvitationCard } from '@/components/invitation-card';
import { currentAccount } from '@/lib/backend';
import { AccountCard } from '@/components/account';
import { Avatar, Button, Card, ColorPicker, Field, Ionicons, Row, Screen, T, type IconName } from '@/components/ui';
import { showDialog } from '@/components/dialog';
import { AccentThemes, cardShadow, MemberColors, usePrefs, useTheme, type AccentId } from '@/constants/theme';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { tap } from '@/lib/haptics';
import { ensurePermission, getPushToken, pushSupported, scheduleCountdownReminders } from '@/lib/notifications';
import { useAsyncAction } from '@/lib/use-async-action';
import type { Member } from '@/lib/types';

function LinkRow({ icon, title, detail, onPress, first }: { icon: IconName; title: string; detail: string; onPress: () => void; first?: boolean }) {
  const t = useTheme();
  const { run, pending } = useAsyncAction(onPress);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={run}
      disabled={pending}
      accessibilityState={{ busy: pending, disabled: pending }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.line,
        opacity: pressed ? 0.7 : 1,
      })}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={t.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="h3">{title}</T>
        <T variant="small" muted numberOfLines={1}>
          {detail}
        </T>
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
    </Pressable>
  );
}

function ThemePicker() {
  const t = useTheme();
  const { accent, setAccent } = usePrefs();
  return (
    <Card style={{ gap: 14 }}>
      <T variant="caption" muted>
        Couleur de l’app (sur ce téléphone)
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {Object.entries(AccentThemes).map(([id, theme]) => {
          const active = id === accent;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={theme.name}
              onPress={() => {
                tap();
                setAccent(id as AccentId);
              }}
              style={{ flex: 1, minWidth: 52, alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: theme.light.feature,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 3,
                  borderColor: active ? theme.light.primary : 'transparent',
                }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: theme.light.primary }} />
              </View>
              <T variant="small" color={active ? t.text : t.textSecondary} style={{ fontSize: 12, maxWidth: '100%', textAlign: 'center' }}>
                {theme.name}
              </T>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

export default function Nous() {
  const { backend } = useSession();
  return <NousContent key={`${backend.mode}:${backend.coupleId}:${backend.userId}`} />;
}

function NousContent() {
  const t = useTheme();
  const { backend, members, signOut } = useSession();
  const memories = useCollectionState('memories');
  const expenses = useCollectionState('expenses');
  const dates = useCollectionState('dates');
  const canEdit = (m: Member) => backend.mode === 'local' || m.id === backend.userId;
  const context = useMemo(() => ({ backend }), [backend]);
  const reminderScope = useMemo(() => ({ context, items: dates.items, loading: dates.loading, error: dates.error }),
    [context, dates.items, dates.loading, dates.error]);
  const latest = useRef<{ context: typeof context; reminderScope: typeof reminderScope; dates: typeof dates; signOut: typeof signOut } | null>(null);
  const leaving = useRef<typeof context | null>(null);
  useEffect(() => {
    latest.current = { context, reminderScope, dates, signOut };
    return () => { latest.current = null; };
  }, [context, reminderScope, dates, signOut]);
  const { run: runLeave, pending: exitPending } = useAsyncAction((action: () => unknown) => action());
  const { run: runNotifications } = useAsyncAction((action: () => unknown) => action());
  const isCurrent = () => latest.current?.context === context;
  const canNotify = () => isCurrent() && leaving.current !== context;
  const datesReady = () => {
    const state = latest.current?.dates;
    if (!state) return false;
    if (state.loading || state.error) {
      showDialog(state.loading ? 'Chargement des dates' : 'Dates indisponibles',
        'Les dates ne sont pas disponibles. Attends leur chargement ou réessaie avant de continuer.');
      return false;
    }
    return true;
  };

  const enableNotifications = () => runNotifications(async () => {
    if (!canNotify()) return;
    if (Platform.OS === 'web') {
      showDialog('Notifications sur téléphone', 'Les rappels et les notifications se règlent dans l’application installée sur ton téléphone.');
      return;
    }
    if (!datesReady()) return;
    try {
      const granted = await ensurePermission();
      if (!canNotify() || !datesReady()) return;
      let pushRegistered = false;
      if (granted) {
        const scope = latest.current!.reminderScope;
        const remindersActive = () => canNotify() && latest.current?.reminderScope === scope;
        const confirmed = await scheduleCountdownReminders(latest.current!.dates.items, remindersActive);
        if (!canNotify() || !datesReady()) return;
        if (!remindersActive()) return;
        if (!confirmed) {
          showDialog('Activation interrompue', 'La programmation des rappels n’a pas pu être confirmée. Vérifie les autorisations du téléphone puis réessaie.');
          return;
        }
        if (backend.mode === 'cloud') {
          const token = await getPushToken();
          if (!canNotify() || !datesReady()) return;
          if (token) {
            await backend.call('registerPushToken', { token });
            if (!canNotify() || !datesReady()) return;
            pushRegistered = true;
          }
        }
      }
      showDialog(
        granted ? 'Rappels activés' : 'Notifications désactivées',
        granted
          ? pushRegistered
            ? 'Tes rappels de dates et les notifications de ta moitié sont activés.'
            : backend.mode === 'local'
              ? 'Tes rappels de dates sont activés sur ce téléphone.'
              : !pushSupported
                ? 'Tes rappels de dates sont activés. Les messages de ta moitié nécessitent la version installée de Nous Deux, hors Expo Go.'
                : 'Tes rappels de dates sont activés. Les messages de ta moitié n’ont pas pu être activés : réessaie dans un instant.'
          : 'Active-les dans les réglages du téléphone pour recevoir rappels et mots doux.',
      );
    } catch {
      if (canNotify()) showDialog('Activation non confirmée', 'L’activation des notifications n’a pas pu être confirmée. Certains rappels peuvent déjà être programmés. Vérifie les autorisations du téléphone, puis réessaie.');
    }
  });

  const leave = () => {
    if (!isCurrent() || leaving.current === context || exitPending) return;
    if (backend.mode === 'cloud' && currentAccount()?.anonymous) {
      showDialog('Protège ton accès', 'Ajoute un e-mail dans « Ton compte » avant de te déconnecter pour pouvoir retrouver votre espace.');
      return;
    }
    showDialog(
      'Se déconnecter ?',
      backend.mode === 'cloud'
        ? 'Tu pourras retrouver votre espace en te reconnectant avec ton e-mail et ton mot de passe.'
        : 'Attention : en mode local, les données de ce téléphone ne seront plus accessibles.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: () => runLeave(async () => {
          if (!isCurrent() || leaving.current === context) return;
          if (backend.mode === 'cloud' && currentAccount()?.anonymous) {
            showDialog('Protège ton accès', 'Ajoute un e-mail dans « Ton compte » avant de te déconnecter pour pouvoir retrouver votre espace.');
            return;
          }
          leaving.current = context;
          try { await latest.current!.signOut(); }
          catch {
            if (isCurrent()) {
              leaving.current = null;
              showDialog('Déconnexion impossible', 'Réessaie dans un instant.');
            }
          }
        }) },
      ],
    );
  };

  return (
    <Screen overline="Profils et réglages" title="Nous">
      {members.map((m) => (
        <MemberCard key={m.id} member={m} editable={canEdit(m)} isMe={m.id === backend.userId} />
      ))}

      <View style={[{ backgroundColor: t.card, borderRadius: 22, overflow: 'hidden' }, cardShadow(t.shadow)]}>
        <LinkRow
          first
          icon="images-outline"
          title="Souvenirs"
          detail={memories.loading ? 'Chargement des souvenirs…' : memories.error ? 'Souvenirs indisponibles' : memories.items.length ? `${memories.items.length} photo${memories.items.length > 1 ? 's' : ''}` : 'Votre album photo à deux'}
          onPress={() => router.push('/souvenirs')}
        />
        <LinkRow
          icon="wallet-outline"
          title="Dépenses communes"
          detail={expenses.loading ? 'Chargement des dépenses…' : expenses.error ? 'Dépenses indisponibles' : expenses.items.length ? 'Qui doit combien à qui' : 'Partagez les frais à moitié'}
          onPress={() => router.push('/depenses')}
        />
        <LinkRow
          icon="notifications-outline"
          title="Notifications"
          detail={dates.loading ? 'Chargement des dates…' : dates.error ? 'Dates indisponibles · rappels inchangés' : 'Mots doux, rappels J-1, nouveaux horaires'}
          onPress={enableNotifications}
        />
        <LinkRow icon="help-circle-outline" title="Aide et confidentialité" detail="Votre espace, vos données et vos comptes" onPress={() => router.push('/aide')} />
      </View>

      {memories.error && <Button label="Réessayer les souvenirs" variant="outline" onPress={memories.retry} />}
      {expenses.error && <Button label="Réessayer les dépenses" variant="outline" onPress={expenses.retry} />}
      {dates.error && <Button label="Réessayer les dates" variant="outline" onPress={dates.retry} />}

      <AccountCard />

      <ThemePicker />

      <InvitationCard />
      {backend.mode === 'local' && (
        <Card tone="soft"><T>Mode local : les données restent sur ce téléphone.</T></Card>
      )}

      <Button label="Se déconnecter" variant="danger" icon="log-out-outline" disabled={exitPending} onPress={leave} />
      <T variant="small" muted style={{ textAlign: 'center' }}>
        Nous Deux · version {Constants.expoConfig?.version}
      </T>
    </Screen>
  );
}

function MemberCard({ member, editable, isMe }: { member: Member; editable: boolean; isMe: boolean }) {
  const { backend, members } = useSession();
  const context = useMemo(() => ({ backend, memberId: member.id, editable }), [backend, member.id, editable]);
  const [draft, setDraft] = useState({ base: member.name, value: member.name });
  const name = draft.base !== member.name && draft.value.trim() === draft.base ? member.name : draft.value;
  // Ajustement borné au changement externe ; ne pas écraser une saisie en cours.
  if (draft.base !== member.name) setDraft({ base: member.name, value: name });
  const latest = useRef<{ context: typeof context; members: typeof members; name: string } | null>(null);
  useEffect(() => {
    latest.current = { context, members, name };
    return () => { latest.current = null; };
  }, [context, members, name]);
  const { run, pending } = useAsyncAction((action: () => unknown) => action());
  const isCurrent = () => editable && latest.current?.context === context;
  const update = (changes: { name?: string; color?: string }) => run(async () => {
    const current = latest.current?.members.find((entry) => entry.id === member.id);
    if (!isCurrent() || !current) return;
    if (changes.name !== undefined && (!changes.name || changes.name === current.name)) return;
    if (changes.color !== undefined && (!MemberColors.includes(changes.color) || changes.color === current.color)) return;
    try { await backend.updateMember(member.id, changes); }
    catch {
      if (isCurrent()) showDialog('Enregistrement non confirmé', 'Vérifie ce profil après son actualisation avant de réessayer : la modification peut déjà avoir été enregistrée. Ton prénom saisi est conservé.');
    }
  });

  return (
    <Card style={{ gap: 14 }}>
      <Row style={{ gap: 12 }}>
        <Avatar name={member.name} color={member.color} size={48} />
        <View style={{ flex: 1 }}>
          <T variant="h2">{member.name}</T>
          <T variant="small" muted>
            {isMe ? 'Toi' : 'Ta moitié'}
          </T>
        </View>
      </Row>
      {editable && (
        <>
          <Row>
            <Field value={name} maxLength={60} editable={!pending} onChangeText={(value) => run(() => {
              if (!isCurrent() || !latest.current) return;
              latest.current.name = value;
              setDraft({ base: member.name, value });
            })} grow accessibilityLabel="Prénom" />
            <Button
              label="OK"
              small
              disabled={pending || !name.trim() || name.trim() === member.name}
              onPress={() => update({ name: latest.current?.name.trim() ?? '' })}
            />
          </Row>
          <ColorPicker colors={MemberColors} value={member.color} disabled={pending} onChange={(color) => update({ color })} />
        </>
      )}
    </Card>
  );
}
