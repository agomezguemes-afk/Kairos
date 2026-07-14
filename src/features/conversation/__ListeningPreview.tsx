// KAIROS — Dev harness for ListeningOverlay (not shipped; __-prefixed like the
// other concept files). Simulates the M3 STT pipeline by streaming a canned
// utterance word-by-word into the overlay's `transcript` prop, so the listening
// layout can be reviewed on device before voice is wired. Point a temporary
// route at this to preview.

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';

import ListeningOverlay from './ListeningOverlay';
import { Colors } from '../../theme/tokens';

const SCRIPT = 'quiero algo de piernas en casa unos cuarenta minutos sin material'.split(' ');

export default function ListeningPreview() {
  const [visible, setVisible] = useState(true);
  const [transcript, setTranscript] = useState('');
  const i = useRef(0);

  useEffect(() => {
    if (!visible) return;
    i.current = 0;
    setTranscript('');
    const id = setInterval(() => {
      i.current += 1;
      if (i.current > SCRIPT.length) {
        clearInterval(id);
        return;
      }
      setTranscript(SCRIPT.slice(0, i.current).join(' '));
    }, 420);
    return () => clearInterval(id);
  }, [visible]);

  return (
    <View style={styles.root}>
      <ListeningOverlay
        visible={visible}
        transcript={transcript}
        onCancel={() => setVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.void },
});
