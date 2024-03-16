/* eslint-disable no-unused-vars */
const mySql = require('mysql2/promise');
const net = require('net');
const config = require('./config');
const Security = require('./Security');
const log = require('../lib/log');

class DBClient {
  constructor() {
    this.connection = {};
    this.connected = false;
    this.InitDB = '';
    this.stream = null;
    this.socketCallBack = null;
    this.socketId = null;
    this.enableSocketWrite = false;
  }

  /**
  * [init]
  */
  async createStream() {
    this.stream = net.connect({
      host: config.dbHost,
      port: config.dbPort
    });
    const { stream } = this;
    return new Promise((resolve, reject) => {
      stream.once('connect', () => {
        stream.removeListener('error', reject);
        resolve(stream);
      });
      stream.once('error', (error) => {
        log.error(`>> ${error}`, { label: 'ClusterOperator - DBClient - async createStream - stream.once - error' });
        stream.removeListener('connection', resolve);
        stream.removeListener('data', resolve);
        reject(error);
      });
    });
  }

  /**
  * [rawCallback]
  */
  rawCallback(data) {
    if (this.socketCallBack && this.enableSocketWrite) {
      this.socketCallBack.write(data);
      // log.info(`writing to ${this.socketId}: ${data.length} bytes`);
    }
  }

  /**
  * [setSocket]
  */
  setSocket(func, id = null) {
    if (func === null) {
      log.info('socket set to null');
    }
    this.socketCallBack = func;
    this.socketId = id;
    this.enableSocketWrite = true;
  }

  /**
  * [disableSocketWrite]
  */
  disableSocketWrite() {
    // log.info(`socket write disabled for ${this.socketId}`);
    this.enableSocketWrite = false;
    this.socketId = null;
  }

  /**
  * [init]
  */
  async init() {
    if (config.dbType === 'mysql') {
      await this.createStream();
      this.stream.on('data', (data) => {
        this.rawCallback(data);
      });
      this.connection = await mySql.createConnection({
        password: Security.getKey(),
        user: config.dbUser,
        stream: this.stream
      });
      this.connection.once('error', () => {
        this.connected = false;
        log.info(`Connecten to ${this.InitDB} DB was lost`);
      });
      this.connected = true;
    }
  }

  /**
  * [query]
  * @param {string} query [description]
  */
  async query(query, rawResult = false, fullQuery = '') {
    if (config.dbType === 'mysql') {
      // log.info(`running Query: ${query}`);
      try {
        if (!this.connected) {
          log.info(`Connecten to ${this.InitDB} DB was lost, reconnecting...`);
          await this.init();
          this.setDB(this.InitDB);
        }

        const [rows, fields, error] = await this.connection.query(query);

        if (rawResult) {
          if (error) {
            if (fullQuery !== '') {
              log.error(`>> ${error}, ${fullQuery}`, { label: 'ClusterOperator - DBClient - async query - try - rawResult - await this.connection.query - error' });
            } else {
              log.error(`>> ${error}`, { label: 'ClusterOperator - DBClient - async query - try - rawResult - await this.connection.query - error' });
            }
          }

          return [rows, fields, error];
        // eslint-disable-next-line no-else-return
        } else {
          if (error) {
            if (fullQuery !== '') {
              log.error(`>> ${error}, ${fullQuery}`, { label: 'ClusterOperator - DBClient - async query - try - await this.connection.query - error' });
            } else {
              log.error(`>> ${error}`, { label: 'ClusterOperator - DBClient - async query - try - await this.connection.query - error' });
            }
          }

          return rows;
        }
      } catch (error) {
        if (fullQuery !== '') {
          log.error(`>> ${error}, ${fullQuery}`, { label: 'ClusterOperator - DBClient - async query - catch - error' });
        } else {
          log.error(`>> ${error}`, { label: 'ClusterOperator - DBClient - async query - catch - error' });
        }

        return [null, null, error];
      }
    }
    return null;
  }

  /**
  * [execute]
  * @param {string} query [description]
  * @param {array} params [description]
  */
  async execute(query, params, rawResult = false, fullQuery = '') {
    if (config.dbType === 'mysql') {
      try {
        if (!this.connected) {
          await this.init();
        }

        const [rows, fields, error] = await this.connection.execute(query, params);

        if (rawResult) {
          if (error) {
            if (fullQuery !== '') {
              log.error(`>> ${error}, ${fullQuery}`, { label: 'ClusterOperator - DBClient - async query - try - rawResult - await this.connection.query - error' });
            } else {
              log.error(`>> ${error}`, { label: 'ClusterOperator - DBClient - async query - try - rawResult - await this.connection.query - error' });
            }
          }

          return [rows, fields, error];
        // eslint-disable-next-line no-else-return
        } else {
          if (error) {
            if (fullQuery !== '') {
              log.error(`>> ${error}, ${fullQuery}`, { label: 'ClusterOperator - DBClient - async query - try - await this.connection.query - error' });
            } else {
              log.error(`>> ${error}`, { label: 'ClusterOperator - DBClient - async query - try - await this.connection.query - error' });
            }
          }

          return rows;
        }
      } catch (error) {
        if (fullQuery !== '') {
          log.error(`>> ${error}, ${fullQuery}`, { label: 'ClusterOperator - DBClient - async execute - catch - error' });
        } else {
          log.error(`>> ${error}`, { label: 'ClusterOperator - DBClient - async quexecutery - catch - error' });
        }

        return [null, null, error];
      }
    }
    return null;
  }

  /**
  * [createDB]
  * @param {string} dbName [description]
  */
  async createDB(dbName) {
    if (config.dbType === 'mysql') {
      try {
        await this.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
      } catch (error) {
        log.error(`>> ${error}`, { label: 'ClusterOperator - DBClient - async createDB - catch - error' });
      }
    }
    return null;
  }

  /**
  * [setDB]
  * @param {string} dbName [description]
  */
  async setDB(dbName) {
    if (config.dbType === 'mysql') {
      this.InitDB = dbName;
      // log.info(`seting db to ${dbName}`);
      this.connection.changeUser(
        { database: dbName },
        (error) => {
          log.error(`>> ${error}`, { label: 'ClusterOperator - DBClient - async setDB - this.connection.changeUser - error' });
        }
      );
    }
  }

  /**
  * [setPassword]
  * @param {string} key [description]
  */
  async setPassword(key) {
    if (config.dbType === 'mysql') {
      await this.query(`SET PASSWORD FOR 'root'@'localhost' = PASSWORD('${key}');SET PASSWORD FOR 'root'@'%' = PASSWORD('${key}');FLUSH PRIVILEGES;`);
    }
  }
}

// eslint-disable-next-line func-names
exports.createClient = async function () {
  try {
    const cl = new DBClient();
    await cl.init();
    return cl;
  } catch (error) {
    log.error(`>> ${error}`, { label: 'ClusterOperator - exports.createClient - catch - error' });
    return ((config.dbType === 'mysql') && (error.code === 'ER_ACCESS_DENIED_ERROR')) ? 'WRONG_KEY' : null;
  }
};
