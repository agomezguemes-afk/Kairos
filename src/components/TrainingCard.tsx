import React, { useRef, useEffect } from 'react';
import { View, Pressable, Animated, Text, StyleSheet, ViewStyle } from 'react-native';
import { MuscleGroupOption } from '../types/training';
import KairosIcon from './KairosIcon';

// ========== PROPS INTERFACE ==========

interface TrainingCardProps {
  option: MuscleGroupOption;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

// ========== COMPONENTE PRINCIPAL ==========

const TrainingCardComponent: React.FC<TrainingCardProps> = ({
  option,
  selected,
  onPress,
  disabled = false,
  style,
}) => {
  // ========== ANIMATED VALUES ==========
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const colorAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const opacityAnim = useRef(new Animated.Value(disabled ? 0.4 : 1)).current;

  // ========== EFFECTS ==========
  
  useEffect(() => {
    Animated.timing(colorAnim, {
      toValue: selected ? 1 : 0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [selected, colorAnim]);

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: disabled ? 0.4 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [disabled, opacityAnim]);

  // ========== COMPUTED VALUES ==========
  
  const backgroundColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      'rgba(59, 130, 246, 0)',
      'rgba(59, 130, 246, 1)',
    ],
  });

  const borderColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      'rgba(59, 130, 246, 0.5)',
      'rgba(59, 130, 246, 1)',
    ],
  });

  // ========== HANDLERS ==========
  
  const handlePressIn = () => {
    if (!disabled) {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: false,
        friction: 5,
        tension: 40,
      }).start();
    }
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: false,
      friction: 3,
      tension: 40,
    }).start();
  };

  const handlePress = () => {
    if (!disabled) {
      onPress();
    }
  };

  // ========== RENDER ==========

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${option.name}${selected ? ', seleccionado' : ''}`}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor,
            borderColor,
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
          selected && styles.cardSelected,
          style,
        ]}
      >
        <View style={styles.emojiContainer}>
          <KairosIcon name={option.icon} size={36} color="#fff" />
        </View>
        
        <View style={styles.nameContainer}>
          <Text 
            style={[
              styles.name,
              disabled && styles.nameDisabled,
              selected && styles.nameSelected,
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {option.name}
          </Text>
        </View>
        
        {selected && (
          <View style={styles.selectedIndicator}>
            <View style={styles.selectedIndicatorDot} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
};

TrainingCardComponent.displayName = 'TrainingCardComponent';

// ========== ESTILOS ==========

const styles = StyleSheet.create({
  card: {
    // Tamaño fijo consistente
    width: '100%',
    aspectRatio: 0.85, // Proporción rectangular agradable
    minHeight: 110,
    
    // Layout interno
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16, // Más redondeado para modernidad
    
    // Visual
    borderWidth: 2,
    
    // Flexbox
    alignItems: 'center',
    justifyContent: 'space-between', // Separa emoji y texto
    
    // Shadow mejorada
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  
  cardSelected: {
    shadowColor: '#3b82f6',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  
  emojiContainer: {
    flex: 3, // Más espacio para el emoji
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  emoji: {
    fontSize: 36, // Un poco más grande
    lineHeight: 40,
    textAlign: 'center',
    includeFontPadding: false,
  },
  
  nameContainer: {
    flex: 2, // Espacio fijo para el texto
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
  },
  
name: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16, // ⬅️ ESTO ES LO ÚNICO QUE CAMBIÉ
    textAlign: 'center',
    lineHeight: 18,
    flexShrink: 1,
    // Elimina adjustsFontSizeToFit para tamaño fijo
    
    // Propiedades para texto consistente
    includeFontPadding: false,
    textAlignVertical: 'center',
    
    // Sombra de texto para mejor legibilidad
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  nameSelected: {
    color: '#fff',
    fontWeight: '800',
  },
  
  nameDisabled: {
    color: '#94a3b8',
    opacity: 0.7,
  },
  
  selectedIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 3,
  },
  
  selectedIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
});

// ========== MEMOIZATION ==========

const TrainingCard = React.memo(TrainingCardComponent);
TrainingCard.displayName = 'TrainingCard';

// ========== EXPORT ==========

export default TrainingCard;