const util = require('./lib/util.js')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { Level } = require('level')
const { EntryStream } = require('level-read-stream')
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
const enqueueAllData = async (db, q, selector, ignoreDeletions, dedupe) => {
  // pre-massage the supplied selector
  let massagedSelector = null
  if (selector && typeof selector === 'object') {
    massagedSelector = psc.massageSelector(selector)
  }

  // return a promise - this is an asynchronous operation
  return new Promise((resolve, reject) => {
    // read through every document in reverse order
    const rs = new EntryStream(db, { reverse: true })
      // when we get a block of data
      .on('data', function (data) {
        // reunite the id/rev with the document bodies
        const doc = util.reconstruct(data)
        // only queue data that matches selector, if supplied
        // the queue is used to dedupe the output so that a document
        // id only appears once in the recovery stream.
        if (!selector || fastMatchesSelector(doc, massagedSelector)) {
          if (!ignoreDeletions || (ignoreDeletions && !(doc._deleted === true))) {
            // if we are to dedupe the output, then push it to the queue
            if (dedupe) {
              q.push(doc)
              // don't let the queue build to up too much
              // pause and resume to give the queue a chance to recede
              if (q.length() > 100000) {
                rs.pause()
                setTimeout(() => {
                  rs.resume()
                }, 1000)
              }
            } else {
              // output the doc
              console.log(JSON.stringify(doc))
            }
          }
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
  for (let i = 0; i < 10; i++) {
    retval.push(alphabet[Math.floor(Math.random() * alphabet.length)])
  }
  return retval.join('')
}

// recover a database (to stdout)
const recoverdb = async (opts) => {
  let progressDB, progressDBName, rollupDB, rollupDBName

  // create a levelDB database to store progress
  if (opts.dedupe) {
    const tmp = os.tmpdir()
    progressDBName = path.join(tmp, 'recoverdb_progress_' + randomDBName())
    progressDB = new Level(progressDBName)
  }

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
  const q = async.queue(async (task) => {
    // extract the document id
    const id = task._id

    // see if the the document id has already appeared
    // in our output stream
    try {
      // fetch document from db - if the id isn't in the db, an error is thrown
      await progressDB.get(id)
    } catch (e) {
      // if the error indicates that id isn't in the output db
      if (e.notFound) {
        await progressDB.put(id, 'x')
        if (opts.rollup) {
          const newid = task._id + '#' + task._rev
          delete task._id
          delete task._rev
          await rollupDB.put(newid, JSON.stringify(task))
        } else {
          console.log(JSON.stringify(task))
        }
      }
    }
  })

  // for each snapshot in the list (in reverse order)
  let firstFile = true
  const directories = []
  for (const i in dbList) {
    // load the manifest
    const d = dbList[i]

    // if this is the snapshot the user has specified
    if (!foundSnapshot && d === opts.database + '_' + opts.timestamp) {
      // use this snapshot, and all snapshots from now on
      foundSnapshot = true
    }

    // if we're to use this database
    if (foundSnapshot) {
      if (firstFile) {
        if (opts.rollup) {
          rollupDBName = '_' + d + '_ROLLUP'
          rollupDB = new Level(rollupDBName)
        }
        firstFile = false
      }
      directories.push(d)
      // load its manifest file
      const manifest = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json')))

      // if it contains more than 0 changes
      if (manifest.numChanges > 0) {
        // load its data and add it to the queue
        const db = new Level(d)
        await enqueueAllData(db, q, opts.selector, opts.ignoredeletions, opts.dedupe)
        await db.close()
      }
    }
  }

  // await the draining of the queue
  if (opts.dedupe) {
    await q.drain()

    // close the temporary database
    await progressDB.close()
    if (opts.rollup) {
      // close the database
      await rollupDB.close()

      // copy the manifest from the newest rolled-up dictory
      const src = path.join(directories[0], 'manifest.json')
      const dest = path.join(rollupDBName, 'manifest.json')
      fs.copyFileSync(src, dest)

      // move the rolled up database into place
      const destDir = rollupDBName.replace(/^_/, '')
      fs.renameSync(rollupDBName, destDir)
    }

    // delete the progress database
    rimraf.sync(progressDBName)

    // delete unwanted databases
    if (opts.rollup) {
      for (const i in directories) {
        rimraf.sync(directories[i])
      }
    }
  }
}

module.exports = {
  recoverdb
}
