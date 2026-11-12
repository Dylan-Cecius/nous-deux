import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Chips, Empty, Ionicons, Row, Screen, SectionTitle, Sheet, T } from '@/components/ui';
import { Fonts, useTheme } from '@/constants/theme';
import { useCollection, useSession } from '@/lib/couple-context';
import { BUDGET_LABELS, drawRitual, filterRituals, RITUALS, type Ritual, type RitualBudget, type RitualSetting } from '@/lib/rituals';
import { useSubscription } from '@/lib/subscription';

type Budget = RitualBudget | 'tous';
type Setting = RitualSetting | 'partout';
type Duration = 'toutes' | '30' | '60';

export default function Rituals() {
  const t = useTheme();
  const { backend } = useSession();
  const { active } = useSubscription();
  const items = useCollection('items');
  const [budget, setBudget] = useState<Budget>('tous');
  const [setting, setSetting] = useState<Setting>('partout');
  const [duration, setDuration] = useState<Duration>('toutes');
  const [drawnId, setDrawnId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ideas = filterRituals({
    budget: budget === 'tous' ? undefined : budget,
    setting: active && setting !== 'partout' ? setting : undefined,
    maxMinutes: active && duration !== 'toutes' ? Number(duration) : undefined,
  }, active);
  const accessible = filterRituals({}, active);
  const selected = accessible.find((idea) => idea.id === selectedId);
  const drawn = ideas.find((idea) => idea.id === drawnId) ?? ideas[0];
  const saved = (idea: Ritual) => items.some((item) => item.list === 'bucket' && item.title === idea.title);

  const save = async (idea: Ritual) => {
    if (saved(idea)) return;
    await backend.add('items', {
      list: 'bucket', title: idea.title, done: false, createdBy: backend.userId, createdAt: Date.now(),
      detail: `${idea.minutes} min · ${BUDGET_LABELS[idea.budget]}\n${idea.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`,
    });
  };

  return (
    <Screen overline="Du temps pour nous" title="Nos petits rituels" onBack={() => router.back()}>
      <T variant="quote" muted>Les plus beaux moments commencent souvent par une petite idée.</T>
      <Row style={{ gap: 8 }}>
        <Ionicons name="sparkles-outline" size={16} color={t.primary} />
        <T variant="small" color={t.primary}>{active ? `${RITUALS.length} idées à explorer avec Plus` : '12 idées offertes, à vivre à votre rythme'}</T>
      </Row>

      {drawn && (
        <Card tone="feature" style={{ padding: 24, gap: 18, overflow: 'hidden' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="caption" color={t.featureAccent}>Et si, aujourd’hui…</T>
            <Ionicons name={drawn.setting === 'maison' ? 'home-outline' : 'sunny-outline'} size={25} color={t.featureAccent} />
          </Row>
          <View style={{ gap: 8 }}>
            <T variant="title" color={t.onFeature} style={{ fontSize: 30, lineHeight: 36 }}>{drawn.title}</T>
            <T color={t.onFeatureMuted}>{drawn.subtitle}</T>
          </View>
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            <Meta text={`${drawn.minutes} min`} dark />
            <Meta text={BUDGET_LABELS[drawn.budget]} dark />
          </Row>
          <Button label="On essaie ?" icon="arrow-forward" variant="glass" onPress={() => setSelectedId(drawn.id)} />
          <Pressable accessibilityRole="button" accessibilityLabel="Proposer une autre idée" onPress={() => setDrawnId(drawRitual(ideas, drawn.id)?.id ?? null)} style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}>
            <Row><Ionicons name="shuffle-outline" size={18} color={t.onFeatureMuted} /><T variant="small" color={t.onFeatureMuted}>Une autre idée</T></Row>
          </Pressable>
        </Card>
      )}

      <SectionTitle title="Selon votre envie" />
      <Chips<Budget> value={budget} onChange={setBudget} options={[
        { value: 'tous', label: 'Tous les budgets' }, { value: 'gratuit', label: 'Gratuit' },
        { value: 'doux', label: 'Petit budget' }, { value: 'sortie', label: 'Une sortie' },
      ]} />

      {active ? (
        <Card style={{ gap: 18 }}>
          <Chips<Setting> label="Le décor" value={setting} onChange={setSetting} options={[
            { value: 'partout', label: 'Peu importe' }, { value: 'maison', label: 'À la maison', icon: 'home-outline' }, { value: 'dehors', label: 'Dehors', icon: 'leaf-outline' },
          ]} />
          <Chips<Duration> label="Votre temps" value={duration} onChange={setDuration} options={[
            { value: 'toutes', label: 'Sans limite' }, { value: '30', label: '30 min ou moins' }, { value: '60', label: '1 h ou moins' },
          ]} />
        </Card>
      ) : (
        <Card tone="soft" onPress={() => router.push('/premium')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name="options-outline" size={22} color={t.primary} />
          <View style={{ flex: 1, gap: 4 }}><T variant="bodyBold">À votre rythme, avec Plus</T><T variant="small" muted>Filtrez aussi par lieu et par durée.</T></View>
          <Ionicons name="lock-closed-outline" size={17} color={t.primary} />
        </Card>
      )}

      <SectionTitle title={`${ideas.length} idée${ideas.length > 1 ? 's' : ''} pour vous`} />
      {ideas.length === 0 ? (
        <Empty icon="leaf-outline" title="Un peu plus de liberté ?" text="Essayez un autre budget, un autre lieu ou une durée plus longue pour retrouver des idées." />
      ) : (
        <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
          {ideas.map((idea, index) => (
            <Pressable
              key={idea.id}
              accessibilityRole="button"
              accessibilityLabel={`${idea.title}, ${idea.minutes} minutes, ${BUDGET_LABELS[idea.budget]}${saved(idea) ? ', déjà dans vos rêves' : ''}`}
              onPress={() => setSelectedId(idea.id)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14, borderTopWidth: index ? 1 : 0, borderTopColor: t.line, opacity: pressed ? 0.65 : 1 })}>
              <View style={{ width: 38, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.primarySoft }}>
                <Ionicons name={saved(idea) ? 'checkmark' : idea.setting === 'maison' ? 'home-outline' : 'leaf-outline'} size={20} color={t.primary} />
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <T variant="bodyBold">{idea.title}</T>
                <T variant="small" muted>{idea.minutes} min · {BUDGET_LABELS[idea.budget]}</T>
              </View>
              <Ionicons name="chevron-forward" size={17} color={t.textSecondary} />
            </Pressable>
          ))}
        </Card>
      )}

      {!active && (
        <Card tone="soft" style={{ padding: 24, gap: 14 }}>
          <Ionicons name="heart-circle-outline" size={32} color={t.primary} />
          <T variant="h2">Encore plus de moments à deux</T>
          <T muted>Découvrez les {RITUALS.length} idées de la collection, avec des filtres pour trouver celle qui vous ressemble.</T>
          <Button label="Découvrir Nous Deux Plus" onPress={() => router.push('/premium')} variant="outline" icon="sparkles-outline" />
        </Card>
      )}
      <T variant="small" muted style={{ textAlign: 'center' }}>Les budgets sont indicatifs. Adaptez chaque idée à vos envies et à vos possibilités.</T>

      {selected && (
        <Sheet visible title={selected.title} onClose={() => setSelectedId(null)}>
          <T variant="quote" muted>{selected.subtitle}</T>
          <Row style={{ flexWrap: 'wrap' }}><Meta text={`${selected.minutes} min`} /><Meta text={BUDGET_LABELS[selected.budget]} /><Meta text={selected.setting === 'maison' ? 'À la maison' : 'Dehors'} /></Row>
          <View style={{ gap: 20, paddingVertical: 8 }}>
            {selected.steps.map((step, index) => (
              <Row key={step} style={{ alignItems: 'flex-start', gap: 14 }}>
                <T color={t.primary} style={{ fontFamily: Fonts.display, fontSize: 24, width: 24 }}>{index + 1}</T>
                <T style={{ flex: 1 }}>{step}</T>
              </Row>
            ))}
          </View>
          <Button label={saved(selected) ? 'Ajouté à nos rêves' : 'Ajouter à nos rêves'} icon={saved(selected) ? 'checkmark' : 'heart-outline'} disabled={saved(selected)} onPress={() => save(selected)} />
          <T variant="small" muted style={{ textAlign: 'center' }}>Retrouvez cette idée dans Listes → Rêves, avec toutes les étapes.</T>
        </Sheet>
      )}
    </Screen>
  );
}

function Meta({ text, dark = false }: { text: string; dark?: boolean }) {
  const t = useTheme();
  return <View style={{ backgroundColor: dark ? 'rgba(255,255,255,0.1)' : t.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}><T variant="small" color={dark ? t.onFeatureMuted : t.primaryDark}>{text}</T></View>;
}
