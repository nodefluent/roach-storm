# roach-storm

```text
    ____                   __   _____ __                     
   / __ \____  ____ ______/ /_ / ___// /_____  _________ ___ 
  / /_/ / __ \/ __ `/ ___/ __ \\__ \/ __/ __ \/ ___/ __ `__ \
 / _, _/ /_/ / /_/ / /__/ / / /__/ / /_/ /_/ / /  / / / / / /
/_/ |_|\____/\__,_/\___/_/ /_/____/\__/\____/_/  /_/ /_/ /_/ 
```

## What

Apache Kafka to Google Pub/Sub Gateway, API controlled.
Helper for Google Cloud Function Services that are built upon Apache Kafka.

## How

You can manage topics to be transferred on the fly via `/api/topic-config` and 
roach-storm will keep track of anything that goes through your Apache Kafka cluster.
Messages are filtered and published on Google Cloud Pub/Sub service.
It also ships a few additional tools to make the Google Cloud Functions live easier,
e.g. handling metrics or producing back to Apache Kafka.

## Why

As of now (Q1 2019) services like Google Cloud Functions do not have the ability
to be triggered or integrated into Apache Kafka directly.

## Requirements

* Node.js >= 9.x.x (we suggest >= 10.11.x)
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
You will have to provide the following information in the body `{ sourceTopic, parseAsJson, pipes }`.

If you configure a topic, it will be consumed from earliest.

**Please note** that any changes on the topic-config resource will take a few seconds to be polled and applied to all roach-storm instances.

**Please note** that roach-storm will not create PubSub topics for you, you will have to create the topics beforehand.

#### TopicConfig

* `sourceTopic` (string) (is required) is the name of the Kafka topic (you can fetch available topics via `GET /api/info/topics/available`)
* `parseAsJson` (boolean) (default is true) if this is false the message (key and value) fields are passed as Buffers
* `pipes` (Array[Pipe]) (is required) defines where the kafka messages should be published too, of course you can
add multiple pipes for the same topic to filter and publish specific messages to different pubsub topics

#### TopicConfigPipe

* `targetTopic` (string) (is required) is the name for the Google PubSub topic where the message should be published to
* `chunkSize` (number) (default is 1) the amount of kafka messages (based on topic and partition) to batch into a single
pub sub message
* `publishTombstones` (boolean) (default is false) if null value kafka messages should be published
* `filter` (object) (default is undefined) using this object a filter can be build for a pipe, this way you can
publish specific messages to a specific pubsub topic (this can save a lot of costs) as you do not waste function triggers
for example:

##### Filter Example

Assume the following messages on your topic: `{ value: { payload: { eventType: "my-cool-type", version: 5  }}}`
You can add a filter to a pipe to publish only these certain messages:

```javascript
const topicConfig = {
  sourceTopic: "my-topic",
  parseAsJson: true, // please always do this, if you want to use filters on values
  pipes: [
    {
      targetTopic: "pubsub-all-with-version-five",
      chunkSize: 5,
      publishTombstones: false,
      filter: {
        "value.payload.version": 5,
      },
    },
    {
      targetTopic: "pubsub-cool-with-version-six",
      chunkSize: 5,
      publishTombstones: false,
      filter: {
        "value.payload.eventType": "my-cool-type",
        "value.payload.version": 6,
      },
    },
  ],
};
```

In this scenario roachstorm will consume the topic `my-topic` filter out all tombstone messages
and publish all kafka messages with payload.version equal to 5 to pubsub topic `pubsub-all-with-version-five`
and at the same time all kafka messages with payload.eventType my-cool-type and payload.version equal to 6
to pubsub topic `pubsub-cool-with-version-six`.

## Testing filters or producing some test messages to pubsub topics

You can use the `/api/produce/kafka-batch` endpoint to easily mimic some kafka messages
that are flushed through your configured roach-storm topics and filters and should be published
to your configured pubsub topics.

```bash
curl -X POST \
  http://localhost:1919/api/produce/kafka-batch \
  -H 'Authorization: your-roach-storm-token-here' \
  -H 'Content-Type: application/json' \
  -H 'cache-control: no-cache' \
  -d '{
	"batch": {
		"some-kafka-topic": {
			"0": [
				{
					"topic": "some-kafka-topic",
					"partition": 0,
					"key": "cbedcd96-3de5-4649-ba5b-5788cabdb894",
					"value": {}
				}
			]
		}
	}
}'
```

## Defining a Bridge from PubSub to Apache Kafka

roach-storm is also able to move publish events from pubsub topics to Apache Kafka.
You can configure a mirror pubsub topic that roach-storm will subscribe to (during start)
by setting the config field: `pubSubToKafkaTopicName` (if you leave it empty or set it to null there
will be no mirroring from pubsub to kafka, only from kafka to pubsub).

The pubsub topic should contain events with data like so:
```javascript
event.data = Buffer.from(JSON.stringify([
  {
    topic: "a-target-kafka-topic", // required
    value: "some value", // if set to null and key is present a tombstone messages will be produced
    key: null, // optional
    partition: null, // optional
  }, // you can pass multiple messages for different topics and partitions in the same pubsub message
))];
```

If a produce error occures, roachstorm will not send pubsub acks and the subscription will halt.
Errors, writes and acks are exposed via metrics.

## Handling metrics from GCF

By simply passing the `gcf` object in the configuration
you can easily enable the subcription of a pubsub topic to render prometheus metrics
along with a different set of prefixes and labels.

```javascript
gcf: {
      metrics: {
          pubSubMetricTopic: null,
          counterLabels: [],
          gaugeLabels: [],
          prefix: "gcf_roach",
      },
  },
```

The pubsub topic should contain events with data like so:
```javascript
event.data = Buffer.from(JSON.stringify([
  {
    metric: "my_calls", // the name of the metric
    type: "counter", // counter or gauge
    value: 1, // couter increment by or gauge value set
    labels: { "special": "bla" }, // make sure that these labels (keys) are already set in the config (counterLabels, gaugeLabels)
  }, // you can of course sent multiple metrics per pubsub message
))];
```

If an error occures it will be logged and internal metrics will show them, however they will be ignored afterwards
and acks will be sent to pubsub.

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
* `PUBSUB_PROJECT_ID=my-project-id` -> turns into `options.pubSubConfig.projectId = "123";`

The kafka env values will set consumer and producer at the same time.

## Maintainer

Christian Fröhlingsdorf [@chrisfroeh](https://twitter.com/chrisfroeh)

Build with :heart: :pizza: and :coffee: by [nodefluent](https://github.com/nodefluent)

## Disclaimer

This software is not associated with Google.
