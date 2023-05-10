const {Client, Intents} = require('discord.js');
const axios = require('axios');
const {google} = require('googleapis');
const fs = require('fs');
const dotenv = require('dotenv').config();

const cloudURL = process.env.CLOUD_RUN_URL;
const discordToken = process.env.DISCORD_BOT_TOKEN;
const sheetID = process.env.SPREADSHEET_ID;
const googleAC = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGE_CONTENT,
        Intents.FLAGS.DIRECT_MESSAGE_CONTENT,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        ],
    partials: ['MESSAGE'],
});

// Load your service account JSON key file
const serviceAccount = JSON.parse(fs.readFileSync(`${googleAC}`));

// Authenticate with Google Sheets API
const auth = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ['https://www.googleapis.com/auth/spreadsheets'],
    null
);

const sheets = google.sheets({version: 'v4', auth});

// Replace with your spreadsheet ID
const SPREADSHEET_ID = `${sheetID}`;

client.login(`${discordToken}`);

function extractImageUrlAndBossName(message) {
    // Your logic to extract image URL from the message
    const attachment = message.attachments.first();
    const imageUrl = attachment && (attachment.url.endsWith('.png') || attachment.url.endsWith('.jpg') || attachment.url.endsWith('.jpeg')) ? attachment.url : null;
    const commandRegex = /^!(\w+)/i
    const match = message.content.match(commandRegex);
    const bossName = match ? match[1] : null;

    return {imageUrl, bossName};
}


client.on('message', async (message) => {
    // Ignore messages from other bots
    if (message.author.bot) return;
    // Check for attachments and URLs in the message
    const attachments = message.attachments.array();
    const urls = message.content.match(/https?:\/\/\S+/gi) || [];

    // Combine attachments and URLs
    const imageURLs = attachments.map((attachment) => attachment.url).concat(urls);
    console.log(imageURLs);

    if (imageURLs.length > 0) {
        const { bossName } = extractImageUrlAndBossName(message);
        console.log({ bossName });

        if (bossName) {
            try {
                const proc = await message.channel.send(`Processing ${imageURLs.length} image(s)...`);

                // Process all image URLs concurrently
                const allUsernames = await Promise.all(
                    imageURLs.map(async (imageUrl) => {
                        const response = await axios.get(`${cloudURL}=${imageUrl}`);
                        const dataNames = response.data.names;
                        proc.edit(`Sorting Duplicates...,[ ${dataNames} ]`)
                        return dataNames.filter((username) => username);

                    })
                    );
                // Flatten the allUsernames array and remove duplicates
                const uniqueUsernames = [...new Set([].concat(...allUsernames))];

                // Update attendance in Google Sheets
                await updateAttendance(uniqueUsernames, bossName);
                // Update attendance in Google Sheets

                // Send a confirmation message
                proc.edit(` ------- Completed! --------`)
                message.reply(
                    `  Attendance has been accounted for:
                    ${uniqueUsernames}

                    `
                    );
            } catch (error) {
                message.reply('An error occurred while processing the images.');
                console.error(error);
            }
        }
    }
});


async function getSheetId(sheetName) {
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            ranges: [sheetName],
            fields: 'sheets(properties(sheetId,title))',
        });

        const sheet = response.data.sheets.find(sheet => sheet.properties.title === sheetName);

        if (sheet) {
            return sheet.properties.sheetId;
        } else {
            console.error(`Sheet ${sheetName} not found`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching sheet ID for ${sheetName}:`, error);
        return null;
    }
}

async function updateAttendance(usernamesArray, bossName) {
    const sheetName = await findSheetNameForBoss(bossName);
    const sheetId = await getSheetId(sheetName);

    const getUsersToUpdate = async (usernames) => {
        const usersToUpdate = await Promise.all(
            usernames.map(async (username) => {
                const rowNumber = await findUserRow(sheetName, username);
                if (rowNumber) {
                    return { rowNumber, value: true };
                } else {
                    console.log(`User ${username} not found in sheet ${sheetName}`);
                    return null;
                }
            })
            );
        return usersToUpdate.filter((user) => user !== null);
    };

    // Merge all usernames arrays and filter out duplicates
    const allUsernames = Array.from(new Set([].concat(...usernamesArray)));

    // Loop through the usernames and find their row numbers
    const usersToUpdate = await getUsersToUpdate(allUsernames);

    // Check if there are any users to update
    if (usersToUpdate.length > 0) {
        // Create an array of update requests for each user
        const requests = usersToUpdate.map(user => ({
            updateCells: {
                range: {
                    sheetId: sheetId,
                    startRowIndex: user.rowNumber - 1,
                    endRowIndex: user.rowNumber,
                    startColumnIndex: 40, // Column AO index
                    endColumnIndex: 41
                },
                rows: [{ values: [{ userEnteredValue: { boolValue: user.value } }] }],
                fields: 'userEnteredValue'
            }
        }));

        // Update the specified cells in Google Sheets using batchUpdate
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: requests
            },
        });
    } else {
        console.log(`Sheet not found for boss ${bossName}`);
    }
}


const sheetMap = {
    'MOSHAR': 'FB MOSHAR',
    'LION': 'FB LIONHEART',
    'LAMOHI': 'FB LAMOHI',
    'BULL': 'FB BULL FIEND',
    'LOTUS': 'FB BIRYONG',
    'INFERNAL': 'FB INFERNAL',
    'LONGBOW': 'FB LONGBOW',
    'SERPANT': 'FB SERPANT MAID',
    'BB': 'FB BLACKBLOOD',
    'TK': 'FB TOMB KING',
    'CENT': 'FB CENTEPEDEUS',
    'CK': 'FB CAPRIS KING'
};
const nameMap = {
    '你爸爸' :'你爸爸 (New BBC)',
    '你野':'你野爹 (Piggy)',
    '叫我':'叫我爹 (IcedEarth)',
    '破天命':'破天命 (Edi)',
    'rovi':'Rovi (Canessa)',
    '贪生恶杀':'贪生恶杀 (Muhui)'
}

async function findSheetNameForBoss(bossName) {
    const upperCaseBossName = bossName.toUpperCase();
    const sheetName = sheetMap[upperCaseBossName];
    if (!sheetName) {
        console.log(`No sheet found for boss alias ${bossName}`);
        return null;
    }
    return sheetName;
}

async function findUserRow(sheetName, username) {
    // Read the data in the AL9:AL range
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!AL9:AL`,
    });

    const rows = response.data.values;
    if (!rows) {
        console.log('No data found in the specified range.');
        return null;
    }

    // Check if there's a mapping for the username
    const mappedUsername = nameMap[username] || username;

    // Find the index where the username matches (case-insensitive)
    const rowIndex = rows.findIndex(row => row[0] && row[0].toLowerCase() === mappedUsername.toLowerCase());

    // If a match is found, calculate the row number
    const rowNumber = rowIndex !== -1 ? rowIndex + 9 : null;

    if (rowNumber) {
        console.log(`User ${mappedUsername} found at row ${rowNumber} in sheet ${sheetName}`);
    } else {
        console.log(`User ${mappedUsername} not found in sheet ${sheetName}`);
    }

    return rowNumber;
}

