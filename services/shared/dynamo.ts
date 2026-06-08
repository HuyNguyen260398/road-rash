import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Shared DocumentClient (AWS SDK v3). Created once per cold start and reused
// across invocations. removeUndefinedValues lets handlers pass optional fields
// (thumbnailKey, googleMapsUrl) as `undefined` without a marshalling error.
const client = new DynamoDBClient({});

export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
