const log = require('../../../lib/log');

/**
 * mysql-import - Importer class
 * @version {{ VERSION }}
 * https://github.com/Pamblam/mysql-import
 */
class Importer {
  /**
   * new Importer(settings)
   * @param {host, user, password[, database]} settings - login credentials
   */
  constructor(settings) {
    this._connection_settings = settings;
    this._conn = null;
    this._encoding = 'utf8';
    this._imported = [];
    this._progressCB = () => {};
    this._dumpCompletedCB = () => {};
    this._total_files = 0;
    this._current_file_no = 0;
  }

  /**
	 * Get an array of the imported files
	 * @returns {Array}
	 */
  getImported() {
    return this._imported.slice(0);
  }

  /**
	 * Set the encoding to be used for reading the dump files.
	 * @param string - encoding type to be used.
	 * @throws {Error} - if unsupported encoding type.
	 * @returns {undefined}
	 */
  setEncoding(encoding) {
    const supported_encodings = [
      'utf8',
      'ucs2',
      'utf16le',
      'latin1',
      'ascii',
      'base64',
      'hex',
    ];
    if (!supported_encodings.includes(encoding)) {
      throw new Error("Unsupported encoding: "+encoding);
    }
    this._encoding = encoding;
  }

  /**
	 * Set or change the database to be used
	 * @param string - database name
	 * @returns {Promise}
	 */
  use(database) {
    return new Promise((resolve, reject) => {
      if (!this._conn) {
        this._connection_settings.database = database;
        resolve();
        return;
      }
      this._conn.changeUser({ database }, (error) => {
        if (error) {
          log.error(`>> ${error}`, { label: 'importer - Importer - use - Promise - _conn.changeUser - error' });
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
	 * Set a progress callback
	 * @param {Function} cb - Callback function is called whenever a chunk of
	 *		the stream is read. It is provided an object with the folling properties:
	 *			- total_files: The total files in the queue.
	 *			- file_no: The number of the current dump file in the queue.
	 *			- bytes_processed: The number of bytes of the file processed.
	 *			- total_bytes: The size of the dump file.
	 *			- file_path: The full path to the dump file.
	 * @returns {undefined}
	 */
  onProgress(cb) {
    if (typeof cb !== 'function') return;
    this._progressCB = cb;
  }

  /**
	 * Set a progress callback
	 * @param {Function} cb - Callback function is called whenever a dump
	 *		file has finished processing.
	 *			- total_files: The total files in the queue.
	 *			- file_no: The number of the current dump file in the queue.
	 *			- file_path: The full path to the dump file.
	 * @returns {undefined}
	 */
  onDumpCompleted(cb) {
    if (typeof cb !== 'function') return;
    this._dumpCompletedCB = cb;
  }

  /**
	 * Import (an) .sql file(s).
	 * @param string|array input - files or paths to scan for .sql files
	 * @returns {Promise}
	 */
  import(...input) {
    return new Promise(async (resolve, reject) => {
      try {
        await this._connect();
        const files = await this._getSQLFilePaths(...input);
        this._total_files = files.length;
        this._current_file_no = 0;

        let errorCopy = null;
        await slowLoop(files, (file, index, next) => {
          this._current_file_no++;
          if (errorCopy) {
            next();
            return;
          }
          this._importSingleFile(file).then(() => {
            next();
          }).catch((error) => {
            log.error(`>> ${error}`, { label: 'importer - Importer - import - Promise - async - try - await slowLoop - _importSingleFile - catch - error' });
            errorCopy = error;
            next();
          });
        });
        if (errorCopy) throw errorCopy;
        await this.disconnect();
        resolve();
      } catch (error) {
        log.error(`>> ${error}`, { label: 'importer - Importer - import - Promise - async - catch - error' });
        reject(error);
      }
    });
  }

  /**
	 * Disconnect mysql. This is done automatically, so shouldn't need to be manually called.
	 * @param bool graceful - force close?
	 * @returns {Promise}
	 */
  disconnect(graceful = true) {
    return new Promise((resolve, reject) => {
      if (!this._conn) {
        resolve();
        return;
      }
      if (graceful) {
        this._conn.end((error) => {
          if (error) {
            log.error(`>> ${error}`, { label: 'importer - Importer - disconnect - Promise - _conn.end - error' });
            reject(error);
            return;
          }
          this._conn = null;
          resolve();
        });
      } else {
        this._conn.destroy();
        resolve();
      }
    });
  }

  ////////////////////////////////////////////////////////////////////////////
  // Private methods /////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////

  /**
	 * Import a single .sql file into the database
	 * @param {object} fileObj - Object containing the following properties:
	 *		- file: The full path to the file
	 *		- size: The size of the file in bytes
	 * @returns {Promise}
	 */
  _importSingleFile(fileObj) {
    return new Promise((resolve, reject) => {
      const parser = new queryParser({
        db_connection: this._conn,
        encoding: this._encoding,
        onProgress: (progress) => {
          this._progressCB({
            total_files: this._total_files,
            file_no: this._current_file_no,
            bytes_processed: progress,
            total_bytes: fileObj.size,
            file_path: fileObj.file,
          });
        },
      });

      const dumpCompletedCB = (error) => this._dumpCompletedCB({
        total_files: this._total_files,
        file_no: this._current_file_no,
        file_path: fileObj.file,
        error,
      });

      parser.on('finish', () => {
        this._imported.push(fileObj.file);
        dumpCompletedCB(null);
        resolve();
      });

      parser.on('error', (error) => {
        log.error(`>> ${error}`, { label: 'importer - Importer - _importSingleFile - Promise - parser.on - error' });
        dumpCompletedCB(error);
        reject(error);
      });

      const readerStream = fs.createReadStream(fileObj.file);
      readerStream.setEncoding(this._encoding);

      /* istanbul ignore next */
      readerStream.on('error', (error) => {
        log.error(`>> ${error}`, { label: 'importer - Importer - _importSingleFile - Promise - readerStream.on - error' });
        dumpCompletedCB(error);
        reject(error);
      });

      readerStream.pipe(parser);
    });
  }

  /**
	 * Connect to the mysql server
	 * @returns {Promise}
	 */
  _connect() {
    return new Promise((resolve, reject) => {
      if (this._conn) {
        resolve(this._conn);
        return;
      }
      const connection = mysql.createConnection(this._connection_settings);
      connection.connect((error) => {
        if (error) {
          log.error(`>> ${error}`, { label: 'importer - Importer - _connect - Promise - connection.connect - error' });
          reject(error);
        } else {
          this._conn = connection;
          resolve();
        }
      });
    });
  }

  /**
	 * Check if a file exists
	 * @param string filepath
	 * @returns {Promise}
	 */
  _fileExists(filepath) {
    return new Promise((resolve, reject) => {
      fs.access(filepath, fs.F_OK, (error) => {
        if (error) {
          log.error(`>> ${error}`, { label: 'importer - Importer - _fileExists - Promise - fs.access - error' });
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
	 * Get filetype information
	 * @param string filepath
	 * @returns {Promise}
	 */
  _statFile(filepath) {
    return new Promise((resolve, reject) => {
      fs.lstat(filepath, (error, stat) => {
        if (error) {
          log.error(`>> ${error}`, { label: 'importer - Importer - _statFile - Promise - fs.lstat - error' });
          reject(error);
        } else {
          resolve(stat);
        }
      });
    });
  }

  /**
	 * Read contents of a directory
	 * @param string filepath
	 * @returns {Promise}
	 */
  _readDir(filepath) {
    return new Promise((resolve, reject) => {
      fs.readdir(filepath, (error, files) => {
        if (error) {
          log.error(`>> ${error}`, { label: 'importer - Importer - _readDir - Promise - fs.readdir - error' });
          reject(error);
        } else {
          resolve(files);
        }
      });
    });
  }

  /**
	 * Parses the input argument(s) for Importer.import into an array sql files.
	 * @param strings|array paths
	 * @returns {Promise}
	 */
  _getSQLFilePaths(...paths) {
    return new Promise(async (resolve, reject) => {
      const full_paths = [];
      let errorCopy = null;
      paths = [].concat.apply([], paths); // flatten array of paths
      await slowLoop(paths, async (filepath, index, next) => {
        if (errorCopy) {
          log.error(`>> ${errorCopy}`, { label: 'importer - Importer - _getSQLFilePaths - Promise - async - await slowLoop - error' });
          next();
          return;
        }
        try {
          await this._fileExists(filepath);
          const stat = await this._statFile(filepath);
          if (stat.isFile()) {
            if (filepath.toLowerCase().substring(filepath.length-4) === '.sql') {
              full_paths.push({
                file: path.resolve(filepath),
                size: stat.size,
              });
            }
            next();
          } else if (stat.isDirectory()) {
            let more_paths = await this._readDir(filepath);
            more_paths = more_paths.map((p) => path.join(filepath, p));
            const sql_files = await this._getSQLFilePaths(...more_paths);
            full_paths.push(...sql_files);
            next();
          } else {
            /* istanbul ignore next */
            next();
          }
        } catch (error) {
          errorCopy = error;
          next();
        }
      });
      if (errorCopy) {
        reject(errorCopy);
      } else {
        resolve(full_paths);
      }
    });
  }
}

/**
 * Build version number
 */
Importer.version = '{{ VERSION }}';

module.exports = Importer;
