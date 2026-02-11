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
  // Animaciones que SÍ soportan native driver
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(selected ? 1 : 0.7)).current;

  // Animar fade cuando cambia la selección
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

  // Estilos estáticos según variante
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: disabled ? '#555' : '#374151',
          borderColor: disabled ? '#666' : '#374151',
          textColor: '#fff',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: disabled ? '#666' : '#3b82f6',
          textColor: disabled ? '#666' : '#3b82f6',
        };
      case 'primary':
        return {
          backgroundColor: disabled ? '#555' : '#3b82f6',
          borderColor: disabled ? '#555' : '#3b82f6',
          textColor: '#fff',
        };
      case 'option':
      default:
        return {
          backgroundColor: selected 
            ? 'rgba(59, 130, 246, 0.8)' 
            : 'rgba(59, 130, 246, 0.15)',
          borderColor: selected 
            ? 'rgba(59, 130, 246, 0.9)' 
            : 'rgba(59, 130, 246, 0.3)',
          textColor: selected ? '#fff' : '#e5e7eb',
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
            color={variant === 'outline' ? '#3b82f6' : '#fff'} 
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
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
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  optionText: {
    fontSize: 14,
  },
});

export default AnimatedButton;