const util = require('./lib/util.js')
const fs = require('fs')
const path = require('path')
const { Level } = require('level')
const { EntryStream } = require('level-read-stream')

// fetch all documents from a snapshot that pertain to a known
// document id (k). Performs a range query on the key-space
// because there could be more than one entry for a single
// document id.
const getAllValues = async (db, k) => {
  const retval = []
  return new Promise((resolve, reject) => {
    new EntryStream(db, { gte: k + '#', lte: k + '#z' })
      .on('data', function (data) {
        retval.push(util.reconstruct(data))
      })
      .on('error', function (err) {
        reject(err)
      })
      .on('end', function () {
        resolve(retval)
      })
  })
}

// work backwards through the list of snapshots looking for
// a single document id. If latest=true, stop when we find
// the first reference to the document id in question.
const recoverId = async (opts) => {
  const dbList = util.getFileList(opts.database, '.')
  // reverse the list to get newest first
  dbList.reverse()
  let foundCount = 0
  for (const i in dbList) {
    // load the manifest
    const d = dbList[i]
    const manifest = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json')))

    // connect to LevelDB
    const db = new Level(d)
    const data = await getAllValues(db, opts.id)
    await db.close()
    if (data.length > 0) {
      if (opts.verbose) {
        console.error('\nFrom backup taken on ', manifest.timestamp, '\n')
      }
      for (const j in data) {
        if (!opts.ignoredeletions || (opts.ignoredeletions && !(data[j]._deleted === true))) {
          console.log(JSON.stringify(data[j]))
          foundCount++
        }
      }
      if (foundCount > 0 && opts.latest) {
        break
      }
    }
  }
}

module.exports = {
  recoverId
}
