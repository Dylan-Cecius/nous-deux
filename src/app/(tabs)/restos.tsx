import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';

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
  Row,
  Screen,
  Segmented,
  Sheet,
  T,
} from '@/components/ui';
import { showDialog } from '@/components/dialog';
import { Fonts, useTheme } from '@/constants/theme';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { pickOne } from '@/lib/random';
import { features } from '@/lib/features';
import type { Restaurant, RestaurantStatus } from '@/lib/types';
import { useAsyncAction } from '@/lib/use-async-action';
import { restaurantMapUrl } from '@/lib/restaurant-map';
import { RestaurantRating as Hearts } from '@/components/restaurant-rating';
import { draftPatch, useSharedDraft } from '@/lib/use-shared-draft';

const STATUSES: { value: RestaurantStatus; label: string }[] = [
  { value: 'envie', label: 'À tester' },
  { value: 'favori', label: 'Favoris' },
  { value: 'teste', label: 'Testés' },
];

/** Paires fond / texte pour la vignette avec l'initiale du resto. */
const TILES = [
  ['#FBE3D6', '#A34A1E'],
  ['#E3ECF8', '#2F5D9E'],
  ['#E4F1E8', '#1F6B3A'],
  ['#F7E3E7', '#9E2443'],
  ['#EFE6F7', '#5B3A99'],
  ['#FFF1D1', '#8A5A00'],
];

function tileFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TILES[h % TILES.length];
}

export default function Restos() {
  const { backend } = useSession();
  return <RestosContent key={`${backend.mode}:${backend.coupleId}:${backend.userId}`} />;
}

