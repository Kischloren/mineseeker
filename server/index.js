var app = require('express')()
var http = require('http').createServer(app)
let WSServer = require('ws').Server
let WS = require('ws')

// Create web socket server on top of a regular http server
let wss = new WSServer({
  server: http
})

wss._id = 10251985
wss.configs = new Map() // [gameid, seed]
wss.games = new Map() // [gameid, [userid1, userid2]]

http.on('request', app)

wss.broadcast = (gameid, userid, message) => {
  const userids = wss.games.get(gameid)
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

  console.log('connection!')

  ws.on('close', data => {
    console.log(data, 'disconnect!')
  })

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
        ws.userid = parseInt(data.create)

        const gameid = new Date().getTime()
        wss.configs.set(gameid, data.seed)
        wss.games.set(gameid, [ws.userid])
        ws.send(JSON.stringify({ 'gameid': gameid }))
      }
    }

    // Join a game session
    if (data.join) {
      if (data._id === wss._id) {
        ws.userid = parseInt(data.join)

        const gameid = parseInt(data.gameid)

        // Add the user in the game
        wss.games.get(gameid).push(ws.userid)
        // Get the seed
        const seed = wss.configs.get(gameid)

        // Send the seed back to the use
        ws.send(JSON.stringify({ 'seed': seed }))
      }
    }

    // Dispatch an action
    if (data.action) {
      const gameid = parseInt(data.gameid)
      const userid = parseInt(data.userid)
      if (data.action.down) {
        wss.broadcast(gameid, userid, JSON.stringify({ 'down': data.action.down }))
      }
      if (data.action.secondary) {
        wss.broadcast(gameid, userid, JSON.stringify({ 'down': data.action.secondary, 'secondary': 1 }))
      }
    }

    // Check if the user is still in a game (after a refresh)
    if (data.check) {
      if (data._id === wss._id) {
        ws.userid = parseInt(data.check)
        wss.games.forEach((userids, gameid) => {
          userids.forEach(_userid => {
            if (_userid === ws.userid) {
              console.log('User already in a game:', ws.userid)
              // Tell the other players that someone refreshed
              wss.broadcast(gameid, ws.userid, JSON.stringify({ 'seed': wss.configs.get(gameid) }))
              // Re-apply the gameid to the current user
              ws.send(JSON.stringify({ 'gameid': gameid }))
            }
          })
        })
      }      
    }
  })
})

http.listen(3000, () => {
  console.log('Listening on *:3000')
})
