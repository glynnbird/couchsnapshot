const util = require('./lib/util.js')
const fs = require('fs')
const path = require('path')
const level = require('level')
const async = require('async')
const rimraf = require('rimraf')
const psc = require('pouchdb-selector-core')

// a faster version of psc.matchesSelector, because we pre-massage
// the supplied selector to save having to massage it every time
const fastMatchesSelector = (doc, massagedSelector) => {
  const row = {
    doc: doc
  }
  const rowsMatched = psc.filterInMemoryFields([row], { selector: massagedSelector }, Object.keys(massagedSelector))
  return rowsMatched && rowsMatched.length === 1
}

// stream through all items in database and add to
// a queue
const enqueueAllData = async (db, q, selector) => {
  // pre-massage the supplied selector
  let massagedSelector = null
  if (selector && typeof selector === 'object') {
    massagedSelector = psc.massageSelector(selector)
  }

  // return a promise - this is an asynchronous operation
  return new Promise((resolve, reject) => {
    // read through every document in reverse order
    db.createReadStream({ reverse: true })
      // when we get a block of data
      .on('data', function (data) {
        // reunite the id/rev with the document bodies
        const doc = util.reconstruct(data)
        // only queue data that matches selector, if supplied
        // the queue is used to dedupe the output so that a document
        // id only appears once in the recovery stream.
        if (!selector || fastMatchesSelector(doc, massagedSelector)) {
          q.push(doc)
        }
      })
      .on('error', function (err) {
        reject(err)
      })
      .on('end', function () {
        resolve()
      })
  })
}

// generate a random database name
const randomDBName = () => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const retval = []
  for (var i = 0; i < 10; i++) {
    retval.push(alphabet[Math.floor(Math.random() * alphabet.length)])
  }
  return retval.join('')
}

// recover a database (to stdout)
const recoverdb = async (opts) => {
  // create a levelDB database to store progress
  const progressDBName = 'recoverdb_progress_' + randomDBName()
  const progressDB = level(progressDBName)

  // get a list of snapshots
  const dbList = util.getFileList(opts.database, '.')

  // reverse the list to get newest first
  dbList.reverse()

  // this flag decides whether to use a snapshot during recovery
  // If a timestamp is supplied, we need to ignore snapshots that don't
  // equal the supplied snapshot timestamp and then use all the following
  // snapshots. If a timestamp isn't supplied, we can just use all
  // the snapshots.
  let foundSnapshot = !opts.timestamp

  // this is the queue that de-dupes the list so that a document id
  // only appears once in the output stream. A temporary LevelDB
  // database is used to keep track of the document ids we've already
  // outputted. The database is deleted at the end of the recovery.
  const q = async.queue(function (task, cb) {
    // extract the document id
    const id = task._id

    // see if the the document id has already appeared
    // in our output stream
    progressDB.get(id, function (err, value) {
      // if it hasn't
      if (err && err.notFound) {
        // add the id to our temporary database
        progressDB.put(id, 'x', function () {
          // output to the console
          console.log(JSON.stringify(task))
          return cb()
        })
      } else {
        // if this id has been output already, do nothing
        return cb()
      }
    })
  })

  // for each snapshot in the list (in reverse order)
  for (var i in dbList) {
    // load the manifest
    const d = dbList[i]

    // if this is the snapshot the user has specified
    if (!foundSnapshot && d === opts.database + '_' + opts.timestamp) {
      // use this snapshot, and all snapshots from now on
      foundSnapshot = true
    }

    // if we're to use this database
    if (foundSnapshot) {
      // load its manifest file
      const manifest = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json')))

      // if it contains more than 0 changes
      if (manifest.numChanges > 0) {
        // load its data and add it to the queue
        const db = level(d)
        await enqueueAllData(db, q, opts.selector)
        await db.close()
      }
    }
  }

  // await the draining of the queue
  await q.drain()

  // close the temporary database
  await progressDB.close()

  // delete it
  rimraf.sync(progressDBName)
}

module.exports = {
  recoverdb
}
