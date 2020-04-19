var app = require('express')()
var http = require('http').createServer(app)
let WSServer = require('ws').Server
let WS = require('ws')

// Create web socket server on top of a regular http server
let wss = new WSServer({
  server: http
})

wss.userId = []
wss.seed = -1

http.on('request', app)

wss.broadcast = (userid, message) => {
  wss.clients.forEach(client => {
    if (client.readyState === WS.OPEN) {
      if (client.userId !== userid) {
        client.send(message)
      }
    }
  })
}

wss.on('connection', ws => {
  ws.userId = -1
  ws.seed = -1
  ws.on('message', message => {
    console.log(`received: ${message}`)
    let data = JSON.parse(message)
    if (data.join) {
      ws.userId = data.join
      wss.userId.push(data.join)
      if (wss.userId.length === 1) {
        wss.seed = data.seed
      } else {
        wss.broadcast(data.userid, JSON.stringify({ 'seed': wss.seed }))
      }
    }
    if (data.down) {
      wss.broadcast(data.userid, JSON.stringify({ 'down': data.down }))
    }
    if (data.right) {
      wss.broadcast(data.userid, JSON.stringify({ 'down': data.right, 'right': 1 }))
    }

  })
})

http.listen(3000, () => {
  console.log('Listening on *:3000')
})
