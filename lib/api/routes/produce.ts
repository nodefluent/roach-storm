import * as express from "express";
import * as Promise from "bluebird";
import RoachStorm from "../../RoachStorm";
import { SortedMessageBatch } from "sinek";

const routeProduce = (roachStorm: RoachStorm) => {

    const router = express.Router();
    const messageHandler = roachStorm.messageHandler;

    router.get("/", (req, res) => {
        res.json({
            parent: "/api",
            self: "/api/produce",
            children: [
                "/api/produce/kafka-batch",
            ],
        });
    });

    router.post("/kafka-batch", async (req, res) => {

        if (!res.locals.access.topicConfigAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        if (!req.body || !req.body.batch || typeof req.body.batch !== "object") {
            res.status(400).json({
                error: "Body should be a valid object containing " +
                "SortedMessageBatch, { batch: { topic: { partition: [ { key, value: { .. } } ] } } }",
            });
            return;
        }

        try {
            const sortedMessageBatch: SortedMessageBatch = req.body.batch;
            const results = await messageHandler.handleSortedMessageBatch(sortedMessageBatch);
            res.status(201).json(results);
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    return router;
};

export { routeProduce };
