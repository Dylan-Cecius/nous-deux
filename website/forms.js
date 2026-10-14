// These forms only prepare a message in the visitor's browser. They never send it.
const form = document.querySelector('[data-request-form]');
if (form) {
  const status = document.querySelector('[data-status]');
  const result = document.querySelector('[data-result]');
  const preview = document.querySelector('[data-message]');
  const emailLink = document.querySelector('[data-email-link]');
  const copy = document.querySelector('[data-copy]');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
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
    try {
      await navigator.clipboard.writeText(preview.value);
      status.textContent = 'Texte copié. Il reste à l’envoyer par e-mail ; aucune demande n’a encore été transmise.';
    } catch {
      preview.focus(); preview.select();
      status.textContent = 'Sélectionne et copie le texte ci-dessus, puis envoie-le depuis ta messagerie.';
    }
  });
}
