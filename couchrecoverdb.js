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
  return new Promise((resolve, reject) => {
    db.createReadStream({ reverse: true })
      .on('data', function (data) {
        const doc = util.reconstruct(data)
        // only queue data that matches selector, if supplied
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

  const dbList = util.getFileList(opts.database, '.')
  // reverse the list to get newest first
  dbList.reverse()
  let foundSnapshot = false

  const q = async.queue(function (task, cb) {
    const id = task._id
    progressDB.get(id, function (err, value) {
      if (err && err.notFound) {
        progressDB.put(id, 'x', function () {
          console.log(JSON.stringify(task))
          return cb()
        })
      } else {
        return cb()
      }
    })
  })

  for (var i in dbList) {
    // load the manifest
    const d = dbList[i]
    if (!foundSnapshot && d === opts.database + '_' + opts.timestamp) {
      foundSnapshot = true
    }

    if (foundSnapshot) {
      const manifest = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json')))
      if (manifest.numChanges > 0) {
        const db = level(d)
        await enqueueAllData(db, q, opts.selector)
        await db.close()
      }
    }
  }

  // or await the end
  await q.drain()
  await progressDB.close()
  rimraf.sync(progressDBName)
}

module.exports = {
  recoverdb
}
