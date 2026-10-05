import type { HandlerSpec } from "@embabel/realm-types";

/*
 * The public handlers not yet declared in Zod, with the names, descriptions and schemas they had at 86b5bb5, so a caller
 * of the Node realm calls this one the same way. tests/contract.test.ts holds them to that.
 */
export const publicHandlers = {
  explainPlans: {
    "namespace": "chess",
    "description": "The plans for both sides in each position, decided by a model with the chess-plans skill from the position's imbalances, its opening-book name and the engine's candidate moves. The facts are computed; the judgement is the model's.",
    "input": {},
    "output": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "planId": {
            "type": "string"
          },
          "fen": {
            "type": "string"
          },
          "side": {
            "type": "string"
          },
          "priority": {
            "type": "number"
          },
          "name": {
            "type": "string"
          },
          "idea": {
            "type": "string"
          },
          "moves": {
            "type": "string"
          },
          "imbalances": {
            "type": "string"
          },
          "engineEvidence": {
            "type": "string"
          },
          "summary": {
            "type": "string"
          },
          "structure": {
            "type": "string"
          },
          "level": {
            "type": "string"
          },
          "opening": {
            "type": "string"
          },
          "model": {
            "type": "string"
          }
        },
        "required": [
          "planId",
          "fen",
          "side",
          "priority",
          "name",
          "idea",
          "moves",
          "imbalances",
          "engineEvidence",
          "summary",
          "structure",
          "level",
          "opening",
          "model"
        ]
      }
    }
  },
  explainLinePlans: {
    "namespace": "chess",
    "description": "The plans in the position a game line reaches, told the line's deepest opening name — which a position looked up alone has lost once it is past the book.",
    "input": {},
    "output": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "line": {
            "type": "string"
          },
          "planId": {
            "type": "string"
          },
          "fen": {
            "type": "string"
          },
          "side": {
            "type": "string"
          },
          "priority": {
            "type": "number"
          },
          "name": {
            "type": "string"
          },
          "idea": {
            "type": "string"
          },
          "moves": {
            "type": "string"
          },
          "imbalances": {
            "type": "string"
          },
          "engineEvidence": {
            "type": "string"
          },
          "summary": {
            "type": "string"
          },
          "structure": {
            "type": "string"
          },
          "level": {
            "type": "string"
          },
          "opening": {
            "type": "string"
          },
          "model": {
            "type": "string"
          }
        },
        "required": [
          "line",
          "planId",
          "fen",
          "side",
          "priority",
          "name",
          "idea",
          "moves",
          "imbalances",
          "engineEvidence",
          "summary",
          "structure",
          "level",
          "opening",
          "model"
        ]
      }
    }
  },
  mastersAtPosition: {
    "namespace": "chess",
    "description": "What masters played from each position — every move with its game count and results — and the top master games through it. One request per position feeds both: the moves (MASTERS_PLAYED) and the games (MASTER_GAME). Needs the Lichess token.",
    "input": {
      "type": "object",
      "properties": {
        "fens": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "fens"
      ]
    },
    "output": {
      "type": "object",
      "properties": {
        "moves": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "moveId": {
                "type": "string"
              },
              "fen": {
                "type": "string"
              },
              "uci": {
                "type": "string"
              },
              "san": {
                "type": "string"
              },
              "games": {
                "type": "number"
              },
              "white": {
                "type": "number"
              },
              "draws": {
                "type": "number"
              },
              "black": {
                "type": "number"
              },
              "whiteWinPct": {
                "type": "number"
              },
              "drawPct": {
                "type": "number"
              },
              "blackWinPct": {
                "type": "number"
              },
              "scoreForMover": {
                "type": "number"
              },
              "averageRating": {
                "type": "number"
              },
              "player": {
                "type": "string"
              },
              "color": {
                "type": "string"
              }
            },
            "required": [
              "moveId",
              "fen",
              "uci",
              "san",
              "games",
              "white",
              "draws",
              "black",
              "player",
              "color"
            ]
          }
        },
        "games": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "gameId": {
                "type": "string"
              },
              "fen": {
                "type": "string"
              },
              "uci": {
                "type": "string"
              },
              "white": {
                "type": "string"
              },
              "whiteElo": {
                "type": "number"
              },
              "black": {
                "type": "string"
              },
              "blackElo": {
                "type": "number"
              },
              "result": {
                "type": "string"
              },
              "year": {
                "type": "number"
              },
              "month": {
                "type": "string"
              },
              "speed": {
                "type": "string"
              },
              "url": {
                "type": "string"
              },
              "player": {
                "type": "string"
              },
              "color": {
                "type": "string"
              }
            },
            "required": [
              "gameId",
              "fen",
              "uci",
              "white",
              "black",
              "result",
              "month",
              "speed",
              "url",
              "player",
              "color"
            ]
          }
        }
      },
      "required": [
        "moves",
        "games"
      ]
    }
  },
  playerAtPosition: {
    "namespace": "chess",
    "description": "What one Lichess player played from each position, as one colour — every move with its results — and their recent games through it (PLAYER_PLAYED, PLAYER_GAME). Covers the player's whole Lichess history in one request. Needs the Lichess token.",
    "input": {
      "type": "object",
      "properties": {
        "fens": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "filters": {
          "type": "string"
        }
      },
      "required": [
        "fens"
      ]
    },
    "output": {
      "type": "object",
      "properties": {
        "moves": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "moveId": {
                "type": "string"
              },
              "fen": {
                "type": "string"
              },
              "uci": {
                "type": "string"
              },
              "san": {
                "type": "string"
              },
              "games": {
                "type": "number"
              },
              "white": {
                "type": "number"
              },
              "draws": {
                "type": "number"
              },
              "black": {
                "type": "number"
              },
              "whiteWinPct": {
                "type": "number"
              },
              "drawPct": {
                "type": "number"
              },
              "blackWinPct": {
                "type": "number"
              },
              "scoreForMover": {
                "type": "number"
              },
              "averageRating": {
                "type": "number"
              },
              "player": {
                "type": "string"
              },
              "color": {
                "type": "string"
              }
            },
            "required": [
              "moveId",
              "fen",
              "uci",
              "san",
              "games",
              "white",
              "draws",
              "black",
              "player",
              "color"
            ]
          }
        },
        "games": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "gameId": {
                "type": "string"
              },
              "fen": {
                "type": "string"
              },
              "uci": {
                "type": "string"
              },
              "white": {
                "type": "string"
              },
              "whiteElo": {
                "type": "number"
              },
              "black": {
                "type": "string"
              },
              "blackElo": {
                "type": "number"
              },
              "result": {
                "type": "string"
              },
              "year": {
                "type": "number"
              },
              "month": {
                "type": "string"
              },
              "speed": {
                "type": "string"
              },
              "url": {
                "type": "string"
              },
              "player": {
                "type": "string"
              },
              "color": {
                "type": "string"
              }
            },
            "required": [
              "gameId",
              "fen",
              "uci",
              "white",
              "black",
              "result",
              "month",
              "speed",
              "url",
              "player",
              "color"
            ]
          }
        }
      },
      "required": [
        "moves",
        "games"
      ]
    }
  },
  ratedMoves: {
    "namespace": "chess",
    "description": "How often each move is played from a position by rating band and time control on Lichess, and how it scores.",
    "input": {
      "type": "object",
      "properties": {
        "fens": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "filters": {
          "type": "string"
        }
      },
      "required": [
        "fens"
      ]
    },
    "output": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "rowId": {
            "type": "string"
          },
          "fen": {
            "type": "string"
          },
          "band": {
            "type": "string"
          },
          "bandLabel": {
            "type": "string"
          },
          "speed": {
            "type": "string"
          },
          "san": {
            "type": "string"
          },
          "uci": {
            "type": "string"
          },
          "games": {
            "type": "number"
          },
          "share": {
            "type": "number"
          },
          "whiteWinPct": {
            "type": "number"
          },
          "drawPct": {
            "type": "number"
          },
          "blackWinPct": {
            "type": "number"
          },
          "scoreForMover": {
            "type": "number"
          },
          "bandGames": {
            "type": "number"
          }
        },
        "required": [
          "rowId",
          "fen",
          "band",
          "bandLabel",
          "speed",
          "san",
          "uci",
          "games",
          "bandGames"
        ]
      }
    }
  },
} satisfies Record<string, HandlerSpec>;
