import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { InvitationCard } from '@/components/invitation-card';
import { HomeHero } from '@/components/home/home-hero';
import { NoteCard, PingCard } from '@/components/home/love-cards';
import { MemoriesStrip } from '@/components/home/memories-strip';
import { QuestionCard } from '@/components/home/question-card';
import { DateField } from '@/components/pickers';
import { Button, Card, confirmDelete, Field, Ionicons, Row, Screen, SectionTitle, Sheet, T } from '@/components/ui';
import { cardShadow, useTheme } from '@/constants/theme';
import { useCollection, useSession } from '@/lib/couple-context';
import { daysBetween, fromKey, nextOccurrence, todayKey } from '@/lib/dates';
import { useTodayKey } from '@/lib/use-today';

export default function Home() {
  const t = useTheme();
  const { backend, nameOf, colorOf } = useSession();
  const dates = useCollection('dates');
  const events = useCollection('events');
  const [dateOpen, setDateOpen] = useState(false);

  const today = useTodayKey();
  const todayEvents = events.filter((e) => e.date === today).sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = dates
    .map((d) => {
      const next = nextOccurrence(d.date, d.yearly);
      return { ...d, next, left: daysBetween(today, next) };
    })
    .filter((d) => d.left >= 0)
    .sort((a, b) => a.left - b.left);

  return (
    <Screen hero={<HomeHero />}>
      <InvitationCard />
      <View style={{ gap: 12 }}>
        <T variant="caption" muted style={{ fontSize: 10 }}>Un peu de temps pour nous</T>
        <Card tone="soft" onPress={() => router.push('/rituels')} style={{ padding: 20, gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sparkles-outline" size={22} color={t.primary} />
            </View>
            <T variant="caption" color={t.primaryDark} style={{ fontSize: 9, letterSpacing: 1, flex: 1, textAlign: 'right' }}>Le rendez-vous des petits bonheurs</T>
          </Row>
          <T variant="h2">Et si on se retrouvait ?</T>
          <T variant="small" muted>À la maison ou dehors, une idée pour sortir du quotidien. Même avec 0 € et 15 minutes.</T>
          <Row style={{ gap: 7 }}><T variant="bodyBold" color={t.primaryDark} style={{ fontSize: 14 }}>Trouver notre prochain moment</T><Ionicons name="arrow-forward" size={17} color={t.primaryDark} /></Row>
        </Card>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {([
          { title: 'Notre agenda', subtitle: 'Faire de la place à deux', icon: 'calendar-outline', path: '/agenda' },
          { title: 'Nos envies', subtitle: 'Les petits et grands rêves', icon: 'heart-outline', path: '/listes' },
        ] as const).map((item) => (
          <Card key={item.path} onPress={() => router.push(item.path)} style={{ flex: 1, padding: 15, gap: 8 }}>
            <Ionicons name={item.icon} size={22} color={t.primary} />
            <T variant="h3" style={{ fontSize: 14 }}>{item.title}</T>
            <T variant="small" muted style={{ fontSize: 12 }}>{item.subtitle}</T>
          </Card>
        ))}
      </View>

      <SectionTitle title="Le lien, au quotidien" />
      <PingCard />
      <NoteCard />
      <QuestionCard />

      {/* Aujourd'hui */}
      <SectionTitle title="Aujourd’hui" action="L’agenda" onAction={() => router.push('/agenda')} />
      <Card style={{ gap: 14 }}>
        {todayEvents.length === 0 ? (
          <Row style={{ gap: 12 }}>
            <Ionicons name="sunny-outline" size={22} color={t.primary} />
            <View style={{ flex: 1, gap: 4 }}><T variant="h3">De la place pour l’imprévu</T><T variant="small" muted>Votre agenda est libre aujourd’hui.</T></View>
          </Row>
        ) : (
          todayEvents.map((e) => (
            <Row key={e.id} style={{ gap: 12 }}>
              <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colorOf(e.who) }} />
              <View style={{ flex: 1 }}>
                <T variant="h3" numberOfLines={1}>
                  {e.title}
                </T>
                <T variant="small" muted>
                  {e.start} – {e.end} · {nameOf(e.who)}
                </T>
              </View>
            </Row>
          ))
        )}
      </Card>

      {/* Comptes à rebours */}
      <SectionTitle title="À venir" action="Ajouter" onAction={() => setDateOpen(true)} />
      {upcoming.length === 0 ? (
        <Card onPress={() => setDateOpen(true)}>
          <Row style={{ gap: 12 }}>
            <Ionicons name="hourglass-outline" size={22} color={t.primary} />
            <T muted style={{ flex: 1 }}>
              Vacances, anniversaire, concert… ajoutez les dates que vous attendez. Vous recevrez un rappel la veille.
            </T>
          </Row>
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {upcoming.map((d, i) => (
            <Pressable
              key={d.id}
              onLongPress={() => confirmDelete(d.title, () => backend.remove('dates', d.id))}
              style={[
                { width: '48.5%', flexGrow: 1, backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 4 },
                cardShadow(t.shadow),
              ]}>
              <T variant="title" color={i % 2 === 0 ? t.primary : '#2F5D9E'}>
                {d.left === 0 ? 'Jour J' : `J-${d.left}`}
              </T>
              <T variant="h3" numberOfLines={2}>
                {d.title}
              </T>
              <T variant="small" muted>
                {fromKey(d.next).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
              </T>
            </Pressable>
          ))}
        </View>
      )}

      <MemoriesStrip />

      <DateSheet visible={dateOpen} onClose={() => setDateOpen(false)} onSave={(d) => backend.add('dates', d)} />
    </Screen>
  );
}

function DateSheet({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (d: { title: string; emoji: string; date: string; yearly: boolean }) => Promise<void>;
}) {
  const t = useTheme();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [yearly, setYearly] = useState(false);

  return (
    <Sheet visible={visible} title="Nouvelle date" onClose={onClose}>
      <Field label="Quoi ?" value={title} maxLength={200} onChangeText={setTitle} placeholder="Nos vacances en Italie" />
      <DateField label="Date" value={date} onChange={setDate} />
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T variant="bodyBold">Revient chaque année</T>
          <T variant="small" muted>
            Anniversaires, date de rencontre…
          </T>
        </View>
        <Switch value={yearly} onValueChange={setYearly} trackColor={{ true: t.primary }} />
      </Row>
      <Button
        label="Ajouter"
        disabled={!title.trim()}
        onPress={async () => {
          await onSave({ title: title.trim(), emoji: '', date, yearly });
          setTitle('');
          setDate(todayKey());
          setYearly(false);
          onClose();
        }}
      />
    </Sheet>
  );
}
