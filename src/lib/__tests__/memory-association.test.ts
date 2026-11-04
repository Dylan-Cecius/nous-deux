import { prepareMemoryAssociation } from '../memory-association';

const input = () => ({ requestId: 'memory-alice-0001', photoUrl: 'data:image/jpeg;base64,AAAA', caption: ' Souvenir fictif ', date: '2026-10-15' });
const fixture = () => {
  const backend = { mode: 'cloud' as 'cloud' | 'local', userId: 'alice', coupleId: 'test-couple', call: jest.fn() };
  backend.call.mockResolvedValue({ memoryId: 'memory-1' });
  const guard = { isCurrent: jest.fn(() => true), canSubmit: jest.fn(() => true) };
  return { backend, guard, prepare: (data = input()) => prepareMemoryAssociation(backend, data, guard) };
};

test('préparer une intention n’envoie rien ; le résultat confirme seulement le reçu', async () => {
  const { backend, prepare } = fixture();
  const attempt = prepare();
  expect(backend.call).not.toHaveBeenCalled();
  await expect(attempt.submit()).resolves.toEqual({ status: 'receipt-confirmed', memoryId: 'memory-1' });
  expect(backend.call).toHaveBeenCalledWith('associateMemory', {
    ...input(), caption: 'Souvenir fictif', expectedUserId: 'alice', coupleId: 'test-couple',
  });
  await expect(attempt.submit()).resolves.toEqual({ status: 'receipt-confirmed', memoryId: 'memory-1' });
  expect(backend.call).toHaveBeenCalledTimes(1);
});

test('les doubles appels partagent une seule demande en vol', async () => {
  const { backend, prepare } = fixture();
  let finish!: (value: unknown) => void;
  backend.call.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const attempt = prepare();
  const first = attempt.submit();
  expect(attempt.submit()).toBe(first);
  await Promise.resolve();
  expect(backend.call).toHaveBeenCalledTimes(1);
  finish({ memoryId: 'memory-1' });
  await expect(first).resolves.toEqual({ status: 'receipt-confirmed', memoryId: 'memory-1' });
});

test('réponse perdue : reprise manuelle avec exactement la même intention copiée', async () => {
  const { backend, prepare } = fixture();
  backend.call.mockRejectedValueOnce(new Error('Secret fictif non destiné à l’interface'));
  const data = input();
  const attempt = prepare(data);
  data.caption = 'Modifié après préparation'; data.photoUrl = 'other://photo'; data.requestId = 'memory-alice-0002';
  await expect(attempt.submit()).resolves.toEqual({ status: 'unconfirmed' });
  const first = { ...backend.call.mock.calls[0][1] };
  // Un adaptateur ne peut pas modifier la prochaine tentative via son argument.
  backend.call.mock.calls[0][1].caption = 'Adaptateur modifié';
  await expect(attempt.submit()).resolves.toEqual({ status: 'receipt-confirmed', memoryId: 'memory-1' });
  expect(backend.call.mock.calls[1][1]).toEqual(first);
  expect(backend.call).toHaveBeenCalledTimes(2);
});

test.each([undefined, null, [], {}, { memoryId: '' }, { memoryId: '../foreign' }, { memoryId: 7 }, { memoryId: 'a'.repeat(129) }])('confirmation invalide %j : même clé conservée, aucun succès inventé', async response => {
  const { backend, prepare } = fixture();
  backend.call.mockResolvedValueOnce(response);
  const attempt = prepare();
  await expect(attempt.submit()).resolves.toEqual({ status: 'unconfirmed' });
  await expect(attempt.submit()).resolves.toEqual({ status: 'receipt-confirmed', memoryId: 'memory-1' });
  expect(backend.call.mock.calls[1][1]).toEqual(backend.call.mock.calls[0][1]);
});

