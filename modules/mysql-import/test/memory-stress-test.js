/**
 * These tests are for testing memory and efficiency. They are long-running tests
 * and should not be considered for code-coverage purposes.
 */

// SET THESE FOR LOCAL TESTING ONLY!
// RESET THEM TO '' BEFORE COMMITING CHANGES!
const mysql_host = '';
const mysql_user = '';
const mysql_pass = '';

const fs = require('fs');
const expect = require('chai').expect;
const path = require('path');
const { query, mysqlConnect, createTestDB } = require('./test-helpers');

const config = {
  host: mysql_host || '127.0.0.1',
  user: mysql_user || 'root',
  password: mysql_pass || '',
  database: 'mysql-import-test-db-1'
};

mysqlConnect(config);

const MySQLImport = require('../mysql-import.js');
const SQLDumpGenerator = require('./SQLDumpGenerator.js');
const importer = new MySQLImport(config);

const start_time = new Date();
importer.onProgress((progress) => {
  const actual_pct = progress.bytes_processed / progress.total_bytes * 100;

  const time_so_far = (new Date()) - start_time;
  const total_time = time_so_far * 100 / actual_pct;
  const remaining_time = total_time - time_so_far;
  const date = new Date(0);
  date.setSeconds(remaining_time / 1000);
  const timeString = date.toISOString().substr(11, 8);

  const percent = Math.floor(actual_pct * 100) / 100;
  const filename = progress.file_path.split('/').pop();

  if (process.stdout.isTTY) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`Processing ${filename} - ${percent}% Complete, about ${timeString} remaining.`);
  } else {
    console.log(`Processing ${filename} - ${percent}% Complete, about ${timeString} remaining.`);
  }
});

const big_dump_file = path.join(__dirname, 'large_dump.sql');

describe('Running Memory Tests', () => {
  before(async function () {
    this.timeout(0);
    if (!fs.existsSync(big_dump_file)) {
      console.log('generating new large dump file.');
      const generator = new SQLDumpGenerator(2.5 * 1e+9, big_dump_file);
      await generator.init();
    } else {
      console.log('Using pre-generated dump file.');
    }
    importer.setEncoding('utf8');
    await createTestDB('mysql-import-test-db-1');
  });

  it('Import large dataset', async function () {
    this.timeout(0);
    await importer.import(big_dump_file);
    const tables = await query('SHOW TABLES;');
    expect(tables.length).to.equal(3);
  });
});
