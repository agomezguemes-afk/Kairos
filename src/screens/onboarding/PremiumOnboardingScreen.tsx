// KAIROS — Pantalla de onboarding canónica: el journey premium (El Manuscrito)
// conectado a la lógica real, guest-first. La generación arranca cuando empieza
// el teatro de construcción (buildReveal): el resultado real (bloques +
// weekAssignments) se mapea al view-model del reveal para pintarlo, y la MISMA
// promesa se reutiliza en onComplete para sembrar la semana con
// completeOnboarding(result) — sin doble generación. El signup llega DESPUÉS
// del reveal (valor antes que cuenta) y no bloquea: "sin cuenta" también entra.

import React, { useCallback, useRef } from 'react';
import PremiumOnboarding from '../../features/onboarding/premium/PremiumOnboarding';
import type {
  OnboardingDraft,
  OnboardingGoal,
} from '../../features/onboarding/flow/onboardingFlow';
import { previewStarterBlock } from '../../features/onboarding/flow/starterPreview';
import {
  weekdayLabelES,
  type RevealDay,
  type RevealFeatured,
  type RevealPlan,
} from '../../features/onboarding/premium/reveal';
import { generateOnboardingSpace, type OnboardingSpaceResult } from '../../lib/ai/onboardingSpace';
import type { StarterAnswers, StarterDiscipline } from '../../lib/routines/starterTemplates';
import type { EquipmentTag } from '../../types/profile';
import { Colors } from '../../theme/tokens';
import { getBlockExercises, type ExerciseCard } from '../../types/core';
import { markOnboardedThisSession } from '../../features/onboarding/plannerTourGate';
import {
  mapOnboardingEvent,
  type OnboardingAnalyticsEvent,
} from '../../features/onboarding/premium/onboardingAnalytics';
import { track } from '../../lib/analytics';
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

/** Honest detail for a real exercise card — derived from its own sets. */
function exerciseDetail(ex: ExerciseCard): string {
  const sets = ex.sets.length;
  return sets > 0 ? `${sets} ${sets === 1 ? 'serie' : 'series'}` : '';
}

// Map the real generation result to the presentation view-model: the seeded
// week (the N days the user declared) + the featured (first) block in full.
function mapResultToReveal(result: OnboardingSpaceResult, goal: OnboardingGoal | null): RevealPlan {
  const byId = new Map(result.blocks.map((b) => [b.id, b]));
  const preview = previewStarterBlock(goal);

  const week: RevealDay[] = result.weekAssignments.map((a) => {
    const b = byId.get(a.blockId);
    return {
      weekday: a.weekday,
      label: weekdayLabelES(a.weekday),
      blockName: b?.name ?? preview.name,
      accent: b?.color ?? Colors.gold.base,
    };
  });

  const featuredBlock = byId.get(result.firstBlockId) ?? result.blocks[0];
  const featured: RevealFeatured = featuredBlock
    ? {
        name: featuredBlock.name,
        accent: featuredBlock.color,
        exercises: getBlockExercises(featuredBlock)
          .slice(0, 5)
          .map((e) => ({ name: e.name, detail: exerciseDetail(e) })),
      }
    : {
        name: preview.name,
        accent: Colors.discipline[preview.discipline] ?? Colors.gold.base,
        exercises: preview.exercises,
      };

  return { featured, week, source: result.source };
}

export default function PremiumOnboardingScreen() {
  // Single generation promise, shared by the reveal and the final commit so the
  // space is built exactly once.
  const generationRef = useRef<Promise<OnboardingSpaceResult> | null>(null);

  // Nunca rechaza: generateOnboardingSpace cae a plantilla curada ante
  // cualquier fallo, así que el await siempre resuelve.
  const buildReveal = useCallback(async (draft: OnboardingDraft): Promise<RevealPlan> => {
    const pending = generateOnboardingSpace(draftToStarterAnswers(draft), {
      userName: draft.name ?? undefined,
    });
    generationRef.current = pending;
    const result = await pending;
    return mapResultToReveal(result, draft.goal ?? null);
  }, []);

  const handleComplete = useCallback(async (draft: OnboardingDraft) => {
    // Marca la sesión ANTES del await: cuando completeOnboarding voltee el
    // navigator y monte HomeTab, el gate ya sabe que este arranque acaba de
    // onboardear.
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

  // El componente premium reporta QUÉ pasó; aquí lo traducimos al catálogo real
  // y llamamos a track(). Callback estable — el efecto de vistas keyea en step.
  const handleEvent = useCallback((event: OnboardingAnalyticsEvent) => {
    const mapped = mapOnboardingEvent(event);
    track(mapped.name, mapped.props);
  }, []);

  return (
    <PremiumOnboarding
      buildReveal={buildReveal}
      onComplete={handleComplete}
      onEvent={handleEvent}
    />
  );
}
