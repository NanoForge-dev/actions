// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = import.meta.require;

// node_modules/.pnpm/tunnel@0.0.6/node_modules/tunnel/lib/tunnel.js
var require_tunnel = __commonJS((exports) => {
  var net = __require("net");
  var tls = __require("tls");
  var http = __require("http");
  var https = __require("https");
  var events = __require("events");
  var assert = __require("assert");
  var util = __require("util");
  exports.httpOverHttp = httpOverHttp;
  exports.httpsOverHttp = httpsOverHttp;
  exports.httpOverHttps = httpOverHttps;
  exports.httpsOverHttps = httpsOverHttps;
  function httpOverHttp(options) {
    var agent = new TunnelingAgent(options);
    agent.request = http.request;
    return agent;
  }
  function httpsOverHttp(options) {
    var agent = new TunnelingAgent(options);
    agent.request = http.request;
    agent.createSocket = createSecureSocket;
    agent.defaultPort = 443;
    return agent;
  }
  function httpOverHttps(options) {
    var agent = new TunnelingAgent(options);
    agent.request = https.request;
    return agent;
  }
  function httpsOverHttps(options) {
    var agent = new TunnelingAgent(options);
    agent.request = https.request;
    agent.createSocket = createSecureSocket;
    agent.defaultPort = 443;
    return agent;
  }
  function TunnelingAgent(options) {
    var self = this;
    self.options = options || {};
    self.proxyOptions = self.options.proxy || {};
    self.maxSockets = self.options.maxSockets || http.Agent.defaultMaxSockets;
    self.requests = [];
    self.sockets = [];
    self.on("free", function onFree(socket, host, port, localAddress) {
      var options2 = toOptions(host, port, localAddress);
      for (var i = 0, len = self.requests.length;i < len; ++i) {
        var pending = self.requests[i];
        if (pending.host === options2.host && pending.port === options2.port) {
          self.requests.splice(i, 1);
          pending.request.onSocket(socket);
          return;
        }
      }
      socket.destroy();
      self.removeSocket(socket);
    });
  }
  util.inherits(TunnelingAgent, events.EventEmitter);
  TunnelingAgent.prototype.addRequest = function addRequest(req, host, port, localAddress) {
    var self = this;
    var options = mergeOptions({ request: req }, self.options, toOptions(host, port, localAddress));
    if (self.sockets.length >= this.maxSockets) {
      self.requests.push(options);
      return;
    }
    self.createSocket(options, function(socket) {
      socket.on("free", onFree);
      socket.on("close", onCloseOrRemove);
      socket.on("agentRemove", onCloseOrRemove);
      req.onSocket(socket);
      function onFree() {
        self.emit("free", socket, options);
      }
      function onCloseOrRemove(err) {
        self.removeSocket(socket);
        socket.removeListener("free", onFree);
        socket.removeListener("close", onCloseOrRemove);
        socket.removeListener("agentRemove", onCloseOrRemove);
      }
    });
  };
  TunnelingAgent.prototype.createSocket = function createSocket(options, cb) {
    var self = this;
    var placeholder = {};
    self.sockets.push(placeholder);
    var connectOptions = mergeOptions({}, self.proxyOptions, {
      method: "CONNECT",
      path: options.host + ":" + options.port,
      agent: false,
      headers: {
        host: options.host + ":" + options.port
      }
    });
    if (options.localAddress) {
      connectOptions.localAddress = options.localAddress;
    }
    if (connectOptions.proxyAuth) {
      connectOptions.headers = connectOptions.headers || {};
      connectOptions.headers["Proxy-Authorization"] = "Basic " + new Buffer(connectOptions.proxyAuth).toString("base64");
    }
    debug("making CONNECT request");
    var connectReq = self.request(connectOptions);
    connectReq.useChunkedEncodingByDefault = false;
    connectReq.once("response", onResponse);
    connectReq.once("upgrade", onUpgrade);
    connectReq.once("connect", onConnect);
    connectReq.once("error", onError);
    connectReq.end();
    function onResponse(res) {
      res.upgrade = true;
    }
    function onUpgrade(res, socket, head) {
      process.nextTick(function() {
        onConnect(res, socket, head);
      });
    }
    function onConnect(res, socket, head) {
      connectReq.removeAllListeners();
      socket.removeAllListeners();
      if (res.statusCode !== 200) {
        debug("tunneling socket could not be established, statusCode=%d", res.statusCode);
        socket.destroy();
        var error = new Error("tunneling socket could not be established, " + "statusCode=" + res.statusCode);
        error.code = "ECONNRESET";
        options.request.emit("error", error);
        self.removeSocket(placeholder);
        return;
      }
      if (head.length > 0) {
        debug("got illegal response body from proxy");
        socket.destroy();
        var error = new Error("got illegal response body from proxy");
        error.code = "ECONNRESET";
        options.request.emit("error", error);
        self.removeSocket(placeholder);
        return;
      }
      debug("tunneling connection has established");
      self.sockets[self.sockets.indexOf(placeholder)] = socket;
      return cb(socket);
    }
    function onError(cause) {
      connectReq.removeAllListeners();
      debug(`tunneling socket could not be established, cause=%s
`, cause.message, cause.stack);
      var error = new Error("tunneling socket could not be established, " + "cause=" + cause.message);
      error.code = "ECONNRESET";
      options.request.emit("error", error);
      self.removeSocket(placeholder);
    }
  };
  TunnelingAgent.prototype.removeSocket = function removeSocket(socket) {
    var pos = this.sockets.indexOf(socket);
    if (pos === -1) {
      return;
    }
    this.sockets.splice(pos, 1);
    var pending = this.requests.shift();
    if (pending) {
      this.createSocket(pending, function(socket2) {
        pending.request.onSocket(socket2);
      });
    }
  };
  function createSecureSocket(options, cb) {
    var self = this;
    TunnelingAgent.prototype.createSocket.call(self, options, function(socket) {
      var hostHeader = options.request.getHeader("host");
      var tlsOptions = mergeOptions({}, self.options, {
        socket,
        servername: hostHeader ? hostHeader.replace(/:.*$/, "") : options.host
      });
      var secureSocket = tls.connect(0, tlsOptions);
      self.sockets[self.sockets.indexOf(socket)] = secureSocket;
      cb(secureSocket);
    });
  }
  function toOptions(host, port, localAddress) {
    if (typeof host === "string") {
      return {
        host,
        port,
        localAddress
      };
    }
    return host;
  }
  function mergeOptions(target) {
    for (var i = 1, len = arguments.length;i < len; ++i) {
      var overrides = arguments[i];
      if (typeof overrides === "object") {
        var keys = Object.keys(overrides);
        for (var j = 0, keyLen = keys.length;j < keyLen; ++j) {
          var k = keys[j];
          if (overrides[k] !== undefined) {
            target[k] = overrides[k];
          }
        }
      }
    }
    return target;
  }
  var debug;
  if (process.env.NODE_DEBUG && /\btunnel\b/.test(process.env.NODE_DEBUG)) {
    debug = function() {
      var args = Array.prototype.slice.call(arguments);
      if (typeof args[0] === "string") {
        args[0] = "TUNNEL: " + args[0];
      } else {
        args.unshift("TUNNEL:");
      }
      console.error.apply(console, args);
    };
  } else {
    debug = function() {};
  }
  exports.debug = debug;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/internal/constants.js
var require_constants = __commonJS((exports, module) => {
  var SEMVER_SPEC_VERSION = "2.0.0";
  var MAX_LENGTH = 256;
  var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
  var MAX_SAFE_COMPONENT_LENGTH = 16;
  var MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
  var WHITESPACE_CHARACTERS = [
    "\t",
    `
`,
    "\v",
    "\f",
    "\r",
    " ",
    "\xA0",
    "\u1680",
    "\u2000",
    "\u2001",
    "\u2002",
    "\u2003",
    "\u2004",
    "\u2005",
    "\u2006",
    "\u2007",
    "\u2008",
    "\u2009",
    "\u200A",
    "\u2028",
    "\u2029",
    "\u202F",
    "\u205F",
    "\u3000",
    "\uFEFF"
  ];
  var RELEASE_TYPES = [
    "major",
    "premajor",
    "minor",
    "preminor",
    "patch",
    "prepatch",
    "prerelease"
  ];
  module.exports = {
    MAX_LENGTH,
    MAX_SAFE_COMPONENT_LENGTH,
    MAX_SAFE_BUILD_LENGTH,
    MAX_SAFE_INTEGER,
    WHITESPACE_CHARACTERS,
    RELEASE_TYPES,
    SEMVER_SPEC_VERSION,
    FLAG_INCLUDE_PRERELEASE: 1,
    FLAG_LOOSE: 2
  };
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/internal/debug.js
var require_debug = __commonJS((exports, module) => {
  var debug2 = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {};
  module.exports = debug2;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/internal/re.js
var require_re = __commonJS((exports, module) => {
  var {
    MAX_SAFE_COMPONENT_LENGTH,
    MAX_SAFE_BUILD_LENGTH,
    MAX_LENGTH
  } = require_constants();
  var debug2 = require_debug();
  exports = module.exports = {};
  var re = exports.re = [];
  var safeRe = exports.safeRe = [];
  var src = exports.src = [];
  var safeSrc = exports.safeSrc = [];
  var t = exports.t = {};
  var R = 0;
  var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
  var safeRegexReplacements = [
    ["\\s", 1],
    ["\\d", MAX_LENGTH],
    [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
  ];
  var makeSafeRegex = (value) => {
    for (const [token, max] of safeRegexReplacements) {
      value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
    }
    return value;
  };
  var createToken = (name, value, isGlobal) => {
    const safe = makeSafeRegex(value);
    const index = R++;
    debug2(name, index, value);
    t[name] = index;
    src[index] = value;
    safeSrc[index] = safe;
    re[index] = new RegExp(value, isGlobal ? "g" : undefined);
    safeRe[index] = new RegExp(safe, isGlobal ? "g" : undefined);
  };
  createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
  createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
  createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
  createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.` + `(${src[t.NUMERICIDENTIFIER]})\\.` + `(${src[t.NUMERICIDENTIFIER]})`);
  createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.` + `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.` + `(${src[t.NUMERICIDENTIFIERLOOSE]})`);
  createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
  createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
  createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
  createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
  createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
  createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
  createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
  createToken("FULL", `^${src[t.FULLPLAIN]}$`);
  createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
  createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
  createToken("GTLT", "((?:<|>)?=?)");
  createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
  createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
  createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})` + `(?:\\.(${src[t.XRANGEIDENTIFIER]})` + `(?:\\.(${src[t.XRANGEIDENTIFIER]})` + `(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?` + `)?)?`);
  createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})` + `(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})` + `(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})` + `(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?` + `)?)?`);
  createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
  createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
  createToken("COERCEPLAIN", `${"(^|[^\\d])" + "(\\d{1,"}${MAX_SAFE_COMPONENT_LENGTH}})` + `(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?` + `(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
  createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
  createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?` + `(?:${src[t.BUILD]})?` + `(?:$|[^\\d])`);
  createToken("COERCERTL", src[t.COERCE], true);
  createToken("COERCERTLFULL", src[t.COERCEFULL], true);
  createToken("LONETILDE", "(?:~>?)");
  createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
  exports.tildeTrimReplace = "$1~";
  createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
  createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
  createToken("LONECARET", "(?:\\^)");
  createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
  exports.caretTrimReplace = "$1^";
  createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
  createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
  createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
  createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
  createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
  exports.comparatorTrimReplace = "$1$2$3";
  createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})` + `\\s+-\\s+` + `(${src[t.XRANGEPLAIN]})` + `\\s*$`);
  createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})` + `\\s+-\\s+` + `(${src[t.XRANGEPLAINLOOSE]})` + `\\s*$`);
  createToken("STAR", "(<|>)?=?\\s*\\*");
  createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
  createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/internal/parse-options.js
var require_parse_options = __commonJS((exports, module) => {
  var looseOption = Object.freeze({ loose: true });
  var emptyOpts = Object.freeze({});
  var parseOptions = (options) => {
    if (!options) {
      return emptyOpts;
    }
    if (typeof options !== "object") {
      return looseOption;
    }
    return options;
  };
  module.exports = parseOptions;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/internal/identifiers.js
var require_identifiers = __commonJS((exports, module) => {
  var numeric = /^[0-9]+$/;
  var compareIdentifiers = (a, b) => {
    if (typeof a === "number" && typeof b === "number") {
      return a === b ? 0 : a < b ? -1 : 1;
    }
    const anum = numeric.test(a);
    const bnum = numeric.test(b);
    if (anum && bnum) {
      a = +a;
      b = +b;
    }
    return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
  };
  var rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
  module.exports = {
    compareIdentifiers,
    rcompareIdentifiers
  };
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/classes/semver.js
var require_semver = __commonJS((exports, module) => {
  var debug2 = require_debug();
  var { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
  var { safeRe: re, t } = require_re();
  var parseOptions = require_parse_options();
  var { compareIdentifiers } = require_identifiers();
  var isPrereleaseIdentifier = (prerelease, identifier) => {
    const identifiers = identifier.split(".");
    if (identifiers.length > prerelease.length) {
      return false;
    }
    for (let i = 0;i < identifiers.length; i++) {
      if (compareIdentifiers(prerelease[i], identifiers[i]) !== 0) {
        return false;
      }
    }
    return true;
  };

  class SemVer {
    constructor(version, options) {
      options = parseOptions(options);
      if (version instanceof SemVer) {
        if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) {
          return version;
        } else {
          version = version.version;
        }
      } else if (typeof version !== "string") {
        throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
      }
      if (version.length > MAX_LENGTH) {
        throw new TypeError(`version is longer than ${MAX_LENGTH} characters`);
      }
      debug2("SemVer", version, options);
      this.options = options;
      this.loose = !!options.loose;
      this.includePrerelease = !!options.includePrerelease;
      const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
      if (!m) {
        throw new TypeError(`Invalid Version: ${version}`);
      }
      this.raw = version;
      this.major = +m[1];
      this.minor = +m[2];
      this.patch = +m[3];
      if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
        throw new TypeError("Invalid major version");
      }
      if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
        throw new TypeError("Invalid minor version");
      }
      if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
        throw new TypeError("Invalid patch version");
      }
      if (!m[4]) {
        this.prerelease = [];
      } else {
        this.prerelease = m[4].split(".").map((id) => {
          if (/^[0-9]+$/.test(id)) {
            const num = +id;
            if (num >= 0 && num < MAX_SAFE_INTEGER) {
              return num;
            }
          }
          return id;
        });
      }
      this.build = m[5] ? m[5].split(".") : [];
      this.format();
    }
    format() {
      this.version = `${this.major}.${this.minor}.${this.patch}`;
      if (this.prerelease.length) {
        this.version += `-${this.prerelease.join(".")}`;
      }
      return this.version;
    }
    toString() {
      return this.version;
    }
    compare(other) {
      debug2("SemVer.compare", this.version, this.options, other);
      if (!(other instanceof SemVer)) {
        if (typeof other === "string" && other === this.version) {
          return 0;
        }
        other = new SemVer(other, this.options);
      }
      if (other.version === this.version) {
        return 0;
      }
      return this.compareMain(other) || this.comparePre(other);
    }
    compareMain(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      if (this.major < other.major) {
        return -1;
      }
      if (this.major > other.major) {
        return 1;
      }
      if (this.minor < other.minor) {
        return -1;
      }
      if (this.minor > other.minor) {
        return 1;
      }
      if (this.patch < other.patch) {
        return -1;
      }
      if (this.patch > other.patch) {
        return 1;
      }
      return 0;
    }
    comparePre(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      if (this.prerelease.length && !other.prerelease.length) {
        return -1;
      } else if (!this.prerelease.length && other.prerelease.length) {
        return 1;
      } else if (!this.prerelease.length && !other.prerelease.length) {
        return 0;
      }
      let i = 0;
      do {
        const a = this.prerelease[i];
        const b = other.prerelease[i];
        debug2("prerelease compare", i, a, b);
        if (a === undefined && b === undefined) {
          return 0;
        } else if (b === undefined) {
          return 1;
        } else if (a === undefined) {
          return -1;
        } else if (a === b) {
          continue;
        } else {
          return compareIdentifiers(a, b);
        }
      } while (++i);
    }
    compareBuild(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      let i = 0;
      do {
        const a = this.build[i];
        const b = other.build[i];
        debug2("build compare", i, a, b);
        if (a === undefined && b === undefined) {
          return 0;
        } else if (b === undefined) {
          return 1;
        } else if (a === undefined) {
          return -1;
        } else if (a === b) {
          continue;
        } else {
          return compareIdentifiers(a, b);
        }
      } while (++i);
    }
    inc(release, identifier, identifierBase) {
      if (release.startsWith("pre")) {
        if (!identifier && identifierBase === false) {
          throw new Error("invalid increment argument: identifier is empty");
        }
        if (identifier) {
          const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
          if (!match || match[1] !== identifier) {
            throw new Error(`invalid identifier: ${identifier}`);
          }
        }
      }
      switch (release) {
        case "premajor":
          this.prerelease.length = 0;
          this.patch = 0;
          this.minor = 0;
          this.major++;
          this.inc("pre", identifier, identifierBase);
          break;
        case "preminor":
          this.prerelease.length = 0;
          this.patch = 0;
          this.minor++;
          this.inc("pre", identifier, identifierBase);
          break;
        case "prepatch":
          this.prerelease.length = 0;
          this.inc("patch", identifier, identifierBase);
          this.inc("pre", identifier, identifierBase);
          break;
        case "prerelease":
          if (this.prerelease.length === 0) {
            this.inc("patch", identifier, identifierBase);
          }
          this.inc("pre", identifier, identifierBase);
          break;
        case "release":
          if (this.prerelease.length === 0) {
            throw new Error(`version ${this.raw} is not a prerelease`);
          }
          this.prerelease.length = 0;
          break;
        case "major":
          if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
            this.major++;
          }
          this.minor = 0;
          this.patch = 0;
          this.prerelease = [];
          break;
        case "minor":
          if (this.patch !== 0 || this.prerelease.length === 0) {
            this.minor++;
          }
          this.patch = 0;
          this.prerelease = [];
          break;
        case "patch":
          if (this.prerelease.length === 0) {
            this.patch++;
          }
          this.prerelease = [];
          break;
        case "pre": {
          const base = Number(identifierBase) ? 1 : 0;
          if (this.prerelease.length === 0) {
            this.prerelease = [base];
          } else {
            let i = this.prerelease.length;
            while (--i >= 0) {
              if (typeof this.prerelease[i] === "number") {
                this.prerelease[i]++;
                i = -2;
              }
            }
            if (i === -1) {
              if (identifier === this.prerelease.join(".") && identifierBase === false) {
                throw new Error("invalid increment argument: identifier already exists");
              }
              this.prerelease.push(base);
            }
          }
          if (identifier) {
            let prerelease = [identifier, base];
            if (identifierBase === false) {
              prerelease = [identifier];
            }
            if (isPrereleaseIdentifier(this.prerelease, identifier)) {
              const prereleaseBase = this.prerelease[identifier.split(".").length];
              if (isNaN(prereleaseBase)) {
                this.prerelease = prerelease;
              }
            } else {
              this.prerelease = prerelease;
            }
          }
          break;
        }
        default:
          throw new Error(`invalid increment argument: ${release}`);
      }
      this.raw = this.format();
      if (this.build.length) {
        this.raw += `+${this.build.join(".")}`;
      }
      return this;
    }
  }
  module.exports = SemVer;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/parse.js
var require_parse = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var parse = (version, options, throwErrors = false) => {
    if (version instanceof SemVer) {
      return version;
    }
    try {
      return new SemVer(version, options);
    } catch (er) {
      if (!throwErrors) {
        return null;
      }
      throw er;
    }
  };
  module.exports = parse;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/valid.js
var require_valid = __commonJS((exports, module) => {
  var parse = require_parse();
  var valid = (version, options) => {
    const v = parse(version, options);
    return v ? v.version : null;
  };
  module.exports = valid;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/clean.js
var require_clean = __commonJS((exports, module) => {
  var parse = require_parse();
  var clean = (version, options) => {
    const s = parse(version.trim().replace(/^[=v]+/, ""), options);
    return s ? s.version : null;
  };
  module.exports = clean;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/inc.js
var require_inc = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var inc = (version, release, options, identifier, identifierBase) => {
    if (typeof options === "string") {
      identifierBase = identifier;
      identifier = options;
      options = undefined;
    }
    try {
      return new SemVer(version instanceof SemVer ? version.version : version, options).inc(release, identifier, identifierBase).version;
    } catch (er) {
      return null;
    }
  };
  module.exports = inc;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/diff.js
var require_diff = __commonJS((exports, module) => {
  var parse = require_parse();
  var diff = (version1, version2) => {
    const v1 = parse(version1, null, true);
    const v2 = parse(version2, null, true);
    const comparison = v1.compare(v2);
    if (comparison === 0) {
      return null;
    }
    const v1Higher = comparison > 0;
    const highVersion = v1Higher ? v1 : v2;
    const lowVersion = v1Higher ? v2 : v1;
    const highHasPre = !!highVersion.prerelease.length;
    const lowHasPre = !!lowVersion.prerelease.length;
    if (lowHasPre && !highHasPre) {
      if (!lowVersion.patch && !lowVersion.minor) {
        return "major";
      }
      if (lowVersion.compareMain(highVersion) === 0) {
        if (lowVersion.minor && !lowVersion.patch) {
          return "minor";
        }
        return "patch";
      }
    }
    const prefix = highHasPre ? "pre" : "";
    if (v1.major !== v2.major) {
      return prefix + "major";
    }
    if (v1.minor !== v2.minor) {
      return prefix + "minor";
    }
    if (v1.patch !== v2.patch) {
      return prefix + "patch";
    }
    return "prerelease";
  };
  module.exports = diff;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/major.js
var require_major = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var major = (a, loose) => new SemVer(a, loose).major;
  module.exports = major;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/minor.js
var require_minor = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var minor = (a, loose) => new SemVer(a, loose).minor;
  module.exports = minor;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/patch.js
var require_patch = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var patch = (a, loose) => new SemVer(a, loose).patch;
  module.exports = patch;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/prerelease.js
var require_prerelease = __commonJS((exports, module) => {
  var parse = require_parse();
  var prerelease = (version, options) => {
    const parsed = parse(version, options);
    return parsed && parsed.prerelease.length ? parsed.prerelease : null;
  };
  module.exports = prerelease;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/compare.js
var require_compare = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
  module.exports = compare;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/rcompare.js
var require_rcompare = __commonJS((exports, module) => {
  var compare = require_compare();
  var rcompare = (a, b, loose) => compare(b, a, loose);
  module.exports = rcompare;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/compare-loose.js
var require_compare_loose = __commonJS((exports, module) => {
  var compare = require_compare();
  var compareLoose = (a, b) => compare(a, b, true);
  module.exports = compareLoose;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/compare-build.js
var require_compare_build = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var compareBuild = (a, b, loose) => {
    const versionA = new SemVer(a, loose);
    const versionB = new SemVer(b, loose);
    return versionA.compare(versionB) || versionA.compareBuild(versionB);
  };
  module.exports = compareBuild;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/sort.js
var require_sort = __commonJS((exports, module) => {
  var compareBuild = require_compare_build();
  var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
  module.exports = sort;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/rsort.js
var require_rsort = __commonJS((exports, module) => {
  var compareBuild = require_compare_build();
  var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
  module.exports = rsort;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/gt.js
var require_gt = __commonJS((exports, module) => {
  var compare = require_compare();
  var gt = (a, b, loose) => compare(a, b, loose) > 0;
  module.exports = gt;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/lt.js
var require_lt = __commonJS((exports, module) => {
  var compare = require_compare();
  var lt = (a, b, loose) => compare(a, b, loose) < 0;
  module.exports = lt;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/eq.js
var require_eq = __commonJS((exports, module) => {
  var compare = require_compare();
  var eq = (a, b, loose) => compare(a, b, loose) === 0;
  module.exports = eq;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/neq.js
var require_neq = __commonJS((exports, module) => {
  var compare = require_compare();
  var neq = (a, b, loose) => compare(a, b, loose) !== 0;
  module.exports = neq;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/gte.js
var require_gte = __commonJS((exports, module) => {
  var compare = require_compare();
  var gte = (a, b, loose) => compare(a, b, loose) >= 0;
  module.exports = gte;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/lte.js
var require_lte = __commonJS((exports, module) => {
  var compare = require_compare();
  var lte = (a, b, loose) => compare(a, b, loose) <= 0;
  module.exports = lte;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/cmp.js
var require_cmp = __commonJS((exports, module) => {
  var eq = require_eq();
  var neq = require_neq();
  var gt = require_gt();
  var gte = require_gte();
  var lt = require_lt();
  var lte = require_lte();
  var cmp = (a, op, b, loose) => {
    switch (op) {
      case "===":
        if (typeof a === "object") {
          a = a.version;
        }
        if (typeof b === "object") {
          b = b.version;
        }
        return a === b;
      case "!==":
        if (typeof a === "object") {
          a = a.version;
        }
        if (typeof b === "object") {
          b = b.version;
        }
        return a !== b;
      case "":
      case "=":
      case "==":
        return eq(a, b, loose);
      case "!=":
        return neq(a, b, loose);
      case ">":
        return gt(a, b, loose);
      case ">=":
        return gte(a, b, loose);
      case "<":
        return lt(a, b, loose);
      case "<=":
        return lte(a, b, loose);
      default:
        throw new TypeError(`Invalid operator: ${op}`);
    }
  };
  module.exports = cmp;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/coerce.js
var require_coerce = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var parse = require_parse();
  var { safeRe: re, t } = require_re();
  var coerce = (version, options) => {
    if (version instanceof SemVer) {
      return version;
    }
    if (typeof version === "number") {
      version = String(version);
    }
    if (typeof version !== "string") {
      return null;
    }
    options = options || {};
    let match = null;
    if (!options.rtl) {
      match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
    } else {
      const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
      let next;
      while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
        if (!match || next.index + next[0].length !== match.index + match[0].length) {
          match = next;
        }
        coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
      }
      coerceRtlRegex.lastIndex = -1;
    }
    if (match === null) {
      return null;
    }
    const major = match[2];
    const minor = match[3] || "0";
    const patch = match[4] || "0";
    const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : "";
    const build = options.includePrerelease && match[6] ? `+${match[6]}` : "";
    return parse(`${major}.${minor}.${patch}${prerelease}${build}`, options);
  };
  module.exports = coerce;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/truncate.js
var require_truncate = __commonJS((exports, module) => {
  var parse = require_parse();
  var constants3 = require_constants();
  var SemVer = require_semver();
  var truncate = (version, truncation, options) => {
    if (!constants3.RELEASE_TYPES.includes(truncation)) {
      return null;
    }
    const clonedVersion = cloneInputVersion(version, options);
    return clonedVersion && doTruncation(clonedVersion, truncation);
  };
  var cloneInputVersion = (version, options) => {
    const versionStringToParse = version instanceof SemVer ? version.version : version;
    return parse(versionStringToParse, options);
  };
  var doTruncation = (version, truncation) => {
    if (isPrerelease(truncation)) {
      return version.version;
    }
    version.prerelease = [];
    switch (truncation) {
      case "major":
        version.minor = 0;
        version.patch = 0;
        break;
      case "minor":
        version.patch = 0;
        break;
    }
    return version.format();
  };
  var isPrerelease = (type) => {
    return type.startsWith("pre");
  };
  module.exports = truncate;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/internal/lrucache.js
var require_lrucache = __commonJS((exports, module) => {
  class LRUCache {
    constructor() {
      this.max = 1000;
      this.map = new Map;
    }
    get(key) {
      const value = this.map.get(key);
      if (value === undefined) {
        return;
      } else {
        this.map.delete(key);
        this.map.set(key, value);
        return value;
      }
    }
    delete(key) {
      return this.map.delete(key);
    }
    set(key, value) {
      const deleted = this.delete(key);
      if (!deleted && value !== undefined) {
        if (this.map.size >= this.max) {
          const firstKey = this.map.keys().next().value;
          this.delete(firstKey);
        }
        this.map.set(key, value);
      }
      return this;
    }
  }
  module.exports = LRUCache;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/internal/trim-comparator-whitespace.js
var require_trim_comparator_whitespace = __commonJS((exports, module) => {
  var {
    MAX_LENGTH,
    MAX_SAFE_BUILD_LENGTH,
    WHITESPACE_CHARACTERS
  } = require_constants();
  var whitespace = new Uint8Array(65536);
  for (const char of WHITESPACE_CHARACTERS) {
    whitespace[char.charCodeAt(0)] = 1;
  }
  var isWhitespace = (char) => char !== undefined && whitespace[char.charCodeAt(0)] === 1;
  var isVersionPrefix = (char) => char === "v" || char === "=" || isWhitespace(char);
  var isDigit = (char) => char !== undefined && char >= "0" && char <= "9";
  var isLetter = (char) => char !== undefined && (char >= "a" && char <= "z" || char >= "A" && char <= "Z");
  var isIdentifierCharacter = (char) => isDigit(char) || isLetter(char) || char === "-";
  var isVersionStart = (char) => isDigit(char) || char === "x" || char === "X" || char === "*";
  var findDigitsEndIndex = (range, start, limit, digitRuns) => {
    if (!isDigit(range[start])) {
      return start;
    }
    if (start >= digitRuns.start && start < digitRuns.end) {
      return Math.min(start + limit, digitRuns.end);
    }
    if (start >= digitRuns.previousStart && start < digitRuns.previousEnd) {
      return Math.min(start + limit, digitRuns.previousEnd);
    }
    let end = start + 1;
    while (isDigit(range[end])) {
      end++;
    }
    digitRuns.previousStart = digitRuns.start;
    digitRuns.previousEnd = digitRuns.end;
    digitRuns.start = start;
    digitRuns.end = end;
    return Math.min(start + limit, end);
  };
  var findVersionNumberEndIndex = (range, start, loose, digitRuns) => {
    if (!loose && range[start] === "0") {
      return start + 1;
    }
    return findDigitsEndIndex(range, start, loose ? MAX_LENGTH : MAX_LENGTH + 1, digitRuns);
  };
  var findPrereleaseIdentifierEndIndex = (range, start, loose, digitRuns) => {
    const digitsEnd = findDigitsEndIndex(range, start, MAX_LENGTH, digitRuns);
    if (isLetter(range[digitsEnd]) || range[digitsEnd] === "-") {
      let end = digitsEnd + 1;
      const limit = end + MAX_SAFE_BUILD_LENGTH;
      while (end < limit && isIdentifierCharacter(range[end])) {
        end++;
      }
      return end;
    }
    return findVersionNumberEndIndex(range, start, loose, digitRuns);
  };
  var findPrereleaseEndIndex = (range, start, loose, digitRuns) => {
    const hyphen = range[start] === "-";
    if (!loose && !hyphen) {
      return start;
    }
    const identifierStart = start + (hyphen ? 1 : 0);
    let end = findPrereleaseIdentifierEndIndex(range, identifierStart, loose, digitRuns);
    if (end === identifierStart) {
      if (!loose || !hyphen) {
        return start;
      }
      end = findPrereleaseIdentifierEndIndex(range, start, loose, digitRuns);
    }
    while (range[end] === ".") {
      const next = findPrereleaseIdentifierEndIndex(range, end + 1, loose, digitRuns);
      if (next === end + 1) {
        break;
      }
      end = next;
    }
    return end;
  };
  var findBuildIdentifierEndIndex = (range, start) => {
    let end = start;
    while (end - start < MAX_SAFE_BUILD_LENGTH && isIdentifierCharacter(range[end])) {
      end++;
    }
    return end;
  };
  var findBuildEndIndex = (range, start) => {
    if (range[start] !== "+") {
      return start;
    }
    let end = findBuildIdentifierEndIndex(range, start + 1);
    if (end === start + 1) {
      return start;
    }
    while (range[end] === ".") {
      const next = findBuildIdentifierEndIndex(range, end + 1);
      if (next === end + 1) {
        break;
      }
      end = next;
    }
    return end;
  };
  var findLooseFullVersionEndIndex = (range, start, digitRuns) => {
    let end = start;
    for (let component = 0;component < 3; component++) {
      const next = findVersionNumberEndIndex(range, end, true, digitRuns);
      if (next === end) {
        return start;
      }
      end = next;
      if (component < 2) {
        if (range[end] !== ".") {
          return start;
        }
        end++;
      }
    }
    const prereleaseEnd = findPrereleaseEndIndex(range, end, true, digitRuns);
    return findBuildEndIndex(range, prereleaseEnd);
  };
  var findPartialVersionComponentEndIndex = (range, start, digitRuns) => {
    if (isDigit(range[start])) {
      return findVersionNumberEndIndex(range, start, false, digitRuns);
    }
    return isVersionStart(range[start]) ? start + 1 : start;
  };
  var findPartialVersionEndIndex = (range, start, digitRuns) => {
    let end = findPartialVersionComponentEndIndex(range, start, digitRuns);
    for (let component = 0;component < 2; component++) {
      if (range[end] !== ".") {
        return end;
      }
      const next = findPartialVersionComponentEndIndex(range, end + 1, digitRuns);
      if (next === end + 1) {
        return end;
      }
      end = next;
    }
    const prereleaseEnd = findPrereleaseEndIndex(range, end, false, digitRuns);
    return findBuildEndIndex(range, prereleaseEnd);
  };
  var findVersionEndIndex = (range, start, digitRuns) => {
    const fullVersionEnd = findLooseFullVersionEndIndex(range, start, digitRuns);
    return fullVersionEnd !== start ? fullVersionEnd : findPartialVersionEndIndex(range, start, digitRuns);
  };
  var findRemovableWhitespaceIndex = (range, matchStart) => {
    let position = matchStart;
    if (isWhitespace(range[position])) {
      position++;
    }
    if (range[position] === "<" || range[position] === ">") {
      position++;
    }
    if (range[position] === "=") {
      position++;
    }
    return isWhitespace(range[position]) ? position : -1;
  };
  var trimComparatorWhitespace = (range) => {
    let result = "";
    let copyFrom = 0;
    let cursor = 0;
    const digitRuns = { start: -1, end: -1, previousStart: -1, previousEnd: -1 };
    while (cursor < range.length) {
      const matchStart = cursor;
      if (range[cursor] === "<" || range[cursor] === ">") {
        cursor++;
      } else if (!isVersionPrefix(range[cursor]) && !isVersionStart(range[cursor])) {
        cursor++;
        continue;
      }
      while (cursor < range.length && isVersionPrefix(range[cursor])) {
        cursor++;
      }
      if (!isVersionStart(range[cursor])) {
        continue;
      }
      const whitespacePosition = findRemovableWhitespaceIndex(range, matchStart);
      if (whitespacePosition !== -1) {
        result += range.slice(copyFrom, whitespacePosition);
        copyFrom = whitespacePosition + 1;
      }
      cursor = findVersionEndIndex(range, cursor, digitRuns);
    }
    return result + range.slice(copyFrom);
  };
  module.exports = trimComparatorWhitespace;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/classes/range.js
var require_range = __commonJS((exports, module) => {
  var SPACE_CHARACTERS = /\s+/g;

  class Range {
    constructor(range, options) {
      options = parseOptions(options);
      if (range instanceof Range) {
        if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) {
          return range;
        } else {
          return new Range(range.raw, options);
        }
      }
      if (range instanceof Comparator) {
        this.raw = range.value;
        this.set = [[range]];
        this.formatted = undefined;
        return this;
      }
      this.options = options;
      this.loose = !!options.loose;
      this.includePrerelease = !!options.includePrerelease;
      this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
      this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
      if (!this.set.length) {
        throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
      }
      if (this.set.length > 1) {
        const first = this.set[0];
        this.set = this.set.filter((c) => !isNullSet(c[0]));
        if (this.set.length === 0) {
          this.set = [first];
        } else if (this.set.length > 1) {
          for (const c of this.set) {
            if (c.length === 1 && isAny(c[0])) {
              this.set = [c];
              break;
            }
          }
        }
      }
      this.formatted = undefined;
    }
    get range() {
      if (this.formatted === undefined) {
        this.formatted = "";
        for (let i = 0;i < this.set.length; i++) {
          if (i > 0) {
            this.formatted += "||";
          }
          const comps = this.set[i];
          for (let k = 0;k < comps.length; k++) {
            if (k > 0) {
              this.formatted += " ";
            }
            this.formatted += comps[k].toString().trim();
          }
        }
      }
      return this.formatted;
    }
    format() {
      return this.range;
    }
    toString() {
      return this.range;
    }
    parseRange(range) {
      range = range.replace(BUILDSTRIPRE, "");
      const memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
      const memoKey = memoOpts + ":" + range;
      const cached = cache.get(memoKey);
      if (cached) {
        return cached;
      }
      const loose = this.options.loose;
      const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
      range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
      debug2("hyphen replace", range);
      range = trimComparatorWhitespace(range);
      debug2("comparator trim", range);
      range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
      debug2("tilde trim", range);
      range = range.replace(re[t.CARETTRIM], caretTrimReplace);
      debug2("caret trim", range);
      let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
      if (loose) {
        rangeList = rangeList.filter((comp) => {
          debug2("loose invalid filter", comp, this.options);
          return !!comp.match(re[t.COMPARATORLOOSE]);
        });
      }
      debug2("range list", rangeList);
      const rangeMap = new Map;
      const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
      for (const comp of comparators) {
        if (isNullSet(comp)) {
          return [comp];
        }
        rangeMap.set(comp.value, comp);
      }
      if (rangeMap.size > 1 && rangeMap.has("")) {
        rangeMap.delete("");
      }
      const result = [...rangeMap.values()];
      cache.set(memoKey, result);
      return result;
    }
    intersects(range, options) {
      if (!(range instanceof Range)) {
        throw new TypeError("a Range is required");
      }
      return this.set.some((thisComparators) => {
        return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
          return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
            return rangeComparators.every((rangeComparator) => {
              return thisComparator.intersects(rangeComparator, options);
            });
          });
        });
      });
    }
    test(version) {
      if (!version) {
        return false;
      }
      if (typeof version === "string") {
        try {
          version = new SemVer(version, this.options);
        } catch (er) {
          return false;
        }
      }
      for (let i = 0;i < this.set.length; i++) {
        if (testSet(this.set[i], version, this.options)) {
          return true;
        }
      }
      return false;
    }
  }
  module.exports = Range;
  var LRU = require_lrucache();
  var cache = new LRU;
  var parseOptions = require_parse_options();
  var Comparator = require_comparator();
  var debug2 = require_debug();
  var SemVer = require_semver();
  var trimComparatorWhitespace = require_trim_comparator_whitespace();
  var {
    safeRe: re,
    src,
    t,
    tildeTrimReplace,
    caretTrimReplace
  } = require_re();
  var { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
  var BUILDSTRIPRE = new RegExp(src[t.BUILD], "g");
  var isNullSet = (c) => c.value === "<0.0.0-0";
  var isAny = (c) => c.value === "";
  var isSatisfiable = (comparators, options) => {
    let result = true;
    const remainingComparators = comparators.slice();
    let testComparator = remainingComparators.pop();
    while (result && remainingComparators.length) {
      result = remainingComparators.every((otherComparator) => {
        return testComparator.intersects(otherComparator, options);
      });
      testComparator = remainingComparators.pop();
    }
    return result;
  };
  var parseComparator = (comp, options) => {
    comp = comp.replace(re[t.BUILD], "");
    debug2("comp", comp, options);
    comp = replaceCarets(comp, options);
    debug2("caret", comp);
    comp = replaceTildes(comp, options);
    debug2("tildes", comp);
    comp = replaceXRanges(comp, options);
    debug2("xrange", comp);
    comp = replaceStars(comp, options);
    debug2("stars", comp);
    return comp;
  };
  var isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
  var invalidXRangeOrder = (M, m, p) => isX(M) && !isX(m) || isX(m) && p && !isX(p);
  var replaceTildes = (comp, options) => {
    return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
  };
  var replaceTilde = (comp, options) => {
    const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
    const z = options.includePrerelease ? "-0" : "";
    return comp.replace(r, (_, M, m, p, pr) => {
      debug2("tilde", comp, _, M, m, p, pr);
      let ret;
      if (isX(M)) {
        ret = "";
      } else if (isX(m)) {
        ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
      } else if (isX(p)) {
        ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
      } else if (pr) {
        debug2("replaceTilde pr", pr);
        ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
      } else {
        ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
      }
      debug2("tilde return", ret);
      return ret;
    });
  };
  var replaceCarets = (comp, options) => {
    return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
  };
  var replaceCaret = (comp, options) => {
    debug2("caret", comp, options);
    const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
    const z = options.includePrerelease ? "-0" : "";
    return comp.replace(r, (_, M, m, p, pr) => {
      debug2("caret", comp, _, M, m, p, pr);
      let ret;
      if (isX(M)) {
        ret = "";
      } else if (isX(m)) {
        ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
      } else if (isX(p)) {
        if (M === "0") {
          ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
        }
      } else if (pr) {
        debug2("replaceCaret pr", pr);
        if (M === "0") {
          if (m === "0") {
            ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
          } else {
            ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
          }
        } else {
          ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
        }
      } else {
        debug2("no pr");
        if (M === "0") {
          if (m === "0") {
            ret = `>=${M}.${m}.${p} <${M}.${m}.${+p + 1}-0`;
          } else {
            ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
          }
        } else {
          ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
        }
      }
      debug2("caret return", ret);
      return ret;
    });
  };
  var replaceXRanges = (comp, options) => {
    debug2("replaceXRanges", comp, options);
    return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
  };
  var replaceXRange = (comp, options) => {
    comp = comp.trim();
    const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
    return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
      debug2("xRange", comp, ret, gtlt, M, m, p, pr);
      if (invalidXRangeOrder(M, m, p)) {
        return comp;
      }
      const xM = isX(M);
      const xm = xM || isX(m);
      const xp = xm || isX(p);
      const anyX = xp;
      if (gtlt === "=" && anyX) {
        gtlt = "";
      }
      pr = options.includePrerelease ? "-0" : "";
      if (xM) {
        if (gtlt === ">" || gtlt === "<") {
          ret = "<0.0.0-0";
        } else {
          ret = "*";
        }
      } else if (gtlt && anyX) {
        if (xm) {
          m = 0;
        }
        p = 0;
        if (gtlt === ">") {
          gtlt = ">=";
          if (xm) {
            M = +M + 1;
            m = 0;
            p = 0;
          } else {
            m = +m + 1;
            p = 0;
          }
        } else if (gtlt === "<=") {
          gtlt = "<";
          if (xm) {
            M = +M + 1;
          } else {
            m = +m + 1;
          }
        }
        if (gtlt === "<") {
          pr = "-0";
        }
        ret = `${gtlt + M}.${m}.${p}${pr}`;
      } else if (xm) {
        ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
      } else if (xp) {
        ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
      }
      debug2("xRange return", ret);
      return ret;
    });
  };
  var replaceStars = (comp, options) => {
    debug2("replaceStars", comp, options);
    return comp.trim().replace(re[t.STAR], "");
  };
  var replaceGTE0 = (comp, options) => {
    debug2("replaceGTE0", comp, options);
    return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
  };
  var hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
    if (isX(fM)) {
      from = "";
    } else if (isX(fm)) {
      from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
    } else if (isX(fp)) {
      from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
    } else if (fpr) {
      from = `>=${from}`;
    } else {
      from = `>=${from}${incPr ? "-0" : ""}`;
    }
    if (isX(tM)) {
      to = "";
    } else if (isX(tm)) {
      to = `<${+tM + 1}.0.0-0`;
    } else if (isX(tp)) {
      to = `<${tM}.${+tm + 1}.0-0`;
    } else if (tpr) {
      to = `<=${tM}.${tm}.${tp}-${tpr}`;
    } else if (incPr) {
      to = `<${tM}.${tm}.${+tp + 1}-0`;
    } else {
      to = `<=${to}`;
    }
    return `${from} ${to}`.trim();
  };
  var testSet = (set, version, options) => {
    for (let i = 0;i < set.length; i++) {
      if (!set[i].test(version)) {
        return false;
      }
    }
    if (version.prerelease.length && !options.includePrerelease) {
      for (let i = 0;i < set.length; i++) {
        debug2(set[i].semver);
        if (set[i].semver === Comparator.ANY) {
          continue;
        }
        if (set[i].semver.prerelease.length > 0) {
          const allowed = set[i].semver;
          if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
            return true;
          }
        }
      }
      return false;
    }
    return true;
  };
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/classes/comparator.js
var require_comparator = __commonJS((exports, module) => {
  var ANY = Symbol("SemVer ANY");

  class Comparator {
    static get ANY() {
      return ANY;
    }
    constructor(comp, options) {
      options = parseOptions(options);
      if (comp instanceof Comparator) {
        if (comp.loose === !!options.loose) {
          return comp;
        } else {
          comp = comp.value;
        }
      }
      comp = comp.trim().split(/\s+/).join(" ");
      debug2("comparator", comp, options);
      this.options = options;
      this.loose = !!options.loose;
      this.parse(comp);
      if (this.semver === ANY) {
        this.value = "";
      } else {
        this.value = this.operator + this.semver.version;
      }
      debug2("comp", this);
    }
    parse(comp) {
      const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
      const m = comp.match(r);
      if (!m) {
        throw new TypeError(`Invalid comparator: ${comp}`);
      }
      this.operator = m[1] !== undefined ? m[1] : "";
      if (this.operator === "=") {
        this.operator = "";
      }
      if (!m[2]) {
        this.semver = ANY;
      } else {
        this.semver = new SemVer(m[2], this.options.loose);
      }
    }
    toString() {
      return this.value;
    }
    test(version) {
      debug2("Comparator.test", version, this.options.loose);
      if (this.semver === ANY || version === ANY) {
        return true;
      }
      if (typeof version === "string") {
        try {
          version = new SemVer(version, this.options);
        } catch (er) {
          return false;
        }
      }
      return cmp(version, this.operator, this.semver, this.options);
    }
    intersects(comp, options) {
      if (!(comp instanceof Comparator)) {
        throw new TypeError("a Comparator is required");
      }
      if (this.operator === "") {
        if (this.value === "") {
          return true;
        }
        return new Range(comp.value, options).test(this.value);
      } else if (comp.operator === "") {
        if (comp.value === "") {
          return true;
        }
        return new Range(this.value, options).test(comp.semver);
      }
      options = parseOptions(options);
      if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) {
        return false;
      }
      if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) {
        return false;
      }
      if (this.operator.startsWith(">") && comp.operator.startsWith(">")) {
        return true;
      }
      if (this.operator.startsWith("<") && comp.operator.startsWith("<")) {
        return true;
      }
      if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) {
        return true;
      }
      if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) {
        return true;
      }
      if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) {
        return true;
      }
      return false;
    }
  }
  module.exports = Comparator;
  var parseOptions = require_parse_options();
  var { safeRe: re, t } = require_re();
  var cmp = require_cmp();
  var debug2 = require_debug();
  var SemVer = require_semver();
  var Range = require_range();
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/functions/satisfies.js
var require_satisfies = __commonJS((exports, module) => {
  var Range = require_range();
  var satisfies = (version, range, options) => {
    try {
      range = new Range(range, options);
    } catch (er) {
      return false;
    }
    return range.test(version);
  };
  module.exports = satisfies;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/ranges/to-comparators.js
var require_to_comparators = __commonJS((exports, module) => {
  var Range = require_range();
  var toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
  module.exports = toComparators;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var Range = require_range();
  var maxSatisfying = (versions, range, options) => {
    let max = null;
    let maxSV = null;
    let rangeObj = null;
    try {
      rangeObj = new Range(range, options);
    } catch (er) {
      return null;
    }
    versions.forEach((v) => {
      if (rangeObj.test(v)) {
        if (!max || maxSV.compare(v) === -1) {
          max = v;
          maxSV = new SemVer(max, options);
        }
      }
    });
    return max;
  };
  module.exports = maxSatisfying;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var Range = require_range();
  var minSatisfying = (versions, range, options) => {
    let min = null;
    let minSV = null;
    let rangeObj = null;
    try {
      rangeObj = new Range(range, options);
    } catch (er) {
      return null;
    }
    versions.forEach((v) => {
      if (rangeObj.test(v)) {
        if (!min || minSV.compare(v) === 1) {
          min = v;
          minSV = new SemVer(min, options);
        }
      }
    });
    return min;
  };
  module.exports = minSatisfying;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/ranges/min-version.js
var require_min_version = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var Range = require_range();
  var gt = require_gt();
  var minVersion = (range, loose) => {
    range = new Range(range, loose);
    let minver = new SemVer("0.0.0");
    if (range.test(minver)) {
      return minver;
    }
    minver = new SemVer("0.0.0-0");
    if (range.test(minver)) {
      return minver;
    }
    minver = null;
    for (let i = 0;i < range.set.length; ++i) {
      const comparators = range.set[i];
      let setMin = null;
      comparators.forEach((comparator) => {
        const compver = new SemVer(comparator.semver.version);
        switch (comparator.operator) {
          case ">":
            if (compver.prerelease.length === 0) {
              compver.patch++;
            } else {
              compver.prerelease.push(0);
            }
            compver.raw = compver.format();
          case "":
          case ">=":
            if (!setMin || gt(compver, setMin)) {
              setMin = compver;
            }
            break;
          case "<":
          case "<=":
            break;
          default:
            throw new Error(`Unexpected operation: ${comparator.operator}`);
        }
      });
      if (setMin && (!minver || gt(minver, setMin))) {
        minver = setMin;
      }
    }
    if (minver && range.test(minver)) {
      return minver;
    }
    return null;
  };
  module.exports = minVersion;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/ranges/valid.js
var require_valid2 = __commonJS((exports, module) => {
  var Range = require_range();
  var validRange = (range, options) => {
    try {
      return new Range(range, options).range || "*";
    } catch (er) {
      return null;
    }
  };
  module.exports = validRange;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/ranges/outside.js
var require_outside = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var Comparator = require_comparator();
  var { ANY } = Comparator;
  var Range = require_range();
  var satisfies = require_satisfies();
  var gt = require_gt();
  var lt = require_lt();
  var lte = require_lte();
  var gte = require_gte();
  var outside = (version, range, hilo, options) => {
    version = new SemVer(version, options);
    range = new Range(range, options);
    let gtfn, ltefn, ltfn, comp, ecomp;
    switch (hilo) {
      case ">":
        gtfn = gt;
        ltefn = lte;
        ltfn = lt;
        comp = ">";
        ecomp = ">=";
        break;
      case "<":
        gtfn = lt;
        ltefn = gte;
        ltfn = gt;
        comp = "<";
        ecomp = "<=";
        break;
      default:
        throw new TypeError('Must provide a hilo val of "<" or ">"');
    }
    if (satisfies(version, range, options)) {
      return false;
    }
    for (let i = 0;i < range.set.length; ++i) {
      const comparators = range.set[i];
      let high = null;
      let low = null;
      comparators.forEach((comparator) => {
        if (comparator.semver === ANY) {
          comparator = new Comparator(">=0.0.0");
        }
        high = high || comparator;
        low = low || comparator;
        if (gtfn(comparator.semver, high.semver, options)) {
          high = comparator;
        } else if (ltfn(comparator.semver, low.semver, options)) {
          low = comparator;
        }
      });
      if (high.operator === comp || high.operator === ecomp) {
        return false;
      }
      if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
        return false;
      } else if (low.operator === ecomp && ltfn(version, low.semver)) {
        return false;
      }
    }
    return true;
  };
  module.exports = outside;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/ranges/gtr.js
var require_gtr = __commonJS((exports, module) => {
  var outside = require_outside();
  var gtr = (version, range, options) => outside(version, range, ">", options);
  module.exports = gtr;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/ranges/ltr.js
var require_ltr = __commonJS((exports, module) => {
  var outside = require_outside();
  var ltr = (version, range, options) => outside(version, range, "<", options);
  module.exports = ltr;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/ranges/intersects.js
var require_intersects = __commonJS((exports, module) => {
  var Range = require_range();
  var intersects = (r1, r2, options) => {
    r1 = new Range(r1, options);
    r2 = new Range(r2, options);
    return r1.intersects(r2, options);
  };
  module.exports = intersects;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/ranges/simplify.js
var require_simplify = __commonJS((exports, module) => {
  var satisfies = require_satisfies();
  var compare = require_compare();
  module.exports = (versions, range, options) => {
    const set = [];
    let first = null;
    let prev = null;
    const v = versions.sort((a, b) => compare(a, b, options));
    for (const version of v) {
      const included = satisfies(version, range, options);
      if (included) {
        prev = version;
        if (!first) {
          first = version;
        }
      } else {
        if (prev) {
          set.push([first, prev]);
        }
        prev = null;
        first = null;
      }
    }
    if (first) {
      set.push([first, null]);
    }
    const ranges = [];
    for (const [min, max] of set) {
      if (min === max) {
        ranges.push(min);
      } else if (!max && min === v[0]) {
        ranges.push("*");
      } else if (!max) {
        ranges.push(`>=${min}`);
      } else if (min === v[0]) {
        ranges.push(`<=${max}`);
      } else {
        ranges.push(`${min} - ${max}`);
      }
    }
    const simplified = ranges.join(" || ");
    const original = typeof range.raw === "string" ? range.raw : String(range);
    return simplified.length < original.length ? simplified : range;
  };
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/ranges/subset.js
var require_subset = __commonJS((exports, module) => {
  var Range = require_range();
  var Comparator = require_comparator();
  var { ANY } = Comparator;
  var satisfies = require_satisfies();
  var compare = require_compare();
  var subset = (sub, dom, options = {}) => {
    if (sub === dom) {
      return true;
    }
    sub = new Range(sub, options);
    dom = new Range(dom, options);
    let sawNonNull = false;
    OUTER:
      for (const simpleSub of sub.set) {
        for (const simpleDom of dom.set) {
          const isSub = simpleSubset(simpleSub, simpleDom, options);
          sawNonNull = sawNonNull || isSub !== null;
          if (isSub) {
            continue OUTER;
          }
        }
        if (sawNonNull) {
          return false;
        }
      }
    return true;
  };
  var minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
  var minimumVersion = [new Comparator(">=0.0.0")];
  var simpleSubset = (sub, dom, options) => {
    if (sub === dom) {
      return true;
    }
    if (sub.length === 1 && sub[0].semver === ANY) {
      if (dom.length === 1 && dom[0].semver === ANY) {
        return true;
      } else if (options.includePrerelease) {
        sub = minimumVersionWithPreRelease;
      } else {
        sub = minimumVersion;
      }
    }
    if (dom.length === 1 && dom[0].semver === ANY) {
      if (options.includePrerelease) {
        return true;
      } else {
        dom = minimumVersion;
      }
    }
    const eqSet = new Set;
    let gt, lt;
    for (const c of sub) {
      if (c.operator === ">" || c.operator === ">=") {
        gt = higherGT(gt, c, options);
      } else if (c.operator === "<" || c.operator === "<=") {
        lt = lowerLT(lt, c, options);
      } else {
        eqSet.add(c.semver);
      }
    }
    if (eqSet.size > 1) {
      return null;
    }
    let gtltComp;
    if (gt && lt) {
      gtltComp = compare(gt.semver, lt.semver, options);
      if (gtltComp > 0) {
        return null;
      } else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) {
        return null;
      }
    }
    for (const eq of eqSet) {
      if (gt && !satisfies(eq, String(gt), options)) {
        return null;
      }
      if (lt && !satisfies(eq, String(lt), options)) {
        return null;
      }
      for (const c of dom) {
        if (!satisfies(eq, String(c), options)) {
          return false;
        }
      }
      return true;
    }
    let higher, lower;
    let hasDomLT, hasDomGT;
    let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
    let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
    if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) {
      needDomLTPre = false;
    }
    for (const c of dom) {
      hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
      hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
      if (gt) {
        if (needDomGTPre) {
          if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) {
            needDomGTPre = false;
          }
        }
        if (c.operator === ">" || c.operator === ">=") {
          higher = higherGT(gt, c, options);
          if (higher === c && higher !== gt) {
            return false;
          }
        } else if (gt.operator === ">=" && !c.test(gt.semver)) {
          return false;
        }
      }
      if (lt) {
        if (needDomLTPre) {
          if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) {
            needDomLTPre = false;
          }
        }
        if (c.operator === "<" || c.operator === "<=") {
          lower = lowerLT(lt, c, options);
          if (lower === c && lower !== lt) {
            return false;
          }
        } else if (lt.operator === "<=" && !c.test(lt.semver)) {
          return false;
        }
      }
      if (!c.operator && (lt || gt) && gtltComp !== 0) {
        return false;
      }
    }
    if (gt && hasDomLT && !lt && gtltComp !== 0) {
      return false;
    }
    if (lt && hasDomGT && !gt && gtltComp !== 0) {
      return false;
    }
    if (needDomGTPre || needDomLTPre) {
      return false;
    }
    return true;
  };
  var higherGT = (a, b, options) => {
    if (!a) {
      return b;
    }
    const comp = compare(a.semver, b.semver, options);
    return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
  };
  var lowerLT = (a, b, options) => {
    if (!a) {
      return b;
    }
    const comp = compare(a.semver, b.semver, options);
    return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
  };
  module.exports = subset;
});

// node_modules/.pnpm/semver@7.8.6/node_modules/semver/index.js
var require_semver2 = __commonJS((exports, module) => {
  var internalRe = require_re();
  var constants3 = require_constants();
  var SemVer = require_semver();
  var identifiers = require_identifiers();
  var parse = require_parse();
  var valid = require_valid();
  var clean = require_clean();
  var inc = require_inc();
  var diff = require_diff();
  var major = require_major();
  var minor = require_minor();
  var patch = require_patch();
  var prerelease = require_prerelease();
  var compare = require_compare();
  var rcompare = require_rcompare();
  var compareLoose = require_compare_loose();
  var compareBuild = require_compare_build();
  var sort = require_sort();
  var rsort = require_rsort();
  var gt = require_gt();
  var lt = require_lt();
  var eq = require_eq();
  var neq = require_neq();
  var gte = require_gte();
  var lte = require_lte();
  var cmp = require_cmp();
  var coerce = require_coerce();
  var truncate = require_truncate();
  var Comparator = require_comparator();
  var Range = require_range();
  var satisfies = require_satisfies();
  var toComparators = require_to_comparators();
  var maxSatisfying = require_max_satisfying();
  var minSatisfying = require_min_satisfying();
  var minVersion = require_min_version();
  var validRange = require_valid2();
  var outside = require_outside();
  var gtr = require_gtr();
  var ltr = require_ltr();
  var intersects = require_intersects();
  var simplifyRange = require_simplify();
  var subset = require_subset();
  module.exports = {
    parse,
    valid,
    clean,
    inc,
    diff,
    major,
    minor,
    patch,
    prerelease,
    compare,
    rcompare,
    compareLoose,
    compareBuild,
    sort,
    rsort,
    gt,
    lt,
    eq,
    neq,
    gte,
    lte,
    cmp,
    coerce,
    truncate,
    Comparator,
    Range,
    satisfies,
    toComparators,
    maxSatisfying,
    minSatisfying,
    minVersion,
    validRange,
    outside,
    gtr,
    ltr,
    intersects,
    simplifyRange,
    subset,
    SemVer,
    re: internalRe.re,
    src: internalRe.src,
    tokens: internalRe.t,
    SEMVER_SPEC_VERSION: constants3.SEMVER_SPEC_VERSION,
    RELEASE_TYPES: constants3.RELEASE_TYPES,
    compareIdentifiers: identifiers.compareIdentifiers,
    rcompareIdentifiers: identifiers.rcompareIdentifiers
  };
});

// node_modules/.pnpm/@actions+core@3.0.1/node_modules/@actions/core/lib/command.js
import * as os from "os";

// node_modules/.pnpm/@actions+core@3.0.1/node_modules/@actions/core/lib/utils.js
function toCommandValue(input) {
  if (input === null || input === undefined) {
    return "";
  } else if (typeof input === "string" || input instanceof String) {
    return input;
  }
  return JSON.stringify(input);
}
function toCommandProperties(annotationProperties) {
  if (!Object.keys(annotationProperties).length) {
    return {};
  }
  return {
    title: annotationProperties.title,
    file: annotationProperties.file,
    line: annotationProperties.startLine,
    endLine: annotationProperties.endLine,
    col: annotationProperties.startColumn,
    endColumn: annotationProperties.endColumn
  };
}

// node_modules/.pnpm/@actions+core@3.0.1/node_modules/@actions/core/lib/command.js
function issueCommand(command, properties, message) {
  const cmd = new Command(command, properties, message);
  process.stdout.write(cmd.toString() + os.EOL);
}
function issue(name, message = "") {
  issueCommand(name, {}, message);
}
var CMD_STRING = "::";

class Command {
  constructor(command, properties, message) {
    if (!command) {
      command = "missing.command";
    }
    this.command = command;
    this.properties = properties;
    this.message = message;
  }
  toString() {
    let cmdStr = CMD_STRING + this.command;
    if (this.properties && Object.keys(this.properties).length > 0) {
      cmdStr += " ";
      let first = true;
      for (const key in this.properties) {
        if (this.properties.hasOwnProperty(key)) {
          const val = this.properties[key];
          if (val) {
            if (first) {
              first = false;
            } else {
              cmdStr += ",";
            }
            cmdStr += `${key}=${escapeProperty(val)}`;
          }
        }
      }
    }
    cmdStr += `${CMD_STRING}${escapeData(this.message)}`;
    return cmdStr;
  }
}
function escapeData(s) {
  return toCommandValue(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
function escapeProperty(s) {
  return toCommandValue(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A").replace(/:/g, "%3A").replace(/,/g, "%2C");
}

// node_modules/.pnpm/@actions+core@3.0.1/node_modules/@actions/core/lib/file-command.js
import * as crypto from "crypto";
import * as fs from "fs";
import * as os2 from "os";
function issueFileCommand(command, message) {
  const filePath = process.env[`GITHUB_${command}`];
  if (!filePath) {
    throw new Error(`Unable to find environment variable for file command ${command}`);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file at path: ${filePath}`);
  }
  fs.appendFileSync(filePath, `${toCommandValue(message)}${os2.EOL}`, {
    encoding: "utf8"
  });
}
function prepareKeyValueMessage(key, value) {
  const delimiter = `ghadelimiter_${crypto.randomUUID()}`;
  const convertedValue = toCommandValue(value);
  if (key.includes(delimiter)) {
    throw new Error(`Unexpected input: name should not contain the delimiter "${delimiter}"`);
  }
  if (convertedValue.includes(delimiter)) {
    throw new Error(`Unexpected input: value should not contain the delimiter "${delimiter}"`);
  }
  return `${key}<<${delimiter}${os2.EOL}${convertedValue}${os2.EOL}${delimiter}`;
}

// node_modules/.pnpm/@actions+core@3.0.1/node_modules/@actions/core/lib/core.js
import * as os4 from "os";

// node_modules/.pnpm/@actions+http-client@4.0.1/node_modules/@actions/http-client/lib/index.js
var tunnel = __toESM(require_tunnel(), 1);
var HttpCodes;
(function(HttpCodes2) {
  HttpCodes2[HttpCodes2["OK"] = 200] = "OK";
  HttpCodes2[HttpCodes2["MultipleChoices"] = 300] = "MultipleChoices";
  HttpCodes2[HttpCodes2["MovedPermanently"] = 301] = "MovedPermanently";
  HttpCodes2[HttpCodes2["ResourceMoved"] = 302] = "ResourceMoved";
  HttpCodes2[HttpCodes2["SeeOther"] = 303] = "SeeOther";
  HttpCodes2[HttpCodes2["NotModified"] = 304] = "NotModified";
  HttpCodes2[HttpCodes2["UseProxy"] = 305] = "UseProxy";
  HttpCodes2[HttpCodes2["SwitchProxy"] = 306] = "SwitchProxy";
  HttpCodes2[HttpCodes2["TemporaryRedirect"] = 307] = "TemporaryRedirect";
  HttpCodes2[HttpCodes2["PermanentRedirect"] = 308] = "PermanentRedirect";
  HttpCodes2[HttpCodes2["BadRequest"] = 400] = "BadRequest";
  HttpCodes2[HttpCodes2["Unauthorized"] = 401] = "Unauthorized";
  HttpCodes2[HttpCodes2["PaymentRequired"] = 402] = "PaymentRequired";
  HttpCodes2[HttpCodes2["Forbidden"] = 403] = "Forbidden";
  HttpCodes2[HttpCodes2["NotFound"] = 404] = "NotFound";
  HttpCodes2[HttpCodes2["MethodNotAllowed"] = 405] = "MethodNotAllowed";
  HttpCodes2[HttpCodes2["NotAcceptable"] = 406] = "NotAcceptable";
  HttpCodes2[HttpCodes2["ProxyAuthenticationRequired"] = 407] = "ProxyAuthenticationRequired";
  HttpCodes2[HttpCodes2["RequestTimeout"] = 408] = "RequestTimeout";
  HttpCodes2[HttpCodes2["Conflict"] = 409] = "Conflict";
  HttpCodes2[HttpCodes2["Gone"] = 410] = "Gone";
  HttpCodes2[HttpCodes2["TooManyRequests"] = 429] = "TooManyRequests";
  HttpCodes2[HttpCodes2["InternalServerError"] = 500] = "InternalServerError";
  HttpCodes2[HttpCodes2["NotImplemented"] = 501] = "NotImplemented";
  HttpCodes2[HttpCodes2["BadGateway"] = 502] = "BadGateway";
  HttpCodes2[HttpCodes2["ServiceUnavailable"] = 503] = "ServiceUnavailable";
  HttpCodes2[HttpCodes2["GatewayTimeout"] = 504] = "GatewayTimeout";
})(HttpCodes || (HttpCodes = {}));
var Headers;
(function(Headers2) {
  Headers2["Accept"] = "accept";
  Headers2["ContentType"] = "content-type";
})(Headers || (Headers = {}));
var MediaTypes;
(function(MediaTypes2) {
  MediaTypes2["ApplicationJson"] = "application/json";
})(MediaTypes || (MediaTypes = {}));
var HttpRedirectCodes = [
  HttpCodes.MovedPermanently,
  HttpCodes.ResourceMoved,
  HttpCodes.SeeOther,
  HttpCodes.TemporaryRedirect,
  HttpCodes.PermanentRedirect
];
var HttpResponseRetryCodes = [
  HttpCodes.BadGateway,
  HttpCodes.ServiceUnavailable,
  HttpCodes.GatewayTimeout
];

// node_modules/.pnpm/@actions+core@3.0.1/node_modules/@actions/core/lib/summary.js
import { EOL as EOL3 } from "os";
import { constants, promises } from "fs";
var __awaiter = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var { access, appendFile, writeFile } = promises;
var SUMMARY_ENV_VAR = "GITHUB_STEP_SUMMARY";
class Summary {
  constructor() {
    this._buffer = "";
  }
  filePath() {
    return __awaiter(this, undefined, undefined, function* () {
      if (this._filePath) {
        return this._filePath;
      }
      const pathFromEnv = process.env[SUMMARY_ENV_VAR];
      if (!pathFromEnv) {
        throw new Error(`Unable to find environment variable for $${SUMMARY_ENV_VAR}. Check if your runtime environment supports job summaries.`);
      }
      try {
        yield access(pathFromEnv, constants.R_OK | constants.W_OK);
      } catch (_a) {
        throw new Error(`Unable to access summary file: '${pathFromEnv}'. Check if the file has correct read/write permissions.`);
      }
      this._filePath = pathFromEnv;
      return this._filePath;
    });
  }
  wrap(tag, content, attrs = {}) {
    const htmlAttrs = Object.entries(attrs).map(([key, value]) => ` ${key}="${value}"`).join("");
    if (!content) {
      return `<${tag}${htmlAttrs}>`;
    }
    return `<${tag}${htmlAttrs}>${content}</${tag}>`;
  }
  write(options) {
    return __awaiter(this, undefined, undefined, function* () {
      const overwrite = !!(options === null || options === undefined ? undefined : options.overwrite);
      const filePath = yield this.filePath();
      const writeFunc = overwrite ? writeFile : appendFile;
      yield writeFunc(filePath, this._buffer, { encoding: "utf8" });
      return this.emptyBuffer();
    });
  }
  clear() {
    return __awaiter(this, undefined, undefined, function* () {
      return this.emptyBuffer().write({ overwrite: true });
    });
  }
  stringify() {
    return this._buffer;
  }
  isEmptyBuffer() {
    return this._buffer.length === 0;
  }
  emptyBuffer() {
    this._buffer = "";
    return this;
  }
  addRaw(text, addEOL = false) {
    this._buffer += text;
    return addEOL ? this.addEOL() : this;
  }
  addEOL() {
    return this.addRaw(EOL3);
  }
  addCodeBlock(code, lang) {
    const attrs = Object.assign({}, lang && { lang });
    const element = this.wrap("pre", this.wrap("code", code), attrs);
    return this.addRaw(element).addEOL();
  }
  addList(items, ordered = false) {
    const tag = ordered ? "ol" : "ul";
    const listItems = items.map((item) => this.wrap("li", item)).join("");
    const element = this.wrap(tag, listItems);
    return this.addRaw(element).addEOL();
  }
  addTable(rows) {
    const tableBody = rows.map((row) => {
      const cells = row.map((cell) => {
        if (typeof cell === "string") {
          return this.wrap("td", cell);
        }
        const { header, data, colspan, rowspan } = cell;
        const tag = header ? "th" : "td";
        const attrs = Object.assign(Object.assign({}, colspan && { colspan }), rowspan && { rowspan });
        return this.wrap(tag, data, attrs);
      }).join("");
      return this.wrap("tr", cells);
    }).join("");
    const element = this.wrap("table", tableBody);
    return this.addRaw(element).addEOL();
  }
  addDetails(label, content) {
    const element = this.wrap("details", this.wrap("summary", label) + content);
    return this.addRaw(element).addEOL();
  }
  addImage(src, alt, options) {
    const { width, height } = options || {};
    const attrs = Object.assign(Object.assign({}, width && { width }), height && { height });
    const element = this.wrap("img", null, Object.assign({ src, alt }, attrs));
    return this.addRaw(element).addEOL();
  }
  addHeading(text, level) {
    const tag = `h${level}`;
    const allowedTag = ["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag) ? tag : "h1";
    const element = this.wrap(allowedTag, text);
    return this.addRaw(element).addEOL();
  }
  addSeparator() {
    const element = this.wrap("hr", null);
    return this.addRaw(element).addEOL();
  }
  addBreak() {
    const element = this.wrap("br", null);
    return this.addRaw(element).addEOL();
  }
  addQuote(text, cite) {
    const attrs = Object.assign({}, cite && { cite });
    const element = this.wrap("blockquote", text, attrs);
    return this.addRaw(element).addEOL();
  }
  addLink(text, href) {
    const element = this.wrap("a", text, { href });
    return this.addRaw(element).addEOL();
  }
}
var _summary = new Summary;
var summary = _summary;
// node_modules/.pnpm/@actions+core@3.0.1/node_modules/@actions/core/lib/platform.js
import os3 from "os";

// node_modules/.pnpm/@actions+io@3.0.2/node_modules/@actions/io/lib/io-util.js
import * as fs2 from "fs";
var IS_WINDOWS = process.platform === "win32";
var READONLY = fs2.constants.O_RDONLY;

// node_modules/.pnpm/@actions+exec@3.0.0/node_modules/@actions/exec/lib/toolrunner.js
var IS_WINDOWS2 = process.platform === "win32";

// node_modules/.pnpm/@actions+core@3.0.1/node_modules/@actions/core/lib/platform.js
var platform = os3.platform();
var arch = os3.arch();
// node_modules/.pnpm/@actions+core@3.0.1/node_modules/@actions/core/lib/core.js
var ExitCode;
(function(ExitCode2) {
  ExitCode2[ExitCode2["Success"] = 0] = "Success";
  ExitCode2[ExitCode2["Failure"] = 1] = "Failure";
})(ExitCode || (ExitCode = {}));
function setSecret(secret) {
  issueCommand("add-mask", {}, secret);
}
function setOutput(name, value) {
  const filePath = process.env["GITHUB_OUTPUT"] || "";
  if (filePath) {
    return issueFileCommand("OUTPUT", prepareKeyValueMessage(name, value));
  }
  process.stdout.write(os4.EOL);
  issueCommand("set-output", { name }, toCommandValue(value));
}
function setFailed(message) {
  process.exitCode = ExitCode.Failure;
  error(message);
}
function error(message, properties = {}) {
  issueCommand("error", toCommandProperties(properties), message instanceof Error ? message.toString() : message);
}
function warning(message, properties = {}) {
  issueCommand("warning", toCommandProperties(properties), message instanceof Error ? message.toString() : message);
}
function info(message) {
  process.stdout.write(message + os4.EOL);
}
function startGroup(name) {
  issue("group", name);
}
function endGroup() {
  issue("endgroup");
}

// src/docs-sync/index.ts
import { existsSync as existsSync3, rmSync as rmSync3 } from "fs";
import process4 from "process";
import { join as join5 } from "path";

// src/lib/config.ts
var {file } = globalThis.Bun;
import { join } from "path";
var CONFIG_PATH = ".github/nanoforge.json";
var isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var read = (obj, key, where, check, fallback) => {
  const value = obj[key];
  if (value === undefined && fallback !== undefined)
    return fallback;
  if (!check(value))
    throw new Error(`Invalid ${CONFIG_PATH}: ${where}.${key} is missing or invalid`);
  return value;
};
var isString = (value) => typeof value === "string" && value !== "";
var isBoolean = (value) => typeof value === "boolean";
var isStringList = (value) => Array.isArray(value) && value.length > 0 && value.every(isString);
var isOneOf = (...values) => (value) => values.includes(value);
var GROUP_KEYS = [
  "name",
  "packages",
  "mode",
  "versioning",
  "npm",
  "githubRelease",
  "latest",
  "tagFormat",
  "branchFormat",
  "commitFormat",
  "majorTag",
  "betaOnMerge"
];
var DOCS_KEYS = ["group", "category", "references", "referencesPath"];
var assertKnownKeys = (obj, keys, where) => {
  const unknown = Object.keys(obj).filter((key) => !keys.includes(key));
  if (unknown.length)
    throw new Error(`Invalid ${CONFIG_PATH}: unknown key(s) in ${where}: ${unknown.join(", ")}`);
};
var parseGroup = (raw, index) => {
  const where = `groups[${index}]`;
  if (!isObject(raw))
    throw new Error(`Invalid ${CONFIG_PATH}: ${where} must be an object`);
  assertKnownKeys(raw, GROUP_KEYS, where);
  const versioning = read(raw, "versioning", where, isOneOf("shared", "independent"), "shared");
  const shared = versioning === "shared";
  const group = {
    name: read(raw, "name", where, isString),
    packages: read(raw, "packages", where, isStringList),
    mode: read(raw, "mode", where, isOneOf("all", "single", "some"), "all"),
    versioning,
    npm: read(raw, "npm", where, isBoolean, true),
    githubRelease: read(raw, "githubRelease", where, isBoolean, true),
    latest: read(raw, "latest", where, isBoolean, shared),
    tagFormat: read(raw, "tagFormat", where, isString, shared ? "{version}" : "{package}@{version}"),
    branchFormat: read(raw, "branchFormat", where, isString, shared ? "releases/{name}@{version}" : "releases/{name}/{run}"),
    commitFormat: read(raw, "commitFormat", where, isString, shared ? "chore({name}): release {name}@{version}" : "chore({name}): release {packages}"),
    majorTag: read(raw, "majorTag", where, isBoolean, false),
    betaOnMerge: read(raw, "betaOnMerge", where, isBoolean, false)
  };
  const tag = group.tagFormat;
  if (!tag.includes("{version}"))
    throw new Error(`Invalid ${CONFIG_PATH}: ${where}.tagFormat must contain {version}`);
  if (/\{(packages|run)\}/.test(tag))
    throw new Error(`Invalid ${CONFIG_PATH}: ${where}.tagFormat can't use {packages} or {run}`);
  if (!shared && !tag.includes("{package}"))
    throw new Error(`Invalid ${CONFIG_PATH}: ${where}.tagFormat must contain {package} (independent versioning)`);
  if (shared && tag.includes("{package}") && group.mode !== "single" && group.packages.length > 1)
    throw new Error(`Invalid ${CONFIG_PATH}: ${where}.tagFormat can only use {package} in a shared group that releases one package (mode single)`);
  if (!group.branchFormat.startsWith("releases/"))
    throw new Error(`Invalid ${CONFIG_PATH}: ${where}.branchFormat must start with "releases/"`);
  return group;
};
var parseConfig = (raw) => {
  if (!isObject(raw))
    throw new Error(`Invalid ${CONFIG_PATH}: must be an object`);
  assertKnownKeys(raw, ["$schema", "groups", "docs"], "the root");
  if (!Array.isArray(raw.groups) || !raw.groups.length)
    throw new Error(`Invalid ${CONFIG_PATH}: "groups" must be a non-empty list`);
  const groups = raw.groups.map(parseGroup);
  const seen = new Map;
  for (const group of groups) {
    if (groups.filter((other) => other.name === group.name).length > 1)
      throw new Error(`Invalid ${CONFIG_PATH}: group "${group.name}" is defined twice`);
    for (const pkg of group.packages) {
      const owner = seen.get(pkg);
      if (owner)
        throw new Error(`Invalid ${CONFIG_PATH}: ${pkg} is in groups "${owner}" and "${group.name}"`);
      seen.set(pkg, group.name);
    }
  }
  for (const group of groups) {
    const clash = groups.find((other) => other !== group && other.tagFormat === group.tagFormat && !/\{(name|package)\}/.test(group.tagFormat));
    if (clash)
      throw new Error(`Invalid ${CONFIG_PATH}: groups "${group.name}" and "${clash.name}" share the tag format "${group.tagFormat}": add {name} to one of them`);
  }
  if (raw.docs === undefined)
    return { groups };
  if (!isObject(raw.docs))
    throw new Error(`Invalid ${CONFIG_PATH}: docs must be an object`);
  assertKnownKeys(raw.docs, DOCS_KEYS, "docs");
  const docsGroup = read(raw.docs, "group", "docs", isString, groups[0].name);
  const docsOf = groups.find((group) => group.name === docsGroup);
  if (!docsOf)
    throw new Error(`Invalid ${CONFIG_PATH}: docs.group "${docsGroup}" is not a group`);
  if (docsOf.versioning !== "shared")
    throw new Error(`Invalid ${CONFIG_PATH}: docs.group "${docsGroup}" must use shared versioning`);
  return {
    groups,
    docs: {
      group: docsGroup,
      category: read(raw.docs, "category", "docs", isString),
      references: read(raw.docs, "references", "docs", isBoolean, false),
      referencesPath: read(raw.docs, "referencesPath", "docs", isString, "docs/references")
    }
  };
};
var loadConfig = async (root, path = "") => {
  const fullPath = join(root, path || CONFIG_PATH);
  if (!await file(fullPath).exists())
    throw new Error(`No release config at ${fullPath}`);
  return parseConfig(await file(fullPath).json());
};
var selectGroup = (config, name) => {
  if (!name)
    return config.groups[0];
  const group = config.groups.find((candidate) => candidate.name === name);
  if (!group)
    throw new Error(`Unknown group "${name}". Groups: ${config.groups.map((candidate) => candidate.name).join(", ")}`);
  return group;
};
var groupOf = (config, pkg) => config.groups.find((group) => group.packages.includes(pkg));
var selectPackages = (group, requested) => {
  const unknown = requested.filter((pkg) => !group.packages.includes(pkg));
  if (unknown.length)
    throw new Error(`Not in group "${group.name}": ${unknown.join(", ")}. Packages: ${group.packages.join(", ")}`);
  switch (group.mode) {
    case "all":
      if (requested.length && requested.length !== group.packages.length)
        throw new Error(`Group "${group.name}" releases all its packages at once: leave "packages" empty`);
      return group.packages;
    case "single":
      if (requested.length === 1)
        return requested;
      if (!requested.length && group.packages.length === 1)
        return group.packages;
      throw new Error(`Group "${group.name}" releases one package at a time: give exactly one in "packages"`);
    case "some":
      return requested.length ? requested : group.packages;
  }
};

// src/lib/git.ts
var {$ } = globalThis.Bun;
var BOT = [
  "-c",
  "user.name=github-actions[bot]",
  "-c",
  "user.email=41898282+github-actions[bot]@users.noreply.github.com"
];
var checkoutBranch = async (branch, cwd = ".") => {
  await $`git checkout -B ${branch}`.cwd(cwd);
};
var commitAll = async (message, cwd = ".") => {
  await $`git add --all`.cwd(cwd);
  if ((await $`git diff --cached --quiet`.cwd(cwd).nothrow()).exitCode === 0)
    return false;
  await $`git ${BOT} commit -m ${message} --no-verify`.cwd(cwd);
  return true;
};
var authArgs = (token) => {
  if (!token)
    return [];
  const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
  const header = `AUTHORIZATION: basic ${basic}`;
  setSecret(basic);
  setSecret(header);
  return ["-c", `http.https://github.com/.extraheader=${header}`];
};
var push = async (cwd = ".", branch, token) => {
  const auth = authArgs(token);
  if (branch)
    await $`git ${auth} push origin ${`refs/heads/${branch}:refs/heads/${branch}`} --no-verify`.cwd(cwd);
  else
    await $`git ${auth} push --no-verify`.cwd(cwd);
};
var headSha = async () => (await $`git rev-parse HEAD`.text()).trim();
var tagExists = async (tag) => (await $`git rev-parse --verify --quiet ${`refs/tags/${tag}`}`.nothrow().quiet()).exitCode === 0;
var assertCommit = async (ref) => {
  const result = await $`git rev-parse --verify --quiet --end-of-options ${`${ref}^{commit}`}`.nothrow().quiet();
  if (result.exitCode !== 0)
    throw new Error(`"${ref}" is not a commit of this checkout`);
};
var showFile = async (ref, path) => {
  const result = await $`git show --end-of-options ${`${ref}:${path}`}`.nothrow().quiet();
  return result.exitCode === 0 ? result.text() : undefined;
};
var commitMessages = async (from, paths) => {
  const range = from ? `${from}..HEAD` : "HEAD";
  const out = await $`git log ${range} --format=%B%x1e -- ${paths}`.text();
  return out.split("\x1E").map((message) => message.trim()).filter(Boolean);
};
var lastCommitChanging = async (path, pattern) => (await $`git log -1 --format=%H ${`-G${pattern}`} -- ${path}`.text()).trim() || undefined;

// src/lib/inputs.ts
import process2 from "process";
var readInput = (name) => (process2.env[`INPUT_${name.toUpperCase().replaceAll("-", "_")}`] ?? "").trim();
var getString = (name, fallback = "") => readInput(name) || fallback;
var getBoolean = (name, fallback) => {
  const value = readInput(name).toLowerCase();
  if (!value)
    return fallback;
  if (["true", "1", "yes"].includes(value))
    return true;
  if (["false", "0", "no"].includes(value))
    return false;
  throw new Error(`Input "${name}" must be a boolean, got "${value}"`);
};
var getList = (name) => parseList(readInput(name));
var parseList = (value) => value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);

// src/lib/summary.ts
var writeSummary = async (title, dry, sections) => {
  const result = summary.addHeading(title);
  if (dry)
    result.addRaw(`

> [!NOTE]
> This is a dry run.

`);
  for (const [heading, lines] of sections) {
    result.addHeading(heading, 2);
    if (!lines.length)
      result.addRaw(`
_None_

`);
    else
      result.addRaw(`
${lines.map((line) => `- ${line}`).join(`
`)}

`);
  }
  await result.write();
};

// src/lib/workspace.ts
var {$: $2, file: file2, write } = globalThis.Bun;
import process3 from "process";
import { join as join2, relative } from "path";
var rootPath = () => process3.env.GITHUB_WORKSPACE ?? process3.cwd();
var listWorkspace = async () => {
  const projects = await $2`pnpm list --recursive --only-projects --prod --json`.json();
  return projects.filter((project) => project.name && project.version).map((project) => ({
    name: project.name,
    version: project.version,
    path: project.path,
    private: project.private ?? false,
    dependsOn: Object.keys(project.dependencies ?? {})
  }));
};
var findPackages = (workspace, names) => {
  const missing = names.filter((name) => !workspace.some((pkg) => pkg.name === name));
  if (missing.length)
    throw new Error(`Packages not found in the workspace: ${missing.join(", ")}`);
  return names.map((name) => workspace.find((pkg) => pkg.name === name));
};
var repoRelative = (path) => relative(rootPath(), path) || ".";
var setVersion = async (pkgPath, version) => {
  const fullPath = join2(pkgPath, "package.json");
  const pkg = await file2(fullPath).json();
  pkg.version = version;
  await write(fullPath, `${JSON.stringify(pkg, null, 2)}
`);
};

// src/docs-sync/folder.ts
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "fs";
import { dirname, isAbsolute, join as join3, relative as relative2, resolve as resolve2 } from "path";

// src/docs-sync/links.ts
import { posix } from "path";

// src/docs-sync/navigation.ts
var PAGE_FILE = /\.mdx?$/;
var isObject2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var pathProblem = (path) => {
  if (typeof path !== "string" || !path)
    return "must be a non-empty string";
  if (path.startsWith("/") || /^[a-z]:/i.test(path) || path.includes("\\"))
    return "must be a relative path with / separators";
  const segments = path.split("/");
  if (segments.includes(".."))
    return "must not contain ..";
  if (segments.some((segment) => segment === "" || segment === "."))
    return "must be a clean path (no ./, // or trailing /)";
  if (segments.some((segment) => segment.startsWith(".")))
    return "must not point into a dot-folder";
  if (PAGE_FILE.test(path))
    return "must not have an extension";
  return;
};
var validateNavigation = (nav, files) => {
  const problems = [];
  const listed = new Map;
  const add = (path, at) => {
    const problem = pathProblem(path);
    if (problem)
      problems.push(`navigation.json ${at}: "${String(path)}" ${problem}`);
    else
      listed.set(path, (listed.get(path) ?? 0) + 1);
  };
  const visit = (items, at) => {
    if (!Array.isArray(items)) {
      problems.push(`navigation.json ${at} must be an array`);
      return;
    }
    items.forEach((item, index) => {
      const where = `${at}[${index}]`;
      if (typeof item === "string")
        return add(item, where);
      if (!isObject2(item) || typeof item.group !== "string") {
        problems.push(`navigation.json ${where} must be a page path or a { "group", "pages" } object`);
        return;
      }
      if (item.root !== undefined)
        add(item.root, `${where}.root`);
      visit(item.pages, `${where}.pages`);
    });
  };
  visit(nav, "");
  const pages = new Map;
  for (const file3 of files.filter((path) => PAGE_FILE.test(path))) {
    const slug = file3.replace(PAGE_FILE, "");
    pages.set(slug, [...pages.get(slug) ?? [], file3]);
    if (/^readme\.mdx?$/i.test(file3.split("/").at(-1) ?? ""))
      problems.push(`${file3}: no README in a docs folder (it would be a public page)`);
  }
  for (const [slug, sources] of pages)
    if (sources.length > 1)
      problems.push(`${sources.join(" and ")}: two files for the page ${slug}`);
  for (const [path, count] of listed) {
    if (!pages.has(path))
      problems.push(`navigation.json lists "${path}": no ${path}.mdx or ${path}.md`);
    if (count > 1)
      problems.push(`navigation.json lists "${path}" ${count} times`);
  }
  for (const [slug, sources] of pages)
    if (!listed.has(slug))
      problems.push(`${sources[0]}: not listed in navigation.json`);
  return problems;
};
var prefixNavigation = (items, prefix) => items.map((item) => typeof item === "string" ? `${prefix}/${item}` : {
  ...item,
  ...item.root === undefined ? {} : { root: `${prefix}/${item.root}` },
  pages: prefixNavigation(item.pages, prefix)
});

// src/docs-sync/links.ts
var MARKDOWN_LINK = /(\]\(\s*)(<[^>]*>|[^)\s]+)(?=\s*(?:\s["'][^)]*)?\))/g;
var ATTRIBUTE = /(\b(?:href|src)=)(["'])(.*?)\2/g;
var CODE_SPAN = /(`+)(?:(?!\1)[\s\S])*?\1/g;
var FENCE = /^\s*(`{3,}|~{3,})/;
var DEFINITION = /^(\s*\[[^\]]+\]:\s*)(<[^>]*>|\S+)/;
var resolve = (target, file3, context) => {
  if (!target || /^[/#]/.test(target) || /^[a-z][a-z0-9+.-]*:/i.test(target))
    return;
  const cut = target.search(/[?#]/);
  const path = cut === -1 ? target : target.slice(0, cut);
  const suffix = cut === -1 ? "" : target.slice(cut);
  const resolved = posix.normalize(posix.join(posix.dirname(file3), path)).replace(/\/$/, "");
  if (resolved === ".." || resolved.startsWith("../"))
    return { problem: `"${target}" leaves the synced folder` };
  const page = resolved.replace(PAGE_FILE, "");
  if (context.pages.has(page))
    return { url: `/${context.prefix}/${page}${suffix}` };
  if (!PAGE_FILE.test(resolved) && context.files.has(resolved))
    return { url: `/${context.prefix}/${resolved}${suffix}` };
  return { problem: `"${target}" is not a page or file of the synced folder` };
};
var rewriteOutsideCode = (line, rewrite) => {
  let out = "";
  let last = 0;
  for (const match of line.matchAll(CODE_SPAN)) {
    out += rewrite(line.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  return out + rewrite(line.slice(last));
};
var rewriteLinks = (content, file3, context) => {
  const problems = [];
  let fence;
  const lines = content.split(`
`).map((line, index) => {
    const marker = FENCE.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && !line.trim().slice(marker.length).trim())
        fence = undefined;
      return line;
    }
    if (marker) {
      fence = marker;
      return line;
    }
    const replace = (target) => {
      const result = resolve(target, file3, context);
      if (!result)
        return target;
      if ("problem" in result) {
        problems.push(`${file3}:${index + 1}: link ${result.problem}`);
        return target;
      }
      return result.url;
    };
    const definition = DEFINITION.exec(line);
    if (definition) {
      const [whole, open = "", target = ""] = definition;
      const url = target.startsWith("<") ? `<${replace(target.slice(1, -1))}>` : replace(target);
      return `${open}${url}${line.slice(whole.length)}`;
    }
    return rewriteOutsideCode(line, (text) => text.replace(MARKDOWN_LINK, (_, open, target) => target.startsWith("<") ? `${open}<${replace(target.slice(1, -1))}>` : `${open}${replace(target)}`).replace(ATTRIBUTE, (_, open, quote, target) => `${open}${quote}${replace(target)}${quote}`));
  });
  return { content: lines.join(`
`), problems };
};

// src/docs-sync/folder.ts
var listFiles = (dir, problems, at = "") => readdirSync(join3(dir, at), { withFileTypes: true }).filter((entry) => !entry.name.startsWith(".")).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
  const path = at ? `${at}/${entry.name}` : entry.name;
  if (entry.isSymbolicLink())
    problems.push(`${path}: symlinks are not synced`);
  else if (entry.isDirectory())
    return listFiles(dir, problems, path);
  else if (entry.isFile())
    return [path];
  return [];
});
var hasTitle = (content) => {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(content)?.[1];
  return frontmatter !== undefined && /^title\s*:\s*\S/m.test(frontmatter);
};
var planFolder = (src, prefix, root = src) => {
  const problems = [];
  const inside = relative2(root, src);
  if (inside === ".." || inside.startsWith("../") || isAbsolute(inside))
    return { problems: [".: outside the source repository"] };
  if (realpathSync(src) !== resolve2(realpathSync(root), inside))
    return { problems: [".: symlinks are not synced"] };
  if (lstatSync(src).isSymbolicLink())
    return { problems: [".: symlinks are not synced"] };
  const files = listFiles(src, problems).filter((path) => path !== "navigation.json");
  let navigation;
  try {
    if (lstatSync(join3(src, "navigation.json")).isSymbolicLink())
      return { problems };
    navigation = JSON.parse(readFileSync(join3(src, "navigation.json"), "utf8"));
  } catch (error2) {
    problems.push(`navigation.json: ${error2 instanceof Error ? error2.message : String(error2)}`);
    return { problems };
  }
  problems.push(...validateNavigation(navigation, files));
  const context = {
    pages: new Set(files.filter((path) => PAGE_FILE.test(path)).map((path) => path.replace(PAGE_FILE, ""))),
    files: new Set(files),
    prefix
  };
  const pages = new Map;
  for (const file3 of files.filter((path) => PAGE_FILE.test(path))) {
    const content = readFileSync(join3(src, file3), "utf8");
    if (!hasTitle(content))
      problems.push(`${file3}: no frontmatter title`);
    const rewritten = rewriteLinks(content, file3, context);
    problems.push(...rewritten.problems);
    pages.set(file3, rewritten.content);
  }
  if (problems.length)
    return { problems };
  return { plan: { src, prefix, files, pages, navigation }, problems };
};
var writeFolder = (plan, dest) => {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const file3 of plan.files) {
    mkdirSync(dirname(join3(dest, file3)), { recursive: true });
    const page = plan.pages.get(file3);
    if (page === undefined)
      copyFileSync(join3(plan.src, file3), join3(dest, file3));
    else
      writeFileSync(join3(dest, file3), page);
  }
  writeJson(join3(dest, "navigation.json"), prefixNavigation(plan.navigation, plan.prefix));
};
var writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}
`);
var assertNoProblems = (results) => {
  const failed = results.filter(([, problems]) => problems.length);
  if (!failed.length)
    return;
  throw new Error(`The docs are invalid:
${failed.map(([folder, problems]) => `${folder}:
${problems.map((problem) => `  - ${problem}`).join(`
`)}`).join(`
`)}`);
};

// src/docs-sync/references.ts
var import_semver = __toESM(require_semver2(), 1);
var {$: $3 } = globalThis.Bun;
import { existsSync as existsSync2, readFileSync as readFileSync2, readdirSync as readdirSync2, rmSync as rmSync2 } from "fs";
import { join as join4 } from "path";
var generateReferences = async (path) => {
  await $3`pnpm run docs`.cwd(path);
};
var isVersion = (version) => import_semver.valid(version) === version;
var keptVersions = (versions) => {
  const sorted = versions.filter(isVersion).sort(import_semver.rcompare);
  return sorted.filter((version, index) => sorted.findIndex((other) => import_semver.major(other) === import_semver.major(version)) === index);
};
var writeReferences = (plan, root, version) => {
  writeFolder(plan, join4(root, version));
  const entries = readdirSync2(root).sort();
  const kept = keptVersions(entries.filter((name) => existsSync2(join4(root, name, "navigation.json"))));
  const removed = entries.filter((name) => !kept.includes(name) && name !== "navigation.json");
  for (const name of removed)
    rmSync2(join4(root, name), { recursive: true, force: true });
  writeJson(join4(root, "navigation.json"), kept.map((name, index) => ({
    version: name,
    ...index === 0 ? { default: true } : {},
    pages: JSON.parse(readFileSync2(join4(root, name, "navigation.json"), "utf8"))
  })));
  return { kept, removed };
};

// src/docs-sync/index.ts
var PARTS = ["docs", "guides"];
var planParts = (srcPath, category) => PARTS.map((part) => {
  const src = join5(srcPath, "docs", part);
  const result = existsSync3(src) ? planFolder(src, `${part}/${category}`, srcPath) : { problems: part === "docs" ? ["missing: every synced repo has docs/docs"] : [] };
  return { part, src, ...result };
});
var main = async () => {
  const srcPath = getString("src-path", ".");
  const check = getBoolean("check", false);
  if (check) {
    const parts2 = planParts(srcPath, getString("category", "check"));
    assertNoProblems(parts2.map(({ src, problems }) => [src, problems]));
    setOutput("changed", "false");
    await writeSummary("Docs check", false, [
      ["Checked", parts2.filter(({ plan }) => plan).map(({ src }) => `\`${src}\``)]
    ]);
    return;
  }
  const docsPath = getString("docs-path", "docs-dist");
  const repository = getString("repository", process4.env.GITHUB_REPOSITORY?.split("/")[1]?.toLowerCase());
  if (!repository)
    throw new Error(`Input "repository" is required`);
  const docs = getString("category") ? undefined : (await loadConfig(rootPath(), getString("config"))).docs;
  const category = getString("category", docs?.category);
  if (!category)
    throw new Error(`Input "category" is required (or "docs.category" in the config)`);
  if (!/^[a-z0-9-]+$/.test(category))
    throw new Error(`Invalid category "${category}": only a-z, 0-9 and -`);
  const references = getBoolean("references", docs?.references ?? false);
  const referencesPath = getString("references-path", docs?.referencesPath ?? "docs/references");
  const version = getString("version");
  const parts = planParts(srcPath, category);
  let referencesPlan;
  if (references) {
    if (!version)
      throw new Error(`Input "version" is required to publish references`);
    if (!isVersion(version))
      throw new Error(`Invalid version "${version}": expected x.y.z (semver)`);
    await generateReferences(srcPath);
    referencesPlan = planFolder(join5(srcPath, referencesPath), `references/${category}/${version}`, srcPath);
  }
  assertNoProblems([
    ...parts.map(({ src, problems }) => [src, problems]),
    ...referencesPlan ? [[join5(srcPath, referencesPath), referencesPlan.problems]] : []
  ]);
  for (const { part, plan } of parts) {
    const dest = join5(docsPath, part, category);
    if (plan)
      writeFolder(plan, dest);
    else
      rmSync3(dest, { recursive: true, force: true });
  }
  const versions = referencesPlan?.plan ? writeReferences(referencesPlan.plan, join5(docsPath, "references", category), version) : undefined;
  const changed = await commitAll(`chore(${repository}): deploy docs${version ? ` v${version}` : ""}`, docsPath);
  setOutput("changed", changed ? "true" : "false");
  await writeSummary(`Docs sync ${repository}${version ? ` v${version}` : ""}`, false, [
    ["Category", [`\`${category}\``]],
    [
      "Synced",
      parts.map(({ part, plan }) => `\`${part}/${category}\`: ${plan ? "replaced" : "removed (none in the source)"}`)
    ],
    [
      "References",
      versions ? [
        `Kept: ${versions.kept.map((kept) => `\`${kept}\``).join(", ")}`,
        ...versions.kept.includes(version) ? [] : [`\`${version}\` removed: a newer version of its major is published`],
        ...versions.removed.length ? [`Removed: ${versions.removed.map((name) => `\`${name}\``).join(", ")}`] : []
      ] : []
    ],
    ["Docs commit", changed ? ["Committed, pushed by the next step"] : []]
  ]);
};
main().catch((error2) => setFailed(error2 instanceof Error ? error2.message : String(error2)));
