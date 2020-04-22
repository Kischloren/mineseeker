let app = require('express')()
let http = require('http').createServer(app)
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

/**
 * Search the game where a user is currently playing
 */
wss.search = (userid, remove = false) => {
  let value = -1
  wss.games.forEach((userids, gameid) => {
    userids.forEach((_userid, index) => {
      if (_userid === userid) {
        if (remove) {
          userids.splice(index, 1)
        }
        value = gameid
      }
    })
  })
  return value
}

wss.on('connection', ws => {
  ws.userid = -1
  ws.seed = -1

  console.log('new connection!')

  // A player left (not manually)
  ws.on('close', data => {
    console.log(data, 'disconnection!')
  })

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
        // Send the seed back to the user
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

    // A new game was manually generated (click on generate button)
    if (data.newseed) {
      const seed = parseInt(data.newseed)
      const gameid = wss.search(ws.userid)
      if (gameid > 0) {
        console.log('gameid', gameid, 'seed', seed)
        wss.configs.set(gameid, seed)
        wss.broadcast(gameid, ws.userid, JSON.stringify({ 'seed': seed }))
      }
    }

    // Check if the user is still in a game (e.g. after a refresh)
    if (data.reconnect) {
      if (data._id === wss._id) {
        ws.userid = parseInt(data.reconnect)
        const gameid = wss.search(ws.userid)
        if (gameid > 0) {
          console.log('User already in a game:', ws.userid)
          // Tell the other players that someone refreshed
          wss.broadcast(gameid, ws.userid, JSON.stringify({ 'seed': wss.configs.get(gameid) }))
          // Re-apply the gameid to the current user (avoid -1 value) and the seed (avoid the new one)
          ws.send(JSON.stringify({ 'gameid': gameid, 'seed': wss.configs.get(gameid) }))
        } else {
          console.log('Unknown user:', ws.userid)
          ws.send(JSON.stringify({ 'nosession': 1 }))
        }
      }
    }

    if (data.disconnect) {
      console.log('manual disconnection!', ws.userid)
      wss.search(ws.userid, true)
    }
  })
})

http.listen(3000, () => {
  console.log('Listening on *:3000')
})
