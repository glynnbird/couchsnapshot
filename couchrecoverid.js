const util = require('./lib/util.js')
const fs = require('fs')
const path = require('path')
const level = require('level')

const getAllValues = async (db, k) => {
  const retval = []
  return new Promise((resolve, reject) => {
    db.createReadStream({ gte: k + '#', lte: k + '#z' })
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
const recoverId = async (opts) => {
  const dbList = util.getFileList(opts.database, '.')
  // reverse the list to get newest first
  dbList.reverse()
  for (var i in dbList) {
    // load the manifest
    const d = dbList[i]
    const manifest = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json')))

    // connect to LevelDB
    const db = level(d)
    const data = await getAllValues(db, opts.id)
    await db.close()
    if (data.length > 0) {
      console.error('\nFrom backup taken on ', manifest.timestamp, '\n')
      for (var j in data) {
        console.log(JSON.stringify(data[j]))
      }
      if (opts.latest) {
        break
      }
    }
  }
}

module.exports = {
  recoverId
}
