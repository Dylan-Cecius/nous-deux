import { useState } from 'react';
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
import { useCollection, useSession } from '@/lib/couple-context';
import { success, tap } from '@/lib/haptics';
import { pickOne } from '@/lib/random';
import type { Gift, ListItem, ListKind } from '@/lib/types';

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
  const t = useTheme();
  const { backend, colorOf, partner } = useSession();
  const items = useCollection('items');
  const gifts = useCollection('gifts');
  const [tab, setTab] = useState<Tab>('bucket');
  const [editing, setEditing] = useState<Entry | 'new' | null>(null);

  const col = tab === 'gifts' ? 'gifts' : 'items';
  const entries: Entry[] =
    tab === 'gifts'
      ? gifts.filter((g) => g.createdBy === backend.userId).map((g) => ({ ...g, list: 'gifts' as const }))
      : items.filter((i) => i.list === tab);
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  const todo = sorted.filter((i) => !i.done);
  const done = sorted.filter((i) => i.done);
  const copy = COPY[tab];

  const toggle = (item: Entry) => {
    if (!item.done) {
      if (tab === 'bucket') {
        success();
        celebrate('confetti');
      } else tap();
    }
    backend.update(col, item.id, { done: !item.done });
  };

  const pickMovie = () => {
    if (todo.length === 0) return showDialog('Liste vide', 'Ajoutez des films ou séries à regarder.');
    const pick = pickOne(todo);
    showDialog('Ce soir on regarde…', pick.title, [
      { text: 'Relancer', onPress: pickMovie },
      { text: 'Go !', style: 'cancel' },
    ]);
  };

  const clearBasket = () =>
    showDialog('Vider le panier ?', `${done.length} article${done.length > 1 ? 's' : ''} coché${done.length > 1 ? 's' : ''} seront retirés.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Vider', style: 'destructive', onPress: () => done.forEach((i) => backend.remove('items', i.id)) },
    ]);

  const renderItem = (item: Entry, index: number) => (
    <Pressable
      key={item.id}
      onPress={() => setEditing(item)}
      onLongPress={() => confirmDelete(item.title, () => backend.remove(col, item.id))}
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
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={item.done ? 'Marquer comme à faire' : 'Marquer comme fait'}
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
        {item.done && <Ionicons name="checkmark" size={17} color="#fff" />}
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

        {sorted.length === 0 ? (
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
          <Button label="Vider les articles cochés" variant="ghost" icon="trash-outline" onPress={clearBasket} />
        )}
      </Screen>
      <Fab onPress={() => setEditing('new')} label={copy.add} />
      {editing && <ItemSheet item={editing === 'new' ? undefined : editing} tab={tab} onClose={() => setEditing(null)} />}
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
  const [title, setTitle] = useState(item?.title ?? '');
  const [detail, setDetail] = useState(item?.detail ?? '');
  const [media, setMedia] = useState<'film' | 'serie'>(item?.media ?? 'film');

  const save = async () => {
    const base = { title: title.trim(), detail: detail.trim() };
    if (kind === 'gifts') {
      if (item) await backend.update('gifts', item.id, base);
      else await backend.add('gifts', { ...base, done: false, createdBy: backend.userId, createdAt: Date.now() });
    } else {
      const data = { ...base, media: kind === 'films' ? media : undefined };
      if (item) await backend.update('items', item.id, data);
      else await backend.add('items', { ...data, list: kind, done: false, createdBy: backend.userId, createdAt: Date.now() });
    }
    onClose();
  };

  return (
    <Sheet visible title={item ? 'Modifier' : copy.title} onClose={onClose}>
      {kind === 'films' && (
        <Chips
          options={[
            { value: 'film', label: 'Film', icon: 'film-outline' },
            { value: 'serie', label: 'Série', icon: 'tv-outline' },
          ]}
          value={media}
          onChange={setMedia}
        />
      )}
      <Field label="Quoi ?" value={title} onChangeText={setTitle} placeholder={copy.placeholder} />
      <Field label={copy.detail} value={detail} onChangeText={setDetail} placeholder={copy.detailPlaceholder} />
      <Button label="Enregistrer" disabled={!title.trim()} onPress={save} />
      {item && (
        <Button
          label="Supprimer"
          variant="danger"
          icon="trash-outline"
          onPress={() =>
            confirmDelete(item.title, async () => {
              await backend.remove(kind === 'gifts' ? 'gifts' : 'items', item.id);
              onClose();
            })
          }
        />
      )}
    </Sheet>
  );
}
