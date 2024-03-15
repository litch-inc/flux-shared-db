/* eslint-disable */
const WebSocket = require('ws');
const axios = require('axios');
const fluxAPI = require('../lib/fluxAPI');

async function test() {
console.log(await fluxAPI.getMaster('localhost',7071));
console.log(await fluxAPI.getMyIp('localhost',7071));
}

test();
