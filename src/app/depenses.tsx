import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Chips, confirmDelete, Dot, Empty, Fab, Field, Ionicons, Row, Screen, Sheet, T } from '@/components/ui';
import { cardShadow, useTheme } from '@/constants/theme';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { formatRelative } from '@/lib/dates';
import { success } from '@/lib/haptics';
import type { Backend } from '@/lib/backend';
import type { Expense } from '@/lib/types';
import { balanceFor, parseExpenseAmount } from '@/lib/expenses';
import { useAsyncAction } from '@/lib/use-async-action';
import { useToday } from '@/lib/use-today';

const euros = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }).replace(/ /g, ' ');

// Identifiant de corrélation, jamais un secret ou une preuve d'autorisation.
const settlementRequestId = () => `settle_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}_${Math.random().toString(36).slice(2, 14)}`;

async function addSettlement(backend: Backend, amount: number, paidBy: string, requestId: string, expenses: Expense[]) {
  if (backend.mode === 'local') {
    await backend.add('expenses', { title: 'Remboursement', amount, paidBy, kind: 'settle', createdAt: Date.now() });
    return;
  }
  const result = await backend.call<unknown>('recordSettlement', {
    expectedUserId: backend.userId, requestId,
    expected: expenses.map((entry) => ({ id: entry.id, amount: entry.amount, paidBy: entry.paidBy, kind: entry.kind ?? 'expense' })),
  });
  const id = result && typeof result === 'object' && !Array.isArray(result) ? (result as { settlementId?: unknown }).settlementId : null;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw new Error('La confirmation du remboursement n’a pas pu être vérifiée. Réessaie pour retrouver le résultat de cette même demande.');
  }
}

export default function Depenses() {
  const { backend } = useSession();
  return <DepensesContent key={`${backend.mode}:${backend.coupleId}:${backend.userId}`} />;
}

function DepensesContent() {
  const t = useTheme();
  const today = useToday();
  const { backend, me, partner, nameOf, colorOf } = useSession();
  const { items: expenses, loading, error, retry } = useCollectionState('expenses');
  const ready = !loading && !error;
  const [adding, setAdding] = useState(false);
  const context = useMemo(() => ({ backend, meId: me?.id, partnerId: partner?.id }), [backend, me?.id, partner?.id]);
  // Un nouveau tableau, un ordre différent ou un titre modifié ne changent pas le relevé comptable.
  const revision = useMemo(() => JSON.stringify([...expenses].sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => [entry.id, entry.amount, entry.paidBy, entry.kind ?? 'expense'])), [expenses]);
  const snapshot = useMemo(() => ({ revision, context, requestId: settlementRequestId() }), [revision, context]);
  const latest = useRef<{ context: typeof context; snapshot: typeof snapshot; expenses: typeof expenses; ready: boolean } | null>(null);
  const recorded = useRef<typeof snapshot | null>(null);
  const [recordedSnapshot, setRecordedSnapshot] = useState<typeof snapshot | null>(null);
  useEffect(() => {
    latest.current = { context, snapshot, expenses, ready };
    return () => { latest.current = null; };
  }, [context, snapshot, expenses, ready]);
  const { run, pending } = useAsyncAction((action: () => unknown) => action());
  const isCurrent = () => latest.current?.context === context;
  const canWrite = () => isCurrent() && latest.current?.ready;

  const sorted = [...expenses].sort((a, b) => b.createdAt - a.createdAt);
  const balance = me ? balanceFor(expenses, me.id) : 0;
  const total = expenses.filter((e) => e.kind !== 'settle').reduce((s, e) => s + e.amount, 0);

  const settle = () => run(async () => {
    if (!canWrite() || !me || !partner || balance === 0 || latest.current?.snapshot !== snapshot || recorded.current === snapshot) return;
    // Information saisie par l’utilisateur, jamais un transfert d’argent.
    try {
      await addSettlement(backend, Math.abs(balance), balance > 0 ? partner.id : me.id, snapshot.requestId, expenses);
      if (!isCurrent()) return;
      // Ne pas rejouer le même solde en attendant le prochain snapshot de la collection.
      recorded.current = snapshot;
      setRecordedSnapshot(snapshot);
      success();
    } catch (failure) { if (isCurrent()) throw failure; }
  });
  const remove = (id: string, title: string) => {
    const contains = () => latest.current?.expenses.some((entry) => entry.id === id);
    if (pending || !canWrite() || !contains()) return;
    confirmDelete(title, () => run(async () => {
      if (!canWrite() || !contains()) return;
      try { await backend.remove('expenses', id); }
      catch (failure) { if (isCurrent()) throw failure; }
    }));
  };

  return (
    <>
      <Screen overline={ready ? `${euros(total)} dépensés à deux` : 'Dépenses partagées'} title="Dépenses" onBack={() => router.canGoBack() ? router.back() : router.replace('/')}>
        {loading ? (
          <Card><T>Chargement des dépenses…</T></Card>
        ) : error ? (
          <Card style={{ gap: 12 }}>
            <T variant="h3">Dépenses indisponibles</T>
            <T>Impossible de charger les dépenses. Vérifie ta connexion puis réessaie. Le solde n’est pas disponible.</T>
            <Button label="Réessayer" onPress={retry} />
          </Card>
        ) : (
          <>
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
                  <Button label="Marquer comme remboursé" variant="soft" icon="checkmark-done" disabled={pending || recordedSnapshot === snapshot} onPress={settle} />
                  {recordedSnapshot === snapshot && <T variant="small" color={t.onFeatureMuted}>Marque enregistrée. En attente de l’actualisation du solde.</T>}
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
                    disabled={pending}
                    accessibilityState={{ disabled: pending }}
                    onLongPress={() => remove(e.id, e.title)}
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
                          {formatRelative(e.createdAt, today)}
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
          </>
        )}
      </Screen>
      {ready && <Fab onPress={() => run(() => { if (canWrite()) setAdding(true); })} label="Ajouter une dépense" />}
      {adding && <ExpenseSheet onClose={() => setAdding(false)} />}
    </>
  );
}

