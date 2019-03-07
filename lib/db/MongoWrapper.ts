import * as Debug from "debug";
const debug = Debug("roach:mongo");

import * as mongoose from "mongoose";
const Schema = mongoose.Schema;

import { MongoConfig } from "../interfaces";
import * as Models from "./models";
import RoachStorm from "../RoachStorm";
import { TopicConfigModel, StateModel } from "./models";

export default class MongoWrapper {

    private readonly config: MongoConfig;
    private readonly models: any;

    constructor(config: MongoConfig, roachStorm: RoachStorm) {
        this.config = config;
        this.models = {};
        this.loadModels(roachStorm);

        mongoose.set("bufferCommands", false);
        mongoose.set("useCreateIndex", true);
        (mongoose as any).Promise = Promise;
    }

    private loadModels(roachStorm: RoachStorm) {

        Object.keys(Models)
        .map((key: string) => (Models as any)[key])
        .forEach((modelConstructor) => {

            if (modelConstructor.noModel) {
                return;
            }

            const model = new modelConstructor(roachStorm, this);
            model.registerModel(mongoose, Schema);
            this.models[model.name] = model;
        });
    }

    private connectToMongoDB(attempts = 0): Promise<any> {
        attempts++;
        debug("Attempting to connect to MongoDB..", attempts);
        return mongoose.connect(this.config.url, Object.assign({}, this.config.options, {
            useNewUrlParser: true,
            autoReconnect: true,
            noDelay: true,
            keepAlive: true,
            reconnectTries: 30,
            reconnectInterval: 1000,
            poolSize: 10,
        })).catch((error) => {
            debug("Failed to connect to MongoDB: ", error.message);
            return (new Promise((resolve) => { setTimeout(resolve, attempts * 1000); })).then(() => {
                return this.connectToMongoDB(attempts);
            });
        });
    }

    private async connect() {

        const db = mongoose.connection;

        db.on("error", (error: Error) => {
            debug("Error occured", error.message);
            mongoose.disconnect();
        });

        db.on("connecting", () => {
            debug("Connecting to MongoDB..");
        });

        db.on("connected", () => {
            debug("Connected to MongoDB.");
        });

        db.on("reconnected", () => {
            debug("MongoDB reconnected.");
        });

        db.on("disconnected", () => {
            debug("MongoDB disconnected, reconnecting in 3 seconds..");
            setTimeout(() => {
                this.connectToMongoDB();
            }, 3000);
        });

        return new Promise((resolve) => {

            db.once("open", () => {
                debug("Connection to MongoDB open.");
                resolve(this);
            });

            this.connectToMongoDB();
        });
    }

    public isConnected() {
        return mongoose.connection ? mongoose.connection.readyState === 1 : false;
    }

    public async start() {
        await this.connect();
        return this.isConnected();
    }

    public getTopicConfig(): TopicConfigModel {
        return this.models.topicconfig;
    }

    public getSharedState(): StateModel {
        return this.models.state;
    }

    public close() {

        debug("Closing..");

        if (mongoose.connection) {
            mongoose.connection.close();
        }
    }
}
