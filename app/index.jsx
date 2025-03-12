import {
  View,
  Text,
  Button,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import React, {useRef, useState, useEffect} from 'react';
import {useCameraPermissions} from 'expo-camera';
import {SafeAreaView} from 'react-native-safe-area-context';
import useSetUpTcp from './customHooks';
import useInitialize from './useInitialize';
import {
  connectWithConfig,
  removeGroup,
  getGroupInfo,
  startDiscoveringPeers,
} from 'react-native-wifi-p2p';
import {useNetInfo} from '@react-native-community/netinfo';
// import {
//   mediaDevices,
//   RTCPeerConnection,
//   RTCSessionDescription,
//   RTCIceCandidate,
// } from 'react-native-webrtc';

import {RTCView} from 'react-native-webrtc';
// import {hideAsync} from 'expo-splash-screen';

const CameraScreen = () => {
  const [permission, requestPermission] = useCameraPermissions();

  const {type, isConnected} = useNetInfo();

  useEffect(() => {
    // console.log('CONNECTION TYPE:', type);
    // console.log('IS CONNECTED:', isConnected);
    if (permission) {
      // hideAsync();
    }
  }, [permission]);

  const {
    updatedInfo,
    setUpdatedInfo,
    isServerRunning,
    isClientRunning,
    connectionTcpRef,
    remoteStream,
    setUpServer,
    setUpClient,
    isStreaming,
    setIsStreaming,
    isLoading,
  } = useSetUpTcp();

  const {discoveredDevices} = useInitialize(setUpdatedInfo);

  console.log('Is server running: ', isServerRunning);
  console.log('Is client running: ', isClientRunning);

  useEffect(() => {
    if (!updatedInfo || !updatedInfo.groupOwnerAddress?.hostAddress) {
      return;
    }
    if (updatedInfo.isGroupOwner === true && !isServerRunning) {
      setUpServer(isStreaming);
      console.log('SET UP AS SERVER:', isStreaming);
      console.log(`${updatedInfo.groupOwnerAddress?.hostAddress}`);
    }
    if (updatedInfo.isGroupOwner === false && !isClientRunning) {
      setTimeout(() => setUpClient(isStreaming), 1000);
      console.log('SET UP AS CLIENT:', isStreaming);
      console.log(`${updatedInfo.groupOwnerAddress?.hostAddress}`);
    }
  }, [updatedInfo, isServerRunning, isClientRunning]);

  const cameraRef = useRef(null);

  const connectToDevice = deviceAddress => {
    connectWithConfig({deviceAddress: deviceAddress, groupOwnerIntent: 15})
      .then(() => {
        console.log('Successfully connected as group Owner.');
        setIsStreaming(true);
      })
      .catch(error => console.error('Something gone wrong. Details: ', error));
  };

  const disconnectFromDevice = () => {
    if (connectionTcpRef.current) {
      try {
        connectionTcpRef.current.end();
      } catch (error) {
        console.error('Error when closing socket: ', error);
      }
    }

    // getGroupInfo()
    //   .then(() => {
    //     removeGroup();
    //   })
    //   .then(() => {
    //     console.log('Wifi P2P sucesfully disconnected');
    //   })
    //   .catch(error => {
    //     console.error(
    //       'Something went wrong when Wifi P2P disconnecting:',
    //       error,
    //     );
    //   });
  };

  // if (!permission) {
  //   // return <Text>Waiting for Camera Permission</Text>;
  // }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={{flex: 1, backgroundColor: '#1C1C1E'}}>
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Text>No access to camera</Text>
          <Button onPress={requestPermission} title="Request Permission" />
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#1C1C1E'}}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        {!remoteStream && isLoading ? (
          <View style={{alignItems: 'center'}}>
            <Text style={{color: 'white', marginBottom: 10}}>
              Waiting for Stream...
            </Text>
            <ActivityIndicator size="large" color="white" />
          </View>
        ) : null}
        {remoteStream ? (
          <View style={{flex: 1, width: '100%'}}>
            <RTCView
              streamURL={remoteStream.toURL()}
              style={{width: '100%', height: '100%'}}
              mirror={false}
              objectFit="cover"
              zOrder={0}
            />
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 50,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <TouchableOpacity
                style={{backgroundColor: 'transparent'}}
                onPress={disconnectFromDevice}>
                <Text style={{color: 'white'}}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Only render the disconnect button or device list when there is no remoteStream
          <View>
            {updatedInfo ? (
              <TouchableOpacity
                style={{backgroundColor: 'transparent'}}
                onPress={disconnectFromDevice}>
                <Text style={{color: 'white'}}>Disconnect</Text>
              </TouchableOpacity>
            ) : (
              <View>
                {discoveredDevices.length > 0 ? (
                  discoveredDevices.map((device, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => connectToDevice(device.deviceAddress)}
                      style={{marginBottom: 10}}>
                      <Text style={{color: 'white', textAlign: 'center'}}>
                        {device.deviceName}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={{color: 'white'}}>No devices found</Text>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default CameraScreen;
