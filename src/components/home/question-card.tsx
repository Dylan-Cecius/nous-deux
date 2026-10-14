import { useState } from 'react';
import { View } from 'react-native';

import { Card, Dot, Field, IconButton, Ionicons, Row, T } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { notifyPartner } from '@/lib/assistant';
import { useCollection, useSession } from '@/lib/couple-context';
import { todayKey } from '@/lib/dates';
import { success } from '@/lib/haptics';
import { questionFor } from '@/lib/questions';
import type { Member } from '@/lib/types';

/**
 * Question du jour. Chacun répond de son côté ; la réponse de l'autre ne se dévoile
 * qu'une fois qu'on a soi-même répondu.
 */
export function QuestionCard() {
  const t = useTheme();
  const session = useSession();
  const { backend, members, me } = session;
  const answers = useCollection('answers');
  const today = todayKey();
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
      {members.map((m) => {
        const answer = answerOf(m.id);
        // En mode local, les deux réponses se saisissent sur ce téléphone.
        const canAnswer = !answer && (m.id === backend.userId || backend.mode === 'local');
        if (canAnswer) return <AnswerField key={m.id} member={m} isMe={m.id === me?.id} date={today} />;
        return (
          <View key={m.id} style={{ gap: 4 }}>
            <Row style={{ gap: 6 }}>
              <Dot color={m.color} />
              <T variant="bodyBold" style={{ fontSize: 14 }}>
                {m.name}
              </T>
            </Row>
            {answer && (iAnswered || backend.mode === 'local') ? (
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

function AnswerField({ member, isMe, date }: { member: Member; isMe: boolean; date: string }) {
  const session = useSession();
  const { backend, me } = session;
  const [text, setText] = useState('');
  const submit = async () => {
    if (!text.trim()) return;
    success();
    await backend.add('answers', { date, from: member.id, text: text.trim(), createdAt: Date.now() });
    if (backend.mode === 'cloud') {
      await notifyPartner(session, 'Question du jour', `${me?.name ?? 'Ta moitié'} a répondu. À toi !`);
    }
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
        <Field value={text} onChangeText={setText} placeholder="Écris ta réponse…" grow onSubmitEditing={submit} />
        <IconButton icon="checkmark" label="Valider la réponse" variant="primary" onPress={submit} size={50} />
      </Row>
    </View>
  );
}