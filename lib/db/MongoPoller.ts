import * as EventEmitter from "events";
import * as Debug from "debug";
const debug = Debug("roach:mongopoller");

import MongoWrapper from "./MongoWrapper";
import { TopicConfigModel } from "./models";
import { TopicConfig } from "../interfaces";
import Discovery from "../kafka/Discovery";
import { Metrics } from "../Metrics";

export default class MongoPoller extends EventEmitter {

    public collected: {
        topicConfigs: TopicConfig[],
    };

    private readonly metrics: Metrics;
    private readonly topicConfigModel: TopicConfigModel;
    private intv: any;
    private topicConfigHash: number;

    constructor(mongoWrapper: MongoWrapper, metrics: Metrics) {
        super();

        this.topicConfigModel = mongoWrapper.getTopicConfig();
        this.metrics = metrics;
        this.intv = null;
        this.topicConfigHash = 0;
        this.collected = {
            topicConfigs: [],
        };
    }

    public async start(intervalMs = 15000) {

        this.close();

        this.intv = setInterval(() => {
            this.onInterval()
                .then(() => {
                    this.emit("updated", this.collected);
                })
                .catch((error) => {
                    this.emit("error", error);
                });
        }, intervalMs);

        // poll once initially
        await this.onInterval();
        this.emit("updated", this.collected);
        debug("Initial poll done.");
    }

    public close() {

        if (this.intv) {
            clearInterval(this.intv);
        }
    }

    public getCollected() {
        return this.collected;
    }

    private async onInterval() {

        this.metrics.inc("job_poll_ran");

        const topicConfigs = await this.topicConfigModel.list();
        this.metrics.set("configured_topics", topicConfigs.length);

        const topics = topicConfigs.map((topicConfig) => topicConfig.sourceTopic);
        const newTopicConfigHash = Discovery.arrayToFixedHash(topics);
        if (this.topicConfigHash !== newTopicConfigHash) {
            this.topicConfigHash = newTopicConfigHash;
            this.metrics.inc("configured_topics_changed");
            this.emit("topic-config-changed", topics);
        }

        this.collected = Object.assign(this.collected, {
            topicConfigs,
        });

        this.metrics.inc("job_poll_ran_success");
    }
}