function RestosContent() {
  const t = useTheme();
  const { backend, colorOf, nameOf } = useSession();
  const restaurantState = useCollectionState('restaurants');
  const unavailable = restaurantState.loading || restaurantState.error;
  const restaurants = unavailable ? [] : restaurantState.items;
  const [tab, setTab] = useState<RestaurantStatus>('envie');
  const [editing, setEditing] = useState<Restaurant | 'new' | null>(null);
  const context = useMemo(() => ({ backend, tab }), [backend, tab]);
  const latest = useRef<{ context: typeof context; state: typeof restaurantState } | null>(null);
  useEffect(() => {
    latest.current = { context, state: restaurantState };
    return () => { latest.current = null; };
  }, [context, restaurantState]);
  const currentRestaurants = () => {
    const current = latest.current;
    if (!current || current.context !== context || current.state.loading || current.state.error) return null;
    return current.state.items;
  };

  const count = (s: RestaurantStatus) => restaurants.filter((r) => r.status === s).length;
  const list = restaurants
    .filter((r) => r.status === tab)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.createdAt - a.createdAt);

  const pickRandom = () => {
    const current = currentRestaurants();
    if (!current) return;
    const pool = current.filter((r) => r.status !== 'teste');
    if (pool.length === 0) return showDialog('Aucun resto', 'Ajoutez d’abord quelques envies ou favoris.');
    const r = pickOne(pool);
    showDialog('Ce soir, c’est…', `${r.name}${r.cuisine ? ` (${r.cuisine})` : ''}`, [
      { text: 'Relancer', onPress: pickRandom },
      { text: 'Parfait !', style: 'cancel' },
    ]);
  };

  const openMap = (r: Restaurant) => {
    const current = currentRestaurants()?.find((entry) => entry.id === r.id);
    if (current) return Linking.openURL(restaurantMapUrl(current));
  };

  return (
    <>
      <Screen
        overline={unavailable ? 'Vos adresses à deux' : `${restaurants.length} adresse${restaurants.length > 1 ? 's' : ''}`}
        title="Nos restos">
        <Segmented
          options={STATUSES.map((s) => ({ value: s.value, label: unavailable ? s.label : `${s.label} · ${count(s.value)}` }))}
          value={tab}
          onChange={setTab}
        />

        {!unavailable && <Card tone="feature" onPress={pickRandom} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: Fonts.displayMedium, fontSize: 21, color: t.onFeature }}>On mange où ce soir ?</Text>
            <T variant="small" color={t.onFeatureMuted}>
              Tirage au sort parmi vos envies et favoris
            </T>
          </View>
          <IconButton icon="dice-outline" label="Tirer un resto au sort" variant="accent" onPress={pickRandom} size={52} />
        </Card>}

        {unavailable ? (
          <Card>
            <T>{restaurantState.loading ? 'Chargement des restos…' : 'Restos indisponibles. Impossible de charger vos adresses pour le moment.'}</T>
            {restaurantState.error && <Button label="Réessayer les restos" variant="outline" onPress={restaurantState.retry} />}
          </Card>
        ) : list.length === 0 ? (
          <Empty
            icon={tab === 'envie' ? 'restaurant-outline' : tab === 'favori' ? 'heart-outline' : 'checkmark-done-outline'}
            title={tab === 'envie' ? 'Vos envies' : tab === 'favori' ? 'Vos adresses préférées' : 'Déjà testés'}
            text={
              tab === 'envie'
                ? 'Le resto dont vous parlez depuis des mois ? Ajoutez-le ici.'
                : tab === 'favori'
                  ? 'Pour ne plus jamais hésiter le samedi soir.'
                  : 'Gardez une trace de vos sorties, avec votre note.'
            }
          />
        ) : (
          list.map((r) => {
            const [bg, fg] = tileFor(r.name);
            return (
              <Card key={r.id} onPress={() => setEditing(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}>
                {r.photoUrl ? (
                  <Image source={{ uri: r.photoUrl }} style={{ width: 56, height: 56, borderRadius: 16 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Fonts.display, fontSize: 24, color: fg }}>{r.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <T variant="h3" numberOfLines={1}>
                    {r.name}
                  </T>
                  {!!(r.cuisine || r.place) && (
                    <T variant="small" muted numberOfLines={1}>
                      {[r.cuisine, r.place].filter(Boolean).join(' · ')}
                    </T>
                  )}
                  {r.status !== 'envie' && !!r.rating ? (
                    <Hearts value={r.rating} size={14} />
                  ) : (
                    <Row style={{ gap: 6 }}>
                      <Dot size={7} color={colorOf(r.createdBy)} />
                      <T variant="small" muted style={{ fontSize: 12 }}>
                        Idée de {nameOf(r.createdBy)}
                      </T>
                    </Row>
                  )}
                </View>
                <IconButton icon="location-outline" label={`Voir ${r.name} sur la carte`} onPress={() => openMap(r)} />
              </Card>
            );
          })
        )}
      </Screen>
      {!unavailable && <Fab onPress={() => setEditing('new')} label="Ajouter un resto" />}
      {editing && (
        <RestoSheet key={editing === 'new' ? 'new' : editing.id} resto={editing === 'new' ? undefined : editing} defaultStatus={tab} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function restaurantFields(resto: Restaurant | undefined, defaultStatus: RestaurantStatus) {
  return {
    name: resto?.name ?? '', cuisine: resto?.cuisine ?? '', place: resto?.place ?? '',
    status: resto?.status ?? defaultStatus, rating: resto?.rating ?? 0, note: resto?.note ?? '',
    address: resto?.address ?? '', photoUrl: resto?.photoUrl ?? '', mapsUrl: resto?.mapsUrl ?? '',
  };
}

function RestoSheet({
  resto,
  defaultStatus,
  onClose,
}: {
  resto?: Restaurant;
  defaultStatus: RestaurantStatus;
  onClose: () => void;
}) {
  const { backend } = useSession();
  const collection = useCollectionState('restaurants');
  const received = !collection.loading && !collection.error && resto
    ? collection.items.find((entry) => entry.id === resto.id) : undefined;
  const { base, values, setValues } = useSharedDraft(
    restaurantFields(resto, defaultStatus), received ? restaurantFields(received, defaultStatus) : null,
  );
  const { name, cuisine, place, status, rating, note } = values;
  const found = values;
  const setName = (name: string) => setValues((previous) => ({ ...previous, name }));
  const setCuisine = (cuisine: string) => setValues((previous) => ({ ...previous, cuisine }));
  const setPlace = (place: string) => setValues((previous) => ({ ...previous, place }));
  const setStatus = (status: RestaurantStatus) => setValues((previous) => ({ ...previous, status }));
  const setRating = (rating: number) => setValues((previous) => ({ ...previous, rating }));
  const setNote = (note: string) => setValues((previous) => ({ ...previous, note }));
  const context = useMemo(() => ({ backend }), [backend]);
  const latest = useRef<{ context: typeof context; collection: typeof collection; base: typeof base; values: typeof values } | null>(null);
  const closed = useRef(false);
  useEffect(() => {
    latest.current = { context, collection, base, values };
    return () => { latest.current = null; };
  }, [context, collection, base, values]);
  const { run, pending } = useAsyncAction((action: () => unknown) => action());
  const isCurrent = () => !closed.current && latest.current?.context === context;
  const containsResto = (state: typeof collection) => !resto || state.items.some((entry) => entry.id === resto.id);
  const unavailable = collection.loading || collection.error || !containsResto(collection);
  const canWrite = () => {
    const state = latest.current?.collection;
    return isCurrent() && state && !state.loading && !state.error && containsResto(state);
  };
  const close = () => { if (isCurrent()) { closed.current = true; onClose(); } };
  const runCurrent = (action: () => Promise<void>) => run(async () => {
    if (!canWrite()) return;
    try { await action(); }
    catch (error) { if (isCurrent()) throw error; }
  });

  const save = () => runCurrent(async () => {
    const current = latest.current!;
    const { name, cuisine, place, status, rating, note, address, photoUrl, mapsUrl } = current.values;
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      cuisine: cuisine.trim(),
      place: place.trim(),
      status,
      rating,
      note: note.trim(),
      address, photoUrl, mapsUrl,
    };
    if (resto) {
      const patch = draftPatch(current.base, data);
      if (Object.keys(patch).length) await backend.update('restaurants', resto.id, patch);
    }
    else await backend.add('restaurants', { ...data, createdBy: backend.userId, createdAt: Date.now() });
    close();
  });
  const remove = () => {
    if (!resto || pending || !canWrite()) return;
    confirmDelete(resto.name, () => runCurrent(async () => {
      await backend.remove('restaurants', resto.id);
      close();
    }));
  };

  return (
    <Sheet visible title={resto ? resto.name : 'Nouveau resto'} onClose={() => run(close)}>
      {!resto && backend.mode === 'cloud' && features.places && (
        <PlaceSearch
          onPick={(p) => run(() => {
            if (!isCurrent()) return;
            setName(p.name);
            setCuisine(p.cuisine);
            setPlace(p.address.split(',').slice(-2, -1)[0]?.trim().replace(/^\d{5}\s*/, '') ?? '');
            setValues((previous) => ({ ...previous, address: p.address, photoUrl: p.photoUrl ?? '', mapsUrl: p.mapsUrl }));
          })}
        />
      )}
      {!!found.photoUrl && (
        <Image source={{ uri: found.photoUrl }} style={{ width: '100%', height: 160, borderRadius: 18 }} contentFit="cover" />
      )}
      <Field label="Nom" value={name} maxLength={200} editable={!pending} onChangeText={(value) => run(() => { if (isCurrent()) setName(value); })} placeholder="Chez Mario" />
      {!!found.address && (
        <T variant="small" muted>
          {found.address}
        </T>
      )}
      <Row style={{ gap: 12 }}>
        <Field label="Cuisine" value={cuisine} maxLength={200} editable={!pending} onChangeText={(value) => run(() => { if (isCurrent()) setCuisine(value); })} placeholder="Italien" grow />
        <Field label="Ville / quartier" value={place} maxLength={500} editable={!pending} onChangeText={(value) => run(() => { if (isCurrent()) setPlace(value); })} placeholder="Liège" grow />
      </Row>
      <Chips label="Liste" options={STATUSES} value={status} disabled={pending} onChange={(value) => run(() => { if (isCurrent()) setStatus(value); })} />
      {status !== 'envie' && (
        <View style={{ gap: 8 }}>
          <T variant="caption" muted>
            Votre note
          </T>
          <Hearts value={rating} disabled={pending} onChange={(value) => run(() => { if (isCurrent()) setRating(value); })} size={32} />
        </View>
      )}
      <Field label="Notes" value={note} maxLength={4000} editable={!pending} onChangeText={(value) => run(() => { if (isCurrent()) setNote(value); })} placeholder="Prendre la burrata, réserver le samedi…" multiline />
      {unavailable && <T variant="small" muted>Restos indisponibles ou adresse retirée. Ton brouillon est conservé ; recharge les adresses avant de continuer.</T>}
      {collection.error && <Button label="Recharger les restos du formulaire" variant="outline" onPress={collection.retry} />}
      <Button label="Enregistrer" disabled={!name.trim() || pending || unavailable} onPress={save} />
      {resto && (
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

type FoundPlace = { name: string; address: string; cuisine: string; mapsUrl: string; rating: number | null; photoUrl: string | null };

/** Recherche Google Places (via la Cloud Function searchPlaces) pour remplir la fiche d'un clic. */
function PlaceSearch({ onPick }: { onPick: (p: FoundPlace) => void }) {
  const t = useTheme();
  const { backend } = useSession();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FoundPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { places } = await backend.call<{ places: FoundPlace[] }>('searchPlaces', { query });
      setResults(places);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <Row>
        <Field
          label="Rechercher"
          value={query}
          onChangeText={setQuery}
          placeholder="Nom du resto, ville…"
          grow
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <View style={{ paddingTop: 22 }}>
          <IconButton icon="search" label="Rechercher" variant="primary" onPress={search} size={50} />
        </View>
      </Row>
      {loading && <ActivityIndicator color={t.primary} />}
      {!!error && (
        <T variant="small" color={t.danger}>
          {error}
        </T>
      )}
      {results?.length === 0 && <T variant="small" muted>Aucun resto trouvé.</T>}
      {results?.map((p) => (
        <Pressable
          key={p.mapsUrl || p.name}
          onPress={() => {
            onPick(p);
            setResults(null);
          }}
          style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {p.photoUrl ? (
            <Image source={{ uri: p.photoUrl }} style={{ width: 48, height: 48, borderRadius: 12 }} contentFit="cover" />
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: t.primarySoft }} />
          )}
          <View style={{ flex: 1 }}>
            <T variant="h3" numberOfLines={1}>
              {p.name}
            </T>
            <T variant="small" muted numberOfLines={1}>
              {p.rating ? `★ ${p.rating.toFixed(1)} · ` : ''}
              {p.address}
            </T>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