function ExpenseSheet({ onClose }: { onClose: () => void }) {
  const { backend, members } = useSession();
  const collection = useCollectionState('expenses');
  const context = useMemo(() => ({ backend }), [backend]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(backend.userId);
  const latest = useRef<{ context: typeof context; collection: typeof collection; members: typeof members; title: string; amount: string; paidBy: string } | null>(null);
  const closed = useRef(false);
  useEffect(() => {
    latest.current = { context, collection, members, title, amount, paidBy };
    return () => { latest.current = null; };
  }, [context, collection, members, title, amount, paidBy]);
  const { run, pending } = useAsyncAction((action: () => unknown) => action());
  const isCurrent = () => !closed.current && latest.current?.context === context;
  const unavailable = collection.loading || collection.error;
  const value = parseExpenseAmount(amount);
  const valid = !!title.trim() && value !== null && members.some((member) => member.id === paidBy);
  const close = () => { if (isCurrent()) { closed.current = true; onClose(); } };
  const change = (key: 'title' | 'amount' | 'paidBy', next: string) => run(() => {
    if (!isCurrent() || !latest.current) return;
    latest.current[key] = next;
    if (key === 'title') setTitle(next);
    else if (key === 'amount') setAmount(next);
    else setPaidBy(next);
  });
  const save = () => run(async () => {
    const current = latest.current;
    if (!isCurrent() || !current || current.collection.loading || current.collection.error) return;
    const currentValue = parseExpenseAmount(current.amount);
    if (!current.title.trim() || currentValue === null || !current.members.some((member) => member.id === current.paidBy)) return;
    try {
      await backend.add('expenses', {
        title: current.title.trim(),
        amount: currentValue,
        paidBy: current.paidBy,
        kind: 'expense',
        createdAt: Date.now(),
      });
      if (!isCurrent()) return;
      success();
      close();
    } catch (error) { if (isCurrent()) throw error; }
  });

  return (
    <Sheet visible title="Nouvelle dépense" onClose={() => run(close)}>
      <Field label="Quoi ?" value={title} maxLength={200} editable={!pending} onChangeText={(next) => change('title', next)} placeholder="Courses, resto, billets de train…" />
      <Field label="Montant (€)" value={amount} editable={!pending} onChangeText={(next) => change('amount', next)} placeholder="42,50" keyboardType="decimal-pad" />
      {!!amount && value === null && <T variant="small">Entre un montant décimal entre 0,01 € et 100 000 €, par exemple 42,50.</T>}
      {value !== null && <T variant="small" muted>Montant retenu : {euros(value)}.</T>}
      <Chips
        label="Payé par"
        options={members.map((m) => ({ value: m.id, label: m.name, color: m.color }))}
        value={paidBy}
        disabled={pending}
        onChange={(next) => change('paidBy', next)}
      />
      {!members.some((member) => member.id === paidBy) && <T variant="small">Choisis un membre actuel pour cette dépense.</T>}
      {unavailable && <T variant="small" muted>Dépenses indisponibles. Ton brouillon est conservé ; recharge les dépenses avant de continuer.</T>}
      {collection.error && <Button label="Recharger les dépenses du formulaire" variant="outline" onPress={collection.retry} />}
      <Button
        label="Ajouter"
        disabled={!valid || pending || unavailable}
        onPress={save}
      />
    </Sheet>
  );
}
