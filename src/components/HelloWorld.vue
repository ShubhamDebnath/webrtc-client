<template>
  <v-container>
    <v-text-field disabled label="myId" v-model="uuid"></v-text-field>
    <!-- <v-btn @click="connect">Connect</v-btn> -->

    <v-text-field label="Destination User" v-model="destUuid" />
    <v-textarea label="message" v-model="message" />
    <v-btn @click="sendMsg">Send Message</v-btn>
    <br />
    <br />
    <v-btn @click="call">Call</v-btn>
    <br />
    <br />
    <v-btn @click="stop(false)">Stop</v-btn>

    <v-container>
      <video ref="videoOutput" autoplay width="640px" height="480px"></video>

      <video ref="videoInput" autoplay width="240px" height="180px"></video>
    </v-container>
  </v-container>
</template>

<script>
import SockJS from "sockjs-client";
import Stomp from "webstomp-client";
import kurentoUtils from "kurento-utils";

export default {
  name: "HelloWorld",

  mounted: function() {
    this.connect();
  },

  data: () => ({
    ws: null,
    message: "",
    uuid: "",
    destUuid: "",
    webRtcPeer: null
  }),

  methods: {
    connect() {
      var socket = new SockJS("/greeting");
      this.ws = Stomp.over(socket);
      var self = this;

      self.ws.connect(
        {},
        function(frame) {
          console.log(frame);

          self.ws.subscribe("/user/queue/register-reply", function(message) {
            self.uuid = message.body;
          });

          self.ws.subscribe("/topic/online", function(message) {
            console.log(message.body);
          });

          self.ws.subscribe("/user/queue/reply", function(message) {
            console.log(message.body);
          });

          self.ws.subscribe("/user/queue/incoming-call", function(message) {
            console.log(message.body);
            self.handleIncoming(message.body);
          });

          self.ws.subscribe("/queue/errors", function(message) {
            console.log("Error " + message.body);
          });

          self.ws.send("/app/register", {}, "register-request");
        },
        function(error) {
          console.log("STOMP error " + error);
        }
      );

      // ws.send("/app/message", {}, JSON.stringify({'from':"random user", 'text':this.message}));
    },

    sendMsg() {
      var self = this;
      const json = JSON.stringify({
        fromUser: self.uuid,
        toUser: self.destUuid,
        text: self.message
      });

      console.log(json);
      self.ws.send("/app/message", json, {});
    },

    handleIncoming(message) {
      console.info("Received message: " + message);
      var parsedMessage = JSON.parse(message);

      switch (parsedMessage.type) {
        case "callResponse":
          this.callResponse(parsedMessage);
          break;
        case "INCOMING_CALL":
          this.incomingCall(parsedMessage);
          break;
        case "startCommunication":
          this.startCommunication(parsedMessage);
          break;
        case "STOP":
          console.info("Communication ended by remote peer");
          this.stop(true);
          break;
        case "iceCandidate":
          this.webRtcPeer.addIceCandidate(parsedMessage.candidate, function(
            error
          ) {
            if (error) return console.error("Error adding candidate: " + error);
          });
          break;
        default:
          console.error("Unrecognized message", parsedMessage);
      }
    },

    call() {
      if (this.destUuid == "") {
        console.log("You must specify the peer name");
        return;
      }

      var self = this;

      console.log(self.$refs["videoInput"]);

      var options = {
        localVideo: self.$refs["videoInput"],
        remoteVideo: self.$refs["videoOutput"],
        onicecandidate: self.onIceCandidate,
        onerror: self.onError
      };
      self.webRtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(
        options,
        function(error) {
          if (error) {
            return console.error(error);
          }
          self.webRtcPeer.generateOffer(self.onOfferCall);
        }
      );
    },

    onOfferCall(error, offerSdp) {
      if (error) return console.error("Error generating the offer");
      console.log("Invoking SDP offer callback function");
      var message = {
        type: "CALL",
        sdpOffer: offerSdp
      };
      this.sendMessage(message);
    },

    callResponse(message) {
      if (message.response != "accepted") {
        console.info("Call not accepted by peer. Closing call");

        this.stop(true);
      } else {
        this.webRtcPeer.processAnswer(message.sdpAnswer, function(error) {
          if (error) return console.error(error);
        });
      }
    },

    onIceCandidate(candidate) {
      // console.log("Local candidate" + JSON.stringify(candidate));

      var message = {
        type: "ON_ICE_CANDIDATE",
        candidate: candidate
      };
      this.sendMessage(message);
    },

    incomingCall(message) {
      var self = this;

      // if (
      //   confirm(
      //     "User " +
      //       message.fromUser +
      //       " is calling you. Do you accept the call?"
      //   )
      // ) {
      self.destUuid = message.fromUser;
      var options = {
        localVideo: self.$refs["videoInput"],
        remoteVideo: self.$refs["videoOutput"],
        onicecandidate: self.onIceCandidate,
        onerror: self.onError
      };
      self.webRtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(
        options,
        function(error) {
          if (error) {
            return console.error(error);
          }
          self.webRtcPeer.generateOffer(self.onOfferIncomingCall);
        }
      );
      // } else {
      //   var response = {
      //     type: "INCOMING_CALL_RESPONSE",
      //     callResponse: "reject",
      //     message: "user declined"
      //   };
      //   self.sendMessage(response);
      //   self.stop(false);
      // }
    },

    onOfferIncomingCall(error, offerSdp) {
      console.log(offerSdp);
      console.error(error);
      // if (error) return console.error("Error generating the offer");
      var response = {
        type: "INCOMING_CALL_RESPONSE",
        callResponse: "accept",
        sdpOffer: offerSdp
      };
      this.sendMessage(response);
    },

    startCommunication(message) {
      this.webRtcPeer.processAnswer(message.sdpAnswer, function(error) {
        if (error) return console.error(error);
      });
    },

    onError(e) {
      console.log("error happened: ");
      console.log(e);
    },

    stop(message) {
      if (this.webRtcPeer) {
        this.webRtcPeer.dispose();
        this.webRtcPeer = null;

        if (!message) {
          var response = {
            type: "STOP"
          };
          this.sendMessage(response);
        }
      }
    },

    sendMessage(message) {
      var simpleMessage = {
        fromUser: this.uuid,
        toUser: this.destUuid,
        text: JSON.stringify(message)
      };
      this.ws.send("/app/call", JSON.stringify(simpleMessage), {});
    }
  }
};
</script>
