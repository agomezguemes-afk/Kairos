// KAIROS — Central Icon Component
// Single source of truth for all icons in the app.
// Maps semantic names to @expo/vector-icons entries.

import React from 'react';
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
  Feather,
} from '@expo/vector-icons';
import { Colors } from '../theme/index';

// ======================== ICON MAP ========================

interface IconEntry {
  lib: 'Ionicons' | 'MaterialCommunityIcons' | 'FontAwesome5' | 'Feather';
  name: string;
}

const ICON_MAP: Record<string, IconEntry> = {
  // ── Streak / Fire ──
  streak:           { lib: 'Ionicons', name: 'flame' },
  streak_double:    { lib: 'Ionicons', name: 'flame' },
  streak_triple:    { lib: 'Ionicons', name: 'flame' },

  // ── Strength / Fitness ──
  strength:         { lib: 'MaterialCommunityIcons', name: 'arm-flex' },
  dumbbell:         { lib: 'MaterialCommunityIcons', name: 'dumbbell' },
  weightlifting:    { lib: 'MaterialCommunityIcons', name: 'weight-lifter' },

  // ── AI / Robot ──
  assistant:        { lib: 'MaterialCommunityIcons', name: 'robot' },

  // ── Stats / Charts ──
  stats:            { lib: 'Ionicons', name: 'bar-chart' },
  progress:         { lib: 'Ionicons', name: 'trending-up' },

  // ── Plan / Clipboard ──
  plan:             { lib: 'Ionicons', name: 'clipboard' },

  // ── Gamification ──
  first_step:       { lib: 'Ionicons', name: 'flag' },
  badge:            { lib: 'MaterialCommunityIcons', name: 'medal' },
  target:           { lib: 'MaterialCommunityIcons', name: 'target' },
  star:             { lib: 'Ionicons', name: 'star' },
  trophy:           { lib: 'Ionicons', name: 'trophy' },
  sparkle:          { lib: 'Ionicons', name: 'sparkles' },

  // ── Time / Calendar ──
  calendar:         { lib: 'Ionicons', name: 'calendar' },
  recovery:         { lib: 'Ionicons', name: 'moon' },
  sleep:            { lib: 'Ionicons', name: 'moon' },

  // ── Communication ──
  chat:             { lib: 'Ionicons', name: 'chatbubble' },
  brain:            { lib: 'MaterialCommunityIcons', name: 'brain' },
  help:             { lib: 'Ionicons', name: 'help-circle' },

  // ── Actions ──
  checkmark:        { lib: 'Ionicons', name: 'checkmark-circle' },
  close:            { lib: 'Ionicons', name: 'close-circle' },
  add:              { lib: 'Ionicons', name: 'add-circle' },
  trash:            { lib: 'Ionicons', name: 'trash' },
  arrow_forward:    { lib: 'Ionicons', name: 'arrow-forward' },
  settings:         { lib: 'Ionicons', name: 'settings' },

  // ── Disciplines ──
  running:          { lib: 'MaterialCommunityIcons', name: 'run' },
  calisthenics:     { lib: 'MaterialCommunityIcons', name: 'human-handsup' },
  mobility:         { lib: 'MaterialCommunityIcons', name: 'meditation' },
  team_sport:       { lib: 'Ionicons', name: 'football' },
  cycling:          { lib: 'MaterialCommunityIcons', name: 'bike' },
  swimming:         { lib: 'MaterialCommunityIcons', name: 'swim' },
  general:          { lib: 'MaterialCommunityIcons', name: 'arm-flex' },

  // ── Muscle groups ──
  chest:            { lib: 'MaterialCommunityIcons', name: 'arm-flex' },
  back:             { lib: 'MaterialCommunityIcons', name: 'human-handsup' },
  shoulder:         { lib: 'MaterialCommunityIcons', name: 'weight-lifter' },
  biceps:           { lib: 'MaterialCommunityIcons', name: 'arm-flex' },
  triceps:          { lib: 'Ionicons', name: 'flame' },
  leg:              { lib: 'MaterialCommunityIcons', name: 'human' },

  // ── Weather / Greeting ──
  sun:              { lib: 'Ionicons', name: 'sunny' },
  cloud_sun:        { lib: 'Ionicons', name: 'partly-sunny' },
  moon_greeting:    { lib: 'Ionicons', name: 'moon' },

  // ── Mission categories ──
  volume:           { lib: 'Ionicons', name: 'cube' },
  pr:               { lib: 'Ionicons', name: 'trophy' },
  exploration:      { lib: 'Ionicons', name: 'compass' },
  consistency:      { lib: 'Ionicons', name: 'calendar' },
  experiment:       { lib: 'MaterialCommunityIcons', name: 'flask' },
  rainbow:          { lib: 'Ionicons', name: 'color-palette' },
  numbers:          { lib: 'Ionicons', name: 'grid' },

  // ── Intensity zones ──
  seedling:         { lib: 'MaterialCommunityIcons', name: 'sprout' },
  rocket:           { lib: 'Ionicons', name: 'rocket' },
  marathon:         { lib: 'MaterialCommunityIcons', name: 'run-fast' },

  // ── Progress tree ──
  tree:             { lib: 'MaterialCommunityIcons', name: 'tree' },

  // ── Misc ──
  bolt:             { lib: 'Ionicons', name: 'flash' },
  info:             { lib: 'Ionicons', name: 'information-circle' },
  empty:            { lib: 'Ionicons', name: 'ellipse-outline' },
  training_dot:     { lib: 'Ionicons', name: 'ellipse' },
  record:           { lib: 'Ionicons', name: 'trophy' },

  // ── Block icon picker (discipline-specific) ──
  // Strength
  'pick.dumbbell':      { lib: 'MaterialCommunityIcons', name: 'dumbbell' },
  'pick.arm':           { lib: 'MaterialCommunityIcons', name: 'arm-flex' },
  'pick.robot_arm':     { lib: 'MaterialCommunityIcons', name: 'robot-industrial' },
  'pick.flash':         { lib: 'Ionicons', name: 'flash' },
  'pick.flame':         { lib: 'Ionicons', name: 'flame' },
  'pick.boxing':        { lib: 'MaterialCommunityIcons', name: 'boxing-glove' },
  'pick.fist':          { lib: 'MaterialCommunityIcons', name: 'fist' },
  'pick.trophy':        { lib: 'Ionicons', name: 'trophy' },
  'pick.scale':         { lib: 'MaterialCommunityIcons', name: 'scale-balance' },
  'pick.target':        { lib: 'MaterialCommunityIcons', name: 'target' },
  'pick.explosion':     { lib: 'MaterialCommunityIcons', name: 'fire' },
  'pick.shield':        { lib: 'MaterialCommunityIcons', name: 'shield' },

  // Running
  'pick.run':           { lib: 'MaterialCommunityIcons', name: 'run' },
  'pick.shoe':          { lib: 'MaterialCommunityIcons', name: 'shoe-sneaker' },
  'pick.timer':         { lib: 'Ionicons', name: 'timer' },
  'pick.flag':          { lib: 'Ionicons', name: 'flag' },
  'pick.wind':          { lib: 'MaterialCommunityIcons', name: 'weather-windy' },
  'pick.footprint':     { lib: 'MaterialCommunityIcons', name: 'foot-print' },
  'pick.map':           { lib: 'Ionicons', name: 'map' },
  'pick.sunrise':       { lib: 'MaterialCommunityIcons', name: 'weather-sunset-up' },
  'pick.speed':         { lib: 'MaterialCommunityIcons', name: 'speedometer' },
  'pick.mountain':      { lib: 'MaterialCommunityIcons', name: 'mountain' },
  'pick.earth':         { lib: 'Ionicons', name: 'earth' },
  'pick.jersey':        { lib: 'MaterialCommunityIcons', name: 'tshirt-crew' },

  // Calisthenics
  'pick.gymnast':       { lib: 'MaterialCommunityIcons', name: 'human-handsup' },
  'pick.climb':         { lib: 'MaterialCommunityIcons', name: 'carabiner' },
  'pick.sparkle':       { lib: 'Ionicons', name: 'sparkles' },
  'pick.rotate':        { lib: 'MaterialCommunityIcons', name: 'rotate-3d-variant' },
  'pick.rings':         { lib: 'MaterialCommunityIcons', name: 'circle-double' },
  'pick.hands':         { lib: 'MaterialCommunityIcons', name: 'hand-clap' },
  'pick.refresh':       { lib: 'Ionicons', name: 'refresh' },
  'pick.drama':         { lib: 'MaterialCommunityIcons', name: 'drama-masks' },
  'pick.wrestling':     { lib: 'MaterialCommunityIcons', name: 'kabaddi' },
  'pick.wave':          { lib: 'MaterialCommunityIcons', name: 'wave' },
  'pick.circus':        { lib: 'MaterialCommunityIcons', name: 'ferris-wheel' },
  'pick.trident':       { lib: 'MaterialCommunityIcons', name: 'trident' },

  // Mobility
  'pick.yoga':          { lib: 'MaterialCommunityIcons', name: 'meditation' },
  'pick.flower':        { lib: 'MaterialCommunityIcons', name: 'flower' },
  'pick.leaf':          { lib: 'MaterialCommunityIcons', name: 'leaf' },
  'pick.yinyang':       { lib: 'MaterialCommunityIcons', name: 'yin-yang' },
  'pick.water':         { lib: 'MaterialCommunityIcons', name: 'wave' },
  'pick.moon':          { lib: 'Ionicons', name: 'moon' },
  'pick.stars':         { lib: 'Ionicons', name: 'sparkles' },
  'pick.butterfly':     { lib: 'MaterialCommunityIcons', name: 'butterfly' },
  'pick.floral':        { lib: 'MaterialCommunityIcons', name: 'flower-tulip' },
  'pick.shimmer':       { lib: 'MaterialCommunityIcons', name: 'shimmer' },
  'pick.dove':          { lib: 'MaterialCommunityIcons', name: 'bird' },
  'pick.nature':        { lib: 'MaterialCommunityIcons', name: 'nature' },

  // Team sport
  'pick.soccer':        { lib: 'Ionicons', name: 'football' },
  'pick.basketball':    { lib: 'Ionicons', name: 'basketball' },
  'pick.football_us':   { lib: 'Ionicons', name: 'american-football' },
  'pick.baseball':      { lib: 'MaterialCommunityIcons', name: 'baseball' },
  'pick.tennis':        { lib: 'MaterialCommunityIcons', name: 'tennis' },
  'pick.volleyball':    { lib: 'MaterialCommunityIcons', name: 'volleyball' },
  'pick.rugby':         { lib: 'MaterialCommunityIcons', name: 'rugby' },
  'pick.goal':          { lib: 'MaterialCommunityIcons', name: 'soccer-field' },
  'pick.stadium':       { lib: 'MaterialCommunityIcons', name: 'stadium' },
  'pick.handshake':     { lib: 'MaterialCommunityIcons', name: 'handshake' },
  'pick.trophy_sport':  { lib: 'Ionicons', name: 'trophy' },
  'pick.martial':       { lib: 'MaterialCommunityIcons', name: 'karate' },

  // Cycling
  'pick.bike':          { lib: 'MaterialCommunityIcons', name: 'bike' },
  'pick.mountain_bike': { lib: 'MaterialCommunityIcons', name: 'bike-fast' },
  'pick.road':          { lib: 'MaterialCommunityIcons', name: 'road-variant' },
  'pick.gear':          { lib: 'Ionicons', name: 'settings' },
  'pick.wrench':        { lib: 'MaterialCommunityIcons', name: 'wrench' },
  'pick.mountain_c':    { lib: 'MaterialCommunityIcons', name: 'mountain' },
  'pick.wind_c':        { lib: 'MaterialCommunityIcons', name: 'weather-windy' },
  'pick.bolt_c':        { lib: 'Ionicons', name: 'flash' },
  'pick.target_c':      { lib: 'MaterialCommunityIcons', name: 'target' },
  'pick.cycle':         { lib: 'Ionicons', name: 'refresh' },
  'pick.sunset':        { lib: 'MaterialCommunityIcons', name: 'weather-sunset' },
  'pick.flag_c':        { lib: 'Ionicons', name: 'flag' },

  // Swimming
  'pick.swim':          { lib: 'MaterialCommunityIcons', name: 'swim' },
  'pick.wave_s':        { lib: 'MaterialCommunityIcons', name: 'wave' },
  'pick.drop':          { lib: 'Ionicons', name: 'water' },
  'pick.whale':         { lib: 'MaterialCommunityIcons', name: 'whale' },
  'pick.beach':         { lib: 'MaterialCommunityIcons', name: 'beach' },
  'pick.circle_blue':   { lib: 'Ionicons', name: 'ellipse' },
  'pick.heart_blue':    { lib: 'Ionicons', name: 'heart' },
  'pick.swirl':         { lib: 'MaterialCommunityIcons', name: 'rotate-3d-variant' },
  'pick.bubbles':       { lib: 'MaterialCommunityIcons', name: 'circle-opacity' },
  'pick.sail':          { lib: 'MaterialCommunityIcons', name: 'sail-boat' },
  'pick.dolphin':       { lib: 'MaterialCommunityIcons', name: 'dolphin' },
  'pick.shark':         { lib: 'MaterialCommunityIcons', name: 'shark-fin' },

  // General
  'pick.arm_g':         { lib: 'MaterialCommunityIcons', name: 'arm-flex' },
  'pick.target_g':      { lib: 'MaterialCommunityIcons', name: 'target' },
  'pick.medal':         { lib: 'MaterialCommunityIcons', name: 'medal' },
  'pick.star':          { lib: 'Ionicons', name: 'star' },
  'pick.star_shine':    { lib: 'Ionicons', name: 'star-half' },
  'pick.sparkles':      { lib: 'Ionicons', name: 'sparkles' },
  'pick.ribbon':        { lib: 'MaterialCommunityIcons', name: 'seal-variant' },
  'pick.trophy_g':      { lib: 'Ionicons', name: 'trophy' },
  'pick.diamond':       { lib: 'MaterialCommunityIcons', name: 'diamond-stone' },
  'pick.crystal':       { lib: 'MaterialCommunityIcons', name: 'crystal-ball' },
  'pick.bolt_g':        { lib: 'Ionicons', name: 'flash' },
  'pick.palette':       { lib: 'Ionicons', name: 'color-palette' },
};

// ======================== ICON PICKER OPTIONS ========================

export const ICON_PICKER_OPTIONS: Record<string, string[]> = {
  strength:     ['pick.dumbbell','pick.arm','pick.robot_arm','pick.flash','pick.flame','pick.boxing','pick.fist','pick.trophy','pick.scale','pick.target','pick.explosion','pick.shield'],
  running:      ['pick.run','pick.shoe','pick.timer','pick.flag','pick.wind','pick.footprint','pick.map','pick.sunrise','pick.speed','pick.mountain','pick.earth','pick.jersey'],
  calisthenics: ['pick.gymnast','pick.climb','pick.sparkle','pick.rotate','pick.rings','pick.hands','pick.refresh','pick.drama','pick.wrestling','pick.wave','pick.circus','pick.trident'],
  mobility:     ['pick.yoga','pick.flower','pick.leaf','pick.yinyang','pick.water','pick.moon','pick.stars','pick.butterfly','pick.floral','pick.shimmer','pick.dove','pick.nature'],
  team_sport:   ['pick.soccer','pick.basketball','pick.football_us','pick.baseball','pick.tennis','pick.volleyball','pick.rugby','pick.goal','pick.stadium','pick.handshake','pick.trophy_sport','pick.martial'],
  cycling:      ['pick.bike','pick.mountain_bike','pick.road','pick.gear','pick.wrench','pick.mountain_c','pick.wind_c','pick.bolt_c','pick.target_c','pick.cycle','pick.sunset','pick.flag_c'],
  swimming:     ['pick.swim','pick.wave_s','pick.drop','pick.whale','pick.beach','pick.circle_blue','pick.heart_blue','pick.swirl','pick.bubbles','pick.sail','pick.dolphin','pick.shark'],
  general:      ['pick.arm_g','pick.target_g','pick.medal','pick.star','pick.star_shine','pick.sparkles','pick.ribbon','pick.trophy_g','pick.diamond','pick.crystal','pick.bolt_g','pick.palette'],
};

// ======================== COMPONENT ========================

interface KairosIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

const KairosIcon: React.FC<KairosIconProps> = ({
  name,
  size = 20,
  color = Colors.text.primary,
  style,
}) => {
  const entry = ICON_MAP[name];

  if (!entry) {
    // Fallback for unknown icon names
    return <Ionicons name="help-circle-outline" size={size} color={color} style={style} />;
  }

  switch (entry.lib) {
    case 'Ionicons':
      return <Ionicons name={entry.name as any} size={size} color={color} style={style} />;
    case 'MaterialCommunityIcons':
      return <MaterialCommunityIcons name={entry.name as any} size={size} color={color} style={style} />;
    case 'FontAwesome5':
      return <FontAwesome5 name={entry.name as any} size={size} color={color} style={style} />;
    case 'Feather':
      return <Feather name={entry.name as any} size={size} color={color} style={style} />;
    default:
      return <Ionicons name="help-circle-outline" size={size} color={color} style={style} />;
  }
};

export default React.memo(KairosIcon);
