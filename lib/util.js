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

module.exports = {
  filter: filter,
  calculateUsableDbName: calculateUsableDbName,
  extractSequenceNumber: extractSequenceNumber
}
