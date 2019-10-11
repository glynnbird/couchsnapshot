# couchsnapshot

_couchsnapshot_ is a suite of command-line utilities that allow a CouchDB database to be backed up as a series of timestamped snapshots. 

![couchsnapshot](img/couchsnapshot.png)

Each coloured stripe in the above diagram is a snapshot of changes in a single CouchDB database since the last snapshot. The snapshot set can be queried to extract:

- the history of a single document of a known `_id`.
- to extract the entire database up to a known timestamp (with a resolution of the snapshot timestamp).
- to extract a subset of the database up to a known timestamp, using a _selector_ to filter the recovered document list.

The _couchsnapshot_ tooling doesn't have the ability to write data back to CouchDB, but it puts the data in a form that can be conusmed by tools that can e.g. [couchimport](https://www.npmjs.com/package/couchimport).

## Installation

Install on your machine (Node.js & npm required):

```sh
$ npm install -g couchsnapshot
```

## Running snapshots

You run _couchsnapshot_ to backup a database `orders` like so:

```sh
$ couchsnapshot --db orders
snapshotting orders [==============================] 100% 0.0s
Written snapshot with 20001 changes to orders_2019-10-09T13:20:45.107Z
``` 

> Note: the URL of your CouchDB service is assumed to be in an environment variable `COUCH_URL` or the URL can be supplied with an additional `--url <url>` command-line option.

The data is transferred from the CouchDB database and stored locally in a folder e.g.

```sh
orders_2019-10-09T13:20:45.107Z
```

Later you run _couchsnapshot_ again:

```sh
$ couchsnapshot --db orders
Resuming from last known sequence 20001
snapshotting orders [==============================] 100% 0.0s
Written snapshot with 0 changes to orders_2019-10-09T13:21:13.571Z
```

This time it only fetches the data that has changed since the last snapshot, storing data in a new folder.

```sh
orders_2019-10-09T13:21:13.571Z
```

You can repeat this as much as you like. Each snapshot will only contain the data that has changed since the last snapshot taken.

## Recovering a lost document

If you accidentally delete a single document from CouchDB and want to retrieve its history from your snapshot archive, then run `couchrecoverid` supplying the name of the database and the id of the document to recover:

```sh
$ couchrecoverid --db orders --id 0000vEYK2zb89n1QMdnr1MQ5Ax0wMaUa

From backup taken on  2019-10-09T13:20:45.107Z

{"_id":"0000vEYK2zb89n1QMdnr1MQ5Ax0wMaUa","_rev":"1-42a99d13a33e46b1f37f4f937d167458","type":"order","customerEmail":"jessi.payne@yahoo.com","saleDate":"2019-07-14","saleTime":"09:19:04","paymentRef":"PayPal6550849282680302","currency":"XOF","basket":[{"productId":"A402","productName":"cheese toe pushing","productVariant":"honolulu gaps"},{"productId":"A199","productName":"tablets melissa debug","productVariant":"hazards eh"}],"total":1713.5765,"status":"paid","dispatched":true,"dispatchAddress":{"street":"1553 Bark Street","town":"Gosport","zip":"BB9 5WF"},"dispatchCourierRef":"RoyalMail7732058936313772"}
```

By default, `couchrecoverid` will return the entire history of a single document (or at least the history recorded in your snapshot archive), or you can elect to see only the newest revision with `--latest true`.

## Recovering a whole database from a known timestamp

To recover an entire database up to a known timestamp simply run:

```sh
$ couchrecoverdb --db orders --timestamp 2019-10-08T10:43:53.569Z
```

where `2019-10-08T10:43:53.569Z` is a valid timestamp from one of your snapshots. This snapshot and the preceeding ones will be used to recreate the data up until that point.

The data is sent to _stdout_ and can redirected to a file with:

```sh
$ couchrecoverdb --db orders --timestamp 2019-10-08T10:43:53.569Z > orders.txt
```

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

- `--database`/`--db`/`-d` - the database snapshot archive to inspect.
- `--id`/`-i` - the document id to recover.
- `--latest`/`-l` - only retrieve one document revision (the newest one) - default: false.

e.g.

```sh
# recover a single document by its id
$ couchrecoverid --database cities --id 125242 --latest true

From backup taken on  2019-10-08T13:25:56.541Z 

{"_id":"100425","_rev":"3-c296e253d9dd65cc04afd1ebd336d31b","name":"Yanbu","latitude":24.08912,"longitude":38.06376,"country":"SA","population":200161,"timezone":"Asia/Riyadh"}
```

### couchrecoverdb

Retrieves an entire database from the snapshot archive. Outputs to _stdout_. The utility ensures
that each document id is only written once.

- `--database`/`--db`/`-d` - the database snapshot archive to inspect.
- `--timestamp`/`-t` - the timestamp to recover to.
- `--selector`/`-s` - the Mango selector definining the sub-set of data to recover.

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

To recover a sub-set of data, supply a `--selector`/`-s` parameter with a JSON Mango selector e.g.:

```sh
# recover only British cities
couchrecoverdb --db cities --timestamp 2019-10-08T13:25:56.541Z --selector '{"country":"GB"}' > britishcities.txt
# recover only cities with a population over 1m
couchrecoverdb --db cities --timestamp 2019-10-08T13:25:56.541Z --selector '{"population":{"$gt":1000000}}' > britishcities.txt
```

## How does it work?

The _couchsnapshot_ utility simply takes a copy of the winning revisions of each document in a database by consuming a databases's changes feed. The data is stored in a local LevelDB database - one LevelDB database per snapshot, where each key/value pair represents a document. Additional data such as the last sequence number and timestamp is added to each database. 

LevelDB was chosen because it is fast enough to keep up with the CouchDB changes feed and the data is compressed at rest making the snapshots nice and small. The LevelDB database is optimised for retrieval of documents by id, nothing else.

To recover a document by id, the LevelDB snapshot databases are interrogated in turn for a matching document (there may be several versions of the same document across the snapshots reflecting different document revisions over time). The snapshots are interrogated in newest-to-oldest order.

To recover an entire database, the snapshots are interrogated in reverse (so newest to oldest) outputing each document but taking care to ensure that each document only appears once. A temporary LevelDB database is used to keep track of document ids already processed.

## Limitations

- This tooling doesn't necessarily backup every revision of every document - revisions that occurred between snapshots are ignored.
- Only winning revisions make it the snapshot archive. If a document is conflicted, non-winning revisions are ignored.
- CouchDB attachments are not fetched. Only JSON document bodies.
- Index data (such as MapReduce indexes) are not backed up, but the index definitions (stored in Design Documents) do make it to the snapshot archive.

It is not possible to "roll back" a CouchDB database to a point in time. This utility allows a new, empty database to be populated so that it looks like the snapshotted databases did at the time it was snapshotted.