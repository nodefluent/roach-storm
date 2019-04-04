import * as express from "express";
import RoachStorm from "../../RoachStorm";

const routeRoot = (roachStorm: RoachStorm) => {

    const router = express.Router();

    router.get("/", (req, res) => {
        res.json({
            Hi: "Welcome to RoachStorm",
            parent: "/",
            self: "/",
            children: [
                "/api",
                "/doc",
                "/healthcheck",
                "/ready",
                "/metrics",
            ],
        });
    });

    router.get("/api", (req, res) => {
        res.json({
            parent: "/",
            self: "/api",
            children: [
                "/api/info",
                "/api/config",
                "/api/state",
                "/api/produce",
            ],
        });
    });

    router.get("/doc", (req, res) => {
        res.end("Coming soon..");
    });

    router.get("/healthcheck", (req, res) => {
        res.status(roachStorm.isAlive() ? 200 : 503).end();
    });

    router.get("/ready", (req, res) => {
        res.status(roachStorm.isReady() ? 200 : 503).end();
    });

    router.get("/metrics", (req, res) => {

        res.set("content-type", roachStorm.metrics.exportType());
        res.write(roachStorm.metrics.exportMetrics());

        if (roachStorm.gcfMetrics) {
            res.write(roachStorm.gcfMetrics.exportMetrics());
        }

        res.end();
    });

    return router;
};

export { routeRoot };
