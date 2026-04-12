import React, { useRef, useEffect } from 'react';
import {
  Pressable,
  Animated,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { Colors, Typography, Radius } from '../theme/index';

interface AnimatedButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'option';
  width?: 'full' | 'auto' | number;
  icon?: React.ReactNode;
  emoji?: string;
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  title,
  onPress,
  style,
  textStyle,
  disabled = false,
  loading = false,
  selected = false,
  variant = 'option',
  width = 'full',
  icon,
  emoji,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(selected ? 1 : 0.7)).current;

  useEffect(() => {
    if (variant === 'option') {
      Animated.timing(fadeAnim, {
        toValue: selected ? 1 : 0.7,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [selected, variant, fadeAnim]);

  const handlePressIn = () => {
    if (!disabled && !loading) {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        friction: 6,
        tension: 40,
      }).start();
    }
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
      tension: 40,
    }).start();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: disabled ? Colors.text.disabled : Colors.background.elevated,
          borderColor: disabled ? Colors.text.disabled : Colors.background.elevated,
          textColor: Colors.text.primary,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: disabled ? Colors.text.disabled : Colors.accent.primary,
          textColor: disabled ? Colors.text.disabled : Colors.accent.primary,
        };
      case 'primary':
        return {
          backgroundColor: disabled ? Colors.text.disabled : Colors.accent.primary,
          borderColor: disabled ? Colors.text.disabled : Colors.accent.primary,
          textColor: Colors.text.inverse,
        };
      case 'option':
      default:
        return {
          backgroundColor: selected
            ? Colors.accent.primary
            : Colors.accent.muted,
          borderColor: selected
            ? Colors.accent.primary
            : Colors.accent.light,
          textColor: selected ? Colors.text.inverse : Colors.text.primary,
        };
    }
  };

  const variantStyles = getVariantStyles();

  const widthStyle = (): ViewStyle => {
    if (typeof width === 'number') return { width };
    if (width === 'auto') return { alignSelf: 'flex-start' };
    return { width: '100%' };
  };

  const marginStyle = (): ViewStyle => {
    return { marginHorizontal: variant === 'option' ? 4 : 0 };
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled || loading}
      style={[widthStyle(), marginStyle()]}
    >
      <Animated.View
        style={[
          styles.button,
          variantStyles,
          {
            transform: [{ scale: scaleAnim }],
            opacity: fadeAnim,
          },
          disabled && styles.disabled,
          variant === 'option' && styles.optionButton,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'outline' ? Colors.accent.primary : Colors.text.inverse}
            size="small"
          />
        ) : (
          <View style={styles.content}>
            {emoji && <Text style={styles.emoji}>{emoji}</Text>}
            {icon && <View style={styles.icon}>{icon}</View>}
            <Text style={[
              styles.text,
              variant === 'option' && styles.optionText,
              { color: variantStyles.textColor },
              textStyle,
            ]}>
              {title}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  optionButton: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    minHeight: 60,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emoji: {
    fontSize: 20,
    marginRight: 4,
  },
  icon: {
    marginRight: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    textAlign: 'center',
  },
  optionText: {
    fontSize: Typography.size.caption,
  },
});

export default AnimatedButton;
