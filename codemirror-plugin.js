// ========= comments.js =========

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
    "use strict";
  
    var noOptions = {};
    var nonWS = /[^\s\u00a0]/;
    var Pos = CodeMirror.Pos;
  
    function firstNonWS(str) {
      var found = str.search(nonWS);
      return found == -1 ? 0 : found;
    }
  
    CodeMirror.commands.toggleComment = function(cm) {
      cm.toggleComment();
    };
  
    CodeMirror.defineExtension("toggleComment", function(options) {
      if (!options) options = noOptions;
      var cm = this;
      var minLine = Infinity, ranges = this.listSelections(), mode = null;
      for (var i = ranges.length - 1; i >= 0; i--) {
        var from = ranges[i].from(), to = ranges[i].to();
        if (from.line >= minLine) continue;
        if (to.line >= minLine) to = Pos(minLine, 0);
        minLine = from.line;
        if (mode == null) {
          if (cm.uncomment(from, to, options)) mode = "un";
          else { cm.lineComment(from, to, options); mode = "line"; }
        } else if (mode == "un") {
          cm.uncomment(from, to, options);
        } else {
          cm.lineComment(from, to, options);
        }
      }
    });
  
    // Rough heuristic to try and detect lines that are part of multi-line string
    function probablyInsideString(cm, pos, line) {
      return /\bstring\b/.test(cm.getTokenTypeAt(Pos(pos.line, 0))) && !/^[\'\"\`]/.test(line)
    }
  
    function getMode(cm, pos) {
      var mode = cm.getMode()
      return mode.useInnerComments === false || !mode.innerMode ? mode : cm.getModeAt(pos)
    }
  
    CodeMirror.defineExtension("lineComment", function(from, to, options) {
      if (!options) options = noOptions;
      var self = this, mode = getMode(self, from);
      var firstLine = self.getLine(from.line);
      if (firstLine == null || probablyInsideString(self, from, firstLine)) return;
  
      var commentString = options.lineComment || mode.lineComment;
      if (!commentString) {
        if (options.blockCommentStart || mode.blockCommentStart) {
          options.fullLines = true;
          self.blockComment(from, to, options);
        }
        return;
      }
  
      var end = Math.min(to.ch != 0 || to.line == from.line ? to.line + 1 : to.line, self.lastLine() + 1);
      var pad = options.padding == null ? " " : options.padding;
      var blankLines = options.commentBlankLines || from.line == to.line;
  
      self.operation(function() {
        if (options.indent) {
          var baseString = null;
          for (var i = from.line; i < end; ++i) {
            var line = self.getLine(i);
            var whitespace = line.slice(0, firstNonWS(line));
            if (baseString == null || baseString.length > whitespace.length) {
              baseString = whitespace;
            }
          }
          for (var i = from.line; i < end; ++i) {
            var line = self.getLine(i), cut = baseString.length;
            if (!blankLines && !nonWS.test(line)) continue;
            if (line.slice(0, cut) != baseString) cut = firstNonWS(line);
            self.replaceRange(baseString + commentString + pad, Pos(i, 0), Pos(i, cut));
          }
        } else {
          for (var i = from.line; i < end; ++i) {
            if (blankLines || nonWS.test(self.getLine(i)))
              self.replaceRange(commentString + pad, Pos(i, 0));
          }
        }
      });
    });
  
    CodeMirror.defineExtension("blockComment", function(from, to, options) {
      if (!options) options = noOptions;
      var self = this, mode = getMode(self, from);
      var startString = options.blockCommentStart || mode.blockCommentStart;
      var endString = options.blockCommentEnd || mode.blockCommentEnd;
      if (!startString || !endString) {
        if ((options.lineComment || mode.lineComment) && options.fullLines != false)
          self.lineComment(from, to, options);
        return;
      }
      if (/\bcomment\b/.test(self.getTokenTypeAt(Pos(from.line, 0)))) return
  
      var end = Math.min(to.line, self.lastLine());
      if (end != from.line && to.ch == 0 && nonWS.test(self.getLine(end))) --end;
  
      var pad = options.padding == null ? " " : options.padding;
      if (from.line > end) return;
  
      self.operation(function() {
        if (options.fullLines != false) {
          var lastLineHasText = nonWS.test(self.getLine(end));
          self.replaceRange(pad + endString, Pos(end));
          self.replaceRange(startString + pad, Pos(from.line, 0));
          var lead = options.blockCommentLead || mode.blockCommentLead;
          if (lead != null) for (var i = from.line + 1; i <= end; ++i)
            if (i != end || lastLineHasText)
              self.replaceRange(lead + pad, Pos(i, 0));
        } else {
          self.replaceRange(endString, to);
          self.replaceRange(startString, from);
        }
      });
    });
  
    CodeMirror.defineExtension("uncomment", function(from, to, options) {
      if (!options) options = noOptions;
      var self = this, mode = getMode(self, from);
      var end = Math.min(to.ch != 0 || to.line == from.line ? to.line : to.line - 1, self.lastLine()), start = Math.min(from.line, end);
  
      // Try finding line comments
      var lineString = options.lineComment || mode.lineComment, lines = [];
      var pad = options.padding == null ? " " : options.padding, didSomething;
      lineComment: {
        if (!lineString) break lineComment;
        for (var i = start; i <= end; ++i) {
          var line = self.getLine(i);
          var found = line.indexOf(lineString);
          if (found > -1 && !/comment/.test(self.getTokenTypeAt(Pos(i, found + 1)))) found = -1;
          if (found == -1 && nonWS.test(line)) break lineComment;
          if (found > -1 && nonWS.test(line.slice(0, found))) break lineComment;
          lines.push(line);
        }
        self.operation(function() {
          for (var i = start; i <= end; ++i) {
            var line = lines[i - start];
            var pos = line.indexOf(lineString), endPos = pos + lineString.length;
            if (pos < 0) continue;
            if (line.slice(endPos, endPos + pad.length) == pad) endPos += pad.length;
            didSomething = true;
            self.replaceRange("", Pos(i, pos), Pos(i, endPos));
          }
        });
        if (didSomething) return true;
      }
  
      // Try block comments
      var startString = options.blockCommentStart || mode.blockCommentStart;
      var endString = options.blockCommentEnd || mode.blockCommentEnd;
      if (!startString || !endString) return false;
      var lead = options.blockCommentLead || mode.blockCommentLead;
      var startLine = self.getLine(start), open = startLine.indexOf(startString)
      if (open == -1) return false
      var endLine = end == start ? startLine : self.getLine(end)
      var close = endLine.indexOf(endString, end == start ? open + startString.length : 0);
      var insideStart = Pos(start, open + 1), insideEnd = Pos(end, close + 1)
      if (close == -1 ||
          !/comment/.test(self.getTokenTypeAt(insideStart)) ||
          !/comment/.test(self.getTokenTypeAt(insideEnd)) ||
          self.getRange(insideStart, insideEnd, "\n").indexOf(endString) > -1)
        return false;
  
      // Avoid killing block comments completely outside the selection.
      // Positions of the last startString before the start of the selection, and the first endString after it.
      var lastStart = startLine.lastIndexOf(startString, from.ch);
      var firstEnd = lastStart == -1 ? -1 : startLine.slice(0, from.ch).indexOf(endString, lastStart + startString.length);
      if (lastStart != -1 && firstEnd != -1 && firstEnd + endString.length != from.ch) return false;
      // Positions of the first endString after the end of the selection, and the last startString before it.
      firstEnd = endLine.indexOf(endString, to.ch);
      var almostLastStart = endLine.slice(to.ch).lastIndexOf(startString, firstEnd - to.ch);
      lastStart = (firstEnd == -1 || almostLastStart == -1) ? -1 : to.ch + almostLastStart;
      if (firstEnd != -1 && lastStart != -1 && lastStart != to.ch) return false;
  
      self.operation(function() {
        self.replaceRange("", Pos(end, close - (pad && endLine.slice(close - pad.length, close) == pad ? pad.length : 0)),
                          Pos(end, close + endString.length));
        var openEnd = open + startString.length;
        if (pad && startLine.slice(openEnd, openEnd + pad.length) == pad) openEnd += pad.length;
        self.replaceRange("", Pos(start, open), Pos(start, openEnd));
        if (lead) for (var i = start + 1; i <= end; ++i) {
          var line = self.getLine(i), found = line.indexOf(lead);
          if (found == -1 || nonWS.test(line.slice(0, found))) continue;
          var foundEnd = found + lead.length;
          if (pad && line.slice(foundEnd, foundEnd + pad.length) == pad) foundEnd += pad.length;
          self.replaceRange("", Pos(i, found), Pos(i, foundEnd));
        }
      });
      return true;
    });
  });
  
