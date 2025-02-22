/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/**
* [This Library helps analyze sql queries and seperate read/write queries for mysql, mssql and postgre]
*/
const log = require('./log');

/**
 * [getQueryType analyzes a single query and returns r or w for query type]
 * @param {string} sql sql query
 * @return {string}        [r/w]
 */
function getQueryType(sql) {
  const readFlags = ['select', 'show', 'describe', 'set names', 'kill', 'set profiling'];
  // eslint-disable-next-line no-restricted-syntax
  for (const flag of readFlags) { if (sql.toLowerCase().startsWith(flag)) return 'r'; }

  // these codes are to fix ridiculus duplicate wordpress queries
  if (sql.includes('`wp_options`') && sql.includes('_transient_')) {
  //  log.warn('wp transient query');
    return 'r';
  }
  if (sql.toLowerCase().startsWith('set session')) {
    return 's';
  }

  // it's a write query
  return 'w';
}
function removeFirstLine(str) {
  const lines = str.split('\n');
  lines.splice(0, 1);
  return lines.join('\n');
}
/**
 * [clean up linebraks]
 * @param {string} sql sql query
 */
function cleanUP(sql) {
  // if (sql.startsWith('SET max_allowed_packet')) {
  //   return sql.replace('SET max_allowed_packet', 'SET GLOBAL max_allowed_packet');
  // }
  // if (sql.startsWith('/*') && sql.endsWith('*/') && !sql.startsWith('/*!')) return false;
  if (sql.startsWith('--')) {
    // eslint-disable-next-line no-param-reassign
    while (sql.startsWith('--') || sql.startsWith('\r\n') || sql.startsWith('\n')) sql = removeFirstLine(sql);
  }
  return sql;
}
/**
 * [analyzeSql analyzes the sql and marks them as read/write]
 * @param {string} sql sql query
 * @param {string} options sql engine:mysql,mssql,postgre
 * @return {array}        [array of queries]
 */
function analyzeSql(sql, options) {
  if (options === 'mysql') {
    //
  } else if (options === 'mssql') {
    //
  } else if (options === 'postgre') {
    //
  } else return [];
  const analyzedArray = [];
  const tempSql = cleanUP(sql.trim());
  if (tempSql) analyzedArray.push([tempSql, getQueryType(tempSql)]);
  // log.query(sql, 'yellow');
  return analyzedArray;
}

module.exports = analyzeSql;
