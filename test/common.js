'use strict';

const fs = require('fs');
const path = require('path');

const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: (process.env.CI ? process.env.MYSQL_PASSWORD : '') || '',
  database: process.env.MYSQL_DATABASE || 'test',
  compress: process.env.MYSQL_USE_COMPRESSION,
  port: process.env.MYSQL_PORT || 3306
};

if (process.env.MYSQL_USE_TLS) {
  config.ssl = {
    rejectUnauthorized: false,
    ca: fs.readFileSync(
      path.join(__dirname, '../examples/ssl/certs/ca.pem'),
      'utf-8'
    )
  };
}

const configURI = `mysql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;

exports.SqlString = require('sqlstring');
exports.config = config;

exports.waitDatabaseReady = function(callback) {
  const start = Date.now();
  const tryConnect = function() {
    const conn = exports.createConnection();
    conn.once('error', err => {
      if (err.code !== 'PROTOCOL_CONNECTION_LOST' && err.code !== 'ETIMEDOUT') {
        console.log('Unexpected error waiting for connection', err);
        process.exit(-1);
      }
      try {
        conn.close();
      } catch (err) {
        console.log(err);
      }
      console.log('not ready');
      setTimeout(tryConnect, 1000);
    });
    conn.once('connect', () => {
      console.log(`ready after ${Date.now() - start}ms!`);
      conn.close();
      callback();
    });
  };
  tryConnect();
};

exports.createConnection = function(args) {
  if (!args) {
    args = {};
  }
  // hrtime polyfill for old node versions:
  if (!process.hrtime) {
    process.hrtime = function(start) {
      start = [0, 0] || start;
      const timestamp = Date.now();
      const seconds = Math.ceil(timestamp / 1000);
      return [
        seconds - start[0],
        (timestamp - seconds * 1000) * 1000 - start[1]
      ];
    };
  }

  if (process.env.BENCHMARK_MARIA) {
    const Client = require('mariasql');
    const c = new Client();
    c.connect({
      host: config.host,
      user: config.user,
      password: config.password,
      db: config.database
    });
    setTimeout(() => {
      console.log('altering client...');
      c.oldQuery = c.query;
      c.query = function(sql, callback) {
        const rows = [];
        const q = c.oldQuery(sql);
        q.on('result', res => {
          res.on('row', row => {
            rows.push(row);
          });
          res.on('end', () => {
            callback(null, rows);
          });
        });
      };
    }, 1000);
    return c;
  }

  let driver = require('../index.js');
  if (process.env.BENCHMARK_MYSQL1) {
    driver = require('mysql');
  }

  const params = {
    host: args.host || config.host,
    rowsAsArray: args.rowsAsArray,
    user: (args && args.user) || config.user,
    password: (args && args.password) || config.password,
    database: (args && args.database) || config.database,
    multipleStatements: args ? args.multipleStatements : false,
    port: (args && args.port) || config.port,
    debug: process.env.DEBUG || (args && args.debug),
    supportBigNumbers: args && args.supportBigNumbers,
    bigNumberStrings: args && args.bigNumberStrings,
    compress: (args && args.compress) || config.compress,
    decimalNumbers: args && args.decimalNumbers,
    charset: args && args.charset,
    timezone: args && args.timezone,
    dateStrings: args && args.dateStrings,
    authSwitchHandler: args && args.authSwitchHandler,
    typeCast: args && args.typeCast,
    namedPlaceholders: args && args.namedPlaceholders,
    connectTimeout: args && args.connectTimeout,
  };

  const conn = driver.createConnection(params);
  return conn;
};

exports.getConfig = function(input) {
  const args = input || {};
  const params = {
    host: args.host || config.host,
    rowsAsArray: args.rowsAsArray,
    user: (args && args.user) || config.user,
    password: (args && args.password) || config.password,
    database: (args && args.database) || config.database,
    multipleStatements: args ? args.multipleStatements : false,
    port: (args && args.port) || config.port,
    debug: process.env.DEBUG || (args && args.debug),
    supportBigNumbers: args && args.supportBigNumbers,
    bigNumberStrings: args && args.bigNumberStrings,
    compress: (args && args.compress) || config.compress,
    decimalNumbers: args && args.decimalNumbers,
    charset: args && args.charset,
    timezone: args && args.timezone,
    dateStrings: args && args.dateStrings,
    authSwitchHandler: args && args.authSwitchHandler,
    typeCast: args && args.typeCast
  };
  return params;
};

exports.createPool = function(args) {
  if (!args) {
    args = {};
  }
  let driver = require('../index.js');
  if (process.env.BENCHMARK_MYSQL1) {
    driver = require('mysql');
  }

  return driver.createPool(exports.getConfig(args));
};

exports.createConnectionWithURI = function() {
  const driver = require('../index.js');

  return driver.createConnection({ uri: configURI });
};

exports.createTemplate = function() {
  const jade = require('jade');
  const template = require('fs').readFileSync(
    `${__dirname}/template.jade`,
    'ascii'
  );
  return jade.compile(template);
};

const ClientFlags = require('../lib/constants/client.js');

const portfinder = require('portfinder');
exports.createServer = function(onListening, handler) {
  const server = require('../index.js').createServer();
  server.on('connection', conn => {
    conn.on('error', () => {
      // we are here when client drops connection
    });
    let flags = 0xffffff;
    flags = flags ^ ClientFlags.COMPRESS;

    conn.serverHandshake({
      protocolVersion: 10,
      serverVersion: 'node.js rocks',
      connectionId: 1234,
      statusFlags: 2,
      characterSet: 8,
      capabilityFlags: flags
    });
    if (handler) {
      handler(conn);
    }
  });
  portfinder.getPort((err, port) => {
    server.listen(port, onListening);
  });
  return server;
};

exports.useTestDb = function() {
  // no-op in my setup, need it for compatibility with node-mysql tests
};
