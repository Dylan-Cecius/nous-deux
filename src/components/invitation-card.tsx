import { useEffect, useRef, useState } from 'react';
import { Share } from 'react-native';
import { showDialog } from './dialog';
import { Button, Card, T } from './ui';
import { createCoupleInvitation, type Invitation } from '@/lib/backend';
import { useSession } from '@/lib/couple-context';

export function InvitationCard() {
  const { backend, partner } = useSession();
  if (backend.mode !== 'cloud' || partner) return null;
  return <InvitationForm key={`${backend.mode}:${backend.coupleId}:${backend.userId}`} />;
}

function InvitationForm() {
  const { backend } = useSession();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    if (!invitation) return;
    const timer = setTimeout(() => setInvitation(null), Math.max(0, invitation.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [invitation]);
  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await createCoupleInvitation(backend);
      if (active.current) setInvitation(result);
    } catch (error) {
      if (active.current) showDialog('Invitation indisponible', error instanceof Error ? error.message : String(error));
    } finally {
      if (active.current) setBusy(false);
    }
  };
  const share = async () => {
    if (!invitation || invitation.expiresAt <= Date.now()) return setInvitation(null);
    try {
      await Share.share({ message: `Rejoins-moi sur Nous Deux. Ton code d’invitation : ${invitation.code}. Il est valable 24 heures et utilisable une seule fois.` });
    } catch { showDialog('Partage impossible', 'Tu peux transmettre le code affiché à ta moitié.'); }
  };
  return (
    <Card tone="soft">
      <T variant="h3">Invite ta moitié</T>
      <T>Crée un code privé à transmettre à la personne qui partagera ton espace.</T>
      {invitation && <>
        <T variant="h2" style={{ textAlign: 'center', letterSpacing: 3 }}>{invitation.code}</T>
        <T variant="small" muted>Expire le {new Date(invitation.expiresAt).toLocaleString('fr-FR')}. Usage unique.</T>
        <Button label="Partager l’invitation" icon="share-outline" onPress={share} />
      </>}
      <Button label={busy ? 'Création…' : invitation ? 'Remplacer cette invitation' : 'Créer une invitation'} disabled={busy} onPress={create} />
      {invitation && <T variant="small" muted>Un nouveau code annule le précédent. Pour changer de téléphone, connecte-toi avec ton e-mail.</T>}
    </Card>
  );
}
