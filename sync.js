const _ = require('lodash');
const ZKLib = require('qr-zklib');
const Airtable = require('airtable');
require('dotenv').config();

const syncUsers = async () => {
  // Establish connections with both devices
  const device1 = new ZKLib('192.168.0.8', 4370, 10000, 4000);
  const device2 = new ZKLib('192.168.0.4', 4370, 10000, 4000);

  try {
    // Connect to the devices
    await device1.createSocket();
    await device2.createSocket();

    // Get the users from both devices
    const device1Users = await device1.getUsers();
    const device2Users = await device2.getUsers();
    // console.log(device1Users);

    // Find the missing users in device1 compared to device2
    const missingUsersInDevice1 = _.differenceBy(device2Users.data, device1Users.data, 'uid');

    // Find the missing users in device2 compared to device1
    const missingUsersInDevice2 = _.differenceBy(device1Users.data, device2Users.data, 'uid');

    // Add the missing users from device2 to device1
    for (const user of missingUsersInDevice2) {
      await device1.setUser(user);
    }

    // Add the missing users from device1 to device2
    for (const user of missingUsersInDevice1) {
      await device2.setUser(user);
    }

    const mergedData = _.uniqBy([...device1Users.data, ...device2Users.data], 'uid');
    console.log(mergedData);
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Add each user to Airtable
    for (const user of mergedData) {
      // Check if the user already exists in Airtable
      const table = base('user-data');
       const records = await table.select({
          filterByFormula: `uid = '${user.uid}'`
        })
        .all();

        if (records.length === 0) {
            // User does not exist in Airtable, add it
            const airtableRecord = await table.create([
              {
                fields:{
                  uid: user.uid,
                  role: user.role,
                  password: user.password,
                  name: user.name,
                  cardno: user.cardno,
                  userId: user.userId
                }
              }
            ]);
            console.log('New user added to Airtable');
          }
        }

    console.log('User synchronization completed.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect from both devices
    device1.disconnect();
    device2.disconnect();
  }
};

// Usage: Call the syncUsers function
syncUsers();
