import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemberColors } from '@/constants/theme';
import { createCloudCouple, createLocalCouple, joinCloudCouple, type Backend } from '../backend';
import { useOnboardingForm, type OnboardingStep } from '../use-onboarding-form';
import { showDialog } from '@/components/dialog';

jest.mock('../backend', () => ({ createCloudCouple: jest.fn(), createLocalCouple: jest.fn(), joinCloudCouple: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let root: ReactTestRenderer;
let form: ReturnType<typeof useOnboardingForm>;
const install = jest.fn();
const backend = { mode: 'local', coupleId: 'fictitious', userId: 'alice' } as Backend;
function Harness({ step = 'profile' }: { step?: OnboardingStep }) {
  const current = useOnboardingForm(install, step);
  useEffect(() => { form = current; }, [current]);
  return null;
}
beforeEach(async () => {
  jest.clearAllMocks();
  for (const action of [createCloudCouple, createLocalCouple, joinCloudCouple]) (action as jest.Mock).mockReset().mockResolvedValue(backend);
  await act(async () => { root = create(<Harness />); });
  await act(async () => { form.changeName('Ancien prénom'); form.changePartnerName('Ancien partenaire'); form.changeCode('ABCD234567'); });
});
afterEach(async () => { await act(async () => root.unmount()); });

test.each([false, true])('une ancienne création relit prénom et couleur (rendu : %s)', async rendered => {
  const submit = form.createCloud;
  await act(async () => {
    form.changeName(' Camille fictive '); form.changeColor(MemberColors[2]);
    if (!rendered) await submit();
  });
  if (rendered) await act(async () => { await submit(); });
  expect(createCloudCouple).toHaveBeenCalledWith({ name: 'Camille fictive', color: MemberColors[2] });
});

test.each([false, true])('une ancienne jonction relit le code remplacé (rendu : %s)', async rendered => {
  const submit = form.join;
  await act(async () => {
    form.changeCode('zyxw765432');
    if (!rendered) await submit();
  });
  if (rendered) await act(async () => { await submit(); });
  expect(joinCloudCouple).toHaveBeenCalledWith('ZYXW765432', { name: 'Ancien prénom', color: MemberColors[0] });
});

test.each([false, true])('une ancienne création locale relit les deux profils (rendu : %s)', async rendered => {
  const submit = form.createLocal;
  await act(async () => {
    form.changeName(' Camille fictive '); form.changeColor(MemberColors[2]); form.changePartnerName(' Alex fictif ');
    if (!rendered) await submit();
  });
  if (rendered) await act(async () => { await submit(); });
  expect(createLocalCouple).toHaveBeenCalledWith({ name: 'Camille fictive', color: MemberColors[2] }, { name: 'Alex fictif', color: MemberColors[0] });
});

test.each(['createCloud', 'join', 'createLocal'] as const)('un prénom effacé bloque %s', async action => {
  const submit = form[action];
  await act(async () => { form.changeName('  '); await submit(); });
  expect(createCloudCouple).not.toHaveBeenCalled(); expect(joinCloudCouple).not.toHaveBeenCalled(); expect(createLocalCouple).not.toHaveBeenCalled();
});

test('un code effacé ne réutilise pas l’ancien code', async () => {
  const submit = form.join;
  await act(async () => { form.changeCode(''); await submit(); });
  expect(joinCloudCouple).not.toHaveBeenCalled();
});

test('un prénom partenaire effacé bloque la création locale', async () => {
  const submit = form.createLocal;
  await act(async () => { form.changePartnerName(' '); await submit(); });
  expect(createLocalCouple).not.toHaveBeenCalled();
});

test('la demande en cours conserve ses coordonnées et verrouille les suivantes', async () => {
  let finish!: (value: Backend) => void;
  (joinCloudCouple as jest.Mock).mockImplementationOnce(() => new Promise<Backend>(resolve => { finish = resolve; }));
  let pending!: Promise<unknown>;
  await act(async () => { pending = form.join(); form.changeCode('ZYXW765432'); });
  expect(form.code).toBe('ABCD234567');
  await act(async () => { finish(backend); await pending; });
  expect(joinCloudCouple).toHaveBeenCalledWith('ABCD234567', { name: 'Ancien prénom', color: MemberColors[0] });
  expect(install).toHaveBeenCalledTimes(1);
});

test('des callbacks conservés après sortie ne créent rien', async () => {
  const previous = form;
  await act(async () => root.unmount());
  await act(async () => { previous.changeName('Tardif'); await previous.createCloud(); await previous.createLocal(); await previous.join(); });
  expect(createCloudCouple).not.toHaveBeenCalled(); expect(joinCloudCouple).not.toHaveBeenCalled(); expect(createLocalCouple).not.toHaveBeenCalled();
});

test.each([false, true])('Continuer ne quitte pas un prénom devenu vide (rendu : %s)', async rendered => {
  const proceed = form.continueProfile;
  const next = jest.fn();
  await act(async () => {
    form.changeName(' ');
    if (!rendered) proceed(next);
  });
  if (rendered) await act(async () => proceed(next));
  expect(next).not.toHaveBeenCalled();
  await act(async () => { form.changeName('Camille fictive'); proceed(next); });
  expect(next).toHaveBeenCalledTimes(1);
});

test.each([false, true])('les saisies d’une ancienne étape sont ignorées (aller-retour : %s)', async roundtrip => {
  const previous = form;
  await act(async () => root.update(<Harness step="local" />));
  if (roundtrip) await act(async () => root.update(<Harness step="profile" />));
  await act(async () => { previous.changeName('Périmé'); previous.changeColor(MemberColors[2]); previous.changeCode('ZYXW765432'); previous.changePartnerName('Périmé'); });
  expect(form.name).toBe('Ancien prénom');
  expect(form.color).toBe(MemberColors[0]);
  expect(form.code).toBe('ABCD234567');
  expect(form.partnerName).toBe('Ancien partenaire');
});

test.each(['createCloud', 'join', 'createLocal'] as const)('une ancienne étape ne démarre pas %s', async action => {
  const submit = form[action];
  await act(async () => root.update(<Harness step="signin" />));
  await act(async () => { await submit(); });
  expect(createCloudCouple).not.toHaveBeenCalled(); expect(joinCloudCouple).not.toHaveBeenCalled(); expect(createLocalCouple).not.toHaveBeenCalled();
});

test('une ancienne navigation ne quitte pas la nouvelle étape', async () => {
  const previous = form;
  const next = jest.fn();
  await act(async () => root.update(<Harness step="local" />));
  await act(async () => { previous.interact(next); previous.continueProfile(next); });
  expect(next).not.toHaveBeenCalled();
});

test.each(['success', 'failure'])('une réponse %s après transition ne touche pas la nouvelle étape', async outcome => {
  let finish!: () => void;
  (createCloudCouple as jest.Mock).mockImplementationOnce(() => new Promise<Backend>((resolve, reject) => {
    finish = () => outcome === 'success' ? resolve(backend) : reject(new Error('Réponse fictive tardive'));
  }));
  let pending!: Promise<unknown>;
  await act(async () => { pending = form.createCloud(); });
  await act(async () => root.update(<Harness step="signin" />));
  await act(async () => { finish(); await pending; });
  expect(install).not.toHaveBeenCalled();
  expect(showDialog).not.toHaveBeenCalled();
});

test('une transition conserve les champs et permet une nouvelle action courante', async () => {
  await act(async () => root.update(<Harness step="local" />));
  await act(async () => { form.changePartnerName('Nouveau fictif'); await form.createLocal(); });
  expect(createLocalCouple).toHaveBeenCalledWith({ name: 'Ancien prénom', color: MemberColors[0] }, { name: 'Nouveau fictif', color: MemberColors[1] });
});
