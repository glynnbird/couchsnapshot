const level = require('level')
let db

// initialise database connection
const initialise = async (opts) => {
  db = level(opts.database)
}

// insert an array of changes into the database
const insertBulk = async (opts, dbName, batch) => {
  const ops = []
  batch.forEach(b => {
    // make the database key from <_id>#<_rev>
    const id = b.id + '#' + b.changes[0].rev
    delete b.doc._id
    delete b.doc._rev
    if (b.deleted) {
      b.doc._deleted = true
    }

    // the value is the document JSON without _id or _rev
    const val = JSON.stringify(b.doc)
    ops.push({ type: 'put', key: id, value: val })
  })

  // write in bulk
  return db.batch(ops)
}

// close the database
const close = async function () {
  return db.close()
}

module.exports = {
  initialise,
  insertBulk,
  close
}
