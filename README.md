# roach-storm

```text
    ____                   __   _____ __                     
   / __ \____  ____ ______/ /_ / ___// /_____  _________ ___ 
  / /_/ / __ \/ __ `/ ___/ __ \\__ \/ __/ __ \/ ___/ __ `__ \
 / _, _/ /_/ / /_/ / /__/ / / /__/ / /_/ /_/ / /  / / / / / /
/_/ |_|\____/\__,_/\___/_/ /_/____/\__/\____/_/  /_/ /_/ /_/ 
```

## What

Apache Kafka to Google Pub/Sub Gateway, API controlled

## How

You can manage topics to be transferred on the fly via `/api/topic-config` and 
roach-storm will keep track of anything that goes through your Apache Kafka cluster.
Messages are filtered and published on Google Cloud Pub/Sub service.

## Why

As of now (Q1 2019) services like Google Cloud Functions do not have the ability
to be triggered or integrated into Apache Kafka directly.

## Requirements

* node.js >= 9.x.x (we suggest >= 10.11.x)
* Apache Kafka >= 0.11.x (we suggest >= 1.x.x)
* MongoDB >= 3.2 (we suggest >= 4.x)

## Install

As simple as `yarn global add roach-storm`.

(_NOTE: In case you dont have yarn run `npm i -g yarn` first._)

## Run

`roach-storm "./baseConfig.js"`

You just have to throw in a config (JSON or JS).
[A base config is always used](bin/baseConfig.js), so you just have to overwrite
your specific requirements.

Check out `roach-storm -h` for other options.

## Using

With any HTTP client.

Checkout the API quick start or the setup infos below.

## API Quick Start

### Getting general info about roach-storm and your Kafka clusters

You can get an overview of possible API actions by calling `GET /api/info`.

### Configuring Kafka topics for roach-storm

By default roach-storm, will connect and fetch some information about your Kafka cluster. 
But it wont start transferring topics/messages yet. You will have to configure topics so that they will be consumed
and processed.

You can do that by providing a small configuraton in a `POST /api/config/topic` call.
You will have to provide the following information in the body `{ topic, parseAsJson }`.

* `topic` (string) (is required) is the name of the Kafka topic (you can fetch available topics via `GET /api/info/topics/available`)
* `parseAsJson` (boolean) (default is false) if this is false the message (key and value) fields are passed as Buffers, in case you set this
to true, the message key will be passed as string (if possible) and the value will be passed as parsed JSON body (if possible).

If you configure a topic, it will be consumed from earliest.

Please note that any changes on the topic-config resource will take a few seconds to be polled and applied to all roach-storm instances.

## Setup Info

### Deployment & Scaling

roach-storm as process is limited to a single CPU core and does not require too much memory (depending on Kafka consumer configuration) as well. About 0.1 CPU and 150 MB RAM with default configuration can be sufficient.

But **roach-storm is build to scale horizontally**, just spin up a few containers (see Dockerfile example) and scale up. In production environments we suggest to have as many instances are the largest amount of partitions configured for a Kafka topic in your cluster.

### Metrics

You can monitor roach-storm via Prometheus at `http://localhost:1919/metrics`.

### Access Management

roach-storm allows _fine grained_ access management with a similiar span of what Kafka ACLs allow you to do on a per topic basis.
You define tokens as keys in the configs http access object and set the topic names or special rights as string members of the key's array value. A wildcard `*` grants all rights.

e.g.

```javascript
const config = {
  http: {
    access: {
      "my-crazy-secure-token-string": [ "__topic", "on-some-topic" ],
      "token-for-some-topics": [ "customers", "baskets", "orders" ],
      "token-for-admin": [ "*" ]
    }
  }
};
```

When making calls to roach-storm's HTTP API the token is provided in the `authorization` header.

* `*` Allows every operation
* `__topic` Is allowed to configure topics (only for provided topics)

Be aware that the default configuration is a wildcard for everything. (Meaning no token is required).
Never expose roach-storm's HTTP interface publicly.

### Config via Environment Variables

It is possible to set a few config parameters (most in role of secrets) via environment variables.
They will always overwrite the passed configuration file.

* `MONGODB_URL="mongodb://localhost:27017"` -> turns into: `config.mongo.url = "mongodb://localhost:27017";`
* `MONGODB_USERNAME=admin` -> turns into: `config.mongo.options.user = "admin";`
* `MONGODB_PASSWORD=admin` -> turns into: `config.mongo.options.pass = "admin";`
* `MONGODB_DBNAME=roach_prod` -> turns into: `config.mongo.options.dbName = "roach_prod";`
* `KAFKA_BROKER_LIST=kafka-1:9093,kafka-2:9093` -> turns into: `config.kafka.consumer.noptions["metadata.broker.list"] = "kafka-1:9093";`
* `KAFKA_SSL_PASSPHRASE="123456"` -> turns into: `config.kafka.consumer.noptions["ssl.key.password"] = "123456";`
* `KAFKA_SASL_USERNAME="123456"` -> turns into: `config.kafka.consumer.noptions["sasl.username"] = "123456";`
* `KAFKA_SASL_PASSWORD="123456"` -> turns into: `config.kafka.consumer.noptions["sasl.password"] = "123456";`
* `ACL_DEFINITIONS="mytoken=topic1,topic2;othertoken=topic3" roach-storm -l "./config.json"` -> turns into: `config.http.access.mytoken = [ "topic1", "topic2" ];`

The kafka env values will set consumer and producer at the same time.

## Maintainer

Christian Fröhlingsdorf [@chrisfroeh](https://twitter.com/chrisfroeh)

Build with :heart: :pizza: and :coffee: by [nodefluent](https://github.com/nodefluent)
