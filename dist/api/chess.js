"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/chess.js/dist/cjs/chess.js
var require_chess = __commonJS({
  "node_modules/chess.js/dist/cjs/chess.js"(exports2) {
    "use strict";
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
    var SQUARES = [
      "a8",
      "b8",
      "c8",
      "d8",
      "e8",
      "f8",
      "g8",
      "h8",
      "a7",
      "b7",
      "c7",
      "d7",
      "e7",
      "f7",
      "g7",
      "h7",
      "a6",
      "b6",
      "c6",
      "d6",
      "e6",
      "f6",
      "g6",
      "h6",
      "a5",
      "b5",
      "c5",
      "d5",
      "e5",
      "f5",
      "g5",
      "h5",
      "a4",
      "b4",
      "c4",
      "d4",
      "e4",
      "f4",
      "g4",
      "h4",
      "a3",
      "b3",
      "c3",
      "d3",
      "e3",
      "f3",
      "g3",
      "h3",
      "a2",
      "b2",
      "c2",
      "d2",
      "e2",
      "f2",
      "g2",
      "h2",
      "a1",
      "b1",
      "c1",
      "d1",
      "e1",
      "f1",
      "g1",
      "h1"
    ];
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
    var SIDES2 = {
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
    function rank2(square) {
      return square >> 4;
    }
    function file2(square) {
      return square & 15;
    }
    function isDigit(c) {
      return "0123456789".indexOf(c) !== -1;
    }
    function algebraic(square) {
      const f = file2(square);
      const r = rank2(square);
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
          if (rank2(from) === rank2(ambigFrom)) {
            sameRank++;
          }
          if (file2(from) === file2(ambigFrom)) {
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
      const r = rank2(to);
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
    var Chess6 = class {
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
      _set(sq2, piece) {
        this._hash ^= this._pieceKey(sq2);
        this._board[sq2] = piece;
        this._hash ^= this._pieceKey(sq2);
      }
      _put({ type, color }, square) {
        if (SYMBOLS.indexOf(type.toLowerCase()) === -1) {
          return false;
        }
        if (!(square in Ox88)) {
          return false;
        }
        const sq2 = Ox88[square];
        if (type == KING && !(this._kings[color] == EMPTY || this._kings[color] == sq2)) {
          return false;
        }
        const currentPieceOnSquare = this._board[sq2];
        if (currentPieceOnSquare && currentPieceOnSquare.type === KING) {
          this._kings[currentPieceOnSquare.color] = EMPTY;
        }
        this._set(sq2, { type, color });
        if (type === KING) {
          this._kings[color] = sq2;
        }
        return true;
      }
      _clear(sq2) {
        this._hash ^= this._pieceKey(sq2);
        delete this._board[sq2];
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
        const pieces2 = {
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
            pieces2[piece.type] = piece.type in pieces2 ? pieces2[piece.type] + 1 : 1;
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
          numPieces === 3 && (pieces2[BISHOP] === 1 || pieces2[KNIGHT] === 1)
        ) {
          return true;
        } else if (numPieces === pieces2[BISHOP] + 2) {
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
      _moves({ legal: legal2 = true, piece = void 0, square = void 0 } = {}) {
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
              if (SECOND_RANK[us] === rank2(from) && !this._board[to]) {
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
        if (!legal2 || this._kings[us] === -1) {
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
        let output2 = "";
        if (move.flags & BITS.KSIDE_CASTLE) {
          output2 = "O-O";
        } else if (move.flags & BITS.QSIDE_CASTLE) {
          output2 = "O-O-O";
        } else if (move.flags & BITS.NULL_MOVE) {
          return SAN_NULLMOVE;
        } else {
          if (move.piece !== PAWN) {
            const disambiguator = getDisambiguator(move, moves);
            output2 += move.piece.toUpperCase() + disambiguator;
          }
          if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
            if (move.piece === PAWN) {
              output2 += algebraic(move.from)[0];
            }
            output2 += "x";
          }
          output2 += algebraic(move.to);
          if (move.promotion) {
            output2 += "=" + move.promotion.toUpperCase();
          }
        }
        this._makeMove(move);
        if (this.isCheck()) {
          if (this.isCheckmate()) {
            output2 += "#";
          } else {
            output2 += "+";
          }
        }
        this._undoMove();
        return output2;
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
          if (file2(i) === 0) {
            s += " " + "87654321"[rank2(i)] + " |";
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
        const output2 = [];
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
            output2.push(row);
            row = [];
            i += 8;
          }
        }
        return output2;
      }
      squareColor(square) {
        if (square in Ox88) {
          const sq2 = Ox88[square];
          return (rank2(sq2) + file2(sq2)) % 2 === 0 ? "light" : "dark";
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
              this._castling[color] |= SIDES2[side];
            } else {
              this._castling[color] &= ~SIDES2[side];
            }
          }
        }
        this._updateCastlingRights();
        const result = this.getCastlingRights(color);
        return (rights[KING] === void 0 || rights[KING] === result[KING]) && (rights[QUEEN] === void 0 || rights[QUEEN] === result[QUEEN]);
      }
      getCastlingRights(color) {
        return {
          [KING]: (this._castling[color] & SIDES2[KING]) !== 0,
          [QUEEN]: (this._castling[color] & SIDES2[QUEEN]) !== 0
        };
      }
      moveNumber() {
        return this._moveNumber;
      }
    };
    exports2.BISHOP = BISHOP;
    exports2.BLACK = BLACK;
    exports2.Chess = Chess6;
    exports2.DEFAULT_POSITION = DEFAULT_POSITION;
    exports2.KING = KING;
    exports2.KNIGHT = KNIGHT;
    exports2.Move = Move;
    exports2.PAWN = PAWN;
    exports2.QUEEN = QUEEN;
    exports2.ROOK = ROOK;
    exports2.SEVEN_TAG_ROSTER = SEVEN_TAG_ROSTER;
    exports2.SQUARES = SQUARES;
    exports2.WHITE = WHITE;
    exports2.validateFen = validateFen;
    exports2.xoroshiro128 = xoroshiro128;
  }
});

// src/api/chess.ts
var chess_exports = {};
__export(chess_exports, {
  LEVELS: () => LEVELS,
  analysePosition: () => analysePosition,
  explainLinePlans: () => explainLinePlans,
  explainPlans: () => explainPlans,
  explorerAnswer: () => explorerAnswer,
  mastersAtPosition: () => mastersAtPosition,
  openingLookup: () => openingLookup,
  openingOfGameLine: () => openingOfGameLine,
  playerAtPosition: () => playerAtPosition,
  playerFilter: () => playerFilter,
  positionImbalances: () => positionImbalances,
  theoryOfGameLine: () => theoryOfGameLine
});
module.exports = __toCommonJS(chess_exports);
var import_chess5 = __toESM(require_chess());

// src/lib/engine.ts
var path = __toESM(require("path"));
var engine = null;
var output = [];
var queue = Promise.resolve();
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function start() {
  const savedFetch = globalThis.fetch;
  const restore = () => {
    if (globalThis.fetch !== savedFetch) globalThis.fetch = savedFetch;
  };
  const js = path.join(__dirname, "..", "engine", "stockfish-19-lite-single.js");
  const init = require(js);
  restore();
  const module2 = {
    locateFile: (f) => f.endsWith(".wasm") ? js.replace(/\.js$/, ".wasm") : js,
    listener: (line) => output.push(line)
  };
  return init()(module2).then(async () => {
    while (module2._isReady && !module2._isReady()) await sleep(10);
    restore();
    return module2;
  }, (e) => {
    restore();
    throw e;
  });
}
function send(m, cmd) {
  m.ccall("command", null, ["string"], [cmd], { async: /^go\b/.test(cmd) });
}
async function until(re, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!output.some((l) => re.test(l))) {
    if (Date.now() > deadline) throw new Error(`Stockfish did not answer ${re} within ${timeoutMs} ms`);
    await sleep(5);
  }
}
function search(fen, multiPv, depth) {
  const run = async () => {
    const coldStart = engine === null;
    if (!engine) engine = start();
    const m = await engine;
    output = [];
    send(m, "uci");
    await until(/^uciok/, 5e3);
    send(m, `setoption name MultiPV value ${multiPv}`);
    send(m, "ucinewgame");
    send(m, "isready");
    await until(/^readyok/, 5e3);
    output = [];
    send(m, `position fen ${fen}`);
    send(m, `go depth ${depth}`);
    await until(/^bestmove/, 45e3);
    const last = /* @__PURE__ */ new Map();
    for (const l of output) {
      if (/\b(lowerbound|upperbound)\b/.test(l)) continue;
      const g = l.match(/\bdepth (\d+)\b.*\bmultipv (\d+)\b.*\bscore (cp|mate) (-?\d+)\b.*\bpv (.+)$/);
      if (g) {
        last.set(Number(g[2]), {
          depth: Number(g[1]),
          multipv: Number(g[2]),
          kind: g[3],
          value: Number(g[4]),
          pv: g[5].trim().split(/\s+/)
        });
      }
    }
    return { lines: [...last.values()].sort((a, b) => a.multipv - b.multipv), coldStart };
  };
  const next = queue.then(run, run);
  queue = next.catch(() => void 0);
  return next;
}

// src/lib/imbalances.ts
var import_chess = __toESM(require_chess());
var SIDES = ["white", "black"];
var colourOf = (s) => s === "white" ? "w" : "b";
var other = (s) => s === "white" ? "black" : "white";
var VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
var FILES = "abcdefgh";
var PIECE_NAME = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
var file = (sq2) => FILES.indexOf(sq2[0]);
var rank = (sq2) => Number(sq2[1]);
var sq = (f, r) => `${FILES[f]}${r}`;
var onBoard = (f, r) => f >= 0 && f < 8 && r >= 1 && r <= 8;
var relRank = (s, r) => s === "white" ? r : 9 - r;
var forward = (s) => s === "white" ? 1 : -1;
var isLight = (square) => (file(square) + rank(square)) % 2 === 0;
function pieces(c) {
  const out = [];
  for (const row of c.board()) for (const p of row) if (p) out.push({ type: p.type, color: p.color, square: p.square });
  return out;
}
function pawnsOf(all, s) {
  return all.filter((p) => p.type === "p" && p.color === colourOf(s)).map((p) => p.square);
}
function pawnAttacks(s, square) {
  const f = file(square), r = rank(square) + forward(s);
  return [f - 1, f + 1].filter((x) => onBoard(x, r)).map((x) => sq(x, r));
}
function enemyPawnCanReach(enemyPawns, enemy, square) {
  const f = file(square), r = rank(square);
  return enemyPawns.some((p) => {
    if (Math.abs(file(p) - f) !== 1) return false;
    return enemy === "black" ? rank(p) > r : rank(p) < r;
  });
}
function sideImbalances(c, all, s, openFiles) {
  const me = colourOf(s), them = other(s);
  const mine = all.filter((p) => p.color === me);
  const myPawns = pawnsOf(all, s);
  const theirPawns = pawnsOf(all, them);
  const count = (t) => mine.filter((p) => p.type === t).length;
  const material = {
    pawns: count("p"),
    knights: count("n"),
    bishops: count("b"),
    rooks: count("r"),
    queens: count("q"),
    points: mine.reduce((a, p) => a + VALUE[p.type], 0)
  };
  const bishops = mine.filter((p) => p.type === "b").map((b) => {
    const light = isLight(b.square);
    const onColour = myPawns.filter((p) => isLight(p) === light).length;
    const bad = onColour / myPawns.length >= 0.6;
    const outside = relRank(s, rank(b.square)) >= 4;
    const verdict = myPawns.length < 3 ? "neither" : bad ? outside ? "bad but active" : "bad" : onColour / myPawns.length <= 0.35 ? "good" : "neither";
    return { square: b.square, colour: light ? "light" : "dark", ownPawnsOnColour: onColour, verdict };
  });
  const filesWith = (f, pawns) => pawns.filter((p) => file(p) === f);
  const doubled = [...new Set(myPawns.map(file))].filter((f) => filesWith(f, myPawns).length > 1).map((f) => FILES[f]);
  const isolated = myPawns.filter((p) => filesWith(file(p) - 1, myPawns).length === 0 && filesWith(file(p) + 1, myPawns).length === 0);
  const passed = myPawns.filter((p) => !theirPawns.some((t) => Math.abs(file(t) - file(p)) <= 1 && (s === "white" ? rank(t) > rank(p) : rank(t) < rank(p))));
  const protectedPassed = passed.filter((p) => myPawns.some((q) => pawnAttacks(s, q).includes(p)));
  const backward = myPawns.filter((p) => {
    if (isolated.includes(p) || passed.includes(p)) return false;
    const behindOrLevel = myPawns.some((q) => Math.abs(file(q) - file(p)) === 1 && relRank(s, rank(q)) <= relRank(s, rank(p)));
    if (behindOrLevel) return false;
    const stop = rank(p) + forward(s);
    if (!onBoard(file(p), stop)) return false;
    return theirPawns.some((t) => pawnAttacks(them, t).includes(sq(file(p), stop)));
  });
  const hanging = [];
  for (const p of myPawns) for (const q of myPawns) {
    if (file(q) !== file(p) + 1 || rank(q) !== rank(p)) continue;
    if (file(p) < 2 || file(q) > 4 || relRank(s, rank(p)) < 3) continue;
    const left = filesWith(file(p) - 1, myPawns).length, right = filesWith(file(q) + 1, myPawns).length;
    if (left === 0 && right === 0 && filesWith(file(p), myPawns).length === 1 && filesWith(file(q), myPawns).length === 1) hanging.push(p, q);
  }
  const occupiedFiles = [...new Set(myPawns.map(file))].sort((a, b) => a - b);
  let islands = 0;
  occupiedFiles.forEach((f, i) => {
    if (i === 0 || f !== occupiedFiles[i - 1] + 1) islands++;
  });
  const isolatedQueenPawn = isolated.some((p) => p[0] === "d");
  const majority = {
    queenside: myPawns.filter((p) => file(p) <= 3).length,
    kingside: myPawns.filter((p) => file(p) >= 4).length
  };
  const controlled = /* @__PURE__ */ new Set();
  for (const p of myPawns) for (const a of pawnAttacks(s, p)) if (relRank(s, rank(a)) >= 5) controlled.add(a);
  const space = controlled.size + myPawns.filter((p) => relRank(s, rank(p)) >= 5).length;
  const outposts = [];
  for (let f = 1; f <= 6; f++) for (let rr = 4; rr <= 6; rr++) {
    const r = s === "white" ? rr : 9 - rr;
    const square = sq(f, r);
    const occupant = c.get(square);
    if (occupant?.type === "p") continue;
    const guarded = myPawns.some((p) => pawnAttacks(s, p).includes(square));
    if (!guarded || enemyPawnCanReach(theirPawns, them, square)) continue;
    outposts.push({ square, occupiedBy: occupant && occupant.color === me ? `${PIECE_NAME[occupant.type]}` : null });
  }
  outposts.sort((a, b) => Math.abs(3.5 - file(a.square)) - Math.abs(3.5 - file(b.square)));
  const halfOpenFiles = [...FILES].filter((f, i) => filesWith(i, myPawns).length === 0 && filesWith(i, theirPawns).length > 0);
  const rooksOnOpenFiles = mine.filter((p) => (p.type === "r" || p.type === "q") && openFiles.includes(p.square[0])).map((p) => `${PIECE_NAME[p.type]} ${p.square}`);
  const home = s === "white" ? { n: ["b1", "g1"], b: ["c1", "f1"] } : { n: ["b8", "g8"], b: ["c8", "f8"] };
  const undeveloped = [
    ...home.n.filter((h) => c.get(h)?.type === "n" && c.get(h)?.color === me).map((h) => `N${h}`),
    ...home.b.filter((h) => c.get(h)?.type === "b" && c.get(h)?.color === me).map((h) => `B${h}`)
  ];
  const kingSq = mine.find((p) => p.type === "k").square;
  const backRank = s === "white" ? 1 : 8;
  const rights = c.getCastlingRights(me);
  const castled = rank(kingSq) === backRank && !rights.k && !rights.q ? file(kingSq) >= 6 ? "kingside" : file(kingSq) <= 2 ? "queenside" : null : null;
  const kingInCentre = file(kingSq) >= 3 && file(kingSq) <= 4;
  const kingWing = file(kingSq) <= 2 ? "queenside" : file(kingSq) >= 5 ? "kingside" : "centre";
  const shield = myPawns.filter((p) => Math.abs(file(p) - file(kingSq)) <= 1 && relRank(s, rank(p)) > relRank(s, rank(kingSq)) && relRank(s, rank(p)) <= relRank(s, rank(kingSq)) + 2).length;
  const openFilesNear = [file(kingSq) - 1, file(kingSq), file(kingSq) + 1].filter((f) => f >= 0 && f < 8).map((f) => FILES[f]).filter((f) => openFiles.includes(f) || !myPawns.some((p) => p[0] === f));
  const zone = /* @__PURE__ */ new Set();
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    const f = file(kingSq) + df, r = rank(kingSq) + dr;
    if (onBoard(f, r)) zone.add(sq(f, r));
  }
  const attackers = /* @__PURE__ */ new Set();
  for (const z of zone) for (const a of c.attackers(z, colourOf(them))) {
    if (c.get(a)?.type !== "p") attackers.add(a);
  }
  return {
    material,
    bishopPair: material.bishops >= 2 && new Set(bishops.map((b) => b.colour)).size === 2,
    bishops,
    pawns: { islands, doubled, isolated, backward, passed, protectedPassed, hanging: [...new Set(hanging)], isolatedQueenPawn },
    majority,
    space,
    outposts: outposts.slice(0, 4),
    halfOpenFiles,
    rooksOnOpenFiles,
    development: { undeveloped, castled, kingInCentre },
    king: { square: kingSq, wing: kingWing, shield, openFilesNear, attackersNear: attackers.size },
    mobility: mobilityOf(c, me)
  };
}
function mobilityOf(c, colour) {
  if (c.turn() === colour) return c.moves().length;
  const parts = c.fen().split(" ");
  parts[1] = colour;
  parts[3] = "-";
  try {
    const flipped = new import_chess.Chess(parts.join(" "));
    return flipped.moves().length;
  } catch {
    return null;
  }
}
function chainsOf(all) {
  const out = [];
  for (const s of SIDES) {
    const mine = pawnsOf(all, s), theirs = pawnsOf(all, other(s));
    const locked = (p) => theirs.includes(sq(file(p), rank(p) + forward(s)));
    for (const head of mine) {
      if (!locked(head) || file(head) < 2 || file(head) > 5) continue;
      for (const base of mine) {
        if (!locked(base)) continue;
        if (Math.abs(file(base) - file(head)) !== 1 || relRank(s, rank(base)) !== relRank(s, rank(head)) - 1) continue;
        if (file(base) < 2 || file(base) > 5) continue;
        if (!(file(head) === 3 || file(head) === 4 || file(base) === 3 || file(base) === 4)) continue;
        out.push({ side: s, pawns: [head, base], pointsTo: file(head) < file(base) ? "queenside" : "kingside" });
      }
    }
  }
  return out;
}
function exchangeOn(c, square) {
  const caps = c.moves({ verbose: true }).filter((m2) => m2.to === square && m2.captured).sort((a, b) => VALUE[a.piece] - VALUE[b.piece]);
  if (caps.length === 0) return 0;
  const m = caps[0];
  c.move(m);
  const value = Math.max(0, VALUE[m.captured] - exchangeOn(c, square));
  c.undo();
  return value;
}
function recapture(fen) {
  const c = new import_chess.Chess(fen);
  let best = { gain: 0, square: null, san: null };
  for (const m of c.moves({ verbose: true }).filter((x) => x.captured)) {
    c.move(m);
    const gain = VALUE[m.captured] - exchangeOn(c, m.to);
    c.undo();
    if (gain > best.gain) best = { gain, square: m.to, san: m.san };
  }
  return best;
}
function mateInOne(fen, threat) {
  let c = new import_chess.Chess(fen);
  if (threat) {
    if (c.inCheck()) return [];
    const parts = fen.split(" ");
    parts[1] = parts[1] === "w" ? "b" : "w";
    parts[3] = "-";
    try {
      c = new import_chess.Chess(parts.join(" "));
    } catch {
      return [];
    }
  }
  return c.moves({ verbose: true }).filter((m) => m.san.endsWith("#")).map((m) => m.san);
}
function exposedPieces(c, colour) {
  const out = [];
  const enemy = colour === "w" ? "b" : "w";
  for (const row of c.board()) for (const p of row) {
    if (!p || p.color !== colour || p.type === "k") continue;
    const attackers = c.attackers(p.square, enemy);
    if (attackers.length === 0) continue;
    const defenders = c.attackers(p.square, colour);
    const cheapest = Math.min(...attackers.map((a) => VALUE[c.get(a).type] || 100));
    if (defenders.length === 0) out.push(`${PIECE_NAME[p.type]} on ${p.square} is attacked and not defended`);
    else if (p.type !== "p" && cheapest < VALUE[p.type]) {
      const by = attackers.map((a) => c.get(a)).sort((x, y) => VALUE[x.type] - VALUE[y.type])[0];
      out.push(`${PIECE_NAME[p.type]} on ${p.square} is attacked by a ${PIECE_NAME[by.type]}`);
    }
  }
  return out;
}
function imbalancesOf(fen) {
  const c = new import_chess.Chess(fen);
  const all = pieces(c);
  const openFiles = [...FILES].filter((f) => !all.some((p) => p.type === "p" && p.square[0] === f));
  const white = sideImbalances(c, all, "white", openFiles);
  const black = sideImbalances(c, all, "black", openFiles);
  const chains = chainsOf(all);
  const nonPawn = (s) => s.material.points - s.material.pawns;
  const fullmove = Number(fen.split(" ")[5] ?? "1");
  const phase = white.material.queens + black.material.queens === 0 && nonPawn(white) <= 13 && nonPawn(black) <= 13 || nonPawn(white) + nonPawn(black) <= 20 ? "endgame" : fullmove <= 12 && white.development.undeveloped.length + black.development.undeveloped.length >= 2 ? "opening" : "middlegame";
  const oppositeSideCastling = white.king.wing !== "centre" && black.king.wing !== "centre" && white.king.wing !== black.king.wing;
  const wb = white.bishops, bb = black.bishops;
  const oppositeColouredBishops = wb.length === 1 && bb.length === 1 && wb[0].colour !== bb[0].colour && white.material.knights + black.material.knights === 0;
  const result = {
    fen,
    sideToMove: c.turn() === "w" ? "white" : "black",
    phase,
    white,
    black,
    openFiles,
    chains,
    oppositeSideCastling,
    oppositeColouredBishops,
    facts: []
  };
  result.facts = factsOf(result);
  return result;
}
var Cap = (s) => s === "white" ? "White" : "Black";
var list = (xs) => xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
function materialFact(w, b) {
  const diff = w.material.points - b.material.points;
  const minors = (s) => s.material.knights + s.material.bishops;
  const dR = w.material.rooks - b.material.rooks, dM = minors(w) - minors(b), dQ = w.material.queens - b.material.queens;
  const dP = w.material.pawns - b.material.pawns;
  const parts = [];
  if (dQ !== 0 && dR !== 0 && Math.sign(dQ) !== Math.sign(dR)) parts.push(`${dQ > 0 ? "White" : "Black"} has a queen against ${Math.abs(dR) === 2 ? "two rooks" : "a rook and more"}`);
  else if (dR !== 0 && dM !== 0 && Math.sign(dR) !== Math.sign(dM)) {
    const up = dR > 0 ? "White" : "Black";
    parts.push(Math.abs(dR) === 1 && Math.abs(dM) === 1 ? `${up} is up the exchange (a rook for a minor piece)` : `${up} has rooks against minor pieces`);
  } else if (dM !== 0 && dP !== 0 && Math.sign(dM) !== Math.sign(dP)) {
    parts.push(`${dM > 0 ? "White" : "Black"} has a minor piece for ${Math.abs(dP)} pawn${Math.abs(dP) > 1 ? "s" : ""}`);
  }
  if (parts.length === 0) {
    if (diff === 0) return "the sides are level.";
    return `${diff > 0 ? "White" : "Black"} is ${Math.abs(diff) === 1 ? "a pawn" : `${Math.abs(diff)} points`} up${Math.abs(diff) === 1 ? "" : " (pawn 1, minor piece 3, rook 5, queen 9)"}.`;
  }
  return `${parts.join("; ")} \u2014 ${diff === 0 ? "level by points" : `${diff > 0 ? "White" : "Black"} ${Math.abs(diff)} up by points`}.`;
}
function factsOf(x) {
  const out = [`Phase: ${x.phase}. ${Cap(x.sideToMove)} to move.`];
  const add = (category, sentence) => out.push(`${category}: ${sentence}`);
  const mover = x.sideToMove, other_ = mover === "white" ? "black" : "white";
  const c = new import_chess.Chess(x.fen);
  if (c.inCheck()) add("Tactics", `${Cap(mover)} is in check.`);
  const mates = mateInOne(x.fen, false);
  if (mates.length) add("Tactics", `${Cap(mover)} can mate at once with ${list(mates.slice(0, 3))}.`);
  const threats = mateInOne(x.fen, true);
  if (threats.length) add("Tactics", `${Cap(other_)} threatens mate with ${list(threats.slice(0, 3))}.`);
  for (const s of SIDES) {
    for (const e of exposedPieces(c, colourOf(s))) add("Tactics", `${Cap(s)}'s ${e}.`);
  }
  const moverStatic = x[mover].material.points - x[other_].material.points;
  const r = moverStatic < 0 ? recapture(x.fen) : { gain: 0, square: null, san: null };
  if (r.gain > 0) {
    const after = moverStatic + r.gain;
    const who = after === 0 ? "the sides are level" : after < 0 ? `${Cap(other_)} is ${after === -1 ? "a pawn" : `${-after} points`} up` : `${Cap(mover)} is ${after === 1 ? "a pawn" : `${after} points`} up`;
    add("Material", `${who} once ${Cap(mover)} recaptures on ${r.square} \u2014 an exchange is under way.`);
  } else {
    add("Material", materialFact(x.white, x.black));
  }
  const w = x.white, b = x.black;
  if (w.bishopPair !== b.bishopPair) add("Minor pieces", `${w.bishopPair ? "White" : "Black"} has the bishop pair.`);
  if (x.oppositeColouredBishops) add("Minor pieces", "Bishops of opposite colours: drawish in an endgame, but the attacker is effectively a piece up in a middlegame.");
  const minorLine = (s) => `${s.material.bishops} bishop${s.material.bishops === 1 ? "" : "s"} and ${s.material.knights} knight${s.material.knights === 1 ? "" : "s"}`;
  if (w.material.bishops !== b.material.bishops) add("Minor pieces", `White has ${minorLine(w)}, Black ${minorLine(b)}.`);
  for (const s of SIDES) {
    const me = x[s];
    for (const bi of me.bishops) if (bi.verdict !== "neither") {
      add("Minor pieces", `${Cap(s)}'s ${bi.colour}-squared bishop on ${bi.square} is ${bi.verdict}: ${bi.ownPawnsOnColour} of ${me.material.pawns} ${s} pawns stand on its colour.`);
    }
    if (me.material.pawns <= 1) {
      if (me.pawns.passed.length) add("Pawn structure", `${Cap(s)} has a passed pawn on ${list(me.pawns.passed)}.`);
      continue;
    }
    if (me.pawns.isolatedQueenPawn) add("Pawn structure", `${Cap(s)} has an isolated queen's pawn (${me.pawns.isolated.find((p) => p[0] === "d")}).`);
    const otherIsolated = me.pawns.isolated.filter((p) => p[0] !== "d");
    if (otherIsolated.length) add("Pawn structure", `${Cap(s)} has isolated pawn${otherIsolated.length > 1 ? "s" : ""} on ${list(otherIsolated)}.`);
    if (me.pawns.doubled.length) add("Pawn structure", `${Cap(s)} has doubled pawns on the ${list(me.pawns.doubled)}-file${me.pawns.doubled.length > 1 ? "s" : ""}.`);
    if (me.pawns.backward.length) add("Pawn structure", `${Cap(s)} has a backward pawn on ${list(me.pawns.backward)}.`);
    if (me.pawns.hanging.length) add("Pawn structure", `${Cap(s)} has hanging pawns on ${list(me.pawns.hanging)}.`);
    if (me.pawns.passed.length) {
      const prot = me.pawns.protectedPassed;
      add("Pawn structure", `${Cap(s)} has a passed pawn on ${list(me.pawns.passed)}${prot.length ? ` (${list(prot)} protected)` : ""}.`);
    }
  }
  if (w.pawns.islands !== b.pawns.islands && w.material.pawns > 1 && b.material.pawns > 1) add("Pawn structure", `pawn islands, White ${w.pawns.islands}, Black ${b.pawns.islands}.`);
  for (const wing of ["queenside", "kingside"]) {
    const wc = w.majority[wing], bc = b.majority[wing];
    if (wc !== bc && wc + bc > 0) add("Pawn structure", `${wc > bc ? "White" : "Black"} has a ${wing} pawn majority (${Math.max(wc, bc)} against ${Math.min(wc, bc)}, counting the ${wing === "queenside" ? "a-d" : "e-h"} files).`);
  }
  for (const ch of x.chains) add("Pawn structure", `${Cap(ch.side)}'s pawn chain ${ch.pawns.join("/")} is locked and points to the ${ch.pointsTo}.`);
  if (Math.abs(w.space - b.space) >= 3) add("Space", `${w.space > b.space ? "White" : "Black"} has more space (${Math.max(w.space, b.space)} against ${Math.min(w.space, b.space)} by pawn control of the opponent's half).`);
  if (x.openFiles.length) add("Files", `the ${list(x.openFiles)}-file${x.openFiles.length > 1 ? "s are" : " is"} open.`);
  for (const s of SIDES) {
    const me = x[s];
    if (me.halfOpenFiles.length) add("Files", `the ${list(me.halfOpenFiles)}-file${me.halfOpenFiles.length > 1 ? "s are" : " is"} half-open for ${Cap(s)}.`);
    if (me.rooksOnOpenFiles.length) add("Files", `${Cap(s)} holds an open file with the ${list(me.rooksOnOpenFiles)}.`);
    const occ = me.outposts.filter((o) => o.occupiedBy);
    const free = me.outposts.filter((o) => !o.occupiedBy).map((o) => o.square);
    if (occ.length) add("Key squares", `${Cap(s)}'s ${list(occ.map((o) => `${o.occupiedBy} on ${o.square}`))} stands on an outpost no pawn can challenge.`);
    if (free.length) add("Key squares", `${Cap(s)} has outpost square${free.length > 1 ? "s" : ""} on ${list(free)} (guarded by a pawn, beyond the reach of enemy pawns).`);
  }
  if (x.phase !== "endgame") {
    for (const s of SIDES) {
      const d = x[s].development;
      if (x.phase === "opening" && d.undeveloped.length) add("Development", `${Cap(s)} still has ${list(d.undeveloped)} undeveloped.`);
      if (!d.castled && d.kingInCentre) add("King safety", `${Cap(s)}'s king is still in the centre, on ${x[s].king.square}.`);
    }
    if (x.oppositeSideCastling) add("King safety", `The kings are on opposite wings (White ${w.king.wing}, Black ${b.king.wing}): pawn storms cost the attacker nothing in king safety.`);
    for (const s of SIDES) {
      const k = x[s].king;
      if (k.wing !== "centre" && (k.shield <= 1 || k.openFilesNear.length >= 2 || k.attackersNear >= 3)) {
        add("King safety", `${Cap(s)}'s king on ${k.square} is exposed: ${k.shield} shield pawn${k.shield === 1 ? "" : "s"}, ${k.openFilesNear.length ? `open or half-open ${list(k.openFilesNear)}-file nearby, ` : ""}${k.attackersNear} enemy piece${k.attackersNear === 1 ? "" : "s"} bearing on it.`);
      }
    }
  } else {
    for (const s of SIDES) add("King position", `${Cap(s)}'s king is on ${x[s].king.square}.`);
  }
  if (w.mobility !== null && b.mobility !== null && Math.abs(w.mobility - b.mobility) >= 8) {
    add("Piece activity", `${w.mobility > b.mobility ? "White" : "Black"} has the freer pieces: ${Math.max(w.mobility, b.mobility)} legal moves against ${Math.min(w.mobility, b.mobility)}.`);
  }
  return out;
}
var VOLATILE = [/^Phase:/, /^Piece activity:/, /^Development:/, /^King position:/];
function factKey(fact) {
  return fact.replace(/(bishop) on [a-h][1-8]/, "$1").replace(/(open file with the) (rook|queen) ([a-h])[1-8]/g, "$1 $3-file").replace(/ \([^)]*\)/g, "").replace(/: \d+ of \d+ .*$/, "").replace(/(king on [a-h][1-8] is exposed).*$/, "$1");
}
function imbalanceChanges(before, after) {
  const keyed = (xs) => new Map(xs.filter((f) => !VOLATILE.some((v) => v.test(f))).map((f) => [factKey(f), f]));
  const b = keyed(before.facts), a = keyed(after.facts);
  return {
    gained: [...a].filter(([k]) => !b.has(k)).map(([, f]) => f),
    lost: [...b].filter(([k]) => !a.has(k)).map(([, f]) => f)
  };
}

