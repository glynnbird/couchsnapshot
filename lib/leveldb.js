const level = require('level')
const util = require('./util.js')
let db

const initialise = async (opts) => {
  const usableDatabaseName = util.calculateUsableDbName(opts, opts.database)
  db = level(usableDatabaseName)
}

// insert an array of changes into the database
const insertBulk = async (opts, dbName, theSchema, batch) => {
  const ops = []
  batch.forEach(b => {
    const id = b.id + '#' + b.changes[0].rev
    delete b.doc._id
    delete b.doc._rev
    if (b.deleted) {
      b.doc._deleted = true
    }
    const val = JSON.stringify(b.doc)
    ops.push({ type: 'put', key: id, value: val })
  })
  return db.batch(ops)
}

const close = async function () {
  return db.close()
}

module.exports = {
  initialise,
  insertBulk,
  close
}