test('exception synchrone : verrou libéré sans reprise automatique', async () => {
  const { backend, prepare } = fixture();
  backend.call.mockImplementationOnce(() => { throw new Error('Fictif'); });
  const attempt = prepare();
  await expect(attempt.submit()).resolves.toEqual({ status: 'unconfirmed' });
  expect(backend.call).toHaveBeenCalledTimes(1);
  await expect(attempt.submit()).resolves.toMatchObject({ status: 'receipt-confirmed' });
});

test('lecture indisponible : aucun appel, reprise possible avec la même clé', async () => {
  const { backend, guard, prepare } = fixture();
  const attempt = prepare();
  guard.canSubmit.mockReturnValue(false);
  await expect(attempt.submit()).resolves.toEqual({ status: 'blocked' });
  expect(backend.call).not.toHaveBeenCalled();
  guard.canSubmit.mockReturnValue(true);
  const pending = attempt.submit();
  guard.canSubmit.mockReturnValue(false);
  await expect(pending).resolves.toEqual({ status: 'blocked' });
  expect(backend.call).not.toHaveBeenCalled();
  guard.canSubmit.mockReturnValue(true);
  await expect(attempt.submit()).resolves.toMatchObject({ status: 'receipt-confirmed' });
});

test.each(['account', 'space', 'mode', 'guard', 'invalidate'])('contexte perdu avant appel (%s) : ancienne intention définitivement inutilisable', async reason => {
  const { backend, guard, prepare } = fixture();
  const attempt = prepare();
  const pending = attempt.submit();
  if (reason === 'account') backend.userId = 'bob';
  if (reason === 'space') backend.coupleId = 'another-couple';
  if (reason === 'mode') backend.mode = 'local';
  if (reason === 'guard') guard.isCurrent.mockReturnValue(false);
  if (reason === 'invalidate') attempt.invalidate();
  await expect(pending).resolves.toEqual({ status: 'stale' });
  backend.userId = 'alice'; backend.coupleId = 'test-couple'; backend.mode = 'cloud'; guard.isCurrent.mockReturnValue(true);
  await expect(attempt.submit()).resolves.toEqual({ status: 'stale' });
  expect(backend.call).not.toHaveBeenCalled();
});

test.each(['resolve', 'reject'])('contexte perdu pendant appel : résultat tardif %s sans confirmation pour la nouvelle session', async outcome => {
  const { backend, guard, prepare } = fixture();
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  backend.call.mockReturnValue(new Promise((yes, no) => { resolve = yes; reject = no; }));
  const attempt = prepare();
  const pending = attempt.submit();
  await Promise.resolve();
  guard.isCurrent.mockReturnValue(false);
  if (outcome === 'resolve') resolve({ memoryId: 'memory-1' }); else reject(new Error('Fictif'));
  await expect(pending).resolves.toEqual({ status: 'stale' });
  guard.isCurrent.mockReturnValue(true);
  await expect(attempt.submit()).resolves.toEqual({ status: 'stale' });
  expect(backend.call).toHaveBeenCalledTimes(1);
});

test('invalidation après confirmation ne réexpose pas le reçu de l’ancienne session', async () => {
  const { prepare } = fixture();
  const attempt = prepare();
  await attempt.submit();
  attempt.invalidate();
  await expect(attempt.submit()).resolves.toEqual({ status: 'stale' });
});

test.each([{ requestId: 'short' }, { requestId: '../foreign-memory' }, { photoUrl: '' }, { photoUrl: 'A'.repeat(600023) },
  { caption: 'x'.repeat(4001) }, { date: '2026-02-30' }, { date: 'invalid' }])('intention invalide refusée avant appel, cas %#', patch => {
  const { backend, prepare } = fixture();
  expect(() => prepare({ ...input(), ...patch })).toThrow('ne peut pas être préparée');
  expect(backend.call).not.toHaveBeenCalled();
});

test('le mode local ne prétend pas offrir ce protocole cloud', () => {
  const { backend, prepare } = fixture();
  backend.mode = 'local';
  expect(() => prepare()).toThrow('ne peut pas être préparée');
  expect(backend.call).not.toHaveBeenCalled();
});
