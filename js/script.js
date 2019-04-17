/**
 * Game main class
 */
class Game {
  constructor (divName) {
    this.divName = divName;

    if (!this.divName) {
      this.divName = 'inner';
    }

    this.settings = {
      version: '1.0.0',
      squares: [], // the data
      cells: [], // the graphical elements
      difficulty: 10,
      numberOfLines: 8,
      numberOfCols: 8,
      totalSquares: 64,
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
    };
    /**
     * Generate the game
     */
    this.generate = function () {
      this.initData();
      this.initGraphics();
      this.notify();
    };
    /**
     * Check if a cell is valid on the given line and column
     * @param line the line
     * @param column the column
     */
    this.cellIsValid = function (line, column) {
      return (line >= 0 && column >= 0 && line < this.settings.numberOfLines && column < this.settings.numberOfCols);
    };
    /**
     * Triggered on the mousedown/touchstart events
     * @param cell the cell on which the mouse/touch down events are triggered
     * @param e the mouse/touch down events
     */
    this.mouseDownEvent = function (cell, e) {
      if (this.settings.game.terminated === false) {
        if (e.which === 3) {
          this.updateCell(cell);
        } else if (e.which === 0 || e.which === 1) {
          this.settings.game.mouseDownStartTime = new Date().getTime();
        }
        this.notify();
      }
    };
    /**
     * Triggered on the mousedown/touchend events
     * @param cell the cell on which the mouse/touch up events are triggered
     * @param e the mouse/touch up events
     */
    this.mouseUpEvent = function (cell, e) {
      if (this.settings.game.terminated === false) {
        const cellPos = Utils.cellPos(cell);
        if (this.settings.game.firstClick === true) {
          this.startTimer();
          this.settings.game.firstClick = false;
        }
        if (e.which === 0 || e.which === 1) {
          if (new Date().getTime() >= (this.settings.game.mouseDownStartTime + 200)) {
            this.updateCell(cell);
          } else if (cell.className === 'not-revealed') {
            cell.className = 'revealed';
            this.settings.game.remaining--;
            if (this.settings.squares[(cellPos.i * this.settings.numberOfCols + cellPos.j)].isMined === false) {
              this.revealSquare(cellPos.i, cellPos.j);
              if (this.settings.game.remaining === 0) {
                this.settings.game.terminated = true;
              }
            } else {
              cell.setAttribute('data-content', 'X');
              cell.className += ' mined';
              this.settings.game.terminated = true;
              clearInterval(this.settings.game.timerId);
              // Reveal the mines
              this.revealMines(cell);
            }
          }
        }
        this.notify();
      }
    };
    /**
     * Init the data of the game (settings, squares)
     */
    this.initData = function () {
      // Get the difficulty
      const select = Utils.el('difficulty');
      this.settings.difficulty = parseInt(select.options[select.selectedIndex].value);

      // Generate an empty grid with the selected difficulty
      this.settings.cells = [];
      switch (this.settings.difficulty) {
        case 10:
          this.settings.numberOfLines = this.settings.numberOfCols = 8;
          break;
        case 40:
          this.settings.numberOfLines = this.settings.numberOfCols = 16;
          break;
        case 99:
          this.settings.numberOfLines = 16;
          this.settings.numberOfCols = 30;
      }

      while (this.settings.cells.length < this.settings.numberOfLines) {
        this.settings.cells.push([]);
      }

      // Total number of squares
      this.settings.totalSquares = this.settings.numberOfLines * this.settings.numberOfCols;
      // Number of squares that must be revealed to win
      this.settings.game.remaining = this.settings.totalSquares - this.settings.difficulty;
      // Initialize the game's params
      this.settings.game.terminated = false;
      this.settings.game.elapsedTime = 0;
      this.settings.game.firstClick = true;
      this.settings.game.flagged = 0;
      this.settings.game.mouseDownStartTime = 0;
      Utils.el('timer').innerHTML = '000';

      // Generate the squares
      let squares = [];
      for (let i = 0; i < this.settings.totalSquares; i++) {
        let isMined = true;
        if (i > (this.settings.difficulty - 1)) {
          isMined = false;
        }
        squares.push(new Square(isMined, 0));
      }
      this.settings.squares = [];
      // Shuffle the array
      for (let i = 0; i < this.settings.totalSquares; i++) {
        const index = Math.floor(Math.random() * squares.length);
        this.settings.squares.push(squares[index]);
        squares.splice(index, 1);
      }
      // Get the mines around each square
      for (let i = 0; i < this.settings.numberOfLines; i++) {
        for (let j = 0; j < this.settings.numberOfCols; j++) {
          let currentSquare = this.settings.squares[(i * this.settings.numberOfCols + j)];
          if (currentSquare.isMined === false) {
            const neighbors = Utils.neighbors(i, j);
            let content = 0;
            for (let k = 0; k < 8; k++) {
              const line = neighbors[k][0];
              const col = neighbors[k][1];
              if (this.cellIsValid(line, col) === true) {
                const currentNeighbor = this.settings.squares[(line * this.settings.numberOfCols + col)];
                if (currentNeighbor.isMined === true) {
                  content++;
                }
              }
            }
            currentSquare.content = content;
          }
        }
      }
    };
    /**
     * Create the graphical elements
     */
    this.initGraphics = function () {
      let div = Utils.el(this.divName);
      let table = Utils.ce('table');
      div.appendChild(table);
      for (let i = 0; i < this.settings.numberOfLines; i++) {
        let row = table.insertRow(0);
        for (let j = 0; j < this.settings.numberOfCols; j++) {
          let cell = row.insertCell(0);
          cell.className = 'not-revealed';
          cell.setAttribute('i', i);
          cell.setAttribute('j', j);
          cell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
          }, false);
          cell.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.mouseDownEvent(cell, e);
          });
          cell.addEventListener('mouseup', (e) => {
            e.preventDefault();
            this.mouseUpEvent(cell, e);
          });
          cell.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.mouseDownEvent(cell, e);
          });
          cell.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.mouseUpEvent(cell, e);
          });
          this.settings.cells[i].push(cell);
        }
      }
    };
    /**
     * Notify something to the player (number of remaining mines, game over)
     */
    this.notify = function () {
      Utils.el('notify').innerHTML = '';
      Utils.el('mines').innerHTML = this.settings.difficulty - this.settings.game.flagged;
      if (this.settings.game.terminated === true) {
        clearInterval(this.settings.game.timerId);
        Utils.el('notify').innerHTML = 'Game finished.';
      }
    };
    /**
     * Reveal all the mines when a cell that contains a mine is clicked
     * @param cell the cell that contains a mine
     */
    this.revealMines = function (cell) {
      const cellPos = Utils.cellPos(cell);
      for (let i = 0; i < this.settings.numberOfLines; i++) {
        for (let j = 0; j < this.settings.numberOfCols; j++) {
          // Don't modify the style of the clicked cell
          if (i === cellPos.i && j === cellPos.j) {
            continue;
          }
          const isMined = this.settings.squares[(i * this.settings.numberOfCols + j)].isMined;
          let cell = this.settings.cells[i][j];
          // Reveal the mistakes (i.e. flagged squares that not contain a mine)
          if (isMined === false && this.settings.cells[i][j].className === 'not-revealed-flag') {
            cell.setAttribute('data-content', 'X');
            cell.className = 'revealed number-mines-3';
          }
          // Reveal the mines
          if (isMined === true && this.settings.cells[i][j].className !== 'not-revealed-flag') {
            cell.setAttribute('data-content', 'X');
            cell.className = 'revealed';
          }
        }
      }
    };
    /**
     * Reveal a square.
     * If empty, reveal squares around and search another empty squares (recursively)
     * @param line the line where the clicked cell is
     * @param col the column where the clicked cell is
     */
    this.revealSquare = function (line, col) {
      let cell = this.settings.cells[line][col];
      cell.className = 'revealed';
      const content = this.settings.squares[(line * this.settings.numberOfCols + col)].content;
      if (content !== 0) {
        cell.setAttribute('data-content', content);
        cell.className += ' number-mines-' + content;
      } else {
        const neighbors = Utils.neighbors(line, col);
        for (let k = 0; k < 8; k++) {
          const neighborLine = neighbors[k][0];
          const neighborCol = neighbors[k][1];
          if (this.cellIsValid(neighborLine, neighborCol) === true &&
            this.settings.cells[neighborLine][neighborCol].className === 'not-revealed') {
            this.settings.game.remaining--;
            this.revealSquare(neighborLine, neighborCol);
          }
        }
      }
    };
    /**
     * Start a timer to display elapsed time
     */
    this.startTimer = function () {
      this.settings.game.timerId = setInterval(() => {
        this.settings.game.elapsedTime += 1;
        let innerHTML = this.settings.game.elapsedTime;
        if (this.settings.game.elapsedTime <= 9) {
          innerHTML = '00' + this.settings.game.elapsedTime;
        } else if (this.settings.game.elapsedTime >= 10 && this.settings.game.elapsedTime <= 99) {
          innerHTML = '0' + this.settings.game.elapsedTime;
        }
        Utils.el('timer').innerHTML = innerHTML;
      }, 1000);
    };
    /**
     * Change the status of a cell (flagged, mystery or not revealed)
     * @param cell the cell to update
     */
    this.updateCell = function (cell) {
      const cellPos = Utils.cellPos(cell);
      if (this.settings.game.firstClick === true) {
        this.startTimer();
        this.settings.game.firstClick = false;
      }
      const isMined = this.settings.squares[(cellPos.i * this.settings.numberOfCols + cellPos.j)].isMined;
      switch (cell.className) {
        case 'not-revealed':
          this.settings.game.flagged++;
          if (isMined === true) {
            this.settings.game.goodFlagged++;
          }
          cell.className = 'not-revealed-flag';
          break;
        case 'not-revealed-flag':
          this.settings.game.flagged--;
          if (isMined === true) {
            this.settings.game.goodFlagged--;
          }
          cell.textContent = '?';
          cell.className = 'not-revealed-mystery';
          break;
        case 'not-revealed-mystery':
          cell.textContent = '';
          cell.className = 'not-revealed';
      }
      this.notify();
    };
  }
}

/**
 * A Square
 */
class Square {
  constructor (isMined, content) {
    this.isMined = isMined;
    this.content = content;
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
    const i = parseInt(cell.getAttribute('i'));
    const j = parseInt(cell.getAttribute('j'));
    return { i: i, j: j };
  };
  /**
   * Create an element
   */
  static ce (elementId) {
    return document.createElement(elementId);
  };
  /**
   * Get the element with the given ID
   * @param elementId the ID of the element
   */
  static el (elementId) {
    return document.getElementById(elementId);
  };
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
  };
}

/**
 * Generate the game
 * @param reset if true, reset the game
 */
function generate (reset) {
  Utils.el('inner').innerHTML = '';

  if (typeof game === 'undefined') {
    game = new Game();
  }
  if (reset === true) {
    clearInterval(game.settings.game.timerId);
  }

  game.generate();
}