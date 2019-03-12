import {PubSub} from "@google-cloud/pubsub";

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

        this.roachStorm.metrics.inc(`message_outgoing_${(MessageHandler.cleanTopicNameForMetrics(topic))}`);
        return messageId;
    }
}
