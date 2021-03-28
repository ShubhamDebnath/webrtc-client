<template>
  <v-container>
    <v-text-field disabled label="myId" v-model="uuid"></v-text-field>

    <v-text-field label="Destination User" v-model="destUuid" />
    <v-textarea label="message" v-model="message" />
    <v-btn @click="sendTextMessage">Send Message</v-btn>
    <br />
    <br />
    <v-btn @click="call">Call</v-btn>
    <br />
    <br />
    <v-btn @click="stop(false)">Stop</v-btn>
    <br />

    <v-select
      label="Select camera"
      :value="camera"
      :items="cameraList"
      item-text="label"
      @change="selectCamera"
      dense
      return-object
    />

    <v-select
      label="Select microphone"
      :value="microphone"
      :items="microphoneList"
      item-text="label"
      @change="selectMic"
      dense
      return-object
    />

    <v-select
      label="Select speaker"
      :value="speaker"
      :items="speakerList"
      item-text="label"
      @change="selectSpeaker"
      dense
      return-object
    />

    <v-container>
      <video ref="videoOutput" autoplay width="640px" height="480px"></video>

      <video ref="videoInput" autoplay width="240px" height="180px"></video>
    </v-container>
  </v-container>
</template>

<script>
import SockJS from "sockjs-client";
import Stomp from "webstomp-client";

