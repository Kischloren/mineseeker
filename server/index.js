var app = require('express')()
var http = require('http').createServer(app)
let WSServer = require('ws').Server
let WS = require('ws')

// Create web socket server on top of a regular http server
let wss = new WSServer({
  server: http
})

wss._id = 10251985
wss.games = new Map() // [gameid, seed]
wss.players = new Map() // [gameid, [userid1, userid2]]

http.on('request', app)

wss.broadcast = (gameid, userid, message) => {
  const userids = wss.players.get(gameid)
  if (userids !== undefined) {
    userids.forEach(_userid => {
      wss.clients.forEach(client => {
        if (client.readyState === WS.OPEN) {
          if (client.userid === _userid && client.userid !== userid) {
            client.send(message)
          }
        }
      })
    })
  }
}

wss.on('connection', ws => {
  ws.userid = -1
  ws.seed = -1

  // TODO:
  // - the deconnection
  // - the end of a game (failure or success)
  // - the refresh

  ws.on('message', message => {
    console.log(`received: ${message}`)
    let data = JSON.parse(message)

    // Create a game session
    if (data.create) {
      if (data._id === wss._id) {
        ws.userid = data.create

        const gameid = new Date().getTime()
        wss.games.set(gameid, data.seed)
        wss.players.set(gameid, [data.create])
        ws.send(JSON.stringify({ 'gameid': gameid }))
      }
    }

    // Join a game session
    if (data.join) {
      if (data._id === wss._id) {
        ws.userid = data.join

        const gameid = parseInt(data.gameid)

        // Add the user in the game
        wss.players.get(gameid).push(data.join)
        // Get the seed
        const seed = wss.games.get(gameid)

        // Send the seed back to the use
        ws.send(JSON.stringify({ 'seed': seed }))
      }
    }

    // Dispatch an action
    if (data.action) {
      const gameid = parseInt(data.gameid)
      if (data.action.down) {
        wss.broadcast(gameid, data.userid, JSON.stringify({ 'down': data.action.down }))
      }
      if (data.action.secondary) {
        wss.broadcast(gameid, data.userid, JSON.stringify({ 'down': data.action.secondary, 'secondary': 1 }))
      }
    }
  })
})

http.listen(3000, () => {
  console.log('Listening on *:3000')
})
