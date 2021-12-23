const express = require('express');
const azure = require('azure-storage');

const app = express();

const PORT = process.env.PORT;

const STORAGE_CONNECTION_STRING = process.env.STORAGE_CONNECTION_STRING;
const STORAGE_ACCOUNT_NAME = process.env.STORAGE_ACCOUNT_NAME;
const STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY;

function createBlobService() {
    console.error(`Connecting to Azure Blob storage: ${STORAGE_CONNECTION_STRING}`)
    const blobService = azure.createBlobService(STORAGE_CONNECTION_STRING);
    return blobService;
}

app.get("/video", (req, res) => {
    const videoPath = req.query.path;
    const blobService = createBlobService();

    const containerName = "videos";
    blobService.getBlobProperties(containerName, videoPath, (err, properties) => {
        if (err) {
            console.error("Error getting blob properties:" + err);
            res.sendStatus(500);
            return
        }

        res.writeHead(200, {
            "Content-Lenght": properties.contentLength,
            "Content-Type": "video/mp4",
        });

        blobService.getBlobToStream(containerName, videoPath, res, err => {
            if(err) {
                console.error("Error getting video stream: " + err);
                res.sendStatus(500);
                return;
            }
        });
    });
});

app.listen(PORT, () => {
    console.log(`Azure video storage service online on port: ${PORT}`);
})