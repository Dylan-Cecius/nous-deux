import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';

import { AccountCard } from '@/components/account';
import { Avatar, Button, Card, ColorPicker, Field, IconButton, Ionicons, Row, Screen, T, type IconName } from '@/components/ui';
import { showDialog } from '@/components/dialog';
import { AccentThemes, cardShadow, MemberColors, usePrefs, useTheme, type AccentId } from '@/constants/theme';
import { useCollection, useSession } from '@/lib/couple-context';
import { tap } from '@/lib/haptics';
import { ensurePermission } from '@/lib/notifications';
import type { Member } from '@/lib/types';

function LinkRow({ icon, title, detail, onPress, first }: { icon: IconName; title: string; detail: string; onPress: () => void; first?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
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
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {Object.entries(AccentThemes).map(([id, theme]) => {
          const active = id === accent;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={theme.name}
              onPress={() => {
                tap();
                setAccent(id as AccentId);
              }}
              style={{ flex: 1, alignItems: 'center', gap: 6 }}>
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
              <T variant="small" color={active ? t.text : t.textSecondary} style={{ fontSize: 12 }}>
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
  const t = useTheme();
  const { backend, members, signOut } = useSession();
  const memories = useCollection('memories');
  const expenses = useCollection('expenses');
  const canEdit = (m: Member) => backend.mode === 'local' || m.id === backend.userId;

  const leave = () =>
    showDialog(
      'Se déconnecter ?',
      backend.mode === 'cloud'
        ? 'Garde bien le code du couple pour revenir. Les données restent partagées.'
        : 'Attention : en mode local, les données de ce téléphone ne seront plus accessibles.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: signOut },
      ],
    );

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
          detail={memories.length ? `${memories.length} photo${memories.length > 1 ? 's' : ''}` : 'Votre album photo à deux'}
          onPress={() => router.push('/souvenirs')}
        />
        <LinkRow
          icon="wallet-outline"
          title="Dépenses communes"
          detail={expenses.length ? 'Qui doit combien à qui' : 'Partagez les frais à moitié'}
          onPress={() => router.push('/depenses')}
        />
        <LinkRow
          icon="notifications-outline"
          title="Notifications"
          detail="Mots doux, rappels J-1, nouveaux horaires"
          onPress={async () => {
            const granted = await ensurePermission();
            showDialog(
              granted ? 'Notifications activées' : 'Notifications désactivées',
              granted
                ? 'Tu recevras les rappels de dates et, en mode synchronisé, les messages de ta moitié.'
                : 'Active-les dans les réglages du téléphone pour recevoir rappels et mots doux.',
            );
          }}
        />
      </View>

      <AccountCard />

      <ThemePicker />

      {backend.mode === 'cloud' ? (
        <Card tone="feature" style={{ gap: 12 }}>
          <T variant="caption" color={t.onFeatureMuted}>
            Code du couple
          </T>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="title" color={t.onFeature} style={{ letterSpacing: 6 }}>
              {backend.coupleId}
            </T>
            <IconButton
              icon="share-outline"
              label="Partager le code"
              variant="accent"
              onPress={() => Share.share({ message: `Notre code Nous Deux 💞 : ${backend.coupleId}` })}
            />
          </Row>
          <T variant="small" color={t.onFeatureMuted}>
            Il permet à ta moitié de vous rejoindre, ou de retrouver vos données sur un nouveau téléphone.
          </T>
        </Card>
      ) : (
        <Card tone="soft">
          <Row style={{ gap: 10 }}>
            <Ionicons name="phone-portrait-outline" size={20} color={t.primaryDark} />
            <T variant="bodyBold" color={t.primaryDark}>
              Mode local
            </T>
          </Row>
          <T muted>Les données restent sur ce téléphone. Activez Firebase pour synchroniser vos deux téléphones.</T>
        </Card>
      )}

      <Button label="Se déconnecter" variant="danger" icon="log-out-outline" onPress={leave} />
      <T variant="small" muted style={{ textAlign: 'center' }}>
        Nous Deux · version {Constants.expoConfig?.version}
      </T>
    </Screen>
  );
}

function MemberCard({ member, editable, isMe }: { member: Member; editable: boolean; isMe: boolean }) {
  const { backend } = useSession();
  const [name, setName] = useState(member.name);

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
            <Field value={name} onChangeText={setName} grow accessibilityLabel="Prénom" />
            <Button
              label="OK"
              small
              disabled={!name.trim() || name.trim() === member.name}
              onPress={() => backend.updateMember(member.id, { name: name.trim() })}
            />
          </Row>
          <ColorPicker colors={MemberColors} value={member.color} onChange={(color) => backend.updateMember(member.id, { color })} />
        </>
      )}
    </Card>
  );
}
