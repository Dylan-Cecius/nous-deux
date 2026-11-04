import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { showDialog } from '@/components/dialog';
import { Button, Card, Dot, Field, IconButton, Ionicons, Row, T } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { notifyPartner } from '@/lib/assistant';
import type { Backend } from '@/lib/backend';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { todayKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { success } from '@/lib/haptics';
import { questionFor } from '@/lib/questions';
import type { Member } from '@/lib/types';

// Called only by the submit event, never while deriving the displayed question.
const writeAnswer = (backend: Backend, date: string, from: string, text: string) =>
  backend.add('answers', { date, from, text, createdAt: Date.now() });

/**
 * Question du jour. Chacun répond de son côté ; la réponse de l'autre ne se dévoile
 * qu'une fois qu'on a soi-même répondu.
 */
export function QuestionCard() {
  const { backend } = useSession();
  const today = useToday();
  // Les brouillons survivent à une reprise, mais ne passent pas à une autre session/question.
  return <DailyQuestion key={JSON.stringify([backend.mode, backend.coupleId, backend.userId, today])} today={today} />;
}

function DailyQuestion({ today }: { today: string }) {
  const t = useTheme();
  const session = useSession();
  const { backend, members, me } = session;
  const { items: answers, loading, error, retry } = useCollectionState('answers');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const ready = !loading && !error;
  const memberIds = JSON.stringify(members.map((m) => m.id).sort());
  const context = useMemo(() => ({ backend, ready, memberIds }), [backend, ready, memberIds]);
  const latest = useRef<{ context: typeof context; drafts: typeof drafts; answers: typeof answers } | null>(null);
  const locked = useRef(new Set<string>());
  const recorded = useRef(new Map<typeof backend, Set<string>>());
  const [acknowledged, setAcknowledged] = useState<{ backend: typeof backend; ids: string[] }>({ backend, ids: [] });
  const [pending, setPending] = useState<Record<string, boolean>>({});
  useEffect(() => {
    latest.current = { context, drafts, answers };
    return () => { latest.current = null; };
  }, [context, drafts, answers]);
  const isCurrent = () => latest.current?.context === context && today === todayKey();
  const canAnswerNow = (id: string) => isCurrent() && ready && members.some((m) => m.id === id) &&
    (backend.mode === 'local' || id === backend.userId) &&
    !latest.current?.answers.some((a) => a.date === today && a.from === id) && !recorded.current.get(backend)?.has(id);
  const change = (id: string, value: string) => {
    if (!canAnswerNow(id) || locked.current.has(id) || !latest.current) return;
    const next = { ...latest.current.drafts, [id]: value };
    latest.current.drafts = next;
    setDrafts(next);
  };
  const submit = async (id: string) => {
    if (!canAnswerNow(id) || locked.current.has(id)) return;
    const text = latest.current?.drafts[id]?.trim() ?? '';
    if (!text || text.length > 4000) return;
    locked.current.add(id);
    setPending((previous) => ({ ...previous, [id]: true }));
    try {
      await writeAnswer(backend, today, id, text);
      // Retain the acknowledgement while waiting for the collection snapshot,
      // including a temporary read error. Never resend a confirmed answer.
      const ids = recorded.current.get(backend) ?? new Set<string>();
      ids.add(id);
      recorded.current.set(backend, ids);
      if (latest.current?.context.backend === backend) setAcknowledged({ backend, ids: [...ids] });
      if (!isCurrent()) return;
      success();
      if (backend.mode === 'cloud') await notifyPartner(session, 'Question du jour');
    } catch {
      if (isCurrent()) showDialog('Enregistrement non confirmé', 'Ta réponse est conservée. Recharge les réponses pour vérifier si elle a été enregistrée avant de réessayer.');
    } finally {
      locked.current.delete(id);
      if (latest.current) setPending((previous) => ({ ...previous, [id]: false }));
    }
  };
  const ofToday = answers.filter((a) => a.date === today);
  const answerOf = (id: string) => ofToday.find((a) => a.from === id);
  const iAnswered = !!answerOf(backend.userId);

  return (
    <Card style={{ gap: 14 }}>
      <Row style={{ gap: 8 }}>
        <Ionicons name="chatbubbles-outline" size={18} color={t.primary} />
        <T variant="caption" color={t.primary}>
          Question du jour
        </T>
      </Row>
      <T variant="h2">{questionFor(today)}</T>
      {backend.mode === 'local' && (
        <T variant="small" muted>En mode sans compte, vous répondez sur ce téléphone et les réponses sont visibles dès leur enregistrement.</T>
      )}
      {loading ? (
        <T muted>Chargement des réponses…</T>
      ) : error ? (
        <View style={{ gap: 10 }}>
          <T>Impossible de charger les réponses. Vérifie ta connexion puis réessaie. Ton brouillon est conservé tant que tu restes sur cet écran.</T>
          <Button label="Réessayer" onPress={retry} />
        </View>
      ) : members.map((m) => {
        const answer = answerOf(m.id);
        // En mode local, les deux réponses se saisissent sur ce téléphone.
        const canAnswer = !answer && (m.id === backend.userId || backend.mode === 'local');
        if (canAnswer) return (
          <AnswerField key={m.id} member={m} isMe={m.id === me?.id}
            text={drafts[m.id] ?? ''} busy={!!pending[m.id]} recorded={acknowledged.backend === backend && acknowledged.ids.includes(m.id)}
            onChangeText={(text) => change(m.id, text)} onSubmit={() => submit(m.id)} />
        );
        return (
          <View key={m.id} style={{ gap: 4 }}>
            <Row style={{ gap: 6 }}>
              <Dot color={m.color} />
              <T variant="bodyBold" style={{ fontSize: 14 }}>
                {m.name}
              </T>
            </Row>
            {answer?.text && (iAnswered || backend.mode === 'local') ? (
              <T>{answer.text}</T>
            ) : answer ? (
              <Row style={{ gap: 6 }}>
                <Ionicons name="lock-closed-outline" size={14} color={t.textSecondary} />
                <T variant="small" muted>
                  A déjà répondu. Réponds pour découvrir sa réponse !
                </T>
              </Row>
            ) : (
              <T variant="small" muted>
                Pas encore répondu…
              </T>
            )}
          </View>
        );
      })}
    </Card>
  );
}

function AnswerField({ member, isMe, text, onChangeText, onSubmit, busy, recorded }: {
  member: Member; isMe: boolean; text: string; onChangeText: (text: string) => void;
  onSubmit: () => Promise<void>; busy: boolean; recorded: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Row style={{ gap: 6 }}>
        <Dot color={member.color} />
        <T variant="bodyBold" style={{ fontSize: 14 }}>
          {isMe ? 'Ta réponse' : member.name}
        </T>
      </Row>
      <Row>
        <Field accessibilityLabel={isMe ? 'Ta réponse à la question du jour' : `Réponse de ${member.name} à la question du jour`} value={text} onChangeText={onChangeText} placeholder="Écris ta réponse…" grow maxLength={4000} editable={!busy && !recorded} onSubmitEditing={onSubmit} />
        <IconButton icon="checkmark" label="Valider la réponse" variant="primary" onPress={onSubmit} disabled={busy || recorded || !text.trim()} size={50} />
      </Row>
      {recorded && <T variant="small" muted>Réponse enregistrée. Actualisation en cours…</T>}
    </View>
  );
}
