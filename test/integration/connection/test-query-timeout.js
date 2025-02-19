'use strict';

const common = require('../../common');
const connection = common.createConnection({ debug: false });
const assert = require('assert');

connection.query({ sql: 'SELECT sleep(3) as a', timeout: 500 }, (err, res) => {
  assert.equal(res, null);
  assert.ok(err);
  assert.equal(err.code, 'PROTOCOL_SEQUENCE_TIMEOUT');
  assert.equal(err.message, 'Query inactivity timeout');
});

connection.query({ sql: 'SELECT sleep(1) as a', timeout: 5000 }, (err, res) => {
  assert.deepEqual(res, [{ a: 0 }]);
});

connection.query('SELECT sleep(1) as a', (err, res) => {
  assert.deepEqual(res, [{ a: 0 }]);
});

connection.execute({ sql: 'SELECT sleep(3) as a', timeout: 500 }, (err, res) => {
  assert.equal(res, null);
  assert.ok(err);
  assert.equal(err.code, 'PROTOCOL_SEQUENCE_TIMEOUT');
  assert.equal(err.message, 'Query inactivity timeout');
});

connection.execute({ sql: 'SELECT sleep(1) as a', timeout: 5000 }, (err, res) => {
  assert.deepEqual(res, [{ a: 0 }]);
});

connection.execute('SELECT sleep(1) as a', (err, res) => {
  assert.deepEqual(res, [{ a: 0 }]);
  connection.end();
});

const connectionTimeout = common.createConnection({ 
  host: '10.255.255.1',
  debug: false,
  connectTimeout: 100, 
});

// return connect timeout error first
connectionTimeout.query({ sql: 'SELECT sleep(3) as a', timeout: 50 }, (err, res) => {
  assert.equal(res, null);
  assert.ok(err);
  assert.equal(err.code, 'ETIMEDOUT');
  assert.equal(err.message, 'connect ETIMEDOUT');
});