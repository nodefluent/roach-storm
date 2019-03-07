import {PubSub} from "@google-cloud/pubsub";

import { RoachConfig } from "./interfaces";

export default class PubSubHandler {

    private client: PubSub;

    constructor(config: RoachConfig) {
        this.client = new PubSub(config.pubSubConfig);
    }

    public async publish(topic: string, message: string) {

        const messageId = await this.client
            .topic(topic)
            .publish(Buffer.from(message));

        return messageId;
    }
}