// src/lib/lines.ts
var import_chess2 = __toESM(require_chess());
var LINE_PLIES = 10;
function uciToMove(c, uci) {
  try {
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : void 0 });
  } catch {
    return null;
  }
}
function readLine(fen, pv, before = imbalancesOf(fen)) {
  const board = new import_chess2.Chess(fen);
  const moves = [];
  const fens = [];
  for (const u of pv) {
    const m = uciToMove(board, u);
    if (!m) break;
    moves.push(m);
    fens.push(board.fen());
  }
  let settle = Math.min(LINE_PLIES, moves.length);
  while (settle < moves.length && moves[settle].captured) settle++;
  const settledFen = settle === 0 ? fen : fens[settle - 1];
  const { gained, lost } = imbalanceChanges(before, imbalancesOf(settledFen));
  return { pvSan: moves.map((m) => m.san), settledFen, settledPlies: settle, gained, lost };
}

// src/lib/openings.ts
var import_chess3 = __toESM(require_chess());
var import_node_fs = require("node:fs");
var path2 = __toESM(require("node:path"));
function positionKey(fen) {
  const c = new import_chess3.Chess(fen);
  const [board, turn, castling, ep] = c.fen().split(" ");
  const epLegal = ep !== "-" && c.moves({ verbose: true }).some((m) => m.flags.includes("e"));
  return `${board} ${turn} ${castling} ${epLegal ? ep : "-"}`;
}
var book = null;
function readData(file2) {
  for (const dir of [path2.join(__dirname, "..", "data"), path2.join(__dirname, "..", "..", "dist", "data")]) {
    try {
      return JSON.parse((0, import_node_fs.readFileSync)(path2.join(dir, file2), "utf8"));
    } catch {
    }
  }
  throw new Error(`${file2} not found: run npm run build`);
}
function load() {
  if (!book) book = readData("openings.json");
  return book;
}
function openingOf(fen) {
  return load()[positionKey(fen)] ?? null;
}
function openingOfLine(moves) {
  const c = new import_chess3.Chess();
  let best = null;
  let ply = 0;
  for (const m of moves) {
    try {
      c.move(m);
    } catch {
      break;
    }
    ply++;
    const hit = load()[positionKey(c.fen())];
    if (hit) best = { ...hit, fen: c.fen(), namedAtPly: ply, pliesPast: 0 };
  }
  if (best) best.pliesPast = ply - best.namedAtPly;
  return best;
}
function positionAfter(moves) {
  const c = new import_chess3.Chess();
  moves.forEach((m, i) => {
    try {
      c.move(m);
    } catch {
      throw new Error(`Move ${i + 1} (${m}) is not legal in that line`);
    }
  });
  return c.fen();
}
var splitLine = (line) => line.trim().split(/\s+/).filter(Boolean);
var skeletons = null;
var MAX_FAMILIES = 2;
function pawnSet(fen) {
  const c = new import_chess3.Chess(fen);
  const out = /* @__PURE__ */ new Set();
  for (const row of c.board()) for (const p of row) if (p && p.type === "p") out.add(p.color + p.square);
  return out;
}
function structureOf(fen, maxDifferent = 2) {
  if (!skeletons) skeletons = readData("skeletons.json");
  const mine = pawnSet(fen);
  const exact = skeletons[[...mine].sort().join(" ")];
  if (exact) return exact.families <= MAX_FAMILIES ? { openings: exact.openings, pawnsDifferent: 0 } : null;
  let best = null;
  for (const [key, { families, openings }] of Object.entries(skeletons)) {
    if (families > MAX_FAMILIES) continue;
    const theirs = new Set(key.split(" "));
    let diff = 0;
    for (const p of mine) if (!theirs.has(p)) diff++;
    for (const p of theirs) if (!mine.has(p)) diff++;
    const moved = Math.ceil(diff / 2);
    if (moved <= maxDifferent && (!best || moved < best.pawnsDifferent)) best = { openings, pawnsDifferent: moved };
  }
  return best;
}
function structureSentence(m) {
  if (!m) return null;
  const names = m.openings.slice(0, 3).map((o) => `${o.name} (${o.eco})`).join("; ");
  return m.pawnsDifferent === 0 ? `The pawn structure is the one reached in: ${names}.` : `The pawn structure is close to the one reached in: ${names} \u2014 ${m.pawnsDifferent} pawn${m.pawnsDifferent > 1 ? "s" : ""} different.`;
}

