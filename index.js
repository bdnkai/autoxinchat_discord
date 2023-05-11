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

//==========================================   ACTIVATIONS  ==========================================
client.on('message', async (message) => {
    // Ignore messages from other bots
    if (message.author.bot) return;

    // Check if the message starts with the command prefix
    if (message.content.startsWith('!')) {
        const command = message.content.slice(1).toLowerCase();

        if (command === 'com') {
            // Replace the example commands with the actual ones
            message.reply(`List of commands, commands are always in lower-case
            and starts with an exclamation mark " !  "

                ! moshar     :       FB MOSHAR
                ! lion       :       FB LIONHEART
                ! lamohi     :       FB LAMOHI
                ! bull       :       FB BULL FIEND
                ! lotus      :       FB BIRYONG
                ! infernal   :       FB INFERNAL
                ! longbow    :       FB LONGBOW
                ! serpant    :       FB SERPANT MAID
                ! bb         :       FB BLACKBLOOD
                ! tk         :       FB TOMB KING
                ! cente      :       FB CENTEPEDEUS
                ! ck         :       FB CAPRIS KING


            `);
        } else if (command === 'hello') {
            message.reply(`

            Hello! I am the automated attendance bot for boss fights :)

            I run base on Image Recognition, so to use me successfully,
            please follow the instructions below:

            1. Screen Shot the chat box with the snippet tool and past it into Discord.

            2. Activate me by sending ! + FB name in lowercase,
            [ ex: for Moshar, type:   !moshar  ].

            3. Make sure the image is clear, then hit Send,
            you can send me multiple images as well, but it might take longer!

            4. You'll be notified when the job is completed

            Need the command for each boss? send: "  !com  "`);
        }
         else if (command === 'bdn') {
             const troll = await message.reply(
                 `  Do you know what BDN stands for?
             ....
             ....
             ....
             ....
             ....
             ....
             8==================================================================================D
             .....       BIG DI....MuddaFuQuh   LOLOLOL
             8==================================================================================D

             `)
             if(troll){
                 return troll.edit('too slow! 🤣🤣🤣')
             }
         }
        else if (command === 'lmao') {
            const troll = await message.reply(
                `  Do you know what BDN stands for?
             ....
             ....
             ....
             ....
             ....
             ....
             8==================================================================================D
             .....       BIG DI....MuddaFuQuh   LOLOLOL
             8==================================================================================D

             `)
            }
    }

    
    //==========================================   IMAGE PROCESSING  ==========================================
    
    // Check for attachments and URLs in the message
    const attachments = message.attachments.array();
    const urls = message.content.match(/https?:\/\/\S+/gi) || [];

    // Combine attachments and URLs
    const imageURLs = attachments.map((attachment) => attachment.url).concat(urls);

    if (imageURLs.length > 0) {
        const { bossName } = extractImageUrlAndBossName(message);

        if (bossName) {
            try {
                const proc = await message.channel.send(`Processing ${imageURLs.length} image(s)...`);

                // Process all image URLs concurrently
                const allUsernames = await Promise.all(
                    imageURLs.map(async (imageUrl) => {
                        const response = await axios.get(`${cloudURL}=${imageUrl}`);
                        const dataNames = response.data.names;
                        proc.edit(`Reading.... [ ${dataNames.join((' | '))} ]`)
                        return dataNames.filter((username) => username);

                    })
                    );
                // Flatten the allUsernames array and remove duplicates
                const uniqueUsernames = [...new Set([].concat(...allUsernames))]
                const uniqueResponse = [...new Set([].concat(...allUsernames))].join((
                    `  |  `));

                // Update attendance in Google Sheets
                await updateAttendance(uniqueUsernames, bossName);
                // Update attendance in Google Sheets
                
                // Send a confirmation message
                proc.edit(` ------- Completed! --------`)
                message.reply(
                    `  Attendance has been accounted for ${sheetMap[bossName.toUpperCase()]}:
                    
                    ${uniqueResponse}

                    `
                    );
            } catch (error) {
                message.reply('An error occurred while processing the images.');
                console.error(error);
            }
        }
    }
});


//==========================================  GET SHEETS  ==========================================

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

//==========================================   UPDATE SHEETS  ==========================================

async function updateAttendance(usernamesArray, bossName) {
    const sheetName = await findSheetNameForBoss(bossName);
    const sheetId = await getSheetId(sheetName);
    const columnIndices = await getColumnIndices(sheetId, sheetName);

    if (!columnIndices) {
        console.error(`Failed to get column indices for sheet ${sheetName}`);
        return;
    }

    const { usernameColumnIndex, attendanceColumnIndex } = columnIndices;
    
    
    const getUsersToUpdate = async (usernames) => {
        const usersToUpdate = await Promise.all(
            usernames.map(async (username) => {
                const rowNumber = await findUserRow(sheetName, username, usernameColumnIndex);
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
                    startColumnIndex: attendanceColumnIndex,
                    endColumnIndex: attendanceColumnIndex + 1
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

//==========================================   NAME MAPPING  ==========================================

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
    '贪生恶杀':'贪生恶杀 (Muhui)',
    'KneeHowMang':'KneeHowMang肏你媽'
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

//==========================================   GET COLUMNS  ==========================================

async function getColumnIndices(sheetId, sheetName) {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!8:8`,
        });
        const rowValues = response.data.values[0];
        const usernameIndex = rowValues.findIndex(cellValue => cellValue === "IGN");

        if (usernameIndex === -1) {
            console.error(`"Username" not found in row 8 for sheet ${sheetName}`);
            return null;
        }

        const attendanceIndex = rowValues.findIndex(cellValue => cellValue === "ATTENDANCE");
        
        if (attendanceIndex === -1) {
            console.error(`"Attendance" not found in row 8 for sheet ${sheetName}`);
            return null;
        }
        return {
            usernameColumnIndex: usernameIndex + 1,
            attendanceColumnIndex: attendanceIndex,
        };
    } catch (error) {
        console.error(`Error fetching row 8 values for sheet ${sheetName}:`, error);
        return null;
    }
}

function columnToLetter(column) {
    let temp;
    let letter = '';
    while (column > 0) {
        temp = (column - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        column = (column - temp - 1) / 26;
    }
    return letter;
}
//==========================================   FIND USER IN ROWS  ==========================================


async function findUserRow(sheetName, username, column) {
    //searchcolumn to conver column number to column letter
    const searchColumn = columnToLetter(column)
    // Read the data in the in searchColumn range
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!${searchColumn}9:${searchColumn}`,
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
    } else {
    }

    return rowNumber;
}

