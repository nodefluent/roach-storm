import * as Debug from "debug";
const debug = Debug("roach:consumer");

import { NConsumer, SortedMessageBatch } from "sinek";
import RoachStorm from "../RoachStorm";
import { KafkaConfig } from "../interfaces";
import MessageHandler from "../MessageHandler";

export default class Consumer {

    private readonly config: KafkaConfig;
    private readonly roachStorm: RoachStorm;
    private consumer: NConsumer | null;
    private consumedLately: number = 0;
    private intv: any;

    constructor(config: KafkaConfig, roachStorm: RoachStorm) {
        this.config = config;
        this.roachStorm = roachStorm;
        this.consumer = null;

        this.intv = setInterval(() => {

            if (this.consumedLately > 0) {
                debug("Consumed", this.consumedLately, "messages lately");
                this.consumedLately = 0;
            }

        }, 45000);
    }

    private async processMessagesWithRetry(messages: SortedMessageBatch, attempts = 0):
        Promise<boolean> {
        try {
            debug("Processing messages", messages.length, "with attempt", attempts);
            attempts++;
            await this.roachStorm.messageHandler.handleSortedMessageBatch(messages);
            return true;
        } catch (error) {
            debug("Failed to process kafka message, attempt", attempts, "with error", error.message);
            return (new Promise((resolve) => setTimeout(resolve, attempts * 1000)))
                .then(() => {
                    return this.processMessagesWithRetry(messages, attempts);
                });
        }
    }

    public async start() {

        debug("Connecting..");

        this.consumer = new NConsumer([], this.config.consumer);

        await this.consumer.connect();

        this.consumer.on("message", (message) => {
            this.roachStorm.metrics.inc(`kafka_msg_in`, 1, { topic: message.topic });
            this.consumedLately++;
        });

        this.consumer.consume(async (messages: any, callback) => {
            await this.processMessagesWithRetry(messages as SortedMessageBatch);
            callback();
        }, false, false, this.config.batchOptions);

        this.consumer.enableAnalytics({
            analyticsInterval: 1000 * 60 * 4,
            lagFetchInterval: 1000 * 60 * 8,
        });

        debug("Connected.");
    }

    public getAnalytics() {
        return this.consumer ? this.consumer.getAnalytics() : null;
    }

    public getLagStatus() {
        return this.consumer ? this.consumer.getLagStatus(false) : null;
    }

    public adjustSubscriptions(topics: string[]) {

        if (this.consumer) {
            debug("Adjusting topic subscription", topics.length);
            this.consumer.adjustSubscription(topics);
        }
    }

    public getKafkaClient() {
        return this.consumer;
    }

    public getKafkaStats() {
        return this.consumer ? this.consumer.getStats() : {};
    }

    public getTopicMetadata(): Promise<any> {
        return this.consumer ? this.consumer.getMetadata(2500) : Promise.resolve({});
    }

    public async close() {

        debug("Closing..");

        if (this.intv) {
            clearInterval(this.intv);
        }

        if (this.consumer) {
            this.consumer.haltAnalytics();
            await this.consumer.close(true);
            this.consumer = null;
        }
    }
}
