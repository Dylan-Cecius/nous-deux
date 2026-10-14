import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

initializeApp();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const GOOGLE_PLACES_KEY = defineSecret('GOOGLE_PLACES_KEY');
const REGION = 'europe-west1';

type CoupleDoc = { members: string[]; profiles: Record<string, { name: string }> };

/** Vérifie que l'appelant est bien membre du couple, et renvoie les prénoms. */
async function loadCouple(uid: string | undefined, coupleId: unknown) {
  if (!uid) throw new HttpsError('unauthenticated', 'Connexion requise.');
  if (typeof coupleId !== 'string' || !/^[A-Z0-9]{6}$/.test(coupleId)) {
    throw new HttpsError('invalid-argument', 'Code de couple invalide.');
  }
  const snap = await getFirestore().doc(`couples/${coupleId}`).get();
  const data = snap.data() as CoupleDoc | undefined;
  if (!data || !data.members.includes(uid)) throw new HttpsError('permission-denied', 'Accès refusé.');
  const partnerId = data.members.find((m) => m !== uid);
  return {
    me: data.profiles[uid]?.name ?? 'moi',
    partner: partnerId ? (data.profiles[partnerId]?.name ?? 'ma moitié') : null,
  };
}

// ---------------------------------------------------------------------------
// Assistant : phrase dictée ou photo de planning → actions à valider dans l'app
// ---------------------------------------------------------------------------

// Même forme que AssistantAction dans src/lib/assistant.ts.
const Action = z.object({
  type: z.enum(['restaurant', 'event', 'date', 'bucket', 'film', 'shopping', 'note', 'gift', 'expense']),
  summary: z.string().describe('Phrase courte en français décrivant l’action, pour confirmation.'),
  title: z.string(),
  who: z.enum(['me', 'partner', 'both']).nullable(),
  date: z.string().nullable().describe('YYYY-MM-DD'),
  start: z.string().nullable().describe('HH:MM sur 24 h'),
  end: z.string().nullable().describe('HH:MM sur 24 h'),
  repeatWeeks: z.number().int().nullable(),
  status: z.enum(['envie', 'favori', 'teste']).nullable(),
  cuisine: z.string().nullable(),
  place: z.string().nullable(),
  media: z.enum(['film', 'serie']).nullable(),
  amount: z.number().nullable(),
  paidBy: z.enum(['me', 'partner']).nullable(),
  yearly: z.boolean().nullable(),
});

const Result = z.object({
  actions: z.array(Action),
  reply: z.string().describe('Réponse courte en français à afficher, surtout si rien n’a été compris.'),
});

const SYSTEM = `Tu es l'assistant de « Nous Deux », une app pour les couples. Tu transformes ce que dit un membre du couple en actions à ajouter dans l'app. Il validera chaque action avant qu'elle soit enregistrée, donc propose ce qui correspond le mieux à sa demande, sans rien inventer.

Types d'actions et champs utiles (mets null pour les autres champs) :
- restaurant : title = nom du resto ; cuisine ; place = ville ou quartier ; status = "envie" (à tester), "favori" (coup de cœur, préféré) ou "teste" (déjà fait).
- event : un horaire dans l'agenda. title ; who = "me", "partner" ou "both" ; date ; start ; end ; repeatWeeks = nombre de semaines si c'est répété chaque semaine (sinon null).
- date : un compte à rebours (vacances, anniversaire…). title ; date ; yearly = true si ça revient chaque année.
- bucket : une envie à vivre ensemble. title.
- film : un film ou une série à voir. title ; media ; place = plateforme si citée.
- shopping : un article de la liste de courses. title (un article par action).
- note : un mot doux à envoyer à l'autre. title = le message, écrit à la première personne comme s'il venait de l'utilisateur.
- gift : une idée cadeau secrète pour l'autre. title.
- expense : une dépense commune partagée à moitié. title ; amount en euros ; paidBy = "me" ou "partner".

Règles :
- "me" désigne la personne qui parle, "partner" sa moitié. Les prénoms sont donnés dans le message.
- Résous les dates relatives (« demain », « jeudi prochain », « le 12 ») à partir de la date du jour donnée. Une date sans année est la prochaine occurrence.
- Les heures sont au format HH:MM sur 24 h.
- Si la demande est floue ou ne correspond à rien, renvoie actions = [] et explique gentiment dans reply.
- Pour une photo de planning : crée un événement par créneau de travail visible, avec le titre indiqué (ou « Travail »), pour la personne qui parle sauf mention contraire.
- reply est toujours une phrase courte, chaleureuse, en français.`;

export const assistant = onCall(
  { region: REGION, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120 },
  async (request) => {
    const { me, partner } = await loadCouple(request.auth?.uid, request.data?.coupleId);
    const { text, imageBase64, mediaType } = request.data ?? {};
    const today = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Paris',
    });
    const isoToday = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
    const context = `Aujourd'hui : ${today} (${isoToday}). La personne qui parle s'appelle ${me}${
      partner ? `, sa moitié s'appelle ${partner}` : ''
    }.`;

    let content: Anthropic.Beta.BetaContentBlockParam[];
    if (typeof imageBase64 === 'string' && typeof mediaType === 'string') {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) {
        throw new HttpsError('invalid-argument', 'Format d’image non pris en charge.');
      }
      content = [
        { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: `${context}\nVoici une photo de mon planning : ajoute mes horaires dans l'agenda.` },
      ];
    } else if (typeof text === 'string' && text.trim()) {
      content = [{ type: 'text', text: `${context}\nDemande : ${text.trim().slice(0, 2000)}` }];
    } else {
      throw new HttpsError('invalid-argument', 'Rien à analyser.');
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    try {
      const response = await client.beta.messages.parse({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: betaZodOutputFormat(Result) },
        system: SYSTEM,
        messages: [{ role: 'user', content }],
      });
      if (response.stop_reason === 'refusal' || !response.parsed_output) {
        return { actions: [], reply: 'Je n’ai pas pu traiter cette demande, tu peux reformuler ?' };
      }
      return response.parsed_output;
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new HttpsError('resource-exhausted', 'Trop de demandes, réessaie dans un instant.');
      }
      if (error instanceof Anthropic.APIError) {
        console.error('Claude API error', error.status, error.message);
        throw new HttpsError('unavailable', 'L’assistant est indisponible pour le moment.');
      }
      throw error;
    }
  },
);

// ---------------------------------------------------------------------------
// Recherche de restos (Google Places) : nom, adresse, note et photo
// ---------------------------------------------------------------------------

type Place = {
  displayName?: { text: string };
  formattedAddress?: string;
  primaryTypeDisplayName?: { text: string };
  googleMapsUri?: string;
  rating?: number;
  photos?: { name: string }[];
};

export const searchPlaces = onCall({ region: REGION, secrets: [GOOGLE_PLACES_KEY] }, async (request) => {
  await loadCouple(request.auth?.uid, request.data?.coupleId);
  const query = String(request.data?.query ?? '').trim().slice(0, 200);
  if (!query) return { places: [] };
  const key = GOOGLE_PLACES_KEY.value();

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.displayName,places.formattedAddress,places.primaryTypeDisplayName,places.googleMapsUri,places.rating,places.photos',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'fr', includedType: 'restaurant', maxResultCount: 5 }),
  });
  if (!res.ok) throw new HttpsError('unavailable', 'Recherche indisponible.');
  const { places = [] } = (await res.json()) as { places?: Place[] };

  return {
    places: await Promise.all(
      places.map(async (p) => {
        let photoUrl: string | undefined;
        const photo = p.photos?.[0]?.name;
        if (photo) {
          // skipHttpRedirect : on récupère l'adresse publique de la photo sans exposer la clé à l'app.
          const media = await fetch(
            `https://places.googleapis.com/v1/${photo}/media?maxWidthPx=600&skipHttpRedirect=true&key=${key}`,
          );
          if (media.ok) photoUrl = ((await media.json()) as { photoUri?: string }).photoUri;
        }
        return {
          name: p.displayName?.text ?? '',
          address: p.formattedAddress ?? '',
          cuisine: p.primaryTypeDisplayName?.text ?? '',
          mapsUrl: p.googleMapsUri ?? '',
          rating: p.rating ?? null,
          photoUrl: photoUrl ?? null,
        };
      }),
    ),
  };
});
