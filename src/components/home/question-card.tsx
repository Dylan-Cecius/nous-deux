import { useState } from 'react';
import { View } from 'react-native';

import { showDialog } from '@/components/dialog';
import { Button, Card, Dot, Field, IconButton, Ionicons, Row, T } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { notifyPartner } from '@/lib/assistant';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { todayKey } from '@/lib/dates';
import { success } from '@/lib/haptics';
import { questionFor } from '@/lib/questions';
import type { Member } from '@/lib/types';

/**
 * Question du jour. Chacun répond de son côté ; la réponse de l'autre ne se dévoile
 * qu'une fois qu'on a soi-même répondu.
 */
export function QuestionCard() {
  const { backend } = useSession();
  const today = todayKey();
  // Les brouillons survivent à une reprise, mais ne passent pas à une autre session/question.
  return <DailyQuestion key={JSON.stringify([backend.mode, backend.coupleId, backend.userId, today])} today={today} />;
}

function DailyQuestion({ today }: { today: string }) {
  const t = useTheme();
  const session = useSession();
  const { backend, members, me } = session;
  const { items: answers, loading, error, retry } = useCollectionState('answers');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
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
          <AnswerField key={m.id} member={m} isMe={m.id === me?.id} date={today}
            text={drafts[m.id] ?? ''} onChangeText={(text) => setDrafts((previous) => ({ ...previous, [m.id]: text }))} />
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

function AnswerField({ member, isMe, date, text, onChangeText }: {
  member: Member; isMe: boolean; date: string; text: string; onChangeText: (text: string) => void;
}) {
  const session = useSession();
  const { backend } = session;
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await backend.add('answers', { date, from: member.id, text: text.trim(), createdAt: Date.now() });
      success();
      if (backend.mode === 'cloud') await notifyPartner(session, 'Question du jour');
    } catch (error) {
      showDialog('Réponse non enregistrée', error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 6 }}>
      <Row style={{ gap: 6 }}>
        <Dot color={member.color} />
        <T variant="bodyBold" style={{ fontSize: 14 }}>
          {isMe ? 'Ta réponse' : member.name}
        </T>
      </Row>
      <Row>
        <Field value={text} onChangeText={onChangeText} placeholder="Écris ta réponse…" grow maxLength={4000} editable={!busy} onSubmitEditing={submit} />
        <IconButton icon="checkmark" label="Valider la réponse" variant="primary" onPress={submit} size={50} />
      </Row>
    </View>
  );
}
