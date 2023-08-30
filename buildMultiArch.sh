#!/bin/bash
docker tag allotr-metrics-cronjob rafaelpernil/allotr-metrics-cronjob
docker buildx build --push --platform linux/arm/v7,linux/arm64,linux/amd64  --tag rafaelpernil/allotr-metrics-cronjob .
#docker push rafaelpernil/allotr-metrics-cronjob

