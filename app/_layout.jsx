import {Stack} from 'expo-router';
import React from 'react';
import {SafeAreaView, StatusBar, useColorScheme} from 'react-native';

export default function RootLayout() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaView style={{flex: 1}}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Stack>
        <Stack.Screen name="index" options={{headerShown: false}} />
      </Stack>
    </SafeAreaView>
  );
}
