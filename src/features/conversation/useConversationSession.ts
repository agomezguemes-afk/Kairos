// KAIROS — React binding for the conversational session.
//
// All logic lives in sessionController.ts (node-tested); this hook only wires
// production deps (real engine + hybrid preset) and exposes the snapshot via
// useSyncExternalStore. The profile is read through an effect-synced ref so the
// session — created once per mount — always sees the freshest name/frequency
// without re-creating itself.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useUserProfile } from '../../context/UserProfileContext';
import {
  buildHybridSession,
  defaultConversationDeps,
  wantsHybridSession,
} from '../../lib/ai/conversation';
import { createConversationSession, type SessionSnapshot } from './sessionController';

export interface UseConversationSessionResult {
  state: SessionSnapshot;
  send: (text: string) => void;
  retry: () => void;
  reset: () => void;
}

export function useConversationSession(): UseConversationSessionResult {
  const { profile } = useUserProfile();
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  });

  // WHY the disable: profileRef is only READ inside buildHybrid, which runs
  // when the user sends a message (event time), never during render; the rule
  // can't see through the deferred closure.
  // eslint-disable-next-line react-hooks/refs
  const [session] = useState(() =>
    createConversationSession({
      engine: defaultConversationDeps(),
      isHybridAsk: wantsHybridSession,
      buildHybrid: () =>
        buildHybridSession({
          displayName: profileRef.current.displayName,
          weeklyFrequency: profileRef.current.weeklyFrequency,
        }),
    }),
  );

  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const send = useCallback((text: string) => void session.send(text), [session]);
  const retry = useCallback(() => void session.retry(), [session]);
  const reset = useCallback(() => session.reset(), [session]);

  return { state, send, retry, reset };
}
