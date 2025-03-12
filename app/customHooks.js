import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';

import {useState, useRef} from 'react';

import {
  removeGroup,
  getGroupInfo,
  startDiscoveringPeers,
} from 'react-native-wifi-p2p';

import SendIntentAndroid from 'react-native-send-intent';

const TcpSocket = require('net');

const useSetUpTcp = () => {
  const [updatedInfo, setUpdatedInfo] = useState(null);
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [isClientRunning, setIsClientRunning] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const connectionTcpRef = useRef(null);

  const initiateStream = async (peerConnection, connectionSocket) => {
    setIsLoading(true);
    let mediaStream;
    try {
      // localMediaStream = await mediaDevices.getUserMedia({
      //   audio: true,
      //   video: {facingMode: 'environment'},
      // });

      mediaStream = await mediaDevices.getDisplayMedia({
        audio: true,
        video: true,
      });
      mediaStream.getTracks().forEach(track => {
        console.log('Stream track:', track);
        peerConnection.addTrack(track, mediaStream);
      });

      // console.log('Media stream:', localMediaStream);

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      connectionSocket.write(
        JSON.stringify({
          type: 'offer',
          sdp: peerConnection.localDescription,
        }) + '\n',
      );

      console.log('Offer sent:', peerConnection.localDescription);
    } catch (error) {
      console.log('Error getting media stream:', error);
    }

    peerConnection.addEventListener('icecandidate', event => {
      console.log('ICE Candidate Event:', event);
      if (event.candidate) {
        console.log('ICE Candidate:', event.candidate);
        connectionSocket.write(
          JSON.stringify({type: 'candidate', candidate: event.candidate}) +
            '\n',
        );
      } else {
        console.log('No more ICE candidates.');
      }
    });

    peerConnection.addEventListener('iceconnectionstatechange', event => {
      console.log('ICE Connection State:', peerConnection.iceConnectionState);
      if (peerConnection.iceConnectionState === 'disconnected') {
        connectionSocket.end();
      }
      if (peerConnection.iceConnectionState === 'closed') {
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => {
            track.stop();
            console.log('Track stoped');
          });

          mediaStream = null;
        }
      }
    });

    peerConnection.addEventListener('icegatheringstatechange', () => {
      if (peerConnection.iceGatheringState === 'complete') {
        console.log('ICE gathering complete. Fetching stats...');

        peerConnection
          .getStats(null)
          .then(stats => {
            stats.forEach(report => {
              console.log('Report:', report);
            });
          })
          .catch(error => {
            console.error('Error fetching WebRTC stats:', error);
          });
      }
      console.log('ICE Gathering State:', peerConnection.iceGatheringState);
    });

    peerConnection.addEventListener('connectionstatechange', () => {
      console.log('Connection State:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        setIsLoading(false);
        console.log('STATE IS SET TO FALSE');
        SendIntentAndroid.openCamera().catch(error => {
          console.log('Error when opening camera:', error);
        });
        console.log('OPENING CAMERA FROM STREAMING');
      }
    });

    let buffer = '';
    let pendingCandidates = [];

    connectionSocket.on('data', async data => {
      buffer += data.toString();
      console.log('Received data:', data.toString());

      let boundary = buffer.indexOf('\n');
      while (boundary !== -1) {
        const message = buffer.slice(0, boundary).trim();
        if (message) {
          try {
            const receivedData = JSON.parse(message);

            if (
              receivedData.type === 'answer' &&
              !peerConnection.remoteDescription
            ) {
              const answerDescription = new RTCSessionDescription(
                receivedData.sdp,
              );
              await peerConnection.setRemoteDescription(answerDescription);
              console.log(
                'Remote description set:',
                peerConnection.remoteDescription,
              );

              while (pendingCandidates.length) {
                const candidate = pendingCandidates.shift();
                await peerConnection.addIceCandidate(candidate);
                console.log('ICE candidate added:', candidate);
              }
            }

            if (receivedData.type === 'candidate') {
              const candidate = new RTCIceCandidate(receivedData.candidate);
              if (peerConnection.remoteDescription) {
                await peerConnection.addIceCandidate(candidate);
                console.log('ICE candidate added:', candidate);
              } else {
                console.log('Buffering ICE candidate');
                pendingCandidates.push(candidate);
              }
            }
          } catch (error) {
            console.log('Error handling received data:', error);
          }

          buffer = buffer.slice(boundary + 1);
          boundary = buffer.indexOf('\n');
        }
      }
    });
  };

  const acceptStream = async (peerConnection, connectionSocket) => {
    setIsLoading(true);
    const pendingCandidates = [];
    let buffer = '';
    peerConnection.addEventListener('track', event => {
      console.log('CLIENT STREAM:', event);
      console.log('STREAM', event.streams[0]);
      const receivedStream = event.streams[0];
      setRemoteStream(receivedStream);
    });

    peerConnection.addEventListener('connectionstatechange', event => {
      switch (peerConnection.connectionState) {
        case 'connected':
          console.log('WebRtc connection established');
          setIsLoading(false);
          break;
        case 'disconnected':
          console.log('WebRtc connection disconnected');
          break;
        case 'failed':
          console.log('WebRtc connection failed');
          peerConnection.close();

          break;
        case 'closed':
          console.log('Connection closed');
          break;
      }
    });

    peerConnection.addEventListener('icecandidate', event => {
      console.log('Client candidate', event);
      if (event.candidate) {
        console.log(event.candidate);
        connectionSocket.write(
          JSON.stringify({
            type: 'candidate',
            candidate: event.candidate,
          }) + '\n',
        );
      }
    });

    peerConnection.addEventListener('iceconnectionstatechange', event => {
      console.log('ICE Connection State:', peerConnection.iceConnectionState);
      if (peerConnection.iceConnectionState === 'disconnected') {
        connectionSocket.end();
      }
    });

    peerConnection.addEventListener('icegatheringstatechange', event => {
      if (peerConnection.iceGatheringState === 'complete') {
        console.log('ICE gathering complete. Fetching stats...');

        peerConnection
          .getStats(null)
          .then(stats => {
            stats.forEach(report => {
              console.log('Report:', report);
            });
          })
          .catch(error => {
            console.error('Error fetching WebRTC stats:', error);
          });
      }

      console.log('Ice gathering state: ', peerConnection.iceGatheringState);
    });

    connectionSocket.on('data', async data => {
      console.log('RAW RECEIVED DATA', data.toString());
      buffer += data.toString();
      let boundary = buffer.indexOf('\n');
      while (boundary !== -1) {
        const message = buffer.slice(0, boundary).trim();
        try {
          const receivedData = JSON.parse(message);
          if (
            receivedData.type === 'offer' &&
            !peerConnection.remoteDescription
          ) {
            const offerDescription = new RTCSessionDescription(
              receivedData.sdp,
            );
            await peerConnection.setRemoteDescription(offerDescription);

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            connectionSocket.write(
              JSON.stringify({
                type: 'answer',
                sdp: peerConnection.localDescription,
              }) + '\n',
            );
            console.log('ANSWER', peerConnection.localDescription);

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
            if (peerConnection.remoteDescription) {
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
        buffer = buffer.slice(boundary + 1);
        boundary = buffer.indexOf('\n');
      }
    });
  };

  const setUpServer = isStreaming => {
    console.log('Setting up server...');

    // sends offer if isStreaming, accepts answer if it's not

    let server = TcpSocket.createServer(async socket => {
      console.log('Client connected');
      connectionTcpRef.current = socket;

      const configuration = {
        iceServers: [], // No STUN/TURN for local Wi-Fi Direct
        iceTransportPolicy: 'host', // Restrict to host candidates
      };

      let peerConnection = new RTCPeerConnection(configuration);
      // const candidateForClient = new RTCIceCandidate({
      //   candidate: 'candidate:1 1 udp 2122260223 192.168.49.1 5000 typ host',
      //   sdpMid: '0',
      //   sdpMLineIndex: 0,
      // });

      peerConnection.createDataChannel('testChannel');
      if (isStreaming) {
        initiateStream(peerConnection, socket);
      } else {
        acceptStream(peerConnection, socket);
      }
      socket.on('error', error => {
        console.log('Socket error:', error.message);
      });

      socket.on('close', () => {
        console.log('SOCKET ON CLOSE');
        if (peerConnection) {
          peerConnection.close();
          peerConnection = null;
        }
        connectionTcpRef.current = null;
        server.close();
        setUpdatedInfo(null);
        setIsServerRunning(false);
        setIsStreaming(false);
        setRemoteStream(null);
        setIsLoading(false);

        getGroupInfo()
          .then(() => {
            removeGroup();
            console.log('GROUP REMOVED FROM SERVER');
          })
          .then(() => {
            console.log('Wifi P2P sucesfully disconnected');
            setTimeout(() => {
              startDiscoveringPeers();
              console.log('STARTED DISCOVERING DEVICES...');
            }, 2000);
          })
          .catch(error => {
            console.error(
              'Something went wrong when Wifi P2P disconnecting:',
              error,
            );
          });
      });
    });

    server.listen(8080, `${updatedInfo.groupOwnerAddress?.hostAddress}`, () => {
      console.log(
        'Server listening on:',
        updatedInfo.groupOwnerAddress?.hostAddress,
      );
      setIsServerRunning(true);
    });
  };

  const setUpClient = isStreaming => {
    const configuration = {
      iceServers: [],
      iceTransportPolicy: 'all',
    };
    console.log(
      'Setting up client...',
      updatedInfo.groupOwnerAddress?.hostAddress,
    );

    let client = TcpSocket.createConnection(
      {
        host: `${updatedInfo.groupOwnerAddress?.hostAddress}`,
        port: 8080,
      },
      async () => {
        // Only this callback needs to be async
        console.log('Connected to server');
        connectionTcpRef.current = client;

        setIsClientRunning(true);
        let peerConnection = new RTCPeerConnection(configuration);
        peerConnection.createDataChannel('testChannel');
        if (!isStreaming) {
          acceptStream(peerConnection, client);
        } else {
          initiateStream(peerConnection, client);
        }

        client.on('error', error => {
          console.log('Client socket error: ', error.message);
        });

        client.on('close', () => {
          console.log('CLIENT ON CLOSE');
          if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
          }
          client.destroy();
          client = null;
          connectionTcpRef.current = null;
          setUpdatedInfo(null);
          setIsClientRunning(false);
          setIsStreaming(false);
          setRemoteStream(null);
          setIsLoading(false);
          setTimeout(() => {
            startDiscoveringPeers();
            console.log('STARTED DISCOVERING DEVICES...');
          }, 2000);
        });
      },
    );
  };

  return {
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
  };
};

export default useSetUpTcp;
