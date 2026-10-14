import { createContext, useContext } from 'react';

export type AssistantMode = 'voice' | 'schedule';

export const AssistantContext = createContext<{ open: (mode?: AssistantMode) => void } | null>(null);

/** Ouvre l'assistant depuis n'importe quel écran : `useAssistant()?.open()`. */
export function useAssistant() {
  return useContext(AssistantContext);
}
