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
const TcpSocket = require('net');
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
} from 'react-native-webrtc';

const CameraScreen = () => {
  const [cameraReady, setCameraReady] = useState(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [updatedInfo, setUpdatedInfo] = useState(null);
  const [wifiP2PInitialized, setWifiP2PInitialized] = useState(false);
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [isClientRunning, setIsClientRunning] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  console.log('Is server running: ', isServerRunning);
  console.log('Is client running: ', isClientRunning);

  const setUpServer = () => {
    console.log('Setting up server...');
    const server = TcpSocket.createServer(async socket => {
      console.log('Client connected');

      const configuration = {
        iceServers: [],
      };

      let localMediaStream;
      const peerConnection = new RTCPeerConnection(configuration);
      peerConnection.createDataChannel('testChannel');

      try {
        localMediaStream = await mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });

        localMediaStream.getTracks().forEach(track => {
          console.log('Stream track: ', track);
          peerConnection.addTrack(track, localMediaStream);
        });

        console.log('MEDIA STREAM: ', localMediaStream);

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.write(
          JSON.stringify({
            type: 'offer',
            sdp: peerConnection.localDescription,
          }),
        );

        const stats = await peerConnection.getStats(null);
        console.log('Stats after setting offer: ', stats);
      } catch (error) {
        console.log('Error when getting media stream: ', error);
      }

      peerConnection.onconnectionstatechange = () => {
        switch (peerConnection.connectionState) {
          case 'connected':
            console.log('WebRtc connection established. Ready to start stream');
            break;
          case 'disconnected':
            console.log('WebRtc connection disconnected');
            break;
          case 'failed':
            console.log('WebRtc connection failed');
            break;
          case 'closed':
            console.log('Connection closed');
            break;
        }
      };

      peerConnection.onicecandidate = event => {
        console.log('Server candidate', event);
        if (event.candidate) {
          console.log(event.candidate);
          socket.write(
            JSON.stringify({type: 'candidate', candidate: event.candidate}),
          );
        }
      };

      peerConnection.onicegatheringstatechange = () => {
        console.log('Ice gathering state: ', peerConnection.iceGatheringState);
      };

      socket.on('data', async data => {
        const receivedData = JSON.parse(data.toString());
        console.log('RAW DATA: ', data.toString());

        try {
          if (receivedData.type === 'answer') {
            const answerDescription = new RTCSessionDescription(
              receivedData.sdp,
            );
            await peerConnection.setRemoteDescription(answerDescription);
            console.log('Remote sdp description set successfully');
            console.log(
              'Peer connection ice gathering state : ',
              peerConnection.iceGatheringState,
            );
          }

          if (receivedData.type === 'candidate') {
            const candidate = new RTCIceCandidate(receivedData.candidate);
            await peerConnection.addIceCandidate(candidate);
            console.log('Ice candidate added successfully');
          }
        } catch (error) {
          console.log('Error handling received data', error);
        }
      });

      socket.on('error', error => {
        console.log('Socket error: ', error.message);
        socket.removeAllListeners();
      });

      socket.on('close', () => {
        console.log('Client disconnected');
        socket.removeAllListeners();
      });
    });

    server.listen(8080, `${updatedInfo.groupOwnerAddress?.hostAddress}`, () => {
      setIsServerRunning(true);
    });
  };

  const setUpClient = () => {
    const configuration = {
      iceServers: [],
    };
    console.log('Setting up client...');
    let remoteDescriptionSet = false;
    const pendingCandidates = [];

    const client = TcpSocket.createConnection(
      {
        host: `${updatedInfo.groupOwnerAddress?.hostAddress}`,
        port: 8080,
      },
      async () => {
        // Only this callback needs to be async
        console.log('Connected to server');
        setIsClientRunning(true);
        const peerConnection = new RTCPeerConnection(configuration);
        peerConnection.createDataChannel('testChannel');

        peerConnection.ontrack = event => {
          console.log('CLIENT STREAM:', event);
          console.log('STREAM', event.streams[0]);
          const receivedStream = event.streams[0];
          setRemoteStream(receivedStream);
        };

        peerConnection.onconnectionstatechange = () => {
          switch (peerConnection.connectionState) {
            case 'connected':
              console.log('WebRtc connection established');
              break;
            case 'disconnected':
              console.log('WebRtc connection disconnected');
              break;
            case 'failed':
              console.log('WebRtc connection failed');
              break;
            case 'closed':
              console.log('Connection closed');
              break;
          }
        };

        peerConnection.onicecandidate = event => {
          console.log('Client candidate', event);
          if (event.candidate) {
            console.log(event.candidate);
            client.write(
              JSON.stringify({type: 'candidate', candidate: event.candidate}),
            );
          }
        };

        peerConnection.onicegatheringstatechange = () => {
          console.log(
            'Ice gathering state: ',
            peerConnection.iceGatheringState,
          );
        };

        client.on('data', async data => {
          const receivedData = JSON.parse(data.toString());
          console.log('RAW RECEIVED DATA', data.toString());

          try {
            if (receivedData.type === 'offer') {
              const offerDescription = new RTCSessionDescription(
                receivedData.sdp,
              );
              await peerConnection.setRemoteDescription(offerDescription);
              remoteDescriptionSet = true;

              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);

              client.write(
                JSON.stringify({
                  type: 'answer',
                  sdp: peerConnection.localDescription,
                }),
              );

              while (pendingCandidates.length) {
                const candidate = pendingCandidates.shift();
                try {
                  await peerConnection.addIceCandidate(candidate);
                  console.log('Ice candidate added successfully');
                } catch (error) {
                  console.log('Failed adding Ice candidate', error);
                }
              }
            }

            if (receivedData.type === 'candidate') {
              const candidate = new RTCIceCandidate(receivedData.candidate);
              if (remoteDescriptionSet) {
                try {
                  await peerConnection.addIceCandidate(candidate);
                  console.log('Ice candidate added successfully');
                } catch (error) {
                  console.log('Failed adding Ice candidate', error);
                }
              } else {
                pendingCandidates.push(candidate);
              }
            }
          } catch (error) {
            console.log('Error handling received data', error);
          }
        });

        client.on('error', error => {
          console.log('Client socket error: ', error.message);
        });

        client.on('close', () => {
          console.log('Connection to server closed');
          client.removeAllListeners();
        });
      },
    );
  };

  useEffect(() => {
    if (wifiP2PInitialized) return;
    let subscription;
    let subscribeConnectionInfo;
    console.log(permission);
    const initWifiP2P = async () => {
      try {
        await initialize();
        setWifiP2PInitialized(true);
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
          console.log('Group formed: ', info.groupFormed);
          console.log('Group owner: ', info.isGroupOwner);
          if (info.groupFormed) {
            setUpdatedInfo(info);
          }
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
  }, [wifiP2PInitialized]);

  useEffect(() => {
    if (!updatedInfo) {
      return;
    }
    if (updatedInfo.isGroupOwner === true && !isServerRunning) {
      setUpServer();
    }
    if (updatedInfo.isGroupOwner === false && !isClientRunning) {
      setUpClient();
    }
  }, [updatedInfo, isServerRunning, isClientRunning]);

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

  const connectToDevice = deviceAddress => {
    connectWithConfig({deviceAddress: deviceAddress, groupOwnerIntent: 15})
      .then(() => {
        console.log('Successfully connected as group Owner.');

        // const peerConnection = new RTCPeerConnection();
        // peerConnection.createDataChannel('testChannel');

        // peerConnection
        //   .createOffer()
        //   .then(offer => peerConnection.setLocalDescription(offer))
        //   .then(() => {
        //     console.log('Local description set. ICE gathering will start.');
        //     peerConnection.onicecandidate = event => {
        //       console.log('EVENT ', event);
        //       if (event.candidate) {
        //         console.log('ICE Candidate found:', event.candidate);
        //       }
        //     };
        //   })
        //   .catch(error => console.error('Error during offer creation:', error));

        // Step 3: Listen for ICE candidates and log them

        // Optionally: Listen for gathering state changes to know when candidates are being gathered
      })
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
        {/* <CameraView style={{height: '80%', width: '100%'}} /> */}
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
        {remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={{width: '100%', height: '100%'}}
            mirror={true}
            objectFit="cover"
            zOrder={0}
          />
        ) : null}
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
