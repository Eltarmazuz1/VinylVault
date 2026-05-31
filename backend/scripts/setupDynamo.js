require('dotenv').config();
const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const tables = [
  {
    TableName: 'vv_users',
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'vv_records',
    KeySchema: [{ AttributeName: 'recordId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'recordId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'vv_ratings',
    KeySchema: [{ AttributeName: 'ratingId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'ratingId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'vv_purchases',
    KeySchema: [{ AttributeName: 'purchaseId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'purchaseId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

async function setup() {
  const { TableNames } = await client.send(new ListTablesCommand({}));
  for (const table of tables) {
    if (TableNames.includes(table.TableName)) {
      console.log(`✓ ${table.TableName} already exists`);
      continue;
    }
    await client.send(new CreateTableCommand(table));
    console.log(`✓ Created ${table.TableName}`);
  }
  console.log('DynamoDB setup complete.');
}

setup().catch(console.error);
