import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { celebrate } from '@/components/celebrate';
import {
  Button,
  Card,
  Chips,
  confirmDelete,
  Dot,
  Empty,
  Fab,
  Field,
  IconButton,
  Ionicons,
  ProgressBar,
  Row,
  Screen,
  Segmented,
  Sheet,
  T,
  type IconName,
} from '@/components/ui';
import { showDialog } from '@/components/dialog';
import { Fonts, useTheme } from '@/constants/theme';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { success, tap } from '@/lib/haptics';
import { pickOne } from '@/lib/random';
import type { Gift, ListItem, ListKind } from '@/lib/types';
import { useAsyncAction } from '@/lib/use-async-action';

type Tab = ListKind | 'gifts';
type Entry = (ListItem | (Gift & { list: 'gifts'; media?: undefined })) & { list: Tab };

const TABS: { value: Tab; label: string }[] = [
  { value: 'bucket', label: 'Rêves' },
  { value: 'films', label: 'Films' },
  { value: 'shopping', label: 'Courses' },
  { value: 'gifts', label: 'Cadeaux' },
];

const COPY: Record<Tab, { overline: string; empty: [IconName, string, string]; todo: string; done: string; add: string }> = {
  bucket: {
    overline: 'À vivre ensemble',
    empty: ['sparkles-outline', 'Vos rêves à deux', 'Voir les aurores boréales, un cours de cuisine, un road trip… notez tout ce que vous voulez vivre.'],
    todo: 'À faire',
    done: 'Déjà fait',
    add: 'Ajouter une envie',
  },
  films: {
    overline: 'À regarder à deux',
    empty: ['film-outline', 'Votre watchlist', 'Le film que l’un de vous n’a jamais vu, la série dont tout le monde parle…'],
    todo: 'À voir',
    done: 'Déjà vu',
    add: 'Ajouter un film ou une série',
  },
  shopping: {
    overline: 'Liste partagée',
    empty: ['cart-outline', 'Liste de courses', 'Ce que l’un ajoute, l’autre le voit tout de suite en magasin.'],
    todo: 'À acheter',
    done: 'Dans le panier',
    add: 'Ajouter un article',
  },
  gifts: {
    overline: 'Rien que pour toi',
    empty: ['gift-outline', 'Idées cadeaux secrètes', 'Une idée de cadeau te vient ? Note-la ici : ta moitié ne verra jamais cette liste.'],
    todo: 'Idées',
    done: 'Offert',
    add: 'Ajouter une idée cadeau',
  },
};

export default function Listes() {
  const { backend } = useSession();
  return <ListesContent key={`${backend.mode}:${backend.coupleId}:${backend.userId}`} />;
}

