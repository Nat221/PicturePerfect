import {useState, useEffect} from 'react';
import {PermissionsAndroid, Platform, Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  const storeData = async (key, value) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.log('Error when saving permissions', error.message);
    }
  };

  useEffect(() => {
    if (wifiP2PInitialized) return;
    let subscription;
    let subscribeConnectionInfo;

    const initWifiP2P = async () => {
      try {
        await initialize();
        setWifiP2PInitialized(true);
        console.log('Wifi P2P initialized');

        const requestedPermissions = await AsyncStorage.getItem('permissions');

        console.log('Requested Permissions', requestedPermissions);

        if (!requestedPermissions) {
          if (Platform.Version >= 33) {
            const granted = await PermissionsAndroid.requestMultiple([
              PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,

              PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
              PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
            ]);
            console.log('Still checking for permissions');
            storeData('permissions', granted);

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

            storeData('permissions', granted);

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
        }

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
