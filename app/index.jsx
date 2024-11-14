import {
  View,
  Text,
  Button,
  PermissionsAndroid,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import React, {useState, useRef, useEffect} from 'react';
import {CameraView, useCameraPermissions} from 'expo-camera';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  initialize,
  startDiscoveringPeers,
  stopDiscoveringPeers,
  subscribeOnPeersUpdates,
  subscribeOnConnectionInfoUpdates,
  connectWithConfig,
} from 'react-native-wifi-p2p';

const CameraScreen = () => {
  const [cameraReady, setCameraReady] = useState(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    let subscription;
    let subscribeConnectionInfo;
    console.log(permission);
    const initWifiP2P = async () => {
      try {
        await initialize();
        console.log('Wifi P2P initialized');
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,

            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
            PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
          ]);
          console.log(granted);

          if (
            granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] !==
              PermissionsAndroid.RESULTS.GRANTED ||
            granted[
              PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
            ] !== PermissionsAndroid.RESULTS.GRANTED ||
            granted[PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES] !==
              PermissionsAndroid.RESULTS.GRANTED
          ) {
            return Alert.alert(
              'Permission denied',
              'Unable to use P2P Wifi without permission',
            );
          }
        } else {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          if (
            granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] !==
              PermissionsAndroid.RESULTS.GRANTED ||
            granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] !==
              PermissionsAndroid.RESULTS.GRANTED
          ) {
            return Alert.alert(
              'Permission denied',
              'Unable to use P2P Wifi without permission',
            );
          }
        }

        subscription = subscribeOnPeersUpdates(({devices}) => {
          console.log('Available devices:', devices);
          setDiscoveredDevices(devices);
        });
        subscribeConnectionInfo = subscribeOnConnectionInfoUpdates(info => {
          console.log('Connection info updates ...', info);
        });
        await startDiscoveringPeers();
        console.log('Started discovering...');
      } catch (error) {
        console.log('Not discovering peers', error);
      }
    };
    initWifiP2P();

    return () => {
      if (subscription) {
        subscription.remove();
        subscribeConnectionInfo.remove();
        stopDiscoveringPeers();
      }
    };
  }, []);

  const cameraRef = useRef(null);

  // const handleStartDiscovering = () => {
  //   if (discovering) {
  //     console.log('Already discovering devices...');
  //     return;
  //   }
  //   setDiscovering(true);
  //   console.log('BALD');
  //   startDiscoveringPeers()
  //     .then(() => {
  //       console.log('Started discovering nearby devices...');
  //     })
  //     .catch(error => {
  //       console.log('Error when discovering nearby devices', error);

  //       Alert.alert('Error', 'Could not start discovering nearby devices');
  //     });
  // };

  // const handleStopDiscovering = () => {
  //   if (!discovering) {
  //     console.log('Not yet discovering nearby devices...');
  //     return;
  //   }
  //   setDiscovering(false);
  //   stopDiscoveringPeers()
  //     .then(() => {
  //       console.log('Stoped discovering nearby devices...');
  //     })
  //     .catch(error => {
  //       console.log(
  //         'Error when trying to stop discovering nearby devices',
  //         error,
  //       );

  //       Alert.alert('Error', 'Could not stop discovering nearby devices');
  //     });
  // };

  const connectToDevice = deviceAddress => {
    connectWithConfig({deviceAddress: deviceAddress, groupOwnerIntent: 15})
      .then(() => console.log('Successfully connected as group Owner.'))
      .catch(error => console.error('Something gone wrong. Details: ', error));
  };

  if (!permission) {
    return <Text>Waiting for Camera Permission</Text>;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={{flex: 1}}>
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Text>No access to camera</Text>
          <Button onPress={requestPermission} title="Request Permission" />
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={{flex: 1}}>
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <CameraView style={{height: '80%', width: '100%'}} />
        {/* <View style={{justifyContent: 'center', alignItems: 'center'}}>
          {discovering ? (
            <Button
              title="Stop discovering nearby devices"
              onPress={handleStopDiscovering}
            />
          ) : (
            <Button
              title="Search for nearby devices"
              onPress={handleStartDiscovering}
            />
          )}
        </View> */}
        <View>
          {discoveredDevices.length > 0 ? (
            discoveredDevices.map((device, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => connectToDevice(device.deviceAddress)}>
                <Text>{device.deviceName}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={{color: 'black'}}>No devices found</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default CameraScreen;