// ========= matchbrackets.js =========

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  var ie_lt8 = /MSIE \d/.test(navigator.userAgent) &&
    (document.documentMode == null || document.documentMode < 8);

  var Pos = CodeMirror.Pos;

  var matching = {"(": ")>", ")": "(<", "[": "]>", "]": "[<", "{": "}>", "}": "{<", "<": ">>", ">": "<<"};

  function bracketRegex(config) {
    return config && config.bracketRegex || /[(){}[\]]/
  }

  function findMatchingBracket(cm, where, config) {
    var line = cm.getLineHandle(where.line), pos = where.ch - 1;
    var afterCursor = config && config.afterCursor
    if (afterCursor == null)
      afterCursor = /(^| )cm-fat-cursor($| )/.test(cm.getWrapperElement().className)
    var re = bracketRegex(config)

    // A cursor is defined as between two characters, but in in vim command mode
    // (i.e. not insert mode), the cursor is visually represented as a
    // highlighted box on top of the 2nd character. Otherwise, we allow matches
    // from before or after the cursor.
    var match = (!afterCursor && pos >= 0 && re.test(line.text.charAt(pos)) && matching[line.text.charAt(pos)]) ||
        re.test(line.text.charAt(pos + 1)) && matching[line.text.charAt(++pos)];
    if (!match) return null;
    var dir = match.charAt(1) == ">" ? 1 : -1;
    if (config && config.strict && (dir > 0) != (pos == where.ch)) return null;
    var style = cm.getTokenTypeAt(Pos(where.line, pos + 1));

    var found = scanForBracket(cm, Pos(where.line, pos + (dir > 0 ? 1 : 0)), dir, style, config);
    if (found == null) return null;
    return {from: Pos(where.line, pos), to: found && found.pos,
            match: found && found.ch == match.charAt(0), forward: dir > 0};
  }

  // bracketRegex is used to specify which type of bracket to scan
  // should be a regexp, e.g. /[[\]]/
  //
  // Note: If "where" is on an open bracket, then this bracket is ignored.
  //
  // Returns false when no bracket was found, null when it reached
  // maxScanLines and gave up
  function scanForBracket(cm, where, dir, style, config) {
    var maxScanLen = (config && config.maxScanLineLength) || 10000;
    var maxScanLines = (config && config.maxScanLines) || 1000;

    var stack = [];
    var re = bracketRegex(config)
    var lineEnd = dir > 0 ? Math.min(where.line + maxScanLines, cm.lastLine() + 1)
                          : Math.max(cm.firstLine() - 1, where.line - maxScanLines);
    for (var lineNo = where.line; lineNo != lineEnd; lineNo += dir) {
      var line = cm.getLine(lineNo);
      if (!line) continue;
      var pos = dir > 0 ? 0 : line.length - 1, end = dir > 0 ? line.length : -1;
      if (line.length > maxScanLen) continue;
      if (lineNo == where.line) pos = where.ch - (dir < 0 ? 1 : 0);
      for (; pos != end; pos += dir) {
        var ch = line.charAt(pos);
        if (re.test(ch) && (style === undefined ||
                            (cm.getTokenTypeAt(Pos(lineNo, pos + 1)) || "") == (style || ""))) {
          var match = matching[ch];
          if (match && (match.charAt(1) == ">") == (dir > 0)) stack.push(ch);
          else if (!stack.length) return {pos: Pos(lineNo, pos), ch: ch};
          else stack.pop();
        }
      }
    }
    return lineNo - dir == (dir > 0 ? cm.lastLine() : cm.firstLine()) ? false : null;
  }

  function matchBrackets(cm, autoclear, config) {
    // Disable brace matching in long lines, since it'll cause hugely slow updates
    var maxHighlightLen = cm.state.matchBrackets.maxHighlightLineLength || 1000,
      highlightNonMatching = config && config.highlightNonMatching;
    var marks = [], ranges = cm.listSelections();
    for (var i = 0; i < ranges.length; i++) {
      var match = ranges[i].empty() && findMatchingBracket(cm, ranges[i].head, config);
      if (match && (match.match || highlightNonMatching !== false) && cm.getLine(match.from.line).length <= maxHighlightLen) {
        var style = match.match ? "CodeMirror-matchingbracket" : "CodeMirror-nonmatchingbracket";
        marks.push(cm.markText(match.from, Pos(match.from.line, match.from.ch + 1), {className: style}));
        if (match.to && cm.getLine(match.to.line).length <= maxHighlightLen)
          marks.push(cm.markText(match.to, Pos(match.to.line, match.to.ch + 1), {className: style}));
      }
    }

    if (marks.length) {
      // Kludge to work around the IE bug from issue #1193, where text
      // input stops going to the textarea whenever this fires.
      if (ie_lt8 && cm.state.focused) cm.focus();

      var clear = function() {
        cm.operation(function() {
          for (var i = 0; i < marks.length; i++) marks[i].clear();
        });
      };
      if (autoclear) setTimeout(clear, 800);
      else return clear;
    }
  }

  function doMatchBrackets(cm) {
    cm.operation(function() {
      if (cm.state.matchBrackets.currentlyHighlighted) {
        cm.state.matchBrackets.currentlyHighlighted();
        cm.state.matchBrackets.currentlyHighlighted = null;
      }
      cm.state.matchBrackets.currentlyHighlighted = matchBrackets(cm, false, cm.state.matchBrackets);
    });
  }

  function clearHighlighted(cm) {
    if (cm.state.matchBrackets && cm.state.matchBrackets.currentlyHighlighted) {
      cm.state.matchBrackets.currentlyHighlighted();
      cm.state.matchBrackets.currentlyHighlighted = null;
    }
  }

  CodeMirror.defineOption("matchBrackets", false, function(cm, val, old) {
    if (old && old != CodeMirror.Init) {
      cm.off("cursorActivity", doMatchBrackets);
      cm.off("focus", doMatchBrackets)
      cm.off("blur", clearHighlighted)
      clearHighlighted(cm);
    }
    if (val) {
      cm.state.matchBrackets = typeof val == "object" ? val : {};
      cm.on("cursorActivity", doMatchBrackets);
      cm.on("focus", doMatchBrackets)
      cm.on("blur", clearHighlighted)
    }
  });

  CodeMirror.defineExtension("matchBrackets", function() {matchBrackets(this, true);});
  CodeMirror.defineExtension("findMatchingBracket", function(pos, config, oldConfig){
    // Backwards-compatibility kludge
    if (oldConfig || typeof config == "boolean") {
      if (!oldConfig) {
        config = config ? {strict: true} : null
      } else {
        oldConfig.strict = config
        config = oldConfig
      }
    }
    return findMatchingBracket(this, pos, config)
  });
  CodeMirror.defineExtension("scanForBracket", function(pos, dir, style, config){
    return scanForBracket(this, pos, dir, style, config);
  });
});

