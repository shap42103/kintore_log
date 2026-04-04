import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { initializeDatabase } from './src/db/database';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { RecordScreen } from './src/screens/RecordScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initializeDatabase();
        setReady(true);
      } catch (dbError) {
        const message = dbError instanceof Error ? dbError.message : '初期化に失敗しました。';
        setError(message);
      }
    };

    void bootstrap();
  }, []);

  if (!ready && !error) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#175fe8" />
        <Text style={styles.loadingText}>データベースを初期化しています...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>初期化エラー</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#102542' },
          headerTintColor: '#fff',
          tabBarActiveTintColor: '#175fe8',
          tabBarInactiveTintColor: '#7b8794',
        }}
      >
        <Tab.Screen name="記録" component={RecordScreen} />
        <Tab.Screen name="履歴" component={HistoryScreen} />
        <Tab.Screen name="設定" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#f6f8fb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  loadingText: {
    color: '#334e68',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#cc2b52',
  },
  errorText: {
    color: '#334e68',
    textAlign: 'center',
  },
});
