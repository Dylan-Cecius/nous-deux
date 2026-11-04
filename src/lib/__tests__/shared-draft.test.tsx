import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useEffect } from 'react';
import { draftPatch, useSharedDraft } from '../use-shared-draft';

const initial = { title: 'Initial', rating: 0, note: '' };
let current: ReturnType<typeof useSharedDraft<typeof initial>>;
let root: ReactTestRenderer;
function Form({ received }: { received: typeof initial | null }) {
  const draft = useSharedDraft(initial, received);
  useEffect(() => { current = draft; }, [draft]);
  return null;
}
const receive = async (received: typeof initial | null) => { await act(async () => {
  if (root) root.update(<Form received={received} />);
  else root = create(<Form received={received} />);
}); };
afterEach(async () => { await act(async () => root.unmount()); root = undefined as never; });

test('la frappe conserve ses espaces tant que la source est inchangée', async () => {
  await receive(initial);
  await act(async () => current.setValues((v) => ({ ...v, title: 'Initial ' })));
  await receive({ ...initial });
  expect(current.values.title).toBe('Initial ');
  expect(draftPatch(current.base, current.values)).toEqual({});
});

test('une saisie significative survit à plusieurs valeurs reçues', async () => {
  await receive(initial);
  await act(async () => current.setValues((v) => ({ ...v, title: 'Saisi', rating: 3 })));
  await receive({ ...initial, title: 'Reçu', note: 'Nouveau' });
  await receive({ ...initial, title: 'Reçu encore', note: 'Autre' });
  expect(current.values).toEqual({ title: 'Saisi', rating: 3, note: 'Autre' });
  expect(draftPatch(current.base, current.values)).toEqual({ title: 'Saisi', rating: 3 });
});

test('un champ redevenu identique à la source suit la prochaine réception', async () => {
  await receive(initial);
  await act(async () => current.setValues((v) => ({ ...v, rating: 4 })));
  await receive({ ...initial, rating: 4 });
  expect(draftPatch(current.base, current.values)).toEqual({});
  await receive({ ...initial, rating: 5 });
  expect(current.values.rating).toBe(5);
});

test('une indisponibilité garde la base et le brouillon sans réinitialiser', async () => {
  await receive({ ...initial, note: 'Reçue' });
  await act(async () => current.setValues((v) => ({ ...v, title: 'Saisi' })));
  await receive(null);
  expect(current.values).toEqual({ title: 'Saisi', rating: 0, note: 'Reçue' });
  expect(draftPatch(current.base, current.values)).toEqual({ title: 'Saisi' });
});

test('effacer un champ ou retirer une note produit un patch explicite', async () => {
  await receive({ ...initial, note: 'Texte', rating: 5 });
  await act(async () => current.setValues((v) => ({ ...v, note: '  ', rating: 0 })));
  expect(draftPatch(current.base, current.values)).toEqual({ note: '', rating: 0 });
});