// src/lib/theory.ts
var import_chess4 = __toESM(require_chess());
var ROOT = "Chess Opening Theory";
function theoryTitles(moves) {
  const c = new import_chess4.Chess();
  const parts = [];
  const titles = [];
  for (const m of moves) {
    const n = c.moveNumber();
    const white = c.turn() === "w";
    let san;
    try {
      san = c.move(m).san;
    } catch {
      break;
    }
    parts.push(white ? `${n}. ${san}` : `${n}...${san}`);
    titles.push(`${ROOT}/${parts.join("/")}`);
  }
  return titles;
}
var pageUrl = (title) => `https://en.wikibooks.org/wiki/${encodeURIComponent(title.replace(/ /g, "_")).replace(/%2F/g, "/")}`;
function theoryText(extract, maxChars = 3e3) {
  const cut = extract.search(/\n==\s*(Theory table|References|See also|Statistics)\s*==/i);
  const body = (cut >= 0 ? extract.slice(0, cut) : extract).replace(/\n{3,}/g, "\n\n").trim();
  if (body.length <= maxChars) return body;
  const clipped = body.slice(0, maxChars);
  return clipped.slice(0, Math.max(clipped.lastIndexOf("\n"), clipped.lastIndexOf(". ") + 1)).trim() + " \u2026";
}

