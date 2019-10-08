#!/usr/bin/env node

// command-line args
const db = process.env.COUCH_DATABASE
const url = process.env.COUCH_URL || 'http://localhost:5984'
const args = require('yargs')
  .option('url', { alias: 'u', describe: 'CouchDB URL', default: url })
  .option('target', { alias: ['t'], describe: 'Restore target CouchDB database name', demandOption: true })
  .option('database', { alias: ['db', 'd'], describe: 'Snapshot database name', demandOption: !db, default: db })
  .option('timestamp', { alias: ['ts'], type: 'string', describe: 'The timestamp to recover from', demandOption: true })
  .help('help')
  .argv

// start the data warehouse
const couchrestorets = require('../couchrestorets.js')
const main = async () => {
  await couchrestorets.restore(args)
}
main()
