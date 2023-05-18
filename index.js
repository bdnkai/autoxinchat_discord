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

const global_command = ['com', 'teabug', 'hi', 'bye', 'rate', 'names']
function extractImageUrlAndBossName(message) {
    // Your logic to extract image URL from the message
    const attachment = message.attachments.first();
    const imageUrl = attachment && (attachment.url.endsWith('.png') || attachment.url.endsWith('.jpg') || attachment.url.endsWith('.jpeg')) ? attachment.url : null;
    const commandRegex = /^!(\w+)/i
    const match = message.content.match(commandRegex);
    const bossName = match ? match[1] : teaMode;
    const teaMode = bossName == global_command[1] ? null : bossName 

    return {imageUrl, bossName};
}

//==========================================   ACTIVATIONS  ==========================================
client.on('message', async (message) => {
    // Ignore messages from other bots
    if (message.author.bot) return;
    const regex = /^!(\w+)/i
    const activation = message.content.match(regex);
    const activeName = activation ? activation[1] : null;

    // Check if the message starts with the command prefix
    if (message.content.startsWith('!')) {
        // console.log(message.content)
        const lineList = []
        const activator = message.content.slice(1).toLowerCase();
        const command = activator.split(' '[0])[0]
        const args = activator.split(' '[0])[1]


        if (command === global_command[0]) {
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
        } else if (command === global_command[1]) {
            message.reply(` 
                was there a mistake?
                ${cloudURL}/debug?url=${args}
            
            `)
            try{
                const res = await axios.get(`${cloudURL}/debug?url=${args}`)
                const dataMessage = await res.data.message[0]
                const dataList = await res.data.message[1]
                console.log(dataMessage, dataList)
                const debuggingResults = await dataMessage.map(async (list)=>{
                    await message.channel.send("`"+`${list}`+"`")

                })
            }catch(error){
                console.error(error)
            }
            



            
        } else if(command === global_command[2]){
            console.log('hi')

            try{
                const res = axios.post(`${cloudURL}/add_player`,`${args}`)
                .then((response)=>{
                    console.log('Player added:', response.data )
                    message.channel.send(`player successfully included`)

                })                
            }catch(error){
                console.error('Error adding players', error)
            }
            

        } else if(command === global_command[3]){
            console.log('bye')

            axios.delete(`${cloudURL}/remove_player/${args}`)
            .then((response) => {
              console.log('Player removed:', response.data);
              message.channel.send(`player successfully removed from the list ${args}`)

            })
            .catch((error) => {
              console.error('Error removing player:', error);
              message.channel.send(`player unsuccessfully changed to ${args}`)

            });


        } else if(command === global_command[4]){
            console.log('rate')

            axios.patch(`${cloudURL}/update_threshold/`, {
                rate: args
              })
                .then((response) => {
                  console.log('Threshold updated:', response.data);
                  message.channel.send(`thresh_rate successfully changed to ${args}`)
                })
                .catch((error) => {
                  console.error('Error updating player:', error);
                });            


        } else if(command === global_command[5]){
            console.log('names')

            try{
                const res = await axios.get(`${cloudURL}/get_list`)
                const dataList = await res.data.names
                console.log(dataList)
                message.channel.send(dataList)

            }catch(error){
                console.error(error)
            }

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

        if (bossName != 'teabug') {
            try {
                const proc = await message.channel.send(`Processing ${imageURLs.length} image(s)...`);

                // Process all image URLs concurrently
                const allUsernames = await Promise.all(
                    imageURLs.map(async (imageUrl) => {
                        const response = await axios.get(`${cloudURL}/process?url=${imageUrl}`);
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
        try{

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
            })
        }catch(error){
            return error, 400
        }

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
    'CK': 'FB CAPRIS KING',
    'WB': 'WB GUARDIAN',
    'BIP': 'Basic Item Price'
};

const nameMap = {
    '你爸爸' :'你爸爸 (New BBC)',
    '你野':'你野爹 (Piggy)',
    '叫我':'叫我爹 (IcedEarth)',
    '破天命':'破天命 (Edi)',
    'rovi':'Rovi (Canessa)',
    '贪生恶杀':'贪生恶杀 (Muhui)',
    'KneeHowMang':'KneeHowMang肏你媽',
    'ME请你妈ME傅你妈':'KneeHowMang肏你媽'
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
