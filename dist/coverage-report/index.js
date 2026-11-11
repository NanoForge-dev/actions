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

// src/coverage-report/index.ts
var {Glob } = globalThis.Bun;
import { readFileSync } from "fs";
import { dirname, relative } from "path";

// src/lib/coverage.ts
var empty = () => ({
  lines: { hit: 0, found: 0 },
  functions: { hit: 0, found: 0 },
  branches: { hit: 0, found: 0 }
});
var KEYS = {
  LH: ["lines", "hit"],
  LF: ["lines", "found"],
  FNH: ["functions", "hit"],
  FNF: ["functions", "found"],
  BRH: ["branches", "hit"],
  BRF: ["branches", "found"]
};
var parseLcov = (content) => {
  const total = empty();
  for (const line of content.split(/\r?\n/)) {
    const match = /^([A-Z]+):(\d+)$/.exec(line.trim());
    const key = match && KEYS[match[1]];
    if (key)
      total[key[0]][key[1]] += Number(match[2]);
  }
  return total;
};
var percent = ({ hit, found }) => found ? `${(hit / found * 100).toFixed(2)}%` : "n/a";
var coverageLine = (name, coverage) => `\`${name}\`: lines ${percent(coverage.lines)} (${coverage.lines.hit}/${coverage.lines.found}), functions ${percent(coverage.functions)}, branches ${percent(coverage.branches)}`;

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

// src/coverage-report/index.ts
var main = async () => {
  const pattern = getString("files", "**/coverage/lcov.info");
  const files = [...new Glob(pattern).scanSync({ dot: false })].filter((file) => !file.split(/[\\/]/).includes("node_modules")).sort();
  if (!files.length)
    info(`No coverage report matches "${pattern}"`);
  const total = parseLcov("");
  const lines = files.map((file) => {
    const coverage = parseLcov(readFileSync(file, "utf-8"));
    for (const key of ["lines", "functions", "branches"]) {
      total[key].hit += coverage[key].hit;
      total[key].found += coverage[key].found;
    }
    return coverageLine(relative(".", dirname(dirname(file))) || ".", coverage);
  });
  setOutput("lines", percent(total.lines));
  await writeSummary(`Coverage: ${percent(total.lines)} of lines`, false, [
    ["Total", files.length ? [coverageLine("all", total)] : []],
    ["Reports", lines]
  ]);
};
main().catch((error2) => setFailed(error2 instanceof Error ? error2.message : String(error2)));
