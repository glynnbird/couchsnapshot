const ProgressBar = require('progress')
const debug = require('debug')('couchsnapshot')
const util = require('./lib/util.js')
const fs = require('fs')
const path = require('path')
const sqldb = require('./lib/leveldb.js')
const Nano = require('nano')
let nano
let db

// download a whole changes feed in one long HTTP request
const spoolChanges = async (opts, maxChange) => {
  let bar

  // progress bar
  if (opts.verbose) {
    bar = new ProgressBar('snapshotting ' + opts.database + ' [:bar] :percent :etas', { total: maxChange, width: 30 })
  }

  // return a Promise
  let numChanges = 0
  return new Promise((resolve, reject) => {
    db.changesReader.spool({ since: opts.since, includeDocs: true })
      .on('batch', async (b) => {
        if (b.length > 0) {
          // perform database operation
          await sqldb.insertBulk(opts, opts.database, b)
          numChanges += b.length

          // update the progress bar
          if (opts.verbose) {
            bar.tick(b.length)
          }
        }
      }).on('end', (lastSeq) => {
        // complete the progress bar
        if (opts.verbose) {
          bar.tick(bar.total - bar.curr)
        }

        // pass back the last known sequence token
        resolve({ lastSeq: lastSeq, numChanges: numChanges })
      }).on('error', reject)
  })
}

// start spooling and monitoring the changes feed
const start = async (opts) => {
  // override defaults
  const defaults = {
    url: 'http://localhost:5984',
    since: '0',
    verbose: false
  }
  opts = Object.assign(defaults, opts)

  // configure nano
  nano = Nano({ url: opts.url })
  db = nano.db.use(opts.database)

  // get lastSeq from previous backups
  const ls = util.getLastSeq(opts.database)
  if (ls) {
    opts.since = ls
    console.log('Resuming from last known sequence', util.extractSequenceNumber(ls))
  }

  // get latest revision token of the target database, to
  // give us something to aim for (for the progress meter)
  debug('Getting last change from CouchDB')
  const info = await db.changes({
    since: 'now',
    limit: 1
  })
  const maxChange = util.extractSequenceNumber(info.last_seq)

  // initialise sqlite database
  debug('Initalise database')
  await sqldb.initialise(opts)

  // spool changes
  debug('Spooling changes')
  const status = await spoolChanges(opts, maxChange)
  await sqldb.close()

  // write meta data
  const ts = new Date().toISOString()
  const newDir = opts.database + '_' + ts
  fs.renameSync(opts.database, newDir)

  // write manifest
  const obj = {
    db: opts.database,
    lastSeq: status.lastSeq,
    numChanges: status.numChanges,
    timestamp: ts
  }
  fs.writeFileSync(path.join('.', newDir, 'manifest.json'), JSON.stringify(obj))

  // output summary
  if (opts.verbose) {
    console.error('Written snapshot with', status.numChanges, 'changes to', newDir)
  }
  process.exit(0)
}

module.exports = {
  start: start
}
