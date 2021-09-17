import { CustomTryCatch } from "../types/custom-try-catch";
import { TicketDbObject, TicketStatusCode, TicketStatusDbObject } from "allotr-graphql-schema-types";
import { CategorizedArrayData } from "../types/categorized-array-data";
import moment, { Moment } from "moment";

const TIME_FORMAT = 'hh:mm:ss';

async function customTryCatch<T>(promise: Promise<T>): Promise<CustomTryCatch<T>> {
    try {
        const result = await promise;
        return { result, error: null }
    } catch (error) {
        return { result: null, error }
    }
}

function compareDates(dateA: Date, dateB: Date) {
    const comparison = new Date(dateA).getTime() - new Date(dateB).getTime();
    if (comparison > 0)
        return 1;
    if (comparison < 0)
        return -1;
    return 0;
}


function addMSToTime(date: Date, extraMS: number): Date {
    const newDate = date;
    newDate.setMilliseconds(newDate.getMilliseconds() + extraMS)
    return newDate;
}

function getLastStatus(myTicket?: TicketDbObject): TicketStatusDbObject {
    return myTicket?.statuses.reduce((latest, current) => compareDates(current.timestamp, latest.timestamp) > 0 ? current : latest) ?? {
        statusCode: TicketStatusCode.Initialized,
        timestamp: new Date(),
        queuePosition: null
    };
}

function getLastQueuePosition(tickets: TicketDbObject[] | undefined = []): number {
    return tickets.reduce<number>((lastPosition, ticket) => {
        const { queuePosition } = getLastStatus(ticket);
        const processedQueuePosition = queuePosition ?? 0;
        return lastPosition > processedQueuePosition ? lastPosition : processedQueuePosition;
    }, 0) ?? 0;
}

function getFirstQueuePosition(tickets: TicketDbObject[] | undefined = []): number {
    return tickets.reduce<number>((firstPosition, ticket) => {
        const { queuePosition } = getLastStatus(ticket);
        const processedQueuePosition = queuePosition ?? Number.MAX_SAFE_INTEGER;
        return firstPosition < processedQueuePosition ? firstPosition : processedQueuePosition;
    }, Number.MAX_SAFE_INTEGER) ?? 1;
}

function categorizeArrayData<T extends { id: string }>(previousList: T[], newList: T[]): CategorizedArrayData<T> {
    const newListCopy = [...newList];
    const total: CategorizedArrayData<T> = {
        add: [],
        delete: [],
        modify: []
    }

    for (const previousData of previousList) {
        const indexInNewList = newListCopy.findIndex(({ id }) => id === previousData.id);
        if (indexInNewList !== -1) {
            // If found, we modify
            total.modify.push({ ...previousData, ...newListCopy[indexInNewList] })
            // And we remove the found value from the new list
            newListCopy.splice(indexInNewList, 1);
        } else {
            // If not found, we delete
            total.delete.push(previousData)
        }
    }
    // The rest is added
    total.add = newListCopy;
    return total;
}

function getStatusListByStatusCode(statuses: TicketStatusDbObject[] = [], statusCodeToCheck: TicketStatusCode): TicketStatusDbObject[] {
    return statuses.filter(({ statusCode }) => statusCode === statusCodeToCheck);
}


function getNotificationsFromFrequencyMap(
    dateFrequencyMap: Record<string, { wasRequestedToday: boolean, frequency: number }>,
    threshold: number = 3,
    timeToWait: number = 30,
    timeout: number = 30
) {
    // Return the dates that are repeated more than 3 times and need to be notified
    return Object
        .entries(dateFrequencyMap)
        .filter(
            ([key, value]) =>
                !value.wasRequestedToday &&
                value.frequency >= threshold &&
                moment.utc()
                    .isBetween( // Only notify after X time from the notification with a timeout of 30 minutes
                        moment.utc(key, TIME_FORMAT).add(timeToWait, "m"),
                        moment.utc(key, TIME_FORMAT).add(timeToWait + timeout, "m"))
        )
        .map(([key]) => key);
}

