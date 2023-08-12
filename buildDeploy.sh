#!/bin/bash
docker build -t allotr-metrics-cronjob .
docker tag allotr-metrics-cronjob rafaelpernil/allotr-metrics-cronjob
docker push rafaelpernil/allotr-metrics-cronjob

kubectl apply -f ./artifacts/cronjob.yaml