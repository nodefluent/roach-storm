import * as Debug from "debug";
const debug = Debug("roach:roach");

import MongoWrapper from "./db/MongoWrapper";
import MongoPoller from "./db/MongoPoller";
import Discovery from "./kafka/Discovery";
import HttpServer from "./api/HttpServer";
import MessageHandler from "./MessageHandler";
import Consumer from "./kafka/Consumer";
import Producer from "./kafka/Producer";
import { Metrics } from "./Metrics";
import PubSubHandler from "./PubSubHandler";
import PubSubToKafka from "./PubSubToKafka";
import PubSubToMetrics from "./PubSubToMetrics";

import { RoachConfig } from "./interfaces";

const GRACE_EXIT_MS = 1250;

export default class RoachStorm {

    private readonly httpServer: HttpServer;

    public readonly config: RoachConfig;
    public readonly consumer: Consumer;
    public readonly producer: Producer;
    public readonly messageHandler: MessageHandler;
    public readonly mongoWrapper: MongoWrapper;
    public readonly mongoPoller: MongoPoller;
    public readonly discovery: Discovery;
    public readonly metrics: Metrics;
    public readonly gcfMetrics: Metrics | null;
    public readonly pubSubHandler: PubSubHandler;
    public readonly pubSubToKafka: PubSubToKafka;
    public readonly pubSubToMetrics: PubSubToMetrics | null;

    private alive: boolean = true;
    private ready: boolean = false;

    constructor(config: RoachConfig) {

        if (!config || typeof config !== "object") {
            throw new Error("Config must be an object: {kafka,discovery,mongo,http}");
        }

        this.config = config;
        this.metrics = new Metrics("roach", ["topic"], ["topic"]);

        if (this.config.gcf && this.config.gcf.metrics && this.config.gcf.metrics.pubSubMetricTopic) {
            this.gcfMetrics = new Metrics(this.config.gcf.metrics.prefix || "gcf_roach",
                this.config.gcf.metrics.counterLabels, this.config.gcf.metrics.gaugeLabels);
            this.pubSubToMetrics = new PubSubToMetrics(this);
        } else {
            this.gcfMetrics = null;
            this.pubSubToMetrics = null;
        }

        this.discovery = new Discovery(this.config.discovery, this.metrics);
        this.mongoWrapper = new MongoWrapper(this.config.mongo, this);
        this.mongoPoller = new MongoPoller(this.mongoWrapper, this.metrics);
        this.httpServer = new HttpServer(this.config.http, this);
        this.consumer = new Consumer(this.config.kafka, this);
        this.producer = new Producer(this.config.kafka, this);
        this.pubSubHandler = new PubSubHandler(this.config, this);
        this.messageHandler = new MessageHandler(this);
        this.pubSubToKafka = new PubSubToKafka(this);
    }

    private shutdownOnErrorIfNotProduction() {

        if (!RoachStorm.isProduction()) {
            debug("Shutting down (because of error) in", GRACE_EXIT_MS, "ms");
            this.close();
            setTimeout(() => {
                process.exit(1);
            }, GRACE_EXIT_MS);
        }
    }

    private shutdownGracefully() {

        debug("\nShutting down gracefully in", GRACE_EXIT_MS, "ms");
        this.close();
        debug("Bye..");

        setTimeout(() => {
            process.exit(0);
        }, GRACE_EXIT_MS);
    }

    private init() {

        process.on("SIGINT", this.shutdownGracefully.bind(this));
        process.on("SIGUSR1", this.shutdownGracefully.bind(this));
        process.on("SIGUSR2", this.shutdownGracefully.bind(this));

        process.on("uncaughtException", (error: Error) => {
            debug("Unhandled Exception: ", error.message, error.stack);
            this.shutdownOnErrorIfNotProduction();
        });

        process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
            debug("Unhandled Rejection: ", reason);
            this.shutdownOnErrorIfNotProduction();
        });

        if (RoachStorm.isProduction()) {
            debug("Running production.");
        } else {
            debug("Running NOT in production.");
        }
    }

    public async run() {
        this.init();

        debug("Starting..");

        this.metrics.registerDefault();

        // its okay to start these first, as consumer not subscribe to anything until the
        // poller told him about the configured topics
        // NOTE: this is necessary, because consumer requires connection before adjusting subscriptions
        await this.mongoWrapper.start();
        await this.consumer.start();

        if (this.config.pubSubToKafkaTopicName) {
            await this.producer.start();
        }

        this.mongoPoller.on("error", (error) => {
            debug("MongoDB polling error: " + error.message, error.stack);
        });

        this.mongoPoller.on("topic-config-changed", (topics) => {
            debug("Topic Configuration changed, adjusting subscription of consumer accordingly..", topics.length);
            this.consumer.adjustSubscriptions(topics);
        });

        await this.discovery.start(this.consumer.getKafkaClient());
        await this.mongoPoller.start(30000);
        await this.httpServer.start();

        if (this.config.pubSubToKafkaTopicName) {
            await this.pubSubToKafka.start();
        }

        if (this.pubSubToMetrics) {
            await this.pubSubToMetrics.start();
        }

        this.setReadyState(true);
        debug("Running..");
    }

    public async close() {

        debug("Closing..");
        this.setAliveState(false);
        this.setReadyState(false);

        await this.pubSubToKafka.close();
        if (this.pubSubToMetrics) {
            await this.pubSubToMetrics.close();
        }

        this.mongoPoller.close();
        this.discovery.close();
        this.httpServer.close();
        await this.consumer.close();
        await this.producer.close();
        this.mongoWrapper.close();
        this.metrics.close();

        if (this.gcfMetrics) {
            this.gcfMetrics.close();
        }
    }

    public static isProduction(): boolean {
        return process.env.NODE_ENV === "production";
    }

    public setAliveState(state: boolean): void {
        debug("Setting alive state from", this.alive, "to", state);
        this.alive = state;
    }

    public isAlive(): boolean {
        return this.alive;
    }

    public setReadyState(state: boolean): void {
        debug("Setting ready state from", this.ready, "to", state);
        this.ready = state;
    }

    public isReady(): boolean {
        return this.ready;
    }
}
