import * as Debug from "debug";
const debug = Debug("roach:roach");

import RoachStorm from "./RoachStorm";
import { Message } from "@google-cloud/pubsub";

export default class PubSubToKafka {

    private readonly roachStorm: RoachStorm;
    private messageHandlerRef: any;
    private subscriptionRef: any;

    constructor(roachStorm: RoachStorm) {
        this.roachStorm = roachStorm;
    }

    public async start() {
        debug("Starting pubsub to kafka bridge.");

        if (this.subscriptionRef) {
            throw new Error("Subcription already opened.");
        }

        if (!this.roachStorm.config.pubSubToKafkaTopicName) {
            throw new Error("No pub sub topic name provided.");
        }

        this.subscriptionRef = await
            this.roachStorm.pubSubHandler.subscribe(this.roachStorm.config.pubSubToKafkaTopicName);

        this.messageHandlerRef = this.messageHandler.bind(this);
        this.subscriptionRef.on("message", this.messageHandlerRef);
        debug("Pubsub to kafka bridge is ready.");
    }

    public async close() {
        debug("Stopping pubsub to kafka bridge.");
        if (this.subscriptionRef) {
            this.subscriptionRef.removeListener("message", this.messageHandlerRef);
            this.subscriptionRef = null;
        }
    }

    private messageHandler(message: Message) {

        const topic = this.roachStorm.config.pubSubToKafkaTopicName || "missing_name";

        this.roachStorm.metrics.inc(`pubsub_msg_in`, 1, { topic });

        try {
            let messages = JSON.parse(message.data.toString("utf8"));
            if (!Array.isArray(messages)) {
                messages = [messages];
            }

            Promise.all(messages.map((kafkaMessage: any) => {

                if (!kafkaMessage ||
                    typeof kafkaMessage !== "object" ||
                    !kafkaMessage.topic ||
                    typeof kafkaMessage.topic !== "string" ||
                    typeof kafkaMessage.value === "undefined") {
                        debug("Dropping kafka message (from pubsub) for bad value:", kafkaMessage);
                        return Promise.resolve(null);
                    }

                if (kafkaMessage.value === null && kafkaMessage.key) {
                    debug("Identified tombstone from pubsub:", kafkaMessage.topic, kafkaMessage.key);
                    return this.roachStorm.producer
                        .produceTombstone(kafkaMessage.topic, kafkaMessage.string, kafkaMessage.partition);
                }

                return this.roachStorm.producer
                    .produceMessage(kafkaMessage.topic, kafkaMessage.partition, kafkaMessage.key, kafkaMessage.value);

            })).then((_) => {
                message.ack();
                this.roachStorm.metrics.inc(`pubsub_ack`, 1, { topic });
            }).catch((error) => {
                debug("Failed to handle kafka messages from pubsub:", error.message);
                // ack here, message consumption will stop
                debug("You will have to restart this instance after connection has been fixed.");
                this.roachStorm.metrics.inc(`pubsub_msg_error`, 1, { topic });
            });
        } catch (error) {
            debug("Failed to parse pubsub value:", error.message, message.data);
            message.ack();
            this.roachStorm.metrics.inc(`pubsub_msg_parse_error`, 1, { topic });
        }
    }
}
