# Estrategia v2 — Kairos (Directiva de IA, 2026-07-08)

> Replanteo tras la corrección del fundador (funcional ≠ entregable, [PRINCIPLES.md](./PRINCIPLES.md) v2).
> Cruza los 6 informes: 01 producto · 02 mercado · 03 comercial · 04 UX · **05 validación con ingresos
> reales** · **06 teardown de diseño (nota 5.7/10)**. Sustituye al primer BACKLOG como fuente de verdad.

## La tesis, afilada con evidencia de ingresos

El sprint 1 construyó el flujo correcto con la voz correcta (el Manuscrito puntúa 8/10 en copic/voz,
único en el mercado) pero con la **arquitectura de activación equivocada** y **sin apuntar al segmento
que más paga**. Los dos informes críticos convergen en un giro:

1. **A quién servimos primero (05).** No al "voy al gym" genérico — al **atleta híbrido**. Dato duro:
   Hyrox Fitness App factura **$28.750 MRR con 1.584 subs (~$18/mes, 6× el ARPU de Hevy)** y se vende a
   9.8× con 6 ofertas, mientras las apps genéricas de IA se malvenden a 1.5-2×. Ese nicho registra hoy
   en Notas/spreadsheet porque **ninguna app mainstream modela una sesión mixta** (erg m/tiempo + sled
   kg/m + carrera pace + reps). Los campos dinámicos de Kairos ya lo cubren. El moat no es "tiene IA"
   (eso ya está saturado y se liquida en Flippa): es **poseer un segmento con identidad + el modelo de
   datos que nadie más tiene**.

2. **Cómo lo activamos (06).** El flujo comete el pecado cardinal: **pide cuenta en la pantalla 2, antes
   de dar valor**, no entrega el "aha" que promete (el reveal es una card estática que ni siquiera
   muestra la semana que el usuario pidió), e interrumpe el clímax con un tour genérico. Los tres
   teardowns de referencia (Duolingo, Headspace, Blinkist) coinciden: valor → capital psicológico →
   *después* cuenta. Cal AI ($35M año 1) hace del reveal un momento con teatro de carga y números reales.

3. **Cómo cobramos (03+05).** El funnel quiz→reveal→soft-paywall está validado con revenue. Pero el
   arma diferencial es la **honestidad como conversión**: GymStreak factura ~$208k MRR con un safety
   score de 31.5/100 por billing abusivo — el nicho está escaldado. Aviso pre-cobro, X visible, export
   libre, dicho en el listing. Cal AI demuestra que la honestidad no mata la conversión.

## El giro estratégico en una frase

De **"onboarding bonito para cualquier gym-goer"** a **"el primer sitio donde el atleta híbrido opera
su sistema completo — con el aha entregado antes de pedir nada y sin dark patterns"**.

## Qué cambia respecto al backlog v1

| v1 asumía | v2 corrige (fuente) |
|---|---|
| Cuenta tras el primer workout | Cuenta tras el **reveal**, guest-first end-to-end (06 P0-1) |
| Reveal = card con bloques | Reveal = **momento**: teatro 1.8-2.4s citando respuestas + semana sembrada + spring + haptic (06 P0-2) |
| Público: autodirigido genérico | Público wedge: **atleta híbrido**; preset Hybrid Race como demo estrella (05 P0-1) |
| Paywall fake-door neutro | Paywall **anti-dark-pattern** explícito como conversión (05 P0-3) |
| Home con rings de estado | Home **honesto día-0**: sin números inventados, 1 CTA, nombre completo (06 P1-2) |
| PlannerTour diferido | Tour **eliminado** → coach-mark contextual sobre el bloque real (06 P0-3) |

## Principios de actuación reforzados

- **Iterar hasta el nivel, no hasta el verde.** El objetivo de cada pantalla es batir a su referente
  nombrado (Cal AI / Headspace / Whoop), no pasar el gate.
- **Cada build se mide contra ingresos reales.** trustmrr/acquire como radar trimestral (05 P2-9).
- **El moat es el modelo de datos + el segmento, no la IA.** Toda feature refuerza uno de los dos.

Ver [BACKLOG-v2.md](./BACKLOG-v2.md) para las órdenes ejecutables priorizadas.
