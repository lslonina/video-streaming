const express = require("express");
const mongodb = require("mongodb");
const amqp = require('amqplib');
const bodyParser = require("body-parser");

if (!process.env.DB_HOST) {
    throw new Error("Please specify the databse host using environment variable DB_HOST.");
}

if (!process.env.DB_NAME) {
    throw new Error("Please specify the name of the database using environment variable DB_NAME");
}

if (!process.env.RABBIT) {
    throw new Error("Please specify the name of the RabbitMQ host using environment variable RABBIT");
}

const DB_HOST = process.env.DB_HOST;
const DB_NAME = process.env.DB_NAME;
const DB_USERNAME = process.env.DB_USERNAME;
const DB_PASSWORD = process.env.DB_PASSWORD;

const RABBIT = process.env.RABBIT;

function getDBUri() {
    return `mongodb://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}`;
}
function connectDb() {
    return mongodb.MongoClient.connect(getDBUri())
        .then(client => {
            return client.db(DB_NAME);
        });
}

function connectRabbit() {

    console.log(`Connecting to RabbitMQ server at ${RABBIT}.`);

    return amqp.connect(RABBIT)
        .then(messagingConnection => {
            console.log("Connected to RabbitMQ.");

            return messagingConnection.createChannel();
        });
}

function setupHandlers(app, db, messageChannel) {

    const historyCollection = db.collection("videos");

    function consumeViewedMessage(msg) {
        const parsedMsg = JSON.parse(msg.content.toString());
        console.log("Received a 'viewed' message:");
        console.log(JSON.stringify(parsedMsg, null, 4));

        return historyCollection.insertOne({ videoPath: parsedMsg.videoPath })
            .then(() => {
                console.log("Acknowledging message was handled.");
                messageChannel.ack(msg);
            });
    };

    return messageChannel.assertExchange("viewed", "fanout")
        .then(() => {
            return messageChannel.assertQueue("", { exclusive: true });
        })
        .then(response => {
            const queueName = response.queue;
            return messageChannel.bindQueue(queueName, "viewed", "").then(() => {
                console.log("Asserted that the 'viewed' queue exists.");
                return messageChannel.consume("viewed", consumeViewedMessage);
            });
        });
}

function startHttpServer(db, messageChannel) {
    return new Promise(resolve => {
        const app = express();
        app.use(bodyParser.json());
        setupHandlers(app, db, messageChannel);

        const port = process.env.PORT && parseInt(process.env.PORT) || 3000;
        app.listen(port, () => {
            resolve();
        });
    });
}

function main() {
    return connectDb()
        .then(db => {
            return connectRabbit()
                .then(messageChannel => {
                    return startHttpServer(db, messageChannel);
                });
        });
}

main()
    .then(() => console.log("Microservice online."))
    .catch(err => {
        console.error("Microservice failed to start.");
        console.error(err && err.stack || err);
    });