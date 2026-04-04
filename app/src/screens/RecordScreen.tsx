import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { addHistories, getExercises } from '../db/database';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { parseTrainingWithGemini } from '../services/geminiService';
import type { Exercise, ParsedTrainingItem } from '../types';

export function RecordScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [rawText, setRawText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedTrainingItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const speech = useSpeechToText();

  useEffect(() => {
    if (speech.transcript) {
      setRawText(speech.transcript);
    }
  }, [speech.transcript]);

  const reloadExercises = useCallback(async () => {
    const list = await getExercises();
    setExercises(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reloadExercises();
    }, [reloadExercises]),
  );

  const canAnalyze = useMemo(() => rawText.trim().length > 0 && exercises.length > 0, [rawText, exercises.length]);

  const onAnalyze = useCallback(async () => {
    if (!canAnalyze) {
      return;
    }

    setIsParsing(true);
    try {
      const result = await parseTrainingWithGemini(rawText, exercises);
      setParsedItems(result);
      if (result.length === 0) {
        Alert.alert('解析結果なし', '入力から記録可能なデータを抽出できませんでした。');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '解析に失敗しました。';
      Alert.alert('解析エラー', message);
    } finally {
      setIsParsing(false);
    }
  }, [canAnalyze, exercises, rawText]);

  const onSave = useCallback(async () => {
    if (parsedItems.length === 0) {
      Alert.alert('保存対象なし', '先に解析して記録データを作成してください。');
      return;
    }

    setIsSaving(true);
    try {
      const items = parsedItems.map((item) => {
        const exercise = exercises.find((entry) => entry.name === item.exercise);
        if (!exercise) {
          throw new Error(`種目「${item.exercise}」が未登録です。設定画面で追加してください。`);
        }

        return {
          date: item.date,
          exerciseId: exercise.id,
          weight: item.weight,
          reps: item.reps,
          sets: item.sets,
          notes: item.notes,
        };
      });

      await addHistories(items);
      setParsedItems([]);
      setRawText('');
      speech.clear();
      Alert.alert('保存完了', `${items.length}件のトレーニング記録を保存しました。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存に失敗しました。';
      Alert.alert('保存エラー', message);
    } finally {
      setIsSaving(false);
    }
  }, [exercises, parsedItems, speech]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>トレーニング記録</Text>
      <Text style={styles.description}>音声またはテキストで入力し、Geminiで構造化して保存します。</Text>

      <View style={styles.block}>
        <Text style={styles.label}>入力</Text>
        <TextInput
          multiline
          style={styles.textArea}
          value={rawText}
          onChangeText={setRawText}
          placeholder="例: 今日はベンチ60kg 10回3セット、40kg 12回1セット"
        />
        <View style={styles.row}>
          <Pressable style={[styles.button, speech.isListening ? styles.buttonDanger : styles.buttonPrimary]} onPress={speech.isListening ? speech.stop : speech.start}>
            <Text style={styles.buttonText}>{speech.isListening ? '音声停止' : '音声開始'}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonGhost]} onPress={speech.clear}>
            <Text style={styles.buttonGhostText}>クリア</Text>
          </Pressable>
        </View>
        {speech.error ? <Text style={styles.errorText}>{speech.error}</Text> : null}
      </View>

      <View style={styles.block}>
        <Pressable disabled={!canAnalyze || isParsing} style={[styles.button, styles.buttonPrimary, (!canAnalyze || isParsing) && styles.buttonDisabled]} onPress={onAnalyze}>
          {isParsing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Geminiで解析</Text>}
        </Pressable>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>解析結果</Text>
        {parsedItems.length === 0 ? <Text style={styles.emptyText}>まだ解析結果がありません。</Text> : null}
        {parsedItems.map((item, index) => (
          <View key={`${item.exercise}-${item.date}-${index}`} style={styles.resultCard}>
            <Text style={styles.resultTitle}>{item.exercise}</Text>
            <Text style={styles.resultText}>{item.date}</Text>
            <Text style={styles.resultText}>
              {item.weight}kg / {item.reps}回 / {item.sets}セット
            </Text>
            <Text style={styles.resultText}>備考: {item.notes || 'なし'}</Text>
          </View>
        ))}
      </View>

      <Pressable
        disabled={parsedItems.length === 0 || isSaving}
        style={[styles.button, styles.buttonSuccess, (parsedItems.length === 0 || isSaving) && styles.buttonDisabled]}
        onPress={onSave}
      >
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>解析結果を保存</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
    backgroundColor: '#f6f8fb',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#102542',
  },
  description: {
    color: '#334e68',
  },
  block: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  label: {
    fontWeight: '600',
    color: '#102542',
  },
  textArea: {
    minHeight: 120,
    borderColor: '#d9e2ec',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonPrimary: {
    backgroundColor: '#175fe8',
  },
  buttonDanger: {
    backgroundColor: '#cc2b52',
  },
  buttonSuccess: {
    backgroundColor: '#1f9d55',
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: '#bcccdc',
    backgroundColor: '#fff',
  },
  buttonGhostText: {
    color: '#243b53',
    fontWeight: '600',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  errorText: {
    color: '#d64545',
  },
  emptyText: {
    color: '#627d98',
  },
  resultCard: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  resultTitle: {
    fontWeight: '700',
    color: '#102542',
  },
  resultText: {
    color: '#334e68',
  },
});
