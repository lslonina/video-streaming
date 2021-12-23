## Run azurite

```
docker run -p 7777:7777 -p 8888:8888 -p 9999:9999 -v c:/azurite:/workspace mcr.microsoft.com/azure-storage/azurite azurite -l /workspace -d /workspace/debug.log --blobPort 7777 --blobHost 0.0.0.0 --queuePort 8888 --queueHost 0.0.0.0 --tablePort 9999 --tableHost 0.0.0.0 --loose --skipApiVersionCheck --disableProductStyleUrl
```