import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { InvitationCard } from '@/components/invitation-card';
import { showDialog } from '@/components/dialog';
import { createCoupleInvitation } from '../backend';
import { useSession } from '../couple-context';

jest.mock('../couple-context', () => ({ useSession: jest.fn() }));
jest.mock('../backend', () => ({ createCoupleInvitation: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return Object.fromEntries(['Card', 'T', 'Button'].map((name) => [name, (props: object) => React.createElement(name.toLowerCase(), props)]));
});

let root: ReactTestRenderer;
const backend = { mode: 'cloud', coupleId: 'space-a', userId: 'alice' };
const invitation = { code: 'FICTIF-A', expiresAt: Date.now() + 60_000 };
beforeEach(() => { (useSession as jest.Mock).mockReturnValue({ backend }); });
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.resetAllMocks(); });
const text = () => root.root.findAllByType('t' as never).map((node) => node.children.join('')).join('\n');
const start = async () => {
  await act(async () => { root = create(<InvitationCard />); });
  let pending!: Promise<void>;
  await act(async () => { pending = root.root.findByProps({ label: 'Créer une invitation' }).props.onPress(); });
  return { pending };
};

test.each(['space', 'member', 'partner'])('un code déjà chargé est effacé au changement %s', async (change) => {
  (createCoupleInvitation as jest.Mock).mockResolvedValue(invitation);
  const { pending } = await start();
  await act(async () => { await pending; });
  expect(text()).toContain('FICTIF-A');
  (useSession as jest.Mock).mockReturnValue(change === 'partner' ? { backend, partner: { id: 'bob' } } : { backend: { ...backend, ...(change === 'space' ? { coupleId: 'space-b' } : { userId: 'bob' }) } });
  await act(async () => { root.update(<InvitationCard />); });
  expect(text()).not.toContain('FICTIF-A');
  if (change === 'partner') {
    (useSession as jest.Mock).mockReturnValue({ backend });
    await act(async () => { root.update(<InvitationCard />); });
    expect(text()).not.toContain('FICTIF-A');
  }
});

test.each(['success', 'failure'])('un retour tardif (%s) ne contamine pas le nouvel espace', async (result) => {
  let resolve!: (value: typeof invitation) => void;
  let reject!: (error: Error) => void;
  (createCoupleInvitation as jest.Mock).mockReturnValue(new Promise((yes, no) => { resolve = yes; reject = no; }));
  const { pending } = await start();
  (useSession as jest.Mock).mockReturnValue({ backend: { ...backend, coupleId: 'space-b' } });
  await act(async () => { root.update(<InvitationCard />); });
  await act(async () => { if (result === 'success') resolve(invitation); else reject(new Error('Ancien espace')); await pending; });
  expect(text()).not.toContain('FICTIF-A');
  expect(showDialog).not.toHaveBeenCalled();
  expect(root.root.findByProps({ label: 'Créer une invitation' }).props.disabled).toBe(false);
});

test('une erreur courante reste visible et permet une nouvelle tentative volontaire', async () => {
  (createCoupleInvitation as jest.Mock).mockRejectedValueOnce(new Error('Échec fictif')).mockResolvedValueOnce(invitation);
  const { pending } = await start();
  await act(async () => { await pending; });
  expect(showDialog).toHaveBeenCalledWith('Invitation indisponible', 'Échec fictif');
  await act(async () => { await root.root.findByProps({ label: 'Créer une invitation' }).props.onPress(); });
  expect(text()).toContain('FICTIF-A');
  expect(createCoupleInvitation).toHaveBeenCalledTimes(2);
});

test('le même contexte conserve sa requête même si l’objet backend est reconstruit', async () => {
  let resolve!: (value: typeof invitation) => void;
  (createCoupleInvitation as jest.Mock).mockReturnValue(new Promise((yes) => { resolve = yes; }));
  const { pending } = await start();
  (useSession as jest.Mock).mockReturnValue({ backend: { ...backend } });
  await act(async () => { root.update(<InvitationCard />); });
  await act(async () => { resolve(invitation); await pending; });
  expect(text()).toContain('FICTIF-A');
  expect(root.root.findByProps({ label: 'Remplacer cette invitation' }).props.disabled).toBe(false);
});
