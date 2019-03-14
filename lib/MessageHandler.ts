import * as Debug from "debug";
import * as R from "ramda";
import * as moment from "moment";
const debug = Debug("roach:handler");

import RoachStorm from "./RoachStorm";
import { KafkaMessage, SortedMessageBatch } from "sinek";
import MongoPoller from "./db/MongoPoller";
import { Metrics } from "./Metrics";
import { TopicConfig, TopicConfigPipe } from "./interfaces/TopicConfig";
import MongoWrapper from "./db/MongoWrapper";
import PubSubHandler from "./PubSubHandler";
import { ParsedMessage } from "./interfaces";

export default class MessageHandler {

    private readonly mongoPoller: MongoPoller;
    private readonly metrics: Metrics;
    private readonly mongoWrapper: MongoWrapper;
    private readonly pubSubHandler: PubSubHandler;

    constructor(roachStorm: RoachStorm) {
        this.mongoPoller = roachStorm.mongoPoller;
        this.metrics = roachStorm.metrics;
        this.mongoWrapper = roachStorm.mongoWrapper;
        this.pubSubHandler = roachStorm.pubSubHandler;
    }

    public findConfigForTopic(topic: string): TopicConfig | null {

        const topicConfigs = this.mongoPoller.getCollected().topicConfigs;
        for (let i = topicConfigs.length - 1; i >= 0; i--) {
            if (topicConfigs[i].sourceTopic === topic) {
                return topicConfigs[i];
            }
        }

        return null;
    }

    public static cleanTopicNameForMetrics(topic: string): string {
        return topic.replace(/-/g, "_");
    }

    public handleSortedMessageBatch(sortedBatch: SortedMessageBatch): Promise<string[][][][]> {

        // parallel processing on topic level
        const topicPromises = Object.keys(sortedBatch).map((topic: string) => {

            const topicConfig = this.findConfigForTopic(topic);
            if (!topicConfig) {
                this.metrics.inc("processed_messages_failed_no_config");
                throw new Error("topic configuration missing for topic " + topic);
            }

            // parallel processing on partition level
            const partitionPromises = Object.keys(sortedBatch[topic]).map((partition: string) => {

                // sequential processing on message level (to respect ORDER)
                const messages = sortedBatch[topic][partition]
                    .map((message) => this.handleMessage(message, topicConfig.parseAsJson))
                    .filter((message) => !!message) as ParsedMessage[];

                return Promise.all(topicConfig.pipes.map((pipe) => {
                    return this.processMessagesOnPipe(pipe, messages);
                }));
            });

            // wait until all partitions of this topic are processed and commit its offset
            return Promise.all(partitionPromises);
        });

        return Promise.all(topicPromises);
    }

    private async processMessagesOnPipe(pipe: TopicConfigPipe, messages: ParsedMessage[]) {

        if (!pipe.publishTombstones) {
            messages = messages.filter((message) => {
                return !(message.value === null || message.value === "null" || typeof message.value === "undefined");
            });
        }

        if (!pipe.filter || Object.keys(pipe.filter).length === 0) {
            return this.publishMessagesChunkified(messages, pipe.targetTopic, pipe.chunkSize);
        }

        const messageFilter = R.allPass(Object.keys(pipe.filter).map((key: string) => {

            if (key.indexOf("[") !== -1 || key.indexOf("]") !== -1) {
                throw new Error("Character not allowed in filter key [], only dot strings as path allowed.");
            }

            if (Array.isArray(pipe.filter[key]) || (typeof pipe.filter[key] === "object"
                && pipe.filter[key] !== null)) {
                throw new Error(
                    "Filter field values, must not be arrays or objects, please resolve via flat string paths. " + key);
            }

            return R.pathEq(key.split("."), pipe.filter[key]);
        }));

        messages = messages.filter((message) => {
            return messageFilter(message);
        });

        return this.publishMessagesChunkified(messages, pipe.targetTopic, pipe.chunkSize);
    }

    private publishMessagesChunkified(messages: ParsedMessage[], targetTopic: string, chunkSize: number = 1):
        Promise<string[]> {

        if (!messages.length) {
            return Promise.resolve([]);
        }

        let index = 0;
        let chunk: ParsedMessage[] = [];
        const chunkPromises = [];
        for (const message of messages) {
            index++;
            chunk.push(message);
            if (chunk.length && (chunk.length >= chunkSize || index >= messages.length - 1)) {
                chunkPromises.push(this.pubSubHandler.publish(targetTopic, JSON.stringify(chunk)));
                chunk = [];
            }
        }

        return Promise.all(chunkPromises);
    }

    private handleMessage(message: KafkaMessage, parseAsJson: boolean = false): ParsedMessage | null {

        this.metrics.inc("processed_messages");

        if (!message || !message.topic || typeof message.topic !== "string" || typeof message.partition !== "number") {
            this.metrics.inc(`message_dropped_${MessageHandler.cleanTopicNameForMetrics(message.topic)}`);
            debug("Dropping message because of bad format, not an object or no topic", message);
            return null;
        }

        if (!this.mongoWrapper.isConnected()) {
            throw new Error("MongoDB connection is not established.");
        }

        const startTime = Date.now();
        let keyAsBuffer: Buffer | null = null;
        let keyAsString: string | null = null;

        if (message.key) {
            if (Buffer.isBuffer(message.key)) {
                keyAsBuffer = message.key;
                keyAsString = message.key.toString("utf8");
            } else {
                keyAsBuffer = Buffer.from(message.key);
                keyAsString = message.key + "";
            }
        }

        const messageHasTimestamp = (message as any).timestamp && typeof (message as any).timestamp === "number";
        const timeOfStoring = moment().valueOf();

        // try to strip the value as raw, yet parsed as possible before storing
        // happy path here is to turn a message buffer into its JSON object and store as such
        // in case the value does not contain a JSON payload, it should be stored as RAW (message.value) representative
        // NOTE: Also check if topic shold be queryable, otherwise message value should be stored as buffer
        let alteredMessageValue = null;
        if (message.value && parseAsJson) {

            if (Buffer.isBuffer(message.value)) {
                alteredMessageValue = message.value.toString("utf8");
            } else {
                alteredMessageValue = message.value;
            }

            try {
                alteredMessageValue = JSON.parse(alteredMessageValue);
                // no way to validate the output here
            } catch (_) {
                alteredMessageValue = message.value;
            }
        }
        // elif - always ensure we store value as buffer
        if (message.value && !parseAsJson) {
            if (Buffer.isBuffer(message.value)) {
                alteredMessageValue = message.value;
            } else {
                if (typeof message.value !== "string") {
                    alteredMessageValue = Buffer.from(JSON.stringify(message.value));
                } else {
                    alteredMessageValue = Buffer.from(message.value);
                }
            }
        }

        const parsedMessage: ParsedMessage = {
            key: parseAsJson && keyAsString ? keyAsString : keyAsBuffer,
            timestamp: messageHasTimestamp ? (message as any).timestamp : timeOfStoring,
            partition: message.partition,
            offset: message.offset,
            value: alteredMessageValue,
            processedAt: timeOfStoring,
        };

        const duration = Date.now() - startTime;
        this.metrics.set("processed_message_ms", duration);
        this.metrics.inc("processed_messages_success");

        return parsedMessage;
    }
}
