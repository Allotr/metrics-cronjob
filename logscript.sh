#!/bin/bash
kubectl logs -n allotr $(kubectl get pods -n allotr -l allotr-metrics-cronjob --sort-by=.metadata.creationTimestamp -o 'jsonpath={.items[-1].metadata.name}')