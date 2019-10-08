const util = require('./lib/util.js')
const fs = require('fs')
const path = require('path')
const level = require('level')
const async = require('async')
const rimraf = require('rimraf')

// stream through all items in database and add to
// a queue
const enqueueAllData = async (db, q) => {
  return new Promise((resolve, reject) => {
    db.createReadStream({ reverse: true })
      .on('data', function (data) {
        q.push(util.reconstruct(data))
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
        await enqueueAllData(db, q)
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