export default {
  name: "P2pCall",
  mounted: function() {
    this.connectSignalling();
    this.prepareRTC();
    this.prepareDevices();
  },

  data: () => ({
    signallingChannel: null,
    message: "",
    uuid: "",
    destUuid: "",
    rtcPeerConnection: null,
    onlineFriends: [],
    configuration: {
      iceServers: [
        // {
        //   urls: "stun:stun.l.google.com:19302"
        // },
        // {
        //   urls: "turn:192.168.182.128:3478?transport=udp",
        //   credential: "turnServer",
        //   username: "root"
        // }
        // {
        //   urls: "turn:192.168.182.128:3478?transport=tcp",
        //   credential: "turnServer",
        //   username: "root"
        // }
      ]
    },

    cameraList: [],
    microphoneList: [],
    speakerList: [],

    camera: null,
    microphone: null,
    speaker: null
  }),

  watch: {
    camera(newVal, oldVal) {
      console.log(newVal);
      console.log(oldVal);
    }
  },

  methods: {
    connectSignalling() {
      var socket = new SockJS("/greeting");
      this.signallingChannel = Stomp.over(socket);
      var self = this;

      self.signallingChannel.connect(
        {},
        function(frame) {
          console.log(frame);

          self.signallingChannel.subscribe(
            "/user/queue/register-reply",
            function(message) {
              self.uuid = message.body;
            }
          );

          self.signallingChannel.subscribe("/topic/online", function(message) {
            console.log(message.body);
            self.onlineFriends = message.body;
          });

          self.signallingChannel.subscribe("/user/queue/reply", function(
            message
          ) {
            console.log(message.body);
          });

          self.signallingChannel.subscribe(
            "/user/queue/incoming-call",
            function(message) {
              console.log(message.body);
              self.handleIncoming(message.body);
            }
          );

          self.signallingChannel.subscribe("/queue/errors", function(message) {
            console.log("Error " + message.body);
          });

          self.signallingChannel.send("/app/register", {}, "register-request");
        },
        function(error) {
          console.log("STOMP error " + error);
        }
      );

      // signallingChannel.send("/app/message", {}, JSON.stringify({'from':"random user", 'text':this.message}));
    },

    prepareRTC() {
      var self = this;
      self.peerConnection = new RTCPeerConnection(self.configuration);

      self.peerConnection.addEventListener("icecandidate", event => {
        if (event.candidate) {
          self.sendMessage({
            type: "ICE_CANDIDATE",
            candidate: event.candidate
          });
        }
      });

      self.peerConnection.addEventListener("connectionstatechange", event => {
        console.log("Connected state changed ");
        console.log(event);
        if (self.peerConnection.connectionState === "connected") {
          console.log(event);
          console.log("Peers connected");
        }
      });

      self.peerConnection.addEventListener("addstream", event => {
        self.$refs["videoOutput"].srcObject = event.stream;
      });

      navigator.mediaDevices.addEventListener("devicechange", event => {
        console.log(event);
        self.prepareDevices();
      });

      self.peerConnection.addEventListener("negotiationneeded", event => {
        console.log(event);
        self.sendOffer();
      });
    },

    async prepareDevices() {
      var self = this;

      self.cameraList = await self.getConnectedDevices("videoinput");
      self.microphoneList = await self.getConnectedDevices("audioinput");
      self.speakerList = await self.getConnectedDevices("audiooutput");

      self.camera = self.cameraList[0];
      self.microphone = self.microphoneList[0];
      self.speaker = self.speakerList[0];
    },

    async getConnectedDevices(type) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return await devices.filter(device => device.kind === type);
    },

    async selectCamera(val) {
      console.log(val);
      this.camera = val;

      const stream = await this.getMediaStream(this.camera.deviceId);
      await this.peerConnection.addStream(stream);

      this.$refs["videoInput"].srcObject = stream;
    },

    selectMic(val) {
      console.log(val);
      this.microphone = val;
    },

    selectSpeaker(val) {
      console.log(val);
      this.speaker = val;
    },

    async getMediaStream(deviceId) {
      const constraints = {
        audio: false,
        video: {
          deviceId: deviceId
        }
      };

      return await navigator.mediaDevices.getUserMedia(constraints);
    },

    sendTextMessage() {
      var self = this;
      const json = JSON.stringify({
        fromUser: self.uuid,
        toUser: self.destUuid,
        text: self.message
      });

      console.log(json);
      self.signallingChannel.send("/app/message", json, {});
    },

    sendMessage(message) {
      var simpleMessage = {
        fromUser: this.uuid,
        toUser: this.destUuid,
        text: JSON.stringify(message)
      };
      this.signallingChannel.send(
        "/app/call",
        JSON.stringify(simpleMessage),
        {}
      );
    },

    handleIncoming(message) {
      console.log("Received message: " + message);
      var parsedMessage = JSON.parse(message);
      var text = JSON.parse(parsedMessage.text);
      console.log("Text: " + text);
      var self = this;

      switch (text.type) {
        case "OFFER":
          self.handleOffer(text, parsedMessage.fromUser);
          break;
        case "ANSWER":
          self.handleAnswer(text);
          break;
        case "ICE_CANDIDATE":
          self.handleCandidate(text);
          break;
        default:
          console.error("Wrong type of message sent");
      }
    },

    // Caller creates an offer
    // and send it to callee
    async call() {
      var self = this;

      console.log("Calling: " + this.destUuid);
      const stream = await self.getMediaStream(self.camera.deviceId);
      await self.peerConnection.addStream(stream);
      self.$refs["videoInput"].srcObject = stream;

      self.sendOffer();
    },

    async sendOffer() {
      var self = this;

      const offer = await self.peerConnection.createOffer();
      await self.peerConnection.setLocalDescription(offer);
      self.sendMessage({ type: "OFFER", offer: offer });
    },

    // Handle Offer from caller
    async handleOffer(message, fromUser) {
      console.log("Recieved Offer: " + message.offer);
      console.log("From: " + fromUser);
      var self = this;
      self.destUuid = fromUser;

      self.peerConnection.setRemoteDescription(
        new RTCSessionDescription(message.offer)
      );

      const stream = await self.getMediaStream(self.camera.deviceId);
      await self.peerConnection.addStream(stream);

      const answer = await self.peerConnection.createAnswer();
      await self.peerConnection.setLocalDescription(answer);
      self.sendMessage({ type: "ANSWER", answer: answer });

      self.$refs["videoInput"].srcObject = stream;
    },

    // Handle Answer from callee
    async handleAnswer(message) {
      var self = this;
      console.log("Recieved Answer: " + message.answer);
      const remoteDesc = new RTCSessionDescription(message.answer);
      await self.peerConnection.setRemoteDescription(remoteDesc);
    },

    // Listen for remote ICE candidates and add them to the local RTCPeerConnection
    async handleCandidate(message) {
      console.log("Recieved Candidate: " + message.candidate);
      try {
        await this.peerConnection.addIceCandidate(message.candidate);
      } catch (e) {
        console.error("Error adding received ice candidate", e);
      }
    }
  }
};
</script>