// KAIROS — Pantalla de onboarding canónica: el journey premium (El Manuscrito)
// conectado a la lógica real. La generación arranca cuando empieza el teatro
// de construcción (onBuildingStart) para que el tiempo de espera real quede
// solapado con la animación; al completar, completeOnboarding(result) siembra
// la semana y voltea el gate del navigator (onboardingCompletedAt).

import React, { useCallback, useRef } from 'react';
import PremiumOnboarding from '../../features/onboarding/premium/PremiumOnboarding';
import type {
  OnboardingDraft,
  OnboardingGoal,
} from '../../features/onboarding/flow/onboardingFlow';
import { generateOnboardingSpace, type OnboardingSpaceResult } from '../../lib/ai/onboardingSpace';
import type { StarterAnswers, StarterDiscipline } from '../../lib/routines/starterTemplates';
import type { EquipmentTag } from '../../types/profile';
import { markOnboardedThisSession } from '../../features/onboarding/plannerTourGate';
import { useWorkoutStore } from '../../store/workoutStore';

// El vocabulario del manuscrito es humano (objetivos); el generador habla en
// disciplinas. El mapeo es la única traducción entre ambos mundos.
const GOAL_TO_DISCIPLINE: Record<OnboardingGoal, StarterDiscipline> = {
  strength: 'strength',
  endurance: 'running',
  flexibility: 'yoga_mobility',
  health: 'hybrid',
};

function draftToStarterAnswers(draft: OnboardingDraft): StarterAnswers {
  return {
    discipline: GOAL_TO_DISCIPLINE[draft.goal ?? 'health'],
    level: draft.experience ?? 'beginner',
    frequency: draft.daysPerWeek ?? 3,
    equipment: (draft.equipment.length > 0
      ? [...draft.equipment]
      : ['bodyweight']) as EquipmentTag[],
  };
}

export default function PremiumOnboardingScreen() {
  const generationRef = useRef<Promise<OnboardingSpaceResult> | null>(null);

  // Nunca rechaza: generateOnboardingSpace cae a plantilla curada ante
  // cualquier fallo, así que el await de onComplete siempre resuelve.
  const handleBuildingStart = useCallback((draft: OnboardingDraft) => {
    generationRef.current = generateOnboardingSpace(draftToStarterAnswers(draft), {
      userName: draft.name ?? undefined,
    });
  }, []);

  const handleComplete = useCallback(async (draft: OnboardingDraft) => {
    // Marca la sesión ANTES del await: cuando completeOnboarding voltee el
    // navigator y monte HomeTab, el gate ya sabe que este arranque acaba de
    // onboardear y difiere el PlannerTour a la siguiente sesión.
    markOnboardedThisSession();
    const pending =
      generationRef.current ??
      generateOnboardingSpace(draftToStarterAnswers(draft), {
        userName: draft.name ?? undefined,
      });
    const result = await pending;
    const { setUserName, completeOnboarding } = useWorkoutStore.getState();
    if (draft.name) setUserName(draft.name.trim());
    // Siembra la semana, persiste onboardingCompletedAt y emite
    // onboarding_completed — AppNavigator cambia de stack solo.
    completeOnboarding(result);
  }, []);

  return <PremiumOnboarding onBuildingStart={handleBuildingStart} onComplete={handleComplete} />;
}
