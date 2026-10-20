import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemberColors } from '@/constants/theme';
import { createCloudCouple, createLocalCouple, joinCloudCouple, type Backend } from '../backend';
import { useOnboardingForm } from '../use-onboarding-form';

jest.mock('../backend', () => ({ createCloudCouple: jest.fn(), createLocalCouple: jest.fn(), joinCloudCouple: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let root: ReactTestRenderer;
let form: ReturnType<typeof useOnboardingForm>;
const install = jest.fn();
const backend = { mode: 'local', coupleId: 'fictitious', userId: 'alice' } as Backend;
function Harness() {
  const current = useOnboardingForm(install);
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
