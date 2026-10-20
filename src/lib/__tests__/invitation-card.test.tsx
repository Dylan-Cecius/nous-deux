import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { InvitationCard } from '@/components/invitation-card';
import { showDialog } from '@/components/dialog';
import { createCoupleInvitation } from '../backend';
import { useSession } from '../couple-context';
import { Share } from 'react-native';

jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  Share: { value: { share: jest.fn() } },
}));

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
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.restoreAllMocks(); jest.resetAllMocks(); });
const text = () => root.root.findAllByType('t' as never).map((node) => node.children.join('')).join('\n');
const start = async () => {
  await act(async () => { root = create(<InvitationCard />); });
  let pending!: Promise<void>;
  await act(async () => { pending = root.root.findByProps({ label: 'Créer une invitation' }).props.onPress(); });
  return { pending };
};

test('deux anciennes actions de création lancées avant rendu ne créent qu’un code', async () => {
  let resolve!: (value: typeof invitation) => void;
  (createCoupleInvitation as jest.Mock).mockReturnValue(new Promise(r => { resolve = r; }));
  await act(async () => { root = create(<InvitationCard />); });
  const press = root.root.findByProps({ label: 'Créer une invitation' }).props.onPress;
  let first!: Promise<void>;
  await act(async () => { first = press(); void press(); });
  expect(createCoupleInvitation).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(invitation); await first; });
});

test('une création retenue après démontage ne contacte pas le backend', async () => {
  await act(async () => { root = create(<InvitationCard />); });
  const press = root.root.findByProps({ label: 'Créer une invitation' }).props.onPress;
  await act(async () => root.unmount());
  await act(async () => press());
  expect(createCoupleInvitation).not.toHaveBeenCalled();
});

test.each(['unmount', 'replace'])('une action de partage retenue est ignorée après %s', async (change) => {
  (createCoupleInvitation as jest.Mock).mockResolvedValueOnce(invitation).mockResolvedValueOnce({ ...invitation, code: 'FICTIF-B' });
  const { pending } = await start();
  await act(async () => pending);
  const oldShare = root.root.findByProps({ label: 'Partager l’invitation' }).props.onPress;
  if (change === 'unmount') await act(async () => root.unmount());
  else await act(async () => root.root.findByProps({ label: 'Remplacer cette invitation' }).props.onPress());
  await act(async () => oldShare());
  expect(Share.share).not.toHaveBeenCalled();
  if (change === 'replace') expect(text()).toContain('FICTIF-B');
});

test('remplacement en cours : ancien code retiré et ancien partage bloqué, même après échec ambigu', async () => {
  let reject!: (error: Error) => void;
  (createCoupleInvitation as jest.Mock).mockResolvedValueOnce(invitation).mockReturnValueOnce(new Promise((_, no) => { reject = no; }));
  const { pending } = await start();
  await act(async () => pending);
  const oldShare = root.root.findByProps({ label: 'Partager l’invitation' }).props.onPress;
  let replacing!: Promise<void>;
  await act(async () => { replacing = root.root.findByProps({ label: 'Remplacer cette invitation' }).props.onPress(); void oldShare(); });
  expect(text()).not.toContain('FICTIF-A');
  expect(Share.share).not.toHaveBeenCalled();
  await act(async () => { reject(new Error('Réponse fictive perdue')); await replacing; });
  await act(async () => oldShare());
  expect(Share.share).not.toHaveBeenCalled();
  expect(text()).not.toContain('FICTIF-A');
});

test('un échec du partage après départ ne montre pas de dialogue dans le nouvel espace', async () => {
  let reject!: (error: Error) => void;
  (Share.share as jest.Mock).mockReturnValue(new Promise((_, no) => { reject = no; }));
  (createCoupleInvitation as jest.Mock).mockResolvedValue(invitation);
  const { pending } = await start();
  await act(async () => pending);
  let sharing!: Promise<void>;
  await act(async () => { sharing = root.root.findByProps({ label: 'Partager l’invitation' }).props.onPress(); });
  (useSession as jest.Mock).mockReturnValue({ backend: { ...backend, coupleId: 'space-b' } });
  await act(async () => root.update(<InvitationCard />));
  await act(async () => { reject(new Error('Partage fictif refusé')); await sharing; });
  expect(showDialog).not.toHaveBeenCalled();
});

