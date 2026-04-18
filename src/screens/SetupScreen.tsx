import React, { useState, useRef, useEffect } from 'react';
import AnimatedButton from '../Buttons/AnimatedButton';
import KairosIcon from '../components/KairosIcon';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';

type StepData = {
  nivel: string;
  objetivo: string;
  frecuencia: string;
  edad: string;
  peso: string;
  altura: string;
  experiencia: string;
  lesiones: string;
};

export default function SetupScreen({ navigation }: any) {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<StepData>({
    nivel: '',
    objetivo: '',
    frecuencia: '',
    edad: '',
    peso: '',
    altura: '',
    experiencia: '',
    lesiones: '',
  });

  // Animación de deslizamiento
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Animar cuando cambie el paso
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentStep]);

  // Validación por paso
  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return data.nivel && data.objetivo && data.frecuencia;
      case 2:
        return data.edad && data.peso && data.altura;
      case 3:
        return data.experiencia && data.lesiones;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      // Animar salida
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentStep(currentStep + 1);
        slideAnim.setValue(50);
      });
    } else {
      // Último paso → Navegar al Dashboard
      console.log('Datos completos:', data);
      navigation.navigate('Dashboard');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentStep(currentStep - 1);
        slideAnim.setValue(-50);
      });
    } else {
      navigation.goBack();
    }
  };

  const buttonBackgroundColor = isStepValid() ? Colors.accent.primary : Colors.text.disabled;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header con progreso */}
      <View style={styles.header}>
        <AnimatedButton
          title="←"
          onPress={handleBack}
          variant="outline"
          width="auto"
          style={styles.backButton}
          textStyle={styles.backText}
        />
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4].map((step) => (
            <View
              key={step}
              style={[
                styles.progressDot,
                step <= currentStep && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateX: slideAnim }],
          opacity: fadeAnim,
        }}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {renderStep()}
        </ScrollView>
      </Animated.View>

      {/* Botón Continuar */}
      <View style={styles.footer}>
        <AnimatedButton
          title={currentStep === 4 ? 'Finalizar' : 'Continuar'}
          onPress={handleNext}
          disabled={!isStepValid()}
          variant="primary"
        />
      </View>
    </KeyboardAvoidingView>
  );

  // Renderizar paso actual
  function renderStep() {
    switch (currentStep) {
      case 1:
        return <Step1 data={data} setData={setData} />;
      case 2:
        return <Step2 data={data} setData={setData} />;
      case 3:
        return <Step3 data={data} setData={setData} />;
      case 4:
        return <Step4 data={data} />;
      default:
        return null;
    }
  }
}

