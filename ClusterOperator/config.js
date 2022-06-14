module.exports = {
  dbHost: process.env.DB_COMPONENT_NAME || '',
  dbType: 'mysql',
  dbUser: 'root',
  dbPass: process.env.DB_INIT_PASS || '',
  dbPort: 3306,
  dbBacklog: 'flux_backlog',
  dbBacklogCollection: 'backlog',
  dbBacklogBuffer: 'backlog_buffer',
  dbInitDB: 'test_db',
  connectionServer: 'mysql',
  externalDBPort: 3307,
  apiPort: 7071,
  debugUIPort: 8008,
  DBAppName: process.env.DB_APPNAME || '',
  AppName: process.env.CLIENT_APPNAME || '',
  version: '0.9.13',
  whiteListedIps: process.env.WHITELIST || '::1',
  clusterList: [], // Temporary
};
