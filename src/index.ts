
// This NEEDS to be executed first
require('dotenv').config();

import { getResources, pushNotification } from "./utils/transaction-util";
import { TicketStatusCode } from "allotr-graphql-schema-types";
import { calculateDateFrequencies, getNotificationsFromFrequencyMap, getStatusListByStatusCode } from "./utils/data-util";
import { getLoadedEnvVariables } from "./utils/env-loader";

const {
    TIME_RANGE,
    NOTIFICATION_FREQUENCY_THRESHOLD,
    TIME_TO_WAIT,
    TIMEOUT
} = getLoadedEnvVariables();

async function analyzeUserData() {
    const resources = await getResources();
    console.log("RESOURCES loaded", resources);
    if (resources == null)
        return;

    for (const resource of resources) {
        console.log("foreach resource", resource)
        for (const ticket of resource.tickets) {
            console.log("foreach ticket", ticket)
            // Here we process the user activity related to a resource
            const requestingStatusList = getStatusListByStatusCode(ticket.statuses, TicketStatusCode.Requesting);
            const dateList = requestingStatusList.map(({ timestamp }) => timestamp);
            const dateFrequencyMap = calculateDateFrequencies(dateList, Number(TIME_RANGE));

            const notifications = getNotificationsFromFrequencyMap(dateFrequencyMap, Number(NOTIFICATION_FREQUENCY_THRESHOLD), Number(TIME_TO_WAIT), Number(TIMEOUT))
            if (Object.keys(dateFrequencyMap).length === 0)
                continue;
            if (notifications.length === 0)
                continue;
            pushNotification(resource, ticket.user, new Date());
        }
    }
    console.log("analyzeUserData done");
}

// Main async
(async () => {
    // Let's analyze user data and generate the notifications
    await analyzeUserData()
    console.log("Job done, exiting...")
    process.exit(0);
})()
