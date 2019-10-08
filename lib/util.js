const fs = require('fs')
const path = require('path')

const filter = (str) => {
  return str.replace(/-/g, '')
}

const calculateUsableDbName = (opts, dbName, docType) => {
  if (docType) {
    return opts.split ? filter(dbName) + '_' + filter(docType) : filter(dbName)
  } else {
    return opts.split ? filter(dbName) : filter(dbName)
  }
}

const extractSequenceNumber = (seq) => {
  return parseInt(seq.replace(/-.*$/, ''))
}

const getFileList = (prefix, directory) => {
  const list = fs.readdirSync(directory)
  return list.filter((f) => {
    return f.startsWith(prefix)
  })
}

// get last manifest for this database and return its last sequence number
const getLastSeq = (dbName) => {
  const list = getFileList(dbName, '.')
  if (list.length === 0) {
    return null
  }
  const lastDir = list[list.length - 1]
  const manifest = fs.readFileSync(path.join('.', lastDir, 'manifest.json'))
  const obj = JSON.parse(manifest)
  return obj.lastSeq
}

// turn a key/value from LevelDB back into CouchDB doc
const reconstruct = (data) => {
  const k = data.key
  const bits = k.split('#')
  const id = bits[0]
  const rev = bits[1]
  const obj = {
    _id: id,
    _rev: rev
  }
  Object.assign(obj, JSON.parse(data.value))
  return obj
}

module.exports = {
  filter,
  calculateUsableDbName,
  extractSequenceNumber,
  getFileList,
  getLastSeq,
  reconstruct
}