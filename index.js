const vrchat = require('vrchat');
const fs = require('fs');
const axios = require('axios');
const FastSpeedtest = require("fast-speedtest-api");

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

require('dotenv').config();

let speedtest = new FastSpeedtest({
    token: process.env.fast_apptoken, // required
    verbose: false, // default: false
    timeout: 20000, // default: 5000
    https: true, // default: true
    urlCount: 8, // default: 5
    bufferSize: 8, // default: 8
    unit: FastSpeedtest.UNITS.Mbps // default: Bps
});

const workingDir = process.cwd();
console.log('Working directory: ' + workingDir);

let cookie;
if (fs.existsSync(`${workingDir}/cookie.txt`)) {
    cookie = fs.readFileSync(`${workingDir}/cookie.txt`, 'utf8');
}

const configuration = new vrchat.Configuration({
    username: process.env.VRC_USERNAME,
    password: process.env.VRC_PASSWORD,
});

//axios.defaults.headers.common["twoFactorAuth"] = cookie

let extraConfig = {
    headers: {}
}

const AuthenticationApi = new vrchat.AuthenticationApi(configuration);
const UsersApi = new vrchat.UsersApi(configuration);

async function main() {
    let req = await AuthenticationApi.getCurrentUser(extraConfig)
    let currentuser = req.data;
    if (currentuser.requiresTwoFactorAuth) {
        let code = await new Promise((resolve, reject) => {
            readline.question('Please enter your 2FA code: ', (code) => {
                resolve(code);
            });
        });
        console.log('Logging in with 2FA...');
        let resp = await AuthenticationApi.verify2FA({
            code: code
        },extraConfig);
        let cookie = resp.headers['set-cookie'];
        let accessToken = cookie[0].split(';')[0].split('=')[1];
        let newreq = await AuthenticationApi.getCurrentUser(extraConfig)
        currentuser = newreq.data;
        fs.writeFileSync(`${workingDir}/cookie.txt`, accessToken);
    } else {
        console.log('Logging in...');
    }
    

    if (fs.existsSync(`${workingDir}/bio.txt`)) {
        
    } else {
        console.log('No bio.txt file found in the working directory.');
        // create a file named bio.txt in the working directory
        fs.writeFileSync(`${workingDir}/bio.txt`, currentuser.bio);
    }

    async function GetBioVariables() {
        currentuser = (await AuthenticationApi.getCurrentUser(extraConfig)).data;
       
        let biovariables = {
            "vrcplaytime": async function() {
                const RecentlyPlayedGames = await axios.get("http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key="+process.env.steamapikey+"&steamid="+process.env.steam64id+"&format=json");
                let vrcgame = {
                    playtime_forever: 0,
                };
                for (let i = 0; i < RecentlyPlayedGames.data.response.games.length; i++) {
                    if (RecentlyPlayedGames.data.response.games[i].appid == 438100) {
                        vrcgame = RecentlyPlayedGames.data.response.games[i];
                    }
                }
                return Math.round(vrcgame.playtime_forever/6*10)/100;
            },
            "current_time": async function() {
                return new Date().toLocaleString()
            },
            "current_date": async function() {
                return new Date().toLocaleDateString()
            },
            "current_world": async function() {
                return currentuser.location
            },
            "last_activity": async function() {
                return currentuser.last_activity
            },
            "network_download": async function() {
                console.log('Testing download speed...');
                let res = await speedtest.getSpeed()
                console.log('Speedtest result: ' + res);
                return Math.round(res*100)/100
            },
            "HMD_model": async function() {
                let vrsettings = fs.readFileSync(`C:\\Program Files (x86)\\Steam\\config\\steamvr.vrsettings`, 'utf8');
                vrsettings = JSON.parse(vrsettings);
                //console.log(vrsettings);
                return vrsettings.LastKnown.HMDModel
            }

        }
        return biovariables;
    }

    async function updateBio(bio) {
        let vars = await GetBioVariables()
        let funcresults = {}
        for (const [key, func] of Object.entries(vars)) {
            //console.log(`${key}: ${value}`);
            let value = funcresults[key] || await func();
            funcresults[key] = value;
            bio = bio.replace(`{${key}}`, value);
        }
        if (bio.length > 512) {
            return console.log('Bio is too long.');
        }
        //console.log(`Updating bio to: ${bio}`);
        const user = (await UsersApi.updateUser(currentuser.id, {bio: bio},extraConfig)).data;
        console.log("Bio updated.");
    }

    // update bio occasionally
    async function updateBioFromFile() {
        const text = fs.readFileSync(`${workingDir}/bio.txt`, 'utf8');
        await updateBio(text);
    }

    updateBioFromFile();
    setInterval(updateBioFromFile, 1000 * 60 * 3);

}

main();