test('partage en cours : double ouverture et remplacement bloqués, puis reprise après annulation', async () => {
  let finish!: (value: object) => void;
  (Share.share as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValue({ action: 'dismissedAction' });
  (createCoupleInvitation as jest.Mock).mockResolvedValue(invitation);
  const { pending } = await start();
  await act(async () => pending);
  const share = root.root.findByProps({ label: 'Partager l’invitation' }).props.onPress;
  const replace = root.root.findByProps({ label: 'Remplacer cette invitation' }).props.onPress;
  let sharing!: Promise<void>;
  await act(async () => { sharing = share(); void share(); void replace(); });
  expect(Share.share).toHaveBeenCalledTimes(1);
  expect(createCoupleInvitation).toHaveBeenCalledTimes(1);
  expect(root.root.findByProps({ label: 'Remplacer cette invitation' }).props.disabled).toBe(true);
  await act(async () => { finish({ action: 'dismissedAction' }); await sharing; });
  expect(root.root.findByProps({ label: 'Remplacer cette invitation' }).props.disabled).toBe(false);
  await act(async () => root.root.findByProps({ label: 'Partager l’invitation' }).props.onPress());
  expect(Share.share).toHaveBeenCalledTimes(2);
  expect(showDialog).not.toHaveBeenCalled();
});

test('un code expiré depuis le rendu ne peut être partagé', async () => {
  (createCoupleInvitation as jest.Mock).mockResolvedValue(invitation);
  const { pending } = await start();
  await act(async () => pending);
  const share = root.root.findByProps({ label: 'Partager l’invitation' }).props.onPress;
  jest.spyOn(Date, 'now').mockReturnValue(invitation.expiresAt);
  await act(async () => share());
  expect(Share.share).not.toHaveBeenCalled();
  expect(text()).not.toContain(invitation.code);
});

test('le partage indique l’échéance réelle sans promettre 24 heures supplémentaires', async () => {
  (createCoupleInvitation as jest.Mock).mockResolvedValue(invitation);
  const { pending } = await start();
  await act(async () => pending);
  await act(async () => root.root.findByProps({ label: 'Partager l’invitation' }).props.onPress());
  const message = (Share.share as jest.Mock).mock.calls[0][0].message;
  expect(message).toContain(invitation.code);
  expect(message).toContain(new Date(invitation.expiresAt).toLocaleString('fr-FR', { timeZoneName: 'short' }));
  expect(message).not.toContain('valable 24 heures');
});

test('un refus courant du partage conserve le code et permet une nouvelle tentative', async () => {
  (Share.share as jest.Mock).mockRejectedValueOnce(new Error('Échec fictif')).mockResolvedValueOnce({ action: 'sharedAction' });
  (createCoupleInvitation as jest.Mock).mockResolvedValue(invitation);
  const { pending } = await start();
  await act(async () => pending);
  await act(async () => root.root.findByProps({ label: 'Partager l’invitation' }).props.onPress());
  expect(text()).toContain(invitation.code);
  expect(showDialog).toHaveBeenCalledWith('Partage impossible', expect.any(String));
  await act(async () => root.root.findByProps({ label: 'Partager l’invitation' }).props.onPress());
  expect(Share.share).toHaveBeenCalledTimes(2);
});

test('une erreur fournisseur avec code n’affiche pas son détail technique', async () => {
  (createCoupleInvitation as jest.Mock).mockRejectedValue({ code: 'unavailable', message: 'Code privé fictif dans un détail fournisseur' });
  const { pending } = await start();
  await act(async () => pending);
  expect(showDialog).toHaveBeenCalledWith('Invitation indisponible', expect.stringContaining('connexion'));
  expect(JSON.stringify((showDialog as jest.Mock).mock.calls)).not.toContain('Code privé fictif');
});

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
