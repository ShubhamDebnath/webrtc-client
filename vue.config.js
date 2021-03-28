var fs = require('fs');

module.exports = {
  "devServer": {
    "port": 9000,
    "https": {
      "key": fs.readFileSync('./certs/privkey.pem'),
      "cert": fs.readFileSync('./certs/cert.pem')
    },
    "proxy": {
      "/": {
        "target": "https://192.168.0.101:9080",
        "ws": true,
        "secure": false,
        "changeOrigin": true
      }
    },
    "overlay": {
      "warnings": true,
      "errors": true
    }
  },
  "transpileDependencies": [
    "vuetify"
  ],
  publicPath: "./"
}
