#!/bin/bash
kubectl logs -n openfaas-fn $(kubectl get pods -n openfaas-fn -l allotr-metrics-cronjob --sort-by=.metadata.creationTimestamp -o 'jsonpath={.items[-1].metadata.name}')