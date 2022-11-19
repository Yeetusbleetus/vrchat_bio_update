const vrchat = require('vrchat');
const fs = require('fs');
const axios = require('axios');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});
require('dotenv').config();

const workingDir = process.cwd();
console.log('Working directory: ' + workingDir);

let cookie;
if (fs.existsSync(`${workingDir}/cookie.txt`)) {
    cookie = fs.readFileSync(`${workingDir}/cookie.txt`, 'utf8');
}

const configuration = new vrchat.Configuration({
    username: process.env.VRC_USERNAME,
    password: process.env.VRC_PASSWORD,
    baseOptions: {
        cookies
    }
});

//axios.defaults.headers.common["twoFactorAuth"] = cookie

let extraConfig = {
    headers: {
        'twoFactorAuth': cookie
    }
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
        const RecentlyPlayedGames = await axios.get("http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key="+process.env.steamapikey+"&steamid="+process.env.steam64id+"&format=json");
        let vrcgame = {
            playtime_forever: 0,
        };
        for (let i = 0; i < RecentlyPlayedGames.data.response.games.length; i++) {
            if (RecentlyPlayedGames.data.response.games[i].appid == 438100) {
                vrcgame = RecentlyPlayedGames.data.response.games[i];
            }
        }
        let biovariables = {
            "vrcplaytime": Math.round(vrcgame.playtime_forever / 60),
            "current_time": new Date().toLocaleString(),
            "current_date": new Date().toLocaleDateString(),
            "current_world": currentuser.location,
            "last_activity": currentuser.last_activity
        }
        return biovariables;
    }

    async function updateBio(bio) {
        let vars = await GetBioVariables()
        for (const [key, value] of Object.entries(vars)) {
            //console.log(`${key}: ${value}`);
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
    setInterval(updateBioFromFile, 1000 * 60 * 10);

}

main();