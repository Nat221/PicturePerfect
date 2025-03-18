import {useState, useEffect} from 'react';
import {PermissionsAndroid, Platform, Linking, Alert} from 'react-native';

import {
  initialize,
  startDiscoveringPeers,
  stopDiscoveringPeers,
  subscribeOnPeersUpdates,
  subscribeOnConnectionInfoUpdates,
} from 'react-native-wifi-p2p';

const useInitialize = setUpdatedInfo => {
  const [wifiP2PInitialized, setWifiP2PInitialized] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);

  useEffect(() => {
    if (wifiP2PInitialized) return;
    let subscription;
    let subscribeConnectionInfo;
    const requestPermissions = async () => {
      if (Platform.Version >= 33) {
        const nearbyWifiDevicesPermissionStatus =
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
          );

        const cameraPermissionStatus = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );

        // Store permission statuses
        const finalPermissionsCheck = {
          'android.permission.NEARBY_WIFI_DEVICES':
            nearbyWifiDevicesPermissionStatus,
          'android.permission.CAMERA': cameraPermissionStatus,
        };

        // Filter out any permissions that were not granted
        const permissionsStillToBeGranted = Object.entries(
          finalPermissionsCheck,
        )
          .map(([key, value]) => {
            if (value !== 'granted') {
              switch (key) {
                case 'android.permission.ACCESS_COARSE_LOCATION':
                  return 'Coarse Location';
                case 'android.permission.ACCESS_BACKGROUND_LOCATION':
                  return 'Background Location';
                case 'android.permission.NEARBY_WIFI_DEVICES':
                  return 'Nearby Wifi Devices';
                case 'android.permission.CAMERA':
                  return 'Camera';
              }
            }
            return null;
          })
          .filter(Boolean);

        // If any permissions are still denied, prompt the user to open settings
        if (permissionsStillToBeGranted.length > 0) {
          return Alert.alert(
            'Permission required',
            `Please allow ${
              permissionsStillToBeGranted.length > 1
                ? permissionsStillToBeGranted.join(' and ')
                : permissionsStillToBeGranted[0]
            } in settings`,
            [
              {text: 'Cancel', style: 'cancel'},
              {
                text: 'Open Settings',
                onPress: () => {
                  Linking.openSettings();
                },
              },
            ],
          );
        }

        return true;
      } else {
        const fineLocationPermissionStatus = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        const cameraPermissionStatus = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        const finalPermissionsCheck = {
          'android.permission.ACCESS_FINE_LOCATION':
            fineLocationPermissionStatus,
          'android.permission.CAMERA': cameraPermissionStatus,
        };

        const permissionsStillToBeGranted = Object.entries(
          finalPermissionsCheck,
        )
          .map(([key, value]) => {
            if (value !== 'granted') {
              switch (key) {
                case 'android.permission.ACCESS_FINE_LOCATION':
                  return 'Location';
                case 'android.permission.CAMERA':
                  return 'Camera';
              }
            }
            return null;
          })
          .filter(Boolean);

        // If any permissions are still denied, prompt the user to open settings
        if (permissionsStillToBeGranted.length > 0) {
          return Alert.alert(
            'Permission required',
            `Please allow ${
              permissionsStillToBeGranted.length > 1
                ? permissionsStillToBeGranted.join(' and ')
                : permissionsStillToBeGranted[0]
            } in settings`,
            [
              {text: 'Cancel', style: 'cancel'},
              {
                text: 'Open Settings',
                onPress: () => {
                  Linking.openSettings();
                },
              },
            ],
          );
        }

        return true;
      }
    };

    const initWifiP2P = async () => {
      try {
        await initialize();
        setWifiP2PInitialized(true);
        console.log('Wifi P2P initialized');

        const permissions = await requestPermissions();
        if (!permissions) return;

        subscription = subscribeOnPeersUpdates(({devices}) => {
          console.log('Available devices:', devices);
          setDiscoveredDevices(devices);
        });
        subscribeConnectionInfo = subscribeOnConnectionInfoUpdates(info => {
          console.log('Connection info updates ...', info);
          console.log('Group formed: ', info.groupFormed);
          console.log('Group owner: ', info.isGroupOwner);
          if (info.groupFormed) {
            setUpdatedInfo(info);
          }
          // else {
          //   setUpdatedInfo(null);
          //   setTimeout(() => {
          //     startDiscoveringPeers();
          //     console.log('Started discovering...');
          //   }, 1000);
          // }
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
        console.log('CLEAN UP FUNCTION');
        subscription.remove();
        subscribeConnectionInfo.remove();
        stopDiscoveringPeers();
      }
    };
  }, [wifiP2PInitialized]);

  return {discoveredDevices};
};

export default useInitialize;
