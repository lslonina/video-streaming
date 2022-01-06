const express = require('express');
const http = require('http');
const mongodb = require('mongodb');
const amqp = require('amqplib');

const app = express();

if (!process.env.PORT) {
    throw new Error("please specify the port number for the HTTP server with the environment variable PORT.")
}

if (!process.env.RABBIT) {
    throw new Error("Please specify the name of the RabbitMQ host using environment variable RABBIT");
}

const PORT = parseInt(process.env.PORT);

const VIDEO_STORAGE_HOST = process.env.VIDEO_STORAGE_HOST;
const VIDEO_STORAGE_PORT = parseInt(process.env.VIDEO_STORAGE_PORT);
const DB_HOST = process.env.DB_HOST;
const DB_NAME = process.env.DB_NAME;
const DB_USERNAME = process.env.DB_USERNAME;
const DB_PASSWORD = process.env.DB_PASSWORD;

const RABBIT = process.env.RABBIT;

function connectRabbit() {
    console.log(`Connecting to RabbitMQ server at ${RABBIT}.`);
    return amqp.connect(RABBIT)
        .then(connection => {
            console.log("Connected to RabbitMQ.");
            return connection.createChannel().then(messageChannel => {
                return messageChannel.assertExchange("viewed", "fanout").then(() => {
                    return messageChannel;
                });
            });
        });
}
function getDBUri() {
    return `mongodb://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}`;
}

function sendViewedMessage(videoPath) {
    const postOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    };

    const requestBody = {
        videoPath: videoPath
    };

    const req = http.request("http://history/viewed", postOptions);

    req.on("close", () => {
        console.log("Sent 'viewed' message to history microservice.");
    });

    req.on("error", () => {
        console.error("Failed to send 'viewed' message!");
        console.error(err && err.stack || err);
    });

    req.write(JSON.stringify(requestBody));
    req.end();
}

function sendViewedMessage(messageChannel, videoPath) {
    console.log(`Publishing message on "viewed" queue.`);

    const msg = { videoPath: videoPath };
    const jsonMsg = JSON.stringify(msg);
    messageChannel.publish("", "viewed", Buffer.from(jsonMsg));
}

function main() {
    return connectRabbit().then(messageChannel => {
        return mongodb.MongoClient.connect(getDBUri()).then(client => {

            const db = client.db(DB_NAME);
            const videosCollection = db.collection("videos");

            app.get('/video', (req, res) => {
                const videoId = new mongodb.ObjectId(req.query.id);

                videosCollection.findOne({ _id: videoId })
                    .then(videoRecord => {
                        if (!videoRecord) {
                            res.sendStatus(404);
                            return;
                        }

                        const forwardRequest = http.request({
                            host: VIDEO_STORAGE_HOST,
                            port: VIDEO_STORAGE_PORT,
                            path: `/video?path=${videoRecord.videoPath}`,
                            method: 'GET',
                            headers: req.headers
                        },
                            forwardResponse => {
                                res.writeHead(forwardResponse.statusCode, forwardResponse.headers);
                                forwardResponse.pipe(res);
                            }
                        );

                        // sendViewedMessage(videoRecord.videoPath);
                        sendViewedMessage(messageChannel, videoRecord.videoPath);
                        req.pipe(forwardRequest);
                    })
                    .catch(err => {
                        console.error("Database query failed.");
                        console.error(err && err.stack || err);
                        res.sendStatus(500);
                    })
            });

            app.listen(PORT, () => {
                console.log(`Example app listening on port ${PORT}!`);
            });
        });
    });
}

main().then(() => console.log("Microservice online.")).catch(err => {
    console.error("Microservice failed to start.");
    console.error(err && err.stack || err);
})