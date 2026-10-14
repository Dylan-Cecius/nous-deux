import { Image } from 'expo-image';
import { useState } from 'react';
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
  Ionicons,
  Row,
  Screen,
  Segmented,
  Sheet,
  T,
} from '@/components/ui';
import { showDialog } from '@/components/dialog';
import { Fonts, useTheme } from '@/constants/theme';
import { useCollection, useSession } from '@/lib/couple-context';
import { pickOne } from '@/lib/random';
import type { Restaurant, RestaurantStatus } from '@/lib/types';

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

function Hearts({ value, onChange, size = 18 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const t = useTheme();
  return (
    <Row style={{ gap: onChange ? 8 : 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable
          key={i}
          disabled={!onChange}
          accessibilityLabel={`${i} cœur${i > 1 ? 's' : ''}`}
          onPress={() => onChange?.(i === value ? 0 : i)}
          hitSlop={4}>
          <Ionicons name={i <= value ? 'heart' : 'heart-outline'} size={size} color={i <= value ? t.primary : t.border} />
        </Pressable>
      ))}
    </Row>
  );
}

export default function Restos() {
  const t = useTheme();
  const { colorOf, nameOf } = useSession();
  const restaurants = useCollection('restaurants');
  const [tab, setTab] = useState<RestaurantStatus>('envie');
  const [editing, setEditing] = useState<Restaurant | 'new' | null>(null);

  const count = (s: RestaurantStatus) => restaurants.filter((r) => r.status === s).length;
  const list = restaurants
    .filter((r) => r.status === tab)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.createdAt - a.createdAt);

  const pickRandom = () => {
    const pool = restaurants.filter((r) => r.status !== 'teste');
    if (pool.length === 0) return showDialog('Aucun resto', 'Ajoutez d’abord quelques envies ou favoris.');
    const r = pickOne(pool);
    showDialog('Ce soir, c’est…', `${r.name}${r.cuisine ? ` (${r.cuisine})` : ''}`, [
      { text: 'Relancer', onPress: pickRandom },
      { text: 'Parfait !', style: 'cancel' },
    ]);
  };

  const openMap = (r: Restaurant) =>
    r.mapsUrl ? Linking.openURL(r.mapsUrl) : Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${r.place ?? ''}`)}`);

  return (
    <>
      <Screen
        overline={`${restaurants.length} adresse${restaurants.length > 1 ? 's' : ''}`}
        title="Nos restos">
        <Segmented
          options={STATUSES.map((s) => ({ value: s.value, label: `${s.label} · ${count(s.value)}` }))}
          value={tab}
          onChange={setTab}
        />

        <Card tone="feature" onPress={pickRandom} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: Fonts.displayMedium, fontSize: 21, color: t.onFeature }}>On mange où ce soir ?</Text>
            <T variant="small" color={t.onFeatureMuted}>
              Tirage au sort parmi vos envies et favoris
            </T>
          </View>
          <IconButton icon="dice-outline" label="Tirer un resto au sort" variant="accent" onPress={pickRandom} size={52} />
        </Card>

        {list.length === 0 ? (
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
      <Fab onPress={() => setEditing('new')} label="Ajouter un resto" />
      {editing && (
        <RestoSheet resto={editing === 'new' ? undefined : editing} defaultStatus={tab} onClose={() => setEditing(null)} />
      )}
    </>
  );
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
  const [name, setName] = useState(resto?.name ?? '');
  const [cuisine, setCuisine] = useState(resto?.cuisine ?? '');
  const [place, setPlace] = useState(resto?.place ?? '');
  const [status, setStatus] = useState<RestaurantStatus>(resto?.status ?? defaultStatus);
  const [rating, setRating] = useState(resto?.rating ?? 0);
  const [note, setNote] = useState(resto?.note ?? '');
  const [found, setFound] = useState<Pick<Restaurant, 'address' | 'photoUrl' | 'mapsUrl'>>({
    address: resto?.address,
    photoUrl: resto?.photoUrl,
    mapsUrl: resto?.mapsUrl,
  });

  const save = async () => {
    const data = {
      name: name.trim(),
      cuisine: cuisine.trim(),
      place: place.trim(),
      status,
      rating,
      note: note.trim(),
      address: found.address ?? '',
      photoUrl: found.photoUrl ?? '',
      mapsUrl: found.mapsUrl ?? '',
    };
    if (resto) await backend.update('restaurants', resto.id, data);
    else await backend.add('restaurants', { ...data, createdBy: backend.userId, createdAt: Date.now() });
    onClose();
  };

  return (
    <Sheet visible title={resto ? resto.name : 'Nouveau resto'} onClose={onClose}>
      {!resto && backend.mode === 'cloud' && (
        <PlaceSearch
          onPick={(p) => {
            setName(p.name);
            setCuisine(p.cuisine);
            setPlace(p.address.split(',').slice(-2, -1)[0]?.trim().replace(/^\d{5}\s*/, '') ?? '');
            setFound({ address: p.address, photoUrl: p.photoUrl ?? undefined, mapsUrl: p.mapsUrl });
          }}
        />
      )}
      {!!found.photoUrl && (
        <Image source={{ uri: found.photoUrl }} style={{ width: '100%', height: 160, borderRadius: 18 }} contentFit="cover" />
      )}
      <Field label="Nom" value={name} onChangeText={setName} placeholder="Chez Mario" />
      {!!found.address && (
        <T variant="small" muted>
          {found.address}
        </T>
      )}
      <Row style={{ gap: 12 }}>
        <Field label="Cuisine" value={cuisine} onChangeText={setCuisine} placeholder="Italien" grow />
        <Field label="Quartier" value={place} onChangeText={setPlace} placeholder="Lyon 2e" grow />
      </Row>
      <Chips label="Liste" options={STATUSES} value={status} onChange={setStatus} />
      {status !== 'envie' && (
        <View style={{ gap: 8 }}>
          <T variant="caption" muted>
            Votre note
          </T>
          <Hearts value={rating} onChange={setRating} size={32} />
        </View>
      )}
      <Field label="Notes" value={note} onChangeText={setNote} placeholder="Prendre la burrata, réserver le samedi…" multiline />
      <Button label="Enregistrer" disabled={!name.trim()} onPress={save} />
      {resto && (
        <Button
          label="Supprimer"
          variant="danger"
          icon="trash-outline"
          onPress={() =>
            confirmDelete(resto.name, async () => {
              await backend.remove('restaurants', resto.id);
              onClose();
            })
          }
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