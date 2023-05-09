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


client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});
client.on('message', async (message) => {
    // Ignore messages from other bots
    if (message.author.bot) return;

    console.log('Message received');

    // Fetch the message to ensure the attachments property is updated
    message = await message.fetch();

    const {imageUrl, bossName} = extractImageUrlAndBossName(message);
    console.log('Image URL:', imageUrl, 'Boss Name:', bossName);

    if (imageUrl && bossName) {
        try {
            console.log('Calling AutoXinChat API');
            // Call your autoxinchat app with the image URL
            const response = await axios.get(`${cloudURL}=${imageUrl}`);
            const usernames = response.data.usernames;
            console.log('Usernames extracted:', usernames);

            // Update attendance in Google Sheets
            await updateAttendance(usernames);

            // Send a confirmation message
            message.reply('Attendance has been updated!');
        } catch (error) {
            console.error(error);
            message.reply('An error occurred while processing the image.');
        }
    }
});




client.login(`${discordToken}`);
function extractImageUrlAndBossName(message) {
    const attachment = message.attachments.first();
    console.log(attachment)
    const imageUrl = attachment && (attachment.url.endsWith('.png') || attachment.url.endsWith('.jpg') || attachment.url.endsWith('.jpeg')) ? attachment.url : null;
    console.log(imageUrl)
    const commandRegex = /^!x(?:\s+(\w+))?/i;
    console.log(commandRegex)
    const match = message.content.match(commandRegex);
    const bossName = match && match[1] ? match[1] : null;

    return {imageUrl, bossName};
}


async function updateAttendance(usernames) {
    // Loop through the usernames
    for (const username of usernames) {
        // Find the sheet matching the boss name
        const sheetName = await findSheetNameForBoss(username);
        if (sheetName) {
            // Find the row number for the user in AL9:AL range
            const rowNumber = await findUserRow(sheetName, username);
            if (rowNumber) {
                // Update the corresponding cell in the AO9:AO range to 'TRUE'
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${sheetName}!AO${rowNumber}`,
                    valueInputOption: 'RAW',
                    requestBody: {
                        values: [['TRUE']],
                    },
                });
            } else {
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
    // Your logic to find the row number for the user in the AL9:AL range
}
