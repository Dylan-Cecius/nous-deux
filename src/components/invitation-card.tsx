import { useEffect, useRef, useState } from 'react';
import { Share } from 'react-native';
import { showDialog } from './dialog';
import { Button, Card, T } from './ui';
import { createCoupleInvitation, type Invitation } from '@/lib/backend';
import { useSession } from '@/lib/couple-context';
import { userError } from '@/lib/errors';

export function InvitationCard() {
  const { backend, partner } = useSession();
  if (backend.mode !== 'cloud' || partner) return null;
  return <InvitationForm key={`${backend.mode}:${backend.coupleId}:${backend.userId}`} />;
}

function InvitationForm() {
  const { backend } = useSession();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
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
    const timer = setTimeout(() => {
      if (currentInvitation.current !== invitation) return;
      currentInvitation.current = null;
      setInvitation(null);
    }, Math.max(0, invitation.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [invitation]);
  const create = async () => {
    if (!active.current || locked.current) return;
    locked.current = true;
    setBusy('create');
    // A replacement may succeed even when its response is lost: do not keep sharing the old code.
    currentInvitation.current = null;
    setInvitation(null);
    try {
      const result = await createCoupleInvitation(backend);
      if (active.current) {
        currentInvitation.current = result;
        setInvitation(result);
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
      return;
    }
    locked.current = true;
    setBusy('share');
    try {
      const expiresAt = new Date(invitation.expiresAt).toLocaleString('fr-FR', { timeZoneName: 'short' });
      await Share.share({ message: `Rejoins-moi sur Nous Deux. Ton code d’invitation : ${invitation.code}. Il expire le ${expiresAt} et est utilisable une seule fois.` });
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
      {invitation && <>
        <T variant="h2" style={{ textAlign: 'center', letterSpacing: 3 }}>{invitation.code}</T>
        <T variant="small" muted>Expire le {new Date(invitation.expiresAt).toLocaleString('fr-FR')}. Usage unique.</T>
        <Button label="Partager l’invitation" icon="share-outline" disabled={busy !== null} onPress={share} />
      </>}
      <Button label={busy === 'create' ? 'Création…' : invitation ? 'Remplacer cette invitation' : 'Créer une invitation'} disabled={busy !== null} onPress={create} />
      {invitation && <T variant="small" muted>Un nouveau code annule le précédent. Pour changer de téléphone, connecte-toi avec ton e-mail.</T>}
    </Card>
  );
}
