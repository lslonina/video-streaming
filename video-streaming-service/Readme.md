# Bootstrapping microservices

Video streaming application

## Run locally
```
$Env:PORT=300
npm install
npm start
```

## Build docker
```
docker build -t video-streaming .
```

## Run docker
```
docker run -d -p 3000:3001 -e PORT=3001 video-streaming
```