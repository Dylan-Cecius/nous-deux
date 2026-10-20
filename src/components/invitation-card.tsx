import { useEffect, useRef, useState } from 'react';
import { AppState, Share, type AppStateStatus } from 'react-native';
import { showDialog } from './dialog';
import { Button, Card, T } from './ui';
import { createCoupleInvitation, type Invitation } from '@/lib/backend';
import { useSession } from '@/lib/couple-context';
import { userError } from '@/lib/errors';
import { parseInvitationCode } from '@/lib/invitation-code';

function verifiedInvitation(value: unknown): Invitation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { code, expiresAt } = value as Partial<Invitation>;
  if (typeof code !== 'string' || parseInvitationCode(code) !== code ||
      typeof expiresAt !== 'number' || !Number.isSafeInteger(expiresAt) ||
      !Number.isFinite(new Date(expiresAt).getTime()) || expiresAt <= Date.now()) return null;
  return { code, expiresAt };
}

export function InvitationCard() {
  const { backend, partner } = useSession();
  if (backend.mode !== 'cloud' || partner) return null;
  return <InvitationForm key={`${backend.mode}:${backend.coupleId}:${backend.userId}`} />;
}

function InvitationForm() {
  const { backend } = useSession();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState<'create' | 'share' | null>(null);
  const locked = useRef(false);
  const currentInvitation = useRef<Invitation | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; currentInvitation.current = null; };
  }, []);
  useEffect(() => {
    if (!invitation) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const isForeground = (state: AppStateStatus | null) => state === 'active' || state === 'unknown' || state === null;
    let foreground = isForeground(AppState.currentState);
    const cancel = () => { clearTimeout(timer); timer = undefined; };
    const refresh = () => {
      cancel();
      if (currentInvitation.current !== invitation) return;
      const remaining = invitation.expiresAt - Date.now();
      if (remaining <= 0) {
        currentInvitation.current = null;
        setInvitation(null);
        setExpired(true);
      } else if (foreground) {
        // Recheck the wall clock; a delayed timer or a clock change is not expiry.
        timer = setTimeout(refresh, Math.min(60_000, remaining));
      }
    };
    const subscription = AppState.addEventListener('change', state => {
      foreground = isForeground(state);
      if (foreground) refresh(); else cancel();
    });
    refresh();
    return () => { cancel(); subscription.remove(); };
  }, [invitation]);
  const create = async () => {
    if (!active.current || locked.current) return;
    locked.current = true;
    setBusy('create');
    setExpired(false);
    // A replacement may succeed even when its response is lost: do not keep sharing the old code.
    currentInvitation.current = null;
    setInvitation(null);
    try {
      const result = await createCoupleInvitation(backend);
      if (active.current) {
        const verified = verifiedInvitation(result);
        if (!verified) {
          showDialog('Invitation indisponible', 'La réponse du service n’a pas pu être vérifiée. Crée une nouvelle invitation.');
          return;
        }
        currentInvitation.current = verified;
        setInvitation(verified);
      }
    } catch (error) {
      if (active.current) showDialog('Invitation indisponible', userError(error));
    } finally {
      locked.current = false;
      if (active.current) setBusy(null);
    }
  };
  const share = async () => {
    if (!active.current || locked.current || !invitation || currentInvitation.current !== invitation) return;
    if (invitation.expiresAt <= Date.now()) {
      currentInvitation.current = null;
      setInvitation(null);
      setExpired(true);
      return;
    }
    locked.current = true;
    setBusy('share');
    try {
      const expiresAt = new Date(invitation.expiresAt).toLocaleString('fr-FR', { timeZoneName: 'short' });
      await Share.share({ message: `Rejoins-moi dans notre espace sur Nous Deux. Une fois l’app installée, renseigne ton prénom, touche « Continuer », puis « Rejoindre ». Ton code : ${invitation.code}. Il expire le ${expiresAt} et est utilisable une seule fois. Ce code se saisit dans Nous Deux ; l’invitation TestFlight pour installer la bêta est distincte.` });
    } catch {
      if (active.current && currentInvitation.current === invitation) showDialog('Partage impossible', 'Tu peux transmettre le code affiché à ta moitié.');
    } finally {
      locked.current = false;
      if (active.current) setBusy(null);
    }
  };
  return (
    <Card tone="soft">
      <T variant="h3">Invite ta moitié</T>
      <T>Crée un code privé à transmettre à la personne qui partagera ton espace.</T>
      <T variant="small" muted>Nous Deux doit déjà être installée sur son téléphone. Le code se saisit dans l’app, dans « Rejoindre ».</T>
      {expired && <T>Cette invitation a expiré. Crée un nouveau code pour continuer.</T>}
      {invitation && <>
        <T variant="h2" selectable style={{ textAlign: 'center', letterSpacing: 3 }}>{invitation.code}</T>
        <T variant="small" muted>Expire le {new Date(invitation.expiresAt).toLocaleString('fr-FR')}. Usage unique.</T>
        <Button label="Partager l’invitation" icon="share-outline" disabled={busy !== null} onPress={share} />
      </>}
      <Button label={busy === 'create' ? 'Création…' : invitation ? 'Remplacer cette invitation' : 'Créer une invitation'} disabled={busy !== null} onPress={create} />
      {invitation && <T variant="small" muted>Un nouveau code annule le précédent. Pour changer de téléphone, connecte-toi avec ton e-mail.</T>}
    </Card>
  );
}