// src/api/chess.ts
var ENGINE = "Stockfish 19 lite (single-threaded WebAssembly)";
function legal(fen) {
  try {
    return new import_chess5.Chess(fen.trim());
  } catch (e) {
    throw new Error(`Not a legal position: ${fen} (${e.message})`);
  }
}
function candidateRecords(fen, lines, before, elapsedMs) {
  const whiteToMove = before.sideToMove === "white";
  const best = lines[0];
  return lines.map((l) => {
    const scoreCp = l.kind === "cp" ? l.value : null;
    const mate = l.kind === "mate" ? l.value : null;
    const r = readLine(fen, l.pv, before);
    return {
      candidateId: `${fen} ${l.pv[0]}`,
      fen,
      rank: l.multipv,
      uci: l.pv[0],
      san: r.pvSan[0] ?? l.pv[0],
      side: before.sideToMove,
      scoreCp,
      mate,
      whiteCp: scoreCp === null ? null : whiteToMove ? scoreCp : -scoreCp,
      lossCp: best.kind === "cp" && scoreCp !== null ? best.value - scoreCp : best.kind === "mate" && l.kind === "mate" && Math.sign(best.value) === Math.sign(l.value) ? 0 : null,
      depth: l.depth,
      pvSan: r.pvSan.join(" "),
      pvUci: l.pv.join(" "),
      creates: r.gained.join("\n"),
      removes: r.lost.join("\n"),
      engine: ENGINE,
      elapsedMs
    };
  });
}
async function linesFor(fen, multiPv, depth) {
  const t = Date.now();
  const { lines } = await search(fen, multiPv, depth);
  return { lines, elapsedMs: Date.now() - t };
}
var clamp = (v, dflt, lo, hi) => Math.min(Math.max(Math.trunc(v ?? dflt), lo), hi);
async function analysePosition(_ctx, args) {
  const multiPv = clamp(args.multiPv, 5, 1, 8);
  const depth = clamp(args.depth, 18, 6, 22);
  const out = [];
  for (const raw of args.fens ?? []) {
    const fen = raw.trim();
    if (legal(fen).moves().length === 0) continue;
    const { lines, elapsedMs } = await linesFor(fen, multiPv, depth);
    out.push(...candidateRecords(fen, lines, imbalancesOf(fen), elapsedMs));
  }
  return out;
}
async function positionImbalances(_ctx, args) {
  return (args.fens ?? []).map((raw) => {
    const fen = raw.trim();
    legal(fen);
    const x = imbalancesOf(fen);
    return {
      fen,
      sideToMove: x.sideToMove,
      phase: x.phase,
      facts: x.facts.join("\n"),
      structure: structureSentence(structureOf(fen)) ?? "",
      materialWhite: x.white.material.points,
      materialBlack: x.black.material.points,
      bishopPairWhite: x.white.bishopPair,
      bishopPairBlack: x.black.bishopPair,
      isolatedQueenPawnWhite: x.white.pawns.isolatedQueenPawn,
      isolatedQueenPawnBlack: x.black.pawns.isolatedQueenPawn,
      passedWhite: x.white.pawns.passed.join(" "),
      passedBlack: x.black.pawns.passed.join(" "),
      openFiles: x.openFiles.join(" "),
      oppositeSideCastling: x.oppositeSideCastling,
      oppositeColouredBishops: x.oppositeColouredBishops,
      detail: JSON.stringify(x)
    };
  });
}
async function theoryFor(ctx, moves) {
  const wb = ctx.wikibooks;
  const titles = theoryTitles(moves);
  if (titles.length === 0) return null;
  const candidates = titles.slice(-50);
  const info = await wb.wikibooksQuery({ action: "query", format: "json", prop: "info", titles: candidates.join("|") });
  const present = new Set(Object.values(info.query?.pages ?? {}).filter((p) => p.missing === void 0).map((p) => p.title));
  const deepest = [...candidates].reverse().find((t) => present.has(t));
  if (!deepest) return null;
  const page = await wb.wikibooksQuery({ action: "query", format: "json", prop: "extracts", explaintext: "1", redirects: "1", titles: deepest });
  const extract = Object.values(page.query?.pages ?? {})[0]?.extract ?? "";
  const text = theoryText(extract);
  if (!text) return null;
  const covered = titles.indexOf(deepest) + 1;
  return {
    line: moves.join(" "),
    title: deepest,
    url: pageUrl(deepest),
    pliesCovered: covered,
    pliesPast: moves.length - covered,
    theory: text,
    licence: "Excerpt from the Chess Opening Theory wikibook, by Wikibooks contributors, CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/); references and tables omitted."
  };
}
async function theoryOfGameLine(ctx, args) {
  const out = [];
  for (const raw of args.lines ?? []) {
    const moves = splitLine(raw);
    positionAfter(moves);
    const t = await theoryFor(ctx, moves);
    if (t) out.push(t);
  }
  return out;
}
async function openingOfGameLine(_ctx, args) {
  const out = [];
  for (const raw of args.lines ?? []) {
    const line = splitLine(raw).join(" ");
    positionAfter(splitLine(line));
    const hit = openingOfLine(splitLine(line));
    if (hit) out.push({ line, fen: hit.fen, eco: hit.eco, name: hit.name, pgn: hit.pgn, namedAtPly: hit.namedAtPly, pliesPast: hit.pliesPast });
  }
  return out;
}
async function openingLookup(_ctx, args) {
  const out = [];
  for (const raw of args.fens ?? []) {
    const fen = raw.trim();
    legal(fen);
    const hit = openingOf(fen);
    if (hit) out.push({ fen, ...hit });
  }
  return out;
}
function promptFor(fen, x, opening, structure, candidates, withinCp, theory = null, level = "intermediate") {
  const lines = candidates.filter((c) => c.rank === 1 || c.lossCp !== null && c.lossCp <= withinCp).map((c) => {
    const score = c.mate !== null ? `mate in ${Math.abs(c.mate)}${c.mate < 0 ? " against the side to move" : ""}` : `${(c.whiteCp / 100).toFixed(2)} from White's side`;
    const loss = c.rank === 1 ? "the engine's best" : c.lossCp === null ? "not comparable with the mate" : `${c.lossCp} centipawns worse than best`;
    return [
      `- ${c.san} (${score}; ${loss}; depth ${c.depth})`,
      `  line: ${c.pvSan.split(" ").slice(0, 12).join(" ")}`,
      c.creates ? `  creates: ${c.creates.split("\n").join(" | ")}` : "",
      c.removes ? `  removes: ${c.removes.split("\n").join(" | ")}` : ""
    ].filter(Boolean).join("\n");
  }).join("\n");
  return `Use the chess-plans skill. Read it before answering.

Position (FEN): ${fen}
${x.sideToMove === "white" ? "White" : "Black"} to move.
Opening: ${opening ?? "not a named book position"}
Pawn structure: ${structure ?? "matches no book line's pawns within two pawns"}
${theory ? `
Opening theory \u2014 "${theory.title}" in the Chess Opening Theory wikibook${theory.pliesPast ? `, ${theory.pliesPast} ${theory.pliesPast === 1 ? "ply" : "plies"} before this position` : ", for this position"}:
"""
${theory.theory}
"""
` : ""}
Imbalances (computed from the board, numbered):
${citable(x).map((f, i) => `[${i + 1}] ${f}`).join("\n")}

The engine's candidate moves for the side to move (Stockfish, within ${withinCp} centipawns of best):
${lines}

First decide which row of the skill's structure table (section 4) this position is, from the
pawn structure and imbalances above \u2014 or "none" \u2014 and let that row's plans lead unless the
engine's moves show they do not work here.
${LEVEL_BRIEF[level]} (Section 8 of the skill says more.)
Name the plans for BOTH sides \u2014 up to ${MAX_PLANS[level]} each, most important first \u2014 as the skill describes.
Ground every plan in the numbered imbalances and, for the side to move, in the candidate moves.
Cite imbalances by number, in the "imbalances" field ONLY \u2014 never write the numbers in the
summary or the ideas; a reader does not see the list. Do not state any imbalance that is not in
the numbered list: if a file, pawn weakness or outpost is not listed, it is not there.
Reply with ONLY this JSON, no prose outside it:
{"structure": "<the matching row's name exactly as the first column of the skill's structure table gives it, e.g. Carlsbad (QGD Exchange) \u2014 or none>",
 "summary": "<3-6 sentences: who stands better and why, and how the two sides' plans meet>",
 "plans": [{"side": "white|black", "priority": 1, "name": "<short name>", "idea": "<2-4 sentences>",
            "moves": ["<key moves in SAN>"], "imbalances": [<numbers of the imbalances it uses>],
            "engineEvidence": "<which candidate moves carry it, or 'none of the engine's top moves'>"}]}`;
}
var citable = (x) => x.facts.filter((f) => !f.startsWith("Phase:"));
function citedImbalances(x, cited) {
  const facts = citable(x);
  const list2 = Array.isArray(cited) ? cited : cited ? [cited] : [];
  return list2.map((c) => facts[Number(String(c).replace(/[^0-9]/g, "")) - 1]).filter((f) => !!f);
}
function parseModelJson(text) {
  const body = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start2 = body.indexOf("{"), end = body.lastIndexOf("}");
  if (start2 < 0 || end < start2) throw new Error(`The model did not answer in JSON: ${text.slice(0, 200)}`);
  const candidate = body.slice(start2, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
  }
}
var asList = (v) => Array.isArray(v) ? v : v ? [v] : [];
var uncite = (text) => (text ?? "").replace(/\s*\((?:#?\d+(?:\s*[,&]\s*#?\d+)*)\)/g, "").replace(/\s+([.,;:])/g, "$1");
var LEVELS = ["beginner", "intermediate", "expert"];
var LEVEL_BRIEF = {
  beginner: `Write for a BEGINNER. Your first plan for the side to move MUST deal with the Tactics lines above, if there are any \u2014 what is attacked, what is loose, what is threatened \u2014 said square by square in plain words. Then the basic principles that apply: develop, castle, fight for the centre. At most TWO plans per side, one or two short sentences each, one or two moves each. No jargon unless you say what it means; no structure names; no numbers.`,
  intermediate: `Write for an INTERMEDIATE player: plans from the imbalances, the structure named and its known plans, the engine's moves tied to the plans, what each plan concedes. Tactics that are there come first. Explain an uncommon term once, briefly.`,
  expert: `Write for an EXPERT: full depth, no hand-holding \u2014 structure and variation names, the plans theory gives both sides, move-order finesse and why this move first, the pawn breaks and their timing, what the engine's second and third choices say. Tactics that are there are stated, briefly. Never explain basic terms.`
};
var MAX_PLANS = { beginner: 2, intermediate: 3, expert: 3 };
function levelOf(v) {
  const t = (v ?? "").trim().toLowerCase();
  return LEVELS.includes(t) ? t : "intermediate";
}
async function plansFor(ctx, fen, opening, args, theory = null) {
  const withinCp = clamp(args.withinCp, 50, 0, 300);
  const multiPv = clamp(args.multiPv, 5, 1, 8);
  const depth = clamp(args.depth, 18, 6, 22);
  const gateway = ctx;
  if (legal(fen).moves().length === 0) return [];
  const x = imbalancesOf(fen);
  const structure = structureSentence(structureOf(fen));
  const { lines, elapsedMs } = await linesFor(fen, multiPv, depth);
  const candidates = candidateRecords(fen, lines, x, elapsedMs);
  const ask = (prompt2) => gateway.ai.complete({
    prompt: prompt2,
    skills: ["chess-plans"],
    ...args.role ? { role: args.role } : {}
  }).then((r) => typeof r === "string" ? r : JSON.stringify(r));
  const level = levelOf(args.level);
  const prompt = promptFor(fen, x, opening, structure, candidates, withinCp, theory, level);
  let text = await ask(prompt);
  let parsed;
  try {
    parsed = parseModelJson(text);
  } catch (e) {
    text = await ask(`${prompt}

Your previous answer was not valid JSON (${e.message}). Reply again with ONLY the JSON object.`);
    parsed = parseModelJson(text);
  }
  const perSide = { white: 0, black: 0 };
  const plans = (parsed.plans ?? []).filter((p) => p.side === "white" || p.side === "black").sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9)).filter((p) => ++perSide[p.side] <= MAX_PLANS[level]);
  if (plans.length === 0) throw new Error(`The model named no plans for ${fen}: ${text.slice(0, 200)}`);
  const count = { white: 0, black: 0 };
  return plans.map((p) => {
    const side = p.side;
    const priority = typeof p.priority === "number" ? p.priority : ++count[side];
    return {
      planId: `${fen}#${level}#${side}#${priority}#${(p.name ?? "").slice(0, 40)}`,
      fen,
      side,
      priority,
      name: p.name ?? "",
      idea: uncite(p.idea),
      moves: asList(p.moves).join(" "),
      imbalances: citedImbalances(x, p.imbalances).join("\n"),
      engineEvidence: uncite(p.engineEvidence),
      summary: uncite(parsed.summary),
      structure: parsed.structure ?? "",
      opening: opening ?? "",
      level,
      model: args.role ?? "default"
    };
  });
}
async function explainPlans(ctx, args) {
  const out = [];
  for (const raw of args.fens ?? []) {
    const fen = raw.trim();
    legal(fen);
    const hit = openingOf(fen);
    out.push(...await plansFor(ctx, fen, hit ? `${hit.eco} ${hit.name} (${hit.pgn})` : null, args));
  }
  return out;
}
async function explainLinePlans(ctx, args) {
  const out = [];
  for (const raw of args.lines ?? []) {
    const moves = splitLine(raw);
    const line = moves.join(" ");
    const fen = positionAfter(moves);
    const hit = openingOfLine(moves);
    const opening = hit ? `${hit.eco} ${hit.name} (${hit.pgn})${hit.pliesPast ? `, left the book ${hit.pliesPast} ${hit.pliesPast === 1 ? "ply" : "plies"} ago` : ""}` : null;
    const theory = await theoryFor(ctx, moves).catch(() => null);
    for (const p of await plansFor(ctx, fen, opening, args, theory)) {
      out.push({ ...p, planId: `${line}#${p.level}#${p.side}#${p.priority}#${p.name.slice(0, 40)}`, line });
    }
  }
  return out;
}
function explorerAnswer(raw) {
  if (raw && typeof raw === "object") return raw;
  const lines = String(raw ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]);
    } catch {
    }
  }
  throw new Error(`The Lichess explorer answered with nothing readable: ${String(raw).slice(0, 200)}`);
}
var share = (n, of) => of > 0 ? Math.round(1e3 * n / of) / 10 : null;
function moveRecords(fen, a, player = "", color = "") {
  const mover = new import_chess5.Chess(fen).turn();
  return (a.moves ?? []).map((m) => {
    const games = (m.white ?? 0) + (m.draws ?? 0) + (m.black ?? 0);
    const wins = mover === "w" ? m.white : m.black;
    return {
      moveId: `${fen}#${player}#${color}#${m.uci}`,
      fen,
      uci: m.uci,
      san: m.san,
      games,
      white: m.white,
      draws: m.draws,
      black: m.black,
      whiteWinPct: share(m.white, games),
      drawPct: share(m.draws, games),
      blackWinPct: share(m.black, games),
      scoreForMover: games ? Math.round((wins + m.draws / 2) / games * 1e3) / 1e3 : null,
      averageRating: m.averageRating ?? m.averageOpponentRating ?? null,
      player,
      color
    };
  });
}
function sanOf(fen, uci) {
  if (!uci) return "";
  try {
    return new import_chess5.Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return uci;
  }
}
function gameRecords(fen, games, url, player = "", color = "") {
  return (games ?? []).map((g) => ({
    gameId: `${fen}#${player}#${color}#${g.id}`,
    fen,
    uci: sanOf(fen, g.uci),
    white: g.white?.name ?? "",
    whiteElo: g.white?.rating ?? null,
    black: g.black?.name ?? "",
    blackElo: g.black?.rating ?? null,
    result: g.winner === "white" ? "1-0" : g.winner === "black" ? "0-1" : "\xBD-\xBD",
    year: g.year ?? null,
    month: g.month ?? "",
    speed: g.speed ?? "",
    url: url(g.id),
    player,
    color
  }));
}
async function mastersAtPosition(ctx, args) {
  const lichess = ctx.lichess;
  const out = { moves: [], games: [] };
  for (const raw of args.fens ?? []) {
    const fen = raw.trim();
    legal(fen);
    const a = explorerAnswer(await lichess.mastersExplorer({ fen, moves: 12, topGames: 15 }));
    out.moves.push(...moveRecords(fen, a));
    out.games.push(...gameRecords(fen, a.topGames, (id) => `https://lichess.org/${id}`));
  }
  return out;
}
function playerFilter(filters) {
  const f = filters ?? "";
  const player = f.match(/player=([A-Za-z0-9_-]{2,30})/)?.[1];
  const color = f.match(/color=(white|black)/)?.[1];
  return player ? { player, color: color ?? "white" } : null;
}
async function playerAtPosition(ctx, args) {
  const lichess = ctx.lichess;
  const out = { moves: [], games: [] };
  const who = playerFilter(args.filters);
  if (!who) return out;
  for (const raw of args.fens ?? []) {
    const fen = raw.trim();
    legal(fen);
    const a = explorerAnswer(await lichess.playerExplorer({ player: who.player, color: who.color, fen, recentGames: 8 }));
    out.moves.push(...moveRecords(fen, a, who.player, who.color));
    out.games.push(...gameRecords(fen, a.recentGames, (id) => `https://lichess.org/${id}`, who.player, who.color));
  }
  return out;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LEVELS,
  analysePosition,
  explainLinePlans,
  explainPlans,
  explorerAnswer,
  mastersAtPosition,
  openingLookup,
  openingOfGameLine,
  playerAtPosition,
  playerFilter,
  positionImbalances,
  theoryOfGameLine
});
/*! Bundled license information:

chess.js/dist/cjs/chess.js:
  (**
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
   *)
*/
