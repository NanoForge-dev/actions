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
var showFile = async (ref, path) => {
  const result = await $`git show ${`${ref}:${path}`}`.nothrow().quiet();
  return result.exitCode === 0 ? result.text() : undefined;
};
var commitMessages = async (from, paths) => {
  const range = from ? `${from}..HEAD` : "HEAD";
  const out = await $`git log ${range} --format=%B%x1e -- ${paths}`.text();
  return out.split("\x1E").map((message) => message.trim()).filter(Boolean);
};

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

// src/docs-sync/copy-docs.ts
import * as fs3 from "fs";
import { join as join3 } from "path";
var copyPart = (src, dist) => {
  try {
    fs3.readdirSync(src).forEach((file3) => {
      fs3.cpSync(join3(src, file3), join3(dist, file3), { recursive: true });
    });
  } catch {
    console.error(`Failed to copy ${src} to ${dist}`);
  }
};
var copyDocs = (src, dist, cat) => {
  copyPart(join3(src, "docs"), join3(dist, "docs", cat));
  copyPart(join3(src, "guides"), join3(dist, "guides", cat));
};

// src/docs-sync/generate/generate-references-config.ts
import { readdirSync as readdirSync3 } from "fs";

// src/docs-sync/generate/generate-utils.ts
import { readdirSync as readdirSync2, statSync } from "fs";
var capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
var filter = (arr) => arr.filter(Boolean);
var VARS = {
  basePath: ""
};
var generateBasePage = (name, path, root) => {
  try {
    const stat2 = statSync(`${VARS.basePath}${path}`);
    if (stat2.isFile())
      return root ? undefined : path.replace(/\.mdx?$/, "");
    if (stat2.isDirectory())
      return generateBaseGroup(name, path, root);
    return;
  } catch {
    return;
  }
};
var formatName = (name) => {
  if (name.toLowerCase() === "ecs")
    return "ECS";
  if (name.toLowerCase() === "cli")
    return "CLI";
  return capitalize(name);
};
var isNumber = (n) => !isNaN(n) && isFinite(n);
var parts = ["engine", "cli", "editor"];
var sortFiles = (a, b) => {
  if (parts.includes(a) || parts.includes(b)) {
    if (!parts.includes(a))
      return 1;
    if (!parts.includes(b))
      return -1;
    return parts.indexOf(a) - parts.indexOf(b);
  }
  const aParts = a.split("-");
  const bParts = b.split("-");
  const aNum = +(aParts[0] ?? "undefined");
  const bNum = +(bParts[0] ?? "undefined");
  if (isNumber(aNum) || isNumber(bNum)) {
    if (!isNumber(aNum))
      return 1;
    if (!isNumber(bNum))
      return -1;
    return aNum - bNum;
  }
  if (a === "index.mdx")
    return -1;
  if (b === "index.mdx")
    return 1;
  return a.localeCompare(b);
};
var readdirAndApply = (path, apply, context, fallback) => {
  try {
    return context(filter(readdirSync2(`${VARS.basePath}${path}`).sort(sortFiles).filter((file3) => !file3.startsWith(".")).map((file3, _i, array) => {
      const s = file3.split("-");
      const n = +(s[0] ?? "undefined");
      if (!isNaN(n) && isFinite(n))
        s.shift();
      const name = s.map(formatName).join("-");
      const fullPath = `${path}/${file3}`;
      return apply(name, fullPath, array.some((f) => `${f}.mdx` === file3 || f === `${file3}.mdx`));
    })));
  } catch {
    return fallback;
  }
};
var generateBaseGroup = (name, path, root) => readdirAndApply(path, generateBasePage, (e) => {
  const base = {
    group: name,
    pages: e
  };
  if (root)
    base["root"] = path;
  return base;
}, undefined);

// src/docs-sync/generate/generate-references-config.ts
var generatePages = (path) => readdirAndApply(path, generateBasePage, (e) => e, []);
var generateVersion = (version) => ({
  version,
  dropdowns: readdirAndApply(`references/${version}`, (name, path) => ({
    dropdown: name,
    pages: generatePages(path)
  }), (e) => e, [])
});
var generateVersions = () => {
  try {
    const versions = readdirSync3(`${VARS.basePath}references`).sort((a, b) => {
      const versionsA = a.split(".").map(Number);
      const versionsB = b.split(".").map(Number);
      for (let i = 0;i < Math.max(versionsA.length, versionsB.length); i++) {
        const verA = versionsA[i];
        const verB = versionsB[i];
        if (verA && verB) {
          if (verA > verB)
            return -1;
          if (verA < verB)
            return 1;
        } else if (verA !== undefined)
          return -1;
        else if (verB !== undefined)
          return 1;
      }
      return 0;
    });
    return versions.map(generateVersion);
  } catch {
    return [];
  }
};
var generateReferencesTab = () => ({
  tab: "References",
  versions: generateVersions()
});

// src/docs-sync/generate/generate-config.ts
var BASE_CONFIG = {
  $schema: "https://mintlify.com/docs.json",
  theme: "almond",
  name: "NanoForge",
  custom: {
    css: ["custom.css"]
  },
  colors: {
    primary: "#4923b6",
    light: "#b794f6",
    dark: "#7c3aed"
  }
};
var generateBaseGroups = (path) => readdirAndApply(path, generateBaseGroup, (e) => e, []);
var generateBaseTab = (name, path) => ({
  tab: name,
  dropdowns: readdirAndApply(path, (subName, subPath) => ({ dropdown: subName, groups: generateBaseGroups(subPath) }), (e) => e, [])
});
var generateDocumentationTab = () => generateBaseTab("Documentation", "docs");
var generateGuidesTab = () => generateBaseTab("Guides", "guides");
var generateNavigation = () => ({
  navigation: {
    languages: [
      {
        language: "en",
        tabs: [generateDocumentationTab(), generateGuidesTab(), generateReferencesTab()]
      }
    ]
  }
});
var generateDocsConfig = async (path) => {
  VARS.basePath = `${path}/`;
  const config = { ...BASE_CONFIG, ...generateNavigation() };
  await Bun.write(`${path}/docs.json`, JSON.stringify(config, null, 2));
};

// src/docs-sync/references.ts
var {$: $3 } = globalThis.Bun;
import { cpSync as cpSync2, readdirSync as readdirSync4 } from "fs";
import { join as join4 } from "path";
var generateReferences = async (path) => {
  await $3`pnpm run docs`.cwd(path);
};
var copyReferences = (src, dist, tag) => {
  try {
    readdirSync4(src).forEach((pkgName) => {
      const pkgPath = join4(src, pkgName);
      const distPath = pkgName === "snippets" ? join4(dist, pkgName) : join4(dist, "references", tag, pkgName);
      cpSync2(pkgPath, distPath, { recursive: true });
    });
  } catch {
    console.error(`Failed to copy ${src} to ${dist}`);
  }
};

// src/docs-sync/index.ts
var main = async () => {
  const srcPath = getString("src-path", ".");
  const docsPath = getString("docs-path", "docs-dist");
  const repository = getString("repository", process4.env.GITHUB_REPOSITORY?.split("/")[1]?.toLowerCase());
  if (!repository)
    throw new Error(`Input "repository" is required`);
  const docs = getString("category") ? undefined : (await loadConfig(rootPath(), getString("config"))).docs;
  const category = getString("category", docs?.category);
  if (!category)
    throw new Error(`Input "category" is required (or "docs.category" in the config)`);
  const references = getBoolean("references", docs?.references ?? false);
  const referencesPath = getString("references-path", docs?.referencesPath ?? "docs/references");
  const version = getString("version");
  copyDocs(join5(srcPath, "docs"), docsPath, category);
  if (references) {
    if (!version)
      throw new Error(`Input "version" is required to publish references`);
    await generateReferences(srcPath);
    copyReferences(join5(srcPath, referencesPath), docsPath, version);
  }
  await generateDocsConfig(docsPath);
  const changed = await commitAll(`chore(${repository}): deploy docs${version ? ` v${version}` : ""}`, docsPath);
  setOutput("changed", changed ? "true" : "false");
};
main().catch((error2) => setFailed(error2 instanceof Error ? error2.message : String(error2)));
