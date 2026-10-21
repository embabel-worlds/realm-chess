/* Chesscalator's board: cm-chessboard 8.15.1 (MIT, Stefan Haack) and chess.js 1.4.0 (BSD-2-Clause, Jeff Hlywa), bundled by scripts/app.mjs. */
(() => {
  // node_modules/cm-chessboard/src/model/Position.js
  var FEN = {
    start: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    empty: "8/8/8/8/8/8/8/8"
  };
  var Position = class _Position {
    constructor(fen = FEN.empty) {
      this.squares = new Array(64).fill(null);
      this.setFen(fen);
    }
    setFen(fen = FEN.empty) {
      const parts = fen.replace(/^\s*/, "").replace(/\s*$/, "").split(/\/|\s/);
      for (let part = 0; part < 8; part++) {
        const row = parts[7 - part].replace(/\d/g, (str) => {
          const numSpaces = parseInt(str);
          let ret = "";
          for (let i = 0; i < numSpaces; i++) {
            ret += "-";
          }
          return ret;
        });
        for (let c = 0; c < 8; c++) {
          const char = row.substring(c, c + 1);
          let piece = null;
          if (char !== "-") {
            if (char.toUpperCase() === char) {
              piece = `w${char.toLowerCase()}`;
            } else {
              piece = `b${char}`;
            }
          }
          this.squares[part * 8 + c] = piece;
        }
      }
    }
    getFen() {
      let parts = new Array(8).fill("");
      for (let part = 0; part < 8; part++) {
        let spaceCounter = 0;
        for (let i = 0; i < 8; i++) {
          const piece = this.squares[part * 8 + i];
          if (!piece) {
            spaceCounter++;
          } else {
            if (spaceCounter > 0) {
              parts[7 - part] += spaceCounter;
              spaceCounter = 0;
            }
            const color = piece.substring(0, 1);
            const name = piece.substring(1, 2);
            if (color === "w") {
              parts[7 - part] += name.toUpperCase();
            } else {
              parts[7 - part] += name;
            }
          }
        }
        if (spaceCounter > 0) {
          parts[7 - part] += spaceCounter;
          spaceCounter = 0;
        }
      }
      return parts.join("/");
    }
    getPieces(pieceColor = void 0, pieceType = void 0, sortBy = ["k", "q", "r", "b", "n", "p"]) {
      const pieces = [];
      const sort = (a, b) => {
        return sortBy.indexOf(a.name) - sortBy.indexOf(b.name);
      };
      for (let i = 0; i < 64; i++) {
        const piece = this.squares[i];
        if (piece) {
          const type = piece.charAt(1);
          const color = piece.charAt(0);
          const square = _Position.indexToSquare(i);
          if (pieceType && pieceType !== type || pieceColor && pieceColor !== color) {
            continue;
          }
          pieces.push({
            name: type,
            // deprecated, use type
            type,
            color,
            position: square,
            // deprecated, use square
            square
          });
        }
      }
      if (sortBy) {
        pieces.sort(sort);
      }
      return pieces;
    }
    movePiece(squareFrom, squareTo) {
      if (!this.squares[_Position.squareToIndex(squareFrom)]) {
        console.warn("no piece on", squareFrom);
        return;
      }
      this.squares[_Position.squareToIndex(squareTo)] = this.squares[_Position.squareToIndex(squareFrom)];
      this.squares[_Position.squareToIndex(squareFrom)] = null;
    }
    setPiece(square, piece) {
      this.squares[_Position.squareToIndex(square)] = piece;
    }
    getPiece(square) {
      return this.squares[_Position.squareToIndex(square)];
    }
    static squareToIndex(square) {
      const coordinates = _Position.squareToCoordinates(square);
      return coordinates[0] + coordinates[1] * 8;
    }
    static indexToSquare(index) {
      return this.coordinatesToSquare([Math.floor(index % 8), index / 8]);
    }
    static squareToCoordinates(square) {
      const file2 = square.charCodeAt(0) - 97;
      const rank2 = square.charCodeAt(1) - 49;
      return [file2, rank2];
    }
    static coordinatesToSquare(coordinates) {
      const file2 = String.fromCharCode(coordinates[0] + 97);
      const rank2 = String.fromCharCode(coordinates[1] + 49);
      return file2 + rank2;
    }
    toString() {
      return this.getFen();
    }
    clone() {
      const cloned = Object.create(_Position.prototype);
      cloned.squares = this.squares.slice(0);
      return cloned;
    }
  };

  // node_modules/cm-chessboard/src/model/ChessboardState.js
  var ChessboardState = class {
    constructor() {
      this.position = new Position();
      this.orientation = void 0;
      this.inputWhiteEnabled = false;
      this.inputBlackEnabled = false;
      this.squareSelectEnabled = false;
      this.moveInputCallback = null;
      this.moveInputAnimate = void 0;
      this.extensionPoints = {};
      this.moveInputProcess = Promise.resolve();
    }
    inputEnabled() {
      return this.inputWhiteEnabled || this.inputBlackEnabled;
    }
    invokeExtensionPoints(name, data = {}) {
      const extensionPoints = this.extensionPoints[name];
      const dataCloned = Object.assign({}, data);
      dataCloned.extensionPoint = name;
      let returnValue = true;
      if (extensionPoints) {
        for (const extensionPoint of extensionPoints) {
          if (extensionPoint(dataCloned) === false) {
            returnValue = false;
          }
        }
      }
      return returnValue;
    }
  };

  // node_modules/cm-chessboard/src/lib/Svg.js
  var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  var Svg = class {
    /**
     * create the Svg in the HTML DOM
     * @param containerElement
     * @returns {Element}
     */
    static createSvg(containerElement = void 0) {
      let svg = document.createElementNS(SVG_NAMESPACE, "svg");
      if (containerElement) {
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        containerElement.appendChild(svg);
      }
      return svg;
    }
    /**
     * Add an Element to an SVG DOM
     * @param parent
     * @param name
     * @param attributes
     * @returns {Element}
     */
    static addElement(parent, name, attributes = {}) {
      let element = document.createElementNS(SVG_NAMESPACE, name);
      if (name === "use") {
        attributes["xlink:href"] = attributes["href"];
      }
      for (let attribute in attributes) {
        if (attributes.hasOwnProperty(attribute)) {
          if (attribute.indexOf(":") !== -1) {
            const value = attribute.split(":");
            element.setAttributeNS("http://www.w3.org/1999/" + value[0], value[1], attributes[attribute]);
          } else {
            element.setAttribute(attribute, attributes[attribute]);
          }
        }
      }
      parent.appendChild(element);
      return element;
    }
    /**
     * Remove an element from an SVG DOM
     * @param element
     */
    static removeElement(element) {
      if (!element) {
        console.warn("removeElement, element is", element);
        return;
      }
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      } else {
        console.warn(element, "without parentNode");
      }
    }
  };

  // node_modules/cm-chessboard/src/model/Extension.js
  var EXTENSION_POINT = {
    positionChanged: "positionChanged",
    // the positions of the pieces was changed
    boardChanged: "boardChanged",
    // the board (orientation) was changed
    moveInputToggled: "moveInputToggled",
    // move input was enabled or disabled
    moveInput: "moveInput",
    // move started, moving over a square, validating or canceled
    beforeRedrawBoard: "beforeRedrawBoard",
    // called before redrawing the board
    afterRedrawBoard: "afterRedrawBoard",
    // called after redrawing the board
    redrawBoard: "redrawBoard",
    // called after redrawing the board, DEPRECATED, use afterRedrawBoard 2023-09-18
    animation: "animation",
    // called on animation start, end, and on every animation frame
    destroy: "destroy"
    // called, before the board is destroyed
  };
  var Extension = class {
    constructor(chessboard) {
      this.chessboard = chessboard;
    }
    registerExtensionPoint(name, callback) {
      if (name === EXTENSION_POINT.redrawBoard) {
        console.warn("EXTENSION_POINT.redrawBoard is deprecated, use EXTENSION_POINT.afterRedrawBoard");
        name = EXTENSION_POINT.afterRedrawBoard;
      }
      if (!this.chessboard.state.extensionPoints[name]) {
        this.chessboard.state.extensionPoints[name] = [];
      }
      this.chessboard.state.extensionPoints[name].push(callback);
    }
    /** @deprecated 2023-05-18 */
    registerMethod(name, callback) {
      console.warn("registerMethod is deprecated, just add methods directly to the chessboard instance");
      if (!this.chessboard[name]) {
        this.chessboard[name] = (...args) => {
          return callback.apply(this, args);
        };
      } else {
        log.error("method", name, "already exists");
      }
    }
  };

  // node_modules/cm-chessboard/src/lib/Utils.js
  var Utils = class _Utils {
    static delegate(element, eventName, selector, handler) {
      const eventListener = function(event) {
        const match = event.target.closest(selector);
        if (match && this.contains(match)) {
          handler.call(match, event);
        }
      };
      element.addEventListener(eventName, eventListener);
      return {
        remove: function() {
          element.removeEventListener(eventName, eventListener);
        }
      };
    }
    static mergeObjects(target, source) {
      const isObject = (obj) => obj && typeof obj === "object";
      if (!isObject(target) || !isObject(source)) {
        return source;
      }
      for (const key of Object.keys(source)) {
        if (source[key] instanceof Object) {
          Object.assign(source[key], _Utils.mergeObjects(target[key], source[key]));
        }
      }
      Object.assign(target || {}, source);
      return target;
    }
    static createDomElement(html) {
      const template = document.createElement("template");
      template.innerHTML = html.trim();
      return template.content.firstChild;
    }
    static createTask() {
      let resolve, reject;
      const promise = new Promise(function(_resolve, _reject) {
        resolve = _resolve;
        reject = _reject;
      });
      promise.resolve = resolve;
      promise.reject = reject;
      return promise;
    }
    static isAbsoluteUrl(url) {
      return url.indexOf("://") !== -1 || url.startsWith("/");
    }
  };

  // node_modules/cm-chessboard/src/view/PositionAnimationsQueue.js
  var ANIMATION_EVENT_TYPE = {
    start: "start",
    frame: "frame",
    end: "end"
  };
  var PromiseQueue = class {
    constructor() {
      this.queue = [];
      this.workingOnPromise = false;
      this.stop = false;
    }
    async enqueue(promise) {
      return new Promise((resolve, reject) => {
        this.queue.push({
          promise,
          resolve,
          reject
        });
        this.dequeue();
      });
    }
    dequeue() {
      if (this.workingOnPromise) {
        return;
      }
      if (this.stop) {
        this.queue = [];
        this.stop = false;
        return;
      }
      const entry = this.queue.shift();
      if (!entry) {
        return;
      }
      try {
        this.workingOnPromise = true;
        entry.promise().then((value) => {
          this.workingOnPromise = false;
          entry.resolve(value);
          this.dequeue();
        }).catch((err) => {
          this.workingOnPromise = false;
          entry.reject(err);
          this.dequeue();
        });
      } catch (err) {
        this.workingOnPromise = false;
        entry.reject(err);
        this.dequeue();
      }
      return true;
    }
    destroy() {
      this.stop = true;
    }
  };
  var CHANGE_TYPE = {
    move: 0,
    appear: 1,
    disappear: 2
  };
  var PositionsAnimation = class _PositionsAnimation {
    constructor(view, fromPosition, toPosition, duration, callback) {
      this.view = view;
      if (fromPosition && toPosition) {
        this.animatedElements = this.createAnimation(fromPosition.squares, toPosition.squares);
        this.duration = duration;
        this.callback = callback;
        this.frameHandle = requestAnimationFrame(this.animationStep.bind(this));
      } else {
        console.error("fromPosition", fromPosition, "toPosition", toPosition);
      }
      this.view.positionsAnimationTask = Utils.createTask();
      this.view.chessboard.state.invokeExtensionPoints(EXTENSION_POINT.animation, {
        type: ANIMATION_EVENT_TYPE.start
      });
    }
    static seekChanges(fromSquares, toSquares) {
      const appearedList = [], disappearedList = [], changes = [];
      for (let i = 0; i < 64; i++) {
        const previousSquare = fromSquares[i];
        const newSquare = toSquares[i];
        if (newSquare !== previousSquare) {
          if (newSquare) {
            appearedList.push({ piece: newSquare, index: i });
          }
          if (previousSquare) {
            disappearedList.push({ piece: previousSquare, index: i });
          }
        }
      }
      appearedList.forEach((appeared) => {
        let shortestDistance = 8;
        let foundMoved = null;
        disappearedList.forEach((disappeared) => {
          if (appeared.piece === disappeared.piece) {
            const moveDistance = _PositionsAnimation.squareDistance(appeared.index, disappeared.index);
            if (moveDistance < shortestDistance) {
              foundMoved = disappeared;
              shortestDistance = moveDistance;
            }
          }
        });
        if (foundMoved) {
          disappearedList.splice(disappearedList.indexOf(foundMoved), 1);
          changes.push({
            type: CHANGE_TYPE.move,
            piece: appeared.piece,
            atIndex: foundMoved.index,
            toIndex: appeared.index
          });
        } else {
          changes.push({ type: CHANGE_TYPE.appear, piece: appeared.piece, atIndex: appeared.index });
        }
      });
      disappearedList.forEach((disappeared) => {
        changes.push({ type: CHANGE_TYPE.disappear, piece: disappeared.piece, atIndex: disappeared.index });
      });
      return changes;
    }
    createAnimation(fromSquares, toSquares) {
      const changes = _PositionsAnimation.seekChanges(fromSquares, toSquares);
      const animatedElements = [];
      changes.forEach((change) => {
        const animatedItem = {
          type: change.type
        };
        switch (change.type) {
          case CHANGE_TYPE.move:
            animatedItem.element = this.view.getPieceElement(Position.indexToSquare(change.atIndex));
            animatedItem.element.parentNode.appendChild(animatedItem.element);
            animatedItem.atPoint = this.view.indexToPoint(change.atIndex);
            animatedItem.toPoint = this.view.indexToPoint(change.toIndex);
            break;
          case CHANGE_TYPE.appear:
            animatedItem.element = this.view.drawPieceOnSquare(Position.indexToSquare(change.atIndex), change.piece);
            animatedItem.element.style.opacity = 0;
            break;
          case CHANGE_TYPE.disappear:
            animatedItem.element = this.view.getPieceElement(Position.indexToSquare(change.atIndex));
            break;
        }
        animatedElements.push(animatedItem);
      });
      return animatedElements;
    }
    animationStep(time) {
      if (!this.view || !this.view.chessboard.state) {
        return;
      }
      if (!this.startTime) {
        this.startTime = time;
      }
      const timeDiff = time - this.startTime;
      if (timeDiff <= this.duration) {
        this.frameHandle = requestAnimationFrame(this.animationStep.bind(this));
      } else {
        cancelAnimationFrame(this.frameHandle);
        this.animatedElements.forEach((animatedItem) => {
          if (animatedItem.type === CHANGE_TYPE.disappear) {
            Svg.removeElement(animatedItem.element);
          }
        });
        this.view.positionsAnimationTask.resolve();
        this.view.chessboard.state.invokeExtensionPoints(EXTENSION_POINT.animation, {
          type: ANIMATION_EVENT_TYPE.end
        });
        this.callback();
        return;
      }
      const t = Math.min(1, timeDiff / this.duration);
      let progress = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      if (isNaN(progress) || progress > 0.99) {
        progress = 1;
      }
      this.animatedElements.forEach((animatedItem) => {
        if (animatedItem.element) {
          switch (animatedItem.type) {
            case CHANGE_TYPE.move:
              animatedItem.element.transform.baseVal.removeItem(0);
              const transform = this.view.svg.createSVGTransform();
              transform.setTranslate(
                animatedItem.atPoint.x + (animatedItem.toPoint.x - animatedItem.atPoint.x) * progress,
                animatedItem.atPoint.y + (animatedItem.toPoint.y - animatedItem.atPoint.y) * progress
              );
              animatedItem.element.transform.baseVal.appendItem(transform);
              break;
            case CHANGE_TYPE.appear:
              animatedItem.element.style.opacity = Math.round(progress * 100) / 100;
              break;
            case CHANGE_TYPE.disappear:
              animatedItem.element.style.opacity = Math.round((1 - progress) * 100) / 100;
              break;
          }
        } else {
          console.warn("animatedItem has no element", animatedItem);
        }
      });
      this.view.chessboard.state.invokeExtensionPoints(EXTENSION_POINT.animation, {
        type: ANIMATION_EVENT_TYPE.frame,
        progress
      });
    }
    static squareDistance(index1, index2) {
      const file1 = index1 % 8;
      const rank1 = Math.floor(index1 / 8);
      const file2 = index2 % 8;
      const rank2 = Math.floor(index2 / 8);
      return Math.max(Math.abs(rank2 - rank1), Math.abs(file2 - file1));
    }
  };
  var PositionAnimationsQueue = class extends PromiseQueue {
    constructor(chessboard) {
      super();
      this.chessboard = chessboard;
    }
    async enqueuePositionChange(positionFrom, positionTo, animated) {
      if (positionFrom.getFen() === positionTo.getFen()) {
        return super.enqueue(() => Promise.resolve());
      } else {
        return super.enqueue(() => new Promise((resolve) => {
          let duration = animated ? this.chessboard.props.style.animationDuration : 0;
          if (this.queue.length > 0) {
            duration = duration / (1 + Math.pow(this.queue.length / 5, 2));
          }
          new PositionsAnimation(
            this.chessboard.view,
            positionFrom,
            positionTo,
            animated ? duration : 0,
            () => {
              if (this.chessboard.view) {
                this.chessboard.view.redrawPieces(positionTo.squares);
              }
              resolve();
            }
          );
        }));
      }
    }
    async enqueueTurnBoard(position, color, animated) {
      return super.enqueue(() => new Promise((resolve) => {
        const emptyPosition = new Position(FEN.empty);
        let duration = animated ? this.chessboard.props.style.animationDuration : 0;
        if (this.queue.length > 0) {
          duration = duration / (1 + Math.pow(this.queue.length / 5, 2));
        }
        new PositionsAnimation(
          this.chessboard.view,
          position,
          emptyPosition,
          animated ? duration : 0,
          () => {
            this.chessboard.state.orientation = color;
            this.chessboard.view.redrawBoard();
            this.chessboard.view.redrawPieces(emptyPosition.squares);
            new PositionsAnimation(
              this.chessboard.view,
              emptyPosition,
              position,
              animated ? duration : 0,
              () => {
                this.chessboard.view.redrawPieces(position.squares);
                resolve();
              }
            );
          }
        );
      }));
    }
  };

  // node_modules/cm-chessboard/src/view/VisualMoveInput.js
  var MOVE_INPUT_STATE = {
    waitForInputStart: "waitForInputStart",
    pieceClickedThreshold: "pieceClickedThreshold",
    clickTo: "clickTo",
    secondClickThreshold: "secondClickThreshold",
    dragTo: "dragTo",
    clickDragTo: "clickDragTo",
    moveDone: "moveDone",
    reset: "reset"
  };
  var MOVE_CANCELED_REASON = {
    secondClick: "secondClick",
    // clicked the same piece
    secondaryClick: "secondaryClick",
    // right click while moving
    movedOutOfBoard: "movedOutOfBoard",
    draggedBack: "draggedBack",
    // dragged to the start square
    clickedAnotherPiece: "clickedAnotherPiece",
    // of the same color
    touchCanceled: "touchCanceled",
    movedPieceChanged: "movedPieceChanged",
    // the held piece changed on the board, most likely got captured
    canceled: "canceled"
    // cancelled programmatically via chessboard.cancelMoveInput()
  };
  var DRAG_THRESHOLD = 4;
  var VisualMoveInput = class {
    constructor(view) {
      this.view = view;
      this.chessboard = view.chessboard;
      this.moveInputState = null;
      this.fromSquare = null;
      this.toSquare = null;
      this.movedPiece = null;
      this.setMoveInputState(MOVE_INPUT_STATE.waitForInputStart);
    }
    moveInputStartedCallback(square) {
      const result = this.view.moveInputStartedCallback(square);
      if (result) {
        this.chessboard.state.moveInputProcess = Utils.createTask();
        this.chessboard.state.moveInputProcess.then((result2) => {
          if (this.moveInputState === MOVE_INPUT_STATE.waitForInputStart || this.moveInputState === MOVE_INPUT_STATE.moveDone) {
            this.view.moveInputFinishedCallback(this.fromSquare, this.toSquare, result2);
          }
        });
      }
      return result;
    }
    movingOverSquareCallback(fromSquare, toSquare) {
      this.view.movingOverSquareCallback(fromSquare, toSquare);
    }
    validateMoveInputCallback(fromSquare, toSquare) {
      const result = this.view.validateMoveInputCallback(fromSquare, toSquare);
      this.chessboard.state.moveInputProcess.resolve(result);
      return result;
    }
    moveInputCanceledCallback(fromSquare, toSquare, reason) {
      this.view.moveInputCanceledCallback(fromSquare, toSquare, reason);
      this.chessboard.state.moveInputProcess.resolve();
    }
    setMoveInputState(newState, params = void 0) {
      const prevState = this.moveInputState;
      this.moveInputState = newState;
      switch (newState) {
        case MOVE_INPUT_STATE.waitForInputStart:
          break;
        case MOVE_INPUT_STATE.pieceClickedThreshold:
          if (MOVE_INPUT_STATE.waitForInputStart !== prevState && MOVE_INPUT_STATE.clickTo !== prevState) {
            throw new Error("moveInputState");
          }
          if (this.pointerMoveListener) {
            removeEventListener(this.pointerMoveListener.type, this.pointerMoveListener);
            this.pointerMoveListener = null;
          }
          if (this.pointerUpListener) {
            removeEventListener(this.pointerUpListener.type, this.pointerUpListener);
            this.pointerUpListener = null;
          }
          if (this.pointerCancelListener) {
            removeEventListener(this.pointerCancelListener.type, this.pointerCancelListener);
            this.pointerCancelListener = null;
          }
          this.fromSquare = params.square;
          this.toSquare = null;
          this.movedPiece = params.piece;
          this.startPoint = params.point;
          if (!this.pointerMoveListener && !this.pointerUpListener) {
            if (params.type === "mousedown") {
              this.pointerMoveListener = this.onPointerMove.bind(this);
              this.pointerMoveListener.type = "mousemove";
              addEventListener("mousemove", this.pointerMoveListener);
              this.pointerUpListener = this.onPointerUp.bind(this);
              this.pointerUpListener.type = "mouseup";
              addEventListener("mouseup", this.pointerUpListener);
            } else if (params.type === "touchstart") {
              this.pointerMoveListener = this.onPointerMove.bind(this);
              this.pointerMoveListener.type = "touchmove";
              addEventListener("touchmove", this.pointerMoveListener);
              this.pointerUpListener = this.onPointerUp.bind(this);
              this.pointerUpListener.type = "touchend";
              addEventListener("touchend", this.pointerUpListener);
              this.pointerCancelListener = this.onPointerCancel.bind(this);
              this.pointerCancelListener.type = "touchcancel";
              addEventListener("touchcancel", this.pointerCancelListener);
            } else {
              throw Error("4b74af");
            }
            if (!this.contextMenuListener) {
              this.contextMenuListener = this.onContextMenu.bind(this);
              this.chessboard.view.svg.addEventListener("contextmenu", this.contextMenuListener);
            }
          } else {
            throw Error("94ad0c");
          }
          break;
        case MOVE_INPUT_STATE.clickTo:
          if (this.draggablePiece) {
            Svg.removeElement(this.draggablePiece);
            this.draggablePiece = null;
          }
          if (prevState === MOVE_INPUT_STATE.dragTo) {
            this.view.setPieceVisibility(params.square, true);
          }
          break;
        case MOVE_INPUT_STATE.secondClickThreshold:
          if (MOVE_INPUT_STATE.clickTo !== prevState) {
            throw new Error("moveInputState");
          }
          this.startPoint = params.point;
          break;
        case MOVE_INPUT_STATE.dragTo:
          if (MOVE_INPUT_STATE.pieceClickedThreshold !== prevState) {
            throw new Error("moveInputState");
          }
          if (this.view.chessboard.state.inputEnabled()) {
            this.view.setPieceVisibility(params.square, false);
            this.createDraggablePiece(params.piece);
          }
          break;
        case MOVE_INPUT_STATE.clickDragTo:
          if (MOVE_INPUT_STATE.secondClickThreshold !== prevState) {
            throw new Error("moveInputState");
          }
          if (this.view.chessboard.state.inputEnabled()) {
            this.view.setPieceVisibility(params.square, false);
            this.createDraggablePiece(params.piece);
          }
          break;
        case MOVE_INPUT_STATE.moveDone:
          if ([MOVE_INPUT_STATE.dragTo, MOVE_INPUT_STATE.clickTo, MOVE_INPUT_STATE.clickDragTo].indexOf(prevState) === -1) {
            throw new Error("moveInputState");
          }
          this.toSquare = params.square;
          const validated = params.validated !== void 0 ? params.validated : this.validateMoveInputCallback(this.fromSquare, this.toSquare);
          if (this.toSquare && validated) {
            const animate = prevState === MOVE_INPUT_STATE.clickTo && this.chessboard.state.moveInputAnimate !== false;
            this.chessboard.movePiece(this.fromSquare, this.toSquare, animate).then(() => {
              if (prevState === MOVE_INPUT_STATE.clickTo) {
                this.view.setPieceVisibility(this.toSquare, true);
              }
              this.setMoveInputState(MOVE_INPUT_STATE.reset);
            });
          } else {
            this.view.setPieceVisibility(this.fromSquare, true);
            this.setMoveInputState(MOVE_INPUT_STATE.reset);
          }
          break;
        case MOVE_INPUT_STATE.reset:
          if (this.fromSquare && !this.toSquare && this.movedPiece) {
            this.chessboard.state.position.setPiece(this.fromSquare, this.movedPiece);
          }
          this.fromSquare = null;
          this.toSquare = null;
          this.movedPiece = null;
          if (this.draggablePiece) {
            Svg.removeElement(this.draggablePiece);
            this.draggablePiece = null;
          }
          if (this.pointerMoveListener) {
            removeEventListener(this.pointerMoveListener.type, this.pointerMoveListener);
            this.pointerMoveListener = null;
          }
          if (this.pointerUpListener) {
            removeEventListener(this.pointerUpListener.type, this.pointerUpListener);
            this.pointerUpListener = null;
          }
          if (this.pointerCancelListener) {
            removeEventListener(this.pointerCancelListener.type, this.pointerCancelListener);
            this.pointerCancelListener = null;
          }
          if (this.contextMenuListener) {
            this.chessboard.view.svg.removeEventListener("contextmenu", this.contextMenuListener);
            this.contextMenuListener = null;
          }
          this.setMoveInputState(MOVE_INPUT_STATE.waitForInputStart);
          const hiddenPieces = this.view.piecesGroup.querySelectorAll("[visibility=hidden]");
          for (let i = 0; i < hiddenPieces.length; i++) {
            hiddenPieces[i].removeAttribute("visibility");
          }
          break;
        default:
          throw Error(`260b09: moveInputState ${newState}`);
      }
    }
    createDraggablePiece(pieceName) {
      if (this.draggablePiece) {
        throw Error("draggablePiece already exists");
      }
      this.draggablePiece = Svg.createSvg(document.body);
      this.draggablePiece.classList.add("cm-chessboard-draggable-piece");
      this.draggablePiece.setAttribute("width", this.view.squareWidth);
      this.draggablePiece.setAttribute("height", this.view.squareHeight);
      this.draggablePiece.setAttribute("style", "pointer-events: none");
      this.draggablePiece.name = pieceName;
      const spriteUrl = this.chessboard.props.assetsCache ? "" : this.view.getSpriteUrl();
      const piece = Svg.addElement(this.draggablePiece, "use", {
        href: `${spriteUrl}#${pieceName}`
      });
      const scaling = this.view.squareHeight / this.chessboard.props.style.pieces.tileSize;
      const transformScale = this.draggablePiece.createSVGTransform();
      transformScale.setScale(scaling, scaling);
      piece.transform.baseVal.appendItem(transformScale);
    }
    moveDraggablePiece(x, y) {
      this.draggablePiece.setAttribute(
        "style",
        `pointer-events: none; position: absolute; left: ${x - this.view.squareHeight / 2}px; top: ${y - this.view.squareHeight / 2}px`
      );
    }
    onPointerDown(e) {
      if (!(e.type === "mousedown" && e.button === 0 || e.type === "touchstart")) {
        return;
      }
      const square = e.target.getAttribute("data-square");
      if (!square) {
        return;
      }
      const pieceName = this.chessboard.getPiece(square);
      let color;
      if (pieceName) {
        color = pieceName ? pieceName.substring(0, 1) : null;
        if (color === "w" && this.chessboard.state.inputWhiteEnabled || color === "b" && this.chessboard.state.inputBlackEnabled) {
          e.preventDefault();
        }
      }
      if (this.moveInputState !== MOVE_INPUT_STATE.waitForInputStart || this.chessboard.state.inputWhiteEnabled && color === "w" || this.chessboard.state.inputBlackEnabled && color === "b") {
        let point;
        if (e.type === "mousedown") {
          point = { x: e.clientX, y: e.clientY };
        } else if (e.type === "touchstart") {
          point = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        if (this.moveInputState === MOVE_INPUT_STATE.waitForInputStart && pieceName && this.moveInputStartedCallback(square)) {
          this.setMoveInputState(MOVE_INPUT_STATE.pieceClickedThreshold, {
            square,
            piece: pieceName,
            point,
            type: e.type
          });
        } else if (this.moveInputState === MOVE_INPUT_STATE.clickTo) {
          if (square === this.fromSquare) {
            this.setMoveInputState(MOVE_INPUT_STATE.secondClickThreshold, {
              square,
              piece: pieceName,
              point,
              type: e.type
            });
          } else {
            const pieceName2 = this.chessboard.getPiece(square);
            const pieceColor = pieceName2 ? pieceName2.substring(0, 1) : null;
            const startPieceName = this.chessboard.getPiece(this.fromSquare);
            const startPieceColor = startPieceName ? startPieceName.substring(0, 1) : null;
            if (color && startPieceColor === pieceColor) {
              const result = this.validateMoveInputCallback(this.fromSquare, square);
              if (!result) {
                this.moveInputCanceledCallback(this.fromSquare, square, MOVE_CANCELED_REASON.clickedAnotherPiece);
                if (this.moveInputStartedCallback(square)) {
                  this.setMoveInputState(MOVE_INPUT_STATE.pieceClickedThreshold, {
                    square,
                    piece: pieceName2,
                    point,
                    type: e.type
                  });
                } else {
                  this.setMoveInputState(MOVE_INPUT_STATE.reset);
                }
              } else {
                this.setMoveInputState(MOVE_INPUT_STATE.moveDone, { square, validated: true });
              }
            } else {
              this.setMoveInputState(MOVE_INPUT_STATE.moveDone, { square });
            }
          }
        }
      }
    }
    onPointerMove(e) {
      let pageX, pageY, clientX, clientY, target;
      if (e.type === "mousemove") {
        clientX = e.clientX;
        clientY = e.clientY;
        pageX = e.pageX;
        pageY = e.pageY;
        target = e.target;
      } else if (e.type === "touchmove") {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
        pageX = e.touches[0].pageX;
        pageY = e.touches[0].pageY;
        target = document.elementFromPoint(clientX, clientY);
      }
      if (this.moveInputState === MOVE_INPUT_STATE.pieceClickedThreshold || this.moveInputState === MOVE_INPUT_STATE.secondClickThreshold) {
        if (Math.abs(this.startPoint.x - clientX) > DRAG_THRESHOLD || Math.abs(this.startPoint.y - clientY) > DRAG_THRESHOLD) {
          if (this.moveInputState === MOVE_INPUT_STATE.secondClickThreshold) {
            this.setMoveInputState(MOVE_INPUT_STATE.clickDragTo, {
              square: this.fromSquare,
              piece: this.movedPiece
            });
          } else {
            this.setMoveInputState(MOVE_INPUT_STATE.dragTo, { square: this.fromSquare, piece: this.movedPiece });
          }
          if (this.view.chessboard.state.inputEnabled()) {
            this.moveDraggablePiece(pageX, pageY);
          }
        }
      } else if (this.moveInputState === MOVE_INPUT_STATE.dragTo || this.moveInputState === MOVE_INPUT_STATE.clickDragTo || this.moveInputState === MOVE_INPUT_STATE.clickTo) {
        if (target && target.getAttribute && target.parentElement === this.view.boardGroup) {
          const square = target.getAttribute("data-square");
          if (square !== this.fromSquare && square !== this.toSquare) {
            this.toSquare = square;
            this.movingOverSquareCallback(this.fromSquare, this.toSquare);
          } else if (square === this.fromSquare && this.toSquare !== null) {
            this.toSquare = null;
            this.movingOverSquareCallback(this.fromSquare, null);
          }
        } else if (this.toSquare !== null) {
          this.toSquare = null;
          this.movingOverSquareCallback(this.fromSquare, null);
        }
        if (this.view.chessboard.state.inputEnabled() && (this.moveInputState === MOVE_INPUT_STATE.dragTo || this.moveInputState === MOVE_INPUT_STATE.clickDragTo)) {
          this.moveDraggablePiece(pageX, pageY);
        }
      }
    }
    onPointerUp(e) {
      let target;
      if (e.type === "mouseup") {
        target = e.target;
      } else if (e.type === "touchend") {
        target = document.elementFromPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
      if (target && target.getAttribute) {
        const square = target.getAttribute("data-square");
        if (square) {
          if (this.moveInputState === MOVE_INPUT_STATE.dragTo || this.moveInputState === MOVE_INPUT_STATE.clickDragTo) {
            if (this.fromSquare === square) {
              this.chessboard.state.position.setPiece(this.fromSquare, this.movedPiece);
              this.view.setPieceVisibility(this.fromSquare);
              this.moveInputCanceledCallback(square, null, MOVE_CANCELED_REASON.draggedBack);
              this.setMoveInputState(MOVE_INPUT_STATE.reset);
            } else {
              this.setMoveInputState(MOVE_INPUT_STATE.moveDone, { square });
            }
          } else if (this.moveInputState === MOVE_INPUT_STATE.pieceClickedThreshold) {
            this.setMoveInputState(MOVE_INPUT_STATE.clickTo, { square });
          } else if (this.moveInputState === MOVE_INPUT_STATE.secondClickThreshold) {
            this.setMoveInputState(MOVE_INPUT_STATE.reset);
            this.moveInputCanceledCallback(square, null, MOVE_CANCELED_REASON.secondClick);
          }
        } else {
          this.view.redrawPieces();
          const moveStartSquare = this.fromSquare;
          this.setMoveInputState(MOVE_INPUT_STATE.reset);
          this.moveInputCanceledCallback(moveStartSquare, null, MOVE_CANCELED_REASON.movedOutOfBoard);
        }
      } else {
        this.view.redrawPieces();
        this.setMoveInputState(MOVE_INPUT_STATE.reset);
      }
    }
    onPointerCancel() {
      this.view.redrawPieces();
      const moveStartSquare = this.fromSquare;
      this.setMoveInputState(MOVE_INPUT_STATE.reset);
      this.moveInputCanceledCallback(moveStartSquare, null, MOVE_CANCELED_REASON.touchCanceled);
    }
    onContextMenu(e) {
      e.preventDefault();
      this.view.redrawPieces();
      this.setMoveInputState(MOVE_INPUT_STATE.reset);
      this.moveInputCanceledCallback(this.fromSquare, null, MOVE_CANCELED_REASON.secondaryClick);
    }
    // Cancel a move input that is currently in progress. No-op when idle.
    cancelMoveInput() {
      if (this.moveInputState !== MOVE_INPUT_STATE.waitForInputStart) {
        const moveStartSquare = this.fromSquare;
        this.view.redrawPieces();
        this.setMoveInputState(MOVE_INPUT_STATE.reset);
        this.moveInputCanceledCallback(moveStartSquare, null, MOVE_CANCELED_REASON.canceled);
      }
    }
    // Called after the board position changed (setPosition/movePiece/setPiece).
    // If the piece we are holding changed on its square — most likely captured
    // by an external position update — cancel the in-progress move input.
    positionChanged() {
      const holdingStates = [
        MOVE_INPUT_STATE.pieceClickedThreshold,
        MOVE_INPUT_STATE.clickTo,
        MOVE_INPUT_STATE.secondClickThreshold,
        MOVE_INPUT_STATE.dragTo,
        MOVE_INPUT_STATE.clickDragTo
      ];
      if (this.fromSquare && holdingStates.includes(this.moveInputState) && this.chessboard.getPiece(this.fromSquare) !== this.movedPiece) {
        const moveStartSquare = this.fromSquare;
        this.movedPiece = null;
        this.setMoveInputState(MOVE_INPUT_STATE.reset);
        this.moveInputCanceledCallback(moveStartSquare, null, MOVE_CANCELED_REASON.movedPieceChanged);
      }
    }
    isDragging() {
      return this.moveInputState === MOVE_INPUT_STATE.dragTo || this.moveInputState === MOVE_INPUT_STATE.clickDragTo;
    }
    destroy() {
      this.setMoveInputState(MOVE_INPUT_STATE.reset);
    }
  };

  // node_modules/cm-chessboard/src/view/ChessboardView.js
  var COLOR = {
    white: "w",
    black: "b"
  };
  var INPUT_EVENT_TYPE = {
    moveInputStarted: "moveInputStarted",
    movingOverSquare: "movingOverSquare",
    // while dragging or hover after click
    validateMoveInput: "validateMoveInput",
    moveInputCanceled: "moveInputCanceled",
    moveInputFinished: "moveInputFinished"
  };
  var POINTER_EVENTS = {
    pointercancel: "pointercancel",
    pointerdown: "pointerdown",
    pointerenter: "pointerenter",
    pointerleave: "pointerleave",
    pointermove: "pointermove",
    pointerout: "pointerout",
    pointerover: "pointerover",
    pointerup: "pointerup"
  };
  var BORDER_TYPE = {
    none: "none",
    // no border
    thin: "thin",
    // thin border
    frame: "frame"
    // wide border with coordinates in it
  };
  var ChessboardView = class {
    constructor(chessboard) {
      this.chessboard = chessboard;
      this.visualMoveInput = new VisualMoveInput(this);
      if (chessboard.props.assetsCache) {
        this.cacheSpriteToDiv("cm-chessboard-sprite", this.getSpriteUrl());
      }
      this.container = document.createElement("div");
      this.chessboard.context.appendChild(this.container);
      if (chessboard.props.responsive) {
        if (typeof ResizeObserver !== "undefined") {
          this.resizeObserver = new ResizeObserver(() => {
            this.resizeTimeout = setTimeout(() => {
              this.resizeTimeout = null;
              this.handleResize();
            });
          });
          this.resizeObserver.observe(this.chessboard.context);
        } else {
          this.resizeListener = this.handleResize.bind(this);
          window.addEventListener("resize", this.resizeListener);
        }
      }
      this.positionsAnimationTask = Promise.resolve();
      this.pointerDownListener = this.pointerDownHandler.bind(this);
      this.container.addEventListener("mousedown", this.pointerDownListener);
      this.container.addEventListener("touchstart", this.pointerDownListener, { passive: false });
      this.contextMenuListener = (e) => e.preventDefault();
      this.container.addEventListener("contextmenu", this.contextMenuListener);
      this.createSvgAndGroups();
      this.handleResize();
    }
    pointerDownHandler(e) {
      this.visualMoveInput.onPointerDown(e);
    }
    destroy() {
      this.visualMoveInput.destroy();
      if (this.resizeObserver) {
        this.resizeObserver.unobserve(this.chessboard.context);
      }
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = null;
      }
      if (this.resizeListener) {
        window.removeEventListener("resize", this.resizeListener);
      }
      this.container.removeEventListener("mousedown", this.pointerDownListener);
      this.container.removeEventListener("touchstart", this.pointerDownListener);
      this.container.removeEventListener("contextmenu", this.contextMenuListener);
      Svg.removeElement(this.svg);
      this.container.remove();
    }
    // Sprite //
    cacheSpriteToDiv(wrapperId, url) {
      if (!document.getElementById(wrapperId)) {
        const wrapper = document.createElement("div");
        wrapper.style.transform = "scale(0)";
        wrapper.style.position = "absolute";
        wrapper.setAttribute("aria-hidden", "true");
        wrapper.id = wrapperId;
        document.body.appendChild(wrapper);
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.onload = function() {
          wrapper.insertAdjacentHTML("afterbegin", xhr.response);
        };
        xhr.send();
      }
    }
    createSvgAndGroups() {
      this.svg = Svg.createSvg(this.container);
      let cssClass = this.chessboard.props.style.cssClass ? this.chessboard.props.style.cssClass : "default";
      this.svg.setAttribute("class", "cm-chessboard border-type-" + this.chessboard.props.style.borderType + " " + cssClass);
      this.svg.setAttribute("role", "img");
      this.updateMetrics();
      this.boardGroup = Svg.addElement(this.svg, "g", { class: "board" });
      this.coordinatesGroup = Svg.addElement(this.svg, "g", { class: "coordinates", "aria-hidden": "true" });
      this.markersLayer = Svg.addElement(this.svg, "g", { class: "markers-layer" });
      this.piecesLayer = Svg.addElement(this.svg, "g", { class: "pieces-layer" });
      this.piecesGroup = Svg.addElement(this.piecesLayer, "g", { class: "pieces" });
      this.markersTopLayer = Svg.addElement(this.svg, "g", { class: "markers-top-layer" });
      this.interactiveTopLayer = Svg.addElement(this.svg, "g", { class: "interactive-top-layer" });
    }
    updateMetrics() {
      const piecesTileSize = this.chessboard.props.style.pieces.tileSize;
      this.width = this.container.clientWidth;
      this.height = this.container.clientWidth * (this.chessboard.props.style.aspectRatio || 1);
      if (this.chessboard.props.style.borderType === BORDER_TYPE.frame) {
        this.borderSize = this.width / 25;
      } else if (this.chessboard.props.style.borderType === BORDER_TYPE.thin) {
        this.borderSize = this.width / 320;
      } else {
        this.borderSize = 0;
      }
      this.innerWidth = this.width - 2 * this.borderSize;
      this.innerHeight = this.height - 2 * this.borderSize;
      this.squareWidth = this.innerWidth / 8;
      this.squareHeight = this.innerHeight / 8;
      this.scalingX = this.squareWidth / piecesTileSize;
      this.scalingY = this.squareHeight / piecesTileSize;
      this.pieceXTranslate = this.squareWidth / 2 - piecesTileSize * this.scalingY / 2;
    }
    handleResize() {
      if (!this.chessboard || !this.chessboard.state) {
        return;
      }
      this.container.style.width = this.chessboard.context.clientWidth + "px";
      this.container.style.height = this.chessboard.context.clientWidth * this.chessboard.props.style.aspectRatio + "px";
      if (this.container.clientWidth !== this.width || this.container.clientHeight !== this.height) {
        this.updateMetrics();
        this.redrawBoard();
        this.redrawPieces();
      }
      this.svg.setAttribute("width", "100%");
      this.svg.setAttribute("height", "100%");
    }
    redrawBoard() {
      this.chessboard.state.invokeExtensionPoints(EXTENSION_POINT.beforeRedrawBoard);
      this.redrawSquares();
      this.drawCoordinates();
      this.chessboard.state.invokeExtensionPoints(EXTENSION_POINT.afterRedrawBoard);
      this.visualizeInputState();
    }
    // Board //
    redrawSquares() {
      while (this.boardGroup.firstChild) {
        this.boardGroup.removeChild(this.boardGroup.lastChild);
      }
      let boardBorder = Svg.addElement(this.boardGroup, "rect", { width: this.width, height: this.height });
      boardBorder.setAttribute("class", "border");
      if (this.chessboard.props.style.borderType === BORDER_TYPE.frame) {
        const innerPos = this.borderSize;
        let borderInner = Svg.addElement(this.boardGroup, "rect", {
          x: innerPos,
          y: innerPos,
          width: this.width - innerPos * 2,
          height: this.height - innerPos * 2
        });
        borderInner.setAttribute("class", "border-inner");
      }
      for (let i = 0; i < 64; i++) {
        const index = this.chessboard.state.orientation === COLOR.white ? i : 63 - i;
        const squareColor = (9 * index & 8) === 0 ? "black" : "white";
        const fieldClass = `square ${squareColor}`;
        const point = this.squareToPoint(Position.indexToSquare(index));
        const squareRect = Svg.addElement(this.boardGroup, "rect", {
          x: point.x,
          y: point.y,
          width: this.squareWidth,
          height: this.squareHeight
        });
        squareRect.setAttribute("class", fieldClass);
        squareRect.setAttribute("data-square", Position.indexToSquare(index));
      }
    }
    drawCoordinates() {
      if (!this.chessboard.props.style.showCoordinates) {
        return;
      }
      while (this.coordinatesGroup.firstChild) {
        this.coordinatesGroup.removeChild(this.coordinatesGroup.lastChild);
      }
      const inline = this.chessboard.props.style.borderType !== BORDER_TYPE.frame;
      for (let file2 = 0; file2 < 8; file2++) {
        let x = this.borderSize + (17 + this.chessboard.props.style.pieces.tileSize * file2) * this.scalingX;
        let y = this.height - this.scalingY * 3.5;
        let cssClass = "coordinate file";
        if (inline) {
          x = x + this.scalingX * 15.5;
          cssClass += file2 % 2 ? " white" : " black";
        }
        const textElement = Svg.addElement(this.coordinatesGroup, "text", {
          class: cssClass,
          x,
          y,
          style: `font-size: ${this.scalingY * 10}px`
        });
        if (this.chessboard.state.orientation === COLOR.white) {
          textElement.textContent = String.fromCharCode(97 + file2);
        } else {
          textElement.textContent = String.fromCharCode(104 - file2);
        }
      }
      for (let rank2 = 0; rank2 < 8; rank2++) {
        let x = this.borderSize / 3.7;
        let y = this.borderSize + 25 * this.scalingY + rank2 * this.squareHeight;
        let cssClass = "coordinate rank";
        if (inline) {
          cssClass += rank2 % 2 ? " black" : " white";
          if (this.chessboard.props.style.borderType === BORDER_TYPE.frame) {
            x = x + this.scalingX * 10;
            y = y - this.scalingY * 15;
          } else {
            x = x + this.scalingX * 2;
            y = y - this.scalingY * 15;
          }
        }
        const textElement = Svg.addElement(this.coordinatesGroup, "text", {
          class: cssClass,
          x,
          y,
          style: `font-size: ${this.scalingY * 10}px`
        });
        if (this.chessboard.state.orientation === COLOR.white) {
          textElement.textContent = "" + (8 - rank2);
        } else {
          textElement.textContent = "" + (1 + rank2);
        }
      }
    }
    // Pieces //
    redrawPieces(squares = this.chessboard.state.position.squares) {
      const childNodes = Array.from(this.piecesGroup.childNodes);
      const isDragging = this.visualMoveInput.isDragging();
      for (let i = 0; i < 64; i++) {
        const pieceName = squares[i];
        if (pieceName) {
          const square = Position.indexToSquare(i);
          this.drawPieceOnSquare(square, pieceName, isDragging && square === this.visualMoveInput.fromSquare);
        }
      }
      for (const childNode of childNodes) {
        this.piecesGroup.removeChild(childNode);
      }
    }
    drawPiece(parentGroup, pieceName, point) {
      const pieceGroup = Svg.addElement(parentGroup, "g", {});
      pieceGroup.setAttribute("data-piece", pieceName);
      const transform = this.svg.createSVGTransform();
      transform.setTranslate(point.x, point.y);
      pieceGroup.transform.baseVal.appendItem(transform);
      const spriteUrl = this.chessboard.props.assetsCache ? "" : this.getSpriteUrl();
      const pieceUse = Svg.addElement(pieceGroup, "use", {
        href: `${spriteUrl}#${pieceName}`,
        class: "piece"
      });
      const transformScale = this.svg.createSVGTransform();
      transformScale.setScale(this.scalingY, this.scalingY);
      pieceUse.transform.baseVal.appendItem(transformScale);
      return pieceGroup;
    }
    drawPieceOnSquare(square, pieceName, hidden = false) {
      const pieceGroup = Svg.addElement(this.piecesGroup, "g", {});
      pieceGroup.setAttribute("data-piece", pieceName);
      pieceGroup.setAttribute("data-square", square);
      if (hidden) {
        pieceGroup.setAttribute("visibility", "hidden");
      }
      const point = this.squareToPoint(square);
      const transform = this.svg.createSVGTransform();
      transform.setTranslate(point.x, point.y);
      pieceGroup.transform.baseVal.appendItem(transform);
      const spriteUrl = this.chessboard.props.assetsCache ? "" : this.getSpriteUrl();
      const pieceUse = Svg.addElement(pieceGroup, "use", {
        href: `${spriteUrl}#${pieceName}`,
        class: "piece"
      });
      const transformTranslate = this.svg.createSVGTransform();
      transformTranslate.setTranslate(this.pieceXTranslate, 0);
      pieceUse.transform.baseVal.appendItem(transformTranslate);
      const transformScale = this.svg.createSVGTransform();
      transformScale.setScale(this.scalingY, this.scalingY);
      pieceUse.transform.baseVal.appendItem(transformScale);
      return pieceGroup;
    }
    setPieceVisibility(square, visible = true) {
      const piece = this.getPieceElement(square);
      if (piece) {
        if (visible) {
          piece.setAttribute("visibility", "visible");
        } else {
          piece.setAttribute("visibility", "hidden");
        }
      } else {
        console.warn("no piece on", square);
      }
    }
    getPieceElement(square) {
      if (!square || square.length < 2) {
        console.warn("invalid square", square);
        return null;
      }
      const piece = this.piecesGroup.querySelector(`g[data-square='${square}']`);
      if (!piece) {
        console.warn("no piece on", square);
        return null;
      }
      return piece;
    }
    // enable and disable move input //
    enableMoveInput(eventHandler, color = null) {
      if (this.chessboard.state.moveInputCallback) {
        throw Error("moveInput already enabled");
      }
      if (color === COLOR.white) {
        this.chessboard.state.inputWhiteEnabled = true;
      } else if (color === COLOR.black) {
        this.chessboard.state.inputBlackEnabled = true;
      } else {
        this.chessboard.state.inputWhiteEnabled = true;
        this.chessboard.state.inputBlackEnabled = true;
      }
      this.chessboard.state.moveInputCallback = eventHandler;
      this.chessboard.state.invokeExtensionPoints(EXTENSION_POINT.moveInputToggled, { enabled: true, color });
      this.visualizeInputState();
    }
    disableMoveInput() {
      this.chessboard.state.inputWhiteEnabled = false;
      this.chessboard.state.inputBlackEnabled = false;
      this.chessboard.state.moveInputCallback = null;
      this.chessboard.state.invokeExtensionPoints(EXTENSION_POINT.moveInputToggled, { enabled: false });
      this.visualizeInputState();
    }
    // callbacks //
    moveInputStartedCallback(square) {
      const data = {
        chessboard: this.chessboard,
        type: INPUT_EVENT_TYPE.moveInputStarted,
        square,
        /** square is deprecated, use squareFrom (2023-05-22) */
        squareFrom: square,
        piece: this.chessboard.getPiece(square)
      };
      if (this.chessboard.state.moveInputCallback) {
        data.moveInputCallbackResult = this.chessboard.state.moveInputCallback(data);
      }
      this.chessboard.state.invokeExtensionPoints(EXTENSION_POINT.moveInput, data);
      return data.moveInputCallbackResult;
    }
    movingOverSquareCallback(squareFrom, squareTo) {
      const data = {
        chessboard: this.chessboard,
        type: INPUT_EVENT_TYPE.movingOverSquare,
        squareFrom,
        squareTo,
        piece: this.chessboard.getPiece(squareFrom)
      };
      if (this.chessboard.state.moveInputCallback) {
        data.moveInputCallbackResult = this.chessboard.state.moveInputCallback(data);
      }
      this.chessboard.state.invokeExtensionPoints(EXTENSION_POINT.moveInput, data);
    }
    validateMoveInputCallback(squareFrom, squareTo) {
      const data = {
        chessboard: this.chessboard,
        type: INPUT_EVENT_TYPE.validateMoveInput,
        squareFrom,
        squareTo,
        piece: this.chessboard.getPiece(squareFrom)
      };
      if (this.chessboard.state.moveInputCallback) {
        data.moveInputCallbackResult = this.chessboard.state.moveInputCallback(data);
      }
      this.chessboard.state.moveInputAnimate = data.animate;
      this.chessboard.state.invokeExtensionPoints(EXTENSION_POINT.moveInput, data);
      return data.moveInputCallbackResult;
    }
    moveInputCanceledCallback(squareFrom, squareTo, reason) {
      const data = {
        chessboard: this.chessboard,
        type: INPUT_EVENT_TYPE.moveInputCanceled,
        reason,
        squareFrom,
        squareTo
      };
      if (this.chessboard.state.moveInputCallback) {
        this.chessboard.state.moveInputCallback(data);
      }
      this.chessboard.state.invokeExtensionPoints(EXTENSION_POINT.moveInput, data);
    }
    moveInputFinishedCallback(squareFrom, squareTo, legalMove) {
      const data = {
        chessboard: this.chessboard,
        type: INPUT_EVENT_TYPE.moveInputFinished,
        squareFrom,
        squareTo,
        legalMove
      };
      if (this.chessboard.state.moveInputCallback) {
        this.chessboard.state.moveInputCallback(data);
      }
      this.chessboard.state.invokeExtensionPoints(EXTENSION_POINT.moveInput, data);
    }
    // Helpers //
    visualizeInputState() {
      if (this.chessboard.state) {
        if (this.chessboard.state.inputWhiteEnabled || this.chessboard.state.inputBlackEnabled) {
          this.boardGroup.setAttribute("class", "board input-enabled");
        } else {
          this.boardGroup.setAttribute("class", "board");
        }
      }
    }
    indexToPoint(index) {
      let x, y;
      if (this.chessboard.state.orientation === COLOR.white) {
        x = this.borderSize + index % 8 * this.squareWidth;
        y = this.borderSize + (7 - Math.floor(index / 8)) * this.squareHeight;
      } else {
        x = this.borderSize + (7 - index % 8) * this.squareWidth;
        y = this.borderSize + Math.floor(index / 8) * this.squareHeight;
      }
      return { x, y };
    }
    squareToPoint(square) {
      const index = Position.squareToIndex(square);
      return this.indexToPoint(index);
    }
    getSpriteUrl() {
      if (Utils.isAbsoluteUrl(this.chessboard.props.style.pieces.file)) {
        return this.chessboard.props.style.pieces.file;
      } else {
        return this.chessboard.props.assetsUrl + this.chessboard.props.style.pieces.file;
      }
    }
  };

  // node_modules/cm-chessboard/src/Chessboard.js
  var PIECES_FILE_TYPE = {
    svgSprite: "svgSprite"
  };
  var Chessboard = class {
    constructor(context, props = {}) {
      if (!context) {
        throw new Error("container element is " + context);
      }
      this.context = context;
      this.id = (Math.random() + 1).toString(36).substring(2, 8);
      this.extensions = [];
      this.props = {
        position: FEN.empty,
        // set position as fen, use FEN.start or FEN.empty as shortcuts
        orientation: COLOR.white,
        // white on bottom
        responsive: true,
        // resize the board automatically to the size of the context element
        assetsUrl: "./assets/",
        // put all css and sprites in this folder, will be ignored for absolute urls of assets files
        assetsCache: true,
        // cache the sprites, deactivate if you want to use multiple pieces sets in one page
        style: {
          cssClass: "default",
          // set the css theme of the board, try "green", "blue" or "chess-club"
          showCoordinates: true,
          // show ranks and files
          borderType: BORDER_TYPE.none,
          // "thin" thin border, "frame" wide border with coordinates in it, "none" no border
          aspectRatio: 1,
          // height/width of the board
          pieces: {
            type: PIECES_FILE_TYPE.svgSprite,
            // pieces are in an SVG sprite, no other type supported for now
            file: "pieces/standard.svg",
            // the filename of the sprite in `assets/pieces/` or an absolute url like `https://…` or `/…`
            tileSize: 40
            // the tile size in the sprite
          },
          animationDuration: 300
          // pieces animation duration in milliseconds. Disable all animations with `0`
        },
        extensions: [
          /* {class: ExtensionClass, props: { ... }} */
        ]
        // add extensions here
      };
      Utils.mergeObjects(this.props, props);
      this.state = new ChessboardState();
      this.view = new ChessboardView(this);
      this.positionAnimationsQueue = new PositionAnimationsQueue(this);
      this.state.orientation = this.props.orientation;
      for (const extensionData of this.props.extensions) {
        this.addExtension(extensionData.class, extensionData.props);
      }
      this.view.redrawBoard();
      this.state.position = new Position(this.props.position);
      this.view.redrawPieces();
      this.state.invokeExtensionPoints(EXTENSION_POINT.positionChanged);
      this.initialized = Promise.resolve();
    }
    // API //
    async setPiece(square, piece, animated = false) {
      const positionFrom = this.state.position.clone();
      this.state.position.setPiece(square, piece);
      this.view.visualMoveInput.positionChanged();
      this.state.invokeExtensionPoints(EXTENSION_POINT.positionChanged);
      return this.positionAnimationsQueue.enqueuePositionChange(positionFrom, this.state.position.clone(), animated);
    }
    async movePiece(squareFrom, squareTo, animated = false) {
      const positionFrom = this.state.position.clone();
      this.state.position.movePiece(squareFrom, squareTo);
      this.view.visualMoveInput.positionChanged();
      this.state.invokeExtensionPoints(EXTENSION_POINT.positionChanged);
      return this.positionAnimationsQueue.enqueuePositionChange(positionFrom, this.state.position.clone(), animated);
    }
    async setPosition(fen, animated = false) {
      const positionFrom = this.state.position.clone();
      const positionTo = new Position(fen);
      if (positionFrom.getFen() !== positionTo.getFen()) {
        this.state.position.setFen(fen);
        this.view.visualMoveInput.positionChanged();
        this.state.invokeExtensionPoints(EXTENSION_POINT.positionChanged);
      }
      return this.positionAnimationsQueue.enqueuePositionChange(positionFrom, this.state.position.clone(), animated);
    }
    async setOrientation(color, animated = false) {
      const position = this.state.position.clone();
      if (this.boardTurning) {
        console.warn("setOrientation is only once in queue allowed");
        return;
      }
      this.boardTurning = true;
      return this.positionAnimationsQueue.enqueueTurnBoard(position, color, animated).then(() => {
        this.boardTurning = false;
        this.state.invokeExtensionPoints(EXTENSION_POINT.boardChanged);
      });
    }
    getPiece(square) {
      return this.state.position.getPiece(square);
    }
    getPosition() {
      return this.state.position.getFen();
    }
    getOrientation() {
      return this.state.orientation;
    }
    enableMoveInput(eventHandler, color = void 0) {
      this.view.enableMoveInput(eventHandler, color);
    }
    disableMoveInput() {
      this.view.disableMoveInput();
    }
    // Cancel a move input that is currently in progress (leaves move input enabled).
    cancelMoveInput() {
      this.view.visualMoveInput.cancelMoveInput();
    }
    isMoveInputEnabled() {
      return this.state.inputWhiteEnabled || this.state.inputBlackEnabled;
    }
    enableSquareSelect(eventType = POINTER_EVENTS.pointerdown, eventHandler) {
      if (!this.squareSelectListener) {
        this.squareSelectListener = function(e) {
          const square = e.target.getAttribute("data-square");
          eventHandler({
            eventType: e.type,
            event: e,
            chessboard: this,
            square
          });
        };
      }
      this.context.addEventListener(eventType, this.squareSelectListener);
      this.state.squareSelectEnabled = true;
      this.view.visualizeInputState();
    }
    disableSquareSelect(eventType) {
      this.context.removeEventListener(eventType, this.squareSelectListener);
      this.squareSelectListener = void 0;
      this.state.squareSelectEnabled = false;
      this.view.visualizeInputState();
    }
    isSquareSelectEnabled() {
      return this.state.squareSelectEnabled;
    }
    addExtension(extensionClass, props) {
      if (this.getExtension(extensionClass)) {
        throw Error('extension "' + extensionClass.name + '" already added');
      }
      this.extensions.push(new extensionClass(this, props));
    }
    getExtension(extensionClass) {
      for (const extension of this.extensions) {
        if (extension instanceof extensionClass) {
          return extension;
        }
      }
      return null;
    }
    destroy() {
      this.state.invokeExtensionPoints(EXTENSION_POINT.destroy);
      this.positionAnimationsQueue.destroy();
      this.view.destroy();
      this.view = void 0;
      this.state = void 0;
    }
  };

  // node_modules/cm-chessboard/src/extensions/arrows/Arrows.js
  var ARROW_TYPE = {
    default: { class: "arrow-success" },
    success: { class: "arrow-success" },
    secondary: { class: "arrow-secondary" },
    warning: { class: "arrow-warning" },
    info: { class: "arrow-info" },
    danger: { class: "arrow-danger" }
  };
  var Arrows = class extends Extension {
    /** @constructor */
    constructor(chessboard, props = {}) {
      super(chessboard);
      this.registerExtensionPoint(EXTENSION_POINT.afterRedrawBoard, () => {
        this.onRedrawBoard();
      });
      this.registerExtensionPoint(EXTENSION_POINT.destroy, () => {
        this.onDestroy();
      });
      this.props = {
        sprite: "extensions/arrows/arrows.svg",
        slice: "arrowDefault",
        headSize: 7,
        offsetFrom: 0,
        offsetTo: 0.55
      };
      Object.assign(this.props, props);
      if (this.chessboard.props.assetsCache) {
        this.chessboard.view.cacheSpriteToDiv("cm-chessboard-arrows", this.getSpriteUrl());
      }
      chessboard.addArrow = this.addArrow.bind(this);
      chessboard.getArrows = this.getArrows.bind(this);
      chessboard.removeArrows = this.removeArrows.bind(this);
      this.arrowGroup = Svg.addElement(chessboard.view.markersTopLayer, "g", { class: "arrows" });
      this.instanceId = Math.random().toString(36).slice(2, 10);
      this.arrows = [];
    }
    onDestroy() {
      this.arrows.length = 0;
      if (this.arrowGroup && this.arrowGroup.parentNode) {
        this.arrowGroup.parentNode.removeChild(this.arrowGroup);
      }
      delete this.chessboard.addArrow;
      delete this.chessboard.getArrows;
      delete this.chessboard.removeArrows;
    }
    onRedrawBoard() {
      while (this.arrowGroup.firstChild) {
        this.arrowGroup.removeChild(this.arrowGroup.firstChild);
      }
      this.arrows.forEach((arrow) => {
        this.drawArrow(arrow);
      });
    }
    drawArrow(arrow) {
      const view = this.chessboard.view;
      const arrowsGroup = Svg.addElement(this.arrowGroup, "g");
      arrowsGroup.setAttribute("data-arrow", arrow.from + arrow.to);
      arrowsGroup.setAttribute("class", "arrow " + arrow.type.class);
      const ptFrom = view.squareToPoint(arrow.from);
      const ptTo = view.squareToPoint(arrow.to);
      const spriteUrl = this.chessboard.props.assetsCache ? "" : this.getSpriteUrl();
      const defs = Svg.addElement(arrowsGroup, "defs");
      const id = "arrow-" + this.instanceId + "-" + arrow.from + arrow.to;
      const marker = Svg.addElement(defs, "marker", {
        id,
        markerWidth: this.props.headSize,
        markerHeight: this.props.headSize,
        refX: 20,
        refY: 20,
        viewBox: "0 0 40 40",
        orient: "auto",
        class: "arrow-head"
      });
      Svg.addElement(marker, "use", {
        href: `${spriteUrl}#${this.props.slice}`
      });
      const cx1 = ptFrom.x + view.squareWidth / 2;
      const cy1 = ptFrom.y + view.squareHeight / 2;
      const cx2 = ptTo.x + view.squareWidth / 2;
      const cy2 = ptTo.y + view.squareHeight / 2;
      const dx = cx2 - cx1;
      const dy = cy2 - cy1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const halfMin = Math.min(view.squareWidth, view.squareHeight) / 2;
      const clamp01 = (v) => Math.max(0, Math.min(1, v));
      const rFrom = halfMin * clamp01(this.props.offsetFrom);
      const rTo = halfMin * clamp01(this.props.offsetTo);
      const x1 = cx1 + ux * rFrom;
      const y1 = cy1 + uy * rFrom;
      const x2 = cx2 - ux * rTo;
      const y2 = cy2 - uy * rTo;
      const width = (view.scalingX + view.scalingY) / 2 * 8;
      let lineFill = Svg.addElement(arrowsGroup, "line");
      lineFill.setAttribute("x1", x1.toString());
      lineFill.setAttribute("x2", x2.toString());
      lineFill.setAttribute("y1", y1.toString());
      lineFill.setAttribute("y2", y2.toString());
      lineFill.setAttribute("class", "arrow-line");
      lineFill.setAttribute("marker-end", "url(#" + id + ")");
      lineFill.setAttribute("stroke-width", width + "px");
    }
    addArrow(type, from, to) {
      this.arrows.push(new Arrow(from, to, type));
      this.onRedrawBoard();
    }
    getArrows(type = void 0, from = void 0, to = void 0) {
      let arrows = [];
      this.arrows.forEach((arrow) => {
        if (arrow.matches(from, to, type)) {
          arrows.push(arrow);
        }
      });
      return arrows;
    }
    removeArrows(type = void 0, from = void 0, to = void 0) {
      this.arrows = this.arrows.filter((arrow) => !arrow.matches(from, to, type));
      this.onRedrawBoard();
    }
    getSpriteUrl() {
      if (Utils.isAbsoluteUrl(this.props.sprite)) {
        return this.props.sprite;
      } else {
        return this.chessboard.props.assetsUrl + this.props.sprite;
      }
    }
  };
  var Arrow = class {
    constructor(from, to, type) {
      this.from = from;
      this.to = to;
      this.type = type;
    }
    matches(from = void 0, to = void 0, type = void 0) {
      if (from && from !== this.from) {
        return false;
      }
      if (to && to !== this.to) {
        return false;
      }
      return !(type && type !== this.type);
    }
  };

  // node_modules/cm-chessboard/src/extensions/markers/Markers.js
  var MARKER_TYPE = {
    frame: { class: "marker-frame", slice: "markerFrame" },
    framePrimary: { class: "marker-frame-primary", slice: "markerFrame" },
    frameDanger: { class: "marker-frame-danger", slice: "markerFrame" },
    circle: { class: "marker-circle", slice: "markerCircle" },
    circlePrimary: { class: "marker-circle-primary", slice: "markerCircle" },
    circleDanger: { class: "marker-circle-danger", slice: "markerCircle" },
    circleDangerFilled: { class: "marker-circle-danger-filled", slice: "markerCircleFilled" },
    square: { class: "marker-square", slice: "markerSquare" },
    dot: { class: "marker-dot", slice: "markerDot", position: "above" },
    bevel: { class: "marker-bevel", slice: "markerBevel" }
  };
  var Markers = class extends Extension {
    /** @constructor */
    constructor(chessboard, props = {}) {
      super(chessboard);
      this.registerExtensionPoint(EXTENSION_POINT.afterRedrawBoard, () => {
        this.onRedrawBoard();
      });
      this.registerExtensionPoint(EXTENSION_POINT.destroy, () => {
        this.onDestroy();
      });
      this.props = {
        autoMarkers: MARKER_TYPE.frame,
        // set to `null` to disable autoMarkers
        sprite: "extensions/markers/markers.svg"
        // the sprite file of the markers
      };
      Object.assign(this.props, props);
      if (chessboard.props.assetsCache) {
        chessboard.view.cacheSpriteToDiv("cm-chessboard-markers", this.getSpriteUrl());
      }
      chessboard.addMarker = this.addMarker.bind(this);
      chessboard.getMarkers = this.getMarkers.bind(this);
      chessboard.removeMarkers = this.removeMarkers.bind(this);
      chessboard.addLegalMovesMarkers = this.addLegalMovesMarkers.bind(this);
      chessboard.removeLegalMovesMarkers = this.removeLegalMovesMarkers.bind(this);
      this.markerGroupDown = Svg.addElement(chessboard.view.markersLayer, "g", { class: "markers" });
      this.markerGroupUp = Svg.addElement(chessboard.view.markersTopLayer, "g", { class: "markers" });
      this.markers = [];
      if (this.props.autoMarkers) {
        Object.assign(this.props.autoMarkers, this.props.autoMarkers);
        this.registerExtensionPoint(EXTENSION_POINT.moveInput, (event) => {
          this.drawAutoMarkers(event);
        });
      }
    }
    onDestroy() {
      this.markers.length = 0;
      if (this.markerGroupDown && this.markerGroupDown.parentNode) {
        this.markerGroupDown.parentNode.removeChild(this.markerGroupDown);
      }
      if (this.markerGroupUp && this.markerGroupUp.parentNode) {
        this.markerGroupUp.parentNode.removeChild(this.markerGroupUp);
      }
      delete this.chessboard.addMarker;
      delete this.chessboard.getMarkers;
      delete this.chessboard.removeMarkers;
      delete this.chessboard.addLegalMovesMarkers;
      delete this.chessboard.removeLegalMovesMarkers;
    }
    drawAutoMarkers(event) {
      if (event.type !== INPUT_EVENT_TYPE.moveInputFinished) {
        this.removeMarkers(this.props.autoMarkers);
      }
      if (event.type === INPUT_EVENT_TYPE.moveInputStarted && !event.moveInputCallbackResult) {
        return;
      }
      if (event.type === INPUT_EVENT_TYPE.moveInputStarted || event.type === INPUT_EVENT_TYPE.movingOverSquare) {
        if (event.squareFrom) {
          this.addMarker(this.props.autoMarkers, event.squareFrom);
        }
        if (event.squareTo) {
          this.addMarker(this.props.autoMarkers, event.squareTo);
        }
      }
    }
    onRedrawBoard() {
      while (this.markerGroupUp.firstChild) {
        this.markerGroupUp.removeChild(this.markerGroupUp.firstChild);
      }
      while (this.markerGroupDown.firstChild) {
        this.markerGroupDown.removeChild(this.markerGroupDown.firstChild);
      }
      this.markers.forEach(
        (marker) => {
          this.drawMarker(marker);
        }
      );
    }
    addLegalMovesMarkers(moves) {
      this.batchUpdate = true;
      try {
        for (const move of moves) {
          if (move.promotion && move.promotion !== "q") {
            continue;
          }
          if (this.chessboard.getPiece(move.to)) {
            this.chessboard.addMarker(MARKER_TYPE.bevel, move.to);
          } else {
            this.chessboard.addMarker(MARKER_TYPE.dot, move.to);
          }
        }
      } finally {
        this.batchUpdate = false;
        this.onRedrawBoard();
      }
    }
    removeLegalMovesMarkers() {
      this.batchUpdate = true;
      try {
        this.chessboard.removeMarkers(MARKER_TYPE.bevel);
        this.chessboard.removeMarkers(MARKER_TYPE.dot);
      } finally {
        this.batchUpdate = false;
        this.onRedrawBoard();
      }
    }
    drawMarker(marker) {
      let markerGroup;
      if (marker.type.position === "above") {
        markerGroup = Svg.addElement(this.markerGroupUp, "g");
      } else {
        markerGroup = Svg.addElement(this.markerGroupDown, "g");
      }
      markerGroup.setAttribute("data-square", marker.square);
      const point = this.chessboard.view.squareToPoint(marker.square);
      const transform = this.chessboard.view.svg.createSVGTransform();
      transform.setTranslate(point.x, point.y);
      markerGroup.transform.baseVal.appendItem(transform);
      const spriteUrl = this.chessboard.props.assetsCache ? "" : this.getSpriteUrl();
      const markerUse = Svg.addElement(
        markerGroup,
        "use",
        { href: `${spriteUrl}#${marker.type.slice}`, class: "marker " + marker.type.class }
      );
      const transformScale = this.chessboard.view.svg.createSVGTransform();
      transformScale.setScale(this.chessboard.view.scalingX, this.chessboard.view.scalingY);
      markerUse.transform.baseVal.appendItem(transformScale);
      return markerGroup;
    }
    addMarker(type, square) {
      if (typeof type === "string" || typeof square === "object") {
        console.error("changed the signature of `addMarker` to `(type, square)` with v5.1.x");
        return;
      }
      this.markers.push(new Marker(square, type));
      if (!this.batchUpdate) {
        this.onRedrawBoard();
      }
    }
    getMarkers(type = void 0, square = void 0) {
      if (typeof type === "string" || typeof square === "object") {
        console.error("changed the signature of `getMarkers` to `(type, square)` with v5.1.x");
        return;
      }
      let markersFound = [];
      this.markers.forEach((marker) => {
        if (marker.matches(square, type)) {
          markersFound.push(marker);
        }
      });
      return markersFound;
    }
    removeMarkers(type = void 0, square = void 0) {
      if (typeof type === "string" || typeof square === "object") {
        console.error("changed the signature of `removeMarkers` to `(type, square)` with v5.1.x");
        return;
      }
      this.markers = this.markers.filter((marker) => !marker.matches(square, type));
      if (!this.batchUpdate) {
        this.onRedrawBoard();
      }
    }
    getSpriteUrl() {
      if (Utils.isAbsoluteUrl(this.props.sprite)) {
        return this.props.sprite;
      } else {
        return this.chessboard.props.assetsUrl + this.props.sprite;
      }
    }
  };
  var Marker = class {
    constructor(square, type) {
      this.square = square;
      this.type = type;
    }
    matches(square = void 0, type = void 0) {
      if (!type && !square) {
        return true;
      } else if (!type) {
        if (square === this.square) {
          return true;
        }
      } else if (!square) {
        if (this.type === type) {
          return true;
        }
      } else if (this.type === type && square === this.square) {
        return true;
      }
      return false;
    }
  };

  // node_modules/chess.js/dist/esm/chess.js
  function rootNode(comment) {
    return comment !== null ? { comment, variations: [] } : { variations: [] };
  }
  function node(move, suffix, nag, comment, variations) {
    const node2 = { move, variations };
    if (suffix) {
      node2.suffix = suffix;
    }
    if (nag) {
      node2.nag = nag;
    }
    if (comment !== null) {
      node2.comment = comment;
    }
    return node2;
  }
  function lineToTree(...nodes) {
    const [root, ...rest] = nodes;
    let parent = root;
    for (const child of rest) {
      if (child !== null) {
        parent.variations = [child, ...child.variations];
        child.variations = [];
        parent = child;
      }
    }
    return root;
  }
  function pgn(headers, game) {
    if (game.marker && game.marker.comment) {
      let node2 = game.root;
      while (true) {
        const next = node2.variations[0];
        if (!next) {
          node2.comment = game.marker.comment;
          break;
        }
        node2 = next;
      }
    }
    return {
      headers,
      root: game.root,
      result: (game.marker && game.marker.result) ?? void 0
    };
  }
  function peg$subclass(child, parent) {
    function C() {
      this.constructor = child;
    }
    C.prototype = parent.prototype;
    child.prototype = new C();
  }
  function peg$SyntaxError(message, expected, found, location) {
    var self = Error.call(this, message);
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(self, peg$SyntaxError.prototype);
    }
    self.expected = expected;
    self.found = found;
    self.location = location;
    self.name = "SyntaxError";
    return self;
  }
  peg$subclass(peg$SyntaxError, Error);
  function peg$padEnd(str, targetLength, padString) {
    padString = padString || " ";
    if (str.length > targetLength) {
      return str;
    }
    targetLength -= str.length;
    padString += padString.repeat(targetLength);
    return str + padString.slice(0, targetLength);
  }
  peg$SyntaxError.prototype.format = function(sources) {
    var str = "Error: " + this.message;
    if (this.location) {
      var src = null;
      var k;
      for (k = 0; k < sources.length; k++) {
        if (sources[k].source === this.location.source) {
          src = sources[k].text.split(/\r\n|\n|\r/g);
          break;
        }
      }
      var s = this.location.start;
      var offset_s = this.location.source && typeof this.location.source.offset === "function" ? this.location.source.offset(s) : s;
      var loc = this.location.source + ":" + offset_s.line + ":" + offset_s.column;
      if (src) {
        var e = this.location.end;
        var filler = peg$padEnd("", offset_s.line.toString().length, " ");
        var line = src[s.line - 1];
        var last = s.line === e.line ? e.column : line.length + 1;
        var hatLen = last - s.column || 1;
        str += "\n --> " + loc + "\n" + filler + " |\n" + offset_s.line + " | " + line + "\n" + filler + " | " + peg$padEnd("", s.column - 1, " ") + peg$padEnd("", hatLen, "^");
      } else {
        str += "\n at " + loc;
      }
    }
    return str;
  };
  peg$SyntaxError.buildMessage = function(expected, found) {
    var DESCRIBE_EXPECTATION_FNS = {
      literal: function(expectation) {
        return '"' + literalEscape(expectation.text) + '"';
      },
      class: function(expectation) {
        var escapedParts = expectation.parts.map(function(part) {
          return Array.isArray(part) ? classEscape(part[0]) + "-" + classEscape(part[1]) : classEscape(part);
        });
        return "[" + (expectation.inverted ? "^" : "") + escapedParts.join("") + "]";
      },
      any: function() {
        return "any character";
      },
      end: function() {
        return "end of input";
      },
      other: function(expectation) {
        return expectation.description;
      }
    };
    function hex(ch) {
      return ch.charCodeAt(0).toString(16).toUpperCase();
    }
    function literalEscape(s) {
      return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(ch) {
        return "\\x0" + hex(ch);
      }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) {
        return "\\x" + hex(ch);
      });
    }
    function classEscape(s) {
      return s.replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\^/g, "\\^").replace(/-/g, "\\-").replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(ch) {
        return "\\x0" + hex(ch);
      }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) {
        return "\\x" + hex(ch);
      });
    }
    function describeExpectation(expectation) {
      return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
    }
    function describeExpected(expected2) {
      var descriptions = expected2.map(describeExpectation);
      var i, j;
      descriptions.sort();
      if (descriptions.length > 0) {
        for (i = 1, j = 1; i < descriptions.length; i++) {
          if (descriptions[i - 1] !== descriptions[i]) {
            descriptions[j] = descriptions[i];
            j++;
          }
        }
        descriptions.length = j;
      }
      switch (descriptions.length) {
        case 1:
          return descriptions[0];
        case 2:
          return descriptions[0] + " or " + descriptions[1];
        default:
          return descriptions.slice(0, -1).join(", ") + ", or " + descriptions[descriptions.length - 1];
      }
    }
    function describeFound(found2) {
      return found2 ? '"' + literalEscape(found2) + '"' : "end of input";
    }
    return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
  };
  function peg$parse(input, options) {
    options = options !== void 0 ? options : {};
    var peg$FAILED = {};
    var peg$source = options.grammarSource;
    var peg$startRuleFunctions = { pgn: peg$parsepgn };
    var peg$startRuleFunction = peg$parsepgn;
    var peg$c0 = "[";
    var peg$c1 = '"';
    var peg$c2 = "]";
    var peg$c3 = ".";
    var peg$c4 = "O-O-O";
    var peg$c5 = "O-O";
    var peg$c6 = "0-0-0";
    var peg$c7 = "0-0";
    var peg$c8 = "$";
    var peg$c9 = "{";
    var peg$c10 = "}";
    var peg$c11 = ";";
    var peg$c12 = "(";
    var peg$c13 = ")";
    var peg$c14 = "1-0";
    var peg$c15 = "0-1";
    var peg$c16 = "1/2-1/2";
    var peg$c17 = "*";
    var peg$r0 = /^[a-zA-Z]/;
    var peg$r1 = /^[^"]/;
    var peg$r2 = /^[0-9]/;
    var peg$r3 = /^[.]/;
    var peg$r4 = /^[a-zA-Z1-8\-=]/;
    var peg$r5 = /^[+#]/;
    var peg$r6 = /^[!?]/;
    var peg$r7 = /^[^}]/;
    var peg$r8 = /^[^\r\n]/;
    var peg$r9 = /^[ \t\r\n]/;
    var peg$e0 = peg$otherExpectation("tag pair");
    var peg$e1 = peg$literalExpectation("[", false);
    var peg$e2 = peg$literalExpectation('"', false);
    var peg$e3 = peg$literalExpectation("]", false);
    var peg$e4 = peg$otherExpectation("tag name");
    var peg$e5 = peg$classExpectation([["a", "z"], ["A", "Z"]], false, false);
    var peg$e6 = peg$otherExpectation("tag value");
    var peg$e7 = peg$classExpectation(['"'], true, false);
    var peg$e8 = peg$otherExpectation("move number");
    var peg$e9 = peg$classExpectation([["0", "9"]], false, false);
    var peg$e10 = peg$literalExpectation(".", false);
    var peg$e11 = peg$classExpectation(["."], false, false);
    var peg$e12 = peg$otherExpectation("standard algebraic notation");
    var peg$e13 = peg$literalExpectation("O-O-O", false);
    var peg$e14 = peg$literalExpectation("O-O", false);
    var peg$e15 = peg$literalExpectation("0-0-0", false);
    var peg$e16 = peg$literalExpectation("0-0", false);
    var peg$e17 = peg$classExpectation([["a", "z"], ["A", "Z"], ["1", "8"], "-", "="], false, false);
    var peg$e18 = peg$classExpectation(["+", "#"], false, false);
    var peg$e19 = peg$otherExpectation("suffix annotation");
    var peg$e20 = peg$classExpectation(["!", "?"], false, false);
    var peg$e21 = peg$otherExpectation("NAG");
    var peg$e22 = peg$literalExpectation("$", false);
    var peg$e23 = peg$otherExpectation("brace comment");
    var peg$e24 = peg$literalExpectation("{", false);
    var peg$e25 = peg$classExpectation(["}"], true, false);
    var peg$e26 = peg$literalExpectation("}", false);
    var peg$e27 = peg$otherExpectation("rest of line comment");
    var peg$e28 = peg$literalExpectation(";", false);
    var peg$e29 = peg$classExpectation(["\r", "\n"], true, false);
    var peg$e30 = peg$otherExpectation("variation");
    var peg$e31 = peg$literalExpectation("(", false);
    var peg$e32 = peg$literalExpectation(")", false);
    var peg$e33 = peg$otherExpectation("game termination marker");
    var peg$e34 = peg$literalExpectation("1-0", false);
    var peg$e35 = peg$literalExpectation("0-1", false);
    var peg$e36 = peg$literalExpectation("1/2-1/2", false);
    var peg$e37 = peg$literalExpectation("*", false);
    var peg$e38 = peg$otherExpectation("whitespace");
    var peg$e39 = peg$classExpectation([" ", "	", "\r", "\n"], false, false);
    var peg$f0 = function(headers, game) {
      return pgn(headers, game);
    };
    var peg$f1 = function(tagPairs) {
      return Object.fromEntries(tagPairs);
    };
    var peg$f2 = function(tagName, tagValue) {
      return [tagName, tagValue];
    };
    var peg$f3 = function(root, marker) {
      return { root, marker };
    };
    var peg$f4 = function(comment, moves) {
      return lineToTree(rootNode(comment), ...moves.flat());
    };
    var peg$f5 = function(san, suffix, nag, comment, variations) {
      return node(san, suffix, nag, comment, variations);
    };
    var peg$f6 = function(nag) {
      return nag;
    };
    var peg$f7 = function(comment) {
      return comment.replace(/[\r\n]+/g, " ");
    };
    var peg$f8 = function(comment) {
      return comment.trim();
    };
    var peg$f9 = function(line) {
      return line;
    };
    var peg$f10 = function(result, comment) {
      return { result, comment };
    };
    var peg$currPos = options.peg$currPos | 0;
    var peg$posDetailsCache = [{ line: 1, column: 1 }];
    var peg$maxFailPos = peg$currPos;
    var peg$maxFailExpected = options.peg$maxFailExpected || [];
    var peg$silentFails = options.peg$silentFails | 0;
    var peg$result;
    if (options.startRule) {
      if (!(options.startRule in peg$startRuleFunctions)) {
        throw new Error(`Can't start parsing from rule "` + options.startRule + '".');
      }
      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
    }
    function peg$literalExpectation(text, ignoreCase) {
      return { type: "literal", text, ignoreCase };
    }
    function peg$classExpectation(parts, inverted, ignoreCase) {
      return { type: "class", parts, inverted, ignoreCase };
    }
    function peg$endExpectation() {
      return { type: "end" };
    }
    function peg$otherExpectation(description) {
      return { type: "other", description };
    }
    function peg$computePosDetails(pos) {
      var details = peg$posDetailsCache[pos];
      var p;
      if (details) {
        return details;
      } else {
        if (pos >= peg$posDetailsCache.length) {
          p = peg$posDetailsCache.length - 1;
        } else {
          p = pos;
          while (!peg$posDetailsCache[--p]) {
          }
        }
        details = peg$posDetailsCache[p];
        details = {
          line: details.line,
          column: details.column
        };
        while (p < pos) {
          if (input.charCodeAt(p) === 10) {
            details.line++;
            details.column = 1;
          } else {
            details.column++;
          }
          p++;
        }
        peg$posDetailsCache[pos] = details;
        return details;
      }
    }
    function peg$computeLocation(startPos, endPos, offset) {
      var startPosDetails = peg$computePosDetails(startPos);
      var endPosDetails = peg$computePosDetails(endPos);
      var res = {
        source: peg$source,
        start: {
          offset: startPos,
          line: startPosDetails.line,
          column: startPosDetails.column
        },
        end: {
          offset: endPos,
          line: endPosDetails.line,
          column: endPosDetails.column
        }
      };
      return res;
    }
    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) {
        return;
      }
      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }
      peg$maxFailExpected.push(expected);
    }
    function peg$buildStructuredError(expected, found, location) {
      return new peg$SyntaxError(
        peg$SyntaxError.buildMessage(expected, found),
        expected,
        found,
        location
      );
    }
    function peg$parsepgn() {
      var s0, s1, s2;
      s0 = peg$currPos;
      s1 = peg$parsetagPairSection();
      s2 = peg$parsemoveTextSection();
      s0 = peg$f0(s1, s2);
      return s0;
    }
    function peg$parsetagPairSection() {
      var s0, s1, s2;
      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parsetagPair();
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parsetagPair();
      }
      s2 = peg$parse_();
      s0 = peg$f1(s1);
      return s0;
    }
    function peg$parsetagPair() {
      var s0, s2, s4, s6, s7, s8, s10;
      peg$silentFails++;
      s0 = peg$currPos;
      peg$parse_();
      if (input.charCodeAt(peg$currPos) === 91) {
        s2 = peg$c0;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e1);
        }
      }
      if (s2 !== peg$FAILED) {
        peg$parse_();
        s4 = peg$parsetagName();
        if (s4 !== peg$FAILED) {
          peg$parse_();
          if (input.charCodeAt(peg$currPos) === 34) {
            s6 = peg$c1;
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e2);
            }
          }
          if (s6 !== peg$FAILED) {
            s7 = peg$parsetagValue();
            if (input.charCodeAt(peg$currPos) === 34) {
              s8 = peg$c1;
              peg$currPos++;
            } else {
              s8 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e2);
              }
            }
            if (s8 !== peg$FAILED) {
              peg$parse_();
              if (input.charCodeAt(peg$currPos) === 93) {
                s10 = peg$c2;
                peg$currPos++;
              } else {
                s10 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e3);
                }
              }
              if (s10 !== peg$FAILED) {
                s0 = peg$f2(s4, s7);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        if (peg$silentFails === 0) {
          peg$fail(peg$e0);
        }
      }
      return s0;
    }
    function peg$parsetagName() {
      var s0, s1, s2;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = input.charAt(peg$currPos);
      if (peg$r0.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e5);
        }
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          s2 = input.charAt(peg$currPos);
          if (peg$r0.test(s2)) {
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e5);
            }
          }
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        s0 = input.substring(s0, peg$currPos);
      } else {
        s0 = s1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e4);
        }
      }
      return s0;
    }
    function peg$parsetagValue() {
      var s0, s1, s2;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = input.charAt(peg$currPos);
      if (peg$r1.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e7);
        }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = input.charAt(peg$currPos);
        if (peg$r1.test(s2)) {
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e7);
          }
        }
      }
      s0 = input.substring(s0, peg$currPos);
      peg$silentFails--;
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e6);
      }
      return s0;
    }
    function peg$parsemoveTextSection() {
      var s0, s1, s3;
      s0 = peg$currPos;
      s1 = peg$parseline();
      peg$parse_();
      s3 = peg$parsegameTerminationMarker();
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      peg$parse_();
      s0 = peg$f3(s1, s3);
      return s0;
    }
    function peg$parseline() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      s1 = peg$parsecomment();
      if (s1 === peg$FAILED) {
        s1 = null;
      }
      s2 = [];
      s3 = peg$parsemove();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parsemove();
      }
      s0 = peg$f4(s1, s2);
      return s0;
    }
    function peg$parsemove() {
      var s0, s4, s5, s6, s7, s8, s9, s10;
      s0 = peg$currPos;
      peg$parse_();
      peg$parsemoveNumber();
      peg$parse_();
      s4 = peg$parsesan();
      if (s4 !== peg$FAILED) {
        s5 = peg$parsesuffixAnnotation();
        if (s5 === peg$FAILED) {
          s5 = null;
        }
        s6 = [];
        s7 = peg$parsenag();
        while (s7 !== peg$FAILED) {
          s6.push(s7);
          s7 = peg$parsenag();
        }
        s7 = peg$parse_();
        s8 = peg$parsecomment();
        if (s8 === peg$FAILED) {
          s8 = null;
        }
        s9 = [];
        s10 = peg$parsevariation();
        while (s10 !== peg$FAILED) {
          s9.push(s10);
          s10 = peg$parsevariation();
        }
        s0 = peg$f5(s4, s5, s6, s8, s9);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      return s0;
    }
    function peg$parsemoveNumber() {
      var s0, s1, s2, s3, s4, s5;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = input.charAt(peg$currPos);
      if (peg$r2.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e9);
        }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = input.charAt(peg$currPos);
        if (peg$r2.test(s2)) {
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e9);
          }
        }
      }
      if (input.charCodeAt(peg$currPos) === 46) {
        s2 = peg$c3;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e10);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parse_();
        s4 = [];
        s5 = input.charAt(peg$currPos);
        if (peg$r3.test(s5)) {
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e11);
          }
        }
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = input.charAt(peg$currPos);
          if (peg$r3.test(s5)) {
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e11);
            }
          }
        }
        s1 = [s1, s2, s3, s4];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e8);
        }
      }
      return s0;
    }
    function peg$parsesan() {
      var s0, s1, s2, s3, s4, s5;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$currPos;
      if (input.substr(peg$currPos, 5) === peg$c4) {
        s2 = peg$c4;
        peg$currPos += 5;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e13);
        }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c5) {
          s2 = peg$c5;
          peg$currPos += 3;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e14);
          }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 5) === peg$c6) {
            s2 = peg$c6;
            peg$currPos += 5;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e15);
            }
          }
          if (s2 === peg$FAILED) {
            if (input.substr(peg$currPos, 3) === peg$c7) {
              s2 = peg$c7;
              peg$currPos += 3;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e16);
              }
            }
            if (s2 === peg$FAILED) {
              s2 = peg$currPos;
              s3 = input.charAt(peg$currPos);
              if (peg$r0.test(s3)) {
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e5);
                }
              }
              if (s3 !== peg$FAILED) {
                s4 = [];
                s5 = input.charAt(peg$currPos);
                if (peg$r4.test(s5)) {
                  peg$currPos++;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$e17);
                  }
                }
                if (s5 !== peg$FAILED) {
                  while (s5 !== peg$FAILED) {
                    s4.push(s5);
                    s5 = input.charAt(peg$currPos);
                    if (peg$r4.test(s5)) {
                      peg$currPos++;
                    } else {
                      s5 = peg$FAILED;
                      if (peg$silentFails === 0) {
                        peg$fail(peg$e17);
                      }
                    }
                  }
                } else {
                  s4 = peg$FAILED;
                }
                if (s4 !== peg$FAILED) {
                  s3 = [s3, s4];
                  s2 = s3;
                } else {
                  peg$currPos = s2;
                  s2 = peg$FAILED;
                }
              } else {
                peg$currPos = s2;
                s2 = peg$FAILED;
              }
            }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = input.charAt(peg$currPos);
        if (peg$r5.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e18);
          }
        }
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        s2 = [s2, s3];
        s1 = s2;
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        s0 = input.substring(s0, peg$currPos);
      } else {
        s0 = s1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e12);
        }
      }
      return s0;
    }
    function peg$parsesuffixAnnotation() {
      var s0, s1, s2;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = input.charAt(peg$currPos);
      if (peg$r6.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e20);
        }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        if (s1.length >= 2) {
          s2 = peg$FAILED;
        } else {
          s2 = input.charAt(peg$currPos);
          if (peg$r6.test(s2)) {
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e20);
            }
          }
        }
      }
      if (s1.length < 1) {
        peg$currPos = s0;
        s0 = peg$FAILED;
      } else {
        s0 = s1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e19);
        }
      }
      return s0;
    }
    function peg$parsenag() {
      var s0, s2, s3, s4, s5;
      peg$silentFails++;
      s0 = peg$currPos;
      peg$parse_();
      if (input.charCodeAt(peg$currPos) === 36) {
        s2 = peg$c8;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e22);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        s4 = [];
        s5 = input.charAt(peg$currPos);
        if (peg$r2.test(s5)) {
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e9);
          }
        }
        if (s5 !== peg$FAILED) {
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = input.charAt(peg$currPos);
            if (peg$r2.test(s5)) {
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e9);
              }
            }
          }
        } else {
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s3 = input.substring(s3, peg$currPos);
        } else {
          s3 = s4;
        }
        if (s3 !== peg$FAILED) {
          s0 = peg$f6(s3);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        if (peg$silentFails === 0) {
          peg$fail(peg$e21);
        }
      }
      return s0;
    }
    function peg$parsecomment() {
      var s0;
      s0 = peg$parsebraceComment();
      if (s0 === peg$FAILED) {
        s0 = peg$parserestOfLineComment();
      }
      return s0;
    }
    function peg$parsebraceComment() {
      var s0, s1, s2, s3, s4;
      peg$silentFails++;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 123) {
        s1 = peg$c9;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e24);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        s3 = [];
        s4 = input.charAt(peg$currPos);
        if (peg$r7.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e25);
          }
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = input.charAt(peg$currPos);
          if (peg$r7.test(s4)) {
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e25);
            }
          }
        }
        s2 = input.substring(s2, peg$currPos);
        if (input.charCodeAt(peg$currPos) === 125) {
          s3 = peg$c10;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e26);
          }
        }
        if (s3 !== peg$FAILED) {
          s0 = peg$f7(s2);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e23);
        }
      }
      return s0;
    }
    function peg$parserestOfLineComment() {
      var s0, s1, s2, s3, s4;
      peg$silentFails++;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 59) {
        s1 = peg$c11;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e28);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        s3 = [];
        s4 = input.charAt(peg$currPos);
        if (peg$r8.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e29);
          }
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = input.charAt(peg$currPos);
          if (peg$r8.test(s4)) {
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e29);
            }
          }
        }
        s2 = input.substring(s2, peg$currPos);
        s0 = peg$f8(s2);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e27);
        }
      }
      return s0;
    }
    function peg$parsevariation() {
      var s0, s2, s3, s5;
      peg$silentFails++;
      s0 = peg$currPos;
      peg$parse_();
      if (input.charCodeAt(peg$currPos) === 40) {
        s2 = peg$c12;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e31);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseline();
        if (s3 !== peg$FAILED) {
          peg$parse_();
          if (input.charCodeAt(peg$currPos) === 41) {
            s5 = peg$c13;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e32);
            }
          }
          if (s5 !== peg$FAILED) {
            s0 = peg$f9(s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        if (peg$silentFails === 0) {
          peg$fail(peg$e30);
        }
      }
      return s0;
    }
    function peg$parsegameTerminationMarker() {
      var s0, s1, s3;
      peg$silentFails++;
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 3) === peg$c14) {
        s1 = peg$c14;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e34);
        }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c15) {
          s1 = peg$c15;
          peg$currPos += 3;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e35);
          }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 7) === peg$c16) {
            s1 = peg$c16;
            peg$currPos += 7;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e36);
            }
          }
          if (s1 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 42) {
              s1 = peg$c17;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e37);
              }
            }
          }
        }
      }
      if (s1 !== peg$FAILED) {
        peg$parse_();
        s3 = peg$parsecomment();
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        s0 = peg$f10(s1, s3);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e33);
        }
      }
      return s0;
    }
    function peg$parse_() {
      var s0, s1;
      peg$silentFails++;
      s0 = [];
      s1 = input.charAt(peg$currPos);
      if (peg$r9.test(s1)) {
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e39);
        }
      }
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        s1 = input.charAt(peg$currPos);
        if (peg$r9.test(s1)) {
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e39);
          }
        }
      }
      peg$silentFails--;
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e38);
      }
      return s0;
    }
    peg$result = peg$startRuleFunction();
    if (options.peg$library) {
      return (
        /** @type {any} */
        {
          peg$result,
          peg$currPos,
          peg$FAILED,
          peg$maxFailExpected,
          peg$maxFailPos
        }
      );
    }
    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail(peg$endExpectation());
      }
      throw peg$buildStructuredError(
        peg$maxFailExpected,
        peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
        peg$maxFailPos < input.length ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1) : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
      );
    }
  }
  /**
   * @license
   * Copyright (c) 2025, Jeff Hlywa (jhlywa@gmail.com)
   * All rights reserved.
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice,
   *    this list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the documentation
   *    and/or other materials provided with the distribution.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
   * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
   * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
   * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
   * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
   * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
   * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
   * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
   * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
   * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
   * POSSIBILITY OF SUCH DAMAGE.
   */
  var MASK64 = 0xffffffffffffffffn;
  function rotl(x, k) {
    return (x << k | x >> 64n - k) & 0xffffffffffffffffn;
  }
  function wrappingMul(x, y) {
    return x * y & MASK64;
  }
  function xoroshiro128(state) {
    return function() {
      let s0 = BigInt(state & MASK64);
      let s1 = BigInt(state >> 64n & MASK64);
      const result = wrappingMul(rotl(wrappingMul(s0, 5n), 7n), 9n);
      s1 ^= s0;
      s0 = (rotl(s0, 24n) ^ s1 ^ s1 << 16n) & MASK64;
      s1 = rotl(s1, 37n);
      state = s1 << 64n | s0;
      return result;
    };
  }
  var rand = xoroshiro128(0xa187eb39cdcaed8f31c4b365b102e01en);
  var PIECE_KEYS = Array.from({ length: 2 }, () => Array.from({ length: 6 }, () => Array.from({ length: 128 }, () => rand())));
  var EP_KEYS = Array.from({ length: 8 }, () => rand());
  var CASTLING_KEYS = Array.from({ length: 16 }, () => rand());
  var SIDE_KEY = rand();
  var WHITE = "w";
  var BLACK = "b";
  var PAWN = "p";
  var KNIGHT = "n";
  var BISHOP = "b";
  var ROOK = "r";
  var QUEEN = "q";
  var KING = "k";
  var DEFAULT_POSITION = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  var Move = class {
    color;
    from;
    to;
    piece;
    captured;
    promotion;
    /**
     * @deprecated This field is deprecated and will be removed in version 2.0.0.
     * Please use move descriptor functions instead: `isCapture`, `isPromotion`,
     * `isEnPassant`, `isKingsideCastle`, `isQueensideCastle`, `isCastle`, and
     * `isBigPawn`
     */
    flags;
    san;
    lan;
    before;
    after;
    constructor(chess, internal) {
      const { color, piece, from, to, flags, captured, promotion } = internal;
      const fromAlgebraic = algebraic(from);
      const toAlgebraic = algebraic(to);
      this.color = color;
      this.piece = piece;
      this.from = fromAlgebraic;
      this.to = toAlgebraic;
      this.san = chess["_moveToSan"](internal, chess["_moves"]({ legal: true }));
      this.lan = fromAlgebraic + toAlgebraic;
      this.before = chess.fen();
      chess["_makeMove"](internal);
      this.after = chess.fen();
      chess["_undoMove"]();
      this.flags = "";
      for (const flag in BITS) {
        if (BITS[flag] & flags) {
          this.flags += FLAGS[flag];
        }
      }
      if (captured) {
        this.captured = captured;
      }
      if (promotion) {
        this.promotion = promotion;
        this.lan += promotion;
      }
    }
    isCapture() {
      return this.flags.indexOf(FLAGS["CAPTURE"]) > -1;
    }
    isPromotion() {
      return this.flags.indexOf(FLAGS["PROMOTION"]) > -1;
    }
    isEnPassant() {
      return this.flags.indexOf(FLAGS["EP_CAPTURE"]) > -1;
    }
    isKingsideCastle() {
      return this.flags.indexOf(FLAGS["KSIDE_CASTLE"]) > -1;
    }
    isQueensideCastle() {
      return this.flags.indexOf(FLAGS["QSIDE_CASTLE"]) > -1;
    }
    isBigPawn() {
      return this.flags.indexOf(FLAGS["BIG_PAWN"]) > -1;
    }
  };
  var EMPTY = -1;
  var FLAGS = {
    NORMAL: "n",
    CAPTURE: "c",
    BIG_PAWN: "b",
    EP_CAPTURE: "e",
    PROMOTION: "p",
    KSIDE_CASTLE: "k",
    QSIDE_CASTLE: "q",
    NULL_MOVE: "-"
  };
  var BITS = {
    NORMAL: 1,
    CAPTURE: 2,
    BIG_PAWN: 4,
    EP_CAPTURE: 8,
    PROMOTION: 16,
    KSIDE_CASTLE: 32,
    QSIDE_CASTLE: 64,
    NULL_MOVE: 128
  };
  var SEVEN_TAG_ROSTER = {
    Event: "?",
    Site: "?",
    Date: "????.??.??",
    Round: "?",
    White: "?",
    Black: "?",
    Result: "*"
  };
  var SUPLEMENTAL_TAGS = {
    WhiteTitle: null,
    BlackTitle: null,
    WhiteElo: null,
    BlackElo: null,
    WhiteUSCF: null,
    BlackUSCF: null,
    WhiteNA: null,
    BlackNA: null,
    WhiteType: null,
    BlackType: null,
    EventDate: null,
    EventSponsor: null,
    Section: null,
    Stage: null,
    Board: null,
    Opening: null,
    Variation: null,
    SubVariation: null,
    ECO: null,
    NIC: null,
    Time: null,
    UTCTime: null,
    UTCDate: null,
    TimeControl: null,
    SetUp: null,
    FEN: null,
    Termination: null,
    Annotator: null,
    Mode: null,
    PlyCount: null
  };
  var HEADER_TEMPLATE = {
    ...SEVEN_TAG_ROSTER,
    ...SUPLEMENTAL_TAGS
  };
  var Ox88 = {
    a8: 0,
    b8: 1,
    c8: 2,
    d8: 3,
    e8: 4,
    f8: 5,
    g8: 6,
    h8: 7,
    a7: 16,
    b7: 17,
    c7: 18,
    d7: 19,
    e7: 20,
    f7: 21,
    g7: 22,
    h7: 23,
    a6: 32,
    b6: 33,
    c6: 34,
    d6: 35,
    e6: 36,
    f6: 37,
    g6: 38,
    h6: 39,
    a5: 48,
    b5: 49,
    c5: 50,
    d5: 51,
    e5: 52,
    f5: 53,
    g5: 54,
    h5: 55,
    a4: 64,
    b4: 65,
    c4: 66,
    d4: 67,
    e4: 68,
    f4: 69,
    g4: 70,
    h4: 71,
    a3: 80,
    b3: 81,
    c3: 82,
    d3: 83,
    e3: 84,
    f3: 85,
    g3: 86,
    h3: 87,
    a2: 96,
    b2: 97,
    c2: 98,
    d2: 99,
    e2: 100,
    f2: 101,
    g2: 102,
    h2: 103,
    a1: 112,
    b1: 113,
    c1: 114,
    d1: 115,
    e1: 116,
    f1: 117,
    g1: 118,
    h1: 119
  };
  var PAWN_OFFSETS = {
    b: [16, 32, 17, 15],
    w: [-16, -32, -17, -15]
  };
  var PIECE_OFFSETS = {
    n: [-18, -33, -31, -14, 18, 33, 31, 14],
    b: [-17, -15, 17, 15],
    r: [-16, 1, 16, -1],
    q: [-17, -16, -15, 1, 17, 16, 15, -1],
    k: [-17, -16, -15, 1, 17, 16, 15, -1]
  };
  var ATTACKS = [
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    24,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    2,
    24,
    2,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2,
    53,
    56,
    53,
    2,
    0,
    0,
    0,
    0,
    0,
    0,
    24,
    24,
    24,
    24,
    24,
    24,
    56,
    0,
    56,
    24,
    24,
    24,
    24,
    24,
    24,
    0,
    0,
    0,
    0,
    0,
    0,
    2,
    53,
    56,
    53,
    2,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    2,
    24,
    2,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    24,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    0,
    0,
    20
  ];
  var RAYS = [
    17,
    0,
    0,
    0,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    0,
    0,
    0,
    15,
    0,
    0,
    17,
    0,
    0,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    0,
    0,
    15,
    0,
    0,
    0,
    0,
    17,
    0,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    0,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    17,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    17,
    0,
    0,
    16,
    0,
    0,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    17,
    0,
    16,
    0,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    17,
    16,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    -16,
    -17,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    0,
    -16,
    0,
    -17,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    0,
    0,
    -16,
    0,
    0,
    -17,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    0,
    0,
    0,
    -16,
    0,
    0,
    0,
    -17,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    0,
    0,
    0,
    0,
    -16,
    0,
    0,
    0,
    0,
    -17,
    0,
    0,
    0,
    0,
    -15,
    0,
    0,
    0,
    0,
    0,
    -16,
    0,
    0,
    0,
    0,
    0,
    -17,
    0,
    0,
    -15,
    0,
    0,
    0,
    0,
    0,
    0,
    -16,
    0,
    0,
    0,
    0,
    0,
    0,
    -17
  ];
  var PIECE_MASKS = { p: 1, n: 2, b: 4, r: 8, q: 16, k: 32 };
  var SYMBOLS = "pnbrqkPNBRQK";
  var PROMOTIONS = [KNIGHT, BISHOP, ROOK, QUEEN];
  var RANK_1 = 7;
  var RANK_2 = 6;
  var RANK_7 = 1;
  var RANK_8 = 0;
  var SIDES = {
    [KING]: BITS.KSIDE_CASTLE,
    [QUEEN]: BITS.QSIDE_CASTLE
  };
  var ROOKS = {
    w: [
      { square: Ox88.a1, flag: BITS.QSIDE_CASTLE },
      { square: Ox88.h1, flag: BITS.KSIDE_CASTLE }
    ],
    b: [
      { square: Ox88.a8, flag: BITS.QSIDE_CASTLE },
      { square: Ox88.h8, flag: BITS.KSIDE_CASTLE }
    ]
  };
  var SECOND_RANK = { b: RANK_7, w: RANK_2 };
  var SAN_NULLMOVE = "--";
  function rank(square) {
    return square >> 4;
  }
  function file(square) {
    return square & 15;
  }
  function isDigit(c) {
    return "0123456789".indexOf(c) !== -1;
  }
  function algebraic(square) {
    const f = file(square);
    const r = rank(square);
    return "abcdefgh".substring(f, f + 1) + "87654321".substring(r, r + 1);
  }
  function swapColor(color) {
    return color === WHITE ? BLACK : WHITE;
  }
  function validateFen(fen) {
    const tokens = fen.split(/\s+/);
    if (tokens.length !== 6) {
      return {
        ok: false,
        error: "Invalid FEN: must contain six space-delimited fields"
      };
    }
    const moveNumber = parseInt(tokens[5], 10);
    if (isNaN(moveNumber) || moveNumber <= 0) {
      return {
        ok: false,
        error: "Invalid FEN: move number must be a positive integer"
      };
    }
    const halfMoves = parseInt(tokens[4], 10);
    if (isNaN(halfMoves) || halfMoves < 0) {
      return {
        ok: false,
        error: "Invalid FEN: half move counter number must be a non-negative integer"
      };
    }
    if (!/^(-|[abcdefgh][36])$/.test(tokens[3])) {
      return { ok: false, error: "Invalid FEN: en-passant square is invalid" };
    }
    if (/[^kKqQ-]/.test(tokens[2])) {
      return { ok: false, error: "Invalid FEN: castling availability is invalid" };
    }
    if (!/^(w|b)$/.test(tokens[1])) {
      return { ok: false, error: "Invalid FEN: side-to-move is invalid" };
    }
    const rows = tokens[0].split("/");
    if (rows.length !== 8) {
      return {
        ok: false,
        error: "Invalid FEN: piece data does not contain 8 '/'-delimited rows"
      };
    }
    for (let i = 0; i < rows.length; i++) {
      let sumFields = 0;
      let previousWasNumber = false;
      for (let k = 0; k < rows[i].length; k++) {
        if (isDigit(rows[i][k])) {
          if (previousWasNumber) {
            return {
              ok: false,
              error: "Invalid FEN: piece data is invalid (consecutive number)"
            };
          }
          sumFields += parseInt(rows[i][k], 10);
          previousWasNumber = true;
        } else {
          if (!/^[prnbqkPRNBQK]$/.test(rows[i][k])) {
            return {
              ok: false,
              error: "Invalid FEN: piece data is invalid (invalid piece)"
            };
          }
          sumFields += 1;
          previousWasNumber = false;
        }
      }
      if (sumFields !== 8) {
        return {
          ok: false,
          error: "Invalid FEN: piece data is invalid (too many squares in rank)"
        };
      }
    }
    if (tokens[3][1] == "3" && tokens[1] == "w" || tokens[3][1] == "6" && tokens[1] == "b") {
      return { ok: false, error: "Invalid FEN: illegal en-passant square" };
    }
    const kings = [
      { color: "white", regex: /K/g },
      { color: "black", regex: /k/g }
    ];
    for (const { color, regex } of kings) {
      if (!regex.test(tokens[0])) {
        return { ok: false, error: `Invalid FEN: missing ${color} king` };
      }
      if ((tokens[0].match(regex) || []).length > 1) {
        return { ok: false, error: `Invalid FEN: too many ${color} kings` };
      }
    }
    if (Array.from(rows[0] + rows[7]).some((char) => char.toUpperCase() === "P")) {
      return {
        ok: false,
        error: "Invalid FEN: some pawns are on the edge rows"
      };
    }
    return { ok: true };
  }
  function getDisambiguator(move, moves) {
    const from = move.from;
    const to = move.to;
    const piece = move.piece;
    let ambiguities = 0;
    let sameRank = 0;
    let sameFile = 0;
    for (let i = 0, len = moves.length; i < len; i++) {
      const ambigFrom = moves[i].from;
      const ambigTo = moves[i].to;
      const ambigPiece = moves[i].piece;
      if (piece === ambigPiece && from !== ambigFrom && to === ambigTo) {
        ambiguities++;
        if (rank(from) === rank(ambigFrom)) {
          sameRank++;
        }
        if (file(from) === file(ambigFrom)) {
          sameFile++;
        }
      }
    }
    if (ambiguities > 0) {
      if (sameRank > 0 && sameFile > 0) {
        return algebraic(from);
      } else if (sameFile > 0) {
        return algebraic(from).charAt(1);
      } else {
        return algebraic(from).charAt(0);
      }
    }
    return "";
  }
  function addMove(moves, color, from, to, piece, captured = void 0, flags = BITS.NORMAL) {
    const r = rank(to);
    if (piece === PAWN && (r === RANK_1 || r === RANK_8)) {
      for (let i = 0; i < PROMOTIONS.length; i++) {
        const promotion = PROMOTIONS[i];
        moves.push({
          color,
          from,
          to,
          piece,
          captured,
          promotion,
          flags: flags | BITS.PROMOTION
        });
      }
    } else {
      moves.push({
        color,
        from,
        to,
        piece,
        captured,
        flags
      });
    }
  }
  function inferPieceType(san) {
    let pieceType = san.charAt(0);
    if (pieceType >= "a" && pieceType <= "h") {
      const matches = san.match(/[a-h]\d.*[a-h]\d/);
      if (matches) {
        return void 0;
      }
      return PAWN;
    }
    pieceType = pieceType.toLowerCase();
    if (pieceType === "o") {
      return KING;
    }
    return pieceType;
  }
  function strippedSan(move) {
    return move.replace(/=/, "").replace(/[+#]?[?!]*$/, "");
  }
  var Chess = class {
    _board = new Array(128);
    _turn = WHITE;
    _header = {};
    _kings = { w: EMPTY, b: EMPTY };
    _epSquare = -1;
    _halfMoves = 0;
    _moveNumber = 0;
    _history = [];
    _comments = {};
    _castling = { w: 0, b: 0 };
    _hash = 0n;
    // tracks number of times a position has been seen for repetition checking
    _positionCount = /* @__PURE__ */ new Map();
    constructor(fen = DEFAULT_POSITION, { skipValidation = false } = {}) {
      this.load(fen, { skipValidation });
    }
    clear({ preserveHeaders = false } = {}) {
      this._board = new Array(128);
      this._kings = { w: EMPTY, b: EMPTY };
      this._turn = WHITE;
      this._castling = { w: 0, b: 0 };
      this._epSquare = EMPTY;
      this._halfMoves = 0;
      this._moveNumber = 1;
      this._history = [];
      this._comments = {};
      this._header = preserveHeaders ? this._header : { ...HEADER_TEMPLATE };
      this._hash = this._computeHash();
      this._positionCount = /* @__PURE__ */ new Map();
      this._header["SetUp"] = null;
      this._header["FEN"] = null;
    }
    load(fen, { skipValidation = false, preserveHeaders = false } = {}) {
      let tokens = fen.split(/\s+/);
      if (tokens.length >= 2 && tokens.length < 6) {
        const adjustments = ["-", "-", "0", "1"];
        fen = tokens.concat(adjustments.slice(-(6 - tokens.length))).join(" ");
      }
      tokens = fen.split(/\s+/);
      if (!skipValidation) {
        const { ok, error } = validateFen(fen);
        if (!ok) {
          throw new Error(error);
        }
      }
      const position = tokens[0];
      let square = 0;
      this.clear({ preserveHeaders });
      for (let i = 0; i < position.length; i++) {
        const piece = position.charAt(i);
        if (piece === "/") {
          square += 8;
        } else if (isDigit(piece)) {
          square += parseInt(piece, 10);
        } else {
          const color = piece < "a" ? WHITE : BLACK;
          this._put({ type: piece.toLowerCase(), color }, algebraic(square));
          square++;
        }
      }
      this._turn = tokens[1];
      if (tokens[2].indexOf("K") > -1) {
        this._castling.w |= BITS.KSIDE_CASTLE;
      }
      if (tokens[2].indexOf("Q") > -1) {
        this._castling.w |= BITS.QSIDE_CASTLE;
      }
      if (tokens[2].indexOf("k") > -1) {
        this._castling.b |= BITS.KSIDE_CASTLE;
      }
      if (tokens[2].indexOf("q") > -1) {
        this._castling.b |= BITS.QSIDE_CASTLE;
      }
      this._epSquare = tokens[3] === "-" ? EMPTY : Ox88[tokens[3]];
      this._halfMoves = parseInt(tokens[4], 10);
      this._moveNumber = parseInt(tokens[5], 10);
      this._hash = this._computeHash();
      this._updateSetup(fen);
      this._incPositionCount();
    }
    fen({ forceEnpassantSquare = false } = {}) {
      let empty = 0;
      let fen = "";
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (this._board[i]) {
          if (empty > 0) {
            fen += empty;
            empty = 0;
          }
          const { color, type: piece } = this._board[i];
          fen += color === WHITE ? piece.toUpperCase() : piece.toLowerCase();
        } else {
          empty++;
        }
        if (i + 1 & 136) {
          if (empty > 0) {
            fen += empty;
          }
          if (i !== Ox88.h1) {
            fen += "/";
          }
          empty = 0;
          i += 8;
        }
      }
      let castling = "";
      if (this._castling[WHITE] & BITS.KSIDE_CASTLE) {
        castling += "K";
      }
      if (this._castling[WHITE] & BITS.QSIDE_CASTLE) {
        castling += "Q";
      }
      if (this._castling[BLACK] & BITS.KSIDE_CASTLE) {
        castling += "k";
      }
      if (this._castling[BLACK] & BITS.QSIDE_CASTLE) {
        castling += "q";
      }
      castling = castling || "-";
      let epSquare = "-";
      if (this._epSquare !== EMPTY) {
        if (forceEnpassantSquare) {
          epSquare = algebraic(this._epSquare);
        } else {
          const bigPawnSquare = this._epSquare + (this._turn === WHITE ? 16 : -16);
          const squares = [bigPawnSquare + 1, bigPawnSquare - 1];
          for (const square of squares) {
            if (square & 136) {
              continue;
            }
            const color = this._turn;
            if (this._board[square]?.color === color && this._board[square]?.type === PAWN) {
              this._makeMove({
                color,
                from: square,
                to: this._epSquare,
                piece: PAWN,
                captured: PAWN,
                flags: BITS.EP_CAPTURE
              });
              const isLegal = !this._isKingAttacked(color);
              this._undoMove();
              if (isLegal) {
                epSquare = algebraic(this._epSquare);
                break;
              }
            }
          }
        }
      }
      return [
        fen,
        this._turn,
        castling,
        epSquare,
        this._halfMoves,
        this._moveNumber
      ].join(" ");
    }
    _pieceKey(i) {
      if (!this._board[i]) {
        return 0n;
      }
      const { color, type } = this._board[i];
      const colorIndex = {
        w: 0,
        b: 1
      }[color];
      const typeIndex = {
        p: 0,
        n: 1,
        b: 2,
        r: 3,
        q: 4,
        k: 5
      }[type];
      return PIECE_KEYS[colorIndex][typeIndex][i];
    }
    _epKey() {
      return this._epSquare === EMPTY ? 0n : EP_KEYS[this._epSquare & 7];
    }
    _castlingKey() {
      const index = this._castling.w >> 5 | this._castling.b >> 3;
      return CASTLING_KEYS[index];
    }
    _computeHash() {
      let hash = 0n;
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (i & 136) {
          i += 7;
          continue;
        }
        if (this._board[i]) {
          hash ^= this._pieceKey(i);
        }
      }
      hash ^= this._epKey();
      hash ^= this._castlingKey();
      if (this._turn === "b") {
        hash ^= SIDE_KEY;
      }
      return hash;
    }
    /*
     * Called when the initial board setup is changed with put() or remove().
     * modifies the SetUp and FEN properties of the header object. If the FEN
     * is equal to the default position, the SetUp and FEN are deleted the setup
     * is only updated if history.length is zero, ie moves haven't been made.
     */
    _updateSetup(fen) {
      if (this._history.length > 0)
        return;
      if (fen !== DEFAULT_POSITION) {
        this._header["SetUp"] = "1";
        this._header["FEN"] = fen;
      } else {
        this._header["SetUp"] = null;
        this._header["FEN"] = null;
      }
    }
    reset() {
      this.load(DEFAULT_POSITION);
    }
    get(square) {
      return this._board[Ox88[square]];
    }
    findPiece(piece) {
      const squares = [];
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (i & 136) {
          i += 7;
          continue;
        }
        if (!this._board[i] || this._board[i]?.color !== piece.color) {
          continue;
        }
        if (this._board[i].color === piece.color && this._board[i].type === piece.type) {
          squares.push(algebraic(i));
        }
      }
      return squares;
    }
    put({ type, color }, square) {
      if (this._put({ type, color }, square)) {
        this._updateCastlingRights();
        this._updateEnPassantSquare();
        this._updateSetup(this.fen());
        return true;
      }
      return false;
    }
    _set(sq, piece) {
      this._hash ^= this._pieceKey(sq);
      this._board[sq] = piece;
      this._hash ^= this._pieceKey(sq);
    }
    _put({ type, color }, square) {
      if (SYMBOLS.indexOf(type.toLowerCase()) === -1) {
        return false;
      }
      if (!(square in Ox88)) {
        return false;
      }
      const sq = Ox88[square];
      if (type == KING && !(this._kings[color] == EMPTY || this._kings[color] == sq)) {
        return false;
      }
      const currentPieceOnSquare = this._board[sq];
      if (currentPieceOnSquare && currentPieceOnSquare.type === KING) {
        this._kings[currentPieceOnSquare.color] = EMPTY;
      }
      this._set(sq, { type, color });
      if (type === KING) {
        this._kings[color] = sq;
      }
      return true;
    }
    _clear(sq) {
      this._hash ^= this._pieceKey(sq);
      delete this._board[sq];
    }
    remove(square) {
      const piece = this.get(square);
      this._clear(Ox88[square]);
      if (piece && piece.type === KING) {
        this._kings[piece.color] = EMPTY;
      }
      this._updateCastlingRights();
      this._updateEnPassantSquare();
      this._updateSetup(this.fen());
      return piece;
    }
    _updateCastlingRights() {
      this._hash ^= this._castlingKey();
      const whiteKingInPlace = this._board[Ox88.e1]?.type === KING && this._board[Ox88.e1]?.color === WHITE;
      const blackKingInPlace = this._board[Ox88.e8]?.type === KING && this._board[Ox88.e8]?.color === BLACK;
      if (!whiteKingInPlace || this._board[Ox88.a1]?.type !== ROOK || this._board[Ox88.a1]?.color !== WHITE) {
        this._castling.w &= -65;
      }
      if (!whiteKingInPlace || this._board[Ox88.h1]?.type !== ROOK || this._board[Ox88.h1]?.color !== WHITE) {
        this._castling.w &= -33;
      }
      if (!blackKingInPlace || this._board[Ox88.a8]?.type !== ROOK || this._board[Ox88.a8]?.color !== BLACK) {
        this._castling.b &= -65;
      }
      if (!blackKingInPlace || this._board[Ox88.h8]?.type !== ROOK || this._board[Ox88.h8]?.color !== BLACK) {
        this._castling.b &= -33;
      }
      this._hash ^= this._castlingKey();
    }
    _updateEnPassantSquare() {
      if (this._epSquare === EMPTY) {
        return;
      }
      const startSquare = this._epSquare + (this._turn === WHITE ? -16 : 16);
      const currentSquare = this._epSquare + (this._turn === WHITE ? 16 : -16);
      const attackers = [currentSquare + 1, currentSquare - 1];
      if (this._board[startSquare] !== null || this._board[this._epSquare] !== null || this._board[currentSquare]?.color !== swapColor(this._turn) || this._board[currentSquare]?.type !== PAWN) {
        this._hash ^= this._epKey();
        this._epSquare = EMPTY;
        return;
      }
      const canCapture = (square) => !(square & 136) && this._board[square]?.color === this._turn && this._board[square]?.type === PAWN;
      if (!attackers.some(canCapture)) {
        this._hash ^= this._epKey();
        this._epSquare = EMPTY;
      }
    }
    _attacked(color, square, verbose) {
      const attackers = [];
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (i & 136) {
          i += 7;
          continue;
        }
        if (this._board[i] === void 0 || this._board[i].color !== color) {
          continue;
        }
        const piece = this._board[i];
        const difference = i - square;
        if (difference === 0) {
          continue;
        }
        const index = difference + 119;
        if (ATTACKS[index] & PIECE_MASKS[piece.type]) {
          if (piece.type === PAWN) {
            if (difference > 0 && piece.color === WHITE || difference <= 0 && piece.color === BLACK) {
              if (!verbose) {
                return true;
              } else {
                attackers.push(algebraic(i));
              }
            }
            continue;
          }
          if (piece.type === "n" || piece.type === "k") {
            if (!verbose) {
              return true;
            } else {
              attackers.push(algebraic(i));
              continue;
            }
          }
          const offset = RAYS[index];
          let j = i + offset;
          let blocked = false;
          while (j !== square) {
            if (this._board[j] != null) {
              blocked = true;
              break;
            }
            j += offset;
          }
          if (!blocked) {
            if (!verbose) {
              return true;
            } else {
              attackers.push(algebraic(i));
              continue;
            }
          }
        }
      }
      if (verbose) {
        return attackers;
      } else {
        return false;
      }
    }
    attackers(square, attackedBy) {
      if (!attackedBy) {
        return this._attacked(this._turn, Ox88[square], true);
      } else {
        return this._attacked(attackedBy, Ox88[square], true);
      }
    }
    _isKingAttacked(color) {
      const square = this._kings[color];
      return square === -1 ? false : this._attacked(swapColor(color), square);
    }
    hash() {
      return this._hash.toString(16);
    }
    isAttacked(square, attackedBy) {
      return this._attacked(attackedBy, Ox88[square]);
    }
    isCheck() {
      return this._isKingAttacked(this._turn);
    }
    inCheck() {
      return this.isCheck();
    }
    isCheckmate() {
      return this.isCheck() && this._moves().length === 0;
    }
    isStalemate() {
      return !this.isCheck() && this._moves().length === 0;
    }
    isInsufficientMaterial() {
      const pieces = {
        b: 0,
        n: 0,
        r: 0,
        q: 0,
        k: 0,
        p: 0
      };
      const bishops = [];
      let numPieces = 0;
      let squareColor = 0;
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        squareColor = (squareColor + 1) % 2;
        if (i & 136) {
          i += 7;
          continue;
        }
        const piece = this._board[i];
        if (piece) {
          pieces[piece.type] = piece.type in pieces ? pieces[piece.type] + 1 : 1;
          if (piece.type === BISHOP) {
            bishops.push(squareColor);
          }
          numPieces++;
        }
      }
      if (numPieces === 2) {
        return true;
      } else if (
        // k vs. kn .... or .... k vs. kb
        numPieces === 3 && (pieces[BISHOP] === 1 || pieces[KNIGHT] === 1)
      ) {
        return true;
      } else if (numPieces === pieces[BISHOP] + 2) {
        let sum = 0;
        const len = bishops.length;
        for (let i = 0; i < len; i++) {
          sum += bishops[i];
        }
        if (sum === 0 || sum === len) {
          return true;
        }
      }
      return false;
    }
    isThreefoldRepetition() {
      return this._getPositionCount(this._hash) >= 3;
    }
    isDrawByFiftyMoves() {
      return this._halfMoves >= 100;
    }
    isDraw() {
      return this.isDrawByFiftyMoves() || this.isStalemate() || this.isInsufficientMaterial() || this.isThreefoldRepetition();
    }
    isGameOver() {
      return this.isCheckmate() || this.isDraw();
    }
    moves({ verbose = false, square = void 0, piece = void 0 } = {}) {
      const moves = this._moves({ square, piece });
      if (verbose) {
        return moves.map((move) => new Move(this, move));
      } else {
        return moves.map((move) => this._moveToSan(move, moves));
      }
    }
    _moves({ legal = true, piece = void 0, square = void 0 } = {}) {
      const forSquare = square ? square.toLowerCase() : void 0;
      const forPiece = piece?.toLowerCase();
      const moves = [];
      const us = this._turn;
      const them = swapColor(us);
      let firstSquare = Ox88.a8;
      let lastSquare = Ox88.h1;
      let singleSquare = false;
      if (forSquare) {
        if (!(forSquare in Ox88)) {
          return [];
        } else {
          firstSquare = lastSquare = Ox88[forSquare];
          singleSquare = true;
        }
      }
      for (let from = firstSquare; from <= lastSquare; from++) {
        if (from & 136) {
          from += 7;
          continue;
        }
        if (!this._board[from] || this._board[from].color === them) {
          continue;
        }
        const { type } = this._board[from];
        let to;
        if (type === PAWN) {
          if (forPiece && forPiece !== type)
            continue;
          to = from + PAWN_OFFSETS[us][0];
          if (!this._board[to]) {
            addMove(moves, us, from, to, PAWN);
            to = from + PAWN_OFFSETS[us][1];
            if (SECOND_RANK[us] === rank(from) && !this._board[to]) {
              addMove(moves, us, from, to, PAWN, void 0, BITS.BIG_PAWN);
            }
          }
          for (let j = 2; j < 4; j++) {
            to = from + PAWN_OFFSETS[us][j];
            if (to & 136)
              continue;
            if (this._board[to]?.color === them) {
              addMove(moves, us, from, to, PAWN, this._board[to].type, BITS.CAPTURE);
            } else if (to === this._epSquare) {
              addMove(moves, us, from, to, PAWN, PAWN, BITS.EP_CAPTURE);
            }
          }
        } else {
          if (forPiece && forPiece !== type)
            continue;
          for (let j = 0, len = PIECE_OFFSETS[type].length; j < len; j++) {
            const offset = PIECE_OFFSETS[type][j];
            to = from;
            while (true) {
              to += offset;
              if (to & 136)
                break;
              if (!this._board[to]) {
                addMove(moves, us, from, to, type);
              } else {
                if (this._board[to].color === us)
                  break;
                addMove(moves, us, from, to, type, this._board[to].type, BITS.CAPTURE);
                break;
              }
              if (type === KNIGHT || type === KING)
                break;
            }
          }
        }
      }
      if (forPiece === void 0 || forPiece === KING) {
        if (!singleSquare || lastSquare === this._kings[us]) {
          if (this._castling[us] & BITS.KSIDE_CASTLE) {
            const castlingFrom = this._kings[us];
            const castlingTo = castlingFrom + 2;
            if (!this._board[castlingFrom + 1] && !this._board[castlingTo] && !this._attacked(them, this._kings[us]) && !this._attacked(them, castlingFrom + 1) && !this._attacked(them, castlingTo)) {
              addMove(moves, us, this._kings[us], castlingTo, KING, void 0, BITS.KSIDE_CASTLE);
            }
          }
          if (this._castling[us] & BITS.QSIDE_CASTLE) {
            const castlingFrom = this._kings[us];
            const castlingTo = castlingFrom - 2;
            if (!this._board[castlingFrom - 1] && !this._board[castlingFrom - 2] && !this._board[castlingFrom - 3] && !this._attacked(them, this._kings[us]) && !this._attacked(them, castlingFrom - 1) && !this._attacked(them, castlingTo)) {
              addMove(moves, us, this._kings[us], castlingTo, KING, void 0, BITS.QSIDE_CASTLE);
            }
          }
        }
      }
      if (!legal || this._kings[us] === -1) {
        return moves;
      }
      const legalMoves = [];
      for (let i = 0, len = moves.length; i < len; i++) {
        this._makeMove(moves[i]);
        if (!this._isKingAttacked(us)) {
          legalMoves.push(moves[i]);
        }
        this._undoMove();
      }
      return legalMoves;
    }
    move(move, { strict = false } = {}) {
      let moveObj = null;
      if (typeof move === "string") {
        moveObj = this._moveFromSan(move, strict);
      } else if (move === null) {
        moveObj = this._moveFromSan(SAN_NULLMOVE, strict);
      } else if (typeof move === "object") {
        const moves = this._moves();
        for (let i = 0, len = moves.length; i < len; i++) {
          if (move.from === algebraic(moves[i].from) && move.to === algebraic(moves[i].to) && (!("promotion" in moves[i]) || move.promotion === moves[i].promotion)) {
            moveObj = moves[i];
            break;
          }
        }
      }
      if (!moveObj) {
        if (typeof move === "string") {
          throw new Error(`Invalid move: ${move}`);
        } else {
          throw new Error(`Invalid move: ${JSON.stringify(move)}`);
        }
      }
      if (this.isCheck() && moveObj.flags & BITS.NULL_MOVE) {
        throw new Error("Null move not allowed when in check");
      }
      const prettyMove = new Move(this, moveObj);
      this._makeMove(moveObj);
      this._incPositionCount();
      return prettyMove;
    }
    _push(move) {
      this._history.push({
        move,
        kings: { b: this._kings.b, w: this._kings.w },
        turn: this._turn,
        castling: { b: this._castling.b, w: this._castling.w },
        epSquare: this._epSquare,
        halfMoves: this._halfMoves,
        moveNumber: this._moveNumber
      });
    }
    _movePiece(from, to) {
      this._hash ^= this._pieceKey(from);
      this._board[to] = this._board[from];
      delete this._board[from];
      this._hash ^= this._pieceKey(to);
    }
    _makeMove(move) {
      const us = this._turn;
      const them = swapColor(us);
      this._push(move);
      if (move.flags & BITS.NULL_MOVE) {
        if (us === BLACK) {
          this._moveNumber++;
        }
        this._halfMoves++;
        this._turn = them;
        this._epSquare = EMPTY;
        return;
      }
      this._hash ^= this._epKey();
      this._hash ^= this._castlingKey();
      if (move.captured) {
        this._hash ^= this._pieceKey(move.to);
      }
      this._movePiece(move.from, move.to);
      if (move.flags & BITS.EP_CAPTURE) {
        if (this._turn === BLACK) {
          this._clear(move.to - 16);
        } else {
          this._clear(move.to + 16);
        }
      }
      if (move.promotion) {
        this._clear(move.to);
        this._set(move.to, { type: move.promotion, color: us });
      }
      if (this._board[move.to].type === KING) {
        this._kings[us] = move.to;
        if (move.flags & BITS.KSIDE_CASTLE) {
          const castlingTo = move.to - 1;
          const castlingFrom = move.to + 1;
          this._movePiece(castlingFrom, castlingTo);
        } else if (move.flags & BITS.QSIDE_CASTLE) {
          const castlingTo = move.to + 1;
          const castlingFrom = move.to - 2;
          this._movePiece(castlingFrom, castlingTo);
        }
        this._castling[us] = 0;
      }
      if (this._castling[us]) {
        for (let i = 0, len = ROOKS[us].length; i < len; i++) {
          if (move.from === ROOKS[us][i].square && this._castling[us] & ROOKS[us][i].flag) {
            this._castling[us] ^= ROOKS[us][i].flag;
            break;
          }
        }
      }
      if (this._castling[them]) {
        for (let i = 0, len = ROOKS[them].length; i < len; i++) {
          if (move.to === ROOKS[them][i].square && this._castling[them] & ROOKS[them][i].flag) {
            this._castling[them] ^= ROOKS[them][i].flag;
            break;
          }
        }
      }
      this._hash ^= this._castlingKey();
      if (move.flags & BITS.BIG_PAWN) {
        let epSquare;
        if (us === BLACK) {
          epSquare = move.to - 16;
        } else {
          epSquare = move.to + 16;
        }
        if (!(move.to - 1 & 136) && this._board[move.to - 1]?.type === PAWN && this._board[move.to - 1]?.color === them || !(move.to + 1 & 136) && this._board[move.to + 1]?.type === PAWN && this._board[move.to + 1]?.color === them) {
          this._epSquare = epSquare;
          this._hash ^= this._epKey();
        } else {
          this._epSquare = EMPTY;
        }
      } else {
        this._epSquare = EMPTY;
      }
      if (move.piece === PAWN) {
        this._halfMoves = 0;
      } else if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
        this._halfMoves = 0;
      } else {
        this._halfMoves++;
      }
      if (us === BLACK) {
        this._moveNumber++;
      }
      this._turn = them;
      this._hash ^= SIDE_KEY;
    }
    undo() {
      const hash = this._hash;
      const move = this._undoMove();
      if (move) {
        const prettyMove = new Move(this, move);
        this._decPositionCount(hash);
        return prettyMove;
      }
      return null;
    }
    _undoMove() {
      const old = this._history.pop();
      if (old === void 0) {
        return null;
      }
      this._hash ^= this._epKey();
      this._hash ^= this._castlingKey();
      const move = old.move;
      this._kings = old.kings;
      this._turn = old.turn;
      this._castling = old.castling;
      this._epSquare = old.epSquare;
      this._halfMoves = old.halfMoves;
      this._moveNumber = old.moveNumber;
      this._hash ^= this._epKey();
      this._hash ^= this._castlingKey();
      this._hash ^= SIDE_KEY;
      const us = this._turn;
      const them = swapColor(us);
      if (move.flags & BITS.NULL_MOVE) {
        return move;
      }
      this._movePiece(move.to, move.from);
      if (move.piece) {
        this._clear(move.from);
        this._set(move.from, { type: move.piece, color: us });
      }
      if (move.captured) {
        if (move.flags & BITS.EP_CAPTURE) {
          let index;
          if (us === BLACK) {
            index = move.to - 16;
          } else {
            index = move.to + 16;
          }
          this._set(index, { type: PAWN, color: them });
        } else {
          this._set(move.to, { type: move.captured, color: them });
        }
      }
      if (move.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)) {
        let castlingTo, castlingFrom;
        if (move.flags & BITS.KSIDE_CASTLE) {
          castlingTo = move.to + 1;
          castlingFrom = move.to - 1;
        } else {
          castlingTo = move.to - 2;
          castlingFrom = move.to + 1;
        }
        this._movePiece(castlingFrom, castlingTo);
      }
      return move;
    }
    pgn({ newline = "\n", maxWidth = 0 } = {}) {
      const result = [];
      let headerExists = false;
      for (const i in this._header) {
        const headerTag = this._header[i];
        if (headerTag)
          result.push(`[${i} "${this._header[i]}"]` + newline);
        headerExists = true;
      }
      if (headerExists && this._history.length) {
        result.push(newline);
      }
      const appendComment = (moveString2) => {
        const comment = this._comments[this.fen()];
        if (typeof comment !== "undefined") {
          const delimiter = moveString2.length > 0 ? " " : "";
          moveString2 = `${moveString2}${delimiter}{${comment}}`;
        }
        return moveString2;
      };
      const reversedHistory = [];
      while (this._history.length > 0) {
        reversedHistory.push(this._undoMove());
      }
      const moves = [];
      let moveString = "";
      if (reversedHistory.length === 0) {
        moves.push(appendComment(""));
      }
      while (reversedHistory.length > 0) {
        moveString = appendComment(moveString);
        const move = reversedHistory.pop();
        if (!move) {
          break;
        }
        if (!this._history.length && move.color === "b") {
          const prefix = `${this._moveNumber}. ...`;
          moveString = moveString ? `${moveString} ${prefix}` : prefix;
        } else if (move.color === "w") {
          if (moveString.length) {
            moves.push(moveString);
          }
          moveString = this._moveNumber + ".";
        }
        moveString = moveString + " " + this._moveToSan(move, this._moves({ legal: true }));
        this._makeMove(move);
      }
      if (moveString.length) {
        moves.push(appendComment(moveString));
      }
      moves.push(this._header.Result || "*");
      if (maxWidth === 0) {
        return result.join("") + moves.join(" ");
      }
      const strip = function() {
        if (result.length > 0 && result[result.length - 1] === " ") {
          result.pop();
          return true;
        }
        return false;
      };
      const wrapComment = function(width, move) {
        for (const token of move.split(" ")) {
          if (!token) {
            continue;
          }
          if (width + token.length > maxWidth) {
            while (strip()) {
              width--;
            }
            result.push(newline);
            width = 0;
          }
          result.push(token);
          width += token.length;
          result.push(" ");
          width++;
        }
        if (strip()) {
          width--;
        }
        return width;
      };
      let currentWidth = 0;
      for (let i = 0; i < moves.length; i++) {
        if (currentWidth + moves[i].length > maxWidth) {
          if (moves[i].includes("{")) {
            currentWidth = wrapComment(currentWidth, moves[i]);
            continue;
          }
        }
        if (currentWidth + moves[i].length > maxWidth && i !== 0) {
          if (result[result.length - 1] === " ") {
            result.pop();
          }
          result.push(newline);
          currentWidth = 0;
        } else if (i !== 0) {
          result.push(" ");
          currentWidth++;
        }
        result.push(moves[i]);
        currentWidth += moves[i].length;
      }
      return result.join("");
    }
    /**
     * @deprecated Use `setHeader` and `getHeaders` instead. This method will return null header tags (which is not what you want)
     */
    header(...args) {
      for (let i = 0; i < args.length; i += 2) {
        if (typeof args[i] === "string" && typeof args[i + 1] === "string") {
          this._header[args[i]] = args[i + 1];
        }
      }
      return this._header;
    }
    // TODO: value validation per spec
    setHeader(key, value) {
      this._header[key] = value ?? SEVEN_TAG_ROSTER[key] ?? null;
      return this.getHeaders();
    }
    removeHeader(key) {
      if (key in this._header) {
        this._header[key] = SEVEN_TAG_ROSTER[key] || null;
        return true;
      }
      return false;
    }
    // return only non-null headers (omit placemarker nulls)
    getHeaders() {
      const nonNullHeaders = {};
      for (const [key, value] of Object.entries(this._header)) {
        if (value !== null) {
          nonNullHeaders[key] = value;
        }
      }
      return nonNullHeaders;
    }
    loadPgn(pgn2, { strict = false, newlineChar = "\r?\n" } = {}) {
      if (newlineChar !== "\r?\n") {
        pgn2 = pgn2.replace(new RegExp(newlineChar, "g"), "\n");
      }
      const parsedPgn = peg$parse(pgn2);
      this.reset();
      const headers = parsedPgn.headers;
      let fen = "";
      for (const key in headers) {
        if (key.toLowerCase() === "fen") {
          fen = headers[key];
        }
        this.header(key, headers[key]);
      }
      if (!strict) {
        if (fen) {
          this.load(fen, { preserveHeaders: true });
        }
      } else {
        if (headers["SetUp"] === "1") {
          if (!("FEN" in headers)) {
            throw new Error("Invalid PGN: FEN tag must be supplied with SetUp tag");
          }
          this.load(headers["FEN"], { preserveHeaders: true });
        }
      }
      let node2 = parsedPgn.root;
      while (node2) {
        if (node2.move) {
          const move = this._moveFromSan(node2.move, strict);
          if (move == null) {
            throw new Error(`Invalid move in PGN: ${node2.move}`);
          } else {
            this._makeMove(move);
            this._incPositionCount();
          }
        }
        if (node2.comment !== void 0) {
          this._comments[this.fen()] = node2.comment;
        }
        node2 = node2.variations[0];
      }
      const result = parsedPgn.result;
      if (result && Object.keys(this._header).length && this._header["Result"] !== result) {
        this.setHeader("Result", result);
      }
    }
    /*
     * Convert a move from 0x88 coordinates to Standard Algebraic Notation
     * (SAN)
     *
     * @param {boolean} strict Use the strict SAN parser. It will throw errors
     * on overly disambiguated moves (see below):
     *
     * r1bqkbnr/ppp2ppp/2n5/1B1pP3/4P3/8/PPPP2PP/RNBQK1NR b KQkq - 2 4
     * 4. ... Nge7 is overly disambiguated because the knight on c6 is pinned
     * 4. ... Ne7 is technically the valid SAN
     */
    _moveToSan(move, moves) {
      let output = "";
      if (move.flags & BITS.KSIDE_CASTLE) {
        output = "O-O";
      } else if (move.flags & BITS.QSIDE_CASTLE) {
        output = "O-O-O";
      } else if (move.flags & BITS.NULL_MOVE) {
        return SAN_NULLMOVE;
      } else {
        if (move.piece !== PAWN) {
          const disambiguator = getDisambiguator(move, moves);
          output += move.piece.toUpperCase() + disambiguator;
        }
        if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
          if (move.piece === PAWN) {
            output += algebraic(move.from)[0];
          }
          output += "x";
        }
        output += algebraic(move.to);
        if (move.promotion) {
          output += "=" + move.promotion.toUpperCase();
        }
      }
      this._makeMove(move);
      if (this.isCheck()) {
        if (this.isCheckmate()) {
          output += "#";
        } else {
          output += "+";
        }
      }
      this._undoMove();
      return output;
    }
    // convert a move from Standard Algebraic Notation (SAN) to 0x88 coordinates
    _moveFromSan(move, strict = false) {
      let cleanMove = strippedSan(move);
      if (!strict) {
        if (cleanMove === "0-0") {
          cleanMove = "O-O";
        } else if (cleanMove === "0-0-0") {
          cleanMove = "O-O-O";
        }
      }
      if (cleanMove == SAN_NULLMOVE) {
        const res = {
          color: this._turn,
          from: 0,
          to: 0,
          piece: "k",
          flags: BITS.NULL_MOVE
        };
        return res;
      }
      let pieceType = inferPieceType(cleanMove);
      let moves = this._moves({ legal: true, piece: pieceType });
      for (let i = 0, len = moves.length; i < len; i++) {
        if (cleanMove === strippedSan(this._moveToSan(moves[i], moves))) {
          return moves[i];
        }
      }
      if (strict) {
        return null;
      }
      let piece = void 0;
      let matches = void 0;
      let from = void 0;
      let to = void 0;
      let promotion = void 0;
      let overlyDisambiguated = false;
      matches = cleanMove.match(/([pnbrqkPNBRQK])?([a-h][1-8])x?-?([a-h][1-8])([qrbnQRBN])?/);
      if (matches) {
        piece = matches[1];
        from = matches[2];
        to = matches[3];
        promotion = matches[4];
        if (from.length == 1) {
          overlyDisambiguated = true;
        }
      } else {
        matches = cleanMove.match(/([pnbrqkPNBRQK])?([a-h]?[1-8]?)x?-?([a-h][1-8])([qrbnQRBN])?/);
        if (matches) {
          piece = matches[1];
          from = matches[2];
          to = matches[3];
          promotion = matches[4];
          if (from.length == 1) {
            overlyDisambiguated = true;
          }
        }
      }
      pieceType = inferPieceType(cleanMove);
      moves = this._moves({
        legal: true,
        piece: piece ? piece : pieceType
      });
      if (!to) {
        return null;
      }
      for (let i = 0, len = moves.length; i < len; i++) {
        if (!from) {
          if (cleanMove === strippedSan(this._moveToSan(moves[i], moves)).replace("x", "")) {
            return moves[i];
          }
        } else if ((!piece || piece.toLowerCase() == moves[i].piece) && Ox88[from] == moves[i].from && Ox88[to] == moves[i].to && (!promotion || promotion.toLowerCase() == moves[i].promotion)) {
          return moves[i];
        } else if (overlyDisambiguated) {
          const square = algebraic(moves[i].from);
          if ((!piece || piece.toLowerCase() == moves[i].piece) && Ox88[to] == moves[i].to && (from == square[0] || from == square[1]) && (!promotion || promotion.toLowerCase() == moves[i].promotion)) {
            return moves[i];
          }
        }
      }
      return null;
    }
    ascii() {
      let s = "   +------------------------+\n";
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (file(i) === 0) {
          s += " " + "87654321"[rank(i)] + " |";
        }
        if (this._board[i]) {
          const piece = this._board[i].type;
          const color = this._board[i].color;
          const symbol = color === WHITE ? piece.toUpperCase() : piece.toLowerCase();
          s += " " + symbol + " ";
        } else {
          s += " . ";
        }
        if (i + 1 & 136) {
          s += "|\n";
          i += 8;
        }
      }
      s += "   +------------------------+\n";
      s += "     a  b  c  d  e  f  g  h";
      return s;
    }
    perft(depth) {
      const moves = this._moves({ legal: false });
      let nodes = 0;
      const color = this._turn;
      for (let i = 0, len = moves.length; i < len; i++) {
        this._makeMove(moves[i]);
        if (!this._isKingAttacked(color)) {
          if (depth - 1 > 0) {
            nodes += this.perft(depth - 1);
          } else {
            nodes++;
          }
        }
        this._undoMove();
      }
      return nodes;
    }
    setTurn(color) {
      if (this._turn == color) {
        return false;
      }
      this.move("--");
      return true;
    }
    turn() {
      return this._turn;
    }
    board() {
      const output = [];
      let row = [];
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (this._board[i] == null) {
          row.push(null);
        } else {
          row.push({
            square: algebraic(i),
            type: this._board[i].type,
            color: this._board[i].color
          });
        }
        if (i + 1 & 136) {
          output.push(row);
          row = [];
          i += 8;
        }
      }
      return output;
    }
    squareColor(square) {
      if (square in Ox88) {
        const sq = Ox88[square];
        return (rank(sq) + file(sq)) % 2 === 0 ? "light" : "dark";
      }
      return null;
    }
    history({ verbose = false } = {}) {
      const reversedHistory = [];
      const moveHistory = [];
      while (this._history.length > 0) {
        reversedHistory.push(this._undoMove());
      }
      while (true) {
        const move = reversedHistory.pop();
        if (!move) {
          break;
        }
        if (verbose) {
          moveHistory.push(new Move(this, move));
        } else {
          moveHistory.push(this._moveToSan(move, this._moves()));
        }
        this._makeMove(move);
      }
      return moveHistory;
    }
    /*
     * Keeps track of position occurrence counts for the purpose of repetition
     * checking. Old positions are removed from the map if their counts are reduced to 0.
     */
    _getPositionCount(hash) {
      return this._positionCount.get(hash) ?? 0;
    }
    _incPositionCount() {
      this._positionCount.set(this._hash, (this._positionCount.get(this._hash) ?? 0) + 1);
    }
    _decPositionCount(hash) {
      const currentCount = this._positionCount.get(hash) ?? 0;
      if (currentCount === 1) {
        this._positionCount.delete(hash);
      } else {
        this._positionCount.set(hash, currentCount - 1);
      }
    }
    _pruneComments() {
      const reversedHistory = [];
      const currentComments = {};
      const copyComment = (fen) => {
        if (fen in this._comments) {
          currentComments[fen] = this._comments[fen];
        }
      };
      while (this._history.length > 0) {
        reversedHistory.push(this._undoMove());
      }
      copyComment(this.fen());
      while (true) {
        const move = reversedHistory.pop();
        if (!move) {
          break;
        }
        this._makeMove(move);
        copyComment(this.fen());
      }
      this._comments = currentComments;
    }
    getComment() {
      return this._comments[this.fen()];
    }
    setComment(comment) {
      this._comments[this.fen()] = comment.replace("{", "[").replace("}", "]");
    }
    /**
     * @deprecated Renamed to `removeComment` for consistency
     */
    deleteComment() {
      return this.removeComment();
    }
    removeComment() {
      const comment = this._comments[this.fen()];
      delete this._comments[this.fen()];
      return comment;
    }
    getComments() {
      this._pruneComments();
      return Object.keys(this._comments).map((fen) => {
        return { fen, comment: this._comments[fen] };
      });
    }
    /**
     * @deprecated Renamed to `removeComments` for consistency
     */
    deleteComments() {
      return this.removeComments();
    }
    removeComments() {
      this._pruneComments();
      return Object.keys(this._comments).map((fen) => {
        const comment = this._comments[fen];
        delete this._comments[fen];
        return { fen, comment };
      });
    }
    setCastlingRights(color, rights) {
      for (const side of [KING, QUEEN]) {
        if (rights[side] !== void 0) {
          if (rights[side]) {
            this._castling[color] |= SIDES[side];
          } else {
            this._castling[color] &= ~SIDES[side];
          }
        }
      }
      this._updateCastlingRights();
      const result = this.getCastlingRights(color);
      return (rights[KING] === void 0 || rights[KING] === result[KING]) && (rights[QUEEN] === void 0 || rights[QUEEN] === result[QUEEN]);
    }
    getCastlingRights(color) {
      return {
        [KING]: (this._castling[color] & SIDES[KING]) !== 0,
        [QUEEN]: (this._castling[color] & SIDES[QUEEN]) !== 0
      };
    }
    moveNumber() {
      return this._moveNumber;
    }
  };

  // <stdin>
  var SPRITES = { "cm-chessboard-sprite": '<!--\n\nLICENSE\n=======\n\nChess pieces\n~~~~~~~~~~~~\n\nThe chess pieces in this sprite are copies from Wikimedia Commons\nhttps://commons.wikimedia.org/wiki/Category:SVG_chess_pieces/Standard\n\nLicense: Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)\nhttps://creativecommons.org/licenses/by-sa/3.0/\n\nAuthors:\n- https://en.wikipedia.org/wiki/User:Cburnett\n- https://en.wikipedia.org/wiki/User:Rfc1394\n\nmodified by shaack (https://shaack.com) for the usage in cm-chessboard.\nhttps://github.com/shaack/cm-chessboard\n\n-->\n<svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg">\n    <title>cm-chessboard pieces and markers sprite</title>\n    <desc>Chess pieces and markers for the cm-chessboard (https://shaack.com/projekte/cm-chessboard/).</desc>\n\n    <g id="wk" stroke-linecap="round" stroke-linejoin="round" transform="translate(5.000000, 5.000000)" stroke="#000000"\n       stroke-width="1.5">\n        <line x1="15" y1="4.96764706" x2="15" y2="0" id="Shape"/>\n        <line x1="12.8571429" y1="1.76470588" x2="17.1428571" y2="1.76470588" id="Shape"/>\n        <path d="M17.5714286,7.5 C17.5714286,7.5 16.7142857,5.29411765 15,5.29411765 C13.2857143,5.29411765 12.4285714,7.5 12.4285714,7.5 C11.1428571,10.1470588 15,16.7647059 15,16.7647059 C15,16.7647059 18.8571429,10.1470588 17.5714286,7.5 Z"\n              id="Shape" fill="#FFFFFF"/>\n        <path d="M5.57142857,27.3529412 C10.2857143,30.4411765 18.8571429,30.4411765 23.5714286,27.3529412 L23.5714286,21.1764706 C23.5714286,21.1764706 31.2857143,17.2058824 28.7142857,11.9117647 C25.2857143,6.17647059 17.1428571,8.82352941 15,15.4411765 L15,18.5294118 L15,15.4411765 C12,8.82352941 3.85714286,6.17647059 1.28571429,11.9117647 C-1.28571429,17.2058824 5.57142857,20.7352941 5.57142857,20.7352941 L5.57142857,27.3529412 Z"\n              id="Shape" fill="#FFFFFF"/>\n        <path d="M5.57142857,21.1764706 C10.2857143,18.5294118 18.8571429,18.5294118 23.5714286,21.1764706" id="Shape"\n              fill-opacity="0" fill="#000000"/>\n        <path d="M5.57142857,24.2647059 C10.2857143,21.6176471 18.8571429,21.6176471 23.5714286,24.2647059" id="Shape"\n              fill-opacity="0" fill="#000000" stroke-linecap="square"/>\n        <path d="M5.57142857,27.3529412 C10.2857143,24.7058824 18.8571429,24.7058824 23.5714286,27.3529412" id="Shape"\n              fill-opacity="0" fill="#000000"/>\n    </g>\n    <g id="wq" stroke-linecap="round" stroke-linejoin="round" transform="translate(4.000000, 5.000000)" stroke="#000000"\n       stroke-width="1.5">\n        <path d="M3.45945946,6.2 C3.45945946,7.17833299 2.68503308,7.97142857 1.72972973,7.97142857 C0.774426379,7.97142857 0,7.17833299 0,6.2 C0,5.22166701 0.774426379,4.42857143 1.72972973,4.42857143 C2.68503308,4.42857143 3.45945946,5.22166701 3.45945946,6.2 Z"\n              id="Shape" fill="#FFFFFF"/>\n        <path d="M17.7297297,2.21428571 C17.7297297,3.1926187 16.9553034,3.98571429 16,3.98571429 C15.0446966,3.98571429 14.2702703,3.1926187 14.2702703,2.21428571 C14.2702703,1.23595273 15.0446966,0.442857143 16,0.442857143 C16.9553034,0.442857143 17.7297297,1.23595273 17.7297297,2.21428571 Z"\n              id="Shape" fill="#FFFFFF"/>\n        <path d="M32,6.2 C32,7.17833299 31.2255736,7.97142857 30.2702703,7.97142857 C29.3149669,7.97142857 28.5405405,7.17833299 28.5405405,6.2 C28.5405405,5.22166701 29.3149669,4.42857143 30.2702703,4.42857143 C31.2255736,4.42857143 32,5.22166701 32,6.2 Z"\n              id="Shape" fill="#FFFFFF"/>\n        <path d="M10.3783784,3.1 C10.3783784,4.07833299 9.603952,4.87142857 8.64864865,4.87142857 C7.6933453,4.87142857 6.91891892,4.07833299 6.91891892,3.1 C6.91891892,2.12166701 7.6933453,1.32857143 8.64864865,1.32857143 C9.603952,1.32857143 10.3783784,2.12166701 10.3783784,3.1 Z"\n              id="Shape" fill="#FFFFFF"/>\n        <path d="M25.0810811,3.54285714 C25.0810811,4.52119013 24.3066547,5.31428571 23.3513514,5.31428571 C22.396048,5.31428571 21.6216216,4.52119013 21.6216216,3.54285714 C21.6216216,2.56452416 22.396048,1.77142857 23.3513514,1.77142857 C24.3066547,1.77142857 25.0810811,2.56452416 25.0810811,3.54285714 Z"\n              id="Shape" fill="#FFFFFF"/>\n        <path d="M4.32432432,18.6 C11.6756757,17.2714286 22.4864865,17.2714286 27.6756757,18.6 L29.4054054,7.97142857 L23.3513514,17.7142857 L23.3513514,5.31428571 L18.5945946,17.2714286 L16,3.98571429 L13.4054054,17.2714286 L8.64864865,4.87142857 L8.64864865,17.7142857 L2.59459459,7.97142857 L4.32432432,18.6 Z"\n              id="Shape" fill="#FFFFFF"/>\n        <path d="M4.32432432,18.6 C4.32432432,20.3714286 5.62162162,20.3714286 6.48648649,22.1428571 C7.35135135,23.4714286 7.35135135,23.0285714 6.91891892,25.2428571 C5.62162162,26.1285714 5.62162162,27.4571429 5.62162162,27.4571429 C4.32432432,28.7857143 6.05405405,29.6714286 6.05405405,29.6714286 C11.6756757,30.5571429 20.3243243,30.5571429 25.9459459,29.6714286 C25.9459459,29.6714286 27.2432432,28.7857143 25.9459459,27.4571429 C25.9459459,27.4571429 26.3783784,26.1285714 25.0810811,25.2428571 C24.6486486,23.0285714 24.6486486,23.4714286 25.5135135,22.1428571 C26.3783784,20.3714286 27.6756757,20.3714286 27.6756757,18.6 C20.3243243,17.2714286 11.6756757,17.2714286 4.32432432,18.6 Z"\n              id="Shape" fill="#FFFFFF"/>\n        <path d="M6.48648649,22.1428571 C9.51351351,21.2571429 22.4864865,21.2571429 25.5135135,22.1428571" id="Shape"/>\n        <path d="M6.91891892,25.2428571 C12.1081081,24.3571429 19.8918919,24.3571429 25.0810811,25.2428571" id="Shape"/>\n    </g>\n    <g id="wb" stroke-linecap="round" stroke-linejoin="round" transform="translate(6.000000, 5.000000)" stroke="#000000"\n       stroke-width="1.5">\n        <g id="Group" fill="#FFFFFF">\n            <path d="M2.54545455,27.3529412 C5.42181818,26.4970588 11.1236364,27.7323529 14,25.5882353 C16.8763636,27.7323529 22.5781818,26.4970588 25.4545455,27.3529412 C25.4545455,27.3529412 26.8545455,27.8294118 28,29.1176471 C27.4230303,29.9735294 26.6,29.9911765 25.4545455,29.5588235 C22.5781818,28.7029412 16.8763636,29.9647059 14,28.6764706 C11.1236364,29.9647059 5.42181818,28.7029412 2.54545455,29.5588235 C1.39660606,29.9911765 0.574424242,29.9735294 0,29.1176471 C1.14884848,27.4058824 2.54545455,27.3529412 2.54545455,27.3529412 Z"\n                  id="Shape"/>\n            <path d="M7.63636364,23.8235294 C9.75757576,26.0294118 18.2424242,26.0294118 20.3636364,23.8235294 C20.7878788,22.5 20.3636364,22.0588235 20.3636364,22.0588235 C20.3636364,19.8529412 18.2424242,18.5294118 18.2424242,18.5294118 C22.9090909,17.2058824 23.3333333,8.38235294 14,4.85294118 C4.66666667,8.38235294 5.09090909,17.2058824 9.75757576,18.5294118 C9.75757576,18.5294118 7.63636364,19.8529412 7.63636364,22.0588235 C7.63636364,22.0588235 7.21212121,22.5 7.63636364,23.8235294 Z"\n                  id="Shape"/>\n            <path d="M16.1212121,2.64705882 C16.1212121,3.86533401 15.1715131,4.85294118 14,4.85294118 C12.8284869,4.85294118 11.8787879,3.86533401 11.8787879,2.64705882 C11.8787879,1.42878364 12.8284869,0.441176471 14,0.441176471 C15.1715131,0.441176471 16.1212121,1.42878364 16.1212121,2.64705882 Z"\n                  id="Shape"/>\n        </g>\n        <path d="M9.75757576,18.5294118 L18.2424242,18.5294118 M7.63636364,22.0588235 L20.3636364,22.0588235 M14,9.26470588 L14,13.6764706 M11.8787879,11.4705882 L16.1212121,11.4705882"\n              id="Shape"/>\n    </g>\n    <g id="wn" stroke-linecap="round" stroke-linejoin="round" transform="translate(6.000000, 6.000000)"\n       stroke="#000000">\n        <path d="M13.5757576,2.625 C22.4848485,3.5 27.5757576,9.625 27.1515152,28 L7.63636364,28 C7.63636364,20.125 16.1212121,22.3125 14.4242424,9.625"\n              id="Shape" stroke-width="1.5" fill="#FFFFFF"/>\n        <path d="M15.2727273,9.625 C15.5951515,12.17125 10.5636364,16.07375 8.48484848,17.5 C5.93939394,19.25 6.09212121,21.2975 4.24242424,21 C3.35830303,20.1775 5.43878788,18.34 4.24242424,18.375 C3.39393939,18.375 4.40363636,19.45125 3.39393939,20.125 C2.54545455,20.125 -0.00254545455,21 -1.90580876e-06,16.625 C-1.90580876e-06,14.875 5.09090909,6.125 5.09090909,6.125 C5.09090909,6.125 6.69454545,4.4625 6.78787879,3.0625 C6.16848485,2.19275 6.36363636,1.3125 6.36363636,0.4375 C7.21212121,-0.4375 8.90909091,2.625 8.90909091,2.625 L10.6060606,2.625 C10.6060606,2.625 11.2678788,0.882 12.7272727,0 C13.5757576,0 13.5757576,2.625 13.5757576,2.625"\n              id="Shape" stroke-width="1.5" fill="#FFFFFF"/>\n        <path d="M2.96969697,16.1875 C2.96969697,16.4291246 2.77975717,16.625 2.54545455,16.625 C2.31115192,16.625 2.12121212,16.4291246 2.12121212,16.1875 C2.12121212,15.9458754 2.31115192,15.75 2.54545455,15.75 C2.77975717,15.75 2.96969697,15.9458754 2.96969697,16.1875 Z"\n              id="Shape" stroke-width="1.5" fill="#000000"/>\n        <path d="M7.6363543,7.4375 C7.6363543,8.16235779 7.44641868,8.74997112 7.21212121,8.74997112 C6.97782375,8.74997112 6.78788812,8.16235779 6.78788812,7.4375 C6.78788812,6.71264221 6.97782375,6.12502888 7.21212121,6.12502888 C7.44641868,6.12502888 7.6363543,6.71264221 7.6363543,7.4375 L7.6363543,7.4375 Z"\n              id="Shape" stroke-width="1.499967" fill="#000000"\n              transform="translate(7.212121, 7.437500) rotate(30.000728) translate(-7.212121, -7.437500) "/>\n    </g>\n    <g id="wr" stroke-linecap="round" stroke-linejoin="round" transform="translate(9.000000, 8.000000)" stroke="#000000"\n       stroke-width="1.5">\n        <polygon id="Shape" fill="#FFFFFF" points="0 26 22 26 22 23.4 0 23.4"/>\n        <polygon id="Shape" fill="#FFFFFF"\n                 points="2.44444444 23.4 2.44444444 19.9333333 19.5555556 19.9333333 19.5555556 23.4"/>\n        <polyline id="Shape" fill="#FFFFFF"\n                  points="1.62962963 4.33333333 1.62962963 0 4.88888889 0 4.88888889 1.73333333 8.96296296 1.73333333 8.96296296 0 13.037037 0 13.037037 1.73333333 17.1111111 1.73333333 17.1111111 0 20.3703704 0 20.3703704 4.33333333"/>\n        <polyline id="Shape" fill="#FFFFFF"\n                  points="20.3703704 4.33333333 17.9259259 6.93333333 4.07407407 6.93333333 1.62962963 4.33333333"/>\n        <polyline id="Shape" fill="#FFFFFF"\n                  points="17.9259259 6.93333333 17.9259259 17.7666667 4.07407407 17.7666667 4.07407407 6.93333333"/>\n        <polyline id="Shape" fill="#FFFFFF"\n                  points="17.9259259 17.7666667 19.1481481 19.9333333 2.85185185 19.9333333 4.07407407 17.7666667"/>\n        <line x1="1.62962963" y1="4.33333333" x2="20.3703704" y2="4.33333333" id="Shape"/>\n    </g>\n    <g id="wp" transform="translate(10.000000, 9.000000)" fill="#FFFFFF" stroke="#000000" stroke-linecap="round"\n       stroke-width="1.5">\n        <path d="M10,0 C8.15833333,0 6.66666667,1.50129032 6.66666667,3.35483871 C6.66666667,4.10129032 6.90833333,4.78903226 7.31666667,5.35096774 C5.69166667,6.29032258 4.58333333,8.04322581 4.58333333,10.0645161 C4.58333333,11.7670968 5.36666667,13.2851613 6.59166667,14.2832258 C4.09166667,15.1722581 0.416666667,18.9380645 0.416666667,25.5806452 L19.5833333,25.5806452 C19.5833333,18.9380645 15.9083333,15.1722581 13.4083333,14.2832258 C14.6333333,13.2851613 15.4166667,11.7670968 15.4166667,10.0645161 C15.4166667,8.04322581 14.3083333,6.29032258 12.6833333,5.35096774 C13.0916667,4.78903226 13.3333333,4.10129032 13.3333333,3.35483871 C13.3333333,1.50129032 11.8416667,0 10,0 Z"\n              id="Shape"/>\n    </g>\n    <g id="bk" stroke-linecap="round" stroke-linejoin="round" transform="translate(5.000000, 5.000000)"\n       stroke-width="1.5">\n        <line x1="15" y1="4.96764706" x2="15" y2="0" id="Shape" stroke="#000000"/>\n        <path d="M15,16.7647059 C15,16.7647059 18.8571429,10.1470588 17.5714286,7.5 C17.5714286,7.5 16.7142857,5.29411765 15,5.29411765 C13.2857143,5.29411765 12.4285714,7.5 12.4285714,7.5 C11.1428571,10.1470588 15,16.7647059 15,16.7647059"\n              id="Shape" stroke="#000000" fill="#000000"/>\n        <path d="M5.57142857,27.3529412 C10.2857143,30.4411765 18.8571429,30.4411765 23.5714286,27.3529412 L23.5714286,21.1764706 C23.5714286,21.1764706 31.2857143,17.2058824 28.7142857,11.9117647 C25.2857143,6.17647059 17.1428571,8.82352941 15,15.4411765 L15,18.5294118 L15,15.4411765 C12,8.82352941 3.85714286,6.17647059 1.28571429,11.9117647 C-1.28571429,17.2058824 5.57142857,20.7352941 5.57142857,20.7352941 L5.57142857,27.3529412 Z"\n              id="Shape" stroke="#000000" fill="#000000"/>\n        <line x1="12.8571429" y1="1.76470588" x2="17.1428571" y2="1.76470588" id="Shape" stroke="#000000"/>\n        <path d="M23.1428571,20.7352941 C23.1428571,20.7352941 30.4285714,17.2058824 28.3114286,12.2205882 C24.9857143,7.05882353 17.1428571,10.5882353 15,16.3235294 L15.0085714,18.1764706 L15,16.3235294 C12.8571429,10.5882353 4.20514286,7.05882353 1.71171429,12.2205882 C-0.428571429,17.2058824 5.87142857,20.1617647 5.87142857,20.1617647"\n              id="Shape" stroke="#FFFFFF"/>\n        <path d="M5.57142857,21.1764706 C10.2857143,18.5294118 18.8571429,18.5294118 23.5714286,21.1764706 M5.57142857,24.2647059 C10.2857143,21.6176471 18.8571429,21.6176471 23.5714286,24.2647059 M5.57142857,27.3529412 C10.2857143,24.7058824 18.8571429,24.7058824 23.5714286,27.3529412"\n              id="Shape" stroke="#FFFFFF"/>\n    </g>\n    <g id="bq" stroke-linecap="round" stroke-linejoin="round" transform="translate(3.000000, 4.000000)">\n        <g id="Group" fill="#000000">\n            <ellipse id="Oval" cx="2.61538462" cy="6.22222222" rx="2.3974359" ry="2.44444444"/>\n            <ellipse id="Oval" cx="9.58974359" cy="3.55555556" rx="2.3974359" ry="2.44444444"/>\n            <ellipse id="Oval" cx="17" cy="2.66666667" rx="2.3974359" ry="2.44444444"/>\n            <ellipse id="Oval" cx="24.4102564" cy="3.55555556" rx="2.3974359" ry="2.44444444"/>\n            <ellipse id="Oval" cx="31.3846154" cy="6.22222222" rx="2.3974359" ry="2.44444444"/>\n        </g>\n        <path d="M5.23076923,18.6666667 C12.6410256,17.3333333 23.5384615,17.3333333 28.7692308,18.6666667 L30.9487179,7.55555556 L24.4102564,17.7777778 L24.1487179,5.24444444 L19.6153846,17.3333333 L17,4.44444444 L14.3846154,17.3333333 L9.85128205,5.24444444 L9.58974359,17.7777778 L3.05128205,7.55555556 L5.23076923,18.6666667 Z"\n              id="crown" stroke="#000000" stroke-width="1.5" fill="#000000"/>\n        <path d="M5.23076923,18.6666667 C5.23076923,20.4444444 6.53846154,20.4444444 7.41025641,22.2222222 C8.28205128,23.5555556 8.28205128,23.1111111 7.84615385,25.3333333 C6.53846154,26.2222222 6.53846154,27.5555556 6.53846154,27.5555556 C5.23076923,28.8888889 6.97435897,29.7777778 6.97435897,29.7777778 C12.6410256,30.6666667 21.3589744,30.6666667 27.025641,29.7777778 C27.025641,29.7777778 28.3333333,28.8888889 27.025641,27.5555556 C27.025641,27.5555556 27.4615385,26.2222222 26.1538462,25.3333333 C25.7179487,23.1111111 25.7179487,23.5555556 26.5897436,22.2222222 C27.4615385,20.4444444 28.7692308,20.4444444 28.7692308,18.6666667 C21.3589744,17.3333333 12.6410256,17.3333333 5.23076923,18.6666667 Z"\n              id="Shape" stroke="#000000" stroke-width="1.5" fill="#000000"/>\n        <path d="M6.97435897,29.7777778 C13.4672777,32.080866 20.5327223,32.080866 27.025641,29.7777778" id="Shape"\n              stroke="#000000" stroke-width="1.5"/>\n        <path d="M6.97435897,21.3333333 C13.4672777,19.0302452 20.5327223,19.0302452 27.025641,21.3333333" id="Shape"\n              stroke="#FFFFFF" stroke-width="1.5"/>\n        <line x1="8.28205128" y1="23.5555556" x2="25.7179487" y2="23.5555556" id="Shape" stroke="#FFFFFF"\n              stroke-width="1.5"/>\n        <path d="M7.41025641,26.2222222 C13.6372326,28.3241535 20.3627674,28.3241535 26.5897436,26.2222222" id="Shape"\n              stroke="#FFFFFF" stroke-width="1.5"/>\n        <path d="M6.53846154,28.8888889 C13.2948481,31.4031829 20.7051519,31.4031829 27.4615385,28.8888889" id="Shape"\n              stroke="#FFFFFF" stroke-width="1.5"/>\n    </g>\n    <g id="bb" stroke-linecap="round" stroke-linejoin="round" transform="translate(6.000000, 5.000000)"\n       stroke-width="1.5">\n        <g id="Group" fill="#000000" stroke="#000000">\n            <path d="M2.54545455,27.3529412 C5.42181818,26.4970588 11.1236364,27.7323529 14,25.5882353 C16.8763636,27.7323529 22.5781818,26.4970588 25.4545455,27.3529412 C25.4545455,27.3529412 26.8545455,27.8294118 28,29.1176471 C27.4230303,29.9735294 26.6,29.9911765 25.4545455,29.5588235 C22.5781818,28.7029412 16.8763636,29.9647059 14,28.6764706 C11.1236364,29.9647059 5.42181818,28.7029412 2.54545455,29.5588235 C1.39660606,29.9911765 0.574424242,29.9735294 0,29.1176471 C1.14884848,27.4058824 2.54545455,27.3529412 2.54545455,27.3529412 Z"\n                  id="Shape"/>\n            <path d="M7.63636364,23.8235294 C9.75757576,26.0294118 18.2424242,26.0294118 20.3636364,23.8235294 C20.7878788,22.5 20.3636364,22.0588235 20.3636364,22.0588235 C20.3636364,19.8529412 18.2424242,18.5294118 18.2424242,18.5294118 C22.9090909,17.2058824 23.3333333,8.38235294 14,4.85294118 C4.66666667,8.38235294 5.09090909,17.2058824 9.75757576,18.5294118 C9.75757576,18.5294118 7.63636364,19.8529412 7.63636364,22.0588235 C7.63636364,22.0588235 7.21212121,22.5 7.63636364,23.8235294 Z"\n                  id="Shape"/>\n            <path d="M16.1212121,2.64705882 C16.1212121,3.86533401 15.1715131,4.85294118 14,4.85294118 C12.8284869,4.85294118 11.8787879,3.86533401 11.8787879,2.64705882 C11.8787879,1.42878364 12.8284869,0.441176471 14,0.441176471 C15.1715131,0.441176471 16.1212121,1.42878364 16.1212121,2.64705882 Z"\n                  id="Shape"/>\n        </g>\n        <path d="M9.75757576,18.5294118 L18.2424242,18.5294118 M7.63636364,22.0588235 L20.3636364,22.0588235 M14,9.26470588 L14,13.6764706 M11.8787879,11.4705882 L16.1212121,11.4705882"\n              id="Shape" stroke="#FFFFFF"/>\n    </g>\n    <g id="bn" stroke-linecap="round" stroke-linejoin="round" transform="translate(6.000000, 6.000000)">\n        <path d="M13.5757576,2.63636364 C22.4848485,3.51515152 27.5757576,9.66666667 27.1515152,28.1212121 L7.63636364,28.1212121 C7.63636364,20.2121212 16.1212121,22.4090909 14.4242424,9.66666667"\n              id="Shape" stroke="#000000" stroke-width="1.5" fill="#000000"/>\n        <path d="M15.2727273,9.66666667 C15.5951515,12.2239394 10.5636364,16.1433333 8.48484848,17.5757576 C5.93939394,19.3333333 6.09212121,21.389697 4.24242424,21.0909091 C3.35830303,20.2648485 5.43878788,18.4193939 4.24242424,18.4545455 C3.39393939,18.4545455 4.40363636,19.5354545 3.39393939,20.2121212 C2.54545455,20.2121212 -0.00254545455,21.0909091 -1.90580876e-06,16.6969697 C-1.90580876e-06,14.9393939 5.09090909,6.15151515 5.09090909,6.15151515 C5.09090909,6.15151515 6.69454545,4.48181818 6.78787879,3.07575758 C6.16848485,2.20224242 6.36363636,1.31818182 6.36363636,0.439393939 C7.21212121,-0.439393939 8.90909091,2.63636364 8.90909091,2.63636364 L10.6060606,2.63636364 C10.6060606,2.63636364 11.2678788,0.885818182 12.7272727,0 C13.5757576,0 13.5757576,2.63636364 13.5757576,2.63636364"\n              id="Shape" stroke="#000000" stroke-width="1.5" fill="#000000"/>\n        <path d="M2.96969697,16.2575758 C2.96969697,16.5002463 2.77975717,16.6969697 2.54545455,16.6969697 C2.31115192,16.6969697 2.12121212,16.5002463 2.12121212,16.2575758 C2.12121212,16.0149052 2.31115192,15.8181818 2.54545455,15.8181818 C2.77975717,15.8181818 2.96969697,16.0149052 2.96969697,16.2575758 Z"\n              id="Shape" stroke="#FFFFFF" stroke-width="1.5" fill="#FFFFFF"/>\n        <path d="M7.6363543,7.46969697 C7.6363543,8.19769267 7.44641868,8.78784979 7.21212121,8.78784979 C6.97782375,8.78784979 6.78788812,8.19769267 6.78788812,7.46969697 C6.78788812,6.74170127 6.97782375,6.15154415 7.21212121,6.15154415 C7.44641868,6.15154415 7.6363543,6.74170127 7.6363543,7.46969697 L7.6363543,7.46969697 Z"\n              id="Shape" stroke="#FFFFFF" stroke-width="1.499967" fill="#FFFFFF"\n              transform="translate(7.212121, 7.469697) rotate(30.000728) translate(-7.212121, -7.469697) "/>\n        <path d="M15.7393939,2.98787879 L15.3575758,4.26212121 L15.7818182,4.39393939 C18.4545455,5.27272727 20.5757576,6.58212121 22.4848485,10.3257576 C24.3939394,14.0693939 25.2424242,19.3860606 24.8181818,28.1212121 L24.7757576,28.5606061 L26.6848485,28.5606061 L26.7272727,28.1212121 C27.1515152,19.2806061 25.9806061,13.3136364 23.969697,9.36787879 C21.9587879,5.42212121 19.0569697,3.53272727 16.1721212,3.07575758 L15.7393939,2.98787879 Z"\n              id="Shape" fill="#FFFFFF"/>\n    </g>\n    <g id="br" stroke-linecap="round" stroke-linejoin="round" transform="translate(9.000000, 8.000000)">\n        <polygon id="Shape" stroke="#000000" stroke-width="1.5" fill="#000000" points="0 26 22 26 22 23.4 0 23.4"/>\n        <polygon id="Shape" stroke="#000000" stroke-width="1.5" fill="#000000"\n                 points="2.85185185 19.9333333 4.07407407 17.7666667 17.9259259 17.7666667 19.1481481 19.9333333"/>\n        <polygon id="Shape" stroke="#000000" stroke-width="1.5" fill="#000000"\n                 points="2.44444444 23.4 2.44444444 19.9333333 19.5555556 19.9333333 19.5555556 23.4"/>\n        <polygon id="Shape" stroke="#000000" stroke-width="1.5" fill="#000000"\n                 points="4.07407407 17.7666667 4.07407407 6.5 17.9259259 6.5 17.9259259 17.7666667"/>\n        <polygon id="Shape" stroke="#000000" stroke-width="1.5" fill="#000000"\n                 points="4.07407407 6.5 1.62962963 4.33333333 20.3703704 4.33333333 17.9259259 6.5"/>\n        <polygon id="Shape" stroke="#000000" stroke-width="1.5" fill="#000000"\n                 points="1.62962963 4.33333333 1.62962963 0 4.88888889 0 4.88888889 1.73333333 8.96296296 1.73333333 8.96296296 0 13.037037 0 13.037037 1.73333333 17.1111111 1.73333333 17.1111111 0 20.3703704 0 20.3703704 4.33333333"/>\n        <polyline id="Shape" stroke="#FFFFFF"\n                  points="2.44444444 22.9666667 19.5555556 22.9666667 19.5555556 22.9666667"/>\n        <line x1="3.25925926" y1="19.5" x2="18.7407407" y2="19.5" id="Shape" stroke="#FFFFFF"/>\n        <line x1="4.07407407" y1="17.7666667" x2="17.9259259" y2="17.7666667" id="Shape" stroke="#FFFFFF"/>\n        <line x1="4.07407407" y1="6.5" x2="17.9259259" y2="6.5" id="Shape" stroke="#FFFFFF"/>\n        <line x1="1.62962963" y1="4.33333333" x2="20.3703704" y2="4.33333333" id="Shape" stroke="#FFFFFF"/>\n    </g>\n    <g id="bp" transform="translate(10.000000, 8.000000)" fill="#000000" stroke="#000000" stroke-linecap="round"\n       stroke-width="1.5">\n        <path d="M10,0 C8.15833333,0 6.66666667,1.50129032 6.66666667,3.35483871 C6.66666667,4.10129032 6.90833333,4.78903226 7.31666667,5.35096774 C5.69166667,6.29032258 4.58333333,8.04322581 4.58333333,10.0645161 C4.58333333,11.7670968 5.36666667,13.2851613 6.59166667,14.2832258 C4.09166667,15.1722581 0.416666667,18.9380645 0.416666667,25.5806452 L19.5833333,25.5806452 C19.5833333,18.9380645 15.9083333,15.1722581 13.4083333,14.2832258 C14.6333333,13.2851613 15.4166667,11.7670968 15.4166667,10.0645161 C15.4166667,8.04322581 14.3083333,6.29032258 12.6833333,5.35096774 C13.0916667,4.78903226 13.3333333,4.10129032 13.3333333,3.35483871 C13.3333333,1.50129032 11.8416667,0 10,0 Z"\n              id="Shape"/>\n    </g>\n</svg>', "cm-chessboard-arrows": '<svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n    <title>arrows</title>\n    <g id="arrows" stroke="none" fill="none" fill-rule="evenodd" stroke-width="1">\n        <g id="cm-chessboard-arrowheads" transform="translate(5, 1)" fill="#000000">\n            <g id="arrowPointy" fill-rule="nonzero">\n                <path d="M13.5896955,18.4060262 L3.04774642,4.12789972 C2.71970374,3.68359527 2.81395252,3.05748421 3.25825697,2.72944153 C3.58591001,2.48752592 4.02754261,2.46849386 4.37479285,2.68132465 L29.6089137,18.1473987 C30.0797924,18.4360018 30.227556,19.0516834 29.9389529,19.5225621 C29.8565135,19.6570685 29.7434202,19.7701618 29.6089137,19.8526013 L4.37479285,35.3186754 C3.90391418,35.6072784 3.28823259,35.4595148 2.99962954,34.9886362 C2.78679874,34.6413859 2.80583081,34.1997533 3.04774642,33.8721003 L13.5896955,19.5939738 C13.850383,19.2408959 13.850383,18.7591041 13.5896955,18.4060262 Z" id="Path"></path>\n            </g>\n            <g id="arrowDefault" transform="translate(3, 0)" fill-rule="nonzero">\n                <path d="M13.6380471,11.3573439 L23.0265544,19.1369941 C23.4518122,19.4893778 23.5108883,20.1197808 23.1585046,20.5450386 C23.1090352,20.6047384 23.0527907,20.6584826 22.9909045,20.705188 L13.6023972,27.7906743 C13.1615654,28.1233691 12.5344983,28.0357067 12.2018035,27.594875 C12.0708444,27.4213498 12,27.2098744 12,26.9924778 L12,12.1273413 C12,11.5750565 12.4477153,11.1273413 13,11.1273413 C13.2329818,11.1273413 13.4586517,11.2086906 13.6380471,11.3573439 Z" id="Path"></path>\n            </g>\n        </g>\n    </g>\n</svg>', "cm-chessboard-markers": '<!--\nLicense: Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)\nhttps://creativecommons.org/licenses/by-sa/3.0/\n\nAuthor: shaack (https://shaack.com)\n-->\n\n<svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg">\n    <title>cm-chessboard markers</title>\n    <desc>Markers for cm-chessboard (https://shaack.com/projekte/cm-chessboard/)</desc>\n    <g id="markerFrame" transform="translate(2.000000, 2.000000)" fill="#000000" fill-opacity="0">\n        <path d="M2.66453526e-15,10.5882353 L2.66453526e-15,2.11764706 C2.66453526e-15,1.41176471 0.176470588,0.882352941 0.529411765,0.529411765 C0.882352941,0.176470588 1.41176471,-2.84217094e-14 2.11764706,-2.84217094e-14 L10.5882353,-2.84217094e-14" id="Path"/>\n        <path d="M25.4117647,36 L25.4117647,27.5294118 C25.4117647,26.8235294 25.5882353,26.2941176 25.9411765,25.9411765 C26.2941176,25.5882353 26.8235294,25.4117647 27.5294118,25.4117647 L36,25.4117647" id="Path" transform="translate(30.705882, 30.705882) rotate(-180.000000) translate(-30.705882, -30.705882) "/>\n        <path d="M0,36 L0,27.5294118 C0,26.8235294 0.176470588,26.2941176 0.529411765,25.9411765 C0.882352941,25.5882353 1.41176471,25.4117647 2.11764706,25.4117647 L10.5882353,25.4117647" id="Path" transform="translate(5.294118, 30.705882) rotate(-90.000000) translate(-5.294118, -30.705882) "/>\n        <path d="M25.4117647,10.5882353 L25.4117647,2.11764706 C25.4117647,1.41176471 25.5882353,0.882352941 25.9411765,0.529411765 C26.2941176,0.176470588 26.8235294,0 27.5294118,0 L36,0" id="Path" transform="translate(30.705882, 5.294118) rotate(-270.000000) translate(-30.705882, -5.294118) "/>\n    </g>\n    <g id="markerCircle" fill="#000000" fill-opacity="0">\n        <circle cx="20" cy="20" r="18"/>\n    </g>\n    <g id="markerCircleFilled">\n        <circle cx="20" cy="20" r="18"/>\n    </g>\n    <g id="markerDot">\n        <circle cx="20" cy="20" r="7"/>\n    </g>\n    <g id="markerBevel">\n        <path d="M-1.77635684e-15,8.8817842e-16 L9,8.8817842e-16 C7.43502116,0.842866191 5.49543951,2.27321471 3.86541703,3.91660579 C2.21006344,5.58553575 0.86967521,7.47275765 -1.77635684e-15,9 L-1.77635684e-15,8.8817842e-16 Z"/>\n        <path d="M30.9995741,0.000425886354 L40.0194705,0.000425886354 C38.4510319,0.843292078 36.5071624,2.2736406 34.8735365,3.91703168 C33.2145234,5.58596164 31.8711719,7.47318354 30.9995741,9.00042589 L30.9995741,0.000425886354 Z" transform="translate(35.509522, 4.500426) rotate(-270.000000) translate(-35.509522, -4.500426) "/>\n        <path d="M30.9995741,31.0004259 L40.0194705,31.0004259 C38.4510319,31.8432921 36.5071624,33.2736406 34.8735365,34.9170317 C33.2145234,36.5859616 31.8711719,38.4731835 30.9995741,40.0004259 L30.9995741,31.0004259 Z" transform="translate(35.509522, 35.500426) rotate(-180.000000) translate(-35.509522, -35.500426) "/>\n        <path d="M-0.000425886354,31.0004259 L9.01947047,31.0004259 C7.45103192,31.8432921 5.50716243,33.2736406 3.87353645,34.9170317 C2.21452335,36.5859616 0.87117192,38.4731835 -0.000425886354,40.0004259 L-0.000425886354,31.0004259 Z" transform="translate(4.509522, 35.500426) rotate(-90.000000) translate(-4.509522, -35.500426) "/>\n    </g>\n    <g id="markerSquare">\n        <rect x="0" y="0" width="40" height="40"/>\n    </g>\n</svg>' };
  function installSprites() {
    for (const [id, svg] of Object.entries(SPRITES)) {
      if (document.getElementById(id)) continue;
      const wrapper = document.createElement("div");
      wrapper.id = id;
      wrapper.setAttribute("aria-hidden", "true");
      wrapper.style.cssText = "position:absolute;transform:scale(0)";
      wrapper.innerHTML = svg;
      document.body.prepend(wrapper);
    }
  }
  window.Chesscalator = { Chessboard, COLOR, INPUT_EVENT_TYPE, FEN, Arrows, ARROW_TYPE, Markers, MARKER_TYPE, Chess, installSprites };
})();
