export type Member = {
  id: string;
  name: string;
  color: string;
  /** Jeton Expo pour recevoir les notifications push sur son téléphone. */
  pushToken?: string;
};

export type Couple = {
  id: string;
  members: Member[];
  /** Date du début de la relation, format YYYY-MM-DD. */
  since?: string;
  /** Photo de couple affichée sur la carte compteur. */
  photoUrl?: string;
  /** Cadrage de cette photo (voir FramedPhoto). */
  photoFrame?: PhotoFrame;
};

/** Cadrage d'une photo : point centré (0–1 sur chaque axe) et zoom (1 = remplit le cadre). */
export type PhotoFrame = { x: number; y: number; zoom: number };

/** Identifiant d'un membre, ou « both » pour un événement à deux. */
export type Who = string;
export const BOTH = 'both';

export type EventKind = 'travail' | 'perso' | 'ensemble';

export type AgendaEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  who: Who;
  kind: EventKind;
  seriesId?: string;
  createdBy: string;
};

export type RestaurantStatus = 'envie' | 'favori' | 'teste';

export type Restaurant = {
  id: string;
  name: string;
  cuisine?: string;
  place?: string;
  status: RestaurantStatus;
  rating?: number;
  note?: string;
  /** Champs remplis par la recherche Google Places. */
  address?: string;
  photoUrl?: string;
  mapsUrl?: string;
  createdBy: string;
  createdAt: number;
};

export type ListKind = 'bucket' | 'films' | 'shopping';

export type ListItem = {
  id: string;
  list: ListKind;
  title: string;
  detail?: string;
  media?: 'film' | 'serie';
  done: boolean;
  createdBy: string;
  createdAt: number;
};

export type SpecialDate = {
  id: string;
  title: string;
  emoji: string;
  date: string; // YYYY-MM-DD
  yearly: boolean;
};

export type LoveNote = {
  id: string;
  text: string;
  from: string;
  /** « ping » = bouton « Je pense à toi ». */
  kind?: 'note' | 'ping';
  createdAt: number;
};

/** Réponse d'un membre à la question du jour. */
export type Answer = {
  id: string;
  date: string; // YYYY-MM-DD
  from: string;
  text: string;
  createdAt: number;
};

export type Memory = {
  id: string;
  photoUrl: string;
  caption?: string;
  date: string; // YYYY-MM-DD
  createdBy: string;
  createdAt: number;
};

/** Idée cadeau : visible uniquement par la personne qui l'a notée. */
export type Gift = {
  id: string;
  title: string;
  detail?: string;
  done: boolean;
  createdBy: string;
  createdAt: number;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  /** « settle » = remboursement d'un membre à l'autre. */
  kind?: 'expense' | 'settle';
  createdAt: number;
};

export type Collections = {
  events: AgendaEvent;
  restaurants: Restaurant;
  items: ListItem;
  dates: SpecialDate;
  notes: LoveNote;
  answers: Answer;
  memories: Memory;
  gifts: Gift;
  expenses: Expense;
};

export type CollectionName = keyof Collections;

/** Collections privées : chaque membre ne voit que les siennes. */
export const PRIVATE_COLLECTIONS: CollectionName[] = ['gifts'];