function calculateDateFrequencies(dateList: Date[], timeRange: number = 30): Record<string, { wasRequestedToday: boolean, frequency: number }> {
    // We need to pre-group the dates to remove unneeded data
    const filteredDateList: Date[] = []
    for (const dateToCheck of dateList) {
        const dateTime = getHourMinutesSeconds(dateToCheck);
        const hasSimilarDate = filteredDateList.some(date => {
            return moment.utc(date).toISOString().substring(0, 10) === moment.utc(dateToCheck).toISOString().substring(0, 10) &&
                date.getTime() !== dateToCheck.getTime() &&
                moment
                    .utc(getHourMinutesSeconds(date), TIME_FORMAT)
                    .isBetween(
                        moment.utc(dateTime, TIME_FORMAT).subtract(timeRange, "m"),
                        moment.utc(dateTime, TIME_FORMAT).add(timeRange, "m")
                    )
        });
        if (hasSimilarDate) {
            continue;
        }
        filteredDateList.push(dateToCheck);
    }



    const dateFrequencyMap: Record<string, { wasRequestedToday: boolean, frequency: number }> = {}
    const alreadyProcessedMap: Record<string, boolean> = {};
    for (let i = 0; i < filteredDateList.length; i++) {
        const referenceDate = filteredDateList[i];
        for (let j = i + 1; j < filteredDateList.length; j++) {
            const dateToCheck = filteredDateList[j];
            // Ignore already processed dates
            if (alreadyProcessedMap[dateToCheck.toISOString()])
                continue;

            const dateRangeFound = compareDatesWithRange(referenceDate, dateToCheck, timeRange);
            if (dateRangeFound == null)
                continue;
            const [dateInRange] = dateRangeFound;
            const wasRequestedToday = dateInRange.isSame(moment.utc(), "day")
            // Get time
            const newKey = dateInRange.toISOString().substring(11, 19)
            // Avoid entering duplicates
            const nonDuplicateKey = Object.entries(dateFrequencyMap).reduce<string>((_, [key]) => {
                const hasPreviousKey =
                    moment
                        .utc(key, TIME_FORMAT)
                        .isBetween(
                            moment.utc(newKey, TIME_FORMAT).subtract(timeRange, "m"),
                            moment.utc(newKey, TIME_FORMAT).add(timeRange, "m")
                        );
                return hasPreviousKey ? key : newKey;
            }, newKey);
            alreadyProcessedMap[dateToCheck.toISOString()] = true;
            dateFrequencyMap[nonDuplicateKey] = dateFrequencyMap[nonDuplicateKey] == null ?
                { frequency: 1, wasRequestedToday } :
                { frequency: dateFrequencyMap[nonDuplicateKey].frequency + 1, wasRequestedToday };
        }
    }
    return dateFrequencyMap;
}


function compareDatesWithRange(dateA: Date, dateB: Date, rangeInMinutes: number): [Moment, Moment] | undefined {
    // Make sure the day is different
    if (moment.utc(dateA).toISOString().substring(0, 10) === moment.utc(dateB).toISOString().substring(0, 10))
        return;

    const [dateATime, dateBTime] = [getHourMinutesSeconds(dateA), getHourMinutesSeconds(dateB)]
    // We need to make two comparisons, with a as reference and with b as reference
    const [dateAPlusRange, dateAMinusRange] = [moment.utc(dateATime, TIME_FORMAT).add(rangeInMinutes, "m"), moment.utc(dateATime, TIME_FORMAT).subtract(rangeInMinutes, "m")]
    const [dateBPlusRange, dateBMinusRange] = [moment.utc(dateBTime, TIME_FORMAT).add(rangeInMinutes, "m"), moment.utc(dateBTime, TIME_FORMAT).subtract(rangeInMinutes, "m")]

    const aIsBetweenBRange = moment.utc(dateATime, TIME_FORMAT).isBetween(dateBMinusRange, dateBPlusRange)
    const bIsBetweenARange = moment.utc(dateBTime, TIME_FORMAT).isBetween(dateAMinusRange, dateAPlusRange)

    if (aIsBetweenBRange)
        return [moment.utc(dateA), moment.utc(dateB)];
    if (bIsBetweenARange)
        return [moment.utc(dateB), moment.utc(dateA)];
}

function getHourMinutesSeconds(myDate: Date): string {
    const dateParsed = moment.utc(myDate)
    return `${dateParsed.hours()}:${dateParsed.minutes()}:${dateParsed.seconds()}`
}

export {
    customTryCatch,
    compareDates,
    getLastStatus,
    getLastQueuePosition,
    addMSToTime,
    categorizeArrayData,
    getFirstQueuePosition,
    calculateDateFrequencies,
    compareDatesWithRange,
    getHourMinutesSeconds,
    getNotificationsFromFrequencyMap,
    getStatusListByStatusCode
}