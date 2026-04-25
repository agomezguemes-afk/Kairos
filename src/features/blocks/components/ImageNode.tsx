import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Image, TextInput, Alert } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import type { ImageContentNode } from '../../../types/content';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';

interface ImageNodeProps {
  node: ImageContentNode;
  onUpdate: (nodeId: string, data: ImageContentNode['data']) => void;
  onDelete: (nodeId: string) => void;
  compact?: boolean;
}

function ImageNodeInner({ node, onUpdate, onDelete, compact }: ImageNodeProps) {
  const { uri, caption } = node.data;
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(caption);

  const pickImage = useCallback(async (source: 'library' | 'camera') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    };

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onUpdate(node.id, {
        ...node.data,
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
    }
  }, [node, onUpdate]);

  const handlePickSource = useCallback(() => {
    Alert.alert('Insertar imagen', 'Elige una fuente', [
      { text: 'Cámara', onPress: () => pickImage('camera') },
      { text: 'Galería', onPress: () => pickImage('library') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, [pickImage]);

  const handleCaptionSubmit = useCallback(() => {
    setEditingCaption(false);
    onUpdate(node.id, { ...node.data, caption: captionDraft.trim() });
  }, [node, captionDraft, onUpdate]);

  if (!uri) {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.emptyContainer}>
        <Pressable onPress={handlePickSource} style={[styles.emptyContent, compact && styles.emptyContentCompact]}>
          <View style={[styles.iconCircle, compact && styles.iconCircleCompact]}>
            <Feather name="image" size={compact ? 16 : 24} color={Colors.accent.primary} />
          </View>
          <Text style={[styles.emptyTitle, compact && styles.emptyTitleCompact]}>Añadir imagen</Text>
          {!compact && <Text style={styles.emptyDesc}>Toca para elegir de cámara o galería</Text>}
        </Pressable>
        <Pressable onPress={() => onDelete(node.id)} style={styles.emptyDelete} hitSlop={8}>
          <Feather name="x" size={compact ? 13 : 16} color={Colors.text.disabled} />
        </Pressable>
      </Animated.View>
    );
  }

  const aspectRatio = (node.data.width && node.data.height)
    ? node.data.width / node.data.height
    : 16 / 9;

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      <Pressable onPress={handlePickSource} onLongPress={() => onDelete(node.id)}>
        <Image
          source={{ uri }}
          style={[styles.image, { aspectRatio }]}
          resizeMode="cover"
        />
      </Pressable>

      <View style={[styles.footer, compact && styles.footerCompact]}>
        {editingCaption ? (
          <TextInput
            style={[styles.captionInput, compact && styles.captionInputCompact]}
            value={captionDraft}
            onChangeText={setCaptionDraft}
            onBlur={handleCaptionSubmit}
            onSubmitEditing={handleCaptionSubmit}
            autoFocus
            placeholder="Descripción..."
            placeholderTextColor={Colors.text.disabled}
            returnKeyType="done"
          />
        ) : (
          <Pressable
            onPress={() => { setCaptionDraft(caption); setEditingCaption(true); }}
            style={styles.captionArea}
          >
            <Text style={[styles.captionText, compact && styles.captionTextCompact, !caption && styles.captionPlaceholder]} numberOfLines={compact ? 1 : 2}>
              {caption || (compact ? '...' : 'Añadir descripción...')}
            </Text>
          </Pressable>
        )}
        <Pressable onPress={() => onDelete(node.id)} hitSlop={8}>
          <Feather name="trash-2" size={compact ? 12 : 14} color={Colors.text.disabled} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default React.memo(ImageNodeInner);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.warm,
    overflow: 'hidden',
    ...Shadows.subtle,
  },
  image: {
    width: '100%',
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  captionArea: {
    flex: 1,
  },
  captionText: {
    fontSize: Typography.size.caption,
    color: Colors.text.secondary,
    lineHeight: Typography.size.caption * Typography.lineHeight.relaxed,
  },
  captionPlaceholder: {
    color: Colors.text.disabled,
    fontStyle: 'italic',
  },
  captionInput: {
    flex: 1,
    fontSize: Typography.size.caption,
    color: Colors.text.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent.primary,
    paddingVertical: 2,
  },
  emptyContainer: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  emptyContent: {
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent.dim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  emptyDesc: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
  },
  emptyDelete: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
  emptyContentCompact: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  iconCircleCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 2,
  },
  emptyTitleCompact: {
    fontSize: Typography.size.caption,
  },
  footerCompact: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  captionTextCompact: {
    fontSize: Typography.size.micro,
  },
  captionInputCompact: {
    fontSize: Typography.size.micro,
  },
});
