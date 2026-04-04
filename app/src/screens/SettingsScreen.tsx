import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { addExercise, deleteExercise, getExercises, updateExercise } from '../db/database';
import type { Exercise } from '../types';

export function SettingsScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const reload = useCallback(async () => {
    const list = await getExercises();
    setExercises(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const onAdd = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      return;
    }

    if (exercises.some((exercise) => exercise.name === name)) {
      Alert.alert('重複エラー', '同名の種目が既に存在します。');
      return;
    }

    try {
      await addExercise(name);
      setNewName('');
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : '追加に失敗しました。';
      Alert.alert('追加エラー', message);
    }
  }, [exercises, newName, reload]);

  const onSaveEdit = useCallback(async () => {
    if (!editingId) {
      return;
    }

    const name = editingName.trim();
    if (!name) {
      Alert.alert('入力エラー', '種目名を入力してください。');
      return;
    }

    if (exercises.some((exercise) => exercise.id !== editingId && exercise.name === name)) {
      Alert.alert('重複エラー', '同名の種目が既に存在します。');
      return;
    }

    try {
      await updateExercise(editingId, name);
      setEditingId(null);
      setEditingName('');
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新に失敗しました。';
      Alert.alert('更新エラー', message);
    }
  }, [editingId, editingName, exercises, reload]);

  const onDelete = useCallback((exercise: Exercise) => {
    Alert.alert('削除確認', `${exercise.name} を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExercise(exercise.id);
            await reload();
          } catch (error) {
            const message =
              error instanceof Error && error.message.includes('FOREIGN KEY')
                ? '履歴で使用中のため削除できません。'
                : error instanceof Error
                  ? error.message
                  : '削除に失敗しました。';
            Alert.alert('削除エラー', message);
          }
        },
      },
    ]);
  }, [reload]);

  return (
    <ScrollView contentContainerStyle={styles.container}>

      <View style={styles.block}>
        <Text style={styles.label}>種目を追加</Text>
        <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="種目名" />
        <Pressable style={[styles.button, styles.buttonPrimary]} onPress={() => void onAdd()}>
          <Text style={styles.buttonText}>追加</Text>
        </Pressable>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>種目一覧</Text>
        {exercises.map((exercise) => {
          const isEditing = editingId === exercise.id;

          return (
            <View key={exercise.id} style={styles.card}>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={editingName}
                  onChangeText={setEditingName}
                />
              ) : (
                <Text style={styles.cardTitle}>
                  {exercise.name}
                </Text>
              )}

              <View style={styles.row}>
                {isEditing ? (
                  <Pressable style={[styles.button, styles.buttonPrimary]} onPress={() => void onSaveEdit()}>
                    <Text style={styles.buttonText}>保存</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.button, styles.buttonGhost]}
                    onPress={() => {
                      setEditingId(exercise.id);
                      setEditingName(exercise.name);
                    }}
                  >
                    <Text style={styles.buttonGhostText}>編集</Text>
                  </Pressable>
                )}

                <Pressable
                  style={[styles.button, styles.buttonDanger]}
                  onPress={() => onDelete(exercise)}
                >
                  <Text style={styles.buttonText}>削除</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 8,
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  label: {
    fontWeight: '600',
    color: '#102542',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  card: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  cardTitle: {
    fontWeight: '600',
    color: '#102542',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    borderRadius: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#175fe8',
  },
  buttonDanger: {
    backgroundColor: '#cc2b52',
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: '#bcccdc',
    backgroundColor: '#fff',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonGhostText: {
    color: '#243b53',
    fontWeight: '600',
  },
});
