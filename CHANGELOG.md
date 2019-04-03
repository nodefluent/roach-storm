# roach-storm CHANGELOG

## 2019-04-03, Version 0.9.0

* updated dependencies
* fixed bug in topic-config deletion
* switched metrics from names to buckets
* added ?clean=1 query option for PUT topic-config/many

## 2019-03-29, Version 0.8.0-0.8.1

* updated dependencies
* added option to mirror messages from pubsub topic to kafka topics

## 2019-03-15, Version 0.7.0

* updated dependencies

## 2019-03-14, Version 0.6.0

* **BREAKING** changed the TopicConfig resource
* added pipes option for multiple pubsub targets
* added filter option for pipes to select specific messages

## 2019-03-12, Version 0.5.0

* upgraded dependencies
* **BREAKING** added new way of dealing with message batches by sorting and chunking them based on topicPartitions
* added chunkSize to topicConfig
* added new metrics

## 2019-03-07, Version 0.3.0-0.4.0

* added batching for kafka messages

## 2019-03-07, Version 0.2.0

* added pub sub publishing
* added targetTopic to topic config

## 2019-03-07, Version 0.1.0

* Initial release with changelog