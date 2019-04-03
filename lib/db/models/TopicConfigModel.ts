import * as Debug from "debug";
import * as Mongoose from "mongoose";
import { TopicConfig, TopicConfigPipe } from "../../interfaces/TopicConfig";
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
            sourceTopic: String,
            parseAsJson: Boolean,
            timestamp: Number,
            pipes: [
                {
                    targetTopic: String,
                    filter: Mongoose.Schema.Types.Mixed,
                    chunkSize: Number,
                    publishTombstones: Boolean,
                },
            ],
        };

        const schema = new schemaConstructor(schemaDefinition);

        schema.index({ sourceTopic: 1, type: -1});

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
        return topicConfigs.map((topicConfig) => topicConfig.sourceTopic);
    }

    public list(): Promise<TopicConfig[]> {
        return this.model.find({}).lean().exec();
    }

    public upsert(sourceTopic: string, pipes: TopicConfigPipe[] = [],
                  timestamp: number = Date.now(), parseAsJson: boolean = true): Promise<TopicConfig> {

        if (!pipes || !pipes.length) {
            throw new Error("Pipes must be set.");
        }

        pipes.forEach((pipe) => this.validatePipe(pipe));

        const document = {
            sourceTopic,
            timestamp,
            pipes,
            parseAsJson,
        };

        const query = {
            sourceTopic,
        };

        const queryOptions = {
            upsert: true,
        };

        return this.model.findOneAndUpdate(query, document, queryOptions).exec();
    }

    public delete(sourceTopic: string) {
        return this.model.deleteMany({ sourceTopic }).exec();
    }

    public truncateCollection() {
        debug("Truncating collection");
        return this.model.deleteMany({}).exec();
    }

    private validatePipe(pipe: TopicConfigPipe) {

        if (!pipe || typeof pipe !== "object") {
            throw new Error("Pipe is not an object");
        }

        if (!pipe.targetTopic || typeof pipe.targetTopic !== "string") {
            throw new Error("Pipe has no targetTopic.");
        }

        if (!pipe.filter) {
            return;
        }

        Object.keys(pipe.filter).map((key: string) => {

            if (key.indexOf("[") !== -1 || key.indexOf("]") !== -1) {
                throw new Error("Character not allowed in filter key [], only dot strings as path allowed.");
            }

            if (Array.isArray(pipe.filter[key]) || (typeof pipe.filter[key] === "object"
                && pipe.filter[key] !== null)) {
                throw new Error(
                    "Filter field values, must not be arrays or objects, please resolve via flat string paths. " + key);
            }
        });
    }
}
