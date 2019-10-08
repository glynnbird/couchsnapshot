#!/usr/bin/env node

// command-line args
const db = process.env.COUCH_DATABASE
const args = require('yargs')
  .option('database', { alias: ['db', 'd'], describe: 'Snapshot database name', demandOption: !db, default: db })
  .option('id', { alias: ['i'], type: 'string', describe: 'The id to recover', demandOption: true })
  .option('latest', { alias: ['l'], type: 'boolean', describe: 'Only recover the latest known revision', default: false })
  .help('help')
  .argv

// start the data warehouse
const couchrecover = require('../couchrecover.js')
const main = async () => {
  await couchrecover.recoverId(args)
}
main()
