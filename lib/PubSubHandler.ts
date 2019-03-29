import { PubSub, Subscription } from "@google-cloud/pubsub";

import { RoachConfig } from "./interfaces";
import RoachStorm from "./RoachStorm";
import MessageHandler from "./MessageHandler";

export default class PubSubHandler {

    private client: PubSub;
    private roachStorm: RoachStorm;

    constructor(config: RoachConfig, roachStorm: RoachStorm) {
        this.client = new PubSub(config.pubSubConfig);
        this.roachStorm = roachStorm;
    }

    public async publish(topic: string, message: string): Promise<string> {

        const messageId = await this.client
            .topic(topic)
            .publish(Buffer.from(message));

        this.roachStorm.metrics.inc(`pubsub_msg_out_´${(MessageHandler.cleanTopicNameForMetrics(topic))}`);
        return messageId;
    }

    public async subscribe(topicName: string, subscriptionName: string = "roach-storm-v1"): Promise<Subscription> {

        const options = {
            flowControl: {
                maxBytes: 1024 * 8,
                maxMessages: 1000,
            },
        };

        const topic = this.client.topic(topicName);
        const subscription = topic.subscription(subscriptionName, options);

        const [ newSubscription ] = await subscription.get({
            autoCreate: true,
        });

        // subscription is not deleted on close
        // as keeping it open will store the messages (for a given retention)
        // in case we have to restart or have downtimes

        return newSubscription;
    }
}
