<template>
  <div class="about">
    <div>
      <div>
        <input type="text" id="from" placeholder="Choose a nickname" />
      </div>
      <br />
      <div>
        <button id="connect" onclick="connect();">Connect</button>
        <button id="disconnect" disabled="disabled" onclick="disconnect();">Disconnect</button>
      </div>
      <br />
      <div id="conversationDiv">
        <input type="text" id="text" placeholder="Write a message..." />
        <button id="sendMessage" onclick="sendMessage();">Send</button>
        <p id="response"></p>
      </div>
    </div>
  </div>
</template>

<script>
export default {};
</script>