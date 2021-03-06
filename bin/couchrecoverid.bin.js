#!/usr/bin/env node

// command-line args
const db = process.env.COUCH_DATABASE
const args = require('yargs')
  .option('database', { alias: ['db', 'd'], describe: 'Snapshot database name', demandOption: !db, default: db })
  .option('id', { type: 'string', describe: 'The id to recover', demandOption: true })
  .option('latest', { alias: ['l'], type: 'boolean', describe: 'Only recover the latest known revision', default: false })
  .option('ignoredeletions', { alias: ['i'], type: 'boolean', describe: 'When true, only recovers documents which are not deleted.', demandOption: false, default: false })
  .option('verbose', { alias: ['v'], type: 'boolean', describe: 'Show instructions and progress in the output', default: true })
  .help('help')
  .argv

// start the data warehouse
const couchrecoverid = require('../couchrecoverid.js')
const main = async () => {
  await couchrecoverid.recoverId(args)
}
main()
