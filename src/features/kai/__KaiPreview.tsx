// TEMP — preview of the reframed Kai home. Delete after review.

import React, { useMemo, useState } from 'react';
import { generateProposals, type Proposal, type ProposalInputs } from './proposal';
import { reflect, type Reflection } from './reflection';
import KaiHome, { type HomeBlock } from './KaiHome';

const SCENARIO: ProposalInputs = {
  now: Date.now(),
  daysSinceLastWorkout: 1,
  sessionsLast7Days: 6,
  domainCounts: { strength: 6, running: 0, mobility: 0 },
  stalledLift: { name: 'Press banca', weeks: 4 },
  recentPr: { name: 'Sentadilla' },
  streak: 12,
  blocksCount: 5,
};

const BLOCKS: HomeBlock[] = [
  { id: 'a', name: 'Fuerza · Tren superior', discipline: 'strength', meta: '5 ejercicios · ayer' },
  { id: 'b', name: 'Carrera · Intervalos', discipline: 'running', meta: '4 series · hace 3 días' },
  { id: 'c', name: 'Movilidad matinal', discipline: 'mobility', meta: '6 ejercicios' },
  { id: 'd', name: 'Core & estabilidad', discipline: 'general', meta: '4 ejercicios' },
];

const REFLECTION: Reflection | null = reflect({
  weeksTraining: 8,
  sessionsTotal: 24,
  gains: [
    { name: 'Press banca', from: 80, to: 92 },
    { name: '5k', from: 1500, to: 1410, lowerIsBetter: true },
  ],
  domainsCount: 3,
});

export default function KaiPreview() {
  const top = useMemo(() => generateProposals(SCENARIO, 1)[0] ?? null, []);
  const [proposal, setProposal] = useState<Proposal | null>(top);
  const [reflection, setReflection] = useState<Reflection | null>(REFLECTION);

  return (
    <KaiHome
      name="Álvaro"
      proposal={proposal}
      reflection={reflection}
      blocks={BLOCKS}
      onAcceptProposal={() => setProposal(null)}
      onDismissProposal={() => setProposal(null)}
      onDismissReflection={() => setReflection(null)}
      onOpenBlock={() => {}}
    />
  );
}
