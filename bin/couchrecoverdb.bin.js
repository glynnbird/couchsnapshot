#!/usr/bin/env node

// command-line args
const db = process.env.COUCH_DATABASE
const args = require('yargs')
  .option('database', { alias: ['db', 'd'], describe: 'Snapshot database name', demandOption: !db, default: db })
  .option('timestamp', { alias: ['ts'], type: 'string', describe: 'The timestamp to recover from', demandOption: false })
  .option('selector', { alias: ['s'], type: 'string', describe: 'Selector describing the sub-set of data to recover', demandOption: false })
  .option('ignoredeletions', { alias: ['i'], type: 'boolean', describe: 'When true, only recovers documents which are not deleted.', demandOption: false, default: false })
  .option('verbose', { describe: 'Show instructions and progress in the output', default: true, type: 'boolean' })
  .option('dedupe', { describe: 'Dedupe output - each _id only appears once', default: true, type: 'boolean' })
  .help('help')
  .argv

if (args.selector) {
  try {
    args.selector = JSON.parse(args.selector)
  } catch (e) {
    throw new Error('Invalid JSON supplied as --selector/-s parameter')
  }
}

// start the data warehouse
const couchrecoverdb = require('../couchrecoverdb.js')
const main = async () => {
  await couchrecoverdb.recoverdb(args)
}
main()
