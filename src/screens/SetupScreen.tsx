<<<<<<< HEAD
import React, { useState, useRef, useEffect } from 'react';
import AnimatedButton from '../Buttons/AnimatedButton';
=======
import React, { useState, useEffect, useRef } from 'react';
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
import {
  View,
  Text,
  StyleSheet,
<<<<<<< HEAD
=======
  Pressable,
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
  ScrollView,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

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
<<<<<<< HEAD
      navigation.navigate('Dashboard');
=======
      // TODO: Guardar en AsyncStorage o Supabase
      navigation.navigate('Dashboard'); // Cambiar cuando tengas el Dashboard
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
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

<<<<<<< HEAD
  // Color del botón según validación (movido aquí, dentro del componente)
=======
  // Color del botón según validación
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
  const buttonBackgroundColor = isStepValid() ? '#3b82f6' : '#555';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header con progreso */}
      <View style={styles.header}>
<<<<<<< HEAD
        <AnimatedButton
          title="←"
          onPress={handleBack}
          variant="outline"
          width="auto"
          style={styles.backButton}
          textStyle={styles.backText}
        />
=======
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
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
<<<<<<< HEAD
        <View style={styles.backButtonPlaceholder} />
=======
        <View style={styles.backButton} />
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
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
<<<<<<< HEAD
        <AnimatedButton
          title={currentStep === 4 ? 'Finalizar' : 'Continuar'}
          onPress={handleNext}
          disabled={!isStepValid()}
          variant="primary"
        />
=======
        <Pressable
          style={[
            styles.continueButton,
            { backgroundColor: buttonBackgroundColor },
          ]}
          onPress={handleNext}
          disabled={!isStepValid()}
        >
          <Text style={styles.continueButtonText}>
            {currentStep === 4 ? 'Finalizar' : 'Continuar'}
          </Text>
        </Pressable>
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
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
<<<<<<< HEAD
          <AnimatedButton
            title="Principiante"
            emoji="🌱"
            onPress={() => setData({ ...data, nivel: 'Principiante' })}
            selected={data.nivel === 'Principiante'}
            variant="option"
            width="auto"
            style={styles.optionButton}
          />
          <AnimatedButton
            title="Intermedio"
            emoji="💪"
            onPress={() => setData({ ...data, nivel: 'Intermedio' })}
            selected={data.nivel === 'Intermedio'}
            variant="option"
            width="auto"
            style={styles.optionButton}
          />
          <AnimatedButton
            title="Avanzado"
            emoji="🏆"
            onPress={() => setData({ ...data, nivel: 'Avanzado' })}
            selected={data.nivel === 'Avanzado'}
            variant="option"
            width="auto"
            style={styles.optionButton}
          />
=======
          {['Principiante', 'Intermedio', 'Avanzado'].map((item) => (
            <Pressable
              key={item}
              style={[
                styles.option,
                data.nivel === item && styles.optionSelected,
              ]}
              onPress={() => setData({ ...data, nivel: item })}
            >
              <Text style={styles.optionEmoji}>
                {item === 'Principiante' ? '🌱' : item === 'Intermedio' ? '💪' : '🏆'}
              </Text>
              <Text style={styles.optionText}>{item}</Text>
            </Pressable>
          ))}
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
        </View>
      </View>

      {/* Objetivo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Objetivo</Text>
        <View style={styles.row}>
<<<<<<< HEAD
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
=======
          {['Ganar músculo', 'Perder grasa', 'Definición'].map((item) => (
            <Pressable
              key={item}
              style={[
                styles.option,
                data.objetivo === item && styles.optionSelected,
              ]}
              onPress={() => setData({ ...data, objetivo: item })}
            >
              <Text style={styles.optionText}>{item}</Text>
            </Pressable>
          ))}
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
        </View>
      </View>

      {/* Frecuencia */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Días de entrenamiento</Text>
        <View style={styles.row}>
<<<<<<< HEAD
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
=======
          {['2–3', '4–5', '6+'].map((item) => (
            <Pressable
              key={item}
              style={[
                styles.option,
                data.frecuencia === item && styles.optionSelected,
              ]}
              onPress={() => setData({ ...data, frecuencia: item })}
            >
              <Text style={styles.optionText}>{item}</Text>
            </Pressable>
          ))}
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
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
          placeholderTextColor="#666"
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
          placeholderTextColor="#666"
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
          placeholderTextColor="#666"
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
<<<<<<< HEAD
            <AnimatedButton
              key={item}
              title={item}
              onPress={() => setData({ ...data, experiencia: item })}
              selected={data.experiencia === item}
              variant="option"
              style={styles.fullOptionButton}
            />
=======
            <Pressable
              key={item}
              style={[
                styles.optionFull,
                data.experiencia === item && styles.optionSelected,
              ]}
              onPress={() => setData({ ...data, experiencia: item })}
            >
              <Text style={styles.optionText}>{item}</Text>
            </Pressable>
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>¿Tienes alguna lesión o limitación?</Text>
        <View style={styles.column}>
          {['No', 'Rodillas', 'Hombros', 'Espalda', 'Otra'].map((item) => (
<<<<<<< HEAD
            <AnimatedButton
              key={item}
              title={item}
              onPress={() => setData({ ...data, lesiones: item })}
              selected={data.lesiones === item}
              variant="option"
              style={styles.fullOptionButton}
            />
=======
            <Pressable
              key={item}
              style={[
                styles.optionFull,
                data.lesiones === item && styles.optionSelected,
              ]}
              onPress={() => setData({ ...data, lesiones: item })}
            >
              <Text style={styles.optionText}>{item}</Text>
            </Pressable>
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
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
        <Text style={styles.readyEmoji}>🎯</Text>
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
    backgroundColor: '#0a0a0d',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
<<<<<<< HEAD
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
    fontWeight: '600',
=======
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 28,
    color: '#fff',
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  progressDotActive: {
    backgroundColor: '#3b82f6',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  column: {
    gap: 12,
  },
<<<<<<< HEAD
  optionButton: {
    flex: 1,
    minHeight: 60,
  },
  fullOptionButton: {
    width: '100%',
=======
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  optionFull: {
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSelected: {
    backgroundColor: '#3b82f6',
  },
  optionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  optionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
  },
  input: {
    backgroundColor: '#1a1a1d',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
<<<<<<< HEAD
=======
  continueButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
  summaryCard: {
    backgroundColor: '#1a1a1d',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2d',
  },
  summaryLabel: {
    color: '#aaa',
    fontSize: 15,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  readyBox: {
    backgroundColor: '#1a2a3a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  readyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  readyText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
<<<<<<< HEAD
});
=======
});
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
