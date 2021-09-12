#!/bin/bash
docker build -t allotr-metrics-cronjob .
docker tag allotr-metrics-cronjob rafaelpernil/allotr-metrics-cronjob:production
docker push rafaelpernil/allotr-metrics-cronjob:production

kubectl apply -f ./artifacts/prod/cronjob.yaml
