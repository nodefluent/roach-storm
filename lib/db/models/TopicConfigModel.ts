import * as Debug from "debug";
import { TopicConfig } from "../../interfaces/TopicConfig";
const debug = Debug("roach:model:topicconfig");

import RoachStorm from "../../RoachStorm";
import { Metrics } from "../../Metrics";
import MongoWrapper from "../MongoWrapper";

export class TopicConfigModel {

    public readonly metrics: Metrics;
    public readonly mongoWrapper: MongoWrapper | null;
    public readonly name: string;
    private model: any;

    constructor(roachStorm: RoachStorm, mongoWrapper: MongoWrapper | null = null) {
        this.metrics = roachStorm.metrics;
        this.mongoWrapper = mongoWrapper;
        this.name = "topicconfig";
        this.model = null;
    }

    public registerModel(mongoose: any, schemaConstructor: any) {

        const schemaDefinition = {
            topic: String,
            timestamp: Number,
            parseAsJson: Boolean,
            targetTopic: String,
            chunkSize: Number,
        };

        const schema = new schemaConstructor(schemaDefinition);

        schema.index({ topic: 1, type: -1});

        this.model = mongoose.model(this.name, schema);

        this.model.on("index", (error: Error) => {

            if (error) {
                debug("Index creation failed", error.message);
            } else {
                debug("Index creation successfull.");
            }
        });

        debug("Registered model with schema.");
    }

    public get(topic: string): Promise<TopicConfig> {
        return this.model.findOne({ topic }).lean().exec();
    }

    public async listAsTopics(): Promise<string[]> {
        const topicConfigs = await this.list();
        return topicConfigs.map((topicConfig) => topicConfig.topic);
    }

    public list(): Promise<TopicConfig[]> {
        return this.model.find({}).lean().exec().then((topicConfigs: any[]) => {
            return topicConfigs.map((topicConfig: any) => {

                const responseTopicConfig: TopicConfig = {
                    topic: topicConfig.topic,
                    timestamp: topicConfig.timestamp,
                    parseAsJson: topicConfig.parseAsJson,
                    targetTopic: topicConfig.targetTopic,
                };

                return responseTopicConfig;
            });
        });
    }

    public upsert(topic: string, targetTopic: string, chunkSize: number = 1,
                  timestamp: number = Date.now(), parseAsJson: boolean = false): Promise<TopicConfig> {

        const document = {
            topic,
            timestamp,
            parseAsJson,
            targetTopic,
            chunkSize,
        };

        const query = {
            topic,
        };

        const queryOptions = {
            upsert: true,
        };

        return this.model.findOneAndUpdate(query, document, queryOptions).exec();
    }

    public delete(topic: string) {
        return this.model.deleteMany({topic}).exec();
    }

    public truncateCollection() {
        debug("Truncating collection");
        return this.model.deleteMany({}).exec();
    }
}
