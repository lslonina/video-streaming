const express = require("express")
const mongodb = require("mongodb");
const bodyParser = require('body-parser');

if (!process.env.DB_HOST) {
    throw new Error("Please specify the databse host using environment variable DB_HOST.");
}

if (!process.env.DB_NAME) {
    throw new Error("Please specify the name of the database using environment variable DB_NAME");
}

const DB_HOST = process.env.DB_HOST;
const DB_NAME = process.env.DB_NAME;
const DB_USERNAME = process.env.DB_USERNAME;
const DB_PASSWORD = process.env.DB_PASSWORD;

function getDBUri() {
    return `mongodb://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}`;
}

function connectDb() {
    return mongodb.MongoClient.connect(getDBUri())
        .then(client => {
            return client.db(DB_NAME);
        });
}

function setupHandlers(app, db) {
    const videosCollection = db.collection("videos");

    app.post("/viewed", (req, res) => { 
        const videoPath = req.body.videoPath;
        videosCollection.insertOne({ videoPath: videoPath }) 
            .then(() => {
                console.log(`Added video ${videoPath} to history.`);
                res.sendStatus(200);
            })
            .catch(err => {
                console.error(`Error adding video ${videoPath} to history.`);
                console.error(err && err.stack || err);
                res.sendStatus(500);
            });
    });

    app.get("/history", (req, res) => {
        const skip = parseInt(req.query.skip);
        const limit = parseInt(req.query.limit);
        videosCollection.find()
            .skip(skip)
            .limit(limit)
            .toArray()
            .then(documents => {
                res.json({ history: documents });
            })
            .catch(err => {
                console.error(`Error retrieving history from database.`);
                console.error(err && err.stack || err);
                res.sendStatus(500);
            });
    });
}

function startHttpServer(db) {
    return new Promise(resolve => {
        const app = express();
        app.use(bodyParser.json());
        setupHandlers(app, db);

        const port = process.env.PORT && parseInt(process.env.PORT) || 3090;
        app.listen(port, () => {
            resolve();
        });
    });
}

function main() {
    return connectDb(getDBUri())
        .then(db => {
            return startHttpServer(db);
        });
}

main().then(() => console.log("Microservice online."))
    .catch(err => {
        console.error("Microservice failed to start.");
        console.error(err && err.stack || err);
    });