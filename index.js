import React from 'react';

import {AppRegistry} from 'react-native';
import {ExpoRoot} from 'expo-router';

const context = require.context('./app');

function App() {
  return <ExpoRoot context={context} />;
}

AppRegistry.registerComponent('AwesomeProject', () => App);
