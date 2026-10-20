/** @jest-environment jsdom */
/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { URL } from 'node:url';

const script = readFileSync(resolve(__dirname, '../../..', 'website/forms.js'), 'utf8');

function mount(kind = 'support', recipient = 'support@example.test') {
  // Minimal DOM fixture, not a generated-page, CSS, native or delivery test.
  document.body.innerHTML = `
    <form data-request-form="${kind}" data-support-email="${recipient}">
      <input name="email" type="email" required value="alice@example.test">
      <input name="accountEmail" type="email" value="account@example.test">
      <select name="mode"><option>Local</option><option>Cloud</option></select>
      <select name="reason"><option>Autre</option><option>Connexion</option></select>
      <textarea name="message">Message fictif initial</textarea>
      <input name="ownAccount" type="checkbox" checked>
      <p data-status role="status"></p>
      <div data-result hidden>
        <textarea data-message readonly></textarea>
        <a data-email-link hidden>Ouvrir la messagerie</a>
        <button type="button" data-copy>Copier</button>
      </div>
    </form>`;
  // Run the shipped classic script, with actual DOM events and FormData.
  new Function(script)();
  const form = document.querySelector('form')!;
  const result = document.querySelector<HTMLElement>('[data-result]')!;
  const preview = document.querySelector<HTMLTextAreaElement>('[data-message]')!;
  const link = document.querySelector<HTMLAnchorElement>('[data-email-link]')!;
  const status = document.querySelector<HTMLElement>('[data-status]')!;
  const copy = document.querySelector<HTMLButtonElement>('[data-copy]')!;
  const submit = () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const change = (name: string, value: string, event = 'input') => {
    const field = form.elements.namedItem(name) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event(event, { bubbles: true }));
  };
  return { form, result, preview, link, status, copy, submit, change };
}

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  jest.restoreAllMocks();
});

test.each(['support', 'deletion'])('une saisie modifiée invalide le message préparé (%s)', kind => {
  const page = mount(kind);
  page.submit();
  expect(page.result.hidden).toBe(false);
  page.change('email', 'bob@example.test');
  expect(page.result.hidden).toBe(true);
  expect(page.link.hidden).toBe(true);
  expect(page.link.hasAttribute('href')).toBe(false);
  expect(page.preview.value).toBe('');
  expect(page.status.textContent).toContain('prépare');
});

test('un changement de choix invalide aussi le résultat', () => {
  const page = mount();
  page.submit();
  page.change('reason', 'Connexion', 'change');
  expect(page.result.hidden).toBe(true);
  expect(page.link.hasAttribute('href')).toBe(false);
});

test('réinitialiser le formulaire retire le message et son lien', () => {
  const page = mount();
  page.submit();
  page.form.reset();
  expect(page.result.hidden).toBe(true);
  expect(page.preview.value).toBe('');
  expect(page.link.hasAttribute('href')).toBe(false);
});

test('une soumission invalide ne laisse pas utilisable un ancien résultat', () => {
  const page = mount();
  page.submit();
  (page.form.elements.namedItem('email') as HTMLInputElement).value = '';
  page.submit();
  expect(page.result.hidden).toBe(true);
  expect(page.link.hasAttribute('href')).toBe(false);
});

test('la validation native qui empêche submit retire aussi le résultat', () => {
  const page = mount();
  page.submit();
  (page.form.elements.namedItem('email') as HTMLInputElement).value = '';
  expect(page.form.reportValidity()).toBe(false);
  expect(page.result.hidden).toBe(true);
  expect(page.link.hasAttribute('href')).toBe(false);
});

test('retirer la confirmation de compte invalide le message de suppression', () => {
  const page = mount('deletion');
  page.submit();
  const checkbox = page.form.elements.namedItem('ownAccount') as HTMLInputElement;
  checkbox.checked = false;
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  expect(page.result.hidden).toBe(true);
  expect(page.link.hasAttribute('href')).toBe(false);
});