function ListesContent() {
  const t = useTheme();
  const { backend, colorOf, partner } = useSession();
  const items = useCollectionState('items');
  const gifts = useCollectionState('gifts');
  const [tab, setTab] = useState<Tab>('bucket');
  const [editing, setEditing] = useState<{ item?: Entry; tab: Tab } | null>(null);

  const col = tab === 'gifts' ? 'gifts' : 'items';
  const collection = tab === 'gifts' ? gifts : items;
  // Un aller-retour vers l’onglet ne doit pas réactiver une ancienne confirmation.
  const context = useMemo(() => ({ backend, tab }), [backend, tab]);
  const latest = useRef<{ context: typeof context; collection: typeof collection } | null>(null);
  useEffect(() => {
    latest.current = { context, collection };
    return () => { latest.current = null; };
  }, [context, collection]);
  const { run, pending } = useAsyncAction((action: () => Promise<void>) => action());
  const isCurrent = () => latest.current?.context === context;
  const currentEntry = (id: string) => {
    const current = latest.current;
    if (!isCurrent() || !current || current.collection.loading || current.collection.error) return;
    return current.collection.items.find((entry) => entry.id === id && (tab === 'gifts'
      ? entry.createdBy === backend.userId : 'list' in entry && entry.list === tab));
  };
  const runCurrent = (action: () => Promise<void>) => run(async () => {
    if (!isCurrent()) return;
    try { await action(); }
    catch (error) { if (isCurrent()) throw error; }
  });
  const unavailable = collection.loading || collection.error;
  const entries: Entry[] =
    unavailable ? [] : tab === 'gifts'
      ? gifts.items.filter((g) => g.createdBy === backend.userId).map((g) => ({ ...g, list: 'gifts' as const }))
      : items.items.filter((i) => i.list === tab);
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  const todo = sorted.filter((i) => !i.done);
  const done = sorted.filter((i) => i.done);
  const copy = COPY[tab];

  const toggle = (item: Entry) => runCurrent(async () => {
    const current = currentEntry(item.id);
    if (!current) return;
    await backend.update(col, item.id, { done: !current.done });
    if (!isCurrent()) return;
    if (!current.done) {
      if (tab === 'bucket') {
        success();
        celebrate('confetti');
      } else tap();
    }
  });

  const askRemove = (item: Entry) => {
    if (pending || !currentEntry(item.id)) return;
    confirmDelete(item.title, () => runCurrent(async () => {
      if (currentEntry(item.id)) await backend.remove(col, item.id);
    }));
  };

  const pickMovie = () => {
    const current = latest.current;
    if (!isCurrent() || tab !== 'films' || !current || current.collection.loading || current.collection.error) return;
    const pool = current.collection.items.filter((entry) => 'list' in entry && entry.list === 'films' && !entry.done);
    if (pool.length === 0) return showDialog('Liste vide', 'Ajoutez des films ou séries à regarder.');
    const pick = pickOne(pool);
    showDialog('Ce soir on regarde…', pick.title, [
      { text: 'Relancer', onPress: pickMovie },
      { text: 'Go !', style: 'cancel' },
    ]);
  };

  const clearBasket = () => {
    if (pending || !isCurrent() || tab !== 'shopping' || unavailable || !done.length) return;
    const selected = done.map((item) => item.id);
    showDialog('Vider le panier ?', `${done.length} article${done.length > 1 ? 's' : ''} coché${done.length > 1 ? 's' : ''} seront retirés.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Vider', style: 'destructive', onPress: () => runCurrent(async () => {
        const ids = selected.filter((id) => currentEntry(id)?.done === true);
        if (ids.length) await backend.clearShoppingBasket(ids);
      }) },
    ]);
  };

  const renderItem = (item: Entry, index: number) => (
    <Pressable
      key={item.id}
      onPress={() => setEditing({ item, tab })}
      onLongPress={() => askRemove(item)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderTopWidth: index === 0 ? 0 : 1,
        borderTopColor: t.line,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done, disabled: pending, busy: pending }}
        disabled={pending}
        accessibilityLabel={item.title}
        accessibilityHint={item.done ? 'Marquer comme à faire' : 'Marquer comme fait'}
        hitSlop={10}
        onPress={() => toggle(item)}
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: t.primary,
          backgroundColor: item.done ? t.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {item.done && <Ionicons name="checkmark" size={17} color={t.onPrimary} />}
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <T
          style={[
            { fontFamily: Fonts.bodyMedium },
            item.done ? { textDecorationLine: 'line-through', color: t.textSecondary } : undefined,
          ]}>
          {item.title}
        </T>
        {(!!item.detail || !!item.media) && (
          <Row style={{ gap: 6 }}>
            {!!item.media && (
              <Ionicons name={item.media === 'serie' ? 'tv-outline' : 'film-outline'} size={13} color={t.textSecondary} />
            )}
            <T variant="small" muted numberOfLines={1}>
              {[item.media === 'serie' ? 'Série' : item.media === 'film' ? 'Film' : '', item.detail].filter(Boolean).join(' · ')}
            </T>
          </Row>
        )}
      </View>
      {tab !== 'gifts' && <Dot color={colorOf(item.createdBy)} />}
    </Pressable>
  );

  return (
    <>
      <Screen overline={copy.overline} title="Nos listes">
        <Segmented options={TABS} value={tab} onChange={setTab} />

        {tab === 'bucket' && sorted.length > 0 && (
          <Card style={{ gap: 12 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Row style={{ alignItems: 'baseline' }}>
                <T variant="title" color={t.primary}>
                  {done.length}
                </T>
                <T muted>
                  {done.length > 1 ? 'rêves réalisés' : 'rêve réalisé'} sur {sorted.length}
                </T>
              </Row>
              <T variant="bodyBold">{Math.round((done.length / sorted.length) * 100)} %</T>
            </Row>
            <ProgressBar value={done.length / sorted.length} color={t.primary} track={t.line} height={8} />
          </Card>
        )}

        {tab === 'films' && sorted.length > 0 && (
          <Card tone="feature" onPress={pickMovie} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="h2" color={t.onFeature} style={{ fontFamily: Fonts.displayMedium }}>
                On regarde quoi ?
              </T>
              <T variant="small" color={t.onFeatureMuted}>
                {todo.length} titre{todo.length > 1 ? 's' : ''} en attente
              </T>
            </View>
            <IconButton icon="shuffle" label="Tirer un film au sort" variant="accent" onPress={pickMovie} size={52} />
          </Card>
        )}

        {tab === 'gifts' && (
          <Row style={{ gap: 8 }}>
            <Ionicons name="lock-closed-outline" size={16} color={t.textSecondary} />
            <T variant="small" muted style={{ flex: 1 }}>
              Liste privée : {partner?.name ?? 'ta moitié'} ne la voit pas.
            </T>
          </Row>
        )}

        {unavailable ? (
          <Card>
            <T>{collection.loading ? 'Chargement de la liste…' : 'Liste indisponible. Impossible de charger son contenu pour le moment.'}</T>
            {collection.error && <Button label="Réessayer la liste" variant="outline" onPress={collection.retry} />}
          </Card>
        ) : sorted.length === 0 ? (
          <Empty icon={copy.empty[0]} title={copy.empty[1]} text={copy.empty[2]} />
        ) : (
          <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
            {todo.length > 0 && (
              <>
                <T variant="caption" muted style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
                  {copy.todo}
                </T>
                {todo.map(renderItem)}
              </>
            )}
            {done.length > 0 && (
              <>
                <T
                  variant="caption"
                  muted
                  style={{
                    paddingHorizontal: 16,
                    paddingTop: 16,
                    paddingBottom: 4,
                    borderTopWidth: todo.length > 0 ? 1 : 0,
                    borderTopColor: t.line,
                  }}>
                  {copy.done}
                </T>
                {done.map(renderItem)}
              </>
            )}
          </Card>
        )}

        {tab === 'shopping' && done.length > 0 && (
          <Button label="Vider les articles cochés" variant="ghost" icon="trash-outline" disabled={pending} onPress={clearBasket} />
        )}
      </Screen>
      {!unavailable && <Fab onPress={() => setEditing({ tab })} label={copy.add} />}
      {editing && <ItemSheet key={`${editing.tab}:${editing.item?.id ?? 'new'}`} item={editing.item} tab={editing.tab} onClose={() => setEditing(null)} />}
    </>
  );
}

const SHEET: Record<Tab, { title: string; placeholder: string; detail: string; detailPlaceholder: string }> = {
  bucket: { title: 'Nouvelle envie', placeholder: 'Saut en parachute', detail: 'Détails', detailPlaceholder: 'Pour nos 5 ans ?' },
  films: { title: 'À regarder', placeholder: 'Le Fabuleux Destin d’Amélie Poulain', detail: 'Où le voir ?', detailPlaceholder: 'Netflix, Prime, ciné…' },
  shopping: { title: 'Article', placeholder: 'Lait, œufs, fleurs…', detail: 'Quantité', detailPlaceholder: '2 bouteilles' },
  gifts: { title: 'Idée cadeau', placeholder: 'Le parfum senti en boutique', detail: 'Où le trouver', detailPlaceholder: 'Lien, magasin, prix…' },
};

function ItemSheet({ item, tab, onClose }: { item?: Entry; tab: Tab; onClose: () => void }) {
  const { backend } = useSession();
  const kind = item?.list ?? tab;
  const copy = SHEET[kind];
  const collection = useCollectionState(kind === 'gifts' ? 'gifts' : 'items');
  const context = useMemo(() => ({ backend }), [backend]);
  const [draft, setDraft] = useState({
    title: item?.title ?? '', detail: item?.detail ?? '', media: item?.media ?? 'film',
    baseTitle: item?.title ?? '', baseDetail: item?.detail ?? '', baseMedia: item?.media ?? 'film',
  });
  const received = item && !collection.loading && !collection.error ? collection.items.find(entry => entry.id === item.id &&
    (kind === 'gifts' ? entry.createdBy === backend.userId : 'list' in entry && entry.list === kind)) : undefined;
  const baseTitle = received?.title ?? draft.baseTitle;
  const baseDetail = received ? received.detail ?? '' : draft.baseDetail;
  const baseMedia = received ? ('media' in received && received.media === 'serie' ? 'serie' : 'film') : draft.baseMedia;
  const title = draft.baseTitle !== baseTitle && draft.title.trim() === draft.baseTitle ? baseTitle : draft.title;
  const detail = draft.baseDetail !== baseDetail && draft.detail.trim() === draft.baseDetail ? baseDetail : draft.detail;
  const media = draft.media === draft.baseMedia ? baseMedia : draft.media;
  if (draft.baseTitle !== baseTitle || draft.baseDetail !== baseDetail || draft.baseMedia !== baseMedia) {
    setDraft({ title, detail, media, baseTitle, baseDetail, baseMedia });
  }
  const latest = useRef<{ context: typeof context; collection: typeof collection; draft: typeof draft } | null>(null);
  const closed = useRef(false);
  useEffect(() => {
    latest.current = { context, collection, draft };
    return () => { latest.current = null; };
  }, [context, collection, draft]);
  const { run, pending } = useAsyncAction((action: () => unknown) => action());
  const isCurrent = () => !closed.current && latest.current?.context === context;
  const containsItem = (state: typeof collection) => !item || state.items.some((entry) => entry.id === item.id &&
    (kind === 'gifts' ? entry.createdBy === backend.userId : 'list' in entry && entry.list === kind));
  const unavailable = collection.loading || collection.error || !containsItem(collection);
  const canWrite = () => {
    const state = latest.current?.collection;
    return isCurrent() && state && !state.loading && !state.error && containsItem(state);
  };
  const close = () => { if (isCurrent()) { closed.current = true; onClose(); } };
  const runCurrent = (action: () => Promise<void>) => run(async () => {
    if (!canWrite()) return;
    try { await action(); }
    catch (error) { if (isCurrent()) throw error; }
  });

  const save = () => runCurrent(async () => {
    const current = latest.current!.draft;
    if (!current.title.trim()) return;
    const base = { title: current.title.trim(), detail: current.detail.trim() };
    if (item) {
      const patch: { title?: string; detail?: string; media?: 'film' | 'serie' } = {};
      if (base.title !== current.baseTitle) patch.title = base.title;
      if (base.detail !== current.baseDetail) patch.detail = base.detail;
      if (kind === 'films' && current.media !== current.baseMedia) patch.media = current.media;
      if (Object.keys(patch).length) await backend.update(kind === 'gifts' ? 'gifts' : 'items', item.id, patch);
    } else if (kind === 'gifts') {
      await backend.add('gifts', { ...base, done: false, createdBy: backend.userId, createdAt: Date.now() });
    } else {
      const data = { ...base, media: kind === 'films' ? current.media : undefined };
      await backend.add('items', { ...data, list: kind, done: false, createdBy: backend.userId, createdAt: Date.now() });
    }
    close();
  });
  const remove = () => {
    if (!item || pending || !canWrite()) return;
    confirmDelete(item.title, () => runCurrent(async () => {
      await backend.remove(kind === 'gifts' ? 'gifts' : 'items', item.id);
      close();
    }));
  };

  return (
    <Sheet visible title={item ? 'Modifier' : copy.title} onClose={() => run(close)}>
      {kind === 'films' && (
        <Chips
          options={[
            { value: 'film', label: 'Film', icon: 'film-outline' },
            { value: 'serie', label: 'Série', icon: 'tv-outline' },
          ]}
          value={media}
          disabled={pending}
          onChange={(value) => run(() => { if (isCurrent()) setDraft(current => ({ ...current, media: value })); })}
        />
      )}
      <Field label="Quoi ?" value={title} maxLength={200} editable={!pending} onChangeText={(value) => run(() => { if (isCurrent()) setDraft(current => ({ ...current, title: value })); })} placeholder={copy.placeholder} />
      <Field label={copy.detail} value={detail} maxLength={2000} editable={!pending} onChangeText={(value) => run(() => { if (isCurrent()) setDraft(current => ({ ...current, detail: value })); })} placeholder={copy.detailPlaceholder} />
      {unavailable && <T variant="small" muted>Liste indisponible ou article retiré. Ton brouillon est conservé ; recharge la liste avant de continuer.</T>}
      {collection.error && <Button label="Recharger la liste du formulaire" variant="outline" onPress={collection.retry} />}
      <Button label="Enregistrer" disabled={!title.trim() || pending || unavailable} onPress={save} />
      {item && (
        <Button
          label="Supprimer"
          variant="danger"
          icon="trash-outline"
          disabled={pending || unavailable}
          onPress={remove}
        />
      )}
    </Sheet>
  );
}
