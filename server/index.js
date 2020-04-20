var app = require('express')()
var http = require('http').createServer(app)
let WSServer = require('ws').Server
let WS = require('ws')

// Create web socket server on top of a regular http server
let wss = new WSServer({
  server: http
})

wss.userids = []
wss.seed = -1

http.on('request', app)

wss.broadcast = (userid, message) => {
  wss.clients.forEach(client => {
    if (client.readyState === WS.OPEN) {
      if (client.userid !== userid) {
        client.send(message)
      }
    }
  })
}

wss.on('connection', ws => {
  ws.userid = -1
  ws.seed = -1
  ws.on('message', message => {
    console.log(`received: ${message}`)
    let data = JSON.parse(message)

    if (data.join) {
      ws.userid = data.join
      wss.userids.push(data.join)
      if (wss.userids.length === 1) {
        wss.seed = data.seed
      } else {
        wss.broadcast(data.userid, JSON.stringify({ 'seed': wss.seed }))
      }
    }

    if (data.action) {
      if (data.action.down) {
        wss.broadcast(data.userid, JSON.stringify({ 'down': data.action.down }))
      }
      if (data.action.secondary) {
        wss.broadcast(data.userid, JSON.stringify({ 'down': data.action.secondary, 'secondary': 1 }))
      }
    }
  })
})

http.listen(3000, () => {
  console.log('Listening on *:3000')
})
