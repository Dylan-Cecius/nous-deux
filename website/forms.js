// These forms only prepare a message in the visitor's browser. They never send it.
const form = document.querySelector('[data-request-form]');
if (form) {
  const status = document.querySelector('[data-status]');
  const result = document.querySelector('[data-result]');
  const preview = document.querySelector('[data-message]');
  const emailLink = document.querySelector('[data-email-link]');
  const copy = document.querySelector('[data-copy]');
  const message = form.elements.namedItem('message');
  const validateMessage = () => message.setCustomValidity(
    message.required && !message.value.trim() ? 'Décris le problème avant de préparer ton e-mail.' : '',
  );
  message.addEventListener('input', validateMessage);
  message.addEventListener('change', validateMessage);
  // Reset restores the initial value after this event; do not keep an old error.
  form.addEventListener('reset', () => message.setCustomValidity(''));
  let revision = 0;
  let copying = false;
  const invalidate = () => {
    revision += 1;
    const hadMessage = !result.hidden;
    result.hidden = true;
    emailLink.hidden = true;
    emailLink.removeAttribute('href');
    preview.value = '';
    if (hadMessage) status.textContent = 'Le formulaire a changé : prépare à nouveau ton message avant de le copier ou de l’envoyer.';
  };
  form.addEventListener('input', invalidate);
  form.addEventListener('change', invalidate);
  form.addEventListener('reset', invalidate);
  // Native validation can prevent submit entirely. Capture invalid on fields too.
  form.addEventListener('invalid', invalidate, true);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    invalidate();
    validateMessage();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const deleting = form.dataset.requestForm === 'deletion';
    const subject = deleting ? 'Nous Deux — Demande de suppression de mon compte' : `Nous Deux — ${data.get('reason')}`;
    const body = [
      'Bonjour,', '',
      deleting ? 'Je demande la suppression de mon compte Nous Deux et des données personnelles qui lui sont associées.' : 'Je contacte l’assistance Nous Deux.',
      '', `E-mail pour me répondre : ${String(data.get('email') || '').trim()}`,
      `Adresse associée au compte : ${String(data.get('accountEmail') || '').trim() || 'Non associée / inconnue'}`,
      `Mode utilisé : ${data.get('mode') || 'Non précisé'}`,
      '', String(data.get('message') || '').trim(), '',
      deleting ? 'Merci de me préciser les étapes de vérification nécessaires et de confirmer le traitement de ma demande.' : 'Merci pour votre aide.',
    ].join('\n');
    preview.value = `Objet : ${subject}\n\n${body}`;
    const recipient = form.dataset.supportEmail;
    if (recipient) {
      emailLink.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      emailLink.hidden = false;
      status.textContent = 'Ton message est préparé, mais pas envoyé. Ouvre ton application e-mail puis confirme l’envoi, ou copie le texte pour l’envoyer à l’adresse indiquée.';
    } else {
      emailLink.hidden = true;
      status.textContent = 'Aperçu privé : le message est préparé uniquement sur cet appareil. L’adresse d’assistance reste à confirmer ; aucune demande n’a été envoyée.';
    }
    result.hidden = false;
    preview.focus();
  });
  copy.addEventListener('click', async () => {
    if (result.hidden || copying) return;
    const copiedRevision = revision;
    copying = true;
    copy.disabled = true;
    status.textContent = 'Copie en cours… Aucune demande n’a été envoyée.';
    try {
      await navigator.clipboard.writeText(preview.value);
      if (copiedRevision !== revision) return;
      status.textContent = 'Texte copié. Il reste à l’envoyer par e-mail ; aucune demande n’a encore été transmise.';
    } catch {
      if (copiedRevision !== revision) return;
      preview.focus(); preview.select();
      status.textContent = 'Sélectionne et copie le texte ci-dessus, puis envoie-le depuis ta messagerie.';
    } finally {
      copying = false;
      copy.disabled = false;
    }
  });
}
