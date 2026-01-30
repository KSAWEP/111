const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();

// Discord Configuration
const CONFIG = {
    clientId: '1466749274959118379',
    clientSecret: 'nauC4HWH5l6m2M4TsLmlNjzOEI3nejZ2',
    botToken: 'MTQ2Njc0OTI3NDk1OTExODM3OQ.GsIN8E.ipo5fnxKHbs8btxG6bQ_zkbL9e8P0uVQXzMAjY',
    guildId: '1316069023179604040',
    roleId: '1466738121986277407',
    redirectUri: process.env.REDIRECT_URI || 'https://111-production-6d62.up.railway.app/callback'
};

// Serve static files
app.use(express.static('public'));

// Home page - Login with Discord
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Discord OAuth2 Login
app.get('/login', (req, res) => {
    const params = new URLSearchParams({
        client_id: CONFIG.clientId,
        redirect_uri: CONFIG.redirectUri,
        response_type: 'code',
        scope: 'identify guilds.join'
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// OAuth2 Callback
app.get('/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.redirect('/?error=no_code');
    }

    try {
        // Exchange code for token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: CONFIG.clientId,
                client_secret: CONFIG.clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: CONFIG.redirectUri
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            console.error('Token error:', tokenData);
            return res.redirect('/?error=token_failed');
        }

        // Get user info
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });

        const userData = await userResponse.json();

        // Add user to guild (server)
        await fetch(`https://discord.com/api/guilds/${CONFIG.guildId}/members/${userData.id}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bot ${CONFIG.botToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                access_token: tokenData.access_token
            })
        });

        // Add role to user
        const roleResponse = await fetch(
            `https://discord.com/api/guilds/${CONFIG.guildId}/members/${userData.id}/roles/${CONFIG.roleId}`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bot ${CONFIG.botToken}`
                }
            }
        );

        if (roleResponse.ok || roleResponse.status === 204) {
            res.redirect(`/success.html?user=${encodeURIComponent(userData.username)}`);
        } else {
            console.error('Role error:', await roleResponse.text());
            res.redirect('/?error=role_failed');
        }

    } catch (error) {
        console.error('Error:', error);
        res.redirect('/?error=server_error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
