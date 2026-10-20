import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { DialogHost, showDialog } from '@/components/dialog';
import { useReducedMotion } from '../use-reduced-motion';

jest.mock('../use-reduced-motion', () => ({ useReducedMotion: jest.fn(() => false) }));

jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), Fonts: {} }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  Platform: { value: { ...jest.requireActual('react-native').Platform, OS: 'web' } },
  Modal: { value: 'modal' },
  Pressable: { value: 'pressable' },
}));

let root: ReactTestRenderer;
const buttons = () => root.root.findAllByType(Pressable);
beforeEach(async () => { Platform.OS = 'web'; (useReducedMotion as jest.Mock).mockReturnValue(false); await act(async () => { root = create(<DialogHost />); }); });
afterEach(async () => { await act(async () => root.unmount()); jest.restoreAllMocks(); });

test('le dialogue web devient statique sans perdre la confirmation courante', async () => {
  const action = jest.fn();
  await act(async () => showDialog('Fictif', 'Message conservé', [{ text: 'Confirmer', onPress: action }]));
  expect(root.root.findByType(Modal).props.animationType).toBe('fade');
  (useReducedMotion as jest.Mock).mockReturnValue(true);
  await act(async () => root.update(<DialogHost />));
  expect(root.root.findByType(Modal).props.animationType).toBe('none');
  expect(root.root.findAllByType(Text).some(node => node.props.children === 'Message conservé')).toBe(true);
  await act(async () => buttons()[0].props.onPress());
  expect(action).toHaveBeenCalledTimes(1);
  (useReducedMotion as jest.Mock).mockReturnValue(false);
});

test('un message long dispose d’une zone défilante bornée sans emporter les boutons', async () => {
  const message = 'Texte fictif très long. '.repeat(200);
  await act(async () => showDialog('Titre fictif', message, [{ text: 'Annuler', style: 'cancel' }, { text: 'Confirmer' }]));
  const scroll = root.root.findByType(ScrollView);
  expect(scroll.findAllByType(Text).map(node => node.props.children)).toContain(message);
  expect(scroll.findAllByType(Pressable)).toHaveLength(0);
  expect(buttons()).toHaveLength(2);
  expect(StyleSheet.flatten(scroll.props.style)).toMatchObject({ flexShrink: 1 });
  const box = root.root.findByProps({ accessibilityRole: 'alert' });
  expect(StyleSheet.flatten(box.props.style).maxHeight).toBe('100%');
});

test('une confirmation web ne peut être consommée deux fois avant le rendu', async () => {
  const action = jest.fn();
  await act(async () => showDialog('Confirmation fictive', undefined, [{ text: 'Valider', onPress: action }]));
  const press = buttons()[0].props.onPress;
  await act(async () => { press(); press(); });
  expect(action).toHaveBeenCalledTimes(1);
  expect(root.root.findAllByType(Modal)).toHaveLength(0);
});

test('une ancienne confirmation ne peut agir ni fermer celle qui la remplace', async () => {
  const oldAction = jest.fn(), newAction = jest.fn();
  await act(async () => showDialog('Ancienne', undefined, [{ text: 'Valider', onPress: oldAction }]));
  const oldPress = buttons()[0].props.onPress;
  await act(async () => {
    showDialog('Nouvelle', undefined, [{ text: 'Valider', onPress: newAction }]);
    oldPress();
  });
  expect(oldAction).not.toHaveBeenCalled();
  expect(root.root.findAllByType(Modal)).toHaveLength(1);
  await act(async () => buttons()[0].props.onPress());
  expect(newAction).toHaveBeenCalledTimes(1);
});

test.each([true, false])('une fermeture périmée ne masque pas le nouveau dialogue (annulation %s)', async (withCancel) => {
  const cancel = jest.fn();
  await act(async () => showDialog('Ancienne', undefined, withCancel ? [{ text: 'Annuler', style: 'cancel', onPress: cancel }] : [{ text: 'OK' }]));
  const oldClose = root.root.findByType(Modal).props.onRequestClose;
  await act(async () => { showDialog('Nouvelle'); oldClose(); });
  expect(cancel).not.toHaveBeenCalled();
  expect(root.root.findAllByType(Modal)).toHaveLength(1);
});

test('une action retenue après démontage ne s’exécute plus', async () => {
  const action = jest.fn();
  await act(async () => showDialog('Fictive', undefined, [{ text: 'Valider', onPress: action }]));
  const press = buttons()[0].props.onPress;
  await act(async () => root.unmount());
  await act(async () => press());
  expect(action).not.toHaveBeenCalled();
});

test('la fermeture courante appelle l’annulation une seule fois', async () => {
  const cancel = jest.fn();
  await act(async () => showDialog('Fictive', undefined, [{ text: 'Annuler', style: 'cancel', onPress: cancel }]));
  const close = root.root.findByType(Modal).props.onRequestClose;
  await act(async () => { close(); close(); });
  expect(cancel).toHaveBeenCalledTimes(1);
});

test('une action peut ouvrir un nouveau dialogue sans que sa fermeture le masque', async () => {
  await act(async () => showDialog('Premier', undefined, [{ text: 'Suivant', onPress: () => showDialog('Second') }]));
  await act(async () => buttons()[0].props.onPress());
  expect(root.root.findAllByType(Modal)).toHaveLength(1);
});

test('fermer sans bouton annuler invalide aussi la confirmation retenue', async () => {
  const action = jest.fn();
  await act(async () => showDialog('Fictive', undefined, [{ text: 'Valider', onPress: action }]));
  const press = buttons()[0].props.onPress;
  const close = root.root.findByType(Modal).props.onRequestClose;
  await act(async () => { close(); press(); });
  expect(action).not.toHaveBeenCalled();
  expect(root.root.findAllByType(Modal)).toHaveLength(0);
});

test('un callback qui échoue ne peut pas être rejoué avec le même bouton', async () => {
  const action = jest.fn(() => { throw new Error('Erreur fictive'); });
  await act(async () => showDialog('Fictive', undefined, [{ text: 'Valider', onPress: action }]));
  const press = buttons()[0].props.onPress;
  await act(async () => {
    expect(press).toThrow('Erreur fictive');
    expect(press).not.toThrow();
  });
  expect(action).toHaveBeenCalledTimes(1);
});

test('sur iOS la confirmation reste déléguée à Alert sans changer ses options', () => {
  Platform.OS = 'ios';
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const choices = [{ text: 'OK', onPress: jest.fn() }];
  showDialog('Fictif', 'Texte fictif', choices);
  expect(alert).toHaveBeenCalledWith('Fictif', 'Texte fictif', choices);
});
