import { ResourceDbObject, UserDbObject, TicketStatusCode, ResourceNotificationDbObject, TicketUserInfoDbObject } from "allotr-graphql-schema-types";
import { getMongoDBConnection } from "./mongodb-connector";
import { ObjectId, Db } from "mongodb";
import { NOTIFICATIONS, RESOURCES, USERS } from "../consts/collections";
import * as webPush from "web-push"
import { USAGE_ANALYTICS, USAGE_ANALYTICS_DESCRIPTION } from "../consts/notification_tokens";
import { getLoadedEnvVariables } from "./env-loader";
async function getUserTicket(userId: string | ObjectId, resourceId: string, myDb?: Db): Promise<ResourceDbObject | null> {
    const db = myDb ?? await getMongoDBConnection().db;
    const [parsedUserId, parsedResourceId] = [new ObjectId(userId), new ObjectId(resourceId)];

    const [userTikcet] = await db.collection<ResourceDbObject>(RESOURCES).find({
        _id: parsedResourceId,
        "tickets.user._id": parsedUserId,
        "tickets.statuses.statusCode": {
            $ne: TicketStatusCode.Revoked
        }
    }, {
        projection: {
            "tickets.$": 1,
            name: 1,
            createdBy: 1,
            description: 1,
            maxActiveTickets: 1,
            lastModificationDate: 1,
            _id: 1,
            creationDate: 1,
            activeUserCount: 1
        }
    }).sort({
        lastModificationDate: -1
    }).toArray();

    return userTikcet;
}

async function getResource(resourceId: string): Promise<ResourceDbObject | null | undefined> {
    const db = await getMongoDBConnection().db;

    const userTikcet = await db.collection<ResourceDbObject>(RESOURCES).findOne({
        _id: new ObjectId(resourceId),
        "tickets.statuses.statusCode": {
            $ne: TicketStatusCode.Revoked
        }
    });

    return userTikcet;
}

async function getResources(): Promise<ResourceDbObject[]> {
    const db = await getMongoDBConnection().db;
    return await db.collection<ResourceDbObject>(RESOURCES).find().toArray();
}

async function getUser(userId?: ObjectId | null): Promise<UserDbObject | null | undefined> {
    const db = await getMongoDBConnection().db;
    const userTikcet = await db.collection<UserDbObject>(USERS).findOne({
        _id: userId,
    })

    return userTikcet;
}


async function pushNotification(
    resource: ResourceDbObject,
    user: TicketUserInfoDbObject,
    timestamp: Date,
) {
    const db = await getMongoDBConnection().db;

    const { VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, REDIRECT_URL } = getLoadedEnvVariables();

    webPush.setVapidDetails(
        REDIRECT_URL,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );

    // Now we insert the record
    if (user?._id == null) {
        return;
    }
    const notificationId = new ObjectId();
    const notificationData = {
        _id: notificationId,
        ticketStatus: TicketStatusCode.Active, // This does not matter actually
        user: { username: user?.username ?? "", _id: user?._id },
        titleRef: USAGE_ANALYTICS,
        descriptionRef: USAGE_ANALYTICS_DESCRIPTION,
        resource: { _id: resource._id, name: resource.name, createdBy: { _id: resource.createdBy?._id, username: resource.createdBy?.username ?? "" } },
        timestamp
    };
    await db.collection<ResourceNotificationDbObject>(NOTIFICATIONS).insertOne(notificationData);

    // Finally, we obtain the destined user subscriptions
    const fullReceivingUser = await getUser(user?._id);
    if (fullReceivingUser == null) {
        return;
    }

    for (const subscription of fullReceivingUser?.webPushSubscriptions) {
        if (subscription == null) {
            return;
        }
        try {
            await webPush.sendNotification({
                endpoint: subscription.endpoint ?? "",
                keys: {
                    auth: subscription.keys?.auth ?? "",
                    p256dh: subscription.keys?.p256dh ?? ""
                }
            })
            console.log("Notification sent!", subscription, user);
        } catch (e) {
            console.log("ERROR PUSHING", e)
            // Let's delete the bad subscription
            await db.collection(USERS).updateOne({
                _id: user._id
            }, {
                $pull: {
                    "webPushSubscriptions": subscription
                }
            }, {
                arrayFilters: [],
            })
        }
    }

    // We delete the notification after five minutes to avoid overloading the table
    await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    db.collection<ResourceNotificationDbObject>(NOTIFICATIONS).deleteOne({ _id: notificationId });

}

export { getUserTicket, getResource, pushNotification, getResources }