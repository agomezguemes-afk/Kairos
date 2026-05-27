// InlineDashboardTile — wraps DashboardNode in the standard Spine-Bento frame.
//
// No eyebrow — the metric label inside the viz already names the data.
// The widget itself does the talking.

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
    <TileFrame variant="standard" isActive={props.isActive} onLongPress={props.onLongPress}>
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
    marginHorizontal: -Spacing.xs,
  },
});
