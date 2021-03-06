const fs = require('fs')
const path = require('path')

// extract the numeric bit from a sequence token 1234-abiabasg2141
const extractSequenceNumber = (seq) => {
  return parseInt(seq.replace(/-.*$/, ''))
}

// get list of files but only return those that start with the
// supplied prefix
const getFileList = (prefix, directory) => {
  const list = fs.readdirSync(directory)
  return list.filter((f) => {
    return f.startsWith(prefix)
  })
}

// get last manifest for this database and return its last sequence number
const getLastSeq = (dbName) => {
  const list = getFileList(dbName + '_', '.')
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
  extractSequenceNumber,
  getFileList,
  getLastSeq,
  reconstruct
}
