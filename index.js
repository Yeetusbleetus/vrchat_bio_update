const vrchat = require('vrchat');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const workingDir = process.cwd();
const configuration = new vrchat.Configuration({
    username: process.env.VRC_USERNAME,
    password: process.env.VRC_PASSWORD,
});


const AuthenticationApi = new vrchat.AuthenticationApi(configuration);
const UsersApi = new vrchat.UsersApi(configuration);

async function main() {
    const currentuser = (await AuthenticationApi.getCurrentUser()).data;

    if (fs.existsSync(`${workingDir}/bio.txt`)) {
        
    } else {
        console.log('No bio.txt file found in the working directory.');
        // create a file named bio.txt in the working directory
        fs.writeFileSync(`${workingDir}/bio.txt`, currentuser.bio);
    }

    async function GetBioVariables() {
        const RecentlyPlayedGames = await axios.get("http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key="+process.env.steamapikey+"&steamid="+process.env.steam64id+"&format=json");
        let vrcgame = {
            playtime_forever: 0,
        };

        // find the vrchat game in the recently played games
        for (let i = 0; i < RecentlyPlayedGames.data.response.games.length; i++) {
            if (RecentlyPlayedGames.data.response.games[i].appid == 438100) {
                vrcgame = RecentlyPlayedGames.data.response.games[i];
            }
        }

        console.log(vrcgame);

        let biovariables = {
            "vrcplaytime": Math.round(vrcgame.playtime_forever / 60),
        }
        return biovariables;
    }


    console.log(`Logged in as ${currentuser.displayName}`);

    async function updateBio(bio) {
        if (bio.length > 512) {
            return console.log('Bio is too long.');
        }
        console.log(await GetBioVariables())
        console.log("new bio: " + bio);
        //const user = (await UsersApi.updateUser(currentuser.id, {bio: bio})).data;
        //console.log(`Updated bio to ${user.bio}`);
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