import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Chips, confirmDelete, Dot, Empty, Fab, Field, Ionicons, Row, Screen, Sheet, T } from '@/components/ui';
import { cardShadow, useTheme } from '@/constants/theme';
import { useCollection, useSession } from '@/lib/couple-context';
import { formatRelative } from '@/lib/dates';
import { success } from '@/lib/haptics';
import type { Backend } from '@/lib/backend';
import { balanceFor } from '@/lib/expenses';

const euros = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }).replace(/ /g, ' ');

function addSettlement(backend: Backend, amount: number, paidBy: string) {
  return backend.add('expenses', { title: 'Remboursement', amount, paidBy, kind: 'settle', createdAt: Date.now() });
}

export default function Depenses() {
  const t = useTheme();
  const { backend, me, partner, nameOf, colorOf } = useSession();
  const expenses = useCollection('expenses');
  const [adding, setAdding] = useState(false);

  const sorted = [...expenses].sort((a, b) => b.createdAt - a.createdAt);
  const balance = me ? balanceFor(expenses, me.id) : 0;
  const total = expenses.filter((e) => e.kind !== 'settle').reduce((s, e) => s + e.amount, 0);

  const settle = async () => {
    if (!me || !partner || balance === 0) return;
    // Celui qui doit rembourse l'autre : le solde revient à zéro.
    await addSettlement(backend, Math.abs(balance), balance > 0 ? partner.id : me.id);
    success();
  };

  return (
    <>
      <Screen overline={`${euros(total)} dépensés à deux`} title="Dépenses" onBack={() => router.back()}>
        <Card tone="feature" style={{ gap: 10, padding: 22 }}>
          <T variant="caption" color={t.onFeatureMuted}>
            Solde
          </T>
          {balance === 0 || !partner ? (
            <T variant="h2" color={t.onFeature}>
              Vous êtes à l’équilibre
            </T>
          ) : (
            <>
              <T variant="title" color={t.onFeature}>
                {euros(Math.abs(balance))}
              </T>
              <T color={t.onFeatureMuted}>
                {balance > 0 ? `${partner.name} te doit cette somme` : `Tu dois cette somme à ${partner.name}`}
              </T>
              <Button label="Marquer comme remboursé" variant="soft" icon="checkmark-done" onPress={settle} />
            </>
          )}
        </Card>

        {sorted.length === 0 ? (
          <Empty
            icon="wallet-outline"
            title="Dépenses partagées"
            text="Courses, resto, vacances : notez qui a payé, l’app calcule qui doit combien à qui (partage à moitié)."
          />
        ) : (
          <View style={[{ backgroundColor: t.card, borderRadius: 22, overflow: 'hidden' }, cardShadow(t.shadow)]}>
            {sorted.map((e, i) => (
              <Pressable
                key={e.id}
                onLongPress={() => confirmDelete(e.title, () => backend.remove('expenses', e.id))}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.line,
                }}>
                <Ionicons
                  name={e.kind === 'settle' ? 'swap-horizontal' : 'receipt-outline'}
                  size={20}
                  color={e.kind === 'settle' ? t.success : t.primary}
                />
                <View style={{ flex: 1 }}>
                  <T variant="h3">{e.title}</T>
                  <Row style={{ gap: 6 }}>
                    <Dot size={7} color={colorOf(e.paidBy)} />
                    <T variant="small" muted>
                      {e.kind === 'settle' ? `${nameOf(e.paidBy)} a remboursé` : `Payé par ${nameOf(e.paidBy)}`} ·{' '}
                      {formatRelative(e.createdAt)}
                    </T>
                  </Row>
                </View>
                <T variant="bodyBold">{euros(e.amount)}</T>
              </Pressable>
            ))}
          </View>
        )}
        {sorted.length > 0 && (
          <T variant="small" muted style={{ textAlign: 'center' }}>
            Appui long sur une ligne pour la supprimer
          </T>
        )}
      </Screen>
      <Fab onPress={() => setAdding(true)} label="Ajouter une dépense" />
      {adding && <ExpenseSheet onClose={() => setAdding(false)} />}
    </>
  );
}

function ExpenseSheet({ onClose }: { onClose: () => void }) {
  const { backend, members } = useSession();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(backend.userId);
  const value = Number(amount.replace(',', '.'));
  const valid = title.trim() && Number.isFinite(value) && value >= 0.01 && value <= 100000;

  return (
    <Sheet visible title="Nouvelle dépense" onClose={onClose}>
      <Field label="Quoi ?" value={title} maxLength={200} onChangeText={setTitle} placeholder="Courses, resto, billets de train…" />
      <Field label="Montant (€)" value={amount} onChangeText={setAmount} placeholder="42,50" keyboardType="decimal-pad" />
      {!!amount && (!Number.isFinite(value) || value < 0.01 || value > 100000) && <T variant="small">Entre un montant entre 0,01 € et 100 000 €.</T>}
      <Chips
        label="Payé par"
        options={members.map((m) => ({ value: m.id, label: m.name, color: m.color }))}
        value={paidBy}
        onChange={setPaidBy}
      />
      <Button
        label="Ajouter"
        disabled={!valid}
        onPress={async () => {
          await backend.add('expenses', {
            title: title.trim(),
            amount: Math.round(value * 100) / 100,
            paidBy,
            kind: 'expense',
            createdAt: Date.now(),
          });
          success();
          onClose();
        }}
      />
    </Sheet>
  );
}