// ========= python.js =========

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  "use strict";

  function wordRegexp(words) {
    return new RegExp("^((" + words.join(")|(") + "))\\b");
  }

  var wordOperators = wordRegexp(["and", "or", "not", "is"]);
  var commonKeywords = ["as", "assert", "break", "class", "continue",
                        "def", "del", "elif", "else", "except", "finally",
                        "for", "from", "global", "if", "import",
                        "lambda", "pass", "raise", "return",
                        "try", "while", "with", "yield", "in", "False", "True"];
  var commonBuiltins = ["abs", "all", "any", "bin", "bool", "bytearray", "callable", "chr",
                        "classmethod", "compile", "complex", "delattr", "dict", "dir", "divmod",
                        "enumerate", "eval", "filter", "float", "format", "frozenset",
                        "getattr", "globals", "hasattr", "hash", "help", "hex", "id",
                        "input", "int", "isinstance", "issubclass", "iter", "len",
                        "list", "locals", "map", "max", "memoryview", "min", "next",
                        "object", "oct", "open", "ord", "pow", "property", "range",
                        "repr", "reversed", "round", "set", "setattr", "slice",
                        "sorted", "staticmethod", "str", "sum", "super", "tuple",
                        "type", "vars", "zip", "__import__", "NotImplemented",
                        "Ellipsis", "__debug__"];
  CodeMirror.registerHelper("hintWords", "python", commonKeywords.concat(commonBuiltins).concat(["exec", "print"]));

  function top(state) {
    return state.scopes[state.scopes.length - 1];
  }

  CodeMirror.defineMode("python", function(conf, parserConf) {
    var ERRORCLASS = "error";

    var delimiters = parserConf.delimiters || parserConf.singleDelimiters || /^[\(\)\[\]\{\}@,:`=;\.\\]/;
    //               (Backwards-compatibility with old, cumbersome config system)
    var operators = [parserConf.singleOperators, parserConf.doubleOperators, parserConf.doubleDelimiters, parserConf.tripleDelimiters,
                     parserConf.operators || /^([-+*/%\/&|^]=?|[<>=]+|\/\/=?|\*\*=?|!=|[~!@]|\.\.\.)/]
    for (var i = 0; i < operators.length; i++) if (!operators[i]) operators.splice(i--, 1)

    var hangingIndent = parserConf.hangingIndent || conf.indentUnit;

    var myKeywords = commonKeywords, myBuiltins = commonBuiltins;
    if (parserConf.extra_keywords != undefined)
      myKeywords = myKeywords.concat(parserConf.extra_keywords);

    if (parserConf.extra_builtins != undefined)
      myBuiltins = myBuiltins.concat(parserConf.extra_builtins);

    var py3 = !(parserConf.version && Number(parserConf.version) < 3)
    if (py3) {
      // since http://legacy.python.org/dev/peps/pep-0465/ @ is also an operator
      var identifiers = parserConf.identifiers|| /^[_A-Za-z\u00A1-\uFFFF][_A-Za-z0-9\u00A1-\uFFFF]*/;
      myKeywords = myKeywords.concat(["nonlocal", "None", "aiter", "anext", "async", "await", "breakpoint", "match", "case"]);
      myBuiltins = myBuiltins.concat(["ascii", "bytes", "exec", "print"]);
      var stringPrefixes = new RegExp("^(([rbuf]|(br)|(rb)|(fr)|(rf))?('{3}|\"{3}|['\"]))", "i");
    } else {
      var identifiers = parserConf.identifiers|| /^[_A-Za-z][_A-Za-z0-9]*/;
      myKeywords = myKeywords.concat(["exec", "print"]);
      myBuiltins = myBuiltins.concat(["apply", "basestring", "buffer", "cmp", "coerce", "execfile",
                                      "file", "intern", "long", "raw_input", "reduce", "reload",
                                      "unichr", "unicode", "xrange", "None"]);
      var stringPrefixes = new RegExp("^(([rubf]|(ur)|(br))?('{3}|\"{3}|['\"]))", "i");
    }
    var keywords = wordRegexp(myKeywords);
    var builtins = wordRegexp(myBuiltins);

    // tokenizers
    function tokenBase(stream, state) {
      var sol = stream.sol() && state.lastToken != "\\"
      if (sol) state.indent = stream.indentation()
      // Handle scope changes
      if (sol && top(state).type == "py") {
        var scopeOffset = top(state).offset;
        if (stream.eatSpace()) {
          var lineOffset = stream.indentation();
          if (lineOffset > scopeOffset)
            pushPyScope(state);
          else if (lineOffset < scopeOffset && dedent(stream, state) && stream.peek() != "#")
            state.errorToken = true;
          return null;
        } else {
          var style = tokenBaseInner(stream, state);
          if (scopeOffset > 0 && dedent(stream, state))
            style += " " + ERRORCLASS;
          return style;
        }
      }
      return tokenBaseInner(stream, state);
    }

    function tokenBaseInner(stream, state, inFormat) {
      if (stream.eatSpace()) return null;

      // Handle Comments
      if (!inFormat && stream.match(/^#.*/)) return "comment";

      // Handle Number Literals
      if (stream.match(/^[0-9\.]/, false)) {
        var floatLiteral = false;
        // Floats
        if (stream.match(/^[\d_]*\.\d+(e[\+\-]?\d+)?/i)) { floatLiteral = true; }
        if (stream.match(/^[\d_]+\.\d*/)) { floatLiteral = true; }
        if (stream.match(/^\.\d+/)) { floatLiteral = true; }
        if (floatLiteral) {
          // Float literals may be "imaginary"
          stream.eat(/J/i);
          return "number";
        }
        // Integers
        var intLiteral = false;
        // Hex
        if (stream.match(/^0x[0-9a-f_]+/i)) intLiteral = true;
        // Binary
        if (stream.match(/^0b[01_]+/i)) intLiteral = true;
        // Octal
        if (stream.match(/^0o[0-7_]+/i)) intLiteral = true;
        // Decimal
        if (stream.match(/^[1-9][\d_]*(e[\+\-]?[\d_]+)?/)) {
          // Decimal literals may be "imaginary"
          stream.eat(/J/i);
          // TODO - Can you have imaginary longs?
          intLiteral = true;
        }
        // Zero by itself with no other piece of number.
        if (stream.match(/^0(?![\dx])/i)) intLiteral = true;
        if (intLiteral) {
          // Integer literals may be "long"
          stream.eat(/L/i);
          return "number";
        }
      }

      // Handle Strings
      if (stream.match(stringPrefixes)) {
        var isFmtString = stream.current().toLowerCase().indexOf('f') !== -1;
        if (!isFmtString) {
          state.tokenize = tokenStringFactory(stream.current(), state.tokenize);
          return state.tokenize(stream, state);
        } else {
          state.tokenize = formatStringFactory(stream.current(), state.tokenize);
          return state.tokenize(stream, state);
        }
      }

      for (var i = 0; i < operators.length; i++)
        if (stream.match(operators[i])) return "operator"

      if (stream.match(delimiters)) return "punctuation";

      if (state.lastToken == "." && stream.match(identifiers))
        return "property";

      if (stream.match(keywords) || stream.match(wordOperators))
        return "keyword";

      if (stream.match(builtins))
        return "builtin";

      if (stream.match(/^(self|cls)\b/))
        return "variable-2";

      if (stream.match(identifiers)) {
        if (state.lastToken == "def" || state.lastToken == "class")
          return "def";
        return "variable";
      }

      // Handle non-detected items
      stream.next();
      return inFormat ? null :ERRORCLASS;
    }

    function formatStringFactory(delimiter, tokenOuter) {
      while ("rubf".indexOf(delimiter.charAt(0).toLowerCase()) >= 0)
        delimiter = delimiter.substr(1);

      var singleline = delimiter.length == 1;
      var OUTCLASS = "string";

      function tokenNestedExpr(depth) {
        return function(stream, state) {
          var inner = tokenBaseInner(stream, state, true)
          if (inner == "punctuation") {
            if (stream.current() == "{") {
              state.tokenize = tokenNestedExpr(depth + 1)
            } else if (stream.current() == "}") {
              if (depth > 1) state.tokenize = tokenNestedExpr(depth - 1)
              else state.tokenize = tokenString
            }
          }
          return inner
        }
      }

      function tokenString(stream, state) {
        while (!stream.eol()) {
          stream.eatWhile(/[^'"\{\}\\]/);
          if (stream.eat("\\")) {
            stream.next();
            if (singleline && stream.eol())
              return OUTCLASS;
          } else if (stream.match(delimiter)) {
            state.tokenize = tokenOuter;
            return OUTCLASS;
          } else if (stream.match('{{')) {
            // ignore {{ in f-str
            return OUTCLASS;
          } else if (stream.match('{', false)) {
            // switch to nested mode
            state.tokenize = tokenNestedExpr(0)
            if (stream.current()) return OUTCLASS;
            else return state.tokenize(stream, state)
          } else if (stream.match('}}')) {
            return OUTCLASS;
          } else if (stream.match('}')) {
            // single } in f-string is an error
            return ERRORCLASS;
          } else {
            stream.eat(/['"]/);
          }
        }
        if (singleline) {
          if (parserConf.singleLineStringErrors)
            return ERRORCLASS;
          else
            state.tokenize = tokenOuter;
        }
        return OUTCLASS;
      }
      tokenString.isString = true;
      return tokenString;
    }

    function tokenStringFactory(delimiter, tokenOuter) {
      while ("rubf".indexOf(delimiter.charAt(0).toLowerCase()) >= 0)
        delimiter = delimiter.substr(1);

      var singleline = delimiter.length == 1;
      var OUTCLASS = "string";

      function tokenString(stream, state) {
        while (!stream.eol()) {
          stream.eatWhile(/[^'"\\]/);
          if (stream.eat("\\")) {
            stream.next();
            if (singleline && stream.eol())
              return OUTCLASS;
          } else if (stream.match(delimiter)) {
            state.tokenize = tokenOuter;
            return OUTCLASS;
          } else {
            stream.eat(/['"]/);
          }
        }
        if (singleline) {
          if (parserConf.singleLineStringErrors)
            return ERRORCLASS;
          else
            state.tokenize = tokenOuter;
        }
        return OUTCLASS;
      }
      tokenString.isString = true;
      return tokenString;
    }

    function pushPyScope(state) {
      while (top(state).type != "py") state.scopes.pop()
      state.scopes.push({offset: top(state).offset + conf.indentUnit,
                         type: "py",
                         align: null})
    }

    function pushBracketScope(stream, state, type) {
      var align = stream.match(/^[\s\[\{\(]*(?:#|$)/, false) ? null : stream.column() + 1
      state.scopes.push({offset: state.indent + hangingIndent,
                         type: type,
                         align: align})
    }

    function dedent(stream, state) {
      var indented = stream.indentation();
      while (state.scopes.length > 1 && top(state).offset > indented) {
        if (top(state).type != "py") return true;
        state.scopes.pop();
      }
      return top(state).offset != indented;
    }

    function tokenLexer(stream, state) {
      if (stream.sol()) {
        state.beginningOfLine = true;
        state.dedent = false;
      }

      var style = state.tokenize(stream, state);
      var current = stream.current();

      // Handle decorators
      if (state.beginningOfLine && current == "@")
        return stream.match(identifiers, false) ? "meta" : py3 ? "operator" : ERRORCLASS;

      if (/\S/.test(current)) state.beginningOfLine = false;

      if ((style == "variable" || style == "builtin")
          && state.lastToken == "meta")
        style = "meta";

      // Handle scope changes.
      if (current == "pass" || current == "return")
        state.dedent = true;

      if (current == "lambda") state.lambda = true;
      if (current == ":" && !state.lambda && top(state).type == "py" && stream.match(/^\s*(?:#|$)/, false))
        pushPyScope(state);

      if (current.length == 1 && !/string|comment/.test(style)) {
        var delimiter_index = "[({".indexOf(current);
        if (delimiter_index != -1)
          pushBracketScope(stream, state, "])}".slice(delimiter_index, delimiter_index+1));

        delimiter_index = "])}".indexOf(current);
        if (delimiter_index != -1) {
          if (top(state).type == current) state.indent = state.scopes.pop().offset - hangingIndent
          else return ERRORCLASS;
        }
      }
      if (state.dedent && stream.eol() && top(state).type == "py" && state.scopes.length > 1)
        state.scopes.pop();

      return style;
    }

    var external = {
      startState: function(basecolumn) {
        return {
          tokenize: tokenBase,
          scopes: [{offset: basecolumn || 0, type: "py", align: null}],
          indent: basecolumn || 0,
          lastToken: null,
          lambda: false,
          dedent: 0
        };
      },

      token: function(stream, state) {
        var addErr = state.errorToken;
        if (addErr) state.errorToken = false;
        var style = tokenLexer(stream, state);

        if (style && style != "comment")
          state.lastToken = (style == "keyword" || style == "punctuation") ? stream.current() : style;
        if (style == "punctuation") style = null;

        if (stream.eol() && state.lambda)
          state.lambda = false;
        return addErr ? style + " " + ERRORCLASS : style;
      },

      indent: function(state, textAfter) {
        if (state.tokenize != tokenBase)
          return state.tokenize.isString ? CodeMirror.Pass : 0;

        var scope = top(state)
        var closing = scope.type == textAfter.charAt(0) ||
            scope.type == "py" && !state.dedent && /^(else:|elif |except |finally:)/.test(textAfter)
        if (scope.align != null)
          return scope.align - (closing ? 1 : 0)
        else
          return scope.offset - (closing ? hangingIndent : 0)
      },

      electricInput: /^\s*([\}\]\)]|else:|elif |except |finally:)$/,
      closeBrackets: {triples: "'\""},
      lineComment: "#",
      fold: "indent"
    };
    return external;
  });

  CodeMirror.defineMIME("text/x-python", "python");

  var words = function(str) { return str.split(" "); };

  CodeMirror.defineMIME("text/x-cython", {
    name: "python",
    extra_keywords: words("by cdef cimport cpdef ctypedef enum except "+
                          "extern gil include nogil property public "+
                          "readonly struct union DEF IF ELIF ELSE")
  });

});