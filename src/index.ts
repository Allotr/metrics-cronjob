
// This NEEDS to be executed first
require('dotenv').config();

import { getResources, pushNotification } from "./utils/transaction-util";
import { TicketStatusCode } from "allotr-graphql-schema-types";
import { calculateDateFrequencies, getNotificationsFromFrequencyMap, getStatusListByStatusCode } from "./utils/data-util";
import { EnvLoader } from "./utils/env-loader";

const {
    TIME_RANGE,
    NOTIFICATION_FREQUENCY_THRESHOLD,
    TIME_TO_WAIT
} = EnvLoader.getInstance().loadedVariables;

async function analyzeUserData() {
    const resources = await getResources();
    if (resources == null)
        return;

    for (const resource of resources) {
        for (const ticket of resource.tickets) {
            // Here we process the user activity related to a resource
            const activeStatusList = getStatusListByStatusCode(ticket.statuses, TicketStatusCode.Active);
            const dateList = activeStatusList.map(({ timestamp }) => timestamp);
            const dateFrequencyMap = calculateDateFrequencies(dateList, Number(TIME_RANGE))

            const notifications = getNotificationsFromFrequencyMap(dateFrequencyMap, Number(NOTIFICATION_FREQUENCY_THRESHOLD), Number(TIME_TO_WAIT))
            if (Object.keys(dateFrequencyMap).length === 0)
                continue;
            if (notifications.length === 0)
                continue;
            await pushNotification(resource, ticket.user, new Date());
        }
    }
}

// Let's analyze user data and generate the notifications
analyzeUserData()