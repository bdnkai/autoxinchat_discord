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


client.on('message', async (message) => {
    // Ignore messages from other bots
    if (message.author.bot) return;

    // Fetch the message to ensure the attachments property is updated
    message = await message.fetch();

    const {imageUrl, bossName} = extractImageUrlAndBossName(message);
    console.log(`imageUrl: ${imageUrl}`);
    console.log(`bossName: ${bossName}`);

    if (imageUrl && bossName) {
        try {
            message.channel.send(`processing image...`)
            // Call your autoxinchat app with the image URL
            const response = await axios.get(`${cloudURL}=${imageUrl}`);
            const usernames = response.data.names;
            const names = usernames.filter((names, i)=> names)

            // Update attendance in Google Sheets
            await updateAttendance(names, bossName);

            // Send a confirmation message
            message.reply(` ${names} these players have been marked for attendance on FB ${bossName} `)
            //message.reply('Attendance has been updated!');
        } catch (error) {
            console.error(error);
            message.reply('An error occurred while processing the image.');
        }
    }
});


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


async function updateAttendance(usernames, bossernames) {
    // Loop through the usernames
    for (const username of usernames) {
        // Find the sheet matching the boss name
//        {lastCheck ? findUserRow(sheetName, lastCheck): null}


        const sheetName = await findSheetNameForBoss(bossernames);
        if (sheetName) {
            // Find the row number for the user in AL9:AL range
//            {lastCheck ? findUserRow(sheetName, lastCheck) : lastCheck && findUserRow}

            const rowNumber = await findUserRow(sheetName, username);
            if(rowNumber){
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${sheetName}!AO${rowNumber}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [['TRUE']],
                    },
                });
            }
            if (rowNumber) {
                // Update the corresponding cell in the AO9:AO range to 'TRUE'
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${sheetName}!AO${rowNumber}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [['TRUE']],
                    },
                });
            } else {
                const lastCheck = nameMap[username]

//                const lastIndex = rows.findIndex(row => row[0] && row[0].toLowerCase() === lastCheck.toLowerCase());
//                const lastNumber = lastIndex !== -1 ? lastIndex + 9 : null;
                console.log(`User ${username} not found in sheet ${sheetName}`);
            }
        } else {
            console.log(`Sheet not found for boss ${bossName}`);
        }
    }
}

const sheetMap = {
    'MOSHAR': 'FB MOSHAR',
    'LION': 'FB LIONHEART',
    'LAMOHI': 'FB LAMOHI',
    'BULL': 'FB BULLFIEND',
    'BIR': 'FB BIRYOUNG',
    'INFERNAL': 'FB INFERNAL',
    'LONGBOW': 'FB LONGBOW',
    'SERPANT': 'FB SERPANT MAID',
    'BB': 'FB BLACKBLOOD',
    'TK': 'FB TOMB KING',
    'CENTE': 'FB CENTEPEDEUS',
    'CK': 'FB CAPRIS KING',
    'GUARDIAN': 'WB GUARDIAN'
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

    // Find the index where the username matches (case-insensitive)
    const rowIndex = rows.findIndex(row => row[0] && row[0].toLowerCase() === username);

    // If a match is found, calculate the row number
    const rowNumber = rowIndex !== -1 ? rowIndex + 9 : null;

    if (rowNumber) {
        console.log(`User ${username} found at row ${rowNumber} in sheet ${sheetName}`);
        return rowNumber
    }
    const lastCheck = nameMap[username]
        const lastNumber = await findUserRow(sheetName, lastCheck);
        if(lastNumber){
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!AO${rowNumber}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [['TRUE']],
                },
            });

    }


}