// ========== PASO 1: Nivel, Objetivo, Frecuencia ==========
function Step1({ data, setData }: any) {
  return (
    <View>
      <Text style={styles.title}>Configura tu plan</Text>
      <Text style={styles.subtitle}>
        Dinos sobre tu nivel y objetivos
      </Text>

      {/* Nivel */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nivel</Text>
        <View style={styles.row}>
          <AnimatedButton
            title="Principiante"
            icon={<KairosIcon name="seedling" size={20} color="#C9A96E" />}
            onPress={() => setData({ ...data, nivel: 'Principiante' })}
            selected={data.nivel === 'Principiante'}
            variant="option"
            width="auto"
            style={styles.optionButton}
          />
          <AnimatedButton
            title="Intermedio"
            icon={<KairosIcon name="strength" size={20} color="#C9A96E" />}
            onPress={() => setData({ ...data, nivel: 'Intermedio' })}
            selected={data.nivel === 'Intermedio'}
            variant="option"
            width="auto"
            style={styles.optionButton}
          />
          <AnimatedButton
            title="Avanzado"
            icon={<KairosIcon name="trophy" size={20} color="#C9A96E" />}
            onPress={() => setData({ ...data, nivel: 'Avanzado' })}
            selected={data.nivel === 'Avanzado'}
            variant="option"
            width="auto"
            style={styles.optionButton}
          />
        </View>
      </View>

      {/* Objetivo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Objetivo</Text>
        <View style={styles.row}>
          <AnimatedButton
            title="Ganar músculo"
            onPress={() => setData({ ...data, objetivo: 'Ganar músculo' })}
            selected={data.objetivo === 'Ganar músculo'}
            variant="option"
            width="auto"
            style={styles.optionButton}
          />
          <AnimatedButton
            title="Perder grasa"
            onPress={() => setData({ ...data, objetivo: 'Perder grasa' })}
            selected={data.objetivo === 'Perder grasa'}
            variant="option"
            width="auto"
            style={styles.optionButton}
          />
          <AnimatedButton
            title="Definición"
            onPress={() => setData({ ...data, objetivo: 'Definición' })}
            selected={data.objetivo === 'Definición'}
            variant="option"
            width="auto"
            style={styles.optionButton}
          />
        </View>
      </View>

      {/* Frecuencia */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Días de entrenamiento</Text>
        <View style={styles.row}>
          <AnimatedButton
            title="2–3"
            onPress={() => setData({ ...data, frecuencia: '2–3' })}
            selected={data.frecuencia === '2–3'}
            variant="option"
            width="auto"
            style={styles.optionButton}
          />
          <AnimatedButton
            title="4–5"
            onPress={() => setData({ ...data, frecuencia: '4–5' })}
            selected={data.frecuencia === '4–5'}
            variant="option"
            width="auto"
            style={styles.optionButton}
          />
          <AnimatedButton
            title="6+"
            onPress={() => setData({ ...data, frecuencia: '6+' })}
            selected={data.frecuencia === '6+'}
            variant="option"
            width="auto"
            style={styles.optionButton}
          />
        </View>
      </View>
    </View>
  );
}

// ========== PASO 2: Edad, Peso, Altura ==========
function Step2({ data, setData }: any) {
  return (
    <View>
      <Text style={styles.title}>Datos personales</Text>
      <Text style={styles.subtitle}>
        Esto nos ayuda a personalizar tu rutina
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Edad</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 25"
          placeholderTextColor={Colors.text.disabled}
          keyboardType="numeric"
          value={data.edad}
          onChangeText={(text) => setData({ ...data, edad: text })}
          maxLength={2}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Peso (kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 75"
          placeholderTextColor={Colors.text.disabled}
          keyboardType="numeric"
          value={data.peso}
          onChangeText={(text) => setData({ ...data, peso: text })}
          maxLength={3}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Altura (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 175"
          placeholderTextColor={Colors.text.disabled}
          keyboardType="numeric"
          value={data.altura}
          onChangeText={(text) => setData({ ...data, altura: text })}
          maxLength={3}
        />
      </View>
    </View>
  );
}

// ========== PASO 3: Experiencia y Lesiones ==========
function Step3({ data, setData }: any) {
  return (
    <View>
      <Text style={styles.title}>Experiencia</Text>
      <Text style={styles.subtitle}>
        Últimos detalles para personalizar tu plan
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>¿Cuánto tiempo llevas entrenando?</Text>
        <View style={styles.column}>
          {['Menos de 6 meses', '6-12 meses', '1-2 años', 'Más de 2 años'].map((item) => (
            <AnimatedButton
              key={item}
              title={item}
              onPress={() => setData({ ...data, experiencia: item })}
              selected={data.experiencia === item}
              variant="option"
              style={styles.fullOptionButton}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>¿Tienes alguna lesión o limitación?</Text>
        <View style={styles.column}>
          {['No', 'Rodillas', 'Hombros', 'Espalda', 'Otra'].map((item) => (
            <AnimatedButton
              key={item}
              title={item}
              onPress={() => setData({ ...data, lesiones: item })}
              selected={data.lesiones === item}
              variant="option"
              style={styles.fullOptionButton}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ========== PASO 4: Resumen ==========
function Step4({ data }: any) {
  return (
    <View>
      <Text style={styles.title}>¡Todo listo!</Text>
      <Text style={styles.subtitle}>
        Confirma tu información antes de empezar
      </Text>

      <View style={styles.summaryCard}>
        <SummaryRow label="Nivel" value={data.nivel} />
        <SummaryRow label="Objetivo" value={data.objetivo} />
        <SummaryRow label="Frecuencia" value={`${data.frecuencia} días/semana`} />
        <SummaryRow label="Edad" value={`${data.edad} años`} />
        <SummaryRow label="Peso" value={`${data.peso} kg`} />
        <SummaryRow label="Altura" value={`${data.altura} cm`} />
        <SummaryRow label="Experiencia" value={data.experiencia} />
        <SummaryRow label="Lesiones" value={data.lesiones} />
      </View>

      <View style={styles.readyBox}>
        <KairosIcon name="target" size={40} color="#C9A96E" />
        <Text style={styles.readyText}>
          Tu plan personalizado está listo. Comencemos a entrenar!
        </Text>
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

// ========== ESTILOS ==========
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.void,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screen.horizontal,
    paddingTop: Spacing.screen.top,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 40,
    minHeight: 40,
  },
  backButtonPlaceholder: {
    width: 40,
  },
  backText: {
    fontSize: 24,
    fontWeight: Typography.weight.semibold,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border.light,
  },
  progressDotActive: {
    backgroundColor: Colors.accent.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.size.hero,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.size.body,
    color: Colors.text.secondary,
    marginBottom: 40,
  },
  section: {
    marginBottom: Spacing['3xl'],
  },
  sectionTitle: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  column: {
    gap: Spacing.md,
  },
  optionButton: {
    flex: 1,
    minHeight: 60,
  },
  fullOptionButton: {
    width: '100%',
  },
  input: {
    backgroundColor: Colors.background.surface,
    borderWidth: 1,
    borderColor: Colors.accent.light,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    color: Colors.text.primary,
    fontSize: Typography.size.body,
    ...Shadows.subtle,
  },
  footer: {
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing['2xl'],
    ...Shadows.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  summaryLabel: {
    color: Colors.text.secondary,
    fontSize: Typography.size.body,
  },
  summaryValue: {
    color: Colors.text.primary,
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
  },
  readyBox: {
    backgroundColor: Colors.accent.muted,
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    alignItems: 'center',
  },
  readyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  readyText: {
    color: Colors.text.primary,
    fontSize: Typography.size.body,
    textAlign: 'center',
    lineHeight: 22,
  },
});