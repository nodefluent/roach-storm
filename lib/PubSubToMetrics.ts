import * as Debug from "debug";
const debug = Debug("roach:pubsubtometrics");

import RoachStorm from "./RoachStorm";
import { Message } from "@google-cloud/pubsub";

export default class PubSubToMetrics {

    private readonly roachStorm: RoachStorm;
    private messageHandlerRef: any;
    private subscriptionRef: any;

    constructor(roachStorm: RoachStorm) {
        this.roachStorm = roachStorm;
    }

    public async start() {
        debug("Starting pubsub to metrics bridge.");

        if (this.subscriptionRef) {
            throw new Error("Subcription already opened.");
        }

        if (!this.roachStorm.config.gcf!.metrics!.pubSubMetricTopic) {
            throw new Error("No pub sub topic name provided.");
        }

        this.subscriptionRef = await
            this.roachStorm.pubSubHandler.subscribe(this.roachStorm.config.gcf!.metrics!.pubSubMetricTopic);

        this.messageHandlerRef = this.messageHandler.bind(this);
        this.subscriptionRef.on("message", this.messageHandlerRef);
        debug("Pubsub to metrics bridge is ready.");
    }

    public async close() {
        debug("Stopping pubsub to metrics bridge.");
        if (this.subscriptionRef) {
            this.subscriptionRef.removeListener("message", this.messageHandlerRef);
            this.subscriptionRef = null;
        }
    }

    private messageHandler(message: Message) {

        const topic = this.roachStorm.config.gcf!.metrics!.pubSubMetricTopic || "missing_name";
        this.roachStorm.metrics.inc(`pubsub_msg_in`, 1, { topic });

        try {
            let messages = JSON.parse(message.data.toString("utf8"));
            if (!Array.isArray(messages)) {
                messages = [ messages ];
            }
            this.roachStorm.metrics.inc(`pubsub_metrics_in`, messages.length, {});

            messages.forEach((metricMessage: any) => {

                try {
                    const {
                        metric,
                        type,
                        value,
                        labels,
                    } = metricMessage;

                    switch (type) {

                        case "counter":
                            if (this.roachStorm.gcfMetrics) {
                                this.roachStorm.gcfMetrics.inc(metric, value, labels);
                            }
                            break;

                        case "gauge":
                            if (this.roachStorm.gcfMetrics) {
                                this.roachStorm.gcfMetrics.set(metric, value, labels);
                            }
                            break;

                        default:
                            debug("Unsupported metric type:", metric, type);
                            this.roachStorm.metrics.inc(`pubsub_msg_error`, 1, { topic });
                            break;
                    }
                } catch (error) {
                    debug("Failed to handle metric messages from pubsub:", error.message);
                    this.roachStorm.metrics.inc(`pubsub_msg_error`, 1, { topic });
                }
            });
        } catch (error) {
            debug("Failed to parse metric pubsub value:", error.message, message.data);
            this.roachStorm.metrics.inc(`pubsub_msg_parse_error`, 1, { topic });
        }

        message.ack();
    }
}
