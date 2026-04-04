import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

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
          headerTitleStyle: {
            fontSize: 14,
            fontWeight: '700',
          },
          headerStyle: {
            backgroundColor: '#ffffff',
            borderBottomColor: '#e6e6ea',
            borderBottomWidth: 1,
          },
          headerTintColor: '#151721',
          sceneStyle: {
            backgroundColor: '#f4f4f5',
          },
          tabBarStyle: {
            height: Platform.OS === 'android' ? 110 : 76,
            paddingBottom: Platform.OS === 'android' ? 40 : 10,
            paddingTop: 6,
            backgroundColor: '#fff',
            borderTopColor: '#e6e6ea',
            borderTopWidth: 1,
          },
          tabBarActiveTintColor: '#4d3ff0',
          tabBarInactiveTintColor: '#7e8088',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '700',
          },
        }}
      >
        <Tab.Screen
          name="記録"
          component={RecordScreen}
          options={{
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
                <Ionicons name="barbell-outline" size={22} color={color} />
              </View>
            ),
            tabBarBadge: undefined,
          }}
        />
        <Tab.Screen
          name="履歴"
          component={HistoryScreen}
          options={{
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
                <Ionicons name="calendar-outline" size={22} color={color} />
              </View>
            ),
          }}
        />
        <Tab.Screen
          name="設定"
          component={SettingsScreen}
          options={{
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
                <Ionicons name="settings-outline" size={22} color={color} />
              </View>
            ),
          }}
        />
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
  tabIconWrap: {
    borderRadius: 14,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: {
    backgroundColor: '#eeecff',
  },
});
