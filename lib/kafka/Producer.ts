import * as Debug from "debug";
const debug = Debug("roach:producer");

import { NProducer } from "sinek";
import RoachStorm from "../RoachStorm";
import { KafkaConfig } from "../interfaces";
import MessageHandler from "../MessageHandler";

export default class Producer {

    private readonly config: KafkaConfig;
    private readonly roachStorm: RoachStorm;
    private producer: NProducer | null;
    private producedLately: number = 0;
    private intv: any;

    constructor(config: KafkaConfig, roachStorm: RoachStorm) {
        this.config = config;
        this.roachStorm = roachStorm;
        this.producer = null;

        this.intv = setInterval(() => {

            if (this.producedLately > 0) {
                debug("Produced", this.producedLately, "messages lately");
                this.producedLately = 0;
            }

        }, 45000);
    }

    public async start() {

        debug("Connecting..");

        this.producer = new NProducer(this.config.producer, null, this.config.defaultPartitions);

        await this.producer.connect();

        debug("Connected.");
    }

    public produceMessage(topic: string, partition: number | null = null,
                          key: string | null = null, value: any = null): Promise<any> {

        if (!this.producer) {
            throw new Error("Producer is not ready to produce yet.");
        }

        if (typeof value !== "string") {
            value = JSON.stringify(value);
        }

        if (!Buffer.isBuffer(value)) {
            value = Buffer.from(value);
        }

        this.roachStorm.metrics.inc(`kafka_msg_out`, 1, { topic });
        this.producedLately++;
        return this.producer.send(topic, value, (partition as any), (key as any));
    }

    public produceTombstone(topic: string, key: string, partition?: any): Promise<any> {

        if (!this.producer) {
            return Promise.resolve(null);
        }

        this.roachStorm.metrics.inc(`kafka_tomb_out, 1, { topic }}`);
        this.producedLately++;
        return this.producer.tombstone(topic, key, partition);
    }

    public getKafkaStats() {
        return this.producer ? this.producer.getStats() : {};
    }

    public getTopicMetadata(): Promise<any> {
        return this.producer ? this.producer.getMetadata(2500) : Promise.resolve({});
    }

    public async close() {

        debug("Closing..");

        if (this.intv) {
            clearInterval(this.intv);
        }

        if (this.producer) {
            this.producer.close();
            this.producer = null;
        }
    }
}