test('préparer à nouveau utilise les nouvelles valeurs sans envoyer de demande', () => {
  const page = mount();
  page.submit();
  page.change('message', 'Nouveau texte fictif & accents é');
  page.change('email', 'bob@example.test');
  page.submit();
  expect(page.result.hidden).toBe(false);
  const mail = new URL(page.link.href);
  expect(mail.protocol).toBe('mailto:');
  expect(mail.searchParams.get('body')).toContain('bob@example.test');
  expect(mail.searchParams.get('body')).toContain('Nouveau texte fictif & accents é');
  expect(mail.searchParams.get('body')).not.toContain('alice@example.test');
  expect(page.status.textContent).toContain('pas envoyé');
});

test('sans adresse confirmée, seul le texte est préparé', () => {
  const page = mount('support', '');
  page.submit();
  expect(page.result.hidden).toBe(false);
  expect(page.link.hidden).toBe(true);
  expect(page.link.hasAttribute('href')).toBe(false);
  expect(page.status.textContent).toContain('aucune demande');
});

function clipboard() {
  let succeed!: () => void;
  let fail!: () => void;
  const pending = new Promise<void>((resolve, reject) => {
    succeed = resolve;
    fail = () => reject(new Error('Échec fictif du presse-papiers'));
  });
  const writeText = jest.fn(() => pending);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  return { writeText, succeed, fail };
}

test.each(['edit', 'prepare', 'reset'])('une copie ancienne réussie ne remplace pas le statut après %s', async action => {
  const page = mount();
  const pending = clipboard();
  page.submit();
  page.copy.click();
  if (action === 'reset') page.form.reset();
  else {
    page.change('message', 'Nouveau texte fictif');
    if (action === 'prepare') page.submit();
  }
  const status = page.status.textContent;
  pending.succeed();
  await Promise.resolve();
  expect(page.status.textContent).toBe(status);
});

test('une copie ancienne rejetée ne sélectionne pas le nouveau message', async () => {
  const page = mount();
  const pending = clipboard();
  page.submit();
  page.copy.click();
  page.change('message', 'Nouveau texte fictif');
  page.submit();
  const status = page.status.textContent;
  const focus = jest.spyOn(page.preview, 'focus');
  const select = jest.spyOn(page.preview, 'select');
  pending.fail();
  await Promise.resolve();
  expect(page.status.textContent).toBe(status);
  expect(focus).not.toHaveBeenCalled();
  expect(select).not.toHaveBeenCalled();
});

test('les copies sont sérialisées même après une nouvelle préparation', async () => {
  const page = mount();
  const pending = clipboard();
  page.submit();
  const original = page.preview.value;
  page.copy.click();
  expect(page.copy.disabled).toBe(true);
  page.change('message', 'Autre texte fictif');
  page.submit();
  // Force an event even on a disabled button to exercise the handler guard.
  page.copy.dispatchEvent(new Event('click'));
  expect(pending.writeText).toHaveBeenCalledTimes(1);
  expect(pending.writeText).toHaveBeenCalledWith(original);
  pending.succeed();
  await Promise.resolve();
  expect(page.copy.disabled).toBe(false);
  page.copy.click();
  await Promise.resolve();
  expect(pending.writeText).toHaveBeenCalledTimes(2);
  expect(pending.writeText).toHaveBeenLastCalledWith(page.preview.value);
});

test.each([false, true])('aucune copie sans résultat actuel (ancienne préparation : %s)', async prepared => {
  const page = mount();
  const pending = clipboard();
  if (prepared) {
    page.submit();
    page.change('message', 'Texte modifié');
  }
  page.copy.dispatchEvent(new Event('click'));
  expect(pending.writeText).not.toHaveBeenCalled();
  pending.succeed();
  await Promise.resolve();
});

test('une copie courante réussie copie exactement le texte et libère le bouton', async () => {
  const page = mount();
  const pending = clipboard();
  page.submit();
  page.copy.click();
  expect(pending.writeText).toHaveBeenCalledWith(page.preview.value);
  pending.succeed();
  await Promise.resolve();
  expect(page.status.textContent).toContain('Texte copié');
  expect(page.status.textContent).toContain('aucune demande');
  expect(page.copy.disabled).toBe(false);
});

test('sans API clipboard, sélection manuelle proposée sans faux succès', async () => {
  const page = mount();
  const select = jest.spyOn(page.preview, 'select');
  page.submit();
  page.copy.click();
  await Promise.resolve();
  expect(select).toHaveBeenCalledTimes(1);
  expect(page.status.textContent).toContain('Sélectionne et copie');
  expect(page.copy.disabled).toBe(false);
});
