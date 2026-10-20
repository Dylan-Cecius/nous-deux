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
  const submit = () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const change = (name: string, value: string, event = 'input') => {
    const field = form.elements.namedItem(name) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event(event, { bubbles: true }));
  };
  return { form, result, preview, link, status, submit, change };
}

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
