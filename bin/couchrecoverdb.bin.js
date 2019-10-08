#!/usr/bin/env node

// command-line args
const db = process.env.COUCH_DATABASE
const args = require('yargs')
  .option('database', { alias: ['db', 'd'], describe: 'Snapshot database name', demandOption: !db, default: db })
  .option('timestamp', { alias: ['ts'], type: 'string', describe: 'The timestamp to recover from', demandOption: true })
  .help('help')
  .argv

// start the data warehouse
const couchrecoverdb = require('../couchrecoverdb.js')
const main = async () => {
  await couchrecoverdb.recoverdb(args)
}
main()
