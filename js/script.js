/**
 * Game main class
 */
class Game {
  constructor () {
    if (!this.divName) {
      this.divName = 'inner'
    }

    this.settings = {
      alreadyGenerated: false,
      debug: true,
      version: '1.0.0',
      squares: [], // the data
      cells: [], // the graphical elements
      difficulty: 10,
      numberOfLines: 8,
      numberOfCols: 8,
      seed: -1,
      totalSquares: 64,
      multiplayer: {
        _id: 10251985,
        active: true,
        connected: false,
        gameid: -1,
        url: 'ws://localhost:3000',
        userid: -1,
        ws: null
      },
      game: {
        elapsedTime: 0,
        firstClick: true,
        flagged: 0,
        goodFlagged: 0,
        mouseDownStartTime: 0,
        remaining: 0,
        terminated: false,
        timerId: 0
      }
    }

    /**
     * Add a log entry in the console
     * @param message the message to see in the console
     * @param value the value to see in the console
     */
    const debug = (message, value) => {
      if (this.settings.debug) {
        console.log(message, value)
      }
    }

    /**
     * Generate the game
     */
    this.generate = () => {
      initSeed()

      // Multiplayer stuff
      if (!this.settings.alreadyGenerated && this.settings.multiplayer.active && !this.settings.multiplayer.connected) {
        Utils.el('button_generate').addEventListener('mousedown', e => {
          e.preventDefault()
          this.settings.seed = -1
          initSeed()
          generate(true)
          if (this.settings.multiplayer.connected) {
            newSeed()
            // Toggle UI elements
            // Utils.toggleMultiplayerUI()
          }
        })
        Utils.el('button_create').addEventListener('mousedown', e => {
          createMultiplayer()
          // Toggle UI elements
          Utils.toggleMultiplayerUI()
        })
        Utils.el('button_join').addEventListener('mousedown', e => {
          joinGame(Utils.el('input_game_id').value)
          // Toggle UI elements
          Utils.toggleMultiplayerUI()
        })
        Utils.el('button_disconnect').addEventListener('mousedown', e => {
          disconnect()
          // Toggle UI elements
          Utils.toggleMultiplayerUI(false)
          Utils.el('input_game_id').value = ''
          Utils.el('input_user_id').value = ''
        })

        const userid = Utils.el('input_user_id').value

        // If something is specified in the user id (hidden)field
        if (userid !== undefined && userid !== null && userid !== '' && userid > 0) {
          this.settings.multiplayer.userid = userid
        } else {
          Utils.el('input_user_id').value = this.settings.multiplayer.userid = new Date().getTime()
        }

        initSocket()
      }
      
      initData()
      initGraphics()
      notify()

      this.settings.alreadyGenerated = true;
    }

    /**
     * Check if a cell is valid on the given line and column
     * @param line the line
     * @param column the column
     */
    const cellIsValid = (line, column) => {
      return (line >= 0 && column >= 0 && line < this.settings.numberOfLines && column < this.settings.numberOfCols)
    }

    /**
     * Triggered on the mousedown/touchstart events
     * @param cell the cell on which the mouse/touch down events are triggered
     * @param e the mouse/touch down events
     */
    const mouseDownEvent = (cell, e, callback) => {
      if (this.settings.game.terminated === false) {
        if (e.which === 3) {
          updateCell(cell)
          if (callback) {
            callback()
          }
        } else if (e.which === 0 || e.which === 1) {
          this.settings.game.mouseDownStartTime = new Date().getTime()
        }
        notify()
      }
    }

    /**
     * Triggered on the mousedown/touchend events
     * @param cell the cell on which the mouse/touch up events are triggered
     * @param e the mouse/touch up events
     */
    const mouseUpEvent = (cell, e, callback) => {
      if (this.settings.game.terminated === false) {
        const cellPos = Utils.cellPos(cell)
        if (this.settings.game.firstClick === true) {
          startTimer()
          this.settings.game.firstClick = false
        }
        if (e.which === 0 || e.which === 1) {
          if (new Date().getTime() >= (this.settings.game.mouseDownStartTime + 200)) {
            updateCell(cell)
          } else if (cell.className === 'not-revealed') {
            cell.className = 'revealed'
            this.settings.game.remaining--
            if (this.settings.squares[(cellPos.i * this.settings.numberOfCols + cellPos.j)].isMined === false) {
              revealSquare(cellPos.i, cellPos.j)
              if (this.settings.game.remaining === 0) {
                this.settings.game.terminated = true
              }
            } else {
              cell.setAttribute('data-content', 'X')
              cell.className += ' mined'
              this.settings.game.terminated = true
              clearInterval(this.settings.game.timerId)
              // Reveal the mines
              revealMines(cell)
            }
          }
          if (callback) {
            callback(e.which)
          }
        }

        notify()
      }
    }

    /**
     * Init the socket for multiplayer mode
     */
    const initSocket = () => {
      let ws = new WebSocket(this.settings.multiplayer.url)
      this.settings.multiplayer.ws = ws

      ws.onopen = () => {
        debug('connected!', this.settings.multiplayer.userid)
        this.settings.multiplayer.connected = true
        // Try to reconnect the user to a session
        reconnect()
      }

      ws.onmessage = message => {
        const data = JSON.parse(message.data)
        debug('Data received:', data)

        // A game was created
        if (data.gameid) {
          Utils.el('input_game_id').value = data.gameid
          this.settings.multiplayer.gameid = data.gameid
          if (!data.seed) {
            debug('New game created', data.gameid)
            generate(true)
            // Disable UI elements
            Utils.toggleMultiplayerUI()
          }
        }

        // An action was performed
        if (data.down) {
          this.settings.game.mouseDownStartTime = new Date().getTime()
          const cell = Utils.el(data.down)
          if (data.secondary) { // right click
            mouseDownEvent(cell, { which: 3 })
          } else { // left click
            mouseUpEvent(cell, { which: 0 })
          }
        }

        if (data.nosession) {
          debug('The user was not previously connected to a session', '-')
        }

        // Re-apply the seed
        if (data.seed) {
          debug('Re-apply the seed', data.seed)
          this.settings.seed = data.seed
          if (data.gameid) {
            // Disable UI elements
            Utils.toggleMultiplayerUI()
          }
          generate(true)
        }
      }
    }

    /**
     * Apply the seed to the generator
     */
    const initSeed = () => {
      if (this.settings.seed === -1) {
        this.settings.seed = Math.floor(Math.random() * 2147483647)
      }
      Utils.el('label_seed').innerHTML = this.settings.seed
    }

    /**
     * Init the data of the game (settings, squares)
     */
    const initData = () => {
      // Get the difficulty
      const select = Utils.el('difficulty')
      this.settings.difficulty = parseInt(select.options[select.selectedIndex].value)

      // Generate an empty grid with the selected difficulty
      this.settings.cells = []
      switch (this.settings.difficulty) {
        case 10:
          this.settings.numberOfLines = this.settings.numberOfCols = 8
          break
        case 40:
          this.settings.numberOfLines = this.settings.numberOfCols = 16
          break
        case 99:
          this.settings.numberOfLines = 16
          this.settings.numberOfCols = 30
      }

      while (this.settings.cells.length < this.settings.numberOfLines) {
        this.settings.cells.push([])
      }

      // Total number of squares
      this.settings.totalSquares = this.settings.numberOfLines * this.settings.numberOfCols
      // Number of squares that must be revealed to win
      this.settings.game.remaining = this.settings.totalSquares - this.settings.difficulty
      // Initialize the game's params
      this.settings.game.terminated = false
      this.settings.game.elapsedTime = 0
      this.settings.game.firstClick = true
      this.settings.game.flagged = 0
      this.settings.game.mouseDownStartTime = 0
      Utils.el('timer').innerHTML = '000'

      // Generate the squares
      let squares = []
      for (let i = 0; i < this.settings.totalSquares; i++) {
        let isMined = true
        if (i > (this.settings.difficulty - 1)) {
          isMined = false
        }
        squares.push(new Square(isMined, 0))
      }
      this.settings.squares = []
      // Shuffle the array

      // Generate pseudo random numbers
      // See https://stackoverflow.com/questions/28256506/predictable-javascript-array-shuffle
      // and https://en.wikipedia.org/wiki/Xorshift
      const xorShift = seed => {
        // Initialize the base seeds (trivial)
        const baseSeeds = [123456, 654321, 456789, 987654]

        let [x, y, z, w] = baseSeeds
        const random = () => {
          const t = x ^ (x << 11)
          ;[x, y, z] = [y, z, w]
          w = w ^ (w >> 19) ^ (t ^ (t >> 8))
          return w / 0x7fffffff // 2147483647
        }

        // apply the seed
        ;[x, y, z, w] = baseSeeds.map(i => i + parseInt(seed))
        // randomize the initial state
        ;[x, y, z, w] = [0, 0, 0, 0].map(() => Math.round(random() * 1e16))

        return random
      }

      // Shuffle using configurable random function
      const shuffle = (array, random = Math.random) => {
        let last = array.length
        let t
        let i

        while (last) {
          i = Math.floor(random() * last--)
          t = array[last]
          array[last] = array[i]
          array[i] = t
        }

        return array
      }

      if (this.settings.seed > 0) {
        this.settings.squares = shuffle(squares, xorShift(this.settings.seed))
      } else {
        this.settings.squares = shuffle(squares)
      }

      squares = []

      // Get the mines around each square
      for (let i = 0; i < this.settings.numberOfLines; i++) {
        for (let j = 0; j < this.settings.numberOfCols; j++) {
          let currentSquare = this.settings.squares[(i * this.settings.numberOfCols + j)]
          if (currentSquare.isMined === false) {
            const neighbors = Utils.neighbors(i, j)
            let content = 0
            for (let k = 0; k < 8; k++) {
              const line = neighbors[k][0]
              const col = neighbors[k][1]
              if (cellIsValid(line, col) === true) {
                const currentNeighbor = this.settings.squares[(line * this.settings.numberOfCols + col)]
                if (currentNeighbor.isMined === true) {
                  content++
                }
              }
            }
            currentSquare.content = content
          }
        }
      }
    }

    /**
     * Create the graphical elements
     */
    const initGraphics = () => {
      let div = Utils.el(this.divName)
      let table = Utils.ce('table')
      div.appendChild(table)
      for (let i = 0; i < this.settings.numberOfLines; i++) {
        let row = table.insertRow(0)
        for (let j = 0; j < this.settings.numberOfCols; j++) {
          let cell = row.insertCell(0)
          cell.className = 'not-revealed'
          cell.id = 'i' + i + 'j' + j
          cell.setAttribute('i', i)
          cell.setAttribute('j', j)
          cell.addEventListener('contextmenu', e => {
            e.preventDefault()
            return false
          }, false)
          cell.addEventListener('mousedown', e => {
            e.preventDefault()
            mouseDownEvent(cell, e, () => {
              if (this.settings.multiplayer.connected) {
                sendAction({ 'secondary': '' + cell.id })
              }
            })
          })
          cell.addEventListener('mouseup', e => {
            e.preventDefault()
            mouseUpEvent(cell, e, () => {
              if (this.settings.multiplayer.connected) {
                sendAction({ 'down': '' + cell.id })
              }
            })
          })
          cell.addEventListener('touchstart', e => {
            e.preventDefault()
            mouseDownEvent(cell, e)
          })
          cell.addEventListener('touchend', e => {
            e.preventDefault()
            mouseUpEvent(cell, e)
          })
          this.settings.cells[i].push(cell)
        }
      }
    }

    /**
     * Notify something to the player (number of remaining mines, game over)
     */
    const notify = () => {
      Utils.el('notify').innerHTML = ''
      Utils.el('mines').innerHTML = this.settings.difficulty - this.settings.game.flagged
      if (this.settings.game.terminated === true) {
        clearInterval(this.settings.game.timerId)
        Utils.el('notify').innerHTML = 'Game finished.'
      }
    }

    /**
     * Reveal all the mines when a cell that contains a mine is clicked
     * @param cell the cell that contains a mine
     */
    const revealMines = cell => {
      const cellPos = Utils.cellPos(cell)
      for (let i = 0; i < this.settings.numberOfLines; i++) {
        for (let j = 0; j < this.settings.numberOfCols; j++) {
          // Don't modify the style of the clicked cell
          if (i === cellPos.i && j === cellPos.j) {
            continue
          }
          const isMined = this.settings.squares[(i * this.settings.numberOfCols + j)].isMined
          let cell = this.settings.cells[i][j]
          // Reveal the mistakes (i.e. flagged squares that not contain a mine)
          if (isMined === false && this.settings.cells[i][j].className === 'not-revealed-flag') {
            cell.setAttribute('data-content', 'X')
            cell.className = 'revealed number-mines-3'
          }
          // Reveal the mines
          if (isMined === true && this.settings.cells[i][j].className !== 'not-revealed-flag') {
            cell.setAttribute('data-content', 'X')
            cell.className = 'revealed'
          }
        }
      }
    }

    /**
     * Reveal a square.
     * If empty, reveal squares around and search another empty squares (recursively)
     * @param line the line where the clicked cell is
     * @param col the column where the clicked cell is
     */
    const revealSquare = (line, col) => {
      let cell = this.settings.cells[line][col]
      cell.className = 'revealed'
      const content = this.settings.squares[(line * this.settings.numberOfCols + col)].content
      if (content !== 0) {
        cell.setAttribute('data-content', content)
        cell.className += ' number-mines-' + content
      } else {
        const neighbors = Utils.neighbors(line, col)
        for (let k = 0; k < 8; k++) {
          const neighborLine = neighbors[k][0]
          const neighborCol = neighbors[k][1]
          if (cellIsValid(neighborLine, neighborCol) === true &&
            this.settings.cells[neighborLine][neighborCol].className === 'not-revealed') {
            this.settings.game.remaining--
            revealSquare(neighborLine, neighborCol)
          }
        }
      }
    }

    /**
     * Start a timer to display elapsed time
     */
    const startTimer = () => {
      this.settings.game.timerId = setInterval(() => {
        this.settings.game.elapsedTime += 1
        let innerHTML = this.settings.game.elapsedTime
        if (this.settings.game.elapsedTime <= 9) {
          innerHTML = '00' + this.settings.game.elapsedTime
        } else if (this.settings.game.elapsedTime >= 10 && this.settings.game.elapsedTime <= 99) {
          innerHTML = '0' + this.settings.game.elapsedTime
        }
        Utils.el('timer').innerHTML = innerHTML
      }, 1000)
    }

    /**
     * Change the status of a cell (flagged, mystery or not revealed)
     * @param cell the cell to update
     */
    const updateCell = cell => {
      const cellPos = Utils.cellPos(cell)
      if (this.settings.game.firstClick === true) {
        startTimer()
        this.settings.game.firstClick = false
      }
      const isMined = this.settings.squares[(cellPos.i * this.settings.numberOfCols + cellPos.j)].isMined
      switch (cell.className) {
        case 'not-revealed':
          this.settings.game.flagged++
          if (isMined === true) {
            this.settings.game.goodFlagged++
          }
          cell.className = 'not-revealed-flag'
          break
        case 'not-revealed-flag':
          this.settings.game.flagged--
          if (isMined === true) {
            this.settings.game.goodFlagged--
          }
          cell.textContent = '?'
          cell.className = 'not-revealed-mystery'
          break
        case 'not-revealed-mystery':
          cell.textContent = ''
          cell.className = 'not-revealed'
      }
      notify()
    }

    /**
     * Create a multiplayer session
     */
    const createMultiplayer = () => {
      debug('Creating a multiplayer session', '-')
      this.settings.multiplayer.ws.send(JSON.stringify({ 'create': this.settings.multiplayer.userid, 'seed': this.settings.seed, '_id': this.settings.multiplayer._id }))
    }

    /**
     * Try to reconnect the user to a session
     */
    const reconnect = () => {
      debug('Try to reconnect the user to a session', this.settings.multiplayer.userid)
      this.settings.multiplayer.ws.send(JSON.stringify({ 'reconnect': this.settings.multiplayer.userid, '_id': this.settings.multiplayer._id }))
    }

    /**
     * Disconnect the user from the current multiplayer session
     */
    const disconnect = () => {
      debug('Disconnected from the session', this.settings.multiplayer.gameid)
      this.settings.multiplayer.ws.send(JSON.stringify({ 'disconnect': this.settings.multiplayer.userid, '_id': this.settings.multiplayer._id }))
    }

    /**
     * Join a multiplayer session
     * @param gameid the id of the game to join
     */
    const joinGame = gameid => {
      debug('Try to join a multiplayer session', gameid)
      this.settings.multiplayer.gameid = gameid
      this.settings.multiplayer.ws.send(JSON.stringify({ 'gameid': gameid, 'join': this.settings.multiplayer.userid, '_id': this.settings.multiplayer._id }))
    }

    const newSeed = () => {
      debug('Sent the new seed to the other players', this.settings.seed)
      this.settings.multiplayer.ws.send(JSON.stringify({ 'newseed': this.settings.seed, '_id': this.settings.multiplayer._id }))
    }

    /**
     * Send an action
     * @param action the action to send
     */
    const sendAction = action => {
      this.settings.multiplayer.ws.send(JSON.stringify({ 'gameid': this.settings.multiplayer.gameid, 'userid': this.settings.multiplayer.userid, 'action': action }))
    }
  }
}

/**
 * A Square
 */
class Square {
  constructor (isMined, content) {
    this.isMined = isMined
    this.content = content
  }
}

/**
 * Utils class
 */
class Utils {
  /**
   * Get the position of the given cell
   * @param cell the cell
   */
  static cellPos (cell) {
    const i = parseInt(cell.getAttribute('i'))
    const j = parseInt(cell.getAttribute('j'))
    return { i: i, j: j }
  }

  /**
   * Create an element
   */
  static ce (elementId) {
    return document.createElement(elementId)
  }

  /**
   * Get the element with the given ID
   * @param elementId the ID of the element
   */
  static el (elementId) {
    return document.getElementById(elementId)
  }

  /**
   * Get the neighbors of a square
   * @param line the line where the square is
   * @param col the column where the square is
   */
  static neighbors (line, col) {
    return [
      [line, col + 1],
      [line + 1, col + 1],
      [line + 1, col],
      [line + 1, col - 1],
      [line, col - 1],
      [line - 1, col - 1],
      [line - 1, col],
      [line - 1, col + 1]
    ]
  }

  /**
   * Toggle multiplayer UI
   * @param connected is in connected mode
   */
  static toggleMultiplayerUI (connected = true) {
    Utils.el('button_create').disabled = connected
    Utils.el('button_join').disabled = connected
    Utils.el('button_disconnect').disabled = !connected
  }
}

/**
 * Generate the game
 * @param reset if true, reset the game
 */
const generate = reset => {
  Utils.el('inner').innerHTML = ''

  if (typeof game === 'undefined') {
    game = new Game()
  }
  if (reset === true) {
    clearInterval(game.settings.game.timerId)
  }

  game.generate()
}

// Just a proof of concept
class AI {
  constructor () {
    // Contains some basic or obvious rules to solve the minesweeper
    this.rules = []

    // Find a pattern in the revealed squares
    this.findPattern = () => {

    }

    // Update the weight of the hidden squares
    this.updateWeight = () => {

    }

    // Trigger the mousedown event on a cell
    this.clickOnCell = cell => {

    }
  }
}
