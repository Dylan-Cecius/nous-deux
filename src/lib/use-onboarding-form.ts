import { useEffect, useRef, useState } from 'react';
import { MemberColors } from '@/constants/theme';
import { createCloudCouple, createLocalCouple, joinCloudCouple, type Backend } from './backend';
import { useOnboardingAction } from './use-onboarding-action';

type Draft = { name: string; color: string; code: string; partnerName: string };
export type OnboardingStep = 'profile' | 'choice' | 'join' | 'local' | 'signin';
const emptyDraft = (): Draft => ({ name: '', color: MemberColors[0], code: '', partnerName: '' });

/** Entry data/actions, kept independent of the decorative screen assets. */
export function useOnboardingForm(setBackend: (backend: Backend) => void, step: OnboardingStep = 'profile') {
  const [draft, setDraft] = useState(emptyDraft);
  const latest = useRef<Draft | null>(null);
  useEffect(() => {
    latest.current = emptyDraft();
    return () => { latest.current = null; };
  }, []);
  const { run, busy, interact, transition } = useOnboardingAction(setBackend, step);
  const change = (patch: Partial<Draft>) => interact(() => {
    if (!latest.current) return;
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setDraft(next);
  });
  const current = () => {
    const values = latest.current;
    if (!values?.name.trim()) throw new Error('Renseigne ton prénom avant de continuer.');
    return { values, me: { name: values.name.trim(), color: values.color } };
  };
  return {
    ...draft, busy, interact, navigate: transition,
    continueProfile: (next: () => void) => { if (latest.current?.name.trim()) return transition(next); },
    changeName: (value: string) => change({ name: value }),
    changeColor: (value: string) => change({ color: value }),
    changeCode: (value: string) => change({ code: value.toUpperCase() }),
    changePartnerName: (value: string) => change({ partnerName: value }),
    createCloud: () => run(() => createCloudCouple(current().me)),
    join: () => run(() => {
      const { values, me } = current();
      if (values.code.replace(/\s|-/g, '').length !== 10) throw new Error('Renseigne le code d’invitation complet.');
      return joinCloudCouple(values.code, me);
    }),
    createLocal: () => run(() => {
      const { values, me } = current();
      if (!values.partnerName.trim()) throw new Error('Renseigne le prénom de ta moitié.');
      return createLocalCouple(me, {
        name: values.partnerName.trim(),
        color: MemberColors.find(c => c !== values.color) ?? MemberColors[1],
      });
    }),
  };
}
