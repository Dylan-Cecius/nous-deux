import { useState } from 'react';
import { View } from 'react-native';

import { showDialog } from './dialog';
import { Button, Card, Field, Ionicons, Row, Sheet, T } from './ui';
import { useTheme } from '@/constants/theme';
import { currentAccount, deleteMyAccount, resetPassword, secureAccount, signInWithEmail, type Backend } from '@/lib/backend';
import { useCouple, useSession } from '@/lib/couple-context';
import { success } from '@/lib/haptics';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Onglet Nous : état du compte, sécurisation par e-mail, suppression. */
export function AccountCard() {
  const t = useTheme();
  const { backend } = useSession();
  const { signOut } = useCouple();
  const [securing, setSecuring] = useState(false);
  const [, refresh] = useState(0);
  const account = backend.mode === 'cloud' ? currentAccount() : null;

  const askDelete = () =>
    showDialog(
      'Supprimer ton compte ?',
      backend.mode === 'local'
        ? 'Toutes les données de ce téléphone seront effacées. C’est définitif.'
        : 'Ton compte, ton profil et tes idées cadeaux seront effacés. Les données partagées restent pour ta moitié ; si tu es seul·e dans l’espace, tout l’espace est effacé. C’est définitif.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMyAccount(backend);
              await signOut();
            } catch (e) {
              showDialog('Suppression impossible', errorText(e));
            }
          },
        },
      ],
    );

  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ gap: 10 }}>
        <Ionicons
          name={account && !account.anonymous ? 'shield-checkmark' : 'shield-outline'}
          size={22}
          color={account && !account.anonymous ? t.success : t.primary}
        />
        <T variant="h3">Ton compte</T>
      </Row>

      {backend.mode === 'local' ? (
        <T muted>Mode sans compte : tout reste sur ce téléphone.</T>
      ) : account && !account.anonymous ? (
        <T muted>
          Sécurisé avec <T style={{ fontWeight: '700' }}>{account.email}</T>. Sur un nouveau téléphone, choisis « J’ai déjà
          un compte » pour retrouver votre espace.
        </T>
      ) : (
        <>
          <T muted>
            Ton compte n’est lié qu’à ce téléphone. Ajoute un e-mail et un mot de passe pour retrouver votre espace si tu
            changes de téléphone.
          </T>
          <Button label="Sécuriser mon compte" icon="lock-closed-outline" onPress={() => setSecuring(true)} />
        </>
      )}

      <Button label="Supprimer mon compte" variant="danger" icon="trash-outline" small onPress={askDelete} />

      {securing && (
        <SecureSheet
          onClose={() => setSecuring(false)}
          onDone={() => {
            setSecuring(false);
            refresh((n) => n + 1);
          }}
        />
      )}
    </Card>
  );
}

function SecureSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = email.includes('@') && password.length >= 6 && password === confirm;

  const submit = async () => {
    setBusy(true);
    try {
      await secureAccount(email, password);
      success();
      showDialog('Compte sécurisé', 'Tu pourras te reconnecter avec cet e-mail sur n’importe quel téléphone.');
      onDone();
    } catch (e) {
      showDialog('Oups', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible title="Sécuriser mon compte" onClose={onClose}>
      <Field label="E-mail" value={email} onChangeText={setEmail} placeholder="toi@exemple.fr" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Mot de passe (6 caractères minimum)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Field label="Confirme le mot de passe" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
      {!!confirm && password !== confirm && <T variant="small" muted>Les deux mots de passe sont différents.</T>}
      <Button label="Sécuriser" disabled={!valid || busy} onPress={submit} />
    </Sheet>
  );
}

/** Écran de bienvenue : se reconnecter avec son e-mail (nouveau téléphone, réinstallation). */
export function SignInForm({
  onSignedIn,
  onBack,
  dark,
}: {
  onSignedIn: (backend: Backend) => void;
  onBack: () => void;
  dark?: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      onSignedIn(await signInWithEmail(email, password));
    } catch (e) {
      showDialog('Connexion impossible', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.includes('@')) return showDialog('Mot de passe oublié', 'Entre d’abord ton adresse e-mail.');
    try {
      await resetPassword(email);
      showDialog('E-mail envoyé', 'Regarde ta boîte mail pour choisir un nouveau mot de passe.');
    } catch (e) {
      showDialog('Oups', errorText(e));
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Field dark={dark} label="E-mail" value={email} onChangeText={setEmail} placeholder="toi@exemple.fr" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field dark={dark} label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      <Button label="Me connecter" variant={dark ? 'sunset' : 'primary'} disabled={busy || !email || !password} onPress={submit} />
      <Button label="Mot de passe oublié ?" variant={dark ? 'glass' : 'ghost'} small onPress={forgot} />
      <Button label="Retour" variant={dark ? 'glass' : 'ghost'} onPress={onBack} />
    </View>
  );
}
