import { config } from './config.js';

const CLIENT_ID = config.CLIENT_ID;
const CLIENT_SECRET = config.CLIENT_SECRET;
const REDIRECT_URL = chrome.identity.getRedirectURL();
const GITHUB_SCOPE = 'read:user repo';

console.log('Background script loaded');
console.log('Client ID:', CLIENT_ID);
console.log('Redirect URL:', REDIRECT_URL);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request);
    
    if (request.action === 'authenticate') {
        (async () => {
            try {
                console.log('Starting authentication...');
                const token = await initiateOAuth();
                console.log('Received token:', !!token);
                
                if (token) {
                    await chrome.storage.sync.set({ 'github_token': token });
                    console.log('Token stored successfully');
                    console.log('GitHub auth successful for user:', userData.login);
                    
                    sendResponse({ token, success: true });
                } else {
                    throw new Error('No token received');
                }
            } catch (error) {
                console.error('Auth error:', error);
                sendResponse({ error: error.message, success: false });
            }
        })();
        return true;
    } else if (request.type === 'completed') {
        console.log("Received completed message:", request);
        createFiles(request.answer, request.title, request.question)
            .then(result => {
                console.log("Upload result:", result);
                sendResponse(result);
            })
            .catch(error => {
                console.error("Upload error:", error);
                sendResponse({ success: false, message: error.message });
            });
        return true;
    }
});

async function initiateOAuth() {
    try {
        const authUrl = new URL('https://github.com/login/oauth/authorize');
        authUrl.searchParams.append('client_id', CLIENT_ID);
        authUrl.searchParams.append('redirect_uri', REDIRECT_URL);
        authUrl.searchParams.append('scope', GITHUB_SCOPE);
        
        console.log('Starting OAuth flow with URL:', authUrl.toString());
        
        const redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl.toString(),
            interactive: true
        });
        
        console.log('Received redirect URL');
        
        const responseUrl = new URL(redirectUrl);
        const code = responseUrl.searchParams.get('code');
        
        if (!code) {
            throw new Error('No authorization code received');
        }
        
        console.log('Exchanging code for token...');
        
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                redirect_uri: REDIRECT_URL
            })
        });
        
        if (!tokenResponse.ok) {
            throw new Error(`Token exchange failed: ${tokenResponse.status}`);
        }
        
        const data = await tokenResponse.json();
        console.log('Token exchange response:', data);
        
        if (data.error) {
            throw new Error(`GitHub error: ${data.error_description || data.error}`);
        }
        
        if (!data.access_token) {
            throw new Error('No access token in response');
        }
        
        return data.access_token;
    } catch (error) {
        console.error('OAuth flow error:', error);
        throw error;
    }
}

async function createFiles(answer, title, question) {
    try {
        const data = await chrome.storage.sync.get('github_token');
        if (!data.github_token) {
            throw new Error('GitHub token not found');
        }

        // Get user data
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${data.github_token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        const userData = await userResponse.json();

        // Check if folder exists
        try {
            const checkResponse = await fetch(`https://api.github.com/repos/${userData.login}/LeetCode-Questions/contents/${title}`, {
                headers: {
                    'Authorization': `token ${data.github_token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (checkResponse.ok) {
                return { success: false, message: "This question already exists in your repository!" };
            }
        } catch (error) {
            if (error.status !== 404) throw error;
        }

        const paths = [`${title}/answer.txt`, `${title}/question.txt`];
        const contents = [answer, question];

        for (let i = 0; i < paths.length; i++) {
            await fetch(`https://api.github.com/repos/${userData.login}/LeetCode-Questions/contents/${paths[i]}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${data.github_token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Added ${title} to LeetCode Questions`,
                    content: utf8_to_b64(contents[i])
                })
            });
        }

        return { success: true, message: "Successfully uploaded to GitHub!" };
    } catch (error) {
        return { success: false, message: `Upload failed: ${error.message}` };
    }
}

function utf8_to_b64(str) {
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        console.error("Encoding error:", e);
        throw new Error("Failed to encode content");
    }
}

chrome.runtime.onInstalled.addListener(async () => {
    try {
        const data = await chrome.storage.sync.get('github_token');
        console.log('Storage check on install:', data);
    } catch (error) {
        console.error('Storage check error:', error);
    }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.github_token) {
        console.log('Token storage changed:', {
            oldValue: !!changes.github_token.oldValue,
            newValue: !!changes.github_token.newValue
        });
    }
});