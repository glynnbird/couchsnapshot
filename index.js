const ChangesReader = require('changesreader')
const ProgressBar = require('progress')
const debug = require('debug')('couchsnapshot')
const util = require('./lib/util.js')
const fs = require('fs')
const path = require('path')
let nano
const sqldb = require('./lib/leveldb.js')

// download a whole changes feed in one long HTTP request
const spoolChanges = async (opts, maxChange) => {
  let bar

  // progress bar
  if (opts.verbose) {
    bar = new ProgressBar('snapshotting ' + opts.database + ' [:bar] :percent :etas', { total: maxChange, width: 30 })
  }

  // return a Promise
  return new Promise((resolve, reject) => {
    // start spooling changes
    const changesReader = new ChangesReader(opts.database, nano.request)
    const func = changesReader.spool
    const params = { since: opts.since, includeDocs: true }

    func.apply(changesReader, [params]).on('batch', async (b, done) => {
      if (b.length > 0) {
        // perform database operation
        await sqldb.insertBulk(opts, opts.database, b)

        // update the progress bar
        if (opts.verbose) {
          bar.tick(b.length)
        }

        // call the done callback if provided
        if (typeof done === 'function') {
          done()
        }
      }
    }).on('end', async (lastSeq) => {
      const numChanges = bar.curr

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

  // get lastSeq from previous backups
  const ls = util.getLastSeq(opts.database)
  if (ls) {
    opts.since = ls
    console.log('Resuming from last known sequence', util.extractSequenceNumber(ls))
  }

  // setup nano
  nano = require('nano')(opts.url)

  // get latest revision token of the target database, to
  // give us something to aim for
  debug('Getting last change from CouchDB')
  const req = { db: opts.database, path: '_changes', qs: { since: 'now', limit: 1 } }
  const info = await nano.request(req)
  const maxChange = util.extractSequenceNumber(info.last_seq)

  // initialise database
  debug('Initalise database')
  await sqldb.initialise(opts)

  // spool changes
  debug('Spooling changes')
  opts.usableDbName = util.calculateUsableDbName(opts, opts.database, null)
  const status = await spoolChanges(opts, maxChange)
  await sqldb.close()

  // write meta data
  const ts = new Date().toISOString()
  const newDir = opts.usableDbName + '_' + ts
  fs.renameSync(opts.usableDbName, newDir)

  // write manifest
  const obj = {
    db: opts.database,
    lastSeq: status.lastSeq,
    numChanges: status.numChanges,
    timestamp: ts
  }
  fs.writeFileSync(path.join('.', newDir, 'manifest.json'), JSON.stringify(obj))
  process.exit(0)
}

module.exports = {
  start: start
}
