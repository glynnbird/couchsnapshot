# couchsnapshot

_couchsnapshot_ is a suite command-line utilities that allow a CouchDB database to be backed up as a series of timestamped snapshots. 

![couchsnapshot](img/couchsnapshot.png)

Each coloured stripe in the above diagram is a snapshot of changes in a single CouchDB database since the last snapshot. The snapshot can be queried to extract:

- the history of a single document of a known `_id`.
- to extract a the entire database up to a known timestamp (with a resolution of the snapshot timestamp).

## Installation

Install on your machine (you need Node.js & npm installed):

```sh
$ npm install -f couchsnapshot
```

## Running snapshots

You run _couchsnapshot_ to backup a database `orders` like so:

```sh
$ couchsnapshot --db orders
snapshotting orders [==============================] 100% 0.0s
```

> Note: the URL of your CouchDB service is assumed to be in an environment variable `COUCH_URL`.

The data is transferred from the CouchDB database and stored locally in a folder e.g.

```sh
orders_2019-10-01T09:30:56.028Z
```

The next day you run _couchsnapshot_ again:

```sh
$ couchsnapshot --db orders
snapshotting orders [==============================] 100% 0.0s
```

This time it only fetches the data that has changed since the last snapshot, storing data a new folder.

```sh
orders_2019-10-02T09:30:01.041Z
```

You can repeat this as much as you like. Each snapshot will only contain the data that has changed since the last snapshot taken.

## Recovering a lost document

If you accidentally delete a single document from CouchDB and want to retrieve its history from your snapshot archive, then run `couchrecoverid` supplying the name of the database and the id of the document to recover:

```sh
$ couchrecoverid --db orders --id 0000vEYK2zb89n1QMdnr1MQ5Ax0wMaUa

From backup taken on  2019-10-08T10:43:53.569Z 

{"_id":"user100:0000vEYK2zb89n1QMdnr1MQ5Ax0wMaUa","_rev":"1-42a99d13a33e46b1f37f4f937d167458","type":"order","customerEmail":"jessi.payne@yahoo.com","saleDate":"2019-07-14","saleTime":"09:19:04","paymentRef":"PayPal6550849282680302","currency":"XOF","basket":[{"productId":"A402","productName":"cheese toe pushing","productVariant":"honolulu gaps"},{"productId":"A199","productName":"tablets melissa debug","productVariant":"hazards eh"}],"total":1713.5765,"status":"paid","dispatched":true,"dispatchAddress":{"street":"1553 Bark Street","town":"Gosport","zip":"BB9 5WF"},"dispatchCourierRef":"RoyalMail7732058936313772"}
```

## Restoring a whole database from a known timestamp

To restore data to a new, empty database from a known timestamp simply run:

```sh
$ couchrestorets --db recoveredorders --timstamp 2019-10-08T10:43:53.569Z
```

where `2019-10-08T10:43:53.569Z` is valid timestamp from one of your snapshots. This snapshots and the preceeding ones will be used to recreate the data up until that point.

## Reference

Environment variables:

- `COUCH_URL` - the URL of your CouchDB service e.g. `http://user:pass@myhost.com`
- `COUCH_DATABASE` - the name of the database to work with e.g. `orders`

### couchsnapshot

Takes a snapshot of database. If previous snapshots are found, it resumes from the last known location.

Parameters:

- `--url`/`-u` - the URL of your CouchDB service
- `--database`/`--db`/`-d` - the database to snapshot
- `--verbose` - output progress meter - default: true 

e.g. 

```sh
# snapshot a single CouchDB database
$ couchsnapshot --db cities
Resuming from last known sequence 23557
snapshotting cities [==============================] 100% 0.0s
Written snapshot with 2 changes to cities_2019-10-08T14:25:01.065Z
```

### couchrecoverid

Retrieves a single document from the snapshot archive. Outputs to _stdout_.

- `--database`/`--db`/`-d` - the database to snapshot
- `--id`/`-i` - the document id to recover
- `--latest`/`-l` - only retrieve one document revision (the latest one) - default: false

e.g.

```sh
# recover a single document by its id
$ couchrecoverid --database cities --id 125242 --latest true

From backup taken on  2019-10-08T13:25:56.541Z 

{"_id":"100425","_rev":"3-c296e253d9dd65cc04afd1ebd336d31b","name":"Yanbu","latitude":24.08912,"longitude":38.06376,"country":"SA","population":200161,"timezone":"Asia/Riyadh"}
```

### couchrecoverdb

Retrieves an entire database the snapshot archive. Outputs to _stdout_. The utility ensures
that each document id is only written once.

- `--database`/`--db`/`-d` - the database to snapshot
- `--timestamp`/`-t` - the timestamp to recover to

e.g.

```sh
# recover a database to a text file
$ couchrecoverdb --db cities --timestamp 2019-10-08T13:25:56.541Z > cities.txt
```

The file `cities.txt` then contains one JSON document per line. This can be imported into CouchDB using the [couchimport](https://www.npmjs.com/package/couchimport) utility:

```sh
$ cat cities.txt | couchimport --type jsonl --db cities2
```

> Note: couchimport version 1.3.0 or above is required to import JSON documents including their revision token.

where `cities2` is pre-existing, empty database.

## How does it work?

The _couchsnapshot_ utility simply takes a copy of the winning revisions of each document in a database by consuming a databases's changes feed. The data is stored in a local LevelDB database - one LevelDB database per snapshot. Additional data such as the last sequence number and timestamp is added to each database. 

LevelDB was chosen because it is fast and can keep up with the CouchDB changes feed. The data is compressed at rest making the snapshots nice and small. The LevelDB database is optimised for retrieval of documents by id, nothing else.

To recover a document by id, the LevelDB snapshot databases are interrogated in turn for a matching document (there may be several versions of the same document across the snapshots reflecting different document revisions over time). The snapshots are interrogated in newest-to-oldest order.