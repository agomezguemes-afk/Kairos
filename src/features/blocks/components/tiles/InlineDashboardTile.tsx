// InlineDashboardTile — wraps DashboardNode in the Spine-Bento frame.
// The existing DashboardNode owns counter / progress / list visualizations;
// the tile just adds eyebrow chrome and the optional active highlight.
// Sparkline viz remains future work — when added to DashboardViz it slots
// in here naturally.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Spacing } from '../../../../theme/tokens';
import TileFrame from './TileFrame';
import DashboardNode from '../DashboardNode';
import type { DashboardContentNode } from '../../../../types/content';
import type { WorkoutBlock } from '../../../../types/core';

interface Props {
  node: DashboardContentNode;
  block: WorkoutBlock;
  isActive?: boolean;
  onLongPress?: () => void;
  onUpdate: (nodeId: string, data: any) => void;
  onDelete: (nodeId: string) => void;
}

function InlineDashboardTileImpl(props: Props) {
  return (
    <TileFrame
      eyebrow="DASHBOARD"
      isActive={props.isActive}
      compact
      onLongPress={props.onLongPress}
    >
      <View style={styles.body}>
        <DashboardNode
          node={props.node}
          block={props.block}
          onUpdate={props.onUpdate}
          onDelete={props.onDelete}
          compact
        />
      </View>
    </TileFrame>
  );
}

const InlineDashboardTile = React.memo(InlineDashboardTileImpl);
export default InlineDashboardTile;

const styles = StyleSheet.create({
  body: {
    marginHorizontal: -Spacing.sm,
  },
